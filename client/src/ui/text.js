// Bitmap-text helpers (all text uses the procedural 'px' font).
export const COLORS = {
  text: 0xf2e6c8,
  dim: 0x9a8f7a,
  brass: 0xf2cf6b,
  copper: 0xe39a63,
  verdigris: 0x7fd6b8,
  red: 0xff5a5a,
  cyan: 0x6ff0ff,
  purple: 0xd08aff,
  common: 0xd9d2c3,
  rare: 0x4fc3d9,
  legendary: 0xffc93c,
  cursed: 0xc26bff,
};

/**
 * Create bitmap text. Options: color, scale, origin [x,y], shadow (bool), maxWidth, depth.
 */
export function text(scene, x, y, str, o = {}) {
  const t = scene.add.bitmapText(x, y, 'px', String(str).toUpperCase(), 9 * (o.scale || 1));
  t.setTint(o.color ?? COLORS.text);
  if (o.origin) t.setOrigin(o.origin[0], o.origin[1]);
  if (o.maxWidth) t.setMaxWidth(o.maxWidth);
  if (o.shadow !== false && t.setDropShadow) t.setDropShadow(1, 1, 0x000000, 1);
  if (o.depth !== undefined) t.setDepth(o.depth);
  if (o.align !== undefined) t.setCenterAlign ? (o.align === 1 ? t.setCenterAlign() : t.setLeftAlign()) : null;
  return t;
}

export function setText(t, str) {
  t.setText(String(str).toUpperCase());
  return t;
}

/** Draw a steampunk panel (soot fill + brass rim) into a Graphics object. */
export function panel(g, x, y, w, h, o = {}) {
  g.fillStyle(o.fill ?? 0x16120f, o.alpha ?? 0.92);
  g.fillRect(x, y, w, h);
  g.lineStyle(1, o.rim ?? 0x7a5a17, 1);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.lineStyle(1, o.rim2 ?? 0xc99a2e, 0.6);
  g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  // Corner rivets
  g.fillStyle(0xf2cf6b, 1);
  for (const [cx, cy] of [[x + 3, y + 3], [x + w - 4, y + 3], [x + 3, y + h - 4], [x + w - 4, y + h - 4]]) g.fillRect(cx, cy, 1, 1);
  return g;
}

export const rarityColor = (r) => COLORS[r] ?? COLORS.text;
