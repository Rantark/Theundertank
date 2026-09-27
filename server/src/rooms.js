// ONLINE ROOMS
// Each room owns an authoritative Game simulation. Clients only send inputs; the room
// steps the sim at SERVER_TICK_HZ and broadcasts compact snapshots at SNAPSHOT_HZ.
import { Game, makeSeed, emptyInput, SERVER_TICK_HZ, SNAPSHOT_HZ, CHARACTER_MAP, UPGRADE_MAP, MAX_PLAYERS } from '@undercrank/shared';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_EVENTS_PER_SNAPSHOT = 180;
// Cosmetic events that can be dropped first when a snapshot gets crowded.
const LOW_PRIORITY = new Set(['fire', 'hit', 'fx']);

export function sanitizeName(n) {
  const s = String(n || '').toUpperCase().replace(/[^A-Z0-9 _-]/g, '').trim().slice(0, 12);
  return s || 'TINKER';
}

/** Clamp a client-provided profile (we trust co-op friends, but not malformed data). */
export function sanitizeProfile(p = {}) {
  const character = CHARACTER_MAP[p.character] ? p.character : 'tinker';
  const upgrades = {};
  for (const [id, lvl] of Object.entries(p.upgrades || {})) {
    const u = UPGRADE_MAP[id];
    if (u) upgrades[id] = Math.max(0, Math.min(u.maxLevel, Math.floor(Number(lvl) || 0)));
  }
  return { name: sanitizeName(p.name), character, upgrades };
}

export class Room {
  constructor(io, code, onEmpty) {
    this.io = io;
    this.code = code;
    this.onEmpty = onEmpty;
    this.members = new Map(); // socketId -> member
    this.game = null;
    this.timer = null;
    this.pendingEvents = [];
    this.tickCount = 0;
    this.nextSimId = 1;
  }

  get inGame() {
    return !!this.game;
  }

  add(socket, profile) {
    if (this.members.size >= MAX_PLAYERS) return 'Room is full';
    if (this.inGame) return 'A run is already in progress';
    const m = { socket, ...sanitizeProfile(profile), ready: false, simId: this.nextSimId++, input: emptyInput(), inputSeq: 0 };
    this.members.set(socket.id, m);
    socket.join(this.code);
    this.broadcastLobby();
    return null;
  }

  remove(socketId) {
    const m = this.members.get(socketId);
    if (!m) return;
    this.members.delete(socketId);
    m.socket.leave(this.code);
    if (this.game) {
      const p = this.game.playerById(m.simId);
      if (p && p.alive) {
        this.game.emit('toast', { text: `${p.name} disconnected.` });
        this.game.killPlayer(p);
      }
    }
    if (this.members.size === 0) {
      this.stop();
      this.game = null;
      this.onEmpty(this.code);
    } else this.broadcastLobby();
  }

  lobbyState() {
    return {
      code: this.code,
      inGame: this.inGame,
      players: [...this.members.values()].map((m) => ({ id: m.simId, name: m.name, character: m.character, ready: m.ready })),
    };
  }

  broadcastLobby() {
    this.io.to(this.code).emit('lobby', this.lobbyState());
  }

  updateProfile(socketId, profile) {
    const m = this.members.get(socketId);
    if (!m || this.inGame) return;
    Object.assign(m, sanitizeProfile({ ...m, ...profile }));
    this.broadcastLobby();
  }

  toggleReady(socketId) {
    const m = this.members.get(socketId);
    if (!m || this.inGame) return;
    m.ready = !m.ready;
    this.broadcastLobby();
    if ([...this.members.values()].every((q) => q.ready)) this.start();
  }

  setInput(socketId, msg) {
    const m = this.members.get(socketId);
    if (!m || !msg || typeof msg !== 'object') return;
    const i = msg.i || {};
    const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
    m.input = {
      mx: Math.max(-1, Math.min(1, num(i.mx))), my: Math.max(-1, Math.min(1, num(i.my))),
      ax: Math.max(-1, Math.min(1, num(i.ax))), ay: Math.max(-1, Math.min(1, num(i.ay))),
      fire: !!i.fire, dash: num(i.dash), active: num(i.active), cons: num(i.cons), inter: num(i.inter), ping: num(i.ping),
      px: typeof i.px === 'number' ? i.px : undefined, py: typeof i.py === 'number' ? i.py : undefined,
    };
    m.inputSeq = Math.max(m.inputSeq, num(msg.s, m.inputSeq));
  }

  forfeit(socketId) {
    const m = this.members.get(socketId);
    if (!m || !this.game) return;
    const p = this.game.playerById(m.simId);
    if (p && p.alive) this.game.killPlayer(p);
  }

  start() {
    const seed = makeSeed();
    const members = [...this.members.values()];
    this.game = new Game({
      seed,
      players: members.map((m, i) => ({ id: m.simId, slot: i, name: m.name, character: m.character, upgrades: m.upgrades })),
    });
    // Starting a run consumes existing input counters so stale presses don't fire.
    for (const m of members) {
      const p = this.game.playerById(m.simId);
      for (const k of ['dash', 'active', 'cons', 'inter', 'ping']) p.lastSeq[k] = m.input[k] || 0;
    }
    this.pendingEvents = this.game.drainEvents();
    this.io.to(this.code).emit('start', { seed });
    this.broadcastLobby();
    this.sendSnapshot(true);
    const dt = 1 / SERVER_TICK_HZ;
    const snapEvery = Math.max(1, Math.round(SERVER_TICK_HZ / SNAPSHOT_HZ));
    this.tickCount = 0;
    this.timer = setInterval(() => this.tick(dt, snapEvery), 1000 / SERVER_TICK_HZ);
    console.log(`[room ${this.code}] run started with ${members.length} player(s), seed ${seed}`);
  }

  tick(dt, snapEvery) {
    const g = this.game;
    if (!g) return;
    const inputs = {};
    for (const m of this.members.values()) inputs[m.simId] = m.input;
    try {
      g.step(dt, inputs);
    } catch (err) {
      console.error(`[room ${this.code}] simulation error`, err);
      g.gameOver();
    }
    this.pendingEvents.push(...g.drainEvents());
    this.tickCount++;
    if (this.tickCount % snapEvery === 0 || g.over) this.sendSnapshot(false);
    if (g.over) this.finish();
  }

  sendSnapshot(full) {
    const g = this.game;
    const snap = g.snapshot(full);
    let ev = this.pendingEvents;
    if (ev.length > MAX_EVENTS_PER_SNAPSHOT) {
      const important = ev.filter((e) => !LOW_PRIORITY.has(e.type));
      const cosmetic = ev.filter((e) => LOW_PRIORITY.has(e.type));
      ev = important.concat(cosmetic.slice(0, Math.max(0, MAX_EVENTS_PER_SNAPSHOT - important.length)));
    }
    snap.ev = ev;
    snap.ack = Object.fromEntries([...this.members.values()].map((m) => [m.simId, m.inputSeq]));
    this.pendingEvents = [];
    this.io.to(this.code).emit('snap', snap);
  }

  finish() {
    const summary = this.game.summary;
    this.stop();
    this.game = null;
    for (const m of this.members.values()) m.ready = false;
    this.io.to(this.code).emit('over', { summary });
    this.broadcastLobby();
    console.log(`[room ${this.code}] run over at depth ${summary?.depth}`);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export function makeCode(existing) {
  for (;;) {
    let c = '';
    for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!existing.has(c)) return c;
  }
}
