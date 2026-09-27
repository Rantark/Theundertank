// Permanent upgrades sold by the town NPCs for Cogs.
// cost(level) = round(baseCost * growth^level). Each level applies `stats` once.
// `special` upgrades are interpreted by the run setup code (see sim/stats.js).

export const SHOPS = {
  tinkerer: { name: 'Tinkerer', desc: 'Mobility & gadgets', color: 0x4fc3d9 },
  gunsmith: { name: 'Gunsmith', desc: 'Firepower', color: 0xe0643a },
  alchemist: { name: 'Alchemist', desc: 'Vitality & tonics', color: 0x8fd14f },
  clockmaker: { name: 'Clockmaker', desc: 'Time, luck & new faces', color: 0xf2b134 },
};

export const UPGRADES = [
  // --- Tinkerer ---
  { id: 'dash_charges', shop: 'tinkerer', name: 'Spare Springs', desc: '+1 dash charge', flavor: "Extra coils packed behind the heel.", maxLevel: 2, baseCost: 180, growth: 2.4, stats: { dashCharges: { add: 1 } } },
  { id: 'move_speed', shop: 'tinkerer', name: 'Oiled Boots', desc: '+6 move speed', flavor: "Lighter soles, quicker getaways.", maxLevel: 5, baseCost: 40, growth: 1.6, stats: { moveSpeed: { add: 6 } } },
  { id: 'dash_cooldown', shop: 'tinkerer', name: 'Rewound Mainspring', desc: 'Dash recharges 8% faster', flavor: "The spring rewinds itself faster.", maxLevel: 4, baseCost: 60, growth: 1.7, stats: { dashCooldown: { mult: 0.92 } } },
  { id: 'active_charge', shop: 'tinkerer', name: 'Capacitor Bank', desc: 'Active items charge 12% faster', flavor: "Leyden jars wired to every gadget you carry.", maxLevel: 3, baseCost: 90, growth: 1.8, stats: { activeRecharge: { mult: 1.12 } } },
  // --- Gunsmith ---
  { id: 'damage', shop: 'gunsmith', name: 'Heavier Slugs', desc: '+1 damage', flavor: "Denser slugs, cast in the Gunsmith's own crucible.", maxLevel: 10, baseCost: 35, growth: 1.45, stats: { damage: { add: 1 } } },
  { id: 'fire_rate', shop: 'gunsmith', name: 'Faster Action', desc: '+6% fire rate', flavor: "A smoother trigger and a faster feed.", maxLevel: 8, baseCost: 45, growth: 1.5, stats: { fireRate: { mult: 1.06 } } },
  { id: 'shot_speed', shop: 'gunsmith', name: 'Rifling', desc: '+15 shot speed, +15 range', flavor: "Tighter rifling for flatter, faster shots.", maxLevel: 4, baseCost: 30, growth: 1.6, stats: { shotSpeed: { add: 15 }, range: { add: 15 } } },
  { id: 'crit', shop: 'gunsmith', name: 'Hair Trigger', desc: '+3% critical hit chance', flavor: "A hair trigger for the perfect moment.", maxLevel: 5, baseCost: 70, growth: 1.6, stats: { critChance: { add: 0.03 } } },
  // --- Alchemist ---
  { id: 'max_hp', shop: 'alchemist', name: 'Iron Lungs', desc: '+1 heart max HP', flavor: "An alchemical tonic that toughens the lungs and heart.", maxLevel: 4, baseCost: 80, growth: 1.9, stats: { maxHp: { add: 2 } } },
  { id: 'start_tonic', shop: 'alchemist', name: 'Pocket Tonic', desc: 'Start each run with a Health Tonic', flavor: "Never go down the hole without a drink.", maxLevel: 1, baseCost: 120, growth: 1, special: 'startTonic' },
  { id: 'revive_window', shop: 'alchemist', name: 'Smelling Salts', desc: '+4s co-op revive window', flavor: "Enough to wake the dead. Briefly.", maxLevel: 2, baseCost: 60, growth: 1.8, stats: { reviveWindow: { add: 4 } } },
  { id: 'heart_luck', shop: 'alchemist', name: 'Red Clover', desc: 'Hearts drop more often', flavor: "Pressed clover. Brings life where it's needed.", maxLevel: 3, baseCost: 50, growth: 1.7, special: 'heartLuck' },
  // --- Clockmaker ---
  { id: 'luck', shop: 'clockmaker', name: 'Lucky Escapement', desc: '+1 luck (better item rarity)', flavor: "A tuned escapement that nudges fate your way.", maxLevel: 3, baseCost: 100, growth: 1.9, stats: { luck: { add: 1 } } },
  { id: 'cog_mult', shop: 'clockmaker', name: 'Cog Magnet', desc: '+15% Cogs from drops', flavor: "Cogs leap into your pockets.", maxLevel: 3, baseCost: 90, growth: 1.8, stats: { cogMult: { add: 0.15 } } },
  { id: 'start_item', shop: 'clockmaker', name: 'Heirloom Crate', desc: 'Start runs with a random item (lvl 2: rare+)', flavor: "The Clockmaker's crate of curios, one per descent.", maxLevel: 2, baseCost: 250, growth: 2.5, special: 'startItem' },
];

export const UPGRADE_MAP = Object.fromEntries(UPGRADES.map((u) => [u.id, u]));

export function upgradeCost(upg, level) {
  return Math.round(upg.baseCost * Math.pow(upg.growth, level));
}
