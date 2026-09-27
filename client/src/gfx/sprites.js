// PROCEDURAL SPRITES
// Every texture in the game is authored in code and registered with Phaser. World art is
// drawn at 2x density (see state.js ART): characters 32x64, enemies 32-40px, bosses 80px,
// tiles 32px. Most props use Pix with k=2 (logical coordinates, real-resolution shapes).
// FX textures stay at 1x and are drawn unscaled. Palette: brass, copper, verdigris, soot
// black and warm gaslight orange.
import { Pix, shade, mix } from './pix.js';
import { PAL, PLAYER_COLORS, CHARACTERS, ITEMS, ENEMIES, BOSSES, hashString } from '@undercrank/shared';
import { ITEM_ICON } from './icons.js';
import { registerCharacter, CHARACTER_SPECS, NPC_SPECS, townieSpec } from './chars.js';
import { generateEnemyArt } from './enemyArt.js';

export { shade, mix };
export const TOWNIE_COUNT = 8;

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

// ---------------------------------------------------------------- generation
export function generateSprites(scene) {
  // Characters, shopkeepers and townsfolk (paper-doll generator, 32x64).
  for (const ch of CHARACTERS) registerCharacter(scene, `pl_${ch.id}`, CHARACTER_SPECS[ch.id] || CHARACTER_SPECS.tinker);
  for (const [id, spec] of Object.entries(NPC_SPECS)) registerCharacter(scene, `npc_${id}`, spec);
  for (let i = 0; i < TOWNIE_COUNT; i++) registerCharacter(scene, `townie_${i}`, townieSpec(i));

  // Player gun: a brass repeater (24x12 real).
  let p = new Pix(24, 12);
  p.part((t) => t.rect(6, 3, 15, 4), BR, { light: BL });
  p.part((t) => t.rect(18, 2, 5, 6), BD, { light: BR });
  p.part((t) => t.poly([[3, 5], [9, 5], [8, 11], [3, 11]]), CD, { light: CU });
  p.part((t) => t.disc(12, 5, 2.4), CU, { light: CL });
  p.rect(22, 4, 2, 2, K);
  p.outline(K).toTexture(scene, 'gun');

  // Shadows and co-op rings (k=2).
  p = new Pix(14, 6, 2);
  p.ellipse(7, 3, 6.5, 2.5, 0x000000, 0.45).toTexture(scene, 'shadow');
  p = new Pix(40, 12, 2);
  p.ellipse(20, 6, 19, 5.5, 0x000000, 0.45).toTexture(scene, 'shadow_big');
  PLAYER_COLORS.forEach((c, i) => {
    const r = new Pix(18, 8, 2);
    r.fillWhere(0, 0, 18, 8, (x, y) => {
      const d = ((x - 9) / 8.5) ** 2 + ((y - 4) / 3.5) ** 2;
      return d <= 1 && d > 0.55;
    }, c, 0.9);
    r.toTexture(scene, `ring_${i}`);
  });

  generateEnemyArt(scene, ENEMIES, BOSSES);
  generateProjectiles(scene);
  generatePickups(scene);
  generateTiles(scene);
  generateFx(scene);
  generateUi(scene);
  generateTown(scene);
}

// ---------------------------------------------------------------- projectiles (k=2)
function generateProjectiles(scene) {
  // Player shots: small, bright, no outline.
  const shot = (key, outer, inner, r = 3) => {
    const q = new Pix(8, 8, 2);
    q.disc(4, 4, r, outer).disc(4, 4, r - 1.2, inner).disc(3.3, 3.3, 0.7, 0xffffff);
    q.toTexture(scene, key);
  };
  shot('shot_brass', 0xffc93c, 0xfff2b0);
  shot('shot_fire', 0xff7a1f, 0xffe08a);
  shot('shot_electric', 0x4fe0ff, 0xe8ffff);
  shot('shot_plasma', 0xc77dff, 0xe8ffff);
  shot('shot_crit', 0xffffff, 0xffe08a, 3.6);
  let p = new Pix(6, 6, 2);
  p.poly([[0, 3], [3, 1.5], [6, 3], [3, 4.5]], 0xffc93c).line(1, 3, 5, 3, 0xfff2b0).toTexture(scene, 'shot_shard');

  // Enemy shots: hot magenta ring, pale core, dark outline — never confusable with player shots.
  const eshot = (key, size, ring, core) => {
    const q = new Pix(size, size, 2);
    const c = size / 2;
    q.disc(c, c, c - 1, ring).disc(c, c, Math.max(1.2, (c - 1) * 0.5), core).disc(c - 1, c - 1, 0.6, 0xffffff);
    q.outline(0x1a0008);
    q.outline(0x1a0008);
    q.toTexture(scene, key);
  };
  eshot('eshot', 8, PAL.enemyShot, PAL.enemyShotCore);
  eshot('eshot_big', 14, PAL.enemyShot, PAL.enemyShotCore);
  eshot('eshot_fire', 9, 0xe8203a, 0xffb347);
  eshot('eshot_orb', 11, 0xb03fd9, 0xf0c8ff);
  p = new Pix(12, 12, 2);
  p.part((t) => t.poly([[2, 4], [5, 1], [9, 2], [11, 6], [9, 10], [4, 11], [1, 8]]), 0x6b5d50, { light: 0x9a8a78 });
  p.disc(7, 7, 1, 0x4a4038).disc(4, 5, 0.7, 0x4a4038).outline(K).toTexture(scene, 'boulder');
  p = new Pix(10, 10, 2);
  p.part((t) => t.disc(5, 6, 3.5), 0x2e2a28, { light: 0x5a504a });
  p.rect(4, 1, 2, 2, CD).disc(5, 0.8, 0.8, GO).rect(2.5, 5.5, 5, 1, BR).outline(K).toTexture(scene, 'bomb');
}

// ---------------------------------------------------------------- pickups (k=2)
function heartShape(t) {
  t.disc(2.8, 3, 2.3).disc(6.2, 3, 2.3).poly([[0.6, 3.6], [8.4, 3.6], [4.5, 8]]);
}

function generatePickups(scene) {
  let p = new Pix(9, 9, 2);
  p.gear(4.5, 4.5, 3, 7, BR, BD, 1).highlight(BL, 0.7).outline(K).toTexture(scene, 'cog1');
  p = new Pix(12, 12, 2);
  p.gear(6, 6, 4.2, 9, CL, CD, 1.3).highlight(0xffe0b0, 0.8).outline(K).toTexture(scene, 'cog5');
  p = new Pix(9, 9, 2);
  p.part(heartShape, RED, { light: 0xff8080 }).disc(2.6, 2.6, 0.8, 0xffd0d0).outline(K).toTexture(scene, 'heart');
  p = new Pix(9, 9, 2);
  p.part((t) => {
    heartShape(t);
    t.clearRect(4.5, 0, 5, 9);
  }, RED, { light: 0xff8080 }).outline(K).toTexture(scene, 'heart_half');
  p = new Pix(18, 12, 2);
  p.part((t) => t.ellipse(9, 7, 8, 4), IR, { light: IL });
  p.part((t) => t.ellipse(9, 6, 7, 3), BR, { light: BL });
  p.ellipse(9, 5.6, 5, 1.8, BL).outline(K).toTexture(scene, 'pedestal');

  // Item and consumable icons (see icons.js), drawn at 2x density.
  for (const it of ITEMS) {
    const q = new Pix(14, 14, 2);
    (ITEM_ICON[it.id] || ITEM_ICON._default)(q, it);
    q.outline(K);
    q.toTexture(scene, `item_${it.id}`);
  }
  for (const id of Object.keys(ITEM_ICON)) {
    if (!id.startsWith('cons_')) continue;
    const q = new Pix(12, 12, 2);
    ITEM_ICON[id](q);
    q.outline(K);
    q.toTexture(scene, id);
  }
}

// ---------------------------------------------------------------- dungeon tiles (32px)
function rng(seed) {
  let s = hashString(seed) || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function plate(p, base) {
  p.rect(0, 0, 32, 32, base);
  p.rect(0, 0, 32, 1, shade(base, 1.35)).rect(0, 0, 1, 32, shade(base, 1.25));
  p.rect(0, 31, 32, 1, shade(base, 0.6)).rect(31, 0, 1, 32, shade(base, 0.65));
  p.rect(1, 1, 30, 1, shade(base, 1.12));
  for (const [x, y] of [[3, 3], [27, 3], [3, 27], [27, 27]]) {
    p.rect(x, y, 2, 2, shade(base, 1.6)).rp(x + 1, y + 1, shade(base, 0.7)).rp(x + 2, y + 2, shade(base, 0.7));
  }
}

function generateTiles(scene) {
  const floors = [0x2e2824, 0x2b2622, 0x302a25, 0x2c2723];
  for (let v = 0; v < 4; v++) {
    const p = new Pix(32, 32);
    plate(p, floors[v]);
    const r = rng(`floor${v}`);
    if (v === 1) {
      // Hairline crack
      let x = 8;
      let y = 12;
      for (let i = 0; i < 12; i++) {
        p.rp(x, y, 0x1a1512);
        x += 1;
        y += r() < 0.5 ? 1 : 0;
      }
      p.rp(x, y - 1, 0x1a1512).rp(x + 1, y - 2, 0x1a1512);
    }
    if (v === 2) {
      // Drain grate
      p.rect(9, 9, 14, 14, 0x1e1a17);
      for (let i = 11; i < 22; i += 3) p.rect(i, 10, 1, 12, 0x3a332d);
      p.rect(9, 9, 14, 1, 0x3a332d).rect(9, 22, 14, 1, 0x4a4038);
    }
    if (v === 3) {
      // Verdigris stain + brass inlay seam
      // Faint verdigris stain
      p.ellipse(18, 19, 7, 4, VD, 0.3).ellipse(16, 18, 3.5, 2, VG, 0.18);
    }
    p.grain(`floorgrain${v}`.length * 7919 + v, 0.18, 0.1);
    p.toTexture(scene, `floor_${v}`);
  }

  // Walls: brick courses with individually tinted bricks and mortar.
  for (let v = 0; v < 2; v++) {
    const p = new Pix(32, 32);
    p.rect(0, 0, 32, 32, 0x1f1612);
    const r = rng(`wall${v}`);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 8 : 0;
      for (let bx = -1; bx < 3; bx++) {
        const x = bx * 16 + off;
        const tint = [0x4a3428, 0x543a2c, 0x42302a, 0x5a3e2e][Math.floor(r() * 4)];
        p.rect(x + 1, row * 8 + 1, 14, 6, tint);
        p.rect(x + 1, row * 8 + 1, 14, 1, shade(tint, 1.3));
        p.rect(x + 1, row * 8 + 6, 14, 1, shade(tint, 0.75));
      }
    }
    if (v === 1) {
      p.rect(9, 6, 4, 14, VD, 0.8).rect(10, 20, 2, 6, VG, 0.7).rp(10, 27, VG).rp(11, 29, VD);
    }
    p.grain(1234 + v, 0.15, 0.1);
    p.toTexture(scene, `wall_${v}`);
  }

  // Machinery block
  let p = new Pix(32, 32);
  p.part((t) => t.rect(1, 1, 30, 30), 0x4a433c, { light: 0x7a7168, dark: 0x2a2622 });
  p.rect(3, 12, 26, 4, BR).rect(3, 12, 26, 1, BL).rect(3, 15, 26, 1, BD);
  for (const [x, y] of [[4, 4], [26, 4], [4, 26], [26, 26]]) p.rect(x, y, 2, 2, BL);
  p.disc(21.5, 23.5, 4, 0xe8e0c8).ring(21.5, 23.5, 4, BD, 1).line(21, 23, 22, 21, RED);
  p.rect(5, 19, 8, 8, 0x2a2622);
  for (let y = 20; y < 27; y += 2) p.rect(6, y, 6, 1, 0x4a433c);
  p.outline(K).toTexture(scene, 'block');
  p = new Pix(32, 32);
  p.part((t) => t.rect(2, 2, 28, 28), 0x7a4a2a, { light: 0x9a6a42, dark: 0x4a2a18 });
  for (let x = 2; x < 30; x += 7) p.rect(x, 3, 1, 26, 0x4a2a18);
  p.part((t) => t.rect(2, 2, 28, 4).rect(2, 26, 28, 4), CU, { light: CL });
  for (const x of [5, 15, 25]) p.rp(x, 3, BL).rp(x, 27, BL);
  p.outline(K).toTexture(scene, 'crate');
  p = new Pix(32, 32);
  p.rect(0, 0, 32, 32, 0x080605);
  p.gear(16, 18, 10, 10, 0x1a1512, 0x100d0b, 3, 0.3);
  p.rect(0, 0, 32, 6, 0x030202);
  p.grain(77, 0.1, 0.3);
  p.toTexture(scene, 'pit');
  p = new Pix(16, 16, 2);
  p.disc(8, 8, 7, IR).disc(8, 8, 6, 0x1a1512);
  for (let y = 4; y <= 12; y += 2) p.line(3.5, y, 12.5, y, IL);
  p.ring(8, 8, 7, 0x6b5d50, 1).toTexture(scene, 'vent');

  // Doors (drawn facing north; the renderer rotates them). 24x18 logical at k=2.
  const door = (key, trim, open, variant) => {
    const q = new Pix(24, 18, 2);
    q.part((t) => t.rect(0, 0, 24, 18), trim);
    q.rect(2, 2, 20, 16, shade(trim, 0.55));
    q.rect(4, 4, 16, 14, open ? 0x050404 : IR);
    if (open) q.rect(4, 4, 16, 3, 0x1a1512);
    else {
      for (let x = 6; x < 20; x += 3) q.part((t) => t.rect(x, 4, 1.5, 14), IL);
      q.part((t) => t.rect(4, 9, 16, 2.5), BR, { light: BL });
    }
    q.gear(12, 1.8, 1.6, 6, shade(trim, 1.5), shade(trim, 0.7));
    if (variant === 'boss') q.disc(3, 2, 1.2, 0xff3b3b).disc(21, 2, 1.2, 0xff3b3b).rect(8, 0, 8, 1.5, 0x7a1a1a);
    if (variant === 'treasure') q.rect(9, 0, 6, 1.5, BL);
    if (variant === 'shop') q.disc(4, 2, 1, VL).disc(20, 2, 1, VL);
    if (variant === 'challenge') q.disc(4, 2, 1, 0xe0588a).disc(20, 2, 1, 0xe0588a);
    q.toTexture(scene, key);
  };
  for (const [v, trim] of [['normal', CD], ['boss', 0x5a1a1a], ['treasure', BR], ['shop', VG], ['challenge', 0x6b2a6b]]) {
    door(`door_${v}_open`, trim, true, v);
    door(`door_${v}_closed`, trim, false, v);
  }
  p = makeWallCopy(scene);
  p.line(6, 0, 16, 18, 0x0a0605, 1, 2).line(16, 18, 12, 31, 0x0a0605, 1, 2).line(16, 18, 26, 24, 0x0a0605, 1, 2).line(10, 9, 5, 12, 0x0a0605);
  p.toTexture(scene, 'wall_cracked');

  // Hatch
  p = new Pix(20, 20, 2);
  p.disc(10, 10, 9, IR).disc(10, 10, 8, BD).gear(10, 10, 6, 8, BR, BD, 2).outline(K).toTexture(scene, 'hatch');
  p = new Pix(20, 20, 2);
  p.disc(10, 10, 9.5, BR).disc(10, 10, 8, 0x000000).ring(10, 10, 9.5, BL, 0.8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.disc(10 + Math.cos(a) * 8.7, 10 + Math.sin(a) * 8.7, 0.7, BD);
  }
  p.toTexture(scene, 'hatch_open');
  // Room features
  p = new Pix(20, 12, 2);
  p.part((t) => t.rect(1, 3, 18, 5), CU, { light: CL });
  p.part((t) => t.rect(2, 8, 2, 4).rect(16, 8, 2, 4), IR).part((t) => t.rect(1, 0, 18, 2.5), CD, { light: CU });
  p.outline(K).toTexture(scene, 'bench');
  for (const [key, tip, col] of [['lever', 3, 0xff3b3b], ['lever_on', 9, VG]]) {
    p = new Pix(12, 16, 2);
    p.part((t) => t.rect(2, 11, 8, 5), IR, { light: IL });
    p.line(6, 11, tip, 2, BR, 1, 1.2);
    p.part((t) => t.disc(tip, 2, 2), col);
    p.outline(K).toTexture(scene, key);
  }
  // Wall decorations
  p = new Pix(8, 12, 2);
  p.rect(3, 4, 2, 8, IR).part((t) => t.rect(1, 0, 6, 5), BR, { light: BL }).rect(2, 1, 4, 3, GL).rect(3, 1.5, 2, 2, 0xfff2c0);
  p.outline(K).toTexture(scene, 'lamp_wall');
  p = new Pix(16, 6, 2);
  p.part((t) => t.rect(0, 1, 16, 4), CU, { light: CL });
  p.part((t) => t.rect(4, 0, 2, 6).rect(11, 0, 2, 6), CD, { light: CU }).toTexture(scene, 'pipe_h');
  p = new Pix(6, 16, 2);
  p.part((t) => t.rect(1, 0, 4, 16), CU, { light: CL }).part((t) => t.rect(0, 5, 6, 2), CD, { light: CU }).toTexture(scene, 'pipe_v');
  p = new Pix(12, 12, 2);
  p.disc(6, 6, 5, 0xe8e0c8).ring(6, 6, 5, BR, 1).line(6, 6, 6, 3, K).line(6, 6, 8, 7, 0xff3b3b).outline(K).toTexture(scene, 'gauge');
}

function makeWallCopy(scene) {
  const src = scene.textures.get('wall_0').getSourceImage();
  const p = new Pix(32, 32);
  p.ctx.drawImage(src, 0, 0);
  return p;
}

// ---------------------------------------------------------------- fx textures (1x, unscaled)
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
  p = new Pix(10, 10, 2);
  p.line(0, 5, 9, 5, 0xffffff).line(5, 0, 5, 9, 0xffffff).line(2, 2, 8, 8, 0xffe08a).line(8, 2, 2, 8, 0xffe08a).disc(5, 5, 2, 0xffffff).toTexture(scene, 'muzzle');
  p = new Pix(5, 5, 2);
  p.gear(2.5, 2.5, 1.5, 5, 0xffffff, 0xcccccc).toTexture(scene, 'gearbit');
  p = new Pix(32, 32, 2);
  p.ring(16, 16, 15.5, 0xffffff, 1.5).toTexture(scene, 'ringfx');
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
  p = new Pix(16, 16, 2);
  p.ring(8, 8, 7, 0xffffff, 1).line(8, 0, 8, 4, 0xffffff).line(8, 12, 8, 16, 0xffffff).line(0, 8, 4, 8, 0xffffff).line(12, 8, 16, 8, 0xffffff).toTexture(scene, 'pingfx');
  p = new Pix(16, 16, 2);
  p.ring(8, 8, 8, 0xffffff, 0.8).toTexture(scene, 'circle16');
}

// ---------------------------------------------------------------- UI (k=2, drawn at ART scale)
function generateUi(scene) {
  let p = new Pix(9, 8, 2);
  p.part((t) => heartShape(t), RED, { light: 0xff8080 }).disc(2.6, 2.6, 0.8, 0xffd0d0).outline(K).toTexture(scene, 'ui_heart');
  p = new Pix(9, 8, 2);
  p.part((t) => heartShape(t), 0x3a2a2a, { flat: true });
  p.part((t) => {
    heartShape(t);
    t.clearRect(4.5, 0, 5, 9);
  }, RED, { light: 0xff8080 });
  p.outline(K).toTexture(scene, 'ui_heart_half');
  p = new Pix(9, 8, 2);
  p.part((t) => heartShape(t), 0x3a2a2a, { light: 0x4a3a3a }).outline(K).toTexture(scene, 'ui_heart_empty');
  p = new Pix(9, 9, 2);
  p.gear(4.5, 4.5, 3, 7, BR, BD, 1).highlight(BL, 0.7).outline(K).toTexture(scene, 'ui_cog');
  p = new Pix(6, 6, 2);
  p.part((t) => t.disc(3, 3, 2.5), 0x6ff0ff, { light: 0xe0ffff }).outline(K).toTexture(scene, 'ui_dash');
  p = new Pix(6, 6, 2);
  p.disc(3, 3, 2.5, 0x2a3a40).outline(K).toTexture(scene, 'ui_dash_e');
  p = new Pix(10, 10, 2);
  p.gear(5, 5, 3.5, 7, IL, IR, 1).outline(K).toTexture(scene, 'ui_floor');
}

// ---------------------------------------------------------------- town (k=2)
function generateTown(scene) {
  for (let v = 0; v < 3; v++) {
    const p = new Pix(16, 16, 2);
    const base = [0x5a4a3e, 0x564638, 0x5e4c3f][v];
    p.rect(0, 0, 16, 16, 0x3a2e26);
    const stones = [[0.5, 0.5, 6.5, 6.5], [7.5, 0.5, 8, 5.5], [0.5, 7.5, 5.5, 8], [6.5, 6.5, 9, 4.5], [6.5, 11.5, 9, 4]];
    stones.forEach(([x, y, w, h], i) => {
      p.part((t) => t.rect(x, y, w, h), shade(base, 0.92 + ((i + v) % 3) * 0.07), { deep: 1 });
    });
    p.grain(900 + v, 0.12, 0.08);
    p.toTexture(scene, `cobble_${v}`);
  }
  // Buildings: brick facades with copper roofs, gaslit windows and a shop sign.
  const building = (key, wall, roof, sign) => {
    const w = 96;
    const h = 80;
    const q = new Pix(w, h, 2);
    q.part((t) => t.rect(6, 26, w - 12, h - 26), wall, { deep: 1 });
    for (let y = 28; y < h; y += 4) {
      q.rect(6, y, w - 12, 0.5, shade(wall, 0.7));
      const off = (y / 4) % 2 ? 3 : 0;
      for (let x = 6 + off; x < w - 6; x += 6) q.rect(x, y - 3.5, 0.5, 3.5, shade(wall, 0.72));
    }
    // Roof tiles
    for (let y = 0; y < 22; y++) q.rect(2 + (22 - y) * 0.3, y + 6, w - 4 - (22 - y) * 0.6, 1, y % 3 === 0 ? shade(roof, 0.75) : y % 3 === 1 ? shade(roof, 1.15) : roof);
    q.rect(0, 26, w, 3, shade(roof, 0.55));
    // Chimney
    q.part((t) => t.rect(w - 22, 0, 8, 14), 0x4a3a30).rect(w - 23, 0, 10, 2, 0x2a1e18);
    // Windows with gaslight glow and mullions
    for (const wx of [12, w - 30]) {
      q.rect(wx, 35, 18, 16, 0x2a1810);
      q.rect(wx + 1, 36, 16, 14, GO).rect(wx + 1, 36, 16, 5, GL).rect(wx + 2, 37, 5, 3, 0xfff2c0);
      q.rect(wx + 8, 36, 1.5, 14, 0x2a1810).rect(wx + 1, 42, 16, 1.5, 0x2a1810);
      q.part((t) => t.rect(wx - 1, 50, 20, 2.5), shade(wall, 1.3));
      q.part((t) => t.rect(wx + 1, 52.5, 16, 3), 0x5a3a24).rect(wx + 3, 51.5, 3, 2, 0xe0588a).rect(wx + 11, 51.5, 3, 2, 0x8fd14f);
    }
    // Door
    q.rect(w / 2 - 9, 50, 18, 30, 0x2a1810);
    q.part((t) => t.rect(w / 2 - 8, 51, 16, 29).disc(w / 2, 51, 8), CD, { light: CU });
    q.rect(w / 2 - 0.5, 52, 1, 27, shade(CD, 0.7)).disc(w / 2 + 4, 66, 1.2, BL);
    // Sign board
    q.part((t) => t.rect(w / 2 - 20, 29, 40, 13), BD, { light: BL });
    q.rect(w / 2 - 18, 31, 36, 9, 0x2a1810);
    sign(q, w / 2, 35.5);
    q.outline(K);
    q.toTexture(scene, key);
  };
  building('bld_tinkerer', 0x6e3a2a, VG, (q, x, y) => q.gear(x, y, 3, 7, BL, BD, 1));
  building('bld_gunsmith', 0x5a3030, 0x4a4a52, (q, x, y) => q.rect(x - 8, y - 1.5, 13, 3, IL).rect(x - 6, y + 1, 3, 3, CD).rect(x + 5, y - 1, 3, 2, BL));
  building('bld_alchemist', 0x3e4a3a, 0x5a3a6b, (q, x, y) => q.disc(x, y + 1, 3, 0x8fd14f).rect(x - 1, y - 4, 2, 3, ST).disc(x - 1, y, 0.8, 0xe0ffc0));
  building('bld_clockmaker', 0x4a3a2a, CU, (q, x, y) => q.disc(x, y, 4, 0xe8e0c8).ring(x, y, 4, BL, 0.6).line(x, y, x, y - 3, K).line(x, y, x + 2, y, K));

  // The Undercrank gate: a ring of great gears around a hissing shaft.
  let p = new Pix(96, 96, 2);
  p.part((t) => t.disc(48, 48, 44), IR, { light: IL });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    p.gear(48 + Math.cos(a) * 38, 48 + Math.sin(a) * 38, 8, 9, i % 2 ? BR : CU, i % 2 ? BD : CD, 2, i * 0.4);
    p.disc(48 + Math.cos(a) * 38 - 2, 48 + Math.sin(a) * 38 - 2, 1.4, i % 2 ? BL : CL, 0.8);
  }
  p.disc(48, 48, 30, 0x1a1512);
  p.disc(48, 48, 26, 0x0a0706);
  p.disc(48, 48, 18, 0x050303);
  for (let r = 26; r > 16; r -= 3) p.ring(48, 48, r, 0x2a1d17, 0.8, 0.7);
  p.disc(48, 48, 8, 0x3a1206, 0.6).disc(48, 48, 4, 0x6a2008, 0.5);
  p.ring(48, 48, 30, BL, 0.8);
  p.ring(48, 48, 44, BD, 1.5);
  p.outline(K).toTexture(scene, 'gate');

  p = new Pix(10, 28, 2);
  p.part((t) => t.rect(4, 8, 2, 20).rect(2, 26, 6, 2), 0x2a2420);
  p.part((t) => t.poly([[1, 1], [9, 1], [8, 9], [2, 9]]), BR, { light: BL });
  p.rect(2.5, 2, 5, 6, GL).rect(3.5, 3, 3, 4, 0xfff2c0).rect(0, 0, 10, 1, BD).disc(5, 0, 1, BD);
  p.outline(K).toTexture(scene, 'lamp');

  // Props
  p = new Pix(14, 16, 2);
  p.part((t) => t.ellipse(7, 8, 6, 7.5), CD, { light: CU });
  p.part((t) => t.rect(1, 3.5, 12, 1.5).rect(1, 11, 12, 1.5), IR, { light: IL });
  p.outline(K).toTexture(scene, 'barrel');
  p = new Pix(32, 24, 2);
  p.part((t) => t.ellipse(16, 16, 15, 7), IR, { light: IL });
  p.ellipse(16, 15, 13, 5.5, 0x2c5f6b).ellipse(16, 14, 11, 4, 0x3f8fa0).ellipse(13, 13.5, 4, 1.2, 0x9fe8ff, 0.7);
  p.part((t) => t.rect(14, 2, 4, 12), BR, { light: BL }).part((t) => t.disc(16, 3, 3), BL);
  p.outline(K).toTexture(scene, 'fountain');
  p = new Pix(24, 12, 2);
  p.part((t) => t.rect(0, 2, 24, 8), CU, { light: CL }).part((t) => t.rect(5, 0, 3, 12).rect(16, 0, 3, 12), CD, { light: CU });
  p.outline(K).toTexture(scene, 'bigpipe');
}
