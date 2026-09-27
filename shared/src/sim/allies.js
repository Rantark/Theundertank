// Player-owned helpers: orbitals, familiars (owl) and deployable turrets.
import { dist2, angleTo } from '../math.js';
import { lineOfSight } from './collision.js';
import { makePlayerShot } from './player.js';

/** Recreate a player's item-granted allies (called whenever their loadout changes). */
export function syncAllies(g, p) {
  g.allies = g.allies.filter((a) => !(a.pid === p.id && a.fromItem));
  const specs = p.loadout.allies;
  let orbIndex = 0;
  const orbTotal = specs.filter((s) => s.type === 'orbital').reduce((n, s) => n + (s.count || 1), 0);
  for (const spec of specs) {
    const count = spec.count || 1;
    for (let i = 0; i < count; i++) {
      const a = {
        id: g.nextId++,
        pid: p.id,
        type: spec.type,
        fromItem: true,
        x: p.x,
        y: p.y,
        r: spec.small ? 3 : 4,
        ang: 0,
        spec,
        cd: 0,
        hitCd: new Map(),
        blocksShots: spec.type === 'orbital',
        small: !!spec.small,
      };
      if (spec.type === 'orbital') {
        a.ang = (orbIndex / Math.max(1, orbTotal)) * Math.PI * 2;
        orbIndex++;
      }
      g.allies.push(a);
    }
  }
}

export function spawnTurret(g, p, x, y, params) {
  g.allies.push({
    id: g.nextId++, pid: p.id, type: 'turret', fromItem: false, x, y, r: 6,
    ang: p.aim, life: params.life, spec: params, cd: 0, hitCd: new Map(), blocksShots: false,
  });
}

function shootAt(g, owner, a, dmgMult, range = 200) {
  const e = g.nearestEnemy(a.x, a.y, range);
  if (!e || !lineOfSight(g.room.grid, a.x, a.y, e.x, e.y)) return false;
  const ang = angleTo(a.x, a.y, e.x, e.y);
  a.ang = ang;
  makePlayerShot(g, owner, ang, { x: a.x, y: a.y, dmgMult, sizeMult: 0.8 });
  return true;
}

export function updateAllies(g, dt) {
  for (const a of g.allies) {
    const owner = g.playerById(a.pid);
    if (!owner) {
      a.dead = true;
      continue;
    }
    a.cd -= dt;
    const ownerActive = owner.alive && !owner.downed;
    if (a.type === 'orbital') {
      a.ang += (a.spec.speed || 3) * dt;
      const rad = a.spec.radius || 22;
      a.x = owner.x + Math.cos(a.ang) * rad;
      a.y = owner.y + Math.sin(a.ang) * rad;
      if (!ownerActive) continue;
      // Contact grinding with per-enemy cooldown.
      for (const e of g.enemies) {
        if (e.dead || e.untargetable) continue;
        if (dist2(a.x, a.y, e.x, e.y) < (a.r + e.r) ** 2) {
          const t = a.hitCd.get(e.id) || 0;
          if (g.time >= t) {
            a.hitCd.set(e.id, g.time + 0.25);
            g.damageEnemy(e, a.spec.damage || 10, { pid: owner.id, x: a.x, y: a.y });
            g.emit('fx', { k: 'spark', x: a.x, y: a.y });
          }
        }
      }
      if (owner.loadout.flags.orbitalsShoot && a.cd <= 0) {
        a.cd = 1.1;
        shootAt(g, owner, a, 0.45, 160);
      }
    } else if (a.type === 'owl') {
      // Lazy follow behind the owner.
      const tx = owner.x - Math.cos(owner.aim) * 14;
      const ty = owner.y - 12;
      a.x += (tx - a.x) * Math.min(1, dt * 4);
      a.y += (ty - a.y) * Math.min(1, dt * 4);
      if (ownerActive && a.cd <= 0) {
        if (shootAt(g, owner, a, a.spec.dmgMult || 0.5)) a.cd = 1 / (a.spec.fireRate || 1.5);
        else a.cd = 0.2;
      }
    } else if (a.type === 'turret') {
      a.life -= dt;
      if (a.life <= 0) a.dead = true;
      if (a.cd <= 0) {
        if (shootAt(g, owner, a, 0.6, 240)) a.cd = 1 / (a.spec.fireRate || 3);
        else a.cd = 0.15;
      }
    }
  }
  g.allies = g.allies.filter((a) => !a.dead);
}
