// ENEMY DEFINITIONS
// `ai` selects a behaviour from sim/enemies.js; `params` tune it. HP/damage are base
// values scaled per floor (see sim/scaling.js). `minDepth` gates the spawn pool so new
// enemy types appear as you descend. `weight` = relative spawn frequency.
export const ENEMIES = [
  { id: 'cogling', name: 'Cogling', ai: 'chaser', hp: 18, speed: 62, r: 5, contact: 1, minDepth: 1, weight: 10, cogChance: 0.3,
    params: { lungeSpeed: 170, lungeEvery: [1.4, 2.4] } },
  { id: 'rivet_turret', name: 'Rivet Turret', ai: 'turret', hp: 30, speed: 0, r: 6, contact: 1, minDepth: 1, weight: 7, cogChance: 0.4,
    params: { every: [1.5, 2.0], shotSpeed: 95, burst: 1 } },
  { id: 'steam_spitter', name: 'Steam Spitter', ai: 'kiter', hp: 24, speed: 48, r: 5, contact: 1, minDepth: 1, weight: 8, cogChance: 0.35,
    params: { keep: [70, 115], every: [1.8, 2.5], shotSpeed: 90, spread: 3 } },
  { id: 'boiler_bomb', name: 'Boiler Bomb', ai: 'bomber', hp: 16, speed: 70, r: 5, contact: 1, minDepth: 2, weight: 5, cogChance: 0.3,
    params: { fuse: 0.75, radius: 30, ring: 8 } },
  { id: 'spring_hopper', name: 'Spring Hopper', ai: 'hopper', hp: 30, speed: 0, r: 6, contact: 1, minDepth: 2, weight: 6, cogChance: 0.4,
    params: { idle: [0.9, 1.5], air: 0.6, ring: 8, shotSpeed: 80 } },
  { id: 'gear_spinner', name: 'Gear Spinner', ai: 'bouncer', hp: 34, speed: 55, r: 6, contact: 1, minDepth: 3, weight: 5, cogChance: 0.45, flying: true,
    params: { every: 2.8, spiralShots: 12, shotSpeed: 80 } },
  { id: 'pipe_worm', name: 'Pipe Worm', ai: 'burrower', hp: 40, speed: 60, r: 6, contact: 1, minDepth: 4, weight: 5, cogChance: 0.5,
    params: { under: [1.4, 2.2], up: 1.3, ring: 10, shotSpeed: 85 } },
  { id: 'brass_sentinel', name: 'Brass Sentinel', ai: 'shielded', hp: 60, speed: 28, r: 7, contact: 1, minDepth: 5, weight: 4, cogChance: 0.6,
    params: { every: 2.6, shotSpeed: 60, burst: 8, shieldArc: 1.0 } },
  { id: 'coil_wraith', name: 'Coil Wraith', ai: 'teleporter', hp: 36, speed: 0, r: 5, contact: 1, minDepth: 7, weight: 4, cogChance: 0.55, flying: true,
    params: { wait: 1.6, orbs: 3, shotSpeed: 60 } },
  { id: 'tinker_mother', name: 'Tinker Mother', ai: 'summoner', hp: 55, speed: 40, r: 7, contact: 1, minDepth: 9, weight: 3, cogChance: 0.8,
    params: { every: 4, spawn: 2, maxChildren: 4 } },
  { id: 'smog_bellows', name: 'Smog Bellows', ai: 'sprayer', hp: 50, speed: 18, r: 7, contact: 1, minDepth: 11, weight: 3, cogChance: 0.7,
    params: { spray: 2.0, rest: 1.6, rate: 0.11, arms: 2, turn: 2.2, shotSpeed: 85 } },
];

export const ENEMY_MAP = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));

// Elite modifiers: elites are tinted gold, larger, tougher and gain one of these.
export const ELITE_MODS = [
  { id: 'hasted', name: 'Hasted', desc: 'Moves and attacks faster' },
  { id: 'armored', name: 'Armored', desc: 'Takes reduced damage' },
  { id: 'volatile', name: 'Volatile', desc: 'Explodes into bullets on death' },
  { id: 'splitting', name: 'Splitting', desc: 'Releases coglings on death' },
];
