// ITEM DEFINITIONS
// ----------------
// Items are pure data. The simulation interprets these fields generically:
//   stats:    { statName: { add?: n, mult?: n } }       -> sim/stats.js
//   proj:     { behaviorName: params }                   -> merged into the player's
//             projectile template; behaviors live in sim/behaviors.js and params of the
//             same behavior from several items are summed, so items stack naturally.
//   hooks:    [{ on, action, params, chance, every }]    -> event hooks; actions live in
//             sim/actions.js. on = fire | hit | kill | dash | hurt | roomClear | floor | tick
//   allies:   [{ type, ...params }]                      -> orbitals / familiars (sim/allies.js)
//   flags:    { name: value }                            -> numeric flags summed across items,
//             read by generic systems (e.g. cloudsElectrified)
//   active:   { action, params, charge }                 -> active items (charge in seconds)
//   onPickup: [{ action, params }]                       -> one-shot effects when collected
// Rarity: common | rare | legendary | cursed. Cursed items trade a big boon for a drawback.

export const ITEMS = [
  // ---------------------------------------------------------------- COMMON
  { id: 'brass_barrel', name: 'Brass Barrel', rarity: 'common', tags: [], desc: '+2 damage.', flavor: "Heavier, meaner, shinier. Polished weekly by a paranoid owner.",
    stats: { damage: { add: 2 } } },
  { id: 'greased_gears', name: 'Greased Gears', rarity: 'common', tags: ['CLOCKWORK'], desc: '+20% fire rate.', flavor: "A dab of whale oil and the whole mechanism sings.",
    stats: { fireRate: { mult: 1.2 } } },
  { id: 'spring_boots', name: 'Spring Boots', rarity: 'common', tags: ['SPEED'], desc: '+15 speed, faster dash recharge.', flavor: "Coiled tight enough to launch a pigeon into orbit.",
    stats: { moveSpeed: { add: 15 }, dashCooldown: { mult: 0.85 } } },
  { id: 'copper_plating', name: 'Copper Plating', rarity: 'common', tags: [], desc: '+1 heart and a full heal.', flavor: "Riveted straight onto your waistcoat. Fashion be damned.",
    stats: { maxHp: { add: 2 } }, onPickup: [{ action: 'heal', params: { amount: 99 } }] },
  { id: 'rifled_barrel', name: 'Rifled Barrel', rarity: 'common', tags: ['PIERCING'], desc: 'Shots pierce 1 enemy. +shot speed.', flavor: "Spiral grooves that send each slug spinning clean through.",
    stats: { pierce: { add: 1 }, shotSpeed: { add: 25 } } },
  { id: 'coal_furnace', name: 'Coal Furnace', rarity: 'common', tags: ['FIRE'], desc: 'Shots set enemies ablaze.', flavor: "A pocket firebox. Keep it away from your trousers.",
    proj: { burn: { dps: 6, duration: 2.5 } } },
  { id: 'rubber_seals', name: 'Rubber Seals', rarity: 'common', tags: ['BOUNCE'], desc: 'Shots ricochet off walls twice.', flavor: "Salvaged from a sunken submersible. Bounces back from anything.",
    stats: { bounce: { add: 2 } } },
  { id: 'steam_canister', name: 'Steam Canister', rarity: 'common', tags: ['STEAM'], desc: 'Slain enemies burst into scalding steam.', flavor: "Every automaton has a boiler. This makes sure it bursts.",
    hooks: [{ on: 'kill', action: 'cloud', params: { radius: 22, dps: 14, life: 2.5 } }] },
  { id: 'gyro_sight', name: 'Gyro Sight', rarity: 'common', tags: [], desc: '+range and shot speed.', flavor: "A spinning brass eye that never loses the horizon.",
    stats: { range: { add: 60 }, shotSpeed: { add: 40 } } },
  { id: 'pressure_valve', name: 'Pressure Valve', rarity: 'common', tags: ['STEAM'], desc: '+15% damage, bigger shots.', flavor: "Crank it past the red line. The manual says not to.",
    stats: { damage: { mult: 1.15 }, shotSize: { add: 0.3 } } },
  { id: 'lucky_cog', name: 'Lucky Cog', rarity: 'common', tags: [], desc: '+1 luck, +25% Cogs.', flavor: "Found in a gutter, pointing north. Surely that means something.",
    stats: { luck: { add: 1 }, cogMult: { add: 0.25 } } },
  { id: 'oil_can', name: 'Oil Can', rarity: 'common', tags: ['SPEED'], desc: '+1 dash. Dashing leaves a slowing oil slick.', flavor: "Slick heels, slicker escapes.",
    stats: { dashCharges: { add: 1 } }, hooks: [{ on: 'dash', action: 'oilSlick', params: { radius: 18, life: 4 } }] },
  { id: 'spark_plug', name: 'Spark Plug', rarity: 'common', tags: ['ELECTRIC'], desc: 'Shots sometimes arc to a nearby enemy.', flavor: "It hums when you hold it. Occasionally it bites.",
    proj: { chain: { jumps: 1, range: 60, dmgMult: 0.6, chance: 0.25 } } },
  { id: 'sturdy_gasket', name: 'Sturdy Gasket', rarity: 'common', tags: ['STEAM'], desc: 'Heal half a heart when a room is cleared (25%).', flavor: "Seals the leaks, in your pipes and your ribs alike.",
    hooks: [{ on: 'roomClear', action: 'heal', chance: 0.25, params: { amount: 1 } }] },

  // ---------------------------------------------------------------- RARE
  { id: 'tesla_coil', name: 'Tesla Coil', rarity: 'rare', tags: ['ELECTRIC'], desc: 'Shots chain lightning to 2 nearby enemies.', flavor: "Stolen from a lecture hall mid-demonstration.",
    proj: { chain: { jumps: 2, range: 70, dmgMult: 0.5, chance: 1 } } },
  { id: 'split_barrel', name: 'Split Barrel', rarity: 'rare', tags: ['SPLIT'], desc: 'Shots burst into 3 shards on impact.', flavor: "A barrel with a fork in it. The slug takes both roads.",
    proj: { split: { count: 3, dmgMult: 0.45, arc: 70 } } },
  { id: 'homing_gyroscope', name: 'Homing Gyroscope', rarity: 'rare', tags: ['HOMING'], desc: 'Shots seek out enemies.', flavor: "It spins toward whatever it hates most.",
    proj: { homing: { strength: 5, range: 130 } } },
  { id: 'overclocked_gears', name: 'Overclocked Gears', rarity: 'rare', tags: ['CLOCKWORK'], desc: '+40% fire rate, -10% damage.', flavor: "Wound far past their tolerances. Listen to them scream.",
    stats: { fireRate: { mult: 1.4 }, damage: { mult: 0.9 } } },
  { id: 'blast_cap', name: 'Blast Cap', rarity: 'rare', tags: ['EXPLOSIVE'], desc: 'Shots explode on impact.', flavor: "Percussion caps packed into every round. Mind your fingers.",
    proj: { explode: { radius: 20, dmgMult: 0.6 } } },
  { id: 'orbiting_cog', name: 'Orbiting Cog', rarity: 'rare', tags: ['ORBITAL'], desc: 'A spinning cog orbits you, grinding foes and blocking shots.', flavor: "It follows you like a loyal, whirring moon.",
    allies: [{ type: 'orbital', radius: 22, speed: 3.2, damage: 12 }] },
  { id: 'twin_barrels', name: 'Twin Barrels', rarity: 'rare', tags: ['SPLIT'], desc: '+1 shot per volley, -20% damage.', flavor: "Why settle for one when the smith had a spare?",
    stats: { shotCount: { add: 1 }, damage: { mult: 0.8 } } },
  { id: 'magnetic_coil', name: 'Magnetic Coil', rarity: 'rare', tags: ['ELECTRIC', 'SPEED'], desc: 'Shots accelerate and hit harder the further they fly.', flavor: "The slug rides the field and never slows down.",
    stats: { shotSpeed: { mult: 1.2 } }, proj: { accel: { rate: 1.6 }, grow: { perPx: 0.004 } } },
  { id: 'kinetic_dynamo', name: 'Kinetic Dynamo', rarity: 'rare', tags: ['SPEED', 'CLOCKWORK'], desc: 'Dashing fires a ring of shots.', flavor: "Your momentum, stored and spat back out as lead.",
    hooks: [{ on: 'dash', action: 'ringShots', params: { count: 8, dmgMult: 0.6 } }] },
  { id: 'vent_shroud', name: 'Vent Shroud', rarity: 'rare', tags: ['STEAM'], desc: 'Taking damage vents a scalding steam blast.', flavor: "Pain goes in. Scalding steam comes out.",
    hooks: [{ on: 'hurt', action: 'steamBurst', params: { radius: 60, damage: 40, knock: 260 } }] },
  { id: 'clockwork_owl', name: 'Clockwork Owl', rarity: 'rare', tags: ['ORBITAL', 'CLOCKWORK'], desc: 'A brass owl follows you and fires at enemies.', flavor: "It hoots on the hour and shoots in between.",
    allies: [{ type: 'owl', fireRate: 1.6, dmgMult: 0.5 }] },
  { id: 'powder_keg', name: 'Powder Keg', rarity: 'rare', tags: ['EXPLOSIVE', 'FIRE'], desc: 'Enemies explode when they die.', flavor: "Stuff a little powder into every foe. Wait.",
    hooks: [{ on: 'kill', action: 'explosion', params: { radius: 30, damage: 25 } }] },
  { id: 'chrono_spring', name: 'Chrono Spring', rarity: 'rare', tags: ['CLOCKWORK'], desc: 'Shots slow enemies.', flavor: "Each shot steals a moment from its target.",
    proj: { slow: { amount: 0.45, duration: 1.5 } } },
  { id: 'oscillator', name: 'Oscillator', rarity: 'rare', tags: ['ELECTRIC'], desc: 'Shots wave through the air. +25% damage.', flavor: "The rounds hum a tune only automatons can hear.",
    stats: { damage: { mult: 1.25 } }, proj: { wave: { amp: 0.7, freq: 14 } } },
  { id: 'scalding_rounds', name: 'Scalding Rounds', rarity: 'rare', tags: ['STEAM'], desc: 'Shots trail steam that scalds enemies.', flavor: "Hollow rounds full of superheated vapour.",
    proj: { steamTrail: { interval: 0.09, dps: 8, radius: 9 } } },

  // ---------------------------------------------------------------- LEGENDARY
  { id: 'engine_heart', name: 'Engine Heart', rarity: 'legendary', tags: ['CLOCKWORK', 'FIRE'], desc: '+1 heart, +20% damage, fire rate and speed.', flavor: "A second heart of brass, beating double time.",
    stats: { maxHp: { add: 2 }, damage: { mult: 1.2 }, fireRate: { mult: 1.2 }, moveSpeed: { mult: 1.12 } },
    onPickup: [{ action: 'heal', params: { amount: 99 } }] },
  { id: 'storm_lens', name: 'Storm Lens', rarity: 'legendary', tags: ['ELECTRIC', 'PIERCING'], desc: 'Shots pierce twice and chain to 3 enemies.', flavor: "Ground from a lightning-struck church window.",
    stats: { pierce: { add: 2 } }, proj: { chain: { jumps: 3, range: 80, dmgMult: 0.6, chance: 1 } } },
  { id: 'swarm_hive', name: 'Swarm Hive', rarity: 'legendary', tags: ['ORBITAL'], desc: 'Three brass beetles orbit you.', flavor: "Three brass beetles who think you are their queen.",
    allies: [{ type: 'orbital', radius: 30, speed: 4.5, damage: 8, count: 3, small: true }] },
  { id: 'dragon_boiler', name: 'Dragon Boiler', rarity: 'legendary', tags: ['FIRE', 'EXPLOSIVE'], desc: 'Fireballs that explode into fire pools.', flavor: "Some say the dragon is still inside, stoking it.",
    stats: { damage: { mult: 1.3 }, shotSize: { add: 0.5 } }, proj: { burn: { dps: 8, duration: 3 }, explode: { radius: 18, dmgMult: 0.4, firePool: 1 } } },
  { id: 'quad_gatling', name: 'Quad Gatling', rarity: 'legendary', tags: ['SPLIT'], desc: '+3 shots, +30% fire rate, -35% damage.', flavor: "Crank the handle. Keep cranking. Never stop cranking.",
    stats: { shotCount: { add: 3 }, fireRate: { mult: 1.3 }, damage: { mult: 0.65 }, spread: { add: -2 } } },
  { id: 'aether_compass', name: 'Aether Compass', rarity: 'legendary', tags: ['HOMING', 'PIERCING'], desc: 'Shots home in and pierce everything.', flavor: "It points at your enemies, and then through them.",
    stats: { pierce: { add: 99 } }, proj: { homing: { strength: 3, range: 110 } } },

  // ---------------------------------------------------------------- CURSED
  { id: 'cracked_boiler', name: 'Cracked Boiler', rarity: 'cursed', tags: ['FIRE', 'STEAM'], desc: '+80% damage. -1 max heart.', flavor: "It will blow one day. Until then, it hits like a train.",
    stats: { damage: { mult: 1.8 }, maxHp: { add: -2 } } },
  { id: 'blood_oil', name: 'Blood Oil', rarity: 'cursed', tags: ['SPEED'], desc: '+60% fire rate. You take +1 damage per hit.', flavor: "Not all of it is oil. Do not ask the Alchemist.",
    stats: { fireRate: { mult: 1.6 }, damageTaken: { add: 1 } } },
  { id: 'leaden_gears', name: 'Leaden Gears', rarity: 'cursed', tags: ['CLOCKWORK'], desc: 'x2.2 damage. -30% move and shot speed.', flavor: "Heavy as sin, and twice as effective.",
    stats: { damage: { mult: 2.2 }, moveSpeed: { mult: 0.7 }, shotSpeed: { mult: 0.8 } } },
  { id: 'soot_lung', name: 'Soot Lung', rarity: 'cursed', tags: ['FIRE'], desc: '+2 burning shots. You can no longer dash.', flavor: "Breathe fire, forget running. A fair trade?",
    stats: { shotCount: { add: 2 }, dashCharges: { add: -99 } }, proj: { burn: { dps: 5, duration: 2 } } },
  { id: 'gamblers_cog', name: "Gambler's Cog", rarity: 'cursed', tags: [], desc: '+30% crit chance (x2.5). Half Cog drops.', flavor: "Heads you win. Tails, you still probably win.",
    stats: { critChance: { add: 0.3 }, cogMult: { mult: 0.5 } } },
  { id: 'hungry_engine', name: 'Hungry Engine', rarity: 'cursed', tags: ['CLOCKWORK'], desc: '+4 damage. Lose half a heart every new floor.', flavor: "It purrs when fed. It is always hungry.",
    stats: { damage: { add: 4 } }, hooks: [{ on: 'floor', action: 'selfDamage', params: { amount: 1 } }] },

  // ---------------------------------------------------------------- ACTIVE ITEMS
  { id: 'steam_whistle', name: 'Steam Whistle', rarity: 'common', kind: 'active', tags: ['STEAM'], desc: 'ACTIVE: blast of steam that hurls enemies away.', flavor: "One long blast and the whole room clears out.",
    active: { action: 'steamBurst', params: { radius: 80, damage: 45, knock: 380, cloud: true }, charge: 10 } },
  { id: 'pocket_watch', name: 'Pocket Watch', rarity: 'rare', kind: 'active', tags: ['CLOCKWORK'], desc: 'ACTIVE: stop time for 3 seconds.', flavor: "Wind it backwards and the world holds its breath.",
    active: { action: 'timeStop', params: { duration: 3 }, charge: 24 } },
  { id: 'tesla_bomb', name: 'Tesla Bomb', rarity: 'rare', kind: 'active', tags: ['ELECTRIC', 'EXPLOSIVE'], desc: 'ACTIVE: hurl a bomb that explodes in chain lightning.', flavor: "A sphere of bottled thunder with a very short fuse.",
    active: { action: 'throwBomb', params: { radius: 44, damage: 70, chain: 4 }, charge: 9 } },
  { id: 'brass_turret', name: 'Brass Turret', rarity: 'rare', kind: 'active', tags: ['CLOCKWORK'], desc: 'ACTIVE: deploy a turret that copies your shots.', flavor: "Unfolds from a suitcase. Very polite. Very lethal.",
    active: { action: 'deployTurret', params: { life: 8, fireRate: 3.5 }, charge: 20 } },
  { id: 'repair_kit', name: 'Field Repair Kit', rarity: 'common', kind: 'active', tags: [], desc: 'ACTIVE: restore 1 heart.', flavor: "Bandages, rivets, and a strong cup of tea.",
    active: { action: 'heal', params: { amount: 2 }, charge: 35 } },
  { id: 'overdrive_lever', name: 'Overdrive Lever', rarity: 'legendary', kind: 'active', tags: ['SPEED', 'CLOCKWORK'], desc: 'ACTIVE: 5s of double fire rate and speed.', flavor: "Pull it and every valve in your body opens at once.",
    active: { action: 'overdrive', params: { duration: 5 }, charge: 18 } },
];

// Consumables sit in a single slot and are used once.
export const CONSUMABLES = [
  { id: 'tonic', name: 'Health Tonic', desc: 'Restore 1 heart.', action: 'heal', params: { amount: 2 } },
  { id: 'grenade', name: 'Brass Grenade', desc: 'Throw an explosive at your aim.', action: 'throwBomb', params: { radius: 40, damage: 60, chain: 0 } },
  { id: 'smoke_bomb', name: 'Smoke Bomb', desc: '2.5s of invulnerability.', action: 'invuln', params: { duration: 2.5 } },
  { id: 'oil_flask', name: 'Oil Flask', desc: 'Throw a flask that ignites into flames.', action: 'throwFire', params: { radius: 30, life: 5 } },
  { id: 'cog_magnet', name: 'Cog Magnet', desc: 'Pulls in every Cog in the room, +10 Cogs.', action: 'magnet', params: { bonus: 10 } },
  { id: 'surveyor_map', name: "Surveyor's Map", desc: 'Reveal the whole floor.', action: 'revealMap', params: {} },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
export const CONSUMABLE_MAP = Object.fromEntries(CONSUMABLES.map((c) => [c.id, c]));

export const RARITY_WEIGHTS = { common: 60, rare: 30, legendary: 6, cursed: 8 };
