// Tiny pixel-art canvas API used to procedurally author every sprite in the game.
// Shapes are drawn with hard pixels; `outline()` adds the soot-black contour that keeps
// sprites readable against busy floors.

export function hex(c) {
  return `#${c.toString(16).padStart(6, '0')}`;
}

export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  px(x, y, c, a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.ctx.globalAlpha = a;
    this.ctx.fillStyle = typeof c === 'number' ? hex(c) : c;
    this.ctx.fillRect(x, y, 1, 1);
    this.ctx.globalAlpha = 1;
    return this;
  }

  rect(x, y, w, h, c, a = 1) {
    this.ctx.globalAlpha = a;
    this.ctx.fillStyle = typeof c === 'number' ? hex(c) : c;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    this.ctx.globalAlpha = 1;
    return this;
  }

  /** Filled pixel disc (centre may be fractional for even sizes). */
  disc(cx, cy, r, c, a = 1) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.px(x, y, c, a);
      }
    }
    return this;
  }

  ellipse(cx, cy, rx, ry, c, a = 1) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.px(x, y, c, a);
      }
    }
    return this;
  }

  ring(cx, cy, r, c, thick = 1, a = 1) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
        if (d <= r && d > r - thick) this.px(x, y, c, a);
      }
    }
    return this;
  }

  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  /** A cog: body disc + square teeth, optional hub hole. */
  gear(cx, cy, r, teeth, c, cDark, hub = 0, rot = 0) {
    for (let i = 0; i < teeth; i++) {
      const a = rot + (i / teeth) * Math.PI * 2;
      for (let t = -0.9; t <= 0.9; t += 0.3) {
        const aa = a + (t * Math.PI) / teeth / 1.6;
        this.px(cx - 0.5 + Math.cos(aa) * (r + 1), cy - 0.5 + Math.sin(aa) * (r + 1), c);
        this.px(cx - 0.5 + Math.cos(aa) * r, cy - 0.5 + Math.sin(aa) * r, c);
      }
    }
    this.disc(cx, cy, r, c);
    this.ring(cx, cy, r - 1, cDark, 1);
    if (hub > 0) {
      this.disc(cx, cy, hub + 1, cDark);
      this.clearDisc(cx, cy, hub);
    }
    return this;
  }

  /** Clear pixels inside a disc (for holes). */
  clearDisc(cx, cy, r) {
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
      for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) this.ctx.clearRect(x, y, 1, 1);
      }
    }
    return this;
  }

  /** Paint an ASCII sprite using a palette {char: color}. '.' / ' ' are transparent. */
  ascii(rows, pal, ox = 0, oy = 0, flip = false) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c === undefined) continue;
        this.px(ox + (flip ? row.length - 1 - x : x), oy + y, c);
      }
    });
    return this;
  }

  /** Add a 1px outline around all opaque pixels. */
  outline(c = 0x14110f, diagonal = false) {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < this.w && y < this.h && d[(y * this.w + x) * 4 + 3] > 40;
    const pts = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) || (diagonal && (solid(x - 1, y - 1) || solid(x + 1, y + 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1)))) pts.push([x, y]);
      }
    }
    for (const [x, y] of pts) this.px(x, y, c);
    return this;
  }

  /** Lighten the top-left edge of shapes for a cheap bevel/highlight. */
  highlight(c, alpha = 1) {
    const img = this.ctx.getImageData(0, 0, this.w, this.h);
    const d = img.data;
    const a = (x, y) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : d[(y * this.w + x) * 4 + 3]);
    const pts = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (a(x, y) > 40 && (a(x, y - 1) < 40 || a(x - 1, y) < 40)) pts.push([x, y]);
    for (const [x, y] of pts) this.px(x, y, c, alpha);
    return this;
  }

  /** Register as a Phaser texture (replacing any existing one). */
  toTexture(scene, key) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, this.canvas);
    return key;
  }
}
