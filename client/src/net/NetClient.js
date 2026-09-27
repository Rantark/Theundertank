// ONLINE CLIENT
// Connects to the authoritative server, tracks the lobby, and exposes a NetSession
// with the same interface as LocalSession so GameScene can't tell the difference.
import { io } from 'socket.io-client';
import { generateFloor, decodeSnapshot, INTERP_DELAY_MS, TILE, emptyInput, PROTOCOL_VERSION } from '@undercrank/shared';
import { moveCircleForPrediction } from './predict.js';
import { App } from '../state.js';

export class NetClient {
  constructor(url) {
    this.url = url;
    this.socket = io(url || undefined, { transports: ['websocket', 'polling'], reconnection: false, timeout: 6000 });
    this.lobby = null;
    this.playerId = null;
    this.session = null;
    this.onLobby = null;
    this.onStart = null;
    this.onOver = null;
    this.onError = null;
    this.socket.on('lobby', (l) => {
      this.lobby = l;
      this.onLobby?.(l);
    });
    this.socket.on('start', (msg) => {
      this.session = new NetSession(this, msg.seed);
      this.onStart?.(msg);
    });
    this.socket.on('snap', (s) => this.session?.onSnapshot(s));
    this.socket.on('over', (msg) => {
      if (this.session) this.session.onOver(msg.summary);
      this.onOver?.(msg);
    });
    this.socket.on('disconnect', () => {
      this.connected = false;
      this.onError?.('Disconnected from server');
      if (this.session) this.session.onDisconnect();
    });
    this.socket.on('connect_error', (e) => this.onError?.(`Could not connect: ${e.message}`));
    this.socket.on('connect', () => (this.connected = true));
  }

  profile() {
    const d = App.save.data;
    return { name: d.name, character: d.unlocked.includes(d.characters[0]) ? d.characters[0] : 'tinker', upgrades: d.upgrades, version: PROTOCOL_VERSION };
  }

  create() {
    return new Promise((resolve) => this.socket.emit('create', this.profile(), resolve));
  }

  /** Join a room by code, or (code empty) whichever lobby is open on this server. */
  join(code) {
    return new Promise((resolve) => this.socket.emit('join', { code: code || '', profile: this.profile() }, resolve));
  }

  sendProfile() {
    this.socket.emit('profile', this.profile());
  }

  toggleReady() {
    this.socket.emit('ready');
  }

  startSession() {
    return this.session;
  }

  disconnect() {
    this.socket.emit('leave');
    this.socket.disconnect();
    if (App.net === this) App.net = null;
  }
}

/**
 * Renders the server's world with a fixed interpolation delay. The local player's own
 * position is predicted from local input and gently corrected toward the server.
 */
export class NetSession {
  constructor(client, seed) {
    this.online = true;
    this.client = client;
    this.seed = seed;
    this.snaps = [];
    this.invCache = {};
    this.floor = null;
    this.depth = 0;
    this.offset = null; // serverTime - clientTime (seconds)
    this.extraDelay = 0; // hit-stop visual freeze
    this.events = [];
    this.queuedEvents = [];
    this.over = false;
    this.summary = null;
    this.paused = false;
    this.sendAcc = 0;
    this.seq = 0;
    this.history = [];
    this.pred = null; // predicted own position
    this._view = null;
  }

  get localIds() {
    return [this.client.playerId];
  }

  get view() {
    return this._view;
  }

  onSnapshot(s) {
    const now = performance.now() / 1000;
    const off = s.t - now;
    // Track the smallest observed offset (least network delay), relaxing slowly.
    this.offset = this.offset === null ? off : Math.max(off, this.offset - 0.002);
    if (s.d !== this.depth || !this.floor) {
      this.depth = s.d;
      this.floor = generateFloor(this.seed, s.d);
    }
    // Persistent room flags are applied as they arrive.
    if (s.rs) {
      for (const [id, fl, hidden, feature] of s.rs) {
        const r = this.floor.rooms.get(id);
        if (!r) continue;
        r.visited = !!(fl & 1);
        r.seen = !!(fl & 2);
        r.cleared = !!(fl & 4);
        r.locked = !!(fl & 8);
        r.hatch = !!(fl & 16);
        r.hidden = {};
        for (const d of hidden) r.hidden[d] = true;
        r.feature = feature;
      }
    }
    const dec = decodeSnapshot(s, this.invCache);
    dec.t = s.t;
    dec.depth = s.d;
    dec.roomId = s.rm;
    dec.locked = !!s.lk;
    dec.timeStop = s.ts;
    dec.hatchT = s.ht;
    dec.ack = s.ack ? s.ack[this.client.playerId] : 0;
    dec.floor = this.floor;
    this.snaps.push(dec);
    if (this.snaps.length > 30) this.snaps.shift();
    for (const e of s.ev || []) this.queuedEvents.push({ t: s.t, e });
    this.reconcile(dec);
  }

  onOver(summary) {
    this.summary = summary;
    this.overPending = true;
  }

  onDisconnect() {
    if (!this.summary) this.summary = { depth: this.depth, time: 0, seed: this.seed, players: [] };
    this.over = true;
  }

  freeze(ms) {
    // Visual hit-stop: hold the render clock, then catch up.
    this.extraDelay = Math.min(0.25, this.extraDelay + ms / 1000);
  }

  // ------------------------------------------------------------ prediction
  reconcile(dec) {
    const me = dec.players.find((p) => p.id === this.client.playerId);
    if (!me) return;
    // Drop inputs the server has already applied, then replay the rest.
    this.history = this.history.filter((h) => h.seq > dec.ack);
    const room = this.floor.rooms.get(dec.roomId);
    let x = me.x;
    let y = me.y;
    if (me.alive && !me.downed && !me.dashing) {
      const speed = me.loadout?.stats?.moveSpeed || 95;
      for (const h of this.history) [x, y] = moveCircleForPrediction(room, x, y, me, h.mx * speed * h.dt, h.my * speed * h.dt);
    }
    this.serverPred = { x, y, roomId: dec.roomId };
    if (!this.pred || this.pred.roomId !== dec.roomId || Math.hypot(this.pred.x - x, this.pred.y - y) > 40 || me.dashing || me.downed) {
      this.pred = { x, y, roomId: dec.roomId };
    }
  }

  predictStep(dt, input, me, room) {
    if (!this.pred || !me || !me.alive || me.downed) return;
    const speed = me.loadout?.stats?.moveSpeed || 95;
    let mx = input.mx;
    let my = input.my;
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    [this.pred.x, this.pred.y] = moveCircleForPrediction(room, this.pred.x, this.pred.y, me, mx * speed * dt, my * speed * dt);
    // Blend toward the reconciled server estimate to remove drift.
    if (this.serverPred) {
      const k = Math.min(1, dt * 6);
      this.pred.x += (this.serverPred.x - this.pred.x) * k * 0.5;
      this.pred.y += (this.serverPred.y - this.pred.y) * k * 0.5;
    }
  }

  // ------------------------------------------------------------ main loop
  update(deltaMs, inputs) {
    const dt = deltaMs / 1000;
    const pid = this.client.playerId;
    const input = inputs[pid] || emptyInput();
    // Send input at ~30Hz (and immediately when an edge counter changes).
    this.sendAcc += dt;
    const edge = this.lastSent && ['dash', 'active', 'cons', 'inter', 'ping'].some((k) => input[k] !== this.lastSent[k]);
    if (this.sendAcc >= 1 / 30 || edge) {
      this.seq++;
      this.client.socket.volatile.emit('input', { s: this.seq, i: input });
      if (edge) this.client.socket.emit('input', { s: this.seq, i: input });
      this.history.push({ seq: this.seq, mx: input.mx, my: input.my, dt: this.sendAcc });
      if (this.history.length > 90) this.history.shift();
      this.sendAcc = 0;
      this.lastSent = input;
    }
    this.localInput = input;
    this.buildView(dt);
    if (this.overPending && this.renderTime >= (this.snaps[this.snaps.length - 1]?.t ?? 0) - 0.05) {
      this.over = true;
      this.overPending = false;
    }
  }

  buildView(dt) {
    if (!this.snaps.length || this.offset === null) return;
    this.extraDelay = Math.max(0, this.extraDelay - dt * 0.5);
    const now = performance.now() / 1000;
    const rt = now + this.offset - INTERP_DELAY_MS / 1000 - this.extraDelay;
    this.renderTime = rt;
    // Find bracketing snapshots.
    let a = this.snaps[0];
    let b = this.snaps[this.snaps.length - 1];
    for (let i = 0; i < this.snaps.length - 1; i++) {
      if (this.snaps[i].t <= rt && this.snaps[i + 1].t >= rt) {
        a = this.snaps[i];
        b = this.snaps[i + 1];
        break;
      }
    }
    if (rt < a.t) b = a;
    const span = b.t - a.t;
    const k = span > 0 ? Math.max(0, Math.min(1, (rt - a.t) / span)) : 1;
    const sameRoom = a.roomId === b.roomId && a.depth === b.depth;
    const lerpList = (listA, listB) => {
      if (!sameRoom) return listB;
      const m = new Map(listA.map((o) => [o.id, o]));
      return listB.map((o) => {
        const p = m.get(o.id);
        if (!p) return o;
        return { ...o, x: p.x + (o.x - p.x) * k, y: p.y + (o.y - p.y) * k };
      });
    };
    const room = this.floor.rooms.get(b.roomId);
    room.locked = b.locked;
    const players = lerpList(a.players, b.players);
    // Own player: predicted position + immediate local aim.
    const me = players.find((p) => p.id === this.client.playerId);
    if (me && this.pred && this.pred.roomId === b.roomId) {
      this.predictStep(dt, this.localInput || emptyInput(), me, room);
      me.x = this.pred.x;
      me.y = this.pred.y;
      const li = this.localInput;
      if (li && Math.hypot(li.ax, li.ay) > 0.25) me.aim = Math.atan2(li.ay, li.ax);
    }
    this._view = {
      floor: this.floor,
      room,
      depth: b.depth,
      players,
      enemies: lerpList(a.enemies, b.enemies),
      projectiles: lerpList(a.projectiles, b.projectiles),
      pickups: b.pickups,
      zones: b.zones,
      allies: lerpList(a.allies, b.allies),
      pings: b.pings,
      timeStop: b.timeStop,
      hatchT: b.hatchT,
    };
    // Release events whose snapshot time has been reached.
    const due = [];
    this.queuedEvents = this.queuedEvents.filter((q) => {
      if (q.t <= rt + 0.02) {
        due.push(q.e);
        return false;
      }
      return true;
    });
    this.events.push(...due);
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  abandon() {
    this.client.socket.emit('forfeit');
  }

  destroy() {
    if (this.client.session === this) this.client.session = null;
  }
}

export { TILE };
