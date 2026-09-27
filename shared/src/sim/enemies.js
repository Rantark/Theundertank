// ENEMY SIMULATION
// Behaviours are small state machines keyed by `ai` in data/enemies.js. Every AI uses
// the same helpers (move, shoot, ring) so new enemy types are mostly data + a few lines.
import { ENEMY_MAP, ELITE_MODS } from '../data/enemies.js';
import { moveCircle, lineOfSight, solidForWalk } from './collision.js';
import { TILE, ROOM_W, ROOM_H, T } from '../constants.js';
import { angleTo, dist, dist2, turnToward } from '../math.js';

export function createEnemy(g, typeId, x, y, opts = {}) {
  const def = ENEMY_MAP[typeId];
  const sc = g.scale;
  const eliteMod = opts.elite ? g.rng.pick(ELITE_MODS).id : null;
  const hp = def.hp * sc.hp * g.coopHpMult * (eliteMod ? 2.6 : 1);
  const e = {
    id: g.nextId++,
    type: typeId,
    def,
    x,
    y,
    h: 0,
    r: def.r * (eliteMod ? 1.25 : 1),
    hp,
    maxHp: hp,
    speed: def.speed * sc.speed * (eliteMod === 'hasted' ? 1.4 : 1),
    rate: sc.rate * (eliteMod === 'hasted' ? 1.35 : 1), // attack speed multiplier
    vx: 0,
    vy: 0,
    kx: 0,
    ky: 0,
    facing: 0,
    st: { mode: 'init', t: 0 },
    flash: 0,
    elite: eliteMod,
    status: {},
    spawning: opts.instant ? 0 : 0.7,
    untargetable: !opts.instant,
    flying: !!def.flying,
    shieldArc: def.params?.shieldArc || 0,
    dmgTakenMult: (eliteMod === 'armored' ? 0.55 : 1) * (g.hasModifier('rusted') ? 0.8 : 1),
    contact: Math.max(1, Math.round(def.contact * sc.dmg)),
    noContact: false,
    parent: opts.parent ?? null,
    boss: false,
    dead: false,
    lastHitBy: null,
  };
  g.enemies.push(e);
  g.emit('fx', { k: 'spawn', x, y });
  return e;
}

// ---------------------------------------------------------------- helpers
const rr = (g, [a, b]) => g.rng.range(a, b);

function target(g, e) {
  return g.nearestPlayer(e.x, e.y, 9999) || { x: e.x, y: e.y + 1, fake: true };
}

export function moveEnemy(g, e, vx, vy, dt) {
  return moveCircle(e, vx * dt, vy * dt, g.room.grid, g.room, e.flying);
}

function shoot(g, e, ang, o = {}) {
  return g.enemyShot(e.x + Math.cos(ang) * e.r, e.y + Math.sin(ang) * e.r, ang, o);
}

function randomFloorPoint(g, minDistFromPlayers = 60) {
  for (let i = 0; i < 40; i++) {
    const tx = g.rng.int(2, ROOM_W - 3);
    const ty = g.rng.int(2, ROOM_H - 3);
    if (solidForWalk(g.room.grid, tx, ty, g.room)) continue;
    const x = tx * TILE + TILE / 2;
    const y = ty * TILE + TILE / 2;
    if (g.players.every((p) => !p.alive || dist(x, y, p.x, p.y) >= minDistFromPlayers)) return [x, y];
  }
  return [ROOM_W * TILE / 2, ROOM_H * TILE / 2];
}

// ---------------------------------------------------------------- AI behaviours
export const AI = {
  // Cogling: scurries toward you and periodically lunges.
  chaser(e, g, dt, sm) {
    const P = e.def.params;
    const t = target(g, e);
    const a = angleTo(e.x, e.y, t.x, t.y);
    const st = e.st;
    if (st.mode === 'init') Object.assign(st, { mode: 'move', t: rr(g, P.lungeEvery) });
    st.t -= dt * e.rate;
    if (st.mode === 'move') {
      moveEnemy(g, e, Math.cos(a) * e.speed * sm, Math.sin(a) * e.speed * sm, dt);
      if (st.t <= 0) Object.assign(st, { mode: 'wind', t: 0.28, a });
    } else if (st.mode === 'wind') {
      e.flash = Math.max(e.flash, 0.05);
      if (st.t <= 0) Object.assign(st, { mode: 'lunge', t: 0.32, a });
    } else if (st.mode === 'lunge') {
      moveEnemy(g, e, Math.cos(st.a) * P.lungeSpeed * sm, Math.sin(st.a) * P.lungeSpeed * sm, dt);
      if (st.t <= 0) Object.assign(st, { mode: 'move', t: rr(g, P.lungeEvery) });
    }
    e.facing = a;
  },

  // Rivet Turret: bolted down, fires aimed rivets.
  turret(e, g, dt) {
    const P = e.def.params;
    const t = target(g, e);
    const st = e.st;
    e.facing = turnToward(e.facing, angleTo(e.x, e.y, t.x, t.y), dt * 4);
    if (st.mode === 'init') Object.assign(st, { mode: 'wait', t: rr(g, P.every) * 0.6 });
    st.t -= dt * e.rate;
    if (st.mode === 'wait' && st.t <= 0) Object.assign(st, { mode: 'wind', t: 0.35 });
    else if (st.mode === 'wind') {
      e.flash = 0.05;
      if (st.t <= 0) Object.assign(st, { mode: 'fire', t: 0, n: P.burst + (g.depth >= 6 ? 2 : 0) });
    } else if (st.mode === 'fire' && st.t <= 0) {
      shoot(g, e, e.facing, { speed: P.shotSpeed });
      st.n--;
      st.t = 0.13;
      if (st.n <= 0) Object.assign(st, { mode: 'wait', t: rr(g, P.every) });
    }
  },

  // Steam Spitter: keeps its distance, strafes and spits spreads.
  kiter(e, g, dt, sm) {
    const P = e.def.params;
    const t = target(g, e);
    const st = e.st;
    const d = dist(e.x, e.y, t.x, t.y);
    const a = angleTo(e.x, e.y, t.x, t.y);
    e.facing = a;
    if (st.mode === 'init') Object.assign(st, { mode: 'move', t: rr(g, P.every), strafe: g.rng.chance(0.5) ? 1 : -1, sw: 1.5 });
    st.t -= dt * e.rate;
    st.sw -= dt;
    if (st.sw <= 0) {
      st.sw = g.rng.range(1, 2.2);
      st.strafe *= -1;
    }
    let mx = 0;
    let my = 0;
    if (d < P.keep[0]) [mx, my] = [-Math.cos(a), -Math.sin(a)];
    else if (d > P.keep[1]) [mx, my] = [Math.cos(a), Math.sin(a)];
    mx += Math.cos(a + Math.PI / 2) * st.strafe * 0.7;
    my += Math.sin(a + Math.PI / 2) * st.strafe * 0.7;
    const hit = moveEnemy(g, e, mx * e.speed * sm, my * e.speed * sm, dt);
    if (hit.hitX || hit.hitY) st.strafe *= -1;
    if (st.mode === 'move' && st.t <= 0) Object.assign(st, { mode: 'wind', t: 0.3 });
    if (st.mode === 'wind') {
      e.flash = 0.05;
      if (st.t <= 0) {
        const n = P.spread + (g.depth >= 8 ? 2 : 0);
        for (let i = 0; i < n; i++) shoot(g, e, a + (i - (n - 1) / 2) * 0.22, { speed: P.shotSpeed });
        g.emit('sfx', { n: 'eshoot' });
        Object.assign(st, { mode: 'move', t: rr(g, P.every) });
      }
    }
  },

  // Boiler Bomb: waddles close, fuse lights, boom.
  bomber(e, g, dt, sm) {
    const P = e.def.params;
    const t = target(g, e);
    const st = e.st;
    const a = angleTo(e.x, e.y, t.x, t.y);
    if (st.mode === 'init') st.mode = 'move';
    if (st.mode === 'move') {
      moveEnemy(g, e, Math.cos(a) * e.speed * sm, Math.sin(a) * e.speed * sm, dt);
      if (dist(e.x, e.y, t.x, t.y) < 30 && !t.fake) {
        Object.assign(st, { mode: 'fuse', t: P.fuse });
        g.emit('sfx', { n: 'fuse' });
      }
    } else if (st.mode === 'fuse') {
      st.t -= dt;
      e.flash = Math.sin(st.t * 40) > 0 ? 0.05 : 0;
      if (st.t <= 0) {
        e.fuseBlown = true;
        g.killEnemy(e, null);
      }
    }
  },

  // Spring Hopper: crouches, leaps at you, lands with a ring of rivets.
  hopper(e, g, dt) {
    const P = e.def.params;
    const t = target(g, e);
    const st = e.st;
    if (st.mode === 'init') Object.assign(st, { mode: 'idle', t: rr(g, P.idle) });
    st.t -= dt * (st.mode === 'air' ? 1 : e.rate);
    if (st.mode === 'idle' && st.t <= 0) Object.assign(st, { mode: 'crouch', t: 0.4 });
    else if (st.mode === 'crouch') {
      e.flash = 0.05;
      if (st.t <= 0) {
        // Leap toward (slightly past) the target, clamped to a reachable point.
        let tx = t.x + g.rng.range(-12, 12);
        let ty = t.y + g.rng.range(-12, 12);
        const d = dist(e.x, e.y, tx, ty);
        if (d > 110) {
          tx = e.x + ((tx - e.x) / d) * 110;
          ty = e.y + ((ty - e.y) / d) * 110;
        }
        Object.assign(st, { mode: 'air', t: P.air, sx: e.x, sy: e.y, tx, ty });
        e.noContact = true;
        g.emit('sfx', { n: 'spring' });
      }
    } else if (st.mode === 'air') {
      const k = 1 - st.t / P.air;
      const nx = st.sx + (st.tx - st.sx) * k;
      const ny = st.sy + (st.ty - st.sy) * k;
      moveEnemy(g, e, (nx - e.x) / dt, (ny - e.y) / dt, dt);
      e.h = Math.sin(Math.min(1, k) * Math.PI) * 26;
      if (st.t <= 0) {
        e.h = 0;
        e.noContact = false;
        const n = P.ring + (g.depth >= 7 ? 4 : 0);
        g.enemyRing(e.x, e.y, n, P.shotSpeed, g.rng.range(0, 1));
        g.emit('fx', { k: 'land', x: e.x, y: e.y });
        g.emit('shake', { a: 1.5 });
        Object.assign(st, { mode: 'idle', t: rr(g, P.idle) });
      }
    }
  },

  // Gear Spinner: ricochets diagonally, periodically spins out a spiral.
  bouncer(e, g, dt, sm) {
    const P = e.def.params;
    const st = e.st;
    if (st.mode === 'init') {
      const a = Math.PI / 4 + g.rng.int(0, 3) * (Math.PI / 2);
      Object.assign(st, { mode: 'roll', dx: Math.cos(a), dy: Math.sin(a), t: P.every });
    }
    const hit = moveEnemy(g, e, st.dx * e.speed * sm, st.dy * e.speed * sm, dt);
    if (hit.hitX) st.dx *= -1;
    if (hit.hitY) st.dy *= -1;
    e.facing += dt * 8;
    st.t -= dt * e.rate;
    if (st.mode === 'roll' && st.t <= 0) Object.assign(st, { mode: 'spin', t: 1.0, n: 0, a0: g.rng.range(0, 6.28) });
    if (st.mode === 'spin') {
      const want = Math.floor((1 - Math.max(0, st.t)) * P.spiralShots);
      while (st.n < want) {
        shoot(g, e, st.a0 + st.n * 0.55, { speed: P.shotSpeed });
        shoot(g, e, st.a0 + st.n * 0.55 + Math.PI, { speed: P.shotSpeed });
        st.n++;
      }
      if (st.t <= 0) Object.assign(st, { mode: 'roll', t: P.every });
    }
  },

  // Pipe Worm: tunnels (untargetable), surfaces near you, sprays a ring.
  burrower(e, g, dt) {
    const P = e.def.params;
    const t = target(g, e);
    const st = e.st;
    if (st.mode === 'init') {
      Object.assign(st, { mode: 'under', t: rr(g, P.under) });
      e.untargetable = true;
      e.noContact = true;
      e.burrowed = true;
    }
    st.t -= dt * e.rate;
    if (st.mode === 'under') {
      // Drift underground toward a spot near the target.
      const a = angleTo(e.x, e.y, t.x, t.y);
      if (dist(e.x, e.y, t.x, t.y) > 45) moveEnemy(g, e, Math.cos(a) * 70, Math.sin(a) * 70, dt);
      if (st.t <= 0) Object.assign(st, { mode: 'emerge', t: 0.45 });
    } else if (st.mode === 'emerge') {
      e.flash = 0.05;
      if (st.t <= 0) {
        e.burrowed = false;
        e.untargetable = false;
        e.noContact = false;
        const n = P.ring + (g.depth >= 8 ? 4 : 0);
        g.enemyRing(e.x, e.y, n, P.shotSpeed, g.rng.range(0, 1));
        g.emit('fx', { k: 'land', x: e.x, y: e.y });
        Object.assign(st, { mode: 'up', t: P.up, shot: 0.6 });
      }
    } else if (st.mode === 'up') {
      st.shot -= dt;
      if (st.shot <= 0) {
        st.shot = 99;
        const a = angleTo(e.x, e.y, t.x, t.y);
        for (let i = -1; i <= 1; i++) shoot(g, e, a + i * 0.2, { speed: P.shotSpeed + 20 });
      }
      if (st.t <= 0) {
        e.burrowed = true;
        e.untargetable = true;
        e.noContact = true;
        Object.assign(st, { mode: 'under', t: rr(g, P.under) });
        g.emit('fx', { k: 'land', x: e.x, y: e.y });
      }
    }
  },

  // Brass Sentinel: slow walker with a frontal shield; lobs a bursting orb.
  shielded(e, g, dt, sm) {
    const P = e.def.params;
    const t = target(g, e);
    const st = e.st;
    const a = angleTo(e.x, e.y, t.x, t.y);
    e.facing = turnToward(e.facing, a, dt * 1.6); // slow turning: flank it!
    if (st.mode === 'init') Object.assign(st, { mode: 'walk', t: P.every });
    if (dist(e.x, e.y, t.x, t.y) > 40) moveEnemy(g, e, Math.cos(e.facing) * e.speed * sm, Math.sin(e.facing) * e.speed * sm, dt);
    st.t -= dt * e.rate;
    if (st.mode === 'walk' && st.t <= 0) Object.assign(st, { mode: 'wind', t: 0.5 });
    if (st.mode === 'wind') {
      e.flash = 0.05;
      if (st.t <= 0) {
        shoot(g, e, e.facing, { speed: P.shotSpeed, r: 6, kind: 'big', life: 1.4, beh: { burst: { count: P.burst, speed: 80 } } });
        g.emit('sfx', { n: 'eshoot' });
        Object.assign(st, { mode: 'walk', t: P.every });
      }
    }
  },

  // Coil Wraith: blinks around the room and releases slow homing orbs.
  teleporter(e, g, dt) {
    const P = e.def.params;
    const t = target(g, e);
    const st = e.st;
    if (st.mode === 'init') Object.assign(st, { mode: 'wait', t: P.wait });
    st.t -= dt * e.rate;
    if (st.mode === 'wait' && st.t <= 0) {
      Object.assign(st, { mode: 'fade', t: 0.35 });
      e.untargetable = true;
      e.noContact = true;
      e.fading = true;
    } else if (st.mode === 'fade' && st.t <= 0) {
      const [x, y] = randomFloorPoint(g, 70);
      g.emit('fx', { k: 'blink', x: e.x, y: e.y });
      e.x = x;
      e.y = y;
      g.emit('fx', { k: 'blink', x, y });
      Object.assign(st, { mode: 'appear', t: 0.35 });
    } else if (st.mode === 'appear' && st.t <= 0) {
      e.untargetable = false;
      e.noContact = false;
      e.fading = false;
      const a = angleTo(e.x, e.y, t.x, t.y);
      for (let i = 0; i < P.orbs; i++) {
        shoot(g, e, a + (i - (P.orbs - 1) / 2) * 0.6, { speed: P.shotSpeed, r: 4, kind: 'orb', life: 4, beh: { homing: { strength: 1.3, range: 250 } } });
      }
      g.emit('sfx', { n: 'zap' });
      Object.assign(st, { mode: 'wait', t: P.wait });
    }
  },

  // Tinker Mother: keeps away and assembles coglings.
  summoner(e, g, dt, sm) {
    const P = e.def.params;
    const t = target(g, e);
    const st = e.st;
    const a = angleTo(e.x, e.y, t.x, t.y);
    if (st.mode === 'init') Object.assign(st, { mode: 'roam', t: P.every * 0.5 });
    const d = dist(e.x, e.y, t.x, t.y);
    if (d < 100) moveEnemy(g, e, -Math.cos(a) * e.speed * sm, -Math.sin(a) * e.speed * sm, dt);
    st.t -= dt * e.rate;
    if (st.mode === 'roam' && st.t <= 0) Object.assign(st, { mode: 'build', t: 0.8 });
    if (st.mode === 'build') {
      e.flash = 0.05;
      if (st.t <= 0) {
        const children = g.enemies.filter((c) => c.parent === e.id && !c.dead).length;
        for (let i = 0; i < P.spawn && children + i < P.maxChildren; i++) {
          const ca = g.rng.range(0, 6.28);
          createEnemy(g, 'cogling', e.x + Math.cos(ca) * 12, e.y + Math.sin(ca) * 12, { parent: e.id });
        }
        for (let i = -2; i <= 2; i++) shoot(g, e, a + i * 0.3, { speed: 70 });
        Object.assign(st, { mode: 'roam', t: P.every });
      }
    }
  },

  // Smog Bellows: rotating sprinkler of bullets.
  sprayer(e, g, dt, sm) {
    const P = e.def.params;
    const t = target(g, e);
    const st = e.st;
    if (st.mode === 'init') Object.assign(st, { mode: 'rest', t: P.rest, ang: 0, cd: 0 });
    st.t -= dt * e.rate;
    if (st.mode === 'rest') {
      const a = angleTo(e.x, e.y, t.x, t.y);
      moveEnemy(g, e, Math.cos(a) * e.speed * sm, Math.sin(a) * e.speed * sm, dt);
      if (st.t <= 0) Object.assign(st, { mode: 'spray', t: P.spray, dir: g.rng.chance(0.5) ? 1 : -1 });
    } else {
      st.ang += P.turn * st.dir * dt;
      e.facing = st.ang;
      st.cd -= dt * e.rate;
      if (st.cd <= 0) {
        st.cd = P.rate;
        for (let i = 0; i < P.arms; i++) shoot(g, e, st.ang + (i / P.arms) * Math.PI * 2, { speed: P.shotSpeed });
      }
      if (st.t <= 0) Object.assign(st, { mode: 'rest', t: P.rest });
    }
  },
};

// ---------------------------------------------------------------- update loop
export function updateEnemies(g, dt) {
  const overclock = g.hasModifier('overclocked') ? 1.25 : 1;
  for (const e of g.enemies) {
    if (e.dead) continue;
    e.flash = Math.max(0, e.flash - dt);
    if (g.timeStop > 0) continue;
    if (e.spawning > 0) {
      e.spawning -= dt;
      if (e.spawning <= 0) e.untargetable = false;
      continue;
    }
    // Status effects.
    const s = e.status;
    if (s.burn) {
      s.burn.t -= dt;
      s.burn.acc = (s.burn.acc || 0) + s.burn.dps * dt;
      if (s.burn.acc >= 3 || s.burn.t <= 0) {
        g.damageEnemy(e, s.burn.acc, { pid: s.burn.pid, silent: true, burn: true });
        s.burn.acc = 0;
      }
      if (s.burn.t <= 0) delete s.burn;
    }
    if (e.dead) continue;
    let sm = overclock;
    if (s.slow) {
      s.slow.t -= dt;
      sm *= 1 - s.slow.amount;
      if (s.slow.t <= 0) delete s.slow;
    }
    if (s.stun) {
      s.stun.t -= dt;
      if (s.stun.t <= 0) delete s.stun;
    }
    const oldRate = e.rate;
    if (s.slow) e.rate = oldRate * (1 - s.slow.amount * 0.6);
    if (!s.stun) {
      if (e.boss) g.updateBoss(e, dt, sm);
      else AI[e.def.ai](e, g, dt, sm);
    }
    e.rate = oldRate;
    if (e.dead) continue;

    // Knockback impulse (heavier enemies resist).
    if (Math.abs(e.kx) + Math.abs(e.ky) > 1) {
      const res = e.boss ? 0.15 : e.def?.ai === 'turret' ? 0.3 : 1;
      moveEnemy(g, e, e.kx * res, e.ky * res, dt);
      const decay = Math.exp(-12 * dt);
      e.kx *= decay;
      e.ky *= decay;
    }

    // Contact damage.
    if (!e.noContact && !e.burrowed) {
      for (const p of g.players) {
        if (!p.alive || p.downed) continue;
        if (dist2(e.x, e.y, p.x, p.y) < (e.r + p.r - 1) ** 2) g.hurtPlayer(p, e.contact, e.x, e.y);
      }
    }
  }

  // Soft separation so crowds don't stack into one blob.
  const list = g.enemies;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead || a.burrowed || a.boss) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead || b.burrowed || b.boss) continue;
      const rr2 = (a.r + b.r) ** 2;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 < rr2 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (a.r + b.r - d) * 0.5;
        const nx = (a.x - b.x) / d;
        const ny = (a.y - b.y) / d;
        moveCircle(a, nx * push, ny * push, g.room.grid, g.room, a.flying);
        moveCircle(b, -nx * push, -ny * push, g.room.grid, g.room, b.flying);
      }
    }
  }
  g.enemies = g.enemies.filter((e) => !e.dead);
}

export { randomFloorPoint, lineOfSight };
