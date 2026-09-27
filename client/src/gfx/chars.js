// PAPER-DOLL CHARACTER GENERATOR
// Every humanoid (playable characters, shopkeepers, townsfolk) is drawn from a small
// spec by composing shaded body parts on a 32x64 canvas (shown at 16x32 in the world).
//
// Views:  'down' (front), 'up' (back), 'side' (facing right; mirrored for left)
// Poses:  idle0..1 (breathing), walk0..3 (4-frame cycle), dash0 (side view only)
// Texture key: `${prefix}_${view}_${pose}` e.g. pl_tinker_side_walk2
import { Pix, shade } from './pix.js';

const OUTLINE = 0x16100e;
export const CHAR_W = 32;
export const CHAR_H = 64;
// Feet rest on this row; renderers anchor sprites here.
export const FEET_Y = 61;

const EYE = 0x1e1418;

/** Build a full palette from a spec. */
function palette(s) {
  return {
    skin: s.skin ?? 0xe8b48a,
    skinD: shade(s.skin ?? 0xe8b48a, 0.78),
    hair: s.hair ?? 0x3a2418,
    coat: s.coat,
    coatD: shade(s.coat, 0.72),
    trim: s.trim ?? 0xc99a2e,
    pants: s.pants ?? 0x3a3038,
    boots: s.boots ?? 0x2a1d17,
    hat: s.hatColor ?? 0x2a1d17,
    band: s.hatBand ?? 0xc99a2e,
    shirt: s.shirt ?? 0xe6ddc8,
    apron: s.apron ?? 0x6e4a2e,
  };
}

// ------------------------------------------------------------------ front / back view
function drawFrontBack(p, s, c, view, pose, f) {
  const back = view === 'up';
  const walk = pose === 'walk';
  const bob = walk ? (f % 2 ? -1 : 0) : pose === 'idle' && f === 1 ? 1 : 0;
  const breathe = pose === 'idle' && f === 1 ? 1 : 0;
  const b = s.build ?? 0; // extra half-width for burly characters
  const lift = [0, 2, 0, 0];
  const liftL = walk ? lift[f] : 0;
  const liftR = walk ? lift[(f + 2) % 4] : 0;
  const robe = s.coatStyle === 'robe' || s.coatStyle === 'dress';

  // Long hair falls behind the shoulders (front view).
  if (!back && s.hairStyle === 'long') p.part((t) => t.rect(9, 18 + bob, 14, 18), c.hair);

  // Legs + boots
  if (!robe) {
    p.part((t) => t.rect(11 - b / 2, 46 + bob, 4, 11 - liftL), c.pants);
    p.part((t) => t.rect(17 + b / 2, 46 + bob, 4, 11 - liftR), c.pants);
  }
  p.part((t) => t.rect(10 - b / 2, 56 - liftL, 5, 5).rect(10 - b / 2, 58 - liftL, 6, 3), c.boots);
  p.part((t) => t.rect(17 + b / 2, 56 - liftR, 5, 5).rect(16 + b / 2, 58 - liftR, 6, 3), c.boots);

  // Arms (behind torso edges so the coat overlaps the shoulder)
  const swing = walk ? [0, 1, 0, -1][f] : 0;
  const armL = (t) => t.poly([[7 - b, 32 + bob], [10 - b, 31 + bob], [10 - b, 43 + bob + swing], [7 - b, 44 + bob + swing]]);
  const armR = (t) => t.poly([[22 + b, 31 + bob], [25 + b, 32 + bob], [25 + b, 44 + bob - swing], [22 + b, 43 + bob - swing]]);
  p.part(armL, c.coat);
  p.part(armR, c.coat);
  p.part((t) => t.disc(8.5 - b, 45.5 + bob + swing, 1.9), c.skin);
  p.part((t) => t.disc(23.5 + b, 45.5 + bob - swing, 1.9), c.skin);

  // Torso / coat
  const top = 30 + bob + breathe * 0;
  const sw = 7 + b; // half shoulder width
  if (robe) {
    p.part((t) => t.poly([[16 - sw, top + 1], [16 + sw, top + 1], [16 + sw + 3, 59], [16 - sw - 3, 59]]), c.coat);
    if (s.coatStyle === 'dress') p.part((t) => t.rect(16 - sw - 2, 52, 2 * sw + 4, 3), c.trim, { flat: true });
  } else {
    p.part((t) => {
      t.poly([[16 - sw, top + 1], [16 + sw, top + 1], [16 + sw - 1, 47 + bob], [16 - sw + 1, 47 + bob]]);
      if (s.coatStyle === 'long') {
        t.poly([[16 - sw + 1, 44 + bob], [15, 44 + bob], [14, 53 + bob], [16 - sw, 53 + bob]]);
        t.poly([[17, 44 + bob], [16 + sw - 1, 44 + bob], [16 + sw, 53 + bob], [18, 53 + bob]]);
      }
    }, c.coat);
  }
  if (!back) {
    // Shirt collar, lapels and buttons
    p.part((t) => t.poly([[13, top + 1], [19, top + 1], [16, top + 7]]), c.shirt, { flat: true });
    if (s.coatStyle !== 'robe') {
      p.line(15, top + 2, 13, top + 8, c.coatD);
      p.line(17, top + 2, 19, top + 8, c.coatD);
      for (const y of [top + 9, top + 12]) p.px(16, y, c.trim);
    }
    if (s.coatStyle === 'apron') p.part((t) => t.poly([[12, top + 6], [20, top + 6], [21, 53 + bob], [11, 53 + bob]]), c.apron);
  } else {
    p.line(16, top + 3, 16, 46 + bob, c.coatD);
  }
  // Belt
  if (s.belt !== false && !robe) {
    p.rect(16 - sw + 1, 42 + bob, 2 * sw - 2, 2, s.beltColor ?? 0x2a1d17);
    if (!back) p.rect(15, 42 + bob, 2, 2, c.trim);
    if (s.pouches && !back) p.part((t) => t.rect(10 - b, 43 + bob, 3, 3).rect(19 + b, 43 + bob, 3, 3), 0x6e4a2e);
  }
  // Scarf
  if (s.scarf) {
    p.part((t) => t.rect(11, top, 10, 3), s.scarf);
    if (!back) p.part((t) => t.poly([[18, top + 2], [21, top + 2], [21 + (walk ? f % 2 : 0), top + 11], [18, top + 10]]), s.scarf);
  }

  // Neck + head
  p.part((t) => t.rect(14, 27 + bob, 4, 4), c.skinD, { flat: true });
  p.part((t) => t.ellipse(16, 22 + bob, 6.8, 7), c.skin);
  const hy = bob;
  if (back) {
    if (s.hairStyle !== 'bald' && s.hat !== 'hood') p.part((t) => t.ellipse(16, 21 + hy, 7, 7).rect(10, 21 + hy, 12, 6), c.hair);
  } else {
    // Hair
    if (s.hairStyle === 'bob' || s.hairStyle === 'long') p.part((t) => t.ellipse(16, 18 + hy, 7.2, 4.5).rect(9, 18 + hy, 3, 9).rect(20, 18 + hy, 3, 9), c.hair);
    else if (s.hairStyle === 'short') p.part((t) => t.ellipse(16, 17.5 + hy, 7, 3.8), c.hair);
    else if (s.hairStyle === 'bun') p.part((t) => t.ellipse(16, 18 + hy, 7, 4).disc(16, 12 + hy, 3), c.hair);
    else if (s.hairStyle === 'bald') p.rp(12 * p.k, (18 + hy) * p.k, 0xffffff, 0.5);
    // Face
    const ec = s.glowEyes ?? EYE;
    p.rect(12, 22 + hy, 2, 3, ec).rect(18, 22 + hy, 2, 3, ec);
    if (!s.glowEyes) p.px(12, 22 + hy, 0xffffff).px(18, 22 + hy, 0xffffff);
    p.px(11, 26 + hy, shade(c.skin, 0.9)).px(20, 26 + hy, shade(c.skin, 0.9));
    if (!s.beard) p.rect(15, 27 + hy, 2, 1, shade(c.skin, 0.62));
    if (s.eyepatch) p.rect(11, 21 + hy, 4, 4, 0x1a1414).line(9, 20 + hy, 23, 18 + hy, 0x1a1414);
    if (s.monocle) p.ring(19, 23.5 + hy, 2.4, c.trim, 0.9).line(21, 25 + hy, 22, 31 + hy, c.trim);
    if (s.goggles === 'eyes') p.ring(13, 23.5 + hy, 2.6, 0x7a5a17, 1).ring(19, 23.5 + hy, 2.6, 0x7a5a17, 1);
    // Beard / moustache
    if (s.beard === 'full') p.part((t) => t.poly([[10, 24 + hy], [22, 24 + hy], [20, 31 + hy], [16, 35 + hy], [12, 31 + hy]]), s.beardColor ?? c.hair);
    if (s.beard === 'stache') p.part((t) => t.poly([[12, 26 + hy], [20, 26 + hy], [21, 28 + hy], [16, 27 + hy], [11, 28 + hy]]), s.beardColor ?? c.hair, { flat: true });
  }

  drawHat(p, s, c, back ? 'up' : 'down', hy);
}

// ------------------------------------------------------------------ side view (facing right)
function drawSide(p, s, c, pose, f) {
  const walk = pose === 'walk';
  const dash = pose === 'dash';
  const bob = walk ? (f % 2 ? -1 : 0) : pose === 'idle' && f === 1 ? 1 : 0;
  const lean = dash ? 3 : walk ? 1 : 0;
  const robe = s.coatStyle === 'robe' || s.coatStyle === 'dress';
  // Leg phase: forward offset of the "front" leg (the back leg mirrors it).
  const stride = dash ? 5 : walk ? [0, 3, 0, -3][f] : 0;
  const liftF = walk && f === 3 ? 2 : 0;
  const liftB = walk && f === 1 ? 2 : 0;
  const hip = 46 + bob;

  const leg = (dx, lift, color) =>
    p.part((t) => {
      t.poly([[14.5, hip], [18, hip], [17.5 + dx, 57 - lift], [14 + dx, 57 - lift]]);
    }, color);
  const boot = (dx, lift) => p.part((t) => t.rect(13 + dx, 56 - lift, 6, 5).rect(15 + dx, 58 - lift, 6, 3), c.boots);

  // Back leg + back arm
  if (!robe) {
    leg(-stride, liftB, shade(c.pants, 0.8));
  }
  boot(-stride, liftB);
  const armSwing = dash ? -6 : walk ? [0, -2, 0, 2][f] : 0;
  p.part((t) => t.poly([[15, 32 + bob], [18, 32 + bob], [18 - armSwing * 0.4, 43 + bob], [15 - armSwing * 0.5, 43 + bob]]), shade(c.coat, 0.8));

  // Coat tail flutters behind when moving.
  const tail = dash ? 5 : walk ? 2 + (f % 2) : 0;
  if (s.coatStyle === 'long' || robe) p.part((t) => t.poly([[12 + lean, 38 + bob], [18 + lean, 38 + bob], [18, (robe ? 59 : 53) + bob], [11 - tail, (robe ? 58 : 52) + bob]]), c.coatD);
  // Torso (robes and dresses flare into a skirt that sways with the stride)
  if (robe) {
    const sway = walk ? [0, 1, 0, -1][f] : dash ? -3 : 0;
    p.part((t) => t.poly([[11 + lean, 31 + bob], [20 + lean, 31 + bob], [22 + sway, 59], [9 + sway - tail * 0.5, 59]]), c.coat);
    if (s.coatStyle === 'dress') p.part((t) => t.rect(9 + sway, 55, 13, 2), c.trim, { flat: true });
  } else p.part((t) => t.poly([[11 + lean, 31 + bob], [20 + lean, 31 + bob], [19 + lean * 0.5, 47 + bob], [12, 47 + bob]]), c.coat);
  if (s.coatStyle === 'apron') p.part((t) => t.poly([[18 + lean, 35 + bob], [21 + lean, 35 + bob], [20, 52 + bob], [18, 52 + bob]]), c.apron);
  if (s.belt !== false && !robe) p.rect(12 + lean * 0.5, 42 + bob, 8, 2, s.beltColor ?? 0x2a1d17).rect(18 + lean * 0.5, 42 + bob, 2, 2, c.trim);
  if (s.scarf) p.part((t) => t.rect(13 + lean, 30 + bob, 8, 3).poly([[13 + lean, 31 + bob], [10 - tail, 33 + bob + (f % 2)], [9 - tail, 36 + bob], [13 + lean, 34 + bob]]), s.scarf);

  // Front leg
  if (!robe) leg(stride, liftF, c.pants);
  boot(stride, liftF);

  // Head
  const hx = lean;
  const hy = bob;
  p.part((t) => t.rect(14 + hx, 27 + hy, 4, 4), c.skinD, { flat: true });
  p.part((t) => t.ellipse(16.5 + hx, 22 + hy, 6.3, 7).rect(21 + hx, 24 + hy, 2, 2), c.skin);
  if (s.hairStyle === 'bob' || s.hairStyle === 'long') p.part((t) => t.ellipse(15 + hx, 19 + hy, 6.5, 5).rect(10 + hx, 19 + hy, 5, s.hairStyle === 'long' ? 16 : 9), c.hair);
  else if (s.hairStyle === 'short') p.part((t) => t.ellipse(15.5 + hx, 18.5 + hy, 6.5, 4.2).rect(10.5 + hx, 18 + hy, 3, 6), c.hair);
  else if (s.hairStyle === 'bun') p.part((t) => t.ellipse(15.5 + hx, 18.5 + hy, 6.5, 4.2).disc(11 + hx, 16 + hy, 3), c.hair);
  const ec = s.glowEyes ?? EYE;
  p.rect(19 + hx, 22 + hy, 2, 3, ec);
  if (!s.glowEyes) p.px(19 + hx, 22 + hy, 0xffffff);
  p.px(15 + hx, 24 + hy, c.skinD).px(15 + hx, 25 + hy, c.skinD); // ear
  if (!s.beard) p.px(21 + hx, 27 + hy, shade(c.skin, 0.62));
  if (s.eyepatch) p.line(12 + hx, 19 + hy, 22 + hx, 20 + hy, 0x1a1414);
  if (s.monocle) p.ring(20 + hx, 23.5 + hy, 2.3, c.trim, 0.9);
  if (s.goggles === 'eyes') p.ring(20 + hx, 23.5 + hy, 2.5, 0x7a5a17, 1).line(11 + hx, 23 + hy, 17 + hx, 23 + hy, 0x3a2a1a);
  if (s.beard === 'full') p.part((t) => t.poly([[15 + hx, 25 + hy], [23 + hx, 25 + hy], [21 + hx, 32 + hy], [16 + hx, 34 + hy]]), s.beardColor ?? c.hair);
  if (s.beard === 'stache') p.rect(19 + hx, 26 + hy, 4, 1, s.beardColor ?? c.hair);

  drawHat(p, s, c, 'side', hy, hx);

  // Front arm (swings opposite the front leg)
  p.part((t) => t.poly([[15 + lean, 32 + bob], [18 + lean, 32 + bob], [18 + lean + armSwing, 43 + bob], [15 + lean + armSwing, 43 + bob]]), c.coat);
  p.part((t) => t.disc(16.5 + lean + armSwing, 44.5 + bob, 1.8), c.skin);
}

// ------------------------------------------------------------------ hats
function drawHat(p, s, c, view, hy, hx = 0) {
  const side = view === 'side';
  const back = view === 'up';
  const cx = 16 + hx + (side ? 0.5 : 0);
  switch (s.hat) {
    case 'top':
      p.part((t) => t.poly([[cx - 5, 3 + hy], [cx + 5, 3 + hy], [cx + 4.5, 15 + hy], [cx - 4.5, 15 + hy]]), c.hat);
      p.part((t) => t.rect(cx - 5, 11 + hy, 10, 2), c.band, { flat: true });
      p.part((t) => t.ellipse(cx, 15.5 + hy, 9.5, 2.3), shade(c.hat, 1.15));
      if (s.goggles === 'hat' && !back) {
        if (side) p.disc(cx + 3.5, 12 + hy, 2.3, 0x7a5a17).disc(cx + 3.5, 12 + hy, 1.4, 0x9fe8ff);
        else p.disc(cx - 2.7, 12 + hy, 2.3, 0x7a5a17).disc(cx + 2.7, 12 + hy, 2.3, 0x7a5a17).disc(cx - 2.7, 12 + hy, 1.4, 0x9fe8ff).disc(cx + 2.7, 12 + hy, 1.4, 0x9fe8ff);
      }
      break;
    case 'cap':
      p.part((t) => t.ellipse(cx - (side ? 1 : 0), 15.5 + hy, 8, 5), c.hat);
      if (!back) p.part((t) => (side ? t.rect(cx + 3, 17 + hy, 6, 2) : t.ellipse(cx, 19 + hy, 7, 1.6)), shade(c.hat, 0.7), { flat: true });
      p.px(cx, 11 + hy, c.band);
      break;
    case 'bowler':
      p.part((t) => t.ellipse(cx, 14 + hy, 6.2, 5.5).rect(cx - 6, 14 + hy, 12, 3), c.hat);
      p.part((t) => t.rect(cx - 6, 15 + hy, 12, 1), c.band, { flat: true });
      p.part((t) => t.ellipse(cx, 17.5 + hy, 8.5, 1.7), shade(c.hat, 1.1));
      break;
    case 'bandana':
      p.part((t) => t.ellipse(cx, 17 + hy, 7.2, 4).rect(cx - 7, 17 + hy, 14, 2), c.hat);
      if (!side || true) p.part((t) => t.poly(side ? [[cx - 6, 18 + hy], [cx - 11, 21 + hy], [cx - 10, 24 + hy], [cx - 5, 20 + hy]] : [[cx + 6, 18 + hy], [cx + 10, 21 + hy], [cx + 9, 24 + hy], [cx + 5, 20 + hy]]), shade(c.hat, 0.85));
      break;
    case 'veil':
      p.part((t) => t.ellipse(cx, 11 + hy, 5.5, 5), c.hat);
      p.part((t) => t.ellipse(cx, 15 + hy, 12, 3), shade(c.hat, 1.2));
      if (!back) {
        // Mesh veil over the face.
        for (let y = 17; y < 28; y++) for (let x = cx - 7; x < cx + 7; x++) if ((x + y) % 2 === 0) p.px(x, y + hy, 0x14101a, 0.55);
      }
      p.disc(cx + (side ? -3 : 5), 12 + hy, 1.6, s.accent ?? 0xb03fd9);
      break;
    case 'hood':
      if (back || side) p.part((t) => t.ellipse(cx - (side ? 1.5 : 0), 21 + hy, 8, 9).poly([[cx - 8, 22 + hy], [cx + (side ? 2 : 8), 22 + hy], [cx + 9, 33 + hy], [cx - 9, 33 + hy]]), c.hat);
      else {
        p.part((t) => t.ellipse(cx, 21 + hy, 8.5, 9).poly([[cx - 8, 24 + hy], [cx + 8, 24 + hy], [cx + 10, 33 + hy], [cx - 10, 33 + hy]]), c.hat);
        p.ellipse(cx, 23.5 + hy, 5, 5.2, 0x140e12);
        p.rect(cx - 3.5, 22 + hy, 2, 2, s.glowEyes ?? 0x8fd14f).rect(cx + 1.5, 22 + hy, 2, 2, s.glowEyes ?? 0x8fd14f);
      }
      if (side) {
        p.ellipse(cx + 3, 23.5 + hy, 3, 4.8, 0x140e12);
        p.rect(cx + 3, 22 + hy, 2, 2, s.glowEyes ?? 0x8fd14f);
      }
      break;
    case 'goggles':
      if (!back) {
        p.line(cx - 7, 17 + hy, cx + 7, 17 + hy, 0x3a2a1a);
        if (side) p.disc(cx + 3, 17 + hy, 2.3, 0x7a5a17).disc(cx + 3, 17 + hy, 1.4, 0x9fe8ff);
        else p.disc(cx - 3, 17 + hy, 2.3, 0x7a5a17).disc(cx + 3, 17 + hy, 2.3, 0x7a5a17).disc(cx - 3, 17 + hy, 1.4, 0x9fe8ff).disc(cx + 3, 17 + hy, 1.4, 0x9fe8ff);
      } else p.line(cx - 7, 18 + hy, cx + 7, 18 + hy, 0x3a2a1a);
      break;
    default:
      break;
  }
}

/** Draw one frame; returns a Pix. */
export function drawCharacterFrame(spec, view, pose, frame) {
  const p = new Pix(CHAR_W, CHAR_H);
  const c = palette(spec);
  if (view === 'side') drawSide(p, spec, c, pose, frame);
  else drawFrontBack(p, spec, c, view, pose, frame);
  p.outline(OUTLINE);
  return p;
}

export const CHAR_FRAMES = [
  ...['down', 'up', 'side'].flatMap((v) => ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3'].map((f) => [v, f])),
  ['side', 'dash0'],
];

/** Register every frame for a spec under `${prefix}_${view}_${pose}`. */
export function registerCharacter(scene, prefix, spec) {
  for (const [view, pf] of CHAR_FRAMES) {
    const pose = pf.replace(/\d$/, '');
    const frame = Number(pf.slice(-1));
    drawCharacterFrame(spec, view, pose, frame).toTexture(scene, `${prefix}_${view}_${pf}`);
  }
}

// ------------------------------------------------------------------ specs
export const CHARACTER_SPECS = {
  tinker: { coat: 0xd9902a, trim: 0xf2cf6b, hair: 0x6e3a1e, hairStyle: 'bob', hat: 'top', hatColor: 0x2a1d17, hatBand: 0xc99a2e, goggles: 'hat', coatStyle: 'long', pants: 0x4a3a30, pouches: true },
  stoker: { coat: 0x8a2e22, trim: 0xc99a2e, skin: 0xd09470, hair: 0x2a1d17, hairStyle: 'bald', hat: 'bandana', hatColor: 0xc2452a, build: 2, coatStyle: 'apron', apron: 0x5a3a24, beard: 'stache', pants: 0x3a3030 },
  courier: { coat: 0x2f8aa0, trim: 0xe6e9e4, skin: 0xc08a60, hair: 0x2a1d17, hairStyle: 'short', hat: 'cap', hatColor: 0x1f5e70, hatBand: 0xf2cf6b, coatStyle: 'short', scarf: 0xe0588a, pants: 0x2e3440 },
  artificer: { coat: 0x3f7a4a, trim: 0xf2cf6b, hair: 0xd9d2c3, hairStyle: 'short', hat: 'bowler', hatColor: 0x2e2a26, hatBand: 0x7a5a17, beard: 'full', beardColor: 0xe6ddc8, monocle: true, coatStyle: 'long', pouches: true, build: 1 },
  widow: { coat: 0x2e1f38, trim: 0xb03fd9, skin: 0xe6dcd6, hair: 0x14101a, hairStyle: 'long', hat: 'veil', hatColor: 0x16121c, coatStyle: 'dress', glowEyes: 0xd08aff, accent: 0xb03fd9 },
};

export const NPC_SPECS = {
  tinkerer: { coat: 0x2f6e80, apron: 0x6e4a2e, coatStyle: 'apron', hair: 0xc2452a, hairStyle: 'bun', hat: 'goggles', trim: 0xf2cf6b, pouches: true },
  gunsmith: { coat: 0x5a2a22, apron: 0x3a2a1e, coatStyle: 'apron', skin: 0xc08a60, hair: 0x2a1d17, hairStyle: 'short', beard: 'stache', eyepatch: true, build: 2, hat: 'none' },
  alchemist: { coat: 0x4a2e5a, coatStyle: 'robe', hat: 'hood', hatColor: 0x3a2448, trim: 0x8fd14f, glowEyes: 0x8fd14f },
  clockmaker: { coat: 0x6e5a3a, trim: 0xf2cf6b, hair: 0xe6ddc8, hairStyle: 'short', beard: 'full', beardColor: 0xe6ddc8, monocle: true, coatStyle: 'long', hat: 'none' },
  shopkeeper: { coat: 0x2e6e5a, trim: 0xf2cf6b, hair: 0x5a3a24, hairStyle: 'short', beard: 'stache', hat: 'bowler', hatColor: 0x1e2a24, coatStyle: 'short', apron: 0xd9d2c3 },
};

/** Deterministic townsfolk variety. */
export function townieSpec(i) {
  const coats = [0x7a5a3a, 0x3a5a7a, 0x6a3a5a, 0x4a6a3a, 0x8a4a2a, 0x5a5a6a, 0x7a3a3a, 0x3a6a6a];
  const skins = [0xe8b48a, 0xc08a60, 0x8a5a3a, 0xf0c8a0, 0xd8a070, 0xa06a48];
  const hairs = [0x2a1d17, 0x5a4030, 0x1a1a1a, 0x7a6a50, 0xa0522d, 0xd9d2c3];
  const hats = ['top', 'cap', 'bowler', 'none', 'none', 'bandana'];
  const styles = ['long', 'short', 'dress', 'long', 'short'];
  const hairStyles = ['short', 'bob', 'bun', 'long', 'bald'];
  const pick = (arr, n) => arr[(i * n + 3) % arr.length];
  return {
    coat: pick(coats, 5), skin: pick(skins, 7), hair: pick(hairs, 3), hairStyle: pick(hairStyles, 2), hat: pick(hats, 5),
    hatColor: shade(pick(coats, 3), 0.6), coatStyle: pick(styles, 3), beard: i % 4 === 1 ? 'stache' : i % 7 === 3 ? 'full' : null,
    scarf: i % 5 === 2 ? 0xe6ddc8 : null, pants: shade(pick(coats, 11), 0.5),
  };
}
