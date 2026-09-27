// HUMAN-READABLE DESCRIPTIONS
// Turns item / upgrade / character data into effect lines for the UI, so descriptions
// can never drift out of sync with what the data actually does.
import { ITEM_MAP } from './data/items.js';
import { SYNERGIES } from './data/synergies.js';
import { UPGRADE_MAP } from './data/upgrades.js';
import { CHARACTER_MAP } from './data/characters.js';
import { buildLoadout, activeSynergies } from './sim/stats.js';

const STAT_LABEL = {
  maxHp: 'max HP', damage: 'damage', fireRate: 'fire rate', shotSpeed: 'shot speed', range: 'range', shotSize: 'shot size',
  shotCount: 'shots per volley', spread: 'spread', moveSpeed: 'move speed', dashCharges: 'dash charges', dashCooldown: 'dash recharge time',
  knockback: 'knockback', luck: 'luck', pierce: 'pierce', bounce: 'wall bounces', critChance: 'critical chance', critMult: 'critical damage',
  damageTaken: 'damage taken per hit', cogMult: 'Cogs from drops', activeRecharge: 'active item recharge', reviveWindow: 'revive window',
  sustainRamp: 'overheat build-up', sustainMax: 'max overheat bonus',
};

const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;
const num = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100) / 100}`;

function hearts(halves) {
  const h = halves / 2;
  const s = Number.isInteger(h) ? `${Math.abs(h)} heart${Math.abs(h) === 1 ? '' : 's'}` : `${Math.abs(h)} hearts`;
  return `${halves > 0 ? '+' : '-'}${s}`;
}

/** One line per stat modifier, e.g. "+20% fire rate", "-1 heart". */
export function describeStats(stats = {}) {
  const out = [];
  for (const [k, m] of Object.entries(stats)) {
    const label = STAT_LABEL[k] || k;
    if (m.add !== undefined) {
      if (k === 'maxHp') out.push(`${hearts(m.add)} max HP`);
      else if (k === 'critChance' || k === 'cogMult') out.push(`${pct(m.add)} ${label}`);
      else if (k === 'dashCharges' && m.add <= -50) out.push('Cannot dash');
      else if (k === 'pierce' && m.add >= 50) out.push('Shots pierce everything');
      else if (k === 'damageTaken') out.push(`Take +${m.add / 2} heart${m.add === 2 ? '' : 's'} extra damage per hit`);
      else if (k === 'reviveWindow') out.push(`+${m.add}s revive window`);
      else if (k === 'sustainRamp' || k === 'sustainMax') continue;
      else out.push(`${num(m.add)} ${label}`);
    }
    if (m.mult !== undefined) {
      if (k === 'dashCooldown') out.push(`${Math.round((1 - m.mult) * 100)}% faster dash recharge`);
      else out.push(`${pct(m.mult - 1)} ${label}`);
    }
  }
  if (stats.sustainMax) out.push(`Sustained fire builds up to ${pct(stats.sustainMax.add)} damage`);
  return out;
}

const BEHAVIOR_TEXT = {
  burn: (p) => `Ignites enemies (${p.dps} dmg/s for ${p.duration}s)`,
  chain: (p) => `${p.chance !== undefined && p.chance < 1 ? `${Math.round(p.chance * 100)}% chance to arc` : 'Lightning arcs'} to ${p.jumps} nearby ${p.jumps === 1 ? 'enemy' : 'enemies'}`,
  split: (p) => (p.count ? `Shots burst into ${p.count} shards on impact` : 'Improves split shards'),
  homing: () => 'Shots home in on enemies',
  explode: (p) => `Shots explode on impact${p.firePool ? ', leaving fire' : ''}`,
  slow: (p) => `Slows enemies by ${Math.round(p.amount * 100)}% for ${p.duration}s`,
  wave: () => 'Shots travel in a wave',
  accel: () => 'Shots accelerate in flight',
  grow: () => 'Shots hit harder the further they fly',
  steamTrail: () => 'Shots leave a trail of scalding steam',
  spiral: () => 'Shots spiral outward',
};

const HOOK_ON = { kill: 'On kill', hit: 'On hit', dash: 'On dash', hurt: 'When hurt', roomClear: 'On room clear', floor: 'Each new floor', fire: 'On fire', tick: 'Constantly' };
const ACTION_TEXT = {
  cloud: () => 'release a steam cloud',
  explosion: () => 'the enemy explodes',
  heal: (p) => `heal ${p.amount >= 99 ? 'fully' : `${p.amount / 2} heart${p.amount === 2 ? '' : 's'}`}`,
  selfDamage: () => 'lose half a heart',
  oilSlick: () => 'leave a slowing oil slick',
  ringShots: (p) => `fire a ring of ${p.count} shots`,
  steamBurst: () => 'vent a knockback steam blast',
  timeStop: (p) => `stop time for ${p.duration}s`,
  throwBomb: (p) => `throw a bomb${p.chain ? ' that chains lightning' : ''}`,
  throwFire: () => 'throw a flask of fire',
  deployTurret: (p) => `deploy a turret for ${p.life}s`,
  overdrive: (p) => `double fire rate and speed for ${p.duration}s`,
  invuln: (p) => `become invulnerable for ${p.duration}s`,
  magnet: () => 'pull in every Cog',
  revealMap: () => 'reveal the floor',
};

export function describeAction(a, params = {}) {
  return (ACTION_TEXT[a] || (() => a))(params);
}

/** Detailed effect lines for an item (stats, projectile behaviours, hooks, allies). */
export function itemEffects(item) {
  const out = [...describeStats(item.stats)];
  for (const [b, p] of Object.entries(item.proj || {})) if (BEHAVIOR_TEXT[b]) out.push(BEHAVIOR_TEXT[b](p));
  for (const h of item.hooks || []) {
    const chance = h.chance !== undefined && h.chance < 1 ? ` (${Math.round(h.chance * 100)}% chance)` : '';
    out.push(`${HOOK_ON[h.on] || h.on}: ${describeAction(h.action, h.params)}${chance}`);
  }
  for (const a of item.allies || []) {
    if (a.type === 'orbital') out.push(`${a.count || 1} orbiting ${a.small ? 'beetle' : 'cog'}${(a.count || 1) > 1 ? 's' : ''} that block shots`);
    if (a.type === 'owl') out.push('A familiar that fires at enemies');
  }
  if (item.active) out.push(`Use: ${describeAction(item.active.action, item.active.params)} (${item.active.charge}s recharge)`);
  for (const e of item.onPickup || []) if (e.action === 'heal') out.push('Heals on pickup');
  return out;
}

/** Synergies an item takes part in: [{ synergy, partners: [names or tag text] }]. */
export function synergiesFor(itemId) {
  const item = ITEM_MAP[itemId];
  const out = [];
  for (const s of SYNERGIES) {
    const r = s.requires;
    const byItem = r.items && r.items.includes(itemId);
    const byTag = r.tags && item && Object.keys(r.tags).some((t) => item.tags.includes(t));
    if (!byItem && !byTag) continue;
    const partners = [];
    if (r.items) for (const id of r.items) if (id !== itemId) partners.push(ITEM_MAP[id]?.name || id);
    if (r.tags) for (const [t, n] of Object.entries(r.tags)) partners.push(`${n} ${t} items`);
    out.push({ synergy: s, partners });
  }
  return out;
}

/** Synergies that picking up `itemId` would newly activate for someone holding `owned`. */
export function wouldActivate(owned, itemId) {
  const before = new Set(activeSynergies(owned).map((s) => s.id));
  return activeSynergies([...owned, itemId]).filter((s) => !before.has(s.id));
}

/** Everything the UI needs to show about an item. */
export function itemDetails(itemId) {
  const it = ITEM_MAP[itemId];
  if (!it) return null;
  return {
    name: it.name,
    rarity: it.rarity,
    kind: it.kind === 'active' ? 'active' : 'passive',
    tags: it.tags,
    desc: it.desc,
    flavor: it.flavor || '',
    effects: itemEffects(it),
    synergies: synergiesFor(itemId),
  };
}

/** Stat block for the character select screen. */
export function characterStats(charId, upgrades = {}) {
  const L = buildLoadout({ character: charId, upgrades, items: [] });
  const s = L.stats;
  const c = CHARACTER_MAP[charId];
  return [
    `HEALTH ${s.maxHp / 2} heart${s.maxHp === 2 ? '' : 's'}`,
    `DAMAGE ${Math.round(s.damage * 10) / 10}   FIRE RATE ${Math.round(s.fireRate * 10) / 10}/s`,
    `SPEED ${Math.round(s.moveSpeed)}   DASHES ${s.dashCharges}`,
    c.startItems.length ? `STARTS WITH ${c.startItems.map((id) => (id.startsWith('@') ? 'a random Cursed item' : ITEM_MAP[id]?.name)).join(', ')}` : 'NO STARTING ITEMS',
  ];
}

const PREVIEW_STATS = ['maxHp', 'damage', 'fireRate', 'shotSpeed', 'range', 'moveSpeed', 'dashCharges', 'dashCooldown', 'critChance', 'luck', 'cogMult', 'activeRecharge', 'reviveWindow'];
function fmtStat(k, v) {
  if (k === 'maxHp') return `${v / 2} hearts`;
  if (k === 'critChance') return `${Math.round(v * 100)}%`;
  if (k === 'cogMult' || k === 'activeRecharge') return `x${Math.round(v * 100) / 100}`;
  if (k === 'dashCooldown') return `${Math.round(v * 100) / 100}s`;
  if (k === 'reviveWindow') return `${v}s`;
  return `${Math.round(v * 10) / 10}`;
}

/** "DAMAGE 11 -> 12" style preview of buying the next level of an upgrade. */
export function upgradePreview(upgradeId, upgrades = {}, character = 'tinker') {
  const u = UPGRADE_MAP[upgradeId];
  const lvl = upgrades[upgradeId] || 0;
  if (!u.stats) return lvl >= u.maxLevel ? ['Fully upgraded.'] : [u.desc];
  const now = buildLoadout({ character, upgrades, items: [] }).stats;
  if (lvl >= u.maxLevel) return PREVIEW_STATS.filter((k) => u.stats[k]).map((k) => `${(STAT_LABEL[k] || k).toUpperCase()} ${fmtStat(k, now[k])} (MAX)`);
  const next = buildLoadout({ character, upgrades: { ...upgrades, [upgradeId]: lvl + 1 }, items: [] }).stats;
  return PREVIEW_STATS.filter((k) => now[k] !== next[k]).map((k) => `${(STAT_LABEL[k] || k).toUpperCase()} ${fmtStat(k, now[k])} -> ${fmtStat(k, next[k])}`);
}
