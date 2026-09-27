// Projectile spawning, movement and collision. Used for both teams.
import { TILE } from '../constants.js';
import { solidForShot } from './collision.js';
import { BEHAVIORS, runBehaviorHook } from './behaviors.js';
import { dist2, angleDiff } from '../math.js';

const MAX_PROJECTILES = 900;

export function spawnProjectile(g, o) {
  if (g.projectiles.length >= MAX_PROJECTILES) return null;
  const p = {
    id: g.nextId++,
    team: o.team,
    owner: o.owner,
    x: o.x,
    y: o.y,
    h: 0, // height for lobbed shots (visual only)
    ang: o.ang,
    speed: o.speed,
    baseSpeed: o.speed,
    r: o.r ?? 3,
    damage: o.damage ?? 1,
    range: o.range ?? 400,
    life: o.life ?? 6,
    traveled: 0,
    age: 0,
    pierce: o.pierce ?? 0,
    bounce: o.bounce ?? 0,
    beh: o.beh || {},
    st: {},
    kind: o.kind || 'bullet',
    color: o.color || null,
    gen: o.gen || 0,
    hitSet: o.hitSet || null,
    knock: o.knock ?? 0,
    crit: !!o.crit,
    dmgScale: 1,
    dead: false,
  };
  for (const name in p.beh) BEHAVIORS[name]?.init?.(p, g, p.beh[name]);
  g.projectiles.push(p);
  return p;
}

function killProjectile(g, p, cause, target) {
  if (p.dead) return;
  p.dead = true;
  runBehaviorHook(p, 'onDeath', g, cause, target);
  if (cause === 'wall') g.emit('fx', { k: p.team === 'player' ? 'spark' : 'esplat', x: p.x, y: p.y });
  else if (cause === 'range' && p.team === 'player') g.emit('fx', { k: 'puff', x: p.x, y: p.y });
}

export function updateProjectiles(g, dt) {
  const grid = g.room.grid;
  for (const p of g.projectiles) {
    if (p.dead) continue;
    if (p.team === 'enemy' && g.timeStop > 0) continue;
    p.age += dt;
    p.life -= dt;
    runBehaviorHook(p, 'update', g, dt);
    if (p.dead) continue;
    if (p.noCollide) {
      if (p.life <= 0) p.dead = true;
      continue;
    }
    const ang = p.ang + (p.st.waveOff || 0);
    const vx = Math.cos(ang) * p.speed;
    const vy = Math.sin(ang) * p.speed;
    const total = p.speed * dt;
    const steps = Math.max(1, Math.ceil(total / 5));
    const sx = (vx * dt) / steps;
    const sy = (vy * dt) / steps;
    for (let s = 0; s < steps && !p.dead; s++) {
      const nx = p.x + sx;
      const ny = p.y + sy;
      const tx = Math.floor(nx / TILE);
      const ty = Math.floor(ny / TILE);
      if (solidForShot(grid, tx, ty)) {
        if (p.team === 'player') g.shotHitWall(p, tx, ty);
        if (p.bounce > 0) {
          p.bounce--;
          // Reflect on whichever axis caused the collision.
          const blockX = solidForShot(grid, Math.floor(nx / TILE), Math.floor(p.y / TILE));
          const blockY = solidForShot(grid, Math.floor(p.x / TILE), Math.floor(ny / TILE));
          let dx = Math.cos(p.ang);
          let dy = Math.sin(p.ang);
          if (blockX || (!blockX && !blockY)) dx = -dx;
          if (blockY || (!blockX && !blockY)) dy = -dy;
          p.ang = Math.atan2(dy, dx);
          if (p.hitSet) p.hitSet.clear();
          g.emit('fx', { k: 'spark', x: p.x, y: p.y });
          break;
        }
        killProjectile(g, p, 'wall');
        break;
      }
      p.x = nx;
      p.y = ny;
      p.traveled += Math.sqrt(sx * sx + sy * sy);
      if (p.team === 'player') collidePlayerShot(g, p);
      else collideEnemyShot(g, p);
    }
    if (!p.dead && (p.traveled >= p.range || p.life <= 0)) killProjectile(g, p, 'range');
  }
  // Compact array in place.
  let w = 0;
  for (let i = 0; i < g.projectiles.length; i++) {
    const p = g.projectiles[i];
    if (!p.dead) g.projectiles[w++] = p;
  }
  g.projectiles.length = w;
}

function collidePlayerShot(g, p) {
  for (const e of g.enemies) {
    if (e.dead || e.untargetable) continue;
    if (p.hitSet && p.hitSet.has(e.id)) continue;
    const rr = p.r + e.r;
    if (dist2(p.x, p.y, e.x, e.y) > rr * rr) continue;
    // Frontal shields block shots from the front arc.
    if (e.shieldArc) {
      const fromAng = Math.atan2(p.y - e.y, p.x - e.x);
      if (Math.abs(angleDiff(e.facing, fromAng)) < e.shieldArc) {
        g.emit('fx', { k: 'spark', x: p.x, y: p.y });
        g.emit('sfx', { n: 'clink' });
        killProjectile(g, p, 'shield');
        return;
      }
    }
    g.hitEnemyWithShot(e, p);
    (p.hitSet ||= new Set()).add(e.id);
    if (p.pierce > 0) p.pierce--;
    else {
      killProjectile(g, p, 'hit', e);
      return;
    }
  }
}

function collideEnemyShot(g, p) {
  // Orbitals and shields eat enemy bullets.
  for (const a of g.allies) {
    if (!a.blocksShots) continue;
    const rr = p.r + a.r;
    if (dist2(p.x, p.y, a.x, a.y) < rr * rr) {
      killProjectile(g, p, 'blocked');
      g.emit('fx', { k: 'spark', x: p.x, y: p.y });
      return;
    }
  }
  for (const pl of g.players) {
    if (!pl.alive || pl.downed) continue;
    const rr = p.r + pl.r - 1; // slightly forgiving hitbox
    if (dist2(p.x, p.y, pl.x, pl.y) > rr * rr) continue;
    if (g.hurtPlayer(pl, p.damage, p.x, p.y)) {
      killProjectile(g, p, 'hit', pl);
      return;
    }
  }
}

export { killProjectile };
