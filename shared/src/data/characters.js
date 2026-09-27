// Playable characters. Base stats are modified by permanent upgrades and items.
// `unlockCost` is paid (in Cogs) at the Clockmaker. `startItems` are item ids.

export const BASE_STATS = {
  maxHp: 6, // in half-hearts (6 = 3 hearts)
  damage: 10,
  fireRate: 3, // volleys per second
  shotSpeed: 230,
  range: 190, // pixels a shot travels
  shotSize: 1,
  shotCount: 1,
  spread: 10, // degrees between multi-shots
  moveSpeed: 95,
  dashCharges: 1,
  dashCooldown: 1.1, // seconds per charge
  dashSpeed: 340,
  dashTime: 0.14,
  knockback: 110,
  luck: 0,
  pierce: 0,
  bounce: 0,
  critChance: 0,
  critMult: 2.5,
  damageTaken: 0, // extra damage taken per hit (cursed items)
  sustainRamp: 0, // damage bonus per second of sustained fire
  sustainMax: 0,
  cogMult: 1,
  activeRecharge: 1,
  reviveWindow: 10,
};

export const CHARACTERS = [
  {
    id: 'tinker',
    name: 'Ada Cogsworth',
    title: 'The Tinker',
    desc: 'A balanced inventor with a trusty brass repeater.',
    color: 0xf2b134,
    stats: {},
    startItems: [],
    unlockCost: 0,
  },
  {
    id: 'stoker',
    name: 'Brom Stoker',
    title: 'The Stoker',
    desc: 'Tough furnace-man. Slow, heavy shots that ignite.',
    color: 0xe0643a,
    stats: { maxHp: { add: 2 }, damage: { add: 3 }, fireRate: { mult: 0.8 }, moveSpeed: { add: -10 } },
    startItems: ['coal_furnace'],
    unlockCost: 300,
  },
  {
    id: 'courier',
    name: 'Vesper Quickstep',
    title: 'The Courier',
    desc: 'Fragile but lightning fast. Two dash charges.',
    color: 0x4fc3d9,
    stats: { maxHp: { add: -2 }, damage: { add: -2 }, fireRate: { mult: 1.2 }, moveSpeed: { add: 20 }, dashCharges: { add: 1 } },
    startItems: [],
    unlockCost: 400,
  },
  {
    id: 'artificer',
    name: 'Magnus Brassbeard',
    title: 'The Artificer',
    desc: 'Starts with an orbiting cog and a Steam Whistle.',
    color: 0x8fd14f,
    stats: { damage: { add: -1 } },
    startItems: ['orbiting_cog', 'steam_whistle'],
    unlockCost: 600,
  },
  {
    id: 'widow',
    name: 'The Soot Widow',
    title: 'The Cursed',
    desc: 'One heart. Starts with a random Cursed item. High risk, high reward.',
    color: 0xb03fd9,
    stats: { maxHp: { add: -4 }, damage: { add: 3 }, luck: { add: 2 } },
    startItems: ['@random_cursed'],
    unlockCost: 900,
  },
];

export const CHARACTER_MAP = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
