// PROJECTILE BEHAVIOURS
// ---------------------
// Every projectile carries `beh`: a map of behaviourName -> params (merged from all
// items/synergies, see stats.js). Each behaviour may implement any of these hooks:
//   init(p, g, prm)                 when spawned
//   update(p, g, dt, prm)           every tick before movement
//   onHit(p, g, enemy, prm)         when damaging an enemy (every pierce hit)
//   onDeath(p, g, cause, target, prm)  when the projectile ends ('hit'|'wall'|'range')
// Because behaviours only communicate through the projectile object and the game API,
// any combination composes: a split shard inherits burn/chain/homing from its parent, an
// explosion from a homing shot still chains lightning if Thunderclap is active, etc.
import { angleTo, turnToward } from '../math.js';

export const BEHAVIORS = {
  homing: {
    update(p, g, dt, prm) {
      const range = (prm.range || 120) + (p.gen > 0 ? 40 : 0);
      const tgt = p.team === 'player' ? g.nearestEnemy(p.x, p.y, range, p.hitSet) : g.nearestPlayer(p.x, p.y, range);
      if (!tgt) return;
      const want = angleTo(p.x, p.y, tgt.x, tgt.y);
      p.ang = turnToward(p.ang, want, (prm.strength || 3) * dt);
    },
  },

  wave: {
    update(p, g, dt, prm) {
      // Offsets the travel direction sinusoidally without changing the base heading,
      // so homing and wave can both apply.
      p.st.waveOff = Math.sin(p.age * (prm.freq || 12) + (p.st.wavePhase || 0)) * Math.min(1.2, prm.amp || 0.6);
    },
    init(p, g, prm) {
      p.st.wavePhase = p.gen > 0 ? g.rng.range(0, 6) : 0;
    },
  },

  accel: {
    update(p, g, dt, prm) {
      p.speed = Math.min(p.speed * (1 + (prm.rate || 1) * dt), prm.max || 900);
    },
  },

  spiral: {
    update(p, g, dt, prm) {
      p.ang += (prm.turn || 2) * dt;
    },
  },

  grow: {
    update(p, g, dt, prm) {
      // Damage scales with distance travelled (magnetic acceleration).
      p.dmgScale = 1 + p.traveled * (prm.perPx || 0.003);
    },
  },

  steamTrail: {
    update(p, g, dt, prm) {
      if (p.team !== 'player') return;
      p.st.trailT = (p.st.trailT || 0) - dt;
      if (p.st.trailT <= 0) {
        p.st.trailT = prm.interval || 0.1;
        g.spawnZone({ type: 'cloud', team: 'player', pid: p.owner, x: p.x, y: p.y, r: prm.radius || 9, dps: prm.dps || 8, life: 0.9, small: true });
      }
    },
  },

  // Enemy lobbed shots: follow an arc to a target point, ignore collisions until landing.
  lob: {
    init(p, g, prm) {
      p.st.sx = p.x;
      p.st.sy = p.y;
      p.noCollide = true;
      p.speed = 0;
      p.range = 99999;
    },
    update(p, g, dt, prm) {
      const t = Math.min(1, p.age / prm.time);
      p.x = p.st.sx + (prm.tx - p.st.sx) * t;
      p.y = p.st.sy + (prm.ty - p.st.sy) * t;
      p.h = Math.sin(t * Math.PI) * (prm.height || 40);
      if (t >= 1) {
        g.lobLanded(p, prm);
        p.dead = true;
      }
    },
  },

  // Enemy shots: burst into a ring when they expire or hit something.
  burst: {
    onDeath(p, g, cause, target, prm) {
      if (p.team !== 'enemy') return;
      g.enemyRing(p.x, p.y, prm.count || 8, prm.speed || 80, g.rng.range(0, 1), { r: 3 });
    },
  },

  burn: {
    onHit(p, g, e, prm) {
      g.applyStatus(e, 'burn', { dps: prm.dps * (p.dmgScaleStatus || 1), duration: prm.duration, pid: p.owner });
    },
  },

  slow: {
    onHit(p, g, e, prm) {
      g.applyStatus(e, 'slow', { amount: Math.min(0.75, prm.amount), duration: prm.duration });
    },
  },

  chain: {
    onHit(p, g, e, prm) {
      if (prm.chance !== undefined && prm.chance < 1 && g.rng.next() > prm.chance) return;
      g.chainLightning(e.x, e.y, e, prm.jumps || 1, prm.range || 60, p.damage * (prm.dmgMult || 0.5), p.owner);
    },
  },

  explode: {
    onDeath(p, g, cause, target, prm) {
      if (p.team !== 'player') return;
      const owner = g.playerById(p.owner);
      const firePool = prm.firePool || owner?.loadout.flags.explosionsFirePool;
      g.explosion(p.x, p.y, (prm.radius || 20) * (p.gen > 0 ? 0.7 : 1), p.damage * (prm.dmgMult || 0.5) * (p.dmgScale || 1), {
        team: 'player', pid: p.owner, firePool, small: p.gen > 0,
      });
    },
  },

  split: {
    onDeath(p, g, cause, target, prm) {
      // Shards are generation 1+ and only split again when a synergy grants extra
      // generations (shardGen). They inherit every other behaviour of their parent.
      const maxGen = prm.shardGen || 0;
      if (p.gen > maxGen) return;
      const n = Math.max(1, Math.round(prm.count || 3));
      // Hitting a wall sends shards back out; hitting an enemy continues forward.
      const base = cause === 'wall' ? p.ang + Math.PI : p.ang;
      const arc = ((prm.arc || 70) * Math.PI) / 180;
      const beh = { ...p.beh };
      if (prm.shardHoming) beh.homing = { strength: (beh.homing?.strength || 0) + prm.shardHoming, range: 160 };
      for (let i = 0; i < n; i++) {
        const a = base + (n === 1 ? 0 : -arc / 2 + (arc * i) / (n - 1)) + g.rng.range(-0.08, 0.08);
        g.spawnProjectile({
          team: p.team, owner: p.owner, x: p.x, y: p.y, ang: a,
          speed: p.baseSpeed * 0.9, r: Math.max(1.5, p.r * 0.7),
          damage: p.damage * (prm.dmgMult || 0.45) * (p.dmgScale || 1),
          range: 90, pierce: 0, bounce: prm.shardBounce || 0,
          beh, kind: 'shard', color: p.color, gen: p.gen + 1, hitSet: target ? new Set([target.id]) : null,
          knock: p.knock * 0.4,
        });
      }
    },
  },
};

export function runBehaviorHook(p, hook, g, ...args) {
  for (const name in p.beh) {
    const b = BEHAVIORS[name];
    if (b && b[hook]) b[hook](p, g, ...args, p.beh[name]);
  }
}
