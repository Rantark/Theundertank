// NETWORK SNAPSHOTS
// Compact encoding of the dynamic simulation state for online play, plus the matching
// decoder used by clients. Static data (room tiles, floor layout) is never sent: clients
// regenerate it from the shared seed with generateFloor().
import { ENEMIES } from '../data/enemies.js';
import { BOSSES } from '../data/bosses.js';

const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;

const ENEMY_TYPES = [...ENEMIES.map((e) => e.id), ...BOSSES.map((b) => b.id)];
const PROJ_KINDS = ['bullet', 'shard', 'crit', 'orb', 'big', 'fire', 'bomb', 'boulder', 'needle'];
const PROJ_COLORS = [null, 'brass', 'fire', 'electric', 'plasma'];
const PICKUP_TYPES = ['cog', 'heart', 'item', 'consumable'];
const ZONE_TYPES = ['cloud', 'fire', 'oil', 'vent', 'telegraph', 'beam'];
const ALLY_TYPES = ['orbital', 'owl', 'turret'];

export function serializeSnapshot(g, full = false) {
  const snap = {
    tk: g.tick,
    t: r2(g.time),
    d: g.depth,
    rm: g.room.id,
    ts: r1(g.timeStop),
    ov: g.over ? 1 : 0,
    ht: r2(g.hatchT),
    boss: g.boss ? g.boss.id : 0,
  };
  if (full) snap.seed = g.seed;
  snap.pl = g.players.map((p) => {
    const o = {
      id: p.id, x: r1(p.x), y: r1(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), aim: r2(p.aim), hp: p.hp, f: p.facing,
      fl: (p.alive ? 1 : 0) | (p.downed ? 2 : 0) | (p.dashT > 0 ? 4 : 0) | (p.iframes > 0 ? 8 : 0) | (p.invuln > 0 ? 16 : 0) | (p.firing ? 32 : 0) | (p.overdrive > 0 ? 64 : 0),
      dc: p.dashCharges, dr: r2(p.dashRecharge), ac: p.active ? r1(p.active.charge) : 0, cg: p.cogs, dt: r1(p.downedT), rp: r2(p.reviveProgress), sus: r2(p.sustain),
    };
    if (full || p._sentInv !== p.invVersion) {
      o.inv = {
        name: p.name, slot: p.slot, character: p.character, items: p.items, active: p.active ? p.active.id : null, consumable: p.consumable,
        synergies: p.loadout.synergies, stats: p.loadout.stats, flags: p.loadout.flags, pstats: p.stats,
      };
      p._sentInv = p.invVersion;
    }
    return o;
  });
  snap.en = g.enemies.map((e) => [
    e.id, ENEMY_TYPES.indexOf(e.type), r1(e.x), r1(e.y), Math.max(0, Math.round((e.hp / e.maxHp) * 1000)),
    (e.flash > 0 ? 1 : 0) | (e.elite ? 2 : 0) | (e.burrowed ? 4 : 0) | (e.untargetable ? 8 : 0) | (e.status.burn ? 16 : 0) | (e.status.slow ? 32 : 0) | (e.fading ? 64 : 0) | (e.spawning > 0 ? 128 : 0) | (e.st?.mode === 'fuse' ? 256 : 0),
    r2(e.facing), Math.round(e.h || 0), r1(e.r), e.elite || 0,
  ]);
  snap.pr = g.projectiles.map((p) => [
    p.id, r1(p.x), r1(p.y), PROJ_KINDS.indexOf(p.kind), PROJ_COLORS.indexOf(p.color) + (p.team === 'enemy' ? 16 : 0), r1(p.r), Math.round(p.h || 0), r2(p.ang),
  ]);
  snap.pk = g.pickups.map((k) => [
    k.id, PICKUP_TYPES.indexOf(k.type), r1(k.x), r1(k.y), k.itemId || k.consId || 0, k.price, [...k.taken], k.onlyFor || 0, k.pedestal ? 1 : 0, k.value, k.needInteract ? 1 : 0,
  ]);
  snap.zn = g.zones.map((z) => [
    z.id, ZONE_TYPES.indexOf(z.type), r1(z.x), r1(z.y), r1(z.r), r2(z.life / (z.maxLife || 1)), z.team === 'player' ? 1 : 0,
    (z.electrified ? 1 : 0) | ((z.state || 0) << 1) | (z.fired ? 8 : 0), r2(z.t), z.x2 ?? 0, z.y2 ?? 0, z.width, r2(z.warn), r2(z.delay), r2(z.active),
  ]);
  snap.al = g.allies.map((a) => [a.id, ALLY_TYPES.indexOf(a.type), r1(a.x), r1(a.y), r2(a.ang), a.pid, a.small ? 1 : 0]);
  snap.pg = g.pings.map((q) => [q.id, q.pid, Math.round(q.x), Math.round(q.y), r1(q.t)]);
  if (full || g.roomStateDirty) {
    snap.rs = [...g.floor.rooms.values()].map((r) => [
      r.id, (r.visited ? 1 : 0) | (r.seen ? 2 : 0) | (r.cleared ? 4 : 0) | (r.locked ? 8 : 0) | (r.hatch ? 16 : 0),
      Object.keys(r.hidden).filter((d) => r.hidden[d]).join(''), r.feature ? { ...r.feature } : null,
    ]);
    g.roomStateDirty = false;
  }
  // Locked state of the current room changes often (combat) — always send it.
  snap.lk = g.room.locked ? 1 : 0;
  return snap;
}

/**
 * Decode a snapshot into plain "view" objects shaped like the simulation's own
 * entities, so the renderer can treat local and remote games identically.
 */
export function decodeSnapshot(s, invCache) {
  const players = s.pl.map((o) => {
    if (o.inv) invCache[o.id] = o.inv;
    const inv = invCache[o.id] || {};
    return {
      id: o.id, x: o.x, y: o.y, vx: o.vx, vy: o.vy, aim: o.aim, hp: o.hp, facing: o.f,
      alive: !!(o.fl & 1), downed: !!(o.fl & 2), dashing: !!(o.fl & 4), iframes: o.fl & 8 ? 1 : 0, invuln: o.fl & 16 ? 1 : 0,
      firing: !!(o.fl & 32), overdrive: o.fl & 64 ? 1 : 0,
      dashCharges: o.dc, dashRecharge: o.dr, active: inv.active ? { id: inv.active, charge: o.ac } : null, cogs: o.cg,
      downedT: o.dt, reviveProgress: o.rp, sustain: o.sus,
      name: inv.name, slot: inv.slot ?? 0, character: inv.character, items: inv.items || [], consumable: inv.consumable,
      loadout: { stats: inv.stats || {}, synergies: inv.synergies || [], flags: inv.flags || {} }, stats: inv.pstats || {},
    };
  });
  const enemies = s.en.map((a) => ({
    id: a[0], type: ENEMY_TYPES[a[1]], x: a[2], y: a[3], hpFrac: a[4] / 1000, flash: a[5] & 1 ? 0.05 : 0, elite: a[10] || null,
    burrowed: !!(a[5] & 4), untargetable: !!(a[5] & 8), burning: !!(a[5] & 16), slowed: !!(a[5] & 32), fading: !!(a[5] & 64),
    spawning: a[5] & 128 ? 0.3 : 0, fuse: !!(a[5] & 256), facing: a[6], h: a[7], r: a[8], boss: a[1] >= ENEMIES.length,
  }));
  const projectiles = s.pr.map((a) => ({
    id: a[0], x: a[1], y: a[2], kind: PROJ_KINDS[a[3]], color: PROJ_COLORS[a[4] & 15], team: a[4] & 16 ? 'enemy' : 'player', r: a[5], h: a[6], ang: a[7],
  }));
  const pickups = s.pk.map((a) => ({
    id: a[0], type: PICKUP_TYPES[a[1]], x: a[2], y: a[3], itemId: a[1] === 2 ? a[4] : null, consId: a[1] === 3 ? a[4] : null,
    price: a[5], taken: new Set(a[6]), onlyFor: a[7] || null, pedestal: !!a[8], value: a[9], needInteract: !!a[10],
  }));
  const zones = s.zn.map((a) => ({
    id: a[0], type: ZONE_TYPES[a[1]], x: a[2], y: a[3], r: a[4], lifeFrac: a[5], team: a[6] ? 'player' : 'enemy',
    electrified: !!(a[7] & 1), state: (a[7] >> 1) & 3, fired: !!(a[7] & 8), t: a[8], x2: a[9], y2: a[10], width: a[11], warn: a[12], delay: a[13], active: a[14],
  }));
  const allies = s.al.map((a) => ({ id: a[0], type: ALLY_TYPES[a[1]], x: a[2], y: a[3], ang: a[4], pid: a[5], small: !!a[6] }));
  const pings = s.pg.map((a) => ({ id: a[0], pid: a[1], x: a[2], y: a[3], t: a[4] }));
  return { players, enemies, projectiles, pickups, zones, allies, pings };
}

export { ENEMY_TYPES };
