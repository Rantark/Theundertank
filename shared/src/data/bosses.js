// BOSS DEFINITIONS
// Bosses appear every 5th floor (tier = depth / 5). Each has a movement style and a
// pool of attack patterns (implemented in sim/bosses.js). Patterns with `minTier`
// only unlock on deeper boss floors, `phase: 2` patterns only below 50% HP.
// BOSS_MODIFIERS add generic twists at deeper tiers.
export const BOSSES = [
  {
    id: 'steam_golem', name: 'The Steam Golem', title: 'Furnace of the Deep Works',
    hp: 600, r: 13, speed: 32, move: 'chase', idle: [1.1, 1.6], contact: 2,
    patterns: [
      { id: 'stomp', weight: 3 },
      { id: 'boulder', weight: 2 },
      { id: 'breath', weight: 2 },
      { id: 'vents', weight: 2, minTier: 2 },
      { id: 'charge', weight: 2, minTier: 3 },
      { id: 'quake', weight: 3, phase: 2 },
    ],
  },
  {
    id: 'clocktower', name: 'The Clocktower Automaton', title: 'Keeper of the Hour',
    hp: 560, r: 13, speed: 24, move: 'center', idle: [0.9, 1.4], contact: 2,
    patterns: [
      { id: 'clock_hands', weight: 3 },
      { id: 'chime_rings', weight: 3 },
      { id: 'pendulum', weight: 2 },
      { id: 'gear_rain', weight: 2, minTier: 2 },
      { id: 'time_skip', weight: 2, minTier: 3 },
      { id: 'hour_strike', weight: 3, phase: 2 },
    ],
  },
  {
    id: 'boiler_beast', name: 'The Boiler-Hearted Beast', title: 'It Hungers for Coal',
    hp: 520, r: 12, speed: 55, move: 'prowl', idle: [0.8, 1.3], contact: 2,
    patterns: [
      { id: 'pounce', weight: 3 },
      { id: 'fire_spiral', weight: 2 },
      { id: 'coal_scatter', weight: 2 },
      { id: 'flame_wave', weight: 2, minTier: 2 },
      { id: 'pounce_triple', weight: 2, minTier: 3 },
      { id: 'inferno', weight: 3, phase: 2 },
    ],
  },
  {
    id: 'tesla_matriarch', name: 'The Tesla Matriarch', title: 'Mother of Lightning',
    hp: 540, r: 12, speed: 40, move: 'float', idle: [1.0, 1.5], contact: 2,
    patterns: [
      { id: 'bolts', weight: 3 },
      { id: 'orbs', weight: 2 },
      { id: 'storm_ring', weight: 2 },
      { id: 'grid', weight: 2, minTier: 2 },
      { id: 'blink_barrage', weight: 2, minTier: 3 },
      { id: 'chain_nova', weight: 3, phase: 2 },
    ],
  },
];

export const BOSS_MAP = Object.fromEntries(BOSSES.map((b) => [b.id, b]));

export const BOSS_MODIFIERS = [
  { id: 'reinforced', name: 'Reinforced', desc: '+25% bullets per pattern', minTier: 2 },
  { id: 'summoner', name: 'Summoner', desc: 'Calls reinforcements', minTier: 3 },
  { id: 'enraged', name: 'Enraged', desc: 'Attacks more often', minTier: 4 },
  { id: 'overcharged', name: 'Overcharged', desc: 'Faster bullets', minTier: 5 },
];
