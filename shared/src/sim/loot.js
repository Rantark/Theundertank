// Pickups and loot tables. Every pickup is instanced per player: `taken` records who
// has already collected it, so each player gets their own copy (no loot fights).
import { ITEMS, ITEM_MAP, CONSUMABLES, CONSUMABLE_MAP, RARITY_WEIGHTS } from '../data/items.js';
import { dist2 } from '../math.js';
import { recomputeLoadout } from './player.js';

export const PRICES = { common: 12, rare: 22, legendary: 40, cursed: 15 };

/** Roll an item id. Luck shifts weight from common toward rare/legendary. */
export function rollItem(g, { luck = 0, minRarity = null, exclude = new Set(), activeWeight = 0.5 } = {}) {
  const w = {
    common: Math.max(10, RARITY_WEIGHTS.common - luck * 6),
    rare: RARITY_WEIGHTS.rare + luck * 3,
    legendary: RARITY_WEIGHTS.legendary + luck * 1.5,
    cursed: RARITY_WEIGHTS.cursed,
  };
  if (minRarity === 'rare') w.common = 0;
  if (minRarity === 'legendary') w.common = w.rare = w.cursed = 0;
  const ownedByAll = (id) => g.players.every((p) => p.items.includes(id) || p.active?.id === id);
  let pool = ITEMS.filter((it) => w[it.rarity] > 0 && !exclude.has(it.id) && !ownedByAll(it.id));
  // Prefer items nobody has seen this run.
  const fresh = pool.filter((it) => !g.seenItems.has(it.id));
  if (fresh.length >= 3) pool = fresh;
  if (!pool.length) pool = ITEMS.filter((it) => it.rarity !== 'cursed');
  const it = g.rng.weighted(pool, (i) => w[i.rarity] * (i.kind === 'active' ? activeWeight : 1));
  g.seenItems.add(it.id);
  return it.id;
}

export function rollConsumable(g) {
  return g.rng.pick(CONSUMABLES).id;
}

export function spawnPickup(g, o) {
  const pk = {
    id: g.nextId++,
    type: o.type, // cog | heart | item | consumable
    x: o.x,
    y: o.y,
    vx: o.vx ?? 0,
    vy: o.vy ?? 0,
    value: o.value ?? 1,
    itemId: o.itemId ?? null,
    consId: o.consId ?? null,
    price: o.price ?? 0,
    pedestal: !!o.pedestal,
    needInteract: !!o.needInteract || (o.price ?? 0) > 0,
    onlyFor: o.onlyFor ?? null,
    taken: new Set(),
    age: 0,
    dead: false,
  };
  g.pickups.push(pk);
  return pk;
}

export function availableTo(pk, p) {
  return !pk.taken.has(p.id) && (!pk.onlyFor || pk.onlyFor === p.id);
}

/** Scatter `total` cogs as a few pickups with a pop. */
export function dropCogs(g, x, y, total) {
  let left = Math.round(total);
  while (left > 0) {
    const v = left >= 5 && g.rng.chance(0.5) ? 5 : 1;
    left -= v;
    const a = g.rng.range(0, 6.28);
    const s = g.rng.range(30, 90);
    spawnPickup(g, { type: 'cog', value: v, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s });
  }
}

export function collectPickup(g, p, pk) {
  if (!availableTo(pk, p)) return false;
  const s = p.loadout.stats;
  switch (pk.type) {
    case 'cog': {
      p.cogAcc = (p.cogAcc || 0) + pk.value * s.cogMult;
      const whole = Math.floor(p.cogAcc);
      p.cogAcc -= whole;
      p.cogs += whole;
      p.stats.cogsEarned += whole;
      g.emit('sfx', { n: 'cog' });
      g.emit('fx', { k: 'cog', x: pk.x, y: pk.y, pid: p.id });
      break;
    }
    case 'heart': {
      if (p.hp >= s.maxHp) return false;
      g.healPlayer(p, pk.value);
      break;
    }
    case 'consumable': {
      if (pk.price > 0) {
        if (p.cogs < pk.price) return denied(g, p);
        p.cogs -= pk.price;
      }
      if (p.consumable) {
        // Swap: drop the old one for this player only.
        spawnPickup(g, { type: 'consumable', consId: p.consumable, x: p.x, y: p.y + 10, onlyFor: p.id, needInteract: true });
      }
      p.consumable = pk.consId;
      g.emit('toast', { pid: p.id, text: `${CONSUMABLE_MAP[pk.consId].name}: ${CONSUMABLE_MAP[pk.consId].desc}` });
      g.emit('sfx', { n: 'pickup' });
      p.invVersion++;
      break;
    }
    case 'item': {
      if (pk.price > 0) {
        if (p.cogs < pk.price) return denied(g, p);
        p.cogs -= pk.price;
        g.emit('sfx', { n: 'buy' });
      }
      giveItem(g, p, pk.itemId, pk);
      break;
    }
  }
  pk.taken.add(p.id);
  return true;
}

function denied(g, p) {
  g.emit('toast', { pid: p.id, text: 'Not enough Cogs!', color: 'cursed' });
  g.emit('sfx', { n: 'deny' });
  return false;
}

/** Add an item to a player's inventory, handling actives and on-pickup effects. */
export function giveItem(g, p, itemId, fromPickup = null) {
  const def = ITEM_MAP[itemId];
  if (!def) return;
  if (def.kind === 'active') {
    if (p.active && fromPickup) {
      spawnPickup(g, { type: 'item', itemId: p.active.id, x: p.x, y: p.y + 12, onlyFor: p.id, needInteract: true, pedestal: true });
    }
    p.active = { id: itemId, charge: def.active.charge };
  } else {
    p.items.push(itemId);
  }
  p.stats.itemsFound++;
  recomputeLoadout(g, p);
  for (const eff of def.onPickup || []) g.runAction(eff.action, p, eff.params, { x: p.x, y: p.y });
  g.emit('item', { pid: p.id, id: itemId });
  g.emit('sfx', { n: def.rarity === 'legendary' ? 'legendary' : 'item' });
  p.invVersion++;
}

export function updatePickups(g, dt) {
  for (const pk of g.pickups) {
    pk.age += dt;
    if (pk.vx || pk.vy) {
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      const f = Math.exp(-6 * dt);
      pk.vx *= f;
      pk.vy *= f;
      if (Math.abs(pk.vx) + Math.abs(pk.vy) < 1) pk.vx = pk.vy = 0;
      // Keep inside the room.
      pk.x = Math.max(24, Math.min(g.roomPxW - 24, pk.x));
      pk.y = Math.max(24, Math.min(g.roomPxH - 24, pk.y));
    }
    if (pk.needInteract || pk.age < 0.35) continue;
    for (const p of g.players) {
      if (!p.alive || p.downed || !availableTo(pk, p)) continue;
      const d2 = dist2(p.x, p.y, pk.x, pk.y);
      // Cogs are magnetised toward nearby players.
      if (pk.type === 'cog' && d2 < 40 * 40 && d2 > 1) {
        const d = Math.sqrt(d2);
        pk.x += ((p.x - pk.x) / d) * 140 * dt;
        pk.y += ((p.y - pk.y) / d) * 140 * dt;
      }
      if (d2 < (p.r + 6) ** 2) collectPickup(g, p, pk);
    }
  }
  // A pickup disappears once every player has collected their copy.
  g.pickups = g.pickups.filter((pk) => {
    if (pk.onlyFor) return !pk.taken.has(pk.onlyFor);
    return !g.players.every((p) => pk.taken.has(p.id));
  });
  if (g.room) g.room.pickups = g.pickups;
}

export { ITEM_MAP, CONSUMABLE_MAP };
