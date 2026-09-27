// Area effects on the floor: steam clouds, fire pools, oil slicks, vents,
// telegraphed impacts (falling gears) and beams.
import { dist2 } from '../math.js';

export function spawnZone(g, o) {
  const z = {
    id: g.nextId++,
    type: o.type,
    team: o.team || 'player',
    pid: o.pid ?? null,
    x: o.x,
    y: o.y,
    r: o.r ?? 20,
    dps: o.dps ?? 0,
    damage: o.damage ?? 1,
    life: o.life ?? 2,
    maxLife: o.life ?? 2,
    tick: 0,
    t: 0,
    small: !!o.small,
    // vent / telegraph / beam specifics
    delay: o.delay ?? 0,
    phase: o.phase ?? 0,
    period: o.period ?? 4,
    x2: o.x2,
    y2: o.y2,
    width: o.width ?? 8,
    warn: o.warn ?? 0.8,
    active: o.active ?? 0.6,
    onImpact: o.onImpact || null,
    electrified: false,
    dead: false,
  };
  if (z.type === 'cloud' && z.team === 'player') {
    const owner = g.playerById(z.pid);
    if (owner?.loadout.flags.cloudsElectrified) z.electrified = true;
  }
  if (g.zones.length > 220) {
    // Drop the oldest short-lived zone to keep the sim bounded.
    const idx = g.zones.findIndex((q) => q.type === 'cloud' && q.small);
    if (idx >= 0) g.zones.splice(idx, 1);
    else return null;
  }
  g.zones.push(z);
  return z;
}

function enemiesIn(g, x, y, r) {
  return g.enemies.filter((e) => !e.dead && !e.untargetable && dist2(x, y, e.x, e.y) < (r + e.r) ** 2);
}

function hurtPlayersIn(g, x, y, r, dmg, fire = false) {
  for (const p of g.players) {
    if (!p.alive || p.downed) continue;
    if (fire && p.loadout.flags.fireImmune) continue;
    if (dist2(x, y, p.x, p.y) < (r + p.r) ** 2) g.hurtPlayer(p, dmg, x, y);
  }
}

function distToSegment2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(px, py, ax + dx * t, ay + dy * t);
}

export function updateZones(g, dt) {
  for (const z of g.zones) {
    if (z.dead) continue;
    z.t += dt;
    if (z.type !== 'vent') z.life -= dt;
    z.tick -= dt;
    switch (z.type) {
      case 'cloud':
      case 'fire': {
        if (z.tick <= 0) {
          z.tick = 0.25;
          if (z.team === 'player') {
            const owner = g.playerById(z.pid);
            const burnMult = owner?.loadout.flags.burnMult ? 1 + owner.loadout.flags.burnMult : 1;
            for (const e of enemiesIn(g, z.x, z.y, z.r)) {
              g.damageEnemy(e, z.dps * 0.25 * (z.type === 'fire' ? burnMult : 1), { pid: z.pid, silent: true });
              if (z.type === 'fire') g.applyStatus(e, 'burn', { dps: 4 * burnMult, duration: 1.5, pid: z.pid });
            }
            // Full Steam: standing in your own clouds slowly repairs you.
            if (z.type === 'cloud' && owner?.loadout.flags.cloudsHeal && owner.alive && !owner.downed) {
              if (dist2(z.x, z.y, owner.x, owner.y) < z.r * z.r) {
                owner.healAccum = (owner.healAccum || 0) + 0.25;
                if (owner.healAccum >= 6) {
                  owner.healAccum = 0;
                  g.healPlayer(owner, 1);
                }
              }
            }
          } else {
            hurtPlayersIn(g, z.x, z.y, z.r * 0.8, z.damage, z.type === 'fire');
          }
        }
        // Storm Front: electrified clouds periodically arc lightning.
        if (z.electrified) {
          z.zap = (z.zap ?? 0.3) - dt;
          if (z.zap <= 0) {
            z.zap = 0.55;
            const e = g.nearestEnemy(z.x, z.y, z.r + 30);
            if (e) {
              const owner = g.playerById(z.pid);
              const dmg = (owner ? owner.loadout.stats.damage : 10) * 0.7;
              g.emit('bolt', { pts: [[z.x, z.y], [e.x, e.y]] });
              g.damageEnemy(e, dmg, { pid: z.pid });
              g.chainLightning(e.x, e.y, e, 2, 70, dmg * 0.6, z.pid);
            }
          }
        }
        break;
      }
      case 'oil': {
        if (z.tick <= 0) {
          z.tick = 0.3;
          for (const e of enemiesIn(g, z.x, z.y, z.r)) g.applyStatus(e, 'slow', { amount: 0.5, duration: 0.5 });
          // Oil ignites if it touches a fire pool.
          for (const f of g.zones) {
            if (f.type === 'fire' && f.team === 'player' && dist2(f.x, f.y, z.x, z.y) < (f.r + z.r) ** 2) {
              z.type = 'fire';
              z.dps = 12;
              z.life = 3;
              z.maxLife = 3;
              break;
            }
          }
        }
        break;
      }
      case 'vent': {
        // Periodic eruption: idle -> warn (hiss) -> erupt. Hurts everyone.
        const cyc = (z.t + z.phase) % z.period;
        const warnStart = z.period - z.warn - z.active;
        const eruptStart = z.period - z.active;
        const state = cyc < warnStart ? 0 : cyc < eruptStart ? 1 : 2;
        if (state === 2 && z.state !== 2) g.emit('fx', { k: 'vent', x: z.x, y: z.y, r: z.r });
        if (state === 1 && z.state !== 1) g.emit('sfx', { n: 'hiss' });
        z.state = state;
        if (state === 2 && z.tick <= 0) {
          z.tick = 0.2;
          hurtPlayersIn(g, z.x, z.y, z.r, z.damage);
          for (const e of enemiesIn(g, z.x, z.y, z.r)) g.damageEnemy(e, 6, { silent: true });
        }
        break;
      }
      case 'telegraph': {
        // Warning circle, then a single impact.
        if (z.t >= z.delay && !z.fired) {
          z.fired = true;
          g.emit('fx', { k: 'impact', x: z.x, y: z.y, r: z.r });
          g.emit('shake', { a: 3 });
          hurtPlayersIn(g, z.x, z.y, z.r, z.damage);
          z.life = Math.min(z.life, 0.15);
          if (z.onImpact === 'ring') g.enemyRing(z.x, z.y, 8, 90, 0);
        }
        break;
      }
      case 'beam': {
        // Telegraphed line; damages players along it while active.
        if (z.t >= z.warn && z.t < z.warn + z.active) {
          if (!z.fired) {
            z.fired = true;
            g.emit('shake', { a: 2 });
            g.emit('sfx', { n: 'zap' });
          }
          for (const p of g.players) {
            if (!p.alive || p.downed) continue;
            if (distToSegment2(p.x, p.y, z.x, z.y, z.x2, z.y2) < (z.width / 2 + p.r - 1) ** 2) g.hurtPlayer(p, z.damage, p.x, p.y);
          }
        }
        if (z.t >= z.warn + z.active) z.dead = true;
        break;
      }
    }
    if (z.life <= 0 && z.type !== 'vent') {
      z.dead = true;
      if (z.type === 'cloud' && z.team === 'player' && !z.small) {
        const owner = g.playerById(z.pid);
        if (owner?.loadout.flags.cloudsExplode) g.explosion(z.x, z.y, z.r + 8, owner.loadout.stats.damage * 2, { team: 'player', pid: z.pid });
      }
    }
  }
  g.zones = g.zones.filter((z) => !z.dead);
}
