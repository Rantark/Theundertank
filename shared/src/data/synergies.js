// NAMED SYNERGIES
// ---------------
// A synergy activates when `requires` is satisfied:
//   items: all listed item ids owned, and/or
//   tags:  { TAG: minimumCount } over the player's items.
// Its payload uses exactly the same schema as items (stats/proj/hooks/allies/flags),
// so the generic pipeline applies it like a bonus item. Flags are read by
// systems (zones, explosions, allies) to change behaviour without special-casing items.

export const SYNERGIES = [
  { id: 'storm_front', name: 'Storm Front', desc: 'Steam clouds become electrified and chain lightning.',
    requires: { items: ['tesla_coil', 'steam_canister'] },
    flags: { cloudsElectrified: 1 } },
  { id: 'seeker_shards', name: 'Seeker Shards', desc: 'Split shards lock on hard and hit harder.',
    requires: { items: ['split_barrel', 'homing_gyroscope'] },
    proj: { split: { count: 1, dmgMult: 0.2, shardHoming: 9 } } },
  { id: 'overheat', name: 'Overheat', desc: 'Sustained fire builds heat: up to +120% damage.',
    requires: { items: ['overclocked_gears', 'pressure_valve'] },
    stats: { sustainRamp: { add: 0.4 }, sustainMax: { add: 1.2 } } },
  { id: 'hellfire', name: 'Hellfire', desc: 'Explosions leave burning fire pools.',
    requires: { items: ['coal_furnace', 'blast_cap'] },
    flags: { explosionsFirePool: 1 } },
  { id: 'clockwork_legion', name: 'Clockwork Legion', desc: 'Your orbitals open fire on enemies.',
    requires: { tags: { ORBITAL: 2 } },
    flags: { orbitalsShoot: 1 } },
  { id: 'railgun', name: 'Railgun', desc: 'Shots pierce everything at blistering speed.',
    requires: { items: ['rifled_barrel', 'magnetic_coil'] },
    stats: { pierce: { add: 99 }, damage: { mult: 1.3 }, shotSpeed: { mult: 1.4 } } },
  { id: 'thunderclap', name: 'Thunderclap', desc: 'Explosions discharge chain lightning.',
    requires: { items: ['tesla_coil', 'blast_cap'] },
    flags: { explosionsChain: 3 } },
  { id: 'ricochet_rain', name: 'Ricochet Rain', desc: 'Shards ricochet off walls and split once more.',
    requires: { items: ['rubber_seals', 'split_barrel'] },
    proj: { split: { shardBounce: 2, shardGen: 1 } } },
  { id: 'momentum', name: 'Momentum', desc: 'Three SPEED items: damage scales with your velocity, dashes recharge faster.',
    requires: { tags: { SPEED: 3 } },
    stats: { dashCooldown: { mult: 0.7 } }, flags: { momentum: 0.6 } },
  { id: 'pyromaniac', name: 'Pyromaniac', desc: 'Three FIRE items: immune to fire and explosions, burns deal double.',
    requires: { tags: { FIRE: 3 } },
    flags: { fireImmune: 1, burnMult: 1 } },
  { id: 'pressure_cooker', name: 'Pressure Cooker', desc: 'Steam clouds detonate when they dissipate.',
    requires: { items: ['powder_keg', 'steam_canister'] },
    flags: { cloudsExplode: 1 } },
  { id: 'time_lord', name: 'Time Lord', desc: 'Time stops last twice as long; slowed enemies take +50% damage.',
    requires: { items: ['pocket_watch', 'chrono_spring'] },
    flags: { timeStopMult: 1, slowedVuln: 0.5 } },
  { id: 'dynamo_storm', name: 'Dynamo Storm', desc: 'Dash rings double up and electrify.',
    requires: { items: ['kinetic_dynamo', 'tesla_coil'] },
    hooks: [{ on: 'dash', action: 'ringShots', params: { count: 8, dmgMult: 0.5, offset: 0.39 } }],
    proj: { chain: { jumps: 1 } } },
  { id: 'steam_engine', name: 'Full Steam', desc: 'Three STEAM items: dashing leaves scalding clouds; clouds heal you slowly.',
    requires: { tags: { STEAM: 3 } },
    hooks: [{ on: 'dash', action: 'cloud', params: { radius: 20, dps: 16, life: 2.5, atPlayer: true } }],
    flags: { cloudsHeal: 1 } },
];

export const SYNERGY_MAP = Object.fromEntries(SYNERGIES.map((s) => [s.id, s]));
