// Player creation and per-tick update (movement, dash, shooting, revive).
import { buildLoadout } from './stats.js';
import { moveCircle } from './collision.js';
import { clamp, dist2, norm } from '../math.js';
import { ITEM_MAP } from '../data/items.js';
import { PLAYER_COLORS } from '../constants.js';

export function emptyInput() {
  return { mx: 0, my: 0, ax: 0, ay: 0, fire: false, dash: 0, active: 0, cons: 0, inter: 0, ping: 0, interHold: false };
}

export function createPlayer(g, o) {
  const p = {
    id: o.id,
    name: o.name || `Player ${o.slot + 1}`,
    slot: o.slot ?? 0,
    color: PLAYER_COLORS[(o.slot ?? 0) % PLAYER_COLORS.length],
    character: o.character || 'tinker',
    upgrades: o.upgrades || {},
    x: 0,
    y: 0,
    r: 5,
    vx: 0,
    vy: 0,
    aim: 0,
    facing: 1,
    hp: 6,
    items: [], // passive item ids
    active: null, // { id, charge, max }
    consumable: null, // consumable id
    cogs: 0, // cogs collected this run
    alive: true,
    downed: false,
    downedT: 0,
    reviveProgress: 0,
    iframes: 0,
    invuln: 0, // extra invulnerability (smoke bomb)
    dashT: 0,
    dashDirX: 0,
    dashDirY: 0,
    dashCharges: 1,
    dashRecharge: 0,
    fireCd: 0,
    sustain: 0, // seconds of continuous fire (overheat)
    overdrive: 0,
    firing: false,
    lastSeq: { dash: 0, active: 0, cons: 0, inter: 0, ping: 0 },
    input: emptyInput(),
    loadout: null,
    invVersion: 0,
    stats: { kills: 0, damage: 0, itemsFound: 0, roomsCleared: 0, cogsEarned: 0 },
  };
  recomputeLoadout(g, p);
  p.hp = p.loadout.stats.maxHp;
  p.dashCharges = p.loadout.stats.dashCharges;
  return p;
}

/** Rebuild stats after items change and announce newly activated synergies. */
export function recomputeLoadout(g, p) {
  const before = new Set(p.loadout ? p.loadout.synergies : []);
  const oldMax = p.loadout ? p.loadout.stats.maxHp : null;
  p.loadout = buildLoadout({ character: p.character, upgrades: p.upgrades, items: p.items });
  const s = p.loadout.stats;
  if (oldMax !== null) {
    if (s.maxHp > oldMax) p.hp += s.maxHp - oldMax;
    p.hp = Math.min(p.hp, s.maxHp);
    if (p.hp <= 0) p.hp = 1;
  }
  p.dashCharges = Math.min(p.dashCharges, s.dashCharges);
  for (const id of p.loadout.synergies) {
    if (!before.has(id) && g) g.emit('synergy', { pid: p.id, id });
  }
  if (g) g.syncAllies(p);
  p.invVersion++;
}

/** Seconds-per-shot after temporary buffs. */
function fireInterval(p) {
  let rate = p.loadout.stats.fireRate;
  if (p.overdrive > 0) rate *= 2;
  return 1 / rate;
}

export function updatePlayer(g, p, dt) {
  if (!p.alive) return;
  const inp = p.input;
  const s = p.loadout.stats;

  // Edge-triggered actions arrive as monotonically increasing counters so that
  // presses are never lost between network ticks.
  const pressed = (k) => {
    const v = inp[k] || 0;
    if (v !== p.lastSeq[k]) {
      const was = p.lastSeq[k];
      p.lastSeq[k] = v;
      return v > was;
    }
    return false;
  };

  if (p.downed) {
    p.downedT -= dt;
    p.vx = p.vy = 0;
    // Teammates standing close revive you.
    let reviver = null;
    for (const o of g.players) {
      if (o !== p && o.alive && !o.downed && dist2(o.x, o.y, p.x, p.y) < 22 * 22) reviver = o;
    }
    if (reviver) {
      p.reviveProgress += dt;
      if (p.reviveProgress >= 1.5) g.revivePlayer(p, reviver);
    } else p.reviveProgress = Math.max(0, p.reviveProgress - dt * 0.5);
    if (p.downed && p.downedT <= 0) g.killPlayer(p);
    // Keep counters in sync so presses while downed don't fire later.
    pressed('dash'); pressed('active'); pressed('cons'); pressed('inter'); pressed('ping');
    return;
  }

  p.iframes = Math.max(0, p.iframes - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.overdrive = Math.max(0, p.overdrive - dt);

  // --- Aim
  const al = Math.hypot(inp.ax, inp.ay);
  if (al > 0.25) p.aim = Math.atan2(inp.ay, inp.ax);

  // --- Dash charges
  if (p.dashCharges < s.dashCharges) {
    p.dashRecharge += dt;
    if (p.dashRecharge >= s.dashCooldown) {
      p.dashRecharge = 0;
      p.dashCharges++;
    }
  } else p.dashRecharge = 0;

  let [mx, my] = [clamp(inp.mx, -1, 1), clamp(inp.my, -1, 1)];
  const ml = Math.hypot(mx, my);
  if (ml > 1) {
    mx /= ml;
    my /= ml;
  }

  if (pressed('dash') && p.dashCharges > 0 && p.dashT <= 0) {
    let [dx, dy] = norm(mx, my);
    if (dx === 0 && dy === 0) [dx, dy] = [Math.cos(p.aim), Math.sin(p.aim)];
    p.dashDirX = dx;
    p.dashDirY = dy;
    p.dashT = s.dashTime;
    p.dashCharges--;
    p.iframes = Math.max(p.iframes, s.dashTime + 0.1);
    g.emit('fx', { k: 'dash', x: p.x, y: p.y, pid: p.id });
    g.emit('sfx', { n: 'dash' });
    g.runHooks(p, 'dash', { x: p.x, y: p.y });
  }

  // --- Movement
  let speed = s.moveSpeed * (p.overdrive > 0 ? 1.35 : 1);
  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDirX * s.dashSpeed;
    p.vy = p.dashDirY * s.dashSpeed;
  } else {
    // Snappy acceleration toward target velocity.
    const k = Math.min(1, dt * 22);
    p.vx += (mx * speed - p.vx) * k;
    p.vy += (my * speed - p.vy) * k;
  }
  if (Math.abs(mx) > 0.1) p.facing = mx > 0 ? 1 : -1;
  moveCircle(p, p.vx * dt, p.vy * dt, g.room.grid, g.room);

  // --- Shooting (auto-fire when the aim stick is pushed, like classic twin-sticks)
  p.fireCd -= dt;
  const wantFire = inp.fire || al > 0.5;
  p.firing = wantFire;
  if (wantFire) p.sustain += dt;
  else p.sustain = Math.max(0, p.sustain - dt * 3);
  if (wantFire && p.fireCd <= 0) {
    p.fireCd = fireInterval(p);
    firePlayerVolley(g, p);
  }
  if (p.fireCd < -0.5) p.fireCd = 0;

  // --- Active item
  if (p.active) {
    const def = ITEM_MAP[p.active.id];
    if (p.active.charge < def.active.charge) p.active.charge = Math.min(def.active.charge, p.active.charge + dt * s.activeRecharge);
    if (pressed('active') && p.active.charge >= def.active.charge) {
      p.active.charge = 0;
      g.runAction(def.active.action, p, def.active.params, { x: p.x, y: p.y });
      g.emit('sfx', { n: 'active' });
    }
  } else pressed('active');

  // --- Consumable
  if (pressed('cons') && p.consumable) g.useConsumable(p);

  if (pressed('inter')) g.interact(p);
  if (pressed('ping')) g.addPing(p);

  // --- Passive tick hooks
  const tickHooks = p.loadout.hooks.tick;
  if (tickHooks) g.runHooks(p, 'tick', { dt });
}

/** Current damage multiplier from sustained fire (Overheat) and momentum. */
export function dynamicDamageMult(p) {
  const s = p.loadout.stats;
  let m = 1;
  if (s.sustainRamp > 0) m += Math.min(s.sustainMax, p.sustain * s.sustainRamp);
  const mom = p.loadout.flags.momentum;
  if (mom) m += mom * Math.min(1, Math.hypot(p.vx, p.vy) / 160);
  return m;
}

export function heatLevel(p) {
  const s = p.loadout.stats;
  if (!s.sustainRamp) return 0;
  return Math.min(1, (p.sustain * s.sustainRamp) / s.sustainMax);
}

/** Create the projectile template for one player shot. Shared by turrets/familiars. */
export function makePlayerShot(g, p, ang, opt = {}) {
  const L = p.loadout;
  const s = L.stats;
  let damage = s.damage * dynamicDamageMult(p) * (opt.dmgMult ?? 1);
  let crit = false;
  if (s.critChance > 0 && g.rng.next() < s.critChance) {
    damage *= s.critMult;
    crit = true;
  }
  let kind = 'bullet';
  let color = 'brass';
  if (L.proj.burn) color = 'fire';
  if (L.proj.chain) color = 'electric';
  if (L.proj.burn && L.proj.chain) color = 'plasma';
  if (heatLevel(p) > 0.5) color = 'fire';
  if (L.proj.lob) kind = 'bomb';
  return g.spawnProjectile({
    team: 'player',
    owner: p.id,
    x: opt.x ?? p.x + Math.cos(ang) * 6,
    y: opt.y ?? p.y + Math.sin(ang) * 6,
    ang,
    speed: s.shotSpeed * (opt.speedMult ?? 1),
    r: 2.5 * s.shotSize * (opt.sizeMult ?? 1),
    damage,
    range: s.range * (opt.rangeMult ?? 1),
    pierce: s.pierce,
    bounce: s.bounce,
    beh: L.proj,
    kind: crit ? 'crit' : kind,
    color,
    knock: s.knockback,
    crit,
  });
}

export function firePlayerVolley(g, p) {
  const s = p.loadout.stats;
  const n = s.shotCount;
  const step = (s.spread * Math.PI) / 180;
  for (let i = 0; i < n; i++) {
    const a = p.aim + (i - (n - 1) / 2) * step + g.rng.range(-0.03, 0.03);
    makePlayerShot(g, p, a);
  }
  // Tiny recoil for feel.
  p.vx -= Math.cos(p.aim) * 8;
  p.vy -= Math.sin(p.aim) * 8;
  g.emit('fire', { pid: p.id, x: p.x + Math.cos(p.aim) * 8, y: p.y + Math.sin(p.aim) * 8, a: p.aim, heat: heatLevel(p) });
  g.runHooks(p, 'fire', {});
}
