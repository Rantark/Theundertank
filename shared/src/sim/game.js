// THE SIMULATION
// --------------
// `Game` is the single authoritative simulation. It runs in the browser for solo and
// couch co-op, and on the Node server for online play (clients then only render
// snapshots). It never touches rendering: it emits events (`g.events`) that the client
// turns into sound, particles, screen shake and UI toasts.
import { RNG } from '../rng.js';
import { TILE, ROOM_W, ROOM_H, DIRS, OPPOSITE, DOOR_TILE, T } from '../constants.js';
import { dist, dist2, angleTo } from '../math.js';
import { generateFloor } from './floorgen.js';
import { createPlayer, updatePlayer, recomputeLoadout, emptyInput } from './player.js';
import { spawnProjectile, updateProjectiles } from './projectiles.js';
import { runBehaviorHook } from './behaviors.js';
import { spawnZone, updateZones } from './zones.js';
import { syncAllies, updateAllies } from './allies.js';
import { runAction } from './actions.js';
import { createEnemy, updateEnemies, randomFloorPoint } from './enemies.js';
import { createBoss, updateBoss } from './bosses.js';
import { ENEMIES } from '../data/enemies.js';
import { ITEM_MAP, ITEMS, CONSUMABLE_MAP } from '../data/items.js';
import { CHARACTER_MAP } from '../data/characters.js';
import { spawnPickup, updatePickups, collectPickup, availableTo, rollItem, rollConsumable, dropCogs, giveItem, PRICES } from './loot.js';
import { serializeSnapshot } from './snapshot.js';

export function floorScale(depth) {
  const d = depth - 1;
  return {
    hp: 1 + 0.17 * d + 0.004 * d * d,
    dmg: 1 + Math.floor(d / 7),
    proj: Math.min(1.8, 1 + 0.035 * d),
    speed: Math.min(1.6, 1 + 0.02 * d),
    rate: Math.min(1.8, 1 + 0.03 * d),
    elite: Math.min(0.45, 0.03 * d),
  };
}

export class Game {
  /**
   * @param {object} o
   * @param {string} o.seed         run seed (shared with all clients)
   * @param {Array}  o.players      [{ id, name, slot, character, upgrades }]
   * @param {number} [o.startDepth]
   */
  constructor(o) {
    this.seed = o.seed;
    this.rng = new RNG(`${o.seed}:sim`);
    this.time = 0;
    this.tick = 0;
    this.nextId = 1;
    this.events = [];
    this.players = [];
    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.zones = [];
    this.allies = [];
    this.pings = [];
    this.floor = null;
    this.room = null;
    this.depth = 0;
    this.boss = null;
    this.timeStop = 0;
    this.over = false;
    this.hatchT = 0;
    this.seenItems = new Set();
    this.roomStateDirty = true;
    this.roomPxW = ROOM_W * TILE;
    this.roomPxH = ROOM_H * TILE;
    this.waveDelay = 0;
    this.gearStormT = 3;
    this.summary = null;

    for (const po of o.players) {
      const p = createPlayer(this, po);
      this.players.push(p);
    }
    this.coopHpMult = 1 + 0.45 * (this.players.length - 1);
    for (const p of this.players) this.applyStartingGear(p);
    this.startFloor(o.startDepth || 1);
  }

  // ------------------------------------------------------------------ utils
  emit(type, data = {}) {
    this.events.push({ type, ...data });
  }

  drainEvents() {
    const ev = this.events;
    this.events = [];
    return ev;
  }

  playerById(id) {
    return this.players.find((p) => p.id === id) || null;
  }

  hasModifier(id) {
    return this.floor ? this.floor.modifiers.includes(id) : false;
  }

  livingPlayers() {
    return this.players.filter((p) => p.alive && !p.downed);
  }

  nearestEnemy(x, y, range = 9999, exclude = null) {
    let best = null;
    let bd = range * range;
    for (const e of this.enemies) {
      if (e.dead || e.untargetable) continue;
      if (exclude && exclude.has(e.id)) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  nearestPlayer(x, y, range = 9999) {
    let best = null;
    let bd = range * range;
    for (const p of this.players) {
      if (!p.alive || p.downed) continue;
      const d = dist2(x, y, p.x, p.y);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  enemyDmg() {
    return Math.max(1, Math.round(this.scale.dmg));
  }

  // Delegates to subsystems (these are called from data-driven code).
  spawnProjectile(o) { return spawnProjectile(this, o); }
  spawnZone(o) { return spawnZone(this, o); }
  syncAllies(p) { syncAllies(this, p); }
  runAction(name, p, params, ctx) { runAction(this, name, p, params, ctx); }
  collectPickup(p, pk) { return collectPickup(this, p, pk); }
  updateBoss(b, dt, sm) { updateBoss(this, b, dt, sm); }

  /** Run a player's item hooks for an event ('kill', 'dash', ...). */
  runHooks(p, event, ctx = {}) {
    const hooks = p.loadout.hooks[event];
    if (!hooks) return;
    for (const h of hooks) {
      if (h.chance !== undefined && this.rng.next() > h.chance) continue;
      runAction(this, h.action, p, h.params || {}, { x: p.x, y: p.y, ...ctx });
    }
  }

  applyStartingGear(p) {
    const char = CHARACTER_MAP[p.character];
    const ids = [];
    for (const id of char?.startItems || []) {
      if (id === '@random_cursed') ids.push(this.rng.pick(ITEMS.filter((i) => i.rarity === 'cursed')).id);
      else ids.push(id);
    }
    const lvl = p.upgrades.start_item || 0;
    if (lvl > 0) {
      const pool = ITEMS.filter((i) => i.kind !== 'active' && (lvl >= 2 ? i.rarity === 'rare' || i.rarity === 'legendary' : i.rarity === 'common'));
      ids.push(this.rng.pick(pool).id);
    }
    for (const id of ids) {
      const def = ITEM_MAP[id];
      if (def.kind === 'active') p.active = { id, charge: def.active.charge };
      else p.items.push(id);
    }
    if (p.upgrades.start_tonic) p.consumable = 'tonic';
    recomputeLoadout(null, p);
    p.hp = p.loadout.stats.maxHp;
    p.dashCharges = p.loadout.stats.dashCharges;
  }

  // ------------------------------------------------------------------ floors & rooms
  startFloor(depth) {
    this.depth = depth;
    this.floor = generateFloor(this.seed, depth);
    this.scale = floorScale(depth);
    this.boss = null;
    this.enemies = [];
    for (const p of this.players) {
      if (!p.alive) {
        // The Undercrank spits fallen tinkers back out on the next floor.
        p.alive = true;
        p.downed = false;
        p.hp = Math.min(2, p.loadout.stats.maxHp);
        this.emit('toast', { text: `${p.name} is back on their feet!` });
      }
      if (depth > 1) this.runHooks(p, 'floor', {});
    }
    this.enterRoom(this.floor.startId, null);
    this.emit('floor', { depth, modifiers: this.floor.modifiers, boss: this.floor.boss });
    this.emit('sfx', { n: 'descend' });
  }

  nextFloor() {
    this.startFloor(this.depth + 1);
  }

  enterRoom(id, entryDir) {
    const room = this.floor.rooms.get(id);
    this.room = room;
    this.pickups = room.pickups;
    this.projectiles = [];
    this.zones = [];
    this.allies = this.allies.filter((a) => a.fromItem);
    this.pings = [];
    this.hatchT = 0;
    this.waveDelay = 0;
    room.visited = true;
    room.seen = true;
    for (const d of DIRS) {
      if (room.doors[d] && !room.hidden[d]) this.floor.rooms.get(room.doors[d]).seen = true;
    }

    // Place players just inside the entry door (or the centre).
    const n = this.players.length;
    this.players.forEach((p, i) => {
      let x = this.roomPxW / 2;
      let y = this.roomPxH / 2;
      const off = (i - (n - 1) / 2) * 12;
      if (entryDir) {
        const [tx, ty] = DOOR_TILE[entryDir];
        x = tx * TILE + TILE / 2;
        y = ty * TILE + TILE / 2;
        if (entryDir === 'n') y += TILE * 1.3;
        if (entryDir === 's') y -= TILE * 1.3;
        if (entryDir === 'w') x += TILE * 1.3;
        if (entryDir === 'e') x -= TILE * 1.3;
        if (entryDir === 'n' || entryDir === 's') x += off;
        else y += off;
      } else x += off;
      p.x = x;
      p.y = y;
      p.vx = p.vy = 0;
      p.dashT = 0;
      p.iframes = Math.max(p.iframes, 0.6);
    });
    for (const a of this.allies) {
      const o = this.playerById(a.pid);
      if (o) {
        a.x = o.x;
        a.y = o.y;
      }
    }

    // Steam vents from the template, plus extra ones under Overpressure.
    const vents = [...room.marks.vents];
    if (this.hasModifier('overpressure') && (room.type === 'combat' || room.type === 'exit')) {
      const vr = new RNG(`${this.seed}:vents:${this.depth}:${room.id}`);
      for (let i = 0; i < 3; i++) {
        const tx = vr.int(3, ROOM_W - 4);
        const ty = vr.int(3, ROOM_H - 4);
        if (room.grid[ty * ROOM_W + tx] === T.FLOOR) vents.push([tx, ty]);
      }
    }
    vents.forEach(([tx, ty], i) => {
      spawnZone(this, {
        type: 'vent', team: 'neutral', x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, r: 14,
        damage: this.enemyDmg(), period: this.hasModifier('overpressure') ? 3.6 : 5, phase: i * 1.3, warn: 0.9, active: 0.7, life: 1,
      });
    });

    if (!room.spawned) {
      room.spawned = true;
      this.populateRoom(room);
    }
    this.roomStateDirty = true;
    this.emit('room', { id, rtype: room.type, entry: entryDir });
  }

  populateRoom(room) {
    const cx = this.roomPxW / 2;
    const cy = this.roomPxH / 2;
    const ped = room.marks.pedestal ? [room.marks.pedestal[0] * TILE + 8, room.marks.pedestal[1] * TILE + 8] : [cx, cy];
    const luck = Math.max(...this.players.map((p) => p.loadout.stats.luck));
    switch (room.type) {
      case 'combat':
      case 'exit': {
        const count = Math.min(15, 3 + Math.floor(this.depth * 0.6) + this.rng.int(0, 2) + (this.players.length - 1) + (room.type === 'exit' ? 1 : 0));
        this.spawnWave(room, count);
        break;
      }
      case 'boss': {
        createBoss(this, this.floor.bossId, cx, TILE * 4);
        room.locked = true;
        break;
      }
      case 'treasure': {
        spawnPickup(this, { type: 'item', itemId: rollItem(this, { luck }), x: ped[0], y: ped[1], pedestal: true, needInteract: false });
        break;
      }
      case 'shop': {
        const mult = 1 + 0.06 * (this.depth - 1);
        const exclude = new Set();
        for (let i = 0; i < 3; i++) {
          const id = rollItem(this, { luck, exclude, activeWeight: 0.8 });
          exclude.add(id);
          spawnPickup(this, { type: 'item', itemId: id, x: cx - 60 + i * 60, y: cy - 20, pedestal: true, price: Math.round(PRICES[ITEM_MAP[id].rarity] * mult) });
        }
        spawnPickup(this, { type: 'consumable', consId: rollConsumable(this), x: cx - 30, y: cy + 30, price: Math.round(6 * mult) });
        spawnPickup(this, { type: 'heart', value: 2, x: cx + 30, y: cy + 30, price: Math.round(5 * mult), needInteract: true });
        room.feature = { kind: 'shopkeeper', x: cx, y: TILE * 2.5 };
        break;
      }
      case 'secret': {
        dropCogs(this, cx, cy, this.rng.int(8, 15) + this.depth);
        if (this.rng.chance(0.6)) spawnPickup(this, { type: 'item', itemId: rollItem(this, { luck: luck + 2, minRarity: 'rare' }), x: ped[0], y: ped[1] + 24, pedestal: true });
        else spawnPickup(this, { type: 'consumable', consId: rollConsumable(this), x: ped[0], y: ped[1] + 24 });
        break;
      }
      case 'challenge': {
        room.feature = { kind: 'lever', x: ped[0], y: ped[1], used: false };
        break;
      }
      case 'rest': {
        room.feature = { kind: 'bench', x: ped[0], y: ped[1], used: [] };
        dropCogs(this, ped[0], ped[1] + 30, this.rng.int(2, 5));
        break;
      }
      default:
        break;
    }
  }

  /** Spawn `count` enemies away from the players; locks the room. */
  spawnWave(room, count, opts = {}) {
    const pool = ENEMIES.filter((e) => e.minDepth <= this.depth + (opts.harder ? 2 : 0));
    const spots = room.marks.spawns.map(([tx, ty]) => [tx * TILE + 8, ty * TILE + 8]);
    this.rng.shuffle(spots);
    const farEnough = ([x, y]) => this.players.every((p) => !p.alive || dist(x, y, p.x, p.y) > 70);
    const good = spots.filter(farEnough);
    for (let i = 0; i < count; i++) {
      const def = this.rng.weighted(pool);
      const pos = good.length ? good.shift() : randomFloorPoint(this, 70);
      const elite = this.rng.chance(this.scale.elite + (opts.harder ? 0.15 : 0));
      createEnemy(this, def.id, pos[0] + this.rng.range(-3, 3), pos[1] + this.rng.range(-3, 3), { elite });
    }
    room.locked = true;
  }

  checkDoors() {
    const room = this.room;
    if (room.locked) return;
    for (const p of this.players) {
      if (!p.alive || p.downed) continue;
      for (const d of DIRS) {
        if (!room.doorOpen(d)) continue;
        const [tx, ty] = DOOR_TILE[d];
        const cx = tx * TILE + TILE / 2;
        const cy = ty * TILE + TILE / 2;
        const inLane = d === 'n' || d === 's' ? Math.abs(p.x - cx) < 9 : Math.abs(p.y - cy) < 9;
        const past = (d === 'n' && p.y < TILE * 0.75) || (d === 's' && p.y > this.roomPxH - TILE * 0.75) || (d === 'w' && p.x < TILE * 0.75) || (d === 'e' && p.x > this.roomPxW - TILE * 0.75);
        if (inLane && past) {
          this.enterRoom(room.doors[d], OPPOSITE[d]);
          return;
        }
      }
    }
  }

  /** Called when a player shot hits a wall tile: cracked walls hide secret passages. */
  shotHitWall(p, tx, ty) {
    const room = this.room;
    for (const d of DIRS) {
      if (!room.hidden[d]) continue;
      const [dx, dy] = DOOR_TILE[d];
      if (dx === tx && dy === ty) {
        room.secretHits = room.secretHits || {};
        room.secretHits[d] = (room.secretHits[d] || 0) + 1;
        this.emit('fx', { k: 'debris', x: tx * TILE + 8, y: ty * TILE + 8 });
        if (room.secretHits[d] >= 6) this.revealSecret(d);
      }
    }
  }

  revealSecret(d) {
    const room = this.room;
    room.hidden[d] = false;
    const other = this.floor.rooms.get(room.doors[d]);
    other.hidden[OPPOSITE[d]] = false;
    other.seen = true;
    this.roomStateDirty = true;
    this.emit('toast', { text: 'A secret passage grinds open!', color: 'legendary' });
    this.emit('sfx', { n: 'secret' });
    this.emit('shake', { a: 3 });
  }

  onRoomCleared() {
    const room = this.room;
    room.locked = false;
    room.cleared = true;
    this.roomStateDirty = true;
    this.emit('clear', {});
    this.emit('sfx', { n: 'door' });
    const cx = this.roomPxW / 2;
    const cy = this.roomPxH / 2;
    if (room.type === 'combat' || room.type === 'exit') {
      const r = this.rng.next();
      const heartLuck = Math.max(...this.players.map((p) => p.upgrades.heart_luck || 0));
      if (r < 0.25) dropCogs(this, cx, cy, this.rng.int(2, 4));
      else if (r < 0.37 + heartLuck * 0.04) spawnPickup(this, { type: 'heart', value: 1, x: cx, y: cy });
      else if (r < 0.43 + heartLuck * 0.04) spawnPickup(this, { type: 'consumable', consId: rollConsumable(this), x: cx, y: cy });
    }
    if (room.type === 'exit') {
      room.hatch = true;
      this.emit('toast', { text: 'A hatch to the depths opens...' });
    }
    if (room.type === 'challenge') {
      const luck = Math.max(...this.players.map((p) => p.loadout.stats.luck));
      spawnPickup(this, { type: 'item', itemId: rollItem(this, { luck: luck + 1, minRarity: 'rare' }), x: cx, y: cy - 10, pedestal: true });
      dropCogs(this, cx, cy + 20, 6 + this.depth);
    }
    for (const p of this.players) {
      if (!p.alive || p.downed) continue;
      p.stats.roomsCleared++;
      this.runHooks(p, 'roomClear', {});
      if (p.active) {
        const def = ITEM_MAP[p.active.id];
        p.active.charge = Math.min(def.active.charge, p.active.charge + def.active.charge * 0.2);
      }
    }
  }

  onBossKilled(b) {
    this.boss = null;
    for (const p of this.projectiles) if (p.team === 'enemy') p.dead = true;
    for (const e of this.enemies) if (!e.dead) this.killEnemy(e, null, true);
    const cx = this.roomPxW / 2;
    const cy = this.roomPxH / 2;
    const luck = Math.max(...this.players.map((p) => p.loadout.stats.luck));
    spawnPickup(this, { type: 'item', itemId: rollItem(this, { luck: luck + 3, minRarity: this.rng.chance(0.35) ? 'legendary' : 'rare' }), x: cx, y: cy - 30, pedestal: true });
    spawnPickup(this, { type: 'heart', value: 2, x: cx - 30, y: cy });
    dropCogs(this, b.x, b.y, 20 + b.tier * 10);
    this.room.hatch = true;
    this.emit('bossdown', { name: b.def.name });
    this.emit('shake', { a: 10 });
    this.emit('hitstop', { ms: 250 });
    this.emit('sfx', { n: 'bossdown' });
    this.emit('toast', { text: `${b.def.name} is destroyed!`, color: 'legendary' });
  }

  // ------------------------------------------------------------------ combat API
  enemyShot(x, y, ang, o = {}) {
    let beh = o.beh || {};
    if (this.hasModifier('magnetized') && !beh.homing) beh = { ...beh, homing: { strength: 0.6, range: 90 } };
    const speedMult = this.scale.proj * (this.hasModifier('overclocked') ? 1.15 : 1);
    return spawnProjectile(this, {
      team: 'enemy', owner: 0, x, y, ang, speed: (o.speed || 90) * speedMult, r: o.r || 3,
      damage: o.dmg || this.enemyDmg(), kind: o.kind || 'bullet', life: o.life || 5, range: 9999, beh,
    });
  }

  enemyRing(x, y, n, speed, off = 0, o = {}) {
    for (let i = 0; i < n; i++) this.enemyShot(x, y, off + (i / n) * Math.PI * 2, { speed, ...o });
  }

  lobLanded(p, prm) {
    switch (prm.onLand) {
      case 'ring':
        this.enemyRing(p.x, p.y, prm.count || 8, 80, this.rng.range(0, 1));
        this.emit('fx', { k: 'impact', x: p.x, y: p.y, r: 16 });
        this.emit('shake', { a: 2 });
        break;
      case 'firePool':
        spawnZone(this, { type: 'fire', team: 'enemy', x: p.x, y: p.y, r: 16, life: 4, damage: this.enemyDmg() });
        this.enemyRing(p.x, p.y, prm.count || 4, 70, this.rng.range(0, 1), { kind: 'fire' });
        break;
      case 'bomb': {
        this.explosion(p.x, p.y, prm.radius || 40, prm.damage || 50, { team: 'player', pid: p.owner });
        if (prm.chain) {
          const e = this.nearestEnemy(p.x, p.y, 80);
          if (e) this.chainLightning(p.x, p.y, null, prm.chain, 80, (prm.damage || 50) * 0.5, p.owner);
        }
        break;
      }
      case 'fire':
        spawnZone(this, { type: 'fire', team: 'player', pid: p.owner, x: p.x, y: p.y, r: prm.radius || 30, dps: 16, life: prm.life || 5 });
        this.emit('fx', { k: 'explosion', x: p.x, y: p.y, r: 14 });
        this.emit('sfx', { n: 'fire' });
        break;
    }
  }

  hitEnemyWithShot(e, p) {
    const owner = this.playerById(p.owner);
    let dmg = p.damage * (p.dmgScale || 1);
    if (owner?.loadout.flags.slowedVuln && e.status.slow) dmg *= 1 + owner.loadout.flags.slowedVuln;
    this.damageEnemy(e, dmg, { pid: p.owner, x: p.x, y: p.y, dirx: Math.cos(p.ang), diry: Math.sin(p.ang), knock: p.knock, crit: p.crit });
    runBehaviorHook(p, 'onHit', this, e);
    if (owner) this.runHooks(owner, 'hit', { x: p.x, y: p.y });
  }

  damageEnemy(e, amount, info = {}) {
    if (e.dead || e.untargetable) return;
    const amt = amount * e.dmgTakenMult;
    e.hp -= amt;
    e.flash = 0.08;
    if (info.pid) {
      e.lastHitBy = info.pid;
      const p = this.playerById(info.pid);
      if (p) p.stats.damage += amt;
    }
    if (info.knock && (info.dirx || info.diry)) {
      e.kx += info.dirx * info.knock;
      e.ky += info.diry * info.knock;
    }
    if (!info.silent) this.emit('hit', { x: info.x ?? e.x, y: info.y ?? e.y, c: info.crit ? 1 : 0, b: e.boss ? 1 : 0 });
    if (info.crit) this.emit('dmg', { x: e.x, y: e.y - e.r, v: Math.round(amt) });
    if (e.hp <= 0) this.killEnemy(e, info.pid ?? e.lastHitBy);
  }

  killEnemy(e, pid, quiet = false) {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    if (e.boss) {
      this.emit('kill', { x: e.x, y: e.y, t: e.type, r: e.r, boss: 1 });
      this.onBossKilled(e);
      return;
    }
    this.emit('kill', { x: e.x, y: e.y, t: e.type, r: e.r, elite: e.elite ? 1 : 0 });
    this.emit('shake', { a: e.elite ? 3 : 1 });
    if (e.elite) this.emit('hitstop', { ms: 50 });
    if (quiet) return;

    // Drops.
    const luck = Math.max(...this.players.map((p) => p.loadout.stats.luck));
    const cogBoost = this.hasModifier('rusted') ? 1.5 : 1;
    if (e.parent === null && this.rng.chance(Math.min(0.9, e.def.cogChance * (1 + luck * 0.08)))) dropCogs(this, e.x, e.y, (e.elite ? this.rng.int(3, 5) : 1) * cogBoost);
    else if (e.elite) dropCogs(this, e.x, e.y, this.rng.int(3, 5) * cogBoost);
    if (this.rng.chance(0.025)) spawnPickup(this, { type: 'heart', value: 1, x: e.x, y: e.y });

    // Death effects.
    if (e.def.ai === 'bomber') {
      this.explosion(e.x, e.y, e.def.params.radius, 30, { team: 'neutral', pid });
      if (e.fuseBlown) this.enemyRing(e.x, e.y, e.def.params.ring, 85, this.rng.range(0, 1));
    }
    if (e.elite === 'volatile') this.enemyRing(e.x, e.y, 10, 80, this.rng.range(0, 1));
    else if (this.hasModifier('volatile')) this.enemyRing(e.x, e.y, 6, 70, this.rng.range(0, 1));
    if (e.elite === 'splitting') for (let i = 0; i < 2; i++) createEnemy(this, 'cogling', e.x + (i ? 6 : -6), e.y, { instant: true, parent: e.id });

    const killer = this.playerById(pid);
    if (killer) {
      killer.stats.kills++;
      this.runHooks(killer, 'kill', { x: e.x, y: e.y });
      if (killer.active) {
        const def = ITEM_MAP[killer.active.id];
        killer.active.charge = Math.min(def.active.charge, killer.active.charge + 0.4);
      }
    }
  }

  applyStatus(e, name, prm) {
    if (e.dead) return;
    const s = e.status;
    if (name === 'burn') {
      if (!s.burn) this.emit('fx', { k: 'ignite', x: e.x, y: e.y });
      s.burn = { dps: Math.max(prm.dps, s.burn?.dps || 0), t: Math.max(prm.duration, s.burn?.t || 0), pid: prm.pid, acc: s.burn?.acc || 0 };
    } else if (name === 'slow') {
      s.slow = { amount: Math.max(prm.amount, s.slow?.amount || 0), t: Math.max(prm.duration, s.slow?.t || 0) };
    } else if (name === 'stun') {
      if (!e.boss) s.stun = { t: Math.max(prm.duration, s.stun?.t || 0) };
    }
  }

  explosion(x, y, r, dmg, o = {}) {
    this.emit('fx', { k: 'explosion', x, y, r });
    this.emit('shake', { a: o.small ? 1.5 : 3.5 });
    this.emit('sfx', { n: o.small ? 'pop' : 'boom' });
    for (const e of this.enemies) {
      if (e.dead || e.untargetable) continue;
      const d2 = dist2(x, y, e.x, e.y);
      if (d2 < (r + e.r) ** 2) {
        const d = Math.sqrt(d2) || 1;
        this.damageEnemy(e, dmg, { pid: o.pid, dirx: (e.x - x) / d, diry: (e.y - y) / d, knock: 160, silent: true });
      }
    }
    if (o.team !== 'player') {
      for (const p of this.players) {
        if (!p.alive || p.downed || p.loadout.flags.fireImmune) continue;
        if (dist2(x, y, p.x, p.y) < (r * 0.8 + p.r) ** 2) this.hurtPlayer(p, this.enemyDmg(), x, y);
      }
    }
    // Explosions can blast open secret walls.
    for (const d of DIRS) {
      if (!this.room.hidden[d]) continue;
      const [tx, ty] = DOOR_TILE[d];
      if (dist(x, y, tx * TILE + 8, ty * TILE + 8) < r + 14) this.revealSecret(d);
    }
    const owner = this.playerById(o.pid);
    if (owner && o.team === 'player') {
      if (o.firePool) spawnZone(this, { type: 'fire', team: 'player', pid: o.pid, x, y, r: r * 0.7, dps: 10, life: 2.5 });
      const chain = owner.loadout.flags.explosionsChain;
      if (chain) this.chainLightning(x, y, null, chain, 70, dmg * 0.5, o.pid);
    }
  }

  chainLightning(x, y, from, jumps, range, dmg, pid) {
    const hit = new Set(from ? [from.id] : []);
    const pts = [[x, y]];
    let cx = x;
    let cy = y;
    for (let i = 0; i < jumps; i++) {
      const next = this.nearestEnemy(cx, cy, range, hit);
      if (!next) break;
      hit.add(next.id);
      pts.push([next.x, next.y]);
      this.damageEnemy(next, dmg, { pid, silent: true });
      this.applyStatus(next, 'stun', { duration: 0.12 });
      cx = next.x;
      cy = next.y;
    }
    if (pts.length > 1) {
      this.emit('bolt', { pts: pts.map(([a, b]) => [Math.round(a), Math.round(b)]) });
      this.emit('sfx', { n: 'zap' });
    }
  }

  // ------------------------------------------------------------------ players
  hurtPlayer(p, dmg, sx, sy) {
    if (!p.alive || p.downed || p.iframes > 0 || p.invuln > 0) return false;
    const total = dmg + p.loadout.stats.damageTaken;
    p.hp -= total;
    p.iframes = 1.0;
    const a = angleTo(sx, sy, p.x, p.y);
    p.vx += Math.cos(a) * 160;
    p.vy += Math.sin(a) * 160;
    this.emit('hurt', { pid: p.id, x: p.x, y: p.y });
    this.emit('shake', { a: 5 });
    this.emit('hitstop', { ms: 70 });
    this.emit('sfx', { n: 'hurt' });
    if (p.hp <= 0) {
      p.hp = 0;
      const others = this.players.some((o) => o !== p && o.alive && !o.downed);
      if (others) {
        p.downed = true;
        p.downedT = p.loadout.stats.reviveWindow;
        p.reviveProgress = 0;
        this.emit('toast', { text: `${p.name} is down! Stand close to revive.`, color: 'cursed' });
        this.emit('sfx', { n: 'down' });
      } else this.killPlayer(p);
    } else this.runHooks(p, 'hurt', { x: p.x, y: p.y });
    return true;
  }

  healPlayer(p, amount) {
    const before = p.hp;
    p.hp = Math.min(p.loadout.stats.maxHp, p.hp + amount);
    if (p.hp > before) {
      this.emit('fx', { k: 'heal', x: p.x, y: p.y });
      this.emit('sfx', { n: 'heal' });
    }
  }

  revivePlayer(p, by) {
    p.downed = false;
    p.hp = 2;
    p.iframes = 2;
    p.reviveProgress = 0;
    this.emit('toast', { text: `${by.name} revived ${p.name}!` });
    this.emit('sfx', { n: 'heal' });
    this.emit('fx', { k: 'heal', x: p.x, y: p.y });
  }

  killPlayer(p) {
    p.alive = false;
    p.downed = false;
    p.hp = 0;
    this.emit('death', { pid: p.id, x: p.x, y: p.y });
    this.emit('shake', { a: 8 });
    this.emit('hitstop', { ms: 200 });
    this.emit('sfx', { n: 'death' });
    // Whoever is still downed can no longer be revived if nobody is standing.
    if (!this.players.some((o) => o.alive && !o.downed)) {
      for (const o of this.players) if (o.downed) {
        o.alive = false;
        o.downed = false;
      }
      this.gameOver();
    }
  }

  gameOver() {
    if (this.over) return;
    this.over = true;
    this.summary = {
      depth: this.depth,
      time: this.time,
      seed: this.seed,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, slot: p.slot, character: p.character, cogs: p.cogs, items: [...p.items, ...(p.active ? [p.active.id] : [])],
        synergies: p.loadout.synergies, ...p.stats, damage: Math.round(p.stats.damage),
      })),
    };
    this.emit('gameover', { summary: this.summary });
  }

  useConsumable(p) {
    const def = CONSUMABLE_MAP[p.consumable];
    p.consumable = null;
    p.invVersion++;
    runAction(this, def.action, p, def.params, { x: p.x, y: p.y });
    this.emit('sfx', { n: 'use' });
  }

  interact(p) {
    const room = this.room;
    // 1. Pickups that need an explicit interaction (shop wares, active items, swaps).
    let best = null;
    let bd = 20 * 20;
    for (const pk of this.pickups) {
      if (!availableTo(pk, p)) continue;
      const d = dist2(p.x, p.y, pk.x, pk.y);
      if (d < bd && (pk.needInteract || pk.type === 'item')) {
        bd = d;
        best = pk;
      }
    }
    if (best) {
      if (best.type === 'heart' && p.hp >= p.loadout.stats.maxHp) {
        this.emit('toast', { pid: p.id, text: 'Already at full health.' });
        return;
      }
      collectPickup(this, p, best);
      return;
    }
    // 2. Room features.
    const f = room.feature;
    if (f && dist2(p.x, p.y, f.x, f.y) < 24 * 24) {
      if (f.kind === 'bench') {
        if (f.used.includes(p.id)) this.emit('toast', { pid: p.id, text: 'You already rested here.' });
        else {
          f.used.push(p.id);
          this.healPlayer(p, 99);
          this.emit('toast', { pid: p.id, text: 'The warm steam restores you.' });
          this.roomStateDirty = true;
        }
      } else if (f.kind === 'lever' && !f.used) {
        f.used = true;
        room.wavesLeft = 2;
        this.spawnWave(room, 4 + Math.floor(this.depth * 0.5) + this.players.length, { harder: true });
        this.emit('toast', { text: 'CHALLENGE! Survive three waves.', color: 'cursed' });
        this.emit('sfx', { n: 'lever' });
        this.roomStateDirty = true;
      }
      return;
    }
    // 3. Hatch.
    if (room.hatch && dist2(p.x, p.y, this.roomPxW / 2, this.roomPxH / 2) < 20 * 20) this.nextFloor();
  }

  addPing(p) {
    const inp = p.input;
    let x = p.x + Math.cos(p.aim) * 70;
    let y = p.y + Math.sin(p.aim) * 70;
    if (typeof inp.px === 'number') {
      x = inp.px;
      y = inp.py;
    }
    this.pings = this.pings.filter((q) => q.pid !== p.id);
    this.pings.push({ id: this.nextId++, pid: p.id, x, y, t: 3.5 });
    this.emit('sfx', { n: 'ping' });
  }

  // ------------------------------------------------------------------ main step
  /**
   * Advance the simulation.
   * @param {number} dt seconds
   * @param {object} inputs map playerId -> input (see emptyInput())
   */
  step(dt, inputs = {}) {
    if (this.over) return;
    this.time += dt;
    this.tick++;
    this.timeStop = Math.max(0, this.timeStop - dt);

    for (const p of this.players) {
      p.input = inputs[p.id] || p.input || emptyInput();
      updatePlayer(this, p, dt);
      if (this.over) return;
    }
    const roomBefore = this.room;
    this.checkDoors();
    if (this.room !== roomBefore) return;

    updateAllies(this, dt);
    updateEnemies(this, dt);
    updateProjectiles(this, dt);
    updateZones(this, dt);
    updatePickups(this, dt);
    for (const q of this.pings) q.t -= dt;
    this.pings = this.pings.filter((q) => q.t > 0);

    const room = this.room;
    // Challenge waves and room clearing.
    if (room.locked && this.enemies.length === 0) {
      if (room.wavesLeft > 0) {
        this.waveDelay += dt;
        if (this.waveDelay > 0.8) {
          this.waveDelay = 0;
          room.wavesLeft--;
          this.spawnWave(room, 4 + Math.floor(this.depth * 0.5) + this.players.length, { harder: true });
          this.emit('toast', { text: `Wave ${3 - room.wavesLeft}!` });
        }
      } else if (room.type !== 'boss' || !this.boss) this.onRoomCleared();
    }

    // Gear Storm modifier: falling gears while fighting.
    if (this.hasModifier('gear_storm') && room.locked) {
      this.gearStormT -= dt;
      if (this.gearStormT <= 0) {
        this.gearStormT = this.rng.range(1.8, 3);
        const t = this.rng.pick(this.livingPlayers());
        if (t) spawnZone(this, { type: 'telegraph', team: 'enemy', x: t.x + this.rng.range(-20, 20), y: t.y + this.rng.range(-20, 20), r: 14, delay: 1.1, life: 1.3, damage: this.enemyDmg() });
      }
    }

    // Standing on an open hatch descends.
    if (room.hatch) {
      const on = this.livingPlayers().some((p) => dist2(p.x, p.y, this.roomPxW / 2, this.roomPxH / 2) < 12 * 12);
      this.hatchT = on ? this.hatchT + dt : 0;
      if (this.hatchT > 0.9) this.nextFloor();
    }
  }

  snapshot(full = false) {
    return serializeSnapshot(this, full);
  }
}

export { floorScale as scaleForDepth, emptyInput };
