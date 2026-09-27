// BOSS SIMULATION
// A boss is an enemy with `boss: true`. It alternates between an idle/movement state and
// attack patterns drawn (weighted) from its data definition. Patterns are small objects:
//   start(b, g, ps)          set up per-pattern state `ps`
//   update(b, g, dt, ps)     return true when finished
// Deeper boss floors (tiers) unlock extra patterns and generic modifiers.
import { BOSS_MAP, BOSS_MODIFIERS } from '../data/bosses.js';
import { ENEMIES } from '../data/enemies.js';
import { createEnemy, moveEnemy, randomFloorPoint } from './enemies.js';
import { angleTo, dist, turnToward } from '../math.js';
import { TILE, ROOM_W, ROOM_H } from '../constants.js';

const CX = (ROOM_W * TILE) / 2;
const CY = (ROOM_H * TILE) / 2;

export function createBoss(g, bossId, x, y) {
  const def = BOSS_MAP[bossId];
  const tier = Math.max(1, Math.floor(g.depth / 5));
  const hp = def.hp * g.scale.hp * (1 + 0.3 * (tier - 1)) * g.coopHpMult;
  const mods = BOSS_MODIFIERS.filter((m) => tier >= m.minTier).map((m) => m.id);
  const b = {
    id: g.nextId++,
    type: bossId,
    def,
    x,
    y,
    h: 0,
    r: def.r,
    hp,
    maxHp: hp,
    speed: def.speed,
    rate: 1,
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    facing: Math.PI / 2,
    st: {},
    flash: 0,
    elite: null,
    status: {},
    spawning: 0,
    untargetable: true,
    flying: true,
    shieldArc: 0,
    dmgTakenMult: 1,
    contact: Math.max(1, Math.round(def.contact * g.scale.dmg * 0.6)),
    noContact: false,
    boss: true,
    tier,
    mods,
    bulletMult: mods.includes('reinforced') ? 1.25 : 1,
    bulletSpeed: mods.includes('overcharged') ? 1.2 : 1,
    bs: { mode: 'intro', t: 1.8, phase: 1, last: null, summonT: 10, moveT: 0, wx: CX, wy: CY, ps: null },
    dead: false,
  };
  g.enemies.push(b);
  g.boss = b;
  g.emit('boss', { id: bossId, name: def.name, title: def.title, mods });
  return b;
}

// ------------------------------------------------------------------ helpers
const cnt = (b, n) => Math.max(1, Math.round(n * b.bulletMult));
function tgt(g, b) {
  return g.nearestPlayer(b.x, b.y, 9999) || { x: CX, y: CY };
}
function fire(g, b, ang, o = {}) {
  return g.enemyShot(b.x + Math.cos(ang) * b.r * 0.8, b.y + Math.sin(ang) * b.r * 0.8, ang, { ...o, speed: (o.speed || 90) * b.bulletSpeed });
}
function ring(g, b, n, speed, off = 0, o = {}) {
  for (let i = 0; i < n; i++) fire(g, b, off + (i / n) * Math.PI * 2, { speed, ...o });
}
function lob(g, b, tx, ty, onLand, extra = {}) {
  g.spawnProjectile({
    team: 'enemy', owner: b.id, x: b.x, y: b.y, ang: 0, speed: 0, r: 5, damage: g.enemyDmg(), kind: 'boulder',
    beh: { lob: { tx, ty, time: extra.time || 0.9, height: 50, onLand, ...extra } },
  });
}
function beam(g, x, y, ang, len, o = {}) {
  g.spawnZone({ type: 'beam', team: 'enemy', x, y, x2: x + Math.cos(ang) * len, y2: y + Math.sin(ang) * len, width: o.width || 10, warn: o.warn || 0.85, active: o.active || 0.45, damage: g.enemyDmg(), life: 5 });
}
function leapUpdate(g, b, dt, ps) {
  // Shared leap: ps.sx/sy -> ps.tx/ty over ps.air seconds.
  ps.lt += dt;
  const k = Math.min(1, ps.lt / ps.air);
  b.x = ps.sx + (ps.tx - ps.sx) * k;
  b.y = ps.sy + (ps.ty - ps.sy) * k;
  b.h = Math.sin(k * Math.PI) * 40;
  return k >= 1;
}
function startLeap(g, b, ps, air = 0.65) {
  const t = tgt(g, b);
  ps.sx = b.x;
  ps.sy = b.y;
  ps.tx = Math.max(40, Math.min(ROOM_W * TILE - 40, t.x));
  ps.ty = Math.max(40, Math.min(ROOM_H * TILE - 40, t.y));
  ps.air = air;
  ps.lt = 0;
  b.noContact = true;
  g.emit('sfx', { n: 'spring' });
}
function land(g, b, ringN, fireRing = false) {
  b.h = 0;
  b.noContact = false;
  ring(g, b, cnt(b, ringN), 85, g.rng.range(0, 1), fireRing ? { kind: 'fire' } : {});
  g.emit('shake', { a: 6 });
  g.emit('fx', { k: 'land', x: b.x, y: b.y, big: true });
  g.emit('sfx', { n: 'boom' });
}

// ------------------------------------------------------------------ patterns
export const PATTERNS = {
  // ---- Steam Golem
  stomp: {
    start: (b, g, ps) => Object.assign(ps, { n: b.bs.phase === 2 ? 3 : 2, t: 0.6 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      b.flash = 0.04;
      if (ps.t <= 0 && ps.n > 0) {
        ring(g, b, cnt(b, 18 + 2 * b.tier), 85, (ps.n % 2) * 0.17);
        g.emit('shake', { a: 5 });
        g.emit('fx', { k: 'land', x: b.x, y: b.y, big: true });
        g.emit('sfx', { n: 'boom' });
        ps.n--;
        ps.t = 0.55;
      }
      return ps.n <= 0 && ps.t <= 0.15;
    },
  },
  boulder: {
    start: (b, g, ps) => Object.assign(ps, { n: b.bs.phase === 2 ? 5 : 3, t: 0.3 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const t = tgt(g, b);
        lob(g, b, t.x + g.rng.range(-30, 30), t.y + g.rng.range(-30, 30), 'ring', { count: cnt(b, 8) });
        ps.n--;
        ps.t = 0.35;
      }
      return ps.n <= 0 && ps.t < -0.8;
    },
  },
  breath: {
    start: (b, g, ps) => Object.assign(ps, { t: 1.7, cd: 0, a: angleTo(b.x, b.y, tgt(g, b).x, tgt(g, b).y) }),
    update(b, g, dt, ps) {
      const t = tgt(g, b);
      ps.a = turnToward(ps.a, angleTo(b.x, b.y, t.x, t.y), dt * 0.9);
      b.facing = ps.a;
      ps.t -= dt;
      ps.cd -= dt;
      while (ps.cd <= 0) {
        ps.cd += 0.05 / b.bulletMult;
        fire(g, b, ps.a + g.rng.range(-0.35, 0.35), { speed: g.rng.range(95, 140), kind: 'fire' });
      }
      return ps.t <= 0;
    },
  },
  vents: {
    start: (b, g, ps) => Object.assign(ps, { n: 2, t: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        for (const p of g.players) if (p.alive && !p.downed) g.spawnZone({ type: 'telegraph', team: 'enemy', x: p.x, y: p.y, r: 20, delay: 1.0, life: 1.3, damage: g.enemyDmg() });
        for (let i = 0; i < 4; i++) {
          const [x, y] = randomFloorPoint(g, 0);
          g.spawnZone({ type: 'telegraph', team: 'enemy', x, y, r: 20, delay: 1.0, life: 1.3, damage: g.enemyDmg(), onImpact: 'ring' });
        }
        g.emit('sfx', { n: 'hiss' });
        ps.n--;
        ps.t = 1.1;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  charge: {
    start: (b, g, ps) => Object.assign(ps, { mode: 'wind', t: 0.7 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.mode === 'wind') {
        const t = tgt(g, b);
        ps.a = angleTo(b.x, b.y, t.x, t.y);
        b.facing = ps.a;
        b.flash = 0.04;
        if (ps.t <= 0) Object.assign(ps, { mode: 'run', t: 1.2 });
      } else if (ps.mode === 'run') {
        const hit = moveEnemy(g, b, Math.cos(ps.a) * 260, Math.sin(ps.a) * 260, dt);
        g.emit('fx', { k: 'trail', x: b.x, y: b.y });
        if (hit.hitX || hit.hitY || ps.t <= 0) {
          ring(g, b, cnt(b, 14), 90, 0);
          g.emit('shake', { a: 7 });
          g.emit('sfx', { n: 'boom' });
          Object.assign(ps, { mode: 'daze', t: 0.8 });
        }
      } else if (ps.mode === 'daze') return ps.t <= 0;
      return false;
    },
  },
  quake: {
    start: (b, g, ps) => Object.assign(ps, { n: 4, t: 0.5 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        ring(g, b, cnt(b, 22), 75 + ps.n * 8, ps.n * 0.14);
        g.emit('shake', { a: 4 });
        if (ps.n % 2 === 0) {
          const t = tgt(g, b);
          g.spawnZone({ type: 'telegraph', team: 'enemy', x: t.x, y: t.y, r: 22, delay: 0.9, life: 1.2, damage: g.enemyDmg() });
        }
        ps.n--;
        ps.t = 0.38;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },

  // ---- Clocktower Automaton
  clock_hands: {
    start: (b, g, ps) => Object.assign(ps, { t: 3.2, a: g.rng.range(0, 6.28), cd: 0, dir: g.rng.chance(0.5) ? 1 : -1, arms: 2 + (b.tier >= 2 ? 1 : 0) + (b.bs.phase === 2 ? 1 : 0) }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      ps.a += dt * 1.3 * ps.dir;
      ps.cd -= dt;
      while (ps.cd <= 0) {
        ps.cd += 0.085;
        for (let i = 0; i < ps.arms; i++) fire(g, b, ps.a + (i / ps.arms) * Math.PI * 2, { speed: 90 });
      }
      return ps.t <= 0;
    },
  },
  chime_rings: {
    start: (b, g, ps) => Object.assign(ps, { n: 3, t: 0.3 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const n = cnt(b, 28);
        const gap = g.rng.range(0, 6.28);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          const d = Math.abs(((a - gap + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          if (d < 0.38) continue; // leave a gap to slip through
          fire(g, b, a, { speed: 72 });
        }
        g.emit('sfx', { n: 'chime' });
        ps.n--;
        ps.t = 0.75;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  pendulum: {
    start: (b, g, ps) => Object.assign(ps, { n: 7, t: 0.2, i: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const t = tgt(g, b);
        const c = angleTo(b.x, b.y, t.x, t.y) + Math.sin(ps.i * 1.1) * 0.7;
        const k = cnt(b, 5);
        for (let j = 0; j < k; j++) fire(g, b, c + (j - (k - 1) / 2) * 0.16, { speed: 120 });
        ps.i++;
        ps.n--;
        ps.t = 0.26;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  gear_rain: {
    start: (b, g, ps) => Object.assign(ps, { n: 2, t: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        for (const p of g.players) if (p.alive && !p.downed) g.spawnZone({ type: 'telegraph', team: 'enemy', x: p.x, y: p.y, r: 16, delay: 1.1, life: 1.4, damage: g.enemyDmg(), onImpact: 'ring' });
        for (let i = 0; i < 6; i++) {
          const [x, y] = randomFloorPoint(g, 0);
          g.spawnZone({ type: 'telegraph', team: 'enemy', x, y, r: 16, delay: 1.1 + i * 0.05, life: 1.5, damage: g.enemyDmg() });
        }
        ps.n--;
        ps.t = 1.2;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  time_skip: {
    start: (b, g, ps) => Object.assign(ps, { n: 3, t: 0.2, blinked: false }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        if (!ps.blinked) {
          const [x, y] = randomFloorPoint(g, 80);
          g.emit('fx', { k: 'blink', x: b.x, y: b.y });
          b.x = x;
          b.y = y;
          g.emit('fx', { k: 'blink', x, y });
          g.emit('sfx', { n: 'chime' });
          ps.blinked = true;
          ps.t = 0.35;
        } else {
          const t = tgt(g, b);
          const a = angleTo(b.x, b.y, t.x, t.y);
          for (let j = -2; j <= 2; j++) fire(g, b, a + j * 0.12, { speed: 150 });
          ring(g, b, cnt(b, 10), 70, 0);
          ps.blinked = false;
          ps.n--;
          ps.t = 0.45;
        }
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  hour_strike: {
    start: (b, g, ps) => Object.assign(ps, { n: 2, t: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const t = tgt(g, b);
        const a0 = angleTo(b.x, b.y, t.x, t.y) + (ps.n === 1 ? Math.PI / 4 : 0);
        for (let i = 0; i < 4; i++) beam(g, b.x, b.y, a0 + (i * Math.PI) / 2, 400);
        ps.n--;
        ps.t = 1.3;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },

  // ---- Boiler-Hearted Beast
  pounce: {
    start(b, g, ps) {
      Object.assign(ps, { mode: 'wind', t: 0.45, n: 1 });
    },
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.mode === 'wind') {
        b.flash = 0.04;
        if (ps.t <= 0) {
          startLeap(g, b, ps);
          ps.mode = 'air';
        }
      } else if (ps.mode === 'air') {
        if (leapUpdate(g, b, dt, ps)) {
          land(g, b, 14, true);
          g.spawnZone({ type: 'fire', team: 'enemy', x: b.x, y: b.y, r: 20, life: 3, damage: g.enemyDmg() });
          ps.n--;
          if (ps.n > 0) Object.assign(ps, { mode: 'wind', t: 0.25 });
          else Object.assign(ps, { mode: 'rest', t: 0.5 });
        }
      } else if (ps.mode === 'rest') return ps.t <= 0;
      return false;
    },
  },
  pounce_triple: {
    start(b, g, ps) {
      Object.assign(ps, { mode: 'wind', t: 0.4, n: 3 });
    },
    update(b, g, dt, ps) {
      return PATTERNS.pounce.update(b, g, dt, ps);
    },
  },
  fire_spiral: {
    start: (b, g, ps) => Object.assign(ps, { t: 2.4, a: 0, cd: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      ps.a += dt * 2.6;
      ps.cd -= dt;
      while (ps.cd <= 0) {
        ps.cd += 0.075;
        fire(g, b, ps.a, { speed: 95, kind: 'fire' });
        fire(g, b, ps.a + Math.PI, { speed: 95, kind: 'fire' });
        if (b.bulletMult > 1) fire(g, b, -ps.a * 1.3, { speed: 70, kind: 'fire' });
      }
      return ps.t <= 0;
    },
  },
  coal_scatter: {
    start: (b, g, ps) => Object.assign(ps, { n: 6, t: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const t = tgt(g, b);
        lob(g, b, t.x + g.rng.range(-50, 50), t.y + g.rng.range(-40, 40), 'firePool', { count: 4, time: 0.8 });
        ps.n--;
        ps.t = 0.15;
      }
      return ps.n <= 0 && ps.t < -0.9;
    },
  },
  flame_wave: {
    start: (b, g, ps) => Object.assign(ps, { n: 3, t: 0.3 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const t = tgt(g, b);
        const a = angleTo(b.x, b.y, t.x, t.y);
        const px = Math.cos(a + Math.PI / 2);
        const py = Math.sin(a + Math.PI / 2);
        const gap = g.rng.int(2, 8);
        for (let i = 0; i < 11; i++) {
          if (i === gap || i === gap + 1) continue;
          const off = (i - 5) * 11;
          g.enemyShot(b.x + px * off, b.y + py * off, a, { speed: 75 * b.bulletSpeed, kind: 'fire' });
        }
        g.emit('sfx', { n: 'fire' });
        ps.n--;
        ps.t = 0.8;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  inferno: {
    start: (b, g, ps) => Object.assign(ps, { t: 3.2, trail: 0, ringT: 0.4 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      const t = tgt(g, b);
      const a = angleTo(b.x, b.y, t.x, t.y);
      moveEnemy(g, b, Math.cos(a) * 95, Math.sin(a) * 95, dt);
      ps.trail -= dt;
      if (ps.trail <= 0) {
        ps.trail = 0.22;
        g.spawnZone({ type: 'fire', team: 'enemy', x: b.x, y: b.y, r: 12, life: 2.5, damage: g.enemyDmg() });
      }
      ps.ringT -= dt;
      if (ps.ringT <= 0) {
        ps.ringT = 0.6;
        ring(g, b, cnt(b, 10), 80, g.rng.range(0, 1), { kind: 'fire' });
      }
      return ps.t <= 0;
    },
  },

  // ---- Tesla Matriarch
  bolts: {
    start: (b, g, ps) => Object.assign(ps, { n: 2, t: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const t = tgt(g, b);
        const a = angleTo(b.x, b.y, t.x, t.y);
        for (const off of [-0.5, 0, 0.5]) beam(g, b.x, b.y, a + off, 400, { width: 9 });
        ps.n--;
        ps.t = 1.2;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  orbs: {
    start: (b, g, ps) => Object.assign(ps, { t: 1.2, done: false }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (!ps.done) {
        ps.done = true;
        const n = cnt(b, 6);
        for (let i = 0; i < n; i++) fire(g, b, (i / n) * Math.PI * 2, { speed: 55, r: 4.5, kind: 'orb', life: 5, beh: { homing: { strength: 1.1, range: 300 } } });
        g.emit('sfx', { n: 'zap' });
      }
      return ps.t <= 0;
    },
  },
  storm_ring: {
    start: (b, g, ps) => Object.assign(ps, { n: 3, t: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const dir = ps.n % 2 ? 1 : -1;
        ring(g, b, cnt(b, 18), 70, g.rng.range(0, 1), { beh: { spiral: { turn: 0.8 * dir } }, life: 5 });
        ps.n--;
        ps.t = 0.6;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  grid: {
    start: (b, g, ps) => Object.assign(ps, { n: 2, t: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const W = ROOM_W * TILE;
        const H = ROOM_H * TILE;
        if (ps.n === 2) for (let i = 0; i < 4; i++) {
          const x = TILE * 2 + g.rng.range(0, W - TILE * 4);
          beam(g, x, TILE, Math.PI / 2, H - TILE * 2, { warn: 1.0 });
        }
        else for (let i = 0; i < 3; i++) {
          const y = TILE * 2 + g.rng.range(0, H - TILE * 4);
          beam(g, TILE, y, 0, W - TILE * 2, { warn: 1.0 });
        }
        ps.n--;
        ps.t = 1.4;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  blink_barrage: {
    start: (b, g, ps) => Object.assign(ps, { n: 3, t: 0 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const [x, y] = randomFloorPoint(g, 70);
        g.emit('fx', { k: 'blink', x: b.x, y: b.y });
        b.x = x;
        b.y = y;
        g.emit('fx', { k: 'blink', x, y });
        ring(g, b, cnt(b, 14), 110, g.rng.range(0, 1));
        g.emit('sfx', { n: 'zap' });
        ps.n--;
        ps.t = 0.6;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
  chain_nova: {
    start: (b, g, ps) => Object.assign(ps, { n: 3, t: 0.2 }),
    update(b, g, dt, ps) {
      ps.t -= dt;
      if (ps.t <= 0 && ps.n > 0) {
        const t = tgt(g, b);
        const a = angleTo(b.x, b.y, t.x, t.y);
        for (let i = -1; i <= 1; i++) fire(g, b, a + i * 0.5, { speed: 70, r: 6, kind: 'big', life: 1.1, beh: { burst: { count: 10, speed: 85 } } });
        ps.n--;
        ps.t = 0.7;
      }
      return ps.n <= 0 && ps.t <= 0;
    },
  },
};

// ------------------------------------------------------------------ boss loop
function bossMove(g, b, dt, sm) {
  const bs = b.bs;
  const t = tgt(g, b);
  const d = dist(b.x, b.y, t.x, t.y);
  const spd = b.speed * sm * (bs.phase === 2 ? 1.3 : 1);
  switch (b.def.move) {
    case 'chase': {
      if (d > 20) {
        const a = angleTo(b.x, b.y, t.x, t.y);
        moveEnemy(g, b, Math.cos(a) * spd, Math.sin(a) * spd, dt);
        b.facing = a;
      }
      break;
    }
    case 'center': {
      bs.moveT += dt;
      const wx = CX + Math.sin(bs.moveT * 0.5) * 70;
      const wy = CY - 20 + Math.sin(bs.moveT * 0.8) * 25;
      const a = angleTo(b.x, b.y, wx, wy);
      if (dist(b.x, b.y, wx, wy) > 3) moveEnemy(g, b, Math.cos(a) * spd, Math.sin(a) * spd, dt);
      break;
    }
    case 'prowl': {
      const a = angleTo(b.x, b.y, t.x, t.y);
      const side = a + Math.PI / 2;
      const mx = d > 75 ? Math.cos(a) : Math.cos(side) * 0.8 - Math.cos(a) * 0.2;
      const my = d > 75 ? Math.sin(a) : Math.sin(side) * 0.8 - Math.sin(a) * 0.2;
      moveEnemy(g, b, mx * spd, my * spd, dt);
      b.facing = a;
      break;
    }
    case 'float':
    default: {
      bs.moveT -= dt;
      if (bs.moveT <= 0 || dist(b.x, b.y, bs.wx, bs.wy) < 6) {
        bs.moveT = 2.5;
        [bs.wx, bs.wy] = randomFloorPoint(g, 50);
      }
      const a = angleTo(b.x, b.y, bs.wx, bs.wy);
      moveEnemy(g, b, Math.cos(a) * spd, Math.sin(a) * spd, dt);
    }
  }
}

export function updateBoss(g, b, dt, sm) {
  const bs = b.bs;
  if (bs.mode === 'intro') {
    bs.t -= dt;
    if (bs.t <= 0) {
      b.untargetable = false;
      bs.mode = 'idle';
      bs.t = 0.8;
    }
    return;
  }
  // Phase transition at 50% HP.
  if (bs.phase === 1 && b.hp < b.maxHp * 0.5) {
    bs.phase = 2;
    bs.mode = 'enrage';
    bs.t = 1.0;
    b.untargetable = true;
    b.h = 0;
    b.noContact = false;
    for (const p of g.projectiles) if (p.team === 'enemy') p.dead = true;
    g.emit('shake', { a: 8 });
    g.emit('toast', { text: `${b.def.name} overheats!`, color: 'cursed' });
    g.emit('sfx', { n: 'roar' });
    return;
  }
  if (bs.mode === 'enrage') {
    bs.t -= dt;
    b.flash = 0.05;
    if (bs.t <= 0) {
      b.untargetable = false;
      bs.mode = 'idle';
      bs.t = 0.3;
    }
    return;
  }
  // Summoner modifier: periodic reinforcements.
  if (b.mods.includes('summoner')) {
    bs.summonT -= dt;
    if (bs.summonT <= 0) {
      bs.summonT = 12;
      const pool = ENEMIES.filter((e) => e.minDepth <= g.depth && e.ai !== 'summoner');
      for (let i = 0; i < 2; i++) {
        const [x, y] = randomFloorPoint(g, 60);
        createEnemy(g, g.rng.weighted(pool).id, x, y);
      }
    }
  }
  const rateMult = (bs.phase === 2 ? 1.3 : 1) * (b.mods.includes('enraged') ? 1.4 : 1);
  if (bs.mode === 'idle') {
    bossMove(g, b, dt, sm);
    bs.t -= dt * rateMult;
    if (bs.t <= 0) {
      const avail = b.def.patterns.filter((p) => (p.minTier || 1) <= b.tier && (!p.phase || p.phase <= bs.phase) && p.id !== bs.last);
      const pick = g.rng.weighted(avail);
      bs.last = pick.id;
      bs.pattern = PATTERNS[pick.id];
      bs.ps = {};
      bs.pattern.start(b, g, bs.ps);
      bs.mode = 'pattern';
    }
  } else if (bs.mode === 'pattern') {
    if (bs.pattern.update(b, g, dt * (bs.phase === 2 ? 1.1 : 1), bs.ps)) {
      bs.mode = 'idle';
      bs.t = g.rng.range(b.def.idle[0], b.def.idle[1]);
    }
  }
}
