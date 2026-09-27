// PROCEDURAL SPRITES
// Every texture in the game is authored here in code (16x16 base, bosses 32x32) with
// the Pix helper, then registered with Phaser. Palette: brass, copper, verdigris,
// soot black and warm gaslight orange.
import { Pix } from './pix.js';
import { PAL, PLAYER_COLORS, CHARACTERS, ITEMS, ENEMIES, BOSSES } from '@undercrank/shared';
import { ITEM_ICON } from './icons.js';

export function shade(c, f) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}
export function mix(a, b, t) {
  const ch = (s) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [ar, ag, ab] = ch(a);
  const [br, bg, bb] = ch(b);
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

const K = PAL.soot;
const BR = PAL.brass;
const BL = PAL.brassLight;
const BD = PAL.brassDark;
const CU = PAL.copper;
const CL = PAL.copperLight;
const CD = PAL.copperDark;
const VG = PAL.verdigris;
const VL = PAL.verdigrisLight;
const VD = PAL.verdigrisDark;
const IR = PAL.iron;
const IL = PAL.ironLight;
const GO = PAL.gaslight;
const GL = PAL.gaslightLight;
const ST = PAL.steam;
const RED = 0xe0303a;
const EYE = 0xff3b3b;

// ---------------------------------------------------------------- characters
const HEADS = {
  tinker: [
    '................',
    '......hhhh......',
    '......hhhh......',
    '......xxxx......',
    '....hhhhhhhh....',
    '.....ssssbn.....',
    '.....sSssnB.....',
    '......ssss......',
  ],
  stoker: [
    '................',
    '................',
    '......rrrr......',
    '.....rrrrrr.....',
    '.....ssssss.....',
    '.....sSkssk.....',
    '.....ssSSss.....',
    '......hhhh......',
  ],
  courier: [
    '................',
    '................',
    '.....xxxxx......',
    '....xxxxxxxX....',
    '.....hsssss.....',
    '.....hsSsks.....',
    '......ssss......',
    '......ssss......',
  ],
  artificer: [
    '................',
    '......hhhh......',
    '.....hhhhhh.....',
    '.....ssssbn.....',
    '.....sSssnB.....',
    '.....wwwwww.....',
    '.....wwwwww.....',
    '......wwww......',
  ],
  widow: [
    '................',
    '.....hhhhhh.....',
    '....hhhhhhhh....',
    '...hhhhhhhhhh...',
    '.....pppppp.....',
    '.....pspsps.....',
    '.....pspEps.....',
    '......pppp......',
  ],
};
const BODY_A = [
  '.....xxxxxx.....',
  '....xxXxxXxx....',
  '...sxxXbbXxxs...',
  '....xXxxxxXx....',
  '.....xxxxxx.....',
  '.....dd..dd.....',
  '.....kk..kk.....',
  '................',
];
const BODY_B = [
  '.....xxxxxx.....',
  '....xxXxxXxx....',
  '...sxxXbbXxxs...',
  '....xXxxxxXx....',
  '.....xxxxxx.....',
  '....dd....dd....',
  '....kk....kk....',
  '................',
];

function makeCharacter(scene, ch, frame) {
  const p = new Pix(16, 16);
  const pal = {
    h: 0x2a1d17, s: 0xe8b48a, S: 0xb57e5a, b: BL, B: 0x9fe8ff, n: BD, x: ch.color, X: shade(ch.color, 0.65),
    d: IR, k: 0x1e1a17, r: 0xc2452a, w: 0xd9d2c3, p: 0x3a2745, E: 0xff5a8a,
  };
  p.ascii(HEADS[ch.id] || HEADS.tinker, pal, 0, 0);
  p.ascii(frame ? BODY_B : BODY_A, pal, 0, 8);
  p.outline(K);
  p.toTexture(scene, `pl_${ch.id}_${frame}`);
}

// ---------------------------------------------------------------- enemies
const ENEMY_DRAW = {
  cogling(p, f) {
    p.gear(8, 8, 5, 8, BR, BD, 0, f * 0.2);
    p.disc(8, 8, 2.5, K);
    p.disc(8, 8, 1.5, EYE);
    p.px(8, 7, 0xffd1dc);
    p.px(4 + f, 14, IR).px(11 - f, 14, IR);
  },
  rivet_turret(p) {
    p.rect(2, 5, 12, 9, IR);
    p.rect(3, 6, 10, 7, IL);
    [[3, 6], [12, 6], [3, 12], [12, 12]].forEach(([x, y]) => p.px(x, y, BL));
    p.disc(8, 8, 4, CU);
    p.disc(7, 7, 2, CL);
    p.disc(8, 9, 1, EYE);
  },
  steam_spitter(p, f) {
    p.ellipse(8, 10, 6, 5, CU);
    p.ellipse(7, 9, 3, 2, CL);
    p.rect(12, 7, 3, 2, CD);
    p.rect(5, 4, 6, 2, IR);
    p.px(6 + f, 13, VG).px(10, 12, VG).px(4, 11, VG);
    p.disc(6, 9, 1.2, K);
    p.px(6, 9, EYE).px(9, 9, EYE);
    if (f) p.disc(8, 2, 1.5, ST, 0.8);
  },
  boiler_bomb(p, f) {
    p.disc(8, 9, 6, f ? 0x5a2a1a : 0x2e2a28);
    p.rect(2, 8, 13, 2, BR);
    p.disc(8, 9, 2.5, ST);
    p.line(8, 9, 9, 7, K);
    p.rect(7, 1, 2, 3, CD);
    p.px(8, 0, f ? GL : GO).px(9, 0, 0xffffff);
    if (f) p.ring(8, 9, 6, GO, 1, 0.8);
  },
  spring_hopper(p, f) {
    const top = f ? 2 : 4;
    p.ellipse(8, top + 3, 5, 3, VG);
    p.ellipse(7, top + 2, 3, 1.5, VL);
    p.px(6, top + 3, EYE).px(10, top + 3, EYE);
    for (let y = top + 6; y < 15; y += 2) p.line(5, y, 11, y + 1, IL);
    p.rect(4, 14, 8, 2, IR);
  },
  gear_spinner(p, f) {
    p.gear(8, 8, 6, 10, CU, CD, 0, f * 0.3);
    p.gear(8, 8, 3, 6, BR, BD, 0, -f * 0.3);
    p.disc(8, 8, 1.5, EYE);
  },
  pipe_worm(p, f) {
    p.ellipse(8, 13, 7, 2.5, 0x2a2420);
    p.rect(4, 3 + f, 8, 10 - f, VD);
    p.rect(5, 3 + f, 6, 10 - f, VG);
    p.rect(3, 6 + f, 10, 2, BR);
    p.ellipse(8, 3 + f, 4, 2.5, K);
    p.px(6, 5 + f, EYE).px(10, 5 + f, EYE);
    p.ring(8, 3 + f, 4, BR, 1);
  },
  brass_sentinel(p, f) {
    p.rect(4, 4, 8, 9, BR);
    p.rect(5, 5, 6, 7, BD);
    p.rect(6, 1, 4, 4, BL);
    p.rect(6, 2, 4, 1, K);
    p.px(7, 2, EYE).px(8, 2, EYE);
    p.rect(4 + f, 13, 2, 3, IR).rect(10 - f, 13, 2, 3, IR);
    p.px(5, 6, BL).px(10, 6, BL);
  },
  coil_wraith(p, f) {
    p.ellipse(8, 11, 4, 4, 0x2c5f6b, 0.8);
    for (let y = 3; y < 11; y += 2) p.line(5, y, 11, y, CU);
    p.rect(7, 2, 2, 10, IR);
    p.disc(8, 2, 2, f ? 0xffffff : PAL.electric);
    p.px(4 - f, 13, PAL.electric).px(12 + f, 12, PAL.electric).px(8, 15, PAL.electric, 0.7);
  },
  tinker_mother(p, f) {
    p.ellipse(8, 8, 5, 4, CU);
    p.ellipse(7, 7, 3, 2, CL);
    p.disc(8, 8, 1.5, EYE);
    const legs = f ? [[1, 4], [15, 4], [1, 13], [15, 13]] : [[2, 3], [14, 3], [2, 14], [14, 14]];
    legs.forEach(([x, y]) => p.line(8, 8, x, y, IL));
    p.rect(6, 11, 4, 2, BR);
  },
  smog_bellows(p, f) {
    for (let i = 0; i < 4; i++) p.rect(3 - (i % 2) * (f ? 1 : 0), 4 + i * 2, 10 + (i % 2) * (f ? 2 : 0), 2, i % 2 ? 0x4a4038 : 0x6b5d50);
    p.rect(2, 3, 12, 2, CU);
    p.rect(2, 12, 12, 2, CU);
    p.rect(7, 0, 2, 3, IR);
    p.px(5, 8, EYE).px(10, 8, EYE);
  },
};

// ---------------------------------------------------------------- bosses (32x32)
const BOSS_DRAW = {
  steam_golem(p, f) {
    p.rect(5, 10, 22, 16, IR);
    p.rect(6, 11, 20, 14, IL);
    p.disc(16, 18, 5, 0x3a1a10);
    p.disc(16, 18, 4, f ? GL : GO);
    for (let x = 12; x <= 20; x += 2) p.line(x, 14, x, 22, 0x5a2a10);
    p.rect(11, 3, 10, 8, IR);
    p.rect(13, 6, 2, 2, EYE).rect(17, 6, 2, 2, EYE);
    p.rect(0, 12, 6, 10, IL).rect(26, 12, 6, 10, IL);
    p.rect(1, 22, 5, 5, IR).rect(26, 22, 5, 5, IR);
    p.rect(7, 26, 6, 5, IR).rect(19, 26, 6, 5, IR);
    p.rect(6, 6, 3, 6, CU).rect(23, 6, 3, 6, CU);
    [[7, 12], [24, 12], [7, 23], [24, 23]].forEach(([x, y]) => p.px(x, y, BL));
    if (f) p.disc(7, 4, 2, ST, 0.8).disc(24, 3, 2, ST, 0.8);
  },
  clocktower(p, f) {
    p.rect(8, 8, 16, 22, CD);
    p.rect(9, 9, 14, 20, CU);
    p.line(16, 0, 6, 8, VG);
    p.line(16, 0, 26, 8, VG);
    for (let y = 1; y < 8; y++) p.line(16 - y * 1.3, y, 16 + y * 1.3, y, VG);
    p.disc(16, 16, 6, 0xe8e0c8);
    p.ring(16, 16, 6, BR, 1);
    const a = f ? 0.8 : 0.2;
    p.line(16, 16, 16 + Math.cos(a - 1.57) * 4, 16 + Math.sin(a - 1.57) * 4, K);
    p.line(16, 16, 16 + Math.cos(a * 3) * 3, 16 + Math.sin(a * 3) * 3, K);
    p.rect(12, 24, 8, 6, 0x2a1a10);
    p.disc(16, 27, 2, EYE);
    p.rect(4, 14, 4, 10, BR).rect(24, 14, 4, 10, BR);
    p.px(10, 10, BL).px(21, 10, BL);
  },
  boiler_beast(p, f) {
    p.ellipse(16, 15, 12, 9, 0x3a3230);
    p.ellipse(15, 13, 9, 6, 0x564a44);
    p.rect(9, 12, 14, 7, 0x2a1810);
    for (let x = 10; x <= 22; x += 3) p.line(x, 12, x, 18, f ? GL : GO);
    p.rect(4 + f, 22, 4, 8, IR).rect(24 - f, 22, 4, 8, IR).rect(10, 23, 4, 7, IR).rect(18, 23, 4, 7, IR);
    p.ellipse(16, 5, 7, 4, 0x564a44);
    p.rect(11, 6, 10, 3, K);
    for (let x = 12; x < 21; x += 2) p.px(x, 6, ST).px(x + 1, 8, ST);
    p.px(12, 3, EYE).px(20, 3, EYE);
    p.rect(22, 3, 3, 5, CU).rect(7, 3, 3, 5, CU);
  },
  tesla_matriarch(p, f) {
    p.line(16, 12, 6, 30, CD);
    p.line(16, 12, 26, 30, CD);
    for (let y = 14; y < 30; y += 3) p.line(16 - (y - 12) * 0.55, y, 16 + (y - 12) * 0.55, y, CU);
    p.rect(12, 8, 8, 10, 0x2c3f4b);
    p.disc(16, 14, 3, f ? 0xffffff : PAL.electric);
    p.disc(16, 6, 4, 0x3a4a55);
    p.px(14, 6, PAL.electric).px(18, 6, PAL.electric);
    for (let i = 0; i < 5; i++) p.rect(10 + i * 3, 0, 1, 3, BR);
    p.line(4, 10, 11, 12, BR);
    p.line(28, 10, 21, 12, BR);
    p.disc(4, 10, 2, f ? PAL.electric : 0xffffff);
    p.disc(28, 10, 2, f ? 0xffffff : PAL.electric);
  },
};

// ---------------------------------------------------------------- generation
export function generateSprites(scene) {
  // Characters (2 walk frames each).
  for (const ch of CHARACTERS) for (let f = 0; f < 2; f++) makeCharacter(scene, ch, f);

  // Player gun.
  let p = new Pix(12, 6);
  p.rect(3, 1, 8, 2, BR).rect(3, 1, 8, 1, BL).rect(10, 1, 2, 2, BD).rect(2, 2, 3, 3, CD).rect(5, 3, 2, 1, BD);
  p.outline(K).toTexture(scene, 'gun');

  // Shadows and co-op rings.
  p = new Pix(14, 6);
  p.ellipse(7, 3, 6.5, 2.5, 0x000000, 0.45).toTexture(scene, 'shadow');
  p = new Pix(28, 10);
  p.ellipse(14, 5, 13.5, 4.5, 0x000000, 0.45).toTexture(scene, 'shadow_big');
  PLAYER_COLORS.forEach((c, i) => {
    const r = new Pix(18, 8);
    r.ellipse(9, 4, 8.5, 3.5, c, 0.9);
    r.ellipse(9, 4, 6.5, 2.2, 0x000000, 0);
    const ctx = r.ctx;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(9, 4, 6.3, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    r.toTexture(scene, `ring_${i}`);
  });

  // Enemies (2 frames).
  for (const e of ENEMIES) {
    for (let f = 0; f < 2; f++) {
      const q = new Pix(16, 16);
      ENEMY_DRAW[e.id](q, f);
      q.outline(K);
      q.toTexture(scene, `en_${e.id}_${f}`);
    }
  }
  p = new Pix(10, 4);
  p.rect(0, 1, 9, 2, IR).rect(7, 0, 3, 4, IL).outline(K).toTexture(scene, 'turret_barrel');
  p = new Pix(16, 8);
  p.ellipse(8, 5, 7, 3, 0x3a2e26).ellipse(8, 4, 5, 2, 0x4e4034).px(5, 3, 0x6b5a48).px(10, 4, 0x6b5a48).outline(K).toTexture(scene, 'mound');
  p = new Pix(6, 16);
  p.rect(1, 1, 4, 14, BR).rect(1, 1, 1, 14, BL).rect(4, 1, 1, 14, BD).px(2, 4, BD).px(2, 11, BD).outline(K).toTexture(scene, 'sentinel_shield');

  // Bosses.
  for (const b of BOSSES) {
    for (let f = 0; f < 2; f++) {
      const q = new Pix(32, 32);
      BOSS_DRAW[b.id](q, f);
      q.outline(K);
      q.toTexture(scene, `boss_${b.id}_${f}`);
    }
  }

  // Player projectiles: small, bright, no outline.
  const shot = (key, outer, inner, r = 3) => {
    const q = new Pix(8, 8);
    q.disc(4, 4, r, outer).disc(4, 4, r - 1.2, inner).px(3, 3, 0xffffff);
    q.toTexture(scene, key);
  };
  shot('shot_brass', 0xffc93c, 0xfff2b0);
  shot('shot_fire', 0xff7a1f, 0xffe08a);
  shot('shot_electric', 0x4fe0ff, 0xe8ffff);
  shot('shot_plasma', 0xc77dff, 0xe8ffff);
  shot('shot_crit', 0xffffff, 0xffe08a, 3.6);
  p = new Pix(6, 6);
  p.line(0, 3, 5, 3, 0xffc93c).line(3, 1, 3, 5, 0xfff2b0).px(3, 3, 0xffffff).toTexture(scene, 'shot_shard');

  // Enemy projectiles: hot magenta ring, pale core, dark outline — never confusable with player shots.
  const eshot = (key, size, ring, core) => {
    const q = new Pix(size, size);
    const c = size / 2;
    q.disc(c, c, c - 1, ring).disc(c, c, c - 2.3, core).px(c - 1.5, c - 1.5, 0xffffff);
    q.outline(0x1a0008);
    q.toTexture(scene, key);
  };
  eshot('eshot', 9, PAL.enemyShot, PAL.enemyShotCore);
  eshot('eshot_big', 14, PAL.enemyShot, PAL.enemyShotCore);
  eshot('eshot_fire', 9, 0xe8203a, 0xffb347);
  eshot('eshot_orb', 11, 0xb03fd9, 0xf0c8ff);
  p = new Pix(12, 12);
  p.disc(6, 6, 5, 0x6b5d50).disc(5, 5, 3, 0x8a7a6a).px(7, 8, 0x4a4038).px(4, 7, 0x4a4038).outline(K).toTexture(scene, 'boulder');
  p = new Pix(10, 10);
  p.disc(5, 6, 3.5, 0x2e2a28).rect(4, 1, 2, 2, CD).px(5, 0, GO).px(4, 5, IL).outline(K).toTexture(scene, 'bomb');

  // Pickups.
  p = new Pix(9, 9);
  p.gear(4.5, 4.5, 3, 6, BR, BD, 1).highlight(BL, 0.7).outline(K).toTexture(scene, 'cog1');
  p = new Pix(12, 12);
  p.gear(6, 6, 4.2, 8, CL, CD, 1.2).highlight(0xffe0b0, 0.8).outline(K).toTexture(scene, 'cog5');
  const heartRows = ['.rr.rr.', 'rWrrrrr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
  p = new Pix(9, 9);
  p.ascii(heartRows, { r: RED, W: 0xffb0b0 }, 1, 1).outline(K).toTexture(scene, 'heart');
  p = new Pix(9, 9);
  p.ascii(heartRows.map((r) => r.slice(0, 4)), { r: RED, W: 0xffb0b0 }, 1, 1).outline(K).toTexture(scene, 'heart_half');
  p = new Pix(18, 12);
  p.ellipse(9, 7, 8, 4, IR).ellipse(9, 6, 7, 3, BR).ellipse(9, 5.5, 5.5, 2, BL).outline(K).toTexture(scene, 'pedestal');

  // Item and consumable icons (see icons.js).
  for (const it of ITEMS) {
    const q = new Pix(14, 14);
    (ITEM_ICON[it.id] || ITEM_ICON._default)(q, it);
    q.outline(K);
    q.toTexture(scene, `item_${it.id}`);
  }
  for (const id of Object.keys(ITEM_ICON)) {
    if (!id.startsWith('cons_')) continue;
    const q = new Pix(12, 12);
    ITEM_ICON[id](q);
    q.outline(K);
    q.toTexture(scene, id);
  }

  generateTiles(scene);
  generateFx(scene);
  generateUi(scene);
  generateTown(scene);
}

// ---------------------------------------------------------------- dungeon tiles
function generateTiles(scene) {
  for (let v = 0; v < 4; v++) {
    const p = new Pix(16, 16);
    const base = [0x2b2622, 0x2e2824, 0x29241f, 0x2d2723][v];
    p.rect(0, 0, 16, 16, base);
    p.rect(0, 0, 16, 1, 0x3a332d).rect(0, 0, 1, 16, 0x3a332d);
    p.rect(0, 15, 16, 1, 0x1c1815).rect(15, 0, 1, 16, 0x1c1815);
    p.px(2, 2, 0x4a4038).px(13, 2, 0x4a4038).px(2, 13, 0x4a4038).px(13, 13, 0x4a4038);
    if (v === 1) p.line(4, 9, 9, 7, 0x221e1a).px(10, 7, 0x221e1a);
    if (v === 2) p.line(3, 12, 12, 12, 0x221e1a).px(12, 11, 0x221e1a).px(4, 4, 0x3a332d);
    if (v === 3) p.disc(9, 9, 2.5, 0x2a3a33, 0.8);
    p.toTexture(scene, `floor_${v}`);
  }
  // Wall bricks
  for (let v = 0; v < 2; v++) {
    const p = new Pix(16, 16);
    p.rect(0, 0, 16, 16, 0x3b2a22);
    for (let y = 0; y < 16; y += 4) {
      p.rect(0, y + 3, 16, 1, 0x1f1612);
      const off = (y / 4) % 2 ? 4 : 0;
      for (let x = off; x < 16; x += 8) p.rect(x, y, 1, 3, 0x1f1612);
      p.rect(0, y, 16, 1, 0x4d382c);
    }
    if (v === 1) p.rect(3, 6, 3, 6, VD, 0.7).px(4, 12, VG).px(4, 13, VD);
    p.toTexture(scene, `wall_${v}`);
  }
  let p = new Pix(16, 16);
  p.rect(0, 0, 16, 16, IR).rect(1, 1, 14, 14, IL).rect(1, 1, 14, 2, 0x7a7168).rect(2, 13, 12, 2, 0x2e2a26);
  p.rect(1, 6, 14, 2, BR).rect(1, 6, 14, 1, BL);
  [[3, 3], [12, 3], [3, 11], [12, 11]].forEach(([x, y]) => p.px(x, y, BL));
  p.outline(K).toTexture(scene, 'block');
  p = new Pix(16, 16);
  p.rect(1, 1, 14, 14, CD).rect(2, 2, 12, 12, CU).line(2, 2, 13, 13, CD).line(13, 2, 2, 13, CD).rect(2, 2, 12, 1, CL);
  p.outline(K).toTexture(scene, 'crate');
  p = new Pix(16, 16);
  p.rect(0, 0, 16, 16, 0x0b0908);
  p.gear(8, 9, 5, 8, 0x1e1a17, 0x141110, 1.5, 0.2).rect(0, 0, 16, 3, 0x050404);
  p.toTexture(scene, 'pit');
  p = new Pix(16, 16);
  p.disc(8, 8, 7, IR).disc(8, 8, 6, 0x1a1512);
  for (let y = 4; y <= 12; y += 2) p.line(4, y, 12, y, IL);
  p.ring(8, 8, 7, 0x6b5d50, 1).toTexture(scene, 'vent');

  // Doors (drawn facing north; the renderer rotates them).
  const door = (key, trim, open, variant) => {
    const q = new Pix(24, 18);
    q.rect(0, 0, 24, 18, trim).rect(2, 2, 20, 16, shade(trim, 0.6));
    q.rect(4, 4, 16, 14, open ? 0x050404 : IR);
    if (!open) {
      for (let x = 6; x < 20; x += 3) q.rect(x, 4, 1, 14, IL);
      q.rect(4, 9, 16, 2, BR);
    }
    if (variant === 'boss') q.px(2, 1, EYE).px(21, 1, EYE).rect(9, 0, 6, 2, 0x7a1a1a);
    if (variant === 'treasure') q.rect(10, 0, 4, 2, BL);
    if (variant === 'shop') q.gear(12, 1.5, 1.5, 5, BL, BD);
    q.rect(0, 0, 24, 1, shade(trim, 1.4));
    q.toTexture(scene, key);
  };
  for (const [v, trim] of [['normal', CD], ['boss', 0x5a1a1a], ['treasure', BR], ['shop', VG], ['challenge', 0x6b2a6b]]) {
    door(`door_${v}_open`, trim, true, v);
    door(`door_${v}_closed`, trim, false, v);
  }
  p = new Pix(16, 16);
  p.rect(0, 0, 16, 16, 0x3b2a22).line(3, 0, 8, 9, 0x120c0a).line(8, 9, 6, 15, 0x120c0a).line(8, 9, 13, 12, 0x120c0a).px(9, 4, 0x120c0a).px(10, 3, 0x120c0a);
  p.toTexture(scene, 'wall_cracked');

  // Hatch
  p = new Pix(20, 20);
  p.disc(10, 10, 9, IR).disc(10, 10, 8, BD).gear(10, 10, 6, 8, BR, BD, 2).outline(K).toTexture(scene, 'hatch');
  p = new Pix(20, 20);
  p.disc(10, 10, 9, BR).disc(10, 10, 7.5, 0x000000).ring(10, 10, 9, BL, 1).toTexture(scene, 'hatch_open');
  // Room features
  p = new Pix(20, 12);
  p.rect(1, 3, 18, 5, CU).rect(1, 3, 18, 1, CL).rect(2, 8, 2, 4, IR).rect(16, 8, 2, 4, IR).rect(1, 0, 18, 2, CD).outline(K).toTexture(scene, 'bench');
  p = new Pix(12, 16);
  p.rect(2, 11, 8, 5, IR).rect(3, 12, 6, 3, IL).line(6, 11, 3, 2, BR).disc(3, 2, 2, EYE).outline(K).toTexture(scene, 'lever');
  p = new Pix(12, 16);
  p.rect(2, 11, 8, 5, IR).rect(3, 12, 6, 3, IL).line(6, 11, 9, 2, BR).disc(9, 2, 2, VG).outline(K).toTexture(scene, 'lever_on');
  // Wall decorations
  p = new Pix(8, 12);
  p.rect(3, 4, 2, 8, IR).rect(1, 0, 6, 5, BR).rect(2, 1, 4, 3, GL).outline(K).toTexture(scene, 'lamp_wall');
  p = new Pix(16, 6);
  p.rect(0, 1, 16, 4, CU).rect(0, 1, 16, 1, CL).rect(4, 0, 2, 6, CD).rect(11, 0, 2, 6, CD).toTexture(scene, 'pipe_h');
  p = new Pix(6, 16);
  p.rect(1, 0, 4, 16, CU).rect(1, 0, 1, 16, CL).rect(0, 5, 6, 2, CD).toTexture(scene, 'pipe_v');
  p = new Pix(12, 12);
  p.disc(6, 6, 5, 0xe8e0c8).ring(6, 6, 5, BR, 1).line(6, 6, 6, 3, K).line(6, 6, 8, 7, EYE).outline(K).toTexture(scene, 'gauge');
}

// ---------------------------------------------------------------- fx textures
function generateFx(scene) {
  let p = new Pix(2, 2);
  p.rect(0, 0, 2, 2, 0xffffff).toTexture(scene, 'px');
  p = new Pix(1, 1);
  p.rect(0, 0, 1, 1, 0xffffff).toTexture(scene, 'px1');
  p = new Pix(10, 10);
  for (let r = 5; r > 0; r--) p.disc(5, 5, r, 0xffffff, 0.18 + (5 - r) * 0.12);
  p.toTexture(scene, 'puff');
  p = new Pix(5, 5);
  p.line(0, 2, 4, 2, 0xffffff).line(2, 0, 2, 4, 0xffffff).toTexture(scene, 'spark');
  p = new Pix(12, 12);
  p.disc(6, 6, 6, 0xffffff, 0.3).disc(6, 6, 4, 0xffffff, 0.6).disc(6, 6, 2.5, 0xffffff).toTexture(scene, 'flash');
  p = new Pix(10, 10);
  p.line(0, 5, 9, 5, 0xffffff).line(5, 0, 5, 9, 0xffffff).line(2, 2, 8, 8, 0xffe08a).line(8, 2, 2, 8, 0xffe08a).disc(5, 5, 2, 0xffffff).toTexture(scene, 'muzzle');
  p = new Pix(5, 5);
  p.gear(2.5, 2.5, 1.5, 4, 0xffffff, 0xcccccc).toTexture(scene, 'gearbit');
  p = new Pix(32, 32);
  p.ring(16, 16, 15.5, 0xffffff, 2).toTexture(scene, 'ringfx');
  // Soft radial light for lamps / blackout mask.
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  if (scene.textures.exists('glow')) scene.textures.remove('glow');
  scene.textures.addCanvas('glow', c);
  p = new Pix(16, 16);
  p.ring(8, 8, 7, 0xffffff, 1).line(8, 0, 8, 4, 0xffffff).line(8, 12, 8, 16, 0xffffff).line(0, 8, 4, 8, 0xffffff).line(12, 8, 16, 8, 0xffffff).toTexture(scene, 'pingfx');
  p = new Pix(16, 16);
  p.ring(8, 8, 8, 0xffffff, 1).toTexture(scene, 'circle16');
}

// ---------------------------------------------------------------- UI
function generateUi(scene) {
  const heartRows = ['.rr.rr.', 'rWrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
  let p = new Pix(9, 8);
  p.ascii(heartRows, { r: RED, W: 0xffb0b0 }, 1, 1).outline(K).toTexture(scene, 'ui_heart');
  p = new Pix(9, 8);
  p.ascii(heartRows, { r: 0x3a2a2a, W: 0x3a2a2a }, 1, 1).ascii(heartRows.map((r) => r.slice(0, 4)), { r: RED, W: 0xffb0b0 }, 1, 1).outline(K).toTexture(scene, 'ui_heart_half');
  p = new Pix(9, 8);
  p.ascii(heartRows, { r: 0x3a2a2a, W: 0x4a3a3a }, 1, 1).outline(K).toTexture(scene, 'ui_heart_empty');
  p = new Pix(9, 9);
  p.gear(4.5, 4.5, 3, 6, BR, BD, 1).highlight(BL, 0.7).outline(K).toTexture(scene, 'ui_cog');
  p = new Pix(6, 6);
  p.disc(3, 3, 2.5, 0x6ff0ff).outline(K).toTexture(scene, 'ui_dash');
  p = new Pix(6, 6);
  p.disc(3, 3, 2.5, 0x2a3a40).outline(K).toTexture(scene, 'ui_dash_e');
  p = new Pix(10, 10);
  p.gear(5, 5, 3.5, 6, IL, IR, 1).outline(K).toTexture(scene, 'ui_floor');
}

// ---------------------------------------------------------------- town
function generateTown(scene) {
  for (let v = 0; v < 3; v++) {
    const p = new Pix(16, 16);
    const base = [0x5a4a3e, 0x564638, 0x5e4c3f][v];
    p.rect(0, 0, 16, 16, 0x3a2e26);
    const stones = [[1, 1, 6, 6], [8, 1, 7, 5], [1, 8, 5, 7], [7, 7, 8, 4], [7, 12, 8, 3]];
    stones.forEach(([x, y, w, h], i) => {
      p.rect(x, y, w, h, shade(base, 0.9 + ((i + v) % 3) * 0.08));
      p.rect(x, y, w, 1, shade(base, 1.25));
    });
    p.toTexture(scene, `cobble_${v}`);
  }
  // Buildings: brick facades with copper roofs, gaslit windows and a shop sign.
  const building = (key, wall, roof, sign) => {
    const w = 96;
    const h = 80;
    const q = new Pix(w, h);
    q.rect(6, 26, w - 12, h - 26, wall);
    for (let y = 30; y < h; y += 5) q.rect(6, y, w - 12, 1, shade(wall, 0.75));
    for (let x = 0; x < 4; x++) {
      const yy = 26 - x * 0;
      void yy;
    }
    // Roof
    for (let y = 0; y < 22; y++) q.rect(2 + (22 - y) * 0.3, y + 6, w - 4 - (22 - y) * 0.6, 1, y % 4 === 0 ? shade(roof, 0.8) : roof);
    q.rect(0, 26, w, 3, shade(roof, 0.6));
    // Chimney
    q.rect(w - 22, 0, 8, 14, 0x4a3a30).rect(w - 23, 0, 10, 2, 0x2a1e18);
    // Windows
    for (const wx of [14, w - 30]) {
      q.rect(wx, 36, 16, 14, 0x2a1810).rect(wx + 1, 37, 14, 12, GO).rect(wx + 1, 37, 14, 4, GL).rect(wx + 7, 37, 2, 12, 0x2a1810).rect(wx + 1, 42, 14, 1, 0x2a1810);
    }
    // Door
    q.rect(w / 2 - 9, 50, 18, 30, 0x2a1810).rect(w / 2 - 8, 51, 16, 29, CD).rect(w / 2 - 8, 51, 16, 2, CL).disc(w / 2 + 4, 66, 1.2, BL);
    // Sign board
    q.rect(w / 2 - 20, 30, 40, 12, 0x2a1810).rect(w / 2 - 19, 31, 38, 10, BD).rect(w / 2 - 19, 31, 38, 1, BL);
    sign(q, w / 2, 36);
    q.outline(K);
    q.toTexture(scene, key);
  };
  building('bld_tinkerer', 0x6e3a2a, VG, (q, x, y) => q.gear(x, y, 3, 6, BL, BD, 1));
  building('bld_gunsmith', 0x5a3030, 0x4a4a52, (q, x, y) => q.rect(x - 8, y - 1, 12, 3, IL).rect(x - 6, y + 1, 3, 3, CD));
  building('bld_alchemist', 0x3e4a3a, 0x5a3a6b, (q, x, y) => q.disc(x, y + 1, 3, 0x8fd14f).rect(x - 1, y - 4, 2, 3, ST));
  building('bld_clockmaker', 0x4a3a2a, CU, (q, x, y) => q.disc(x, y, 4, 0xe8e0c8).line(x, y, x, y - 3, K).line(x, y, x + 2, y, K));

  // The Undercrank gate: a ring of great gears around a hissing shaft.
  let p = new Pix(96, 96);
  p.disc(48, 48, 44, IR);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.gear(48 + Math.cos(a) * 38, 48 + Math.sin(a) * 38, 8, 8, i % 2 ? BR : CU, i % 2 ? BD : CD, 2, i * 0.4);
  }
  p.disc(48, 48, 30, 0x1a1512);
  p.disc(48, 48, 26, 0x0a0706);
  p.disc(48, 48, 18, 0x050303);
  for (let r = 26; r > 16; r -= 3) p.ring(48, 48, r, 0x2a1d17, 1, 0.7);
  p.ring(48, 48, 30, BL, 1);
  p.ring(48, 48, 44, BD, 2);
  p.outline(K).toTexture(scene, 'gate');

  p = new Pix(10, 28);
  p.rect(4, 8, 2, 20, 0x2a2420).rect(2, 26, 6, 2, 0x2a2420).rect(1, 0, 8, 9, BR).rect(2, 1, 6, 7, GL).rect(3, 2, 4, 5, 0xfff2c0).rect(0, 0, 10, 1, BD);
  p.outline(K).toTexture(scene, 'lamp');

  const npc = (key, coat, hat, extra) => {
    const q = new Pix(16, 16);
    const pal = { h: hat, s: 0xe8b48a, S: 0xb57e5a, x: coat, X: shade(coat, 0.65), b: BL, d: IR, k: 0x1e1a17, n: BD, B: 0x9fe8ff, w: 0xd9d2c3 };
    q.ascii(extra, pal, 0, 0);
    q.ascii(BODY_A, pal, 0, 8);
    q.outline(K);
    q.toTexture(scene, key);
  };
  npc('npc_tinkerer', 0x4fc3d9, 0x3a2a1a, HEADS.tinker);
  npc('npc_gunsmith', 0x7a3a2a, 0x2a1d17, HEADS.stoker);
  npc('npc_alchemist', 0x5a3a6b, 0x3a2a4a, ['................', '......hhhh......', '.....hhhhhh.....', '....hhhhhhhh....', '.....ssssss.....', '.....sBssBs.....', '......ssss......', '......hhhh......']);
  npc('npc_clockmaker', 0x8a6a3a, 0xd9d2c3, HEADS.artificer);
  npc('npc_shopkeeper', 0x3fa38a, 0x2a1d17, HEADS.tinker);
  const townies = [0x7a5a3a, 0x3a5a7a, 0x6a3a5a, 0x4a6a3a, 0x8a4a2a];
  townies.forEach((c, i) => {
    for (let f = 0; f < 2; f++) {
      const q = new Pix(16, 16);
      const pal = { h: [0x2a1d17, 0x5a4030, 0x1a1a1a, 0x7a6a50, 0x3a2a2a][i], s: [0xe8b48a, 0xc08a60, 0x8a5a3a, 0xf0c8a0, 0xd8a070][i], S: 0xa06a4a, x: c, X: shade(c, 0.65), b: BL, d: IR, k: 0x1e1a17, n: BD, B: 0xaaaaaa, w: 0xd9d2c3, r: 0x9a5a3a, p: 0x3a2745, E: 0xff5a8a };
      q.ascii(Object.values(HEADS)[i % 4], pal, 0, 0);
      q.ascii(f ? BODY_B : BODY_A, pal, 0, 8);
      q.outline(K);
      q.toTexture(scene, `townie_${i}_${f}`);
    }
  });
  // Props
  p = new Pix(14, 16);
  p.rect(2, 2, 10, 13, CD).rect(1, 4, 12, 2, IR).rect(1, 11, 12, 2, IR).rect(3, 2, 2, 13, CU).outline(K).toTexture(scene, 'barrel');
  p = new Pix(32, 24);
  p.ellipse(16, 16, 15, 7, IR).ellipse(16, 15, 13, 5.5, 0x2c5f6b).ellipse(16, 14, 11, 4, 0x3f8fa0).rect(14, 2, 4, 12, BR).disc(16, 3, 3, BL).outline(K).toTexture(scene, 'fountain');
  p = new Pix(24, 12);
  p.rect(0, 2, 24, 8, CU).rect(0, 2, 24, 2, CL).rect(5, 0, 3, 12, CD).rect(16, 0, 3, 12, CD).outline(K).toTexture(scene, 'bigpipe');
}
