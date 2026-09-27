// LOADOUT / STAT PIPELINE
// -----------------------
// A player's effective loadout is recomputed from scratch whenever their items change:
//   base stats -> character -> permanent upgrades -> items -> active synergies
// All sources share one schema (see data/items.js). Additive modifiers are applied
// before multiplicative ones so the order in which items are picked up never matters.
import { BASE_STATS, CHARACTER_MAP } from '../data/characters.js';
import { UPGRADES } from '../data/upgrades.js';
import { ITEM_MAP } from '../data/items.js';
import { SYNERGIES } from '../data/synergies.js';

// Merge rules for behaviour params when multiple sources give the same behaviour.
const MAX_KEYS = new Set(['range', 'duration', 'radius', 'amp', 'freq', 'dmgMult', 'arc', 'amount', 'firePool', 'shardHoming']);
const MIN_KEYS = new Set(['interval']);

export function mergeParams(a, b) {
  if (!a) return { ...b };
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (typeof v !== 'number') {
      out[k] = v;
      continue;
    }
    if (out[k] === undefined) out[k] = v;
    else if (k === 'chance') out[k] = 1 - (1 - out[k]) * (1 - v); // independent chances combine
    else if (MAX_KEYS.has(k)) out[k] = Math.max(out[k], v) + (k === 'dmgMult' ? 0.1 : 0);
    else if (MIN_KEYS.has(k)) out[k] = Math.min(out[k], v);
    else out[k] += v;
  }
  return out;
}

export function countTags(itemIds) {
  const tags = {};
  for (const id of itemIds) {
    const it = ITEM_MAP[id];
    if (!it) continue;
    for (const t of it.tags) tags[t] = (tags[t] || 0) + 1;
  }
  return tags;
}

export function synergySatisfied(syn, itemSet, tags) {
  const r = syn.requires;
  if (r.items && !r.items.every((id) => itemSet.has(id))) return false;
  if (r.tags) for (const [t, n] of Object.entries(r.tags)) if ((tags[t] || 0) < n) return false;
  return true;
}

export function activeSynergies(itemIds) {
  const set = new Set(itemIds);
  const tags = countTags(itemIds);
  return SYNERGIES.filter((s) => synergySatisfied(s, set, tags));
}

/**
 * Build a full loadout.
 * @param {object} o { character, upgrades: {id: level}, items: [itemIds] }
 */
export function buildLoadout({ character = 'tinker', upgrades = {}, items = [] }) {
  const sources = [];
  const char = CHARACTER_MAP[character] || CHARACTER_MAP.tinker;
  sources.push(char);
  for (const u of UPGRADES) {
    const lvl = upgrades[u.id] || 0;
    if (!u.stats) continue;
    for (let i = 0; i < lvl; i++) sources.push(u);
  }
  const passiveIds = items.filter((id) => ITEM_MAP[id]);
  for (const id of passiveIds) sources.push(ITEM_MAP[id]);
  const synergies = activeSynergies(passiveIds);
  sources.push(...synergies);

  const stats = { ...BASE_STATS };
  for (const src of sources) {
    if (!src.stats) continue;
    for (const [k, m] of Object.entries(src.stats)) if (m.add) stats[k] = (stats[k] ?? 0) + m.add;
  }
  for (const src of sources) {
    if (!src.stats) continue;
    for (const [k, m] of Object.entries(src.stats)) if (m.mult !== undefined) stats[k] = (stats[k] ?? 0) * m.mult;
  }
  // Sanity clamps so stacking can never break the game.
  stats.maxHp = Math.max(2, Math.min(24, Math.round(stats.maxHp)));
  stats.damage = Math.max(1, stats.damage);
  stats.fireRate = Math.max(0.6, Math.min(20, stats.fireRate));
  stats.moveSpeed = Math.max(45, Math.min(200, stats.moveSpeed));
  stats.shotSpeed = Math.max(90, Math.min(700, stats.shotSpeed));
  stats.range = Math.max(60, stats.range);
  stats.shotCount = Math.max(1, Math.min(12, Math.round(stats.shotCount)));
  stats.spread = Math.max(3, stats.spread);
  stats.dashCharges = Math.max(0, Math.min(5, Math.round(stats.dashCharges)));
  stats.dashCooldown = Math.max(0.25, stats.dashCooldown);
  stats.pierce = Math.max(0, Math.round(stats.pierce));
  stats.bounce = Math.max(0, Math.round(stats.bounce));
  stats.critChance = Math.min(0.9, stats.critChance);

  const proj = {};
  const hooks = [];
  const allies = [];
  const flags = {};
  for (const src of sources) {
    if (src.proj) for (const [name, params] of Object.entries(src.proj)) proj[name] = mergeParams(proj[name], params);
    if (src.hooks) hooks.push(...src.hooks);
    if (src.allies) allies.push(...src.allies);
    if (src.flags) for (const [k, v] of Object.entries(src.flags)) flags[k] = (flags[k] || 0) + v;
  }
  // Synergy-provided split extras are ignored unless a split source exists.
  if (proj.split && !passiveIds.some((id) => ITEM_MAP[id].proj?.split)) delete proj.split;

  const hooksByEvent = {};
  for (const h of hooks) (hooksByEvent[h.on] ||= []).push(h);

  return { stats, proj, hooks: hooksByEvent, allies, flags, synergies: synergies.map((s) => s.id), tags: countTags(passiveIds) };
}
