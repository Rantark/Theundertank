// Floor modifiers unlock at depth tiers. The generator rolls a few per floor
// (more the deeper you go). Their effects are implemented in sim/game.js,
// sim/enemies.js and (for blackout) the client renderer.
export const FLOOR_MODIFIERS = [
  { id: 'overpressure', short: 'VENTS', name: 'Overpressure', desc: 'Steam vents erupt periodically.', minDepth: 3, weight: 10 },
  { id: 'rusted', short: 'RUSTED', name: 'Rusted Plating', desc: 'Enemies are armoured, but drop more Cogs.', minDepth: 4, weight: 8 },
  { id: 'overclocked', short: 'FAST', name: 'Overclocked', desc: 'Enemies move and fire faster.', minDepth: 6, weight: 8 },
  { id: 'blackout', short: 'DARK', name: 'Gaslight Failure', desc: 'The lamps are out. Visibility is reduced.', minDepth: 7, weight: 6 },
  { id: 'volatile', short: 'VOLATILE', name: 'Volatile Cores', desc: 'Enemies burst into bullets when destroyed.', minDepth: 9, weight: 7 },
  { id: 'magnetized', short: 'MAGNETIC', name: 'Magnetized', desc: 'Enemy shots curve toward you.', minDepth: 11, weight: 6 },
  { id: 'gear_storm', short: 'GEARFALL', name: 'Gear Storm', desc: 'Loose gears rain from the ceiling.', minDepth: 13, weight: 6 },
];
export const MODIFIER_MAP = Object.fromEntries(FLOOR_MODIFIERS.map((m) => [m.id, m]));
