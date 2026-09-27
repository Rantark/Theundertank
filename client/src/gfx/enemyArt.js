// ENEMY & BOSS ART
// Hand-authored with shaded parts at 2x density: regular enemies are 32x32 (big ones
// 40x40), bosses 80x80. Every design has 4 animation frames: `en_${id}_${f}` /
// `boss_${id}_${f}`. Renderers show them at half scale.
import { Pix, shade } from './pix.js';
import { PAL } from '@undercrank/shared';

const K = 0x140e0c;
const BR = PAL.brass;
const BL = PAL.brassLight;
const BD = PAL.brassDark;
const CU = PAL.copper;
const CL = PAL.copperLight;
const CD = PAL.copperDark;
const VG = PAL.verdigris;
const VL = PAL.verdigrisLight;
const IR = 0x4a433c;
const IL = 0x6e655b;
const RED = 0xff3b3b;
const GLOW = 0xffd08a;
const CYAN = 0x6ff0ff;

// Size of each enemy canvas (bigger silhouettes for tougher foes).
export const ENEMY_SIZE = { brass_sentinel: 40, tinker_mother: 40, smog_bellows: 36 };

function eye(p, x, y, r = 1.6, c = RED) {
  p.disc(x, y, r + 0.8, K).disc(x, y, r, c).rp(Math.floor((x - r * 0.4) * p.k), Math.floor((y - r * 0.4) * p.k), 0xffffff);
}

function legs(p, cx, cy, n, len, f, color, spread = 1) {
  // Insect-style legs radiating from the body, animated in alternating tripods.
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < n; i++) {
      const base = (-0.9 + (i / Math.max(1, n - 1)) * 1.8) * spread;
      const phase = (i + (side > 0 ? 1 : 0) + f) % 2 ? 0.25 : -0.25;
      const a = (side > 0 ? 0 : Math.PI) + (side > 0 ? base : -base) + phase * side;
      const kx = cx + Math.cos(a) * len * 0.6;
      const ky = cy + Math.sin(a) * len * 0.6 - 2;
      const fx = cx + Math.cos(a) * len;
      const fy = cy + Math.sin(a) * len + 2;
      p.line(cx, cy, kx, ky, color, 1, 1.2).line(kx, ky, fx, fy, shade(color, 0.8), 1, 1);
    }
  }
}

const DRAW = {
  cogling(p, f) {
    legs(p, 16, 19, 3, 11, f, IL);
    p.part((t) => t.gear(16, 18, 7.5, 10, 0xffffff, 0xffffff), BR);
    p.part((t) => t.disc(16, 17.5, 4.6), BD, { light: BR });
    p.gear(16, 17.5, 3, 6, CL, CD, 1.1, f * 0.3);
    // Wind-up key on its back turns as it scuttles.
    const ka = f * (Math.PI / 2);
    const kx = 16 + Math.cos(ka) * 3;
    p.line(16, 10, 16, 6, IL, 1, 1.4).part((t) => t.ellipse(kx, 4.5, 2.2, 1.6).ellipse(32 - kx, 4.5, 2.2, 1.6), BL);
    eye(p, 16, 23.5, 2);
  },

  rivet_turret(p, f) {
    p.line(16, 22, 6, 30, IR, 1, 1.6).line(16, 22, 26, 30, IR, 1, 1.6).line(16, 22, 16, 31, IR, 1, 1.6);
    p.part((t) => t.ellipse(16, 21, 11, 7), IL);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.px(16 + Math.cos(a) * 9, 21 + Math.sin(a) * 5.5, BL);
    }
    p.part((t) => t.ellipse(16, 15, 8, 7.5).rect(8, 15, 16, 5), CU);
    p.part((t) => t.rect(9, 17, 14, 2), BD, { flat: true });
    const glow = [RED, 0xff7a5a, 0xffb0a0, 0xff7a5a][f];
    p.rect(11, 12, 10, 3, K).rect(12, 12.5, 8, 2, glow);
    p.part((t) => t.disc(16, 7.5, 1.6), BL);
  },

  steam_spitter(p, f) {
    const step = [0, 1, 0, -1][f];
    p.part((t) => t.rect(9 + step, 25, 5, 5).rect(18 - step, 25, 5, 5), IR);
    p.part((t) => t.poly([[22, 16], [29, 10], [30, 12], [24, 20]]), CD);
    p.part((t) => t.ellipse(16, 19, 10, 8), CU, { light: CL });
    // Verdigris patina
    p.ellipse(10, 22, 2.5, 1.5, VG, 0.8).ellipse(21, 24, 2, 1.2, VG, 0.8).ellipse(19, 14, 1.5, 1, VG, 0.7);
    const lid = f % 2 ? -1 : 0;
    p.part((t) => t.ellipse(16, 11 + lid, 6.5, 2.4), IL);
    p.part((t) => t.disc(16, 8.5 + lid, 1.6), BL);
    p.rect(8, 18, 16, 2, BD);
    eye(p, 12, 16, 1.5);
    eye(p, 19, 16, 1.5);
    if (f >= 2) p.disc(29, 8 - (f - 2) * 2, 2.2 + (f - 2), 0xe6e9e4, 0.75);
  },

  boiler_bomb(p, f) {
    const wob = [0, 1, 0, -1][f];
    p.part((t) => t.rect(10 - wob, 26, 4, 4).rect(18 + wob, 26, 4, 4), IR);
    p.part((t) => t.disc(16 + wob * 0.5, 18, 10), 0x3a3230, { light: 0x5a504a });
    p.part((t) => t.rect(6 + wob * 0.5, 18, 20, 3), BR, { flat: true });
    for (const x of [8, 13, 19, 24]) p.px(x + wob * 0.5, 19, BL);
    // Pressure gauge face with a twitching needle.
    p.part((t) => t.disc(16 + wob * 0.5, 13, 4.2), 0xe8e0c8);
    p.ring(16 + wob * 0.5, 13, 4.2, BD, 0.8);
    const na = -2.4 + f * 0.35;
    p.line(16 + wob * 0.5, 13, 16 + wob * 0.5 + Math.cos(na) * 3, 13 + Math.sin(na) * 3, RED, 1, 0.8);
    p.part((t) => t.rect(15, 3, 2.5, 5), CD);
    p.disc(16.5, 2.5, 1.6 + (f % 2) * 0.6, f % 2 ? 0xffffff : 0xff9c3a);
  },

  spring_hopper(p, f) {
    // 0/1 idle, 2 crouch, 3 airborne
    const crouch = f === 2;
    const air = f === 3;
    const bodyY = crouch ? 19 : air ? 12 : 15 - (f === 1 ? 0.5 : 0);
    const springTop = bodyY + 4;
    const springBot = crouch ? 26 : air ? 30 : 28;
    for (const sx of [10, 22]) {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const y0 = springTop + ((springBot - springTop) * i) / n;
        const y1 = springTop + ((springBot - springTop) * (i + 1)) / n;
        p.line(sx - 3, y0, sx + 3, y1, i % 2 ? IL : 0x9a9088, 1, 1);
      }
      p.part((t) => t.ellipse(sx, springBot + 1, 4, 1.6), IR);
    }
    p.part((t) => t.ellipse(16, bodyY, crouch ? 11 : 9, crouch ? 6 : 7), VG, { light: VL });
    p.ellipse(16, bodyY + 2.5, 5, 2.5, shade(VG, 1.2), 0.7);
    for (const ex of [11, 21]) {
      p.part((t) => t.disc(ex, bodyY - 5, 3.4), BR);
      p.disc(ex, bodyY - 5, 2, K).disc(ex, bodyY - 5.2, 1.1, 0xffe08a);
    }
    p.line(12, bodyY + 3, 20, bodyY + 3, K, 1, 0.8);
  },

  gear_spinner(p, f) {
    const rot = f * (Math.PI / 24);
    // Saw teeth: triangular spikes around a copper disc.
    const teeth = 12;
    const pts = [];
    for (let i = 0; i < teeth * 2; i++) {
      const a = rot + (i / (teeth * 2)) * Math.PI * 2;
      const r = i % 2 ? 10.2 : 14.5;
      pts.push([16 + Math.cos(a) * r, 16 + Math.sin(a) * r]);
    }
    p.part((t) => t.poly(pts), CU, { light: CL });
    p.part((t) => t.disc(16, 16, 8), BD, { light: BR });
    for (let i = 0; i < 6; i++) {
      const a = -rot * 2 + (i / 6) * Math.PI * 2;
      p.disc(16 + Math.cos(a) * 5.5, 16 + Math.sin(a) * 5.5, 1.3, K);
    }
    p.disc(16, 16, 3.4, K).disc(16, 16, 2.4, [RED, 0xff6040, 0xff9070, 0xff6040][f]);
  },

  pipe_worm(p, f) {
    const sway = [0, 1, 0, -1][f];
    p.part((t) => t.ellipse(16, 27, 12, 4.5), 0x3a2e26, { light: 0x5a4a3c });
    p.ellipse(16, 27, 8, 2.6, 0x140e0c);
    for (let i = 0; i < 4; i++) {
      const y = 25 - i * 4.5;
      const x = 16 + sway * (i / 3);
      p.part((t) => t.rect(x - 5, y - 4, 10, 5), i % 2 ? VG : CU);
      p.part((t) => t.rect(x - 6, y - 1, 12, 2), BR, { flat: true });
    }
    const hx = 16 + sway;
    const jaw = f % 2 ? 1.5 : 0;
    p.part((t) => t.ellipse(hx, 7, 7.5, 4.5 + jaw), CU, { light: CL });
    p.ellipse(hx, 7, 5, 2.6 + jaw, K);
    for (let i = 0; i < 6; i++) p.px(hx - 4 + i * 1.6, 5 - jaw * 0.5, 0xe6e9e4);
    eye(p, hx - 5, 12, 1.2);
    eye(p, hx + 5, 12, 1.2);
  },

  brass_sentinel(p, f) {
    const step = [0, 1.5, 0, -1.5][f];
    p.part((t) => t.rect(13, 27 + Math.max(0, step), 5, 10 - Math.max(0, step)).rect(22, 27 + Math.max(0, -step), 5, 10 - Math.max(0, -step)), IR);
    p.part((t) => t.rect(12, 35, 7, 4).rect(21, 35, 7, 4), BD);
    p.part((t) => t.poly([[10, 13], [30, 13], [28, 30], [12, 30]]), BR, { light: BL });
    p.part((t) => t.poly([[15, 16], [25, 16], [24, 27], [16, 27]]), BD, { light: BR });
    p.disc(20, 21, 2, 0xffc93c);
    for (const [x, y] of [[12, 15], [28, 15], [13, 28], [27, 28]]) p.px(x, y, BL);
    p.part((t) => t.ellipse(8.5, 15, 4.5, 4).ellipse(31.5, 15, 4.5, 4), BD, { light: BR });
    p.part((t) => t.poly([[6, 17], [10, 17], [9, 28], [6, 28]]).poly([[30, 17], [34, 17], [34, 28], [31, 28]]), IL);
    p.part((t) => t.ellipse(20, 8, 6.5, 6.5).rect(13.5, 8, 13, 5), BR, { light: BL });
    p.rect(14.5, 8, 11, 2.2, K).rect(15.5, 8.6, 9, 1, [RED, 0xff7050, 0xffa090, 0xff7050][f]);
    p.part((t) => t.poly([[19, 0], [21, 0], [21.5, 3], [18.5, 3]]), 0xb03030);
  },

  coil_wraith(p, f) {
    // Spectral tail
    const wave = [0, 1, 0, -1];
    const tail = [];
    for (let i = 0; i <= 8; i++) tail.push([10 + i * 1.5 + wave[(f + i) % 4] * 0.8, 20 + i * 1.2 + (i % 2)]);
    p.poly([[9, 17], [23, 17], ...tail.slice().reverse().map(([x, y]) => [x + 2, y]), [16, 31]], 0x3fb8d0, 0.55);
    p.part((t) => t.ellipse(16, 15, 8, 9), 0x2c6f80, { alpha: 0.9, light: 0x6fd8e8 });
    // Tesla coil core
    p.part((t) => t.rect(14, 9, 4, 13), IL);
    for (let y = 10; y < 21; y += 2) p.line(12.5, y, 19.5, y + 1, CU, 1, 1);
    p.disc(16, 7, 3.4, K).disc(16, 7, 2.6, f % 2 ? 0xffffff : CYAN);
    // Hollow eyes
    p.disc(12, 13, 1.4, 0xe8ffff).disc(20, 13, 1.4, 0xe8ffff);
    // Arcs
    const arcs = [[[4, 8], [7, 11], [5, 14]], [[27, 6], [25, 10], [28, 12]], [[5, 20], [8, 18], [6, 16]], [[26, 18], [29, 15], [26, 13]]];
    const a = arcs[f];
    p.line(a[0][0], a[0][1], a[1][0], a[1][1], CYAN).line(a[1][0], a[1][1], a[2][0], a[2][1], 0xffffff);
  },

  tinker_mother(p, f) {
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const up = (i + f + (side > 0 ? 1 : 0)) % 2 ? -2 : 1;
        const bx = 20 + side * 6;
        const by = 20 + (i - 1.5) * 3;
        const kx = 20 + side * 13;
        const ky = by - 6 + up + (i - 1.5) * 2;
        const fx = 20 + side * 18;
        const fy = by + 8 + (i - 1.5) * 3 + up;
        p.line(bx, by, kx, ky, IL, 1, 1.5).line(kx, ky, fx, fy, IR, 1, 1.2);
      }
    }
    p.part((t) => t.ellipse(20, 22, 11, 9), CU, { light: CL });
    p.part((t) => t.ellipse(20, 19, 6.5, 5.5), 0x2c5f6b, { light: 0x5fb0c0 });
    p.disc(20, 19.5, 2.4 + (f % 2) * 0.5, 0xffc93c);
    p.rect(10, 25, 20, 2, BD);
    for (const x of [12, 16, 24, 28]) p.px(x, 26, BL);
    // Crane arm holding a cog
    p.line(26, 16, 31, 6, IL, 1, 1.5).line(31, 6, 34 - (f % 2), 10, IL, 1, 1.2);
    p.gear(34 - (f % 2), 12, 2.3, 6, BL, BD, 0.7);
    eye(p, 15, 26.5, 1.2);
    eye(p, 25, 26.5, 1.2);
  },

  smog_bellows(p, f) {
    const squeeze = [0, 1.5, 3, 1.5][f];
    const w = 13 - squeeze;
    p.part((t) => t.rect(10, 29, 5, 5).rect(21, 29, 5, 5), IR);
    for (let i = 0; i < 6; i++) {
      const x0 = 18 - w + (i * 2 * w) / 6;
      p.part((t) => t.poly([[x0, 12], [x0 + (2 * w) / 6, 12], [x0 + (2 * w) / 6 + (i % 2 ? 1 : -1), 30], [x0 + (i % 2 ? 1 : -1), 30]]), i % 2 ? 0x6b5d50 : 0x4a4038);
    }
    p.part((t) => t.rect(18 - w - 2, 10, 4, 22).rect(18 + w - 2, 10, 4, 22), CU, { light: CL });
    // Chimneys + puff
    p.part((t) => t.rect(11, 2, 4, 9).rect(21, 4, 4, 7), IR);
    p.rect(10, 2, 6, 2, IL).rect(20, 4, 6, 2, IL);
    if (f === 2 || f === 3) p.disc(13, 0 + (f - 2) * -1, 2.5 + (f - 2), 0x9a9088, 0.8);
    // Grille face
    p.rect(13, 17, 10, 7, K);
    for (let x = 14; x < 23; x += 2) p.rect(x, 17, 1, 7, 0x2a2420);
    eye(p, 14.5, 19, 1.2, 0xff9c3a);
    eye(p, 21.5, 19, 1.2, 0xff9c3a);
  },
};

// ------------------------------------------------------------------ bosses (80x80)
const BOSS = {
  steam_golem(p, f) {
    const sway = [0, 1, 0, -1][f];
    // Legs
    p.part((t) => t.rect(22, 58, 13, 18).rect(45, 58, 13, 18), IR);
    p.part((t) => t.rect(19, 72, 18, 6).rect(43, 72, 18, 6), 0x3a332d);
    // Arms (behind torso)
    p.part((t) => t.poly([[10, 26 + sway], [22, 24], [22, 44], [14, 54 + sway], [6, 50 + sway]]), IL);
    p.part((t) => t.poly([[70, 26 - sway], [58, 24], [58, 44], [66, 54 - sway], [74, 50 - sway]]), IL);
    p.part((t) => t.disc(9, 56 + sway, 7).disc(71, 56 - sway, 7), IR, { light: IL });
    // Torso
    p.part((t) => t.poly([[16, 20], [64, 20], [60, 62], [20, 62]]), 0x5a534b, { light: 0x7a7168 });
    for (const [x, y] of [[20, 24], [60, 24], [22, 58], [58, 58], [40, 22]]) p.disc(x, y, 1.2, BL);
    // Furnace belly
    const fire = [0xff9c3a, 0xffb347, 0xffd08a, 0xffb347][f];
    p.part((t) => t.disc(40, 42, 12), 0x2a1810);
    p.disc(40, 42, 10, fire);
    p.disc(40, 44, 6, 0xfff2c0, 0.8);
    for (let x = 32; x <= 48; x += 4) p.line(x, 32, x, 52, 0x3a2010, 1, 1.4);
    p.ring(40, 42, 12, BD, 1.4);
    // Head
    p.part((t) => t.poly([[30, 4], [50, 4], [52, 20], [28, 20]]), IL, { light: 0x9a9088 });
    p.rect(31, 11, 18, 4, K);
    p.rect(33, 12, 5, 2, RED).rect(42, 12, 5, 2, RED);
    // Smokestacks on the shoulders
    p.part((t) => t.rect(14, 6, 7, 16).rect(59, 6, 7, 16), CU, { light: CL });
    p.rect(13, 5, 9, 3, CD).rect(58, 5, 9, 3, CD);
    if (f % 2) p.disc(17, 2, 3.5, 0xe6e9e4, 0.7).disc(63, 1, 3, 0xe6e9e4, 0.7);
  },

  clocktower(p, f) {
    // Base with treads
    p.part((t) => t.rect(16, 64, 48, 12), IR, { light: IL });
    for (let x = 18; x < 64; x += 6) p.rect(x + (f % 2) * 3, 66, 3, 8, 0x2a2420);
    // Tower body
    p.part((t) => t.poly([[22, 26], [58, 26], [60, 66], [20, 66]]), CD, { light: CU });
    for (let y = 30; y < 64; y += 6) p.line(22, y, 58, y, shade(CD, 0.8), 1, 0.8);
    // Pendulum arms
    const sw = [-4, -1, 4, 1][f];
    p.line(20, 34, 8 + sw, 58, BD, 1, 2).line(60, 34, 72 + sw, 58, BD, 1, 2);
    p.part((t) => t.disc(8 + sw, 60, 5).disc(72 + sw, 60, 5), BR, { light: BL });
    // Roof + belfry
    p.part((t) => t.poly([[40, 0], [62, 24], [18, 24]]), VG, { light: VL });
    p.part((t) => t.rect(34, 10, 12, 10), 0x2a1d17);
    p.part((t) => t.ellipse(40 + [0, 1, 0, -1][f], 16, 3.5, 3.5), BR, { light: BL });
    // Clock face
    p.part((t) => t.disc(40, 42, 13), 0xe8e0c8, { light: 0xffffff });
    p.ring(40, 42, 13, BR, 1.6);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      p.px(40 + Math.cos(a) * 10.5, 42 + Math.sin(a) * 10.5, K);
    }
    const h = -Math.PI / 2 + f * (Math.PI / 2);
    const m = -Math.PI / 2 + f * (Math.PI / 8);
    p.line(40, 42, 40 + Math.cos(h) * 6, 42 + Math.sin(h) * 6, K, 1, 1.5).line(40, 42, 40 + Math.cos(m) * 10, 42 + Math.sin(m) * 10, RED, 1, 1);
    p.disc(40, 42, 1.6, BD);
    // Eye slits under the face
    p.rect(30, 58, 20, 3, K).rect(32, 58.5, 6, 2, RED).rect(42, 58.5, 6, 2, RED);
  },

  boiler_beast(p, f) {
    const step = [0, 2, 0, -2][f];
    // Legs
    for (const [x, s] of [[16, 1], [28, -1], [52, 1], [64, -1]]) {
      p.part((t) => t.rect(x - 4, 50 + Math.max(0, step * s), 8, 22 - Math.max(0, step * s)), IR);
      p.part((t) => t.poly([[x - 6, 70], [x + 6, 70], [x + 7, 76], [x - 7, 76]]), 0x2a2420);
    }
    // Body (boiler cylinder)
    p.part((t) => t.ellipse(40, 40, 32, 18), 0x4a3e38, { light: 0x6a5a50 });
    for (const x of [22, 58]) p.part((t) => t.rect(x - 2, 23, 4, 34), BD, { light: BR });
    // Heart grille
    const glow = [0xff5a1f, 0xff7a2a, 0xffa040, 0xff7a2a][f];
    p.part((t) => t.ellipse(40, 42, 11, 9), 0x2a1810);
    p.ellipse(40, 42, 9, 7, glow);
    p.ellipse(40, 43, 4.5, 3.5, 0xffe0a0);
    for (let x = 32; x <= 48; x += 4) p.line(x, 34, x, 50, 0x3a2010, 1, 1.2);
    // Head with jaw
    p.part((t) => t.ellipse(40, 14, 16, 10), 0x5a4e46, { light: 0x7a6a60 });
    const jaw = f % 2 ? 3 : 0;
    p.part((t) => t.poly([[28, 18], [52, 18], [48, 26 + jaw], [32, 26 + jaw]]), 0x3a302a);
    p.rect(30, 18, 20, 4 + jaw, 0x1a0e0a);
    for (let x = 31; x < 50; x += 3) p.poly([[x, 18], [x + 2, 18], [x + 1, 21]], 0xe6ddc8).poly([[x + 1, 22 + jaw], [x + 3, 22 + jaw], [x + 2, 19 + jaw]], 0xe6ddc8);
    eye(p, 32, 11, 2.2, 0xffb347);
    eye(p, 48, 11, 2.2, 0xffb347);
    // Pipe horns
    p.part((t) => t.poly([[26, 8], [30, 6], [22, 0], [18, 2]]).poly([[54, 8], [50, 6], [58, 0], [62, 2]]), CU, { light: CL });
  },

  tesla_matriarch(p, f) {
    // Plated skirt
    for (let i = 0; i < 7; i++) {
      const x = 16 + i * 7;
      p.part((t) => t.poly([[40 + (x - 40) * 0.45, 40], [40 + (x + 6 - 40) * 0.45, 40], [x + 7, 72 + (i % 2) * 2], [x - 1, 70]]), i % 2 ? CU : CD, { light: CL });
    }
    // Torso
    p.part((t) => t.poly([[30, 24], [50, 24], [48, 44], [32, 44]]), 0x2c3f4b, { light: 0x4a6a7a });
    const orb = [0xffffff, CYAN, 0xb0f8ff, CYAN][f];
    p.disc(40, 34, 6, K).disc(40, 34, 5, orb).disc(38.5, 32.5, 1.6, 0xffffff);
    // Head + coil crown
    p.part((t) => t.ellipse(40, 16, 7, 8), 0x3a4a55, { light: 0x5a7080 });
    p.rect(35, 15, 3, 2, CYAN).rect(42, 15, 3, 2, CYAN);
    for (let i = 0; i < 5; i++) {
      const x = 30 + i * 5;
      const h = i === 2 ? 12 : i % 2 ? 9 : 7;
      p.part((t) => t.rect(x, 8 - h, 3, h), BR, { light: BL });
      p.disc(x + 1.5, 7 - h, 1.6, (i + f) % 2 ? 0xffffff : CYAN);
    }
    // Arms with spheres
    const lift = [0, -2, 0, 2][f];
    p.line(30, 26, 14, 20 + lift, BR, 1, 2).line(50, 26, 66, 20 - lift, BR, 1, 2);
    p.part((t) => t.disc(12, 19 + lift, 5).disc(68, 19 - lift, 5), 0x2c3f4b, { light: 0x5a8090 });
    p.disc(12, 19 + lift, 2.6, f % 2 ? CYAN : 0xffffff).disc(68, 19 - lift, 2.6, f % 2 ? 0xffffff : CYAN);
    // Arcs between spheres and crown
    const zig = (x0, y0, x1, y1) => {
      let px = x0;
      let py = y0;
      for (let i = 1; i <= 4; i++) {
        const nx = x0 + ((x1 - x0) * i) / 4 + (i < 4 ? ((i + f) % 2 ? 2 : -2) : 0);
        const ny = y0 + ((y1 - y0) * i) / 4;
        p.line(px, py, nx, ny, 0xe8ffff);
        px = nx;
        py = ny;
      }
    };
    if (f % 2) zig(12, 14, 30, 2);
    else zig(68, 14, 50, 2);
  },
};

export function generateEnemyArt(scene, enemies, bosses) {
  for (const e of enemies) {
    const size = ENEMY_SIZE[e.id] || 32;
    for (let f = 0; f < 4; f++) {
      const p = new Pix(size, size);
      DRAW[e.id](p, f);
      p.outline(K);
      p.toTexture(scene, `en_${e.id}_${f}`);
    }
  }
  for (const b of bosses) {
    for (let f = 0; f < 4; f++) {
      const p = new Pix(80, 80);
      BOSS[b.id](p, f);
      p.outline(K);
      p.toTexture(scene, `boss_${b.id}_${f}`);
    }
  }
  let p = new Pix(22, 8);
  p.part((t) => t.rect(0, 2, 18, 4), IR, { light: IL }).part((t) => t.rect(15, 0, 6, 8), IL).rect(20, 3, 2, 2, K).outline(K).toTexture(scene, 'turret_barrel');
  p = new Pix(32, 16);
  p.part((t) => t.ellipse(16, 10, 14, 6), 0x3a2e26, { light: 0x5a4a3c }).disc(9, 9, 1.4, 0x6b5a48).disc(22, 11, 1.2, 0x6b5a48).disc(15, 7, 1, 0x7a6a58);
  p.part((t) => t.rect(19, 1, 3, 7), VG).rect(18, 1, 5, 2, BR);
  p.outline(K).toTexture(scene, 'mound');
  p = new Pix(12, 32);
  p.part((t) => t.poly([[1, 2], [11, 0], [11, 32], [1, 30]]), BR, { light: BL });
  p.part((t) => t.disc(6, 16, 3), BD, { light: BR });
  for (const y of [4, 28]) p.px(3, y, BL).px(9, y, BL);
  p.outline(K).toTexture(scene, 'sentinel_shield');
}

// Dev sprite viewer hook (see client/sprites.html).
export async function preview({ section, show }) {
  const { ENEMIES, BOSSES } = await import('@undercrank/shared');
  const row = section('enemies');
  for (const e of ENEMIES) {
    const size = ENEMY_SIZE[e.id] || 32;
    for (let f = 0; f < 4; f++) {
      const p = new Pix(size, size);
      DRAW[e.id](p, f);
      p.outline(K);
      show(row, p, 4);
    }
  }
  const row2 = section('bosses');
  for (const b of BOSSES) {
    for (let f = 0; f < 4; f++) {
      const p = new Pix(80, 80);
      BOSS[b.id](p, f);
      p.outline(K);
      show(row2, p, 3);
    }
  }
}
