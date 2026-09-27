// Global constants shared by client, server and simulation.

export const TILE = 16;
// Full room size in tiles, including the one-tile wall border.
export const ROOM_W = 23;
export const ROOM_H = 13;
// Walkable interior size in tiles.
export const INNER_W = ROOM_W - 2;
export const INNER_H = ROOM_H - 2;
export const ROOM_PX_W = ROOM_W * TILE;
export const ROOM_PX_H = ROOM_H * TILE;

// Tile codes used in generated room grids.
export const T = {
  FLOOR: 0,
  WALL: 1,
  BLOCK: 2, // solid machinery block: blocks movement and shots
  PIT: 3, // gear pit: blocks walking, shots fly over
  DOOR: 4, // door opening in the wall (state lives on the room)
  VENT: 5, // decorative / hazardous floor vent (walkable)
};

// Door directions and their tile positions inside the room grid.
export const DIRS = ['n', 's', 'e', 'w'];
export const DIR_VEC = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
export const OPPOSITE = { n: 's', s: 'n', e: 'w', w: 'e' };
export const DOOR_TILE = {
  n: [Math.floor(ROOM_W / 2), 0],
  s: [Math.floor(ROOM_W / 2), ROOM_H - 1],
  w: [0, Math.floor(ROOM_H / 2)],
  e: [ROOM_W - 1, Math.floor(ROOM_H / 2)],
};

export const MAX_PLAYERS = 4;
export const PLAYER_COLORS = [0xf2b134, 0x4fc3d9, 0xe0588a, 0x8fd14f];
export const PLAYER_COLOR_NAMES = ['Brass', 'Cyan', 'Rose', 'Verdigris'];

// Simulation rates. The client simulates locally at 60Hz, the server at 30Hz
// (cheap enough for a Raspberry Pi). All sim code is dt-based.
export const LOCAL_DT = 1 / 60;
export const SERVER_TICK_HZ = 30;
export const SNAPSHOT_HZ = 15;
export const INTERP_DELAY_MS = 120;

export const DEFAULT_PORT = 3001;
// Bumped whenever the network snapshot/sim contract changes; mismatched builds can't join.
export const PROTOCOL_VERSION = 3;

// Palette (steampunk): brass, copper, verdigris, soot, gaslight.
export const PAL = {
  soot: 0x14110f,
  sootLight: 0x2a2420,
  iron: 0x3d3833,
  ironLight: 0x5a534b,
  brass: 0xc99a2e,
  brassLight: 0xf2cf6b,
  brassDark: 0x7a5a17,
  copper: 0xb8683a,
  copperLight: 0xe39a63,
  copperDark: 0x6e3a1e,
  verdigris: 0x3fa38a,
  verdigrisLight: 0x7fd6b8,
  verdigrisDark: 0x1f5e50,
  gaslight: 0xff9c3a,
  gaslightLight: 0xffd08a,
  steam: 0xe6e9e4,
  blood: 0x2b1a12,
  enemyShot: 0xff2e63,
  enemyShotCore: 0xffd1dc,
  electric: 0x6ff0ff,
  fire: 0xff6a1f,
  white: 0xffffff,
};

export const RARITY_COLORS = {
  common: 0xd9d2c3,
  rare: 0x4fc3d9,
  legendary: 0xffc93c,
  cursed: 0xb03fd9,
};
