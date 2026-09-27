// ACTION REGISTRY
// ---------------
// Named effects referenced from data: item hooks ({on, action}), active items and
// consumables. Signature: (g, player, params, ctx) where ctx carries the triggering
// position (kill location, dash origin...) and optional target.
import { makePlayerShot } from './player.js';
import { spawnTurret } from './allies.js';
import { dist2 } from '../math.js';

function aimPoint(p, dist) {
  return [p.x + Math.cos(p.aim) * dist, p.y + Math.sin(p.aim) * dist];
}

export const ACTIONS = {
  heal(g, p, prm) {
    g.healPlayer(p, prm.amount || 1);
  },

  selfDamage(g, p, prm) {
    // Cursed drawback: never kills, only drains.
    if (p.hp > 1) {
      p.hp = Math.max(1, p.hp - (prm.amount || 1));
      g.emit('fx', { k: 'hurt', x: p.x, y: p.y });
      g.emit('toast', { pid: p.id, text: 'The Hungry Engine feeds...', color: 'cursed' });
    }
  },

  cloud(g, p, prm, ctx) {
    const x = prm.atPlayer ? p.x : ctx.x;
    const y = prm.atPlayer ? p.y : ctx.y;
    g.spawnZone({ type: 'cloud', team: 'player', pid: p.id, x, y, r: prm.radius || 20, dps: (prm.dps || 12) * (p.loadout.stats.damage / 10), life: prm.life || 2.5 });
    g.emit('fx', { k: 'steam', x, y, r: prm.radius || 20 });
  },

  oilSlick(g, p, prm, ctx) {
    g.spawnZone({ type: 'oil', team: 'player', pid: p.id, x: ctx.x, y: ctx.y, r: prm.radius || 18, life: prm.life || 4 });
  },

  ringShots(g, p, prm) {
    const n = prm.count || 8;
    for (let i = 0; i < n; i++) {
      makePlayerShot(g, p, (i / n) * Math.PI * 2 + (prm.offset || 0), { dmgMult: prm.dmgMult || 0.6 });
    }
    g.emit('sfx', { n: 'shoot' });
  },

  steamBurst(g, p, prm) {
    const r = prm.radius || 60;
    const dmg = (prm.damage || 30) * (p.loadout.stats.damage / 10);
    for (const e of g.enemies) {
      if (e.dead || e.untargetable) continue;
      const d2 = dist2(p.x, p.y, e.x, e.y);
      if (d2 < (r + e.r) ** 2) {
        const d = Math.sqrt(d2) || 1;
        g.damageEnemy(e, dmg, { pid: p.id, x: p.x, y: p.y, dirx: (e.x - p.x) / d, diry: (e.y - p.y) / d, knock: prm.knock || 250 });
      }
    }
    // Clear enemy bullets in the blast.
    for (const pr of g.projectiles) if (pr.team === 'enemy' && dist2(p.x, p.y, pr.x, pr.y) < r * r) pr.dead = true;
    if (prm.cloud) g.spawnZone({ type: 'cloud', team: 'player', pid: p.id, x: p.x, y: p.y, r: r * 0.5, dps: 10, life: 2 });
    g.emit('fx', { k: 'steamburst', x: p.x, y: p.y, r });
    g.emit('shake', { a: 4 });
    g.emit('sfx', { n: 'steam' });
  },

  explosion(g, p, prm, ctx) {
    const mult = p.loadout.stats.damage / 10;
    g.explosion(ctx.x, ctx.y, prm.radius || 30, (prm.damage || 25) * mult, { team: 'player', pid: p.id, firePool: p.loadout.flags.explosionsFirePool });
  },

  timeStop(g, p, prm) {
    const mult = 1 + (p.loadout.flags.timeStopMult || 0);
    g.timeStop = Math.max(g.timeStop, (prm.duration || 3) * mult);
    g.emit('fx', { k: 'timestop', x: p.x, y: p.y });
    g.emit('sfx', { n: 'chime' });
  },

  throwBomb(g, p, prm) {
    const [tx, ty] = aimPoint(p, 90);
    g.spawnProjectile({
      team: 'player', owner: p.id, x: p.x, y: p.y, ang: p.aim, speed: 0, r: 4, damage: 0, kind: 'bomb', color: 'brass',
      beh: { lob: { tx, ty, time: 0.55, height: 30, onLand: 'bomb', radius: prm.radius, damage: prm.damage * (p.loadout.stats.damage / 10), chain: prm.chain } },
    });
    g.emit('sfx', { n: 'throw' });
  },

  throwFire(g, p, prm) {
    const [tx, ty] = aimPoint(p, 80);
    g.spawnProjectile({
      team: 'player', owner: p.id, x: p.x, y: p.y, ang: p.aim, speed: 0, r: 3, damage: 0, kind: 'bomb', color: 'fire',
      beh: { lob: { tx, ty, time: 0.5, height: 26, onLand: 'fire', radius: prm.radius, life: prm.life } },
    });
    g.emit('sfx', { n: 'throw' });
  },

  deployTurret(g, p, prm) {
    spawnTurret(g, p, p.x, p.y, prm);
    g.emit('fx', { k: 'puff', x: p.x, y: p.y });
  },

  overdrive(g, p, prm) {
    p.overdrive = prm.duration || 5;
    g.emit('toast', { pid: p.id, text: 'OVERDRIVE!', color: 'legendary' });
  },

  invuln(g, p, prm) {
    p.invuln = prm.duration || 2;
    g.emit('fx', { k: 'smoke', x: p.x, y: p.y });
  },

  magnet(g, p, prm) {
    for (const pk of g.pickups) if (pk.type === 'cog' && !pk.taken.has(p.id)) g.collectPickup(p, pk);
    p.cogs += prm.bonus || 0;
    p.stats.cogsEarned += prm.bonus || 0;
    g.emit('sfx', { n: 'cog' });
  },

  revealMap(g) {
    for (const r of g.floor.rooms.values()) if (r.type !== 'secret') r.seen = true;
    g.roomStateDirty = true;
    g.emit('toast', { text: 'The floor plan is revealed.' });
  },
};

export function runAction(g, name, p, params = {}, ctx = {}) {
  const fn = ACTIONS[name];
  if (!fn) throw new Error(`Unknown action ${name}`);
  fn(g, p, params, ctx);
}
