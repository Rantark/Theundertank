// Pixel-art canvas API used to procedurally author every sprite in the game.
//
// A Pix has a logical size (w x h) and a density k: the backing canvas is (w*k) x (h*k).
// Shapes (discs, gears, lines...) are rasterised at the real resolution, so drawing the
// same logical shape at k=2 gives smoother curves, while `px`/`ascii` fill k x k blocks.
// `outline()` always adds a 1-real-pixel contour, keeping sprites crisp and readable.
// `part()` draws one shaded body part (lit from the top-left) for hand-authored art.

export function hex(c) {
  return `#${(c >>> 0).toString(16).padStart(6, '0')}`;
}

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

export class Pix {
  constructor(w, h, k = 1) {
    this.w = w;
    this.h = h;
    this.k = k;
    this.W = Math.round(w * k);
    this.H = Math.round(h * k);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  style(c, a) {
    this.ctx.globalAlpha = a;
    this.ctx.fillStyle = typeof c === 'number' ? hex(c) : c;
  }

  /** Fill one real pixel. */
  rp(x, y, c, a = 1) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return this;
    this.style(c, a);
    this.ctx.fillRect(x, y, 1, 1);
    this.ctx.globalAlpha = 1;
    return this;
  }

  /** Fill one logical pixel (a k x k block). */
  px(x, y, c, a = 1) {
    const k = this.k;
    this.style(c, a);
    this.ctx.fillRect(Math.round(Math.round(x) * k), Math.round(Math.round(y) * k), Math.ceil(k), Math.ceil(k));
    this.ctx.globalAlpha = 1;
    return this;
  }

  rect(x, y, w, h, c, a = 1) {
    const k = this.k;
    this.style(c, a);
    this.ctx.fillRect(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k));
    this.ctx.globalAlpha = 1;
    return this;
  }

  /** Iterate real pixels whose centres satisfy fn(logicalX, logicalY). */
  fillWhere(x0, y0, x1, y1, fn, c, a = 1) {
    const k = this.k;
    this.style(c, a);
    const X0 = Math.max(0, Math.floor(x0 * k));
    const Y0 = Math.max(0, Math.floor(y0 * k));
    const X1 = Math.min(this.W - 1, Math.ceil(x1 * k));
    const Y1 = Math.min(this.H - 1, Math.ceil(y1 * k));
    for (let Y = Y0; Y <= Y1; Y++) {
      for (let X = X0; X <= X1; X++) if (fn((X + 0.5) / k, (Y + 0.5) / k)) this.ctx.fillRect(X, Y, 1, 1);
    }
    this.ctx.globalAlpha = 1;
    return this;
  }

  disc(cx, cy, r, c, a = 1) {
    return this.fillWhere(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r, c, a);
  }

  ellipse(cx, cy, rx, ry, c, a = 1) {
    return this.fillWhere(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c, a);
  }

  ring(cx, cy, r, c, thick = 1, a = 1) {
    return this.fillWhere(cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1, (x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      return d <= r && d > r - thick;
    }, c, a);
  }

  /** Filled convex/concave polygon from logical points. */
  poly(pts, c, a = 1) {
    const k = this.k;
    this.style(c, a);
    const ctx = this.ctx;
    // Rasterise with an even-odd scanline test so edges stay pixel-hard.
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const inside = (x, y) => {
      let hit = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i];
        const [xj, yj] = pts[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    const X0 = Math.max(0, Math.floor(Math.min(...xs) * k));
    const X1 = Math.min(this.W - 1, Math.ceil(Math.max(...xs) * k));
    const Y0 = Math.max(0, Math.floor(Math.min(...ys) * k));
    const Y1 = Math.min(this.H - 1, Math.ceil(Math.max(...ys) * k));
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) if (inside((X + 0.5) / k, (Y + 0.5) / k)) ctx.fillRect(X, Y, 1, 1);
    ctx.globalAlpha = 1;
    return this;
  }

  /** Thick line (thickness in logical pixels) rasterised at real resolution. */
  line(x0, y0, x1, y1, c, a = 1, thick = 1) {
    const k = this.k;
    const t = Math.max(1, Math.round(thick * k));
    this.style(c, a);
    let X0 = Math.round(x0 * k + (k - 1) / 2);
    let Y0 = Math.round(y0 * k + (k - 1) / 2);
    const X1 = Math.round(x1 * k + (k - 1) / 2);
    const Y1 = Math.round(y1 * k + (k - 1) / 2);
    const dx = Math.abs(X1 - X0);
    const dy = -Math.abs(Y1 - Y0);
    const sx = X0 < X1 ? 1 : -1;
    const sy = Y0 < Y1 ? 1 : -1;
    let err = dx + dy;
    const o = Math.floor((t - 1) / 2);
    for (;;) {
      this.ctx.fillRect(X0 - o, Y0 - o, t, t);
      if (X0 === X1 && Y0 === Y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        X0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        Y0 += sy;
      }
    }
    this.ctx.globalAlpha = 1;
    return this;
  }

  /** A cog: body disc + square-ish teeth, optional hub hole. Rasterised analytically. */
  gear(cx, cy, r, teeth, c, cDark, hub = 0, rot = 0) {
    const tooth = (x, y) => {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) return true;
      if (d > r + 1.4) return false;
      const a = Math.atan2(y - cy, x - cx) - rot;
      const f = ((a / (Math.PI * 2)) * teeth) % 1;
      const ff = f < 0 ? f + 1 : f;
      return ff > 0.25 && ff < 0.75;
    };
    this.fillWhere(cx - r - 2, cy - r - 2, cx + r + 2, cy + r + 2, tooth, c);
    this.ring(cx, cy, r - 0.6, cDark, 0.8);
    if (hub > 0) {
      this.disc(cx, cy, hub + 0.9, cDark);
      this.clearDisc(cx, cy, hub);
    }
    return this;
  }

  clearDisc(cx, cy, r) {
    const k = this.k;
    for (let Y = Math.floor((cy - r - 1) * k); Y <= Math.ceil((cy + r + 1) * k); Y++) {
      for (let X = Math.floor((cx - r - 1) * k); X <= Math.ceil((cx + r + 1) * k); X++) {
        if (((X + 0.5) / k - cx) ** 2 + ((Y + 0.5) / k - cy) ** 2 <= r * r) this.ctx.clearRect(X, Y, 1, 1);
      }
    }
    return this;
  }

  clearRect(x, y, w, h) {
    const k = this.k;
    this.ctx.clearRect(Math.round(x * k), Math.round(y * k), Math.round(w * k), Math.round(h * k));
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

  /**
   * Draw a shaded body part. `draw(tmp)` paints the part's silhouette (any colour) into a
   * scratch Pix of the same geometry; the silhouette is then filled with a three-tone
   * ramp: highlight on top/left edges, shadow on bottom/right edges, base elsewhere.
   */
  part(draw, base, o = {}) {
    const tmp = new Pix(this.w, this.h, this.k);
    draw(tmp);
    const d = tmp.ctx.getImageData(0, 0, this.W, this.H).data;
    const W = this.W;
    const H = this.H;
    const m = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 40;
    const light = o.light ?? shade(base, 1.28);
    const dark = o.dark ?? shade(base, 0.68);
    const deep = o.deep ?? 2;
    const ctx = this.ctx;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!m(x, y)) continue;
        let c = base;
        const bottom = !m(x, y + 1) || (deep > 1 && !m(x, y + 2));
        const right = !m(x + 1, y);
        const top = !m(x, y - 1);
        const left = !m(x - 1, y);
        if (!o.flat) {
          if (bottom || right) c = dark;
          if ((top || left) && !bottom) c = light;
        }
        ctx.globalAlpha = o.alpha ?? 1;
        ctx.fillStyle = hex(c);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
    return this;
  }

  /** Add a 1-real-pixel outline around all opaque pixels. */
  outline(c = 0x14110f, diagonal = false) {
    const img = this.ctx.getImageData(0, 0, this.W, this.H);
    const d = img.data;
    const W = this.W;
    const H = this.H;
    const solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 40;
    const pts = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) || (diagonal && (solid(x - 1, y - 1) || solid(x + 1, y + 1) || solid(x + 1, y - 1) || solid(x - 1, y + 1)))) pts.push([x, y]);
      }
    }
    this.ctx.fillStyle = hex(c);
    for (const [x, y] of pts) this.ctx.fillRect(x, y, 1, 1);
    return this;
  }

  /** Lighten the top-left edge of shapes for a cheap bevel/highlight. */
  highlight(c, alpha = 1) {
    const img = this.ctx.getImageData(0, 0, this.W, this.H);
    const d = img.data;
    const W = this.W;
    const H = this.H;
    const a = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : d[(y * W + x) * 4 + 3]);
    const pts = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (a(x, y) > 40 && (a(x, y - 1) < 40 || a(x - 1, y) < 40)) pts.push([x, y]);
    for (const [x, y] of pts) this.rp(x, y, c, alpha);
    return this;
  }

  /** Scatter subtle noise over opaque pixels (surface wear). */
  grain(seed, amount = 0.08, strength = 0.12) {
    const img = this.ctx.getImageData(0, 0, this.W, this.H);
    const d = img.data;
    let s = seed >>> 0 || 1;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 40 || rnd() > amount) continue;
      const f = 1 + (rnd() < 0.5 ? -strength : strength);
      d[i] = Math.min(255, d[i] * f);
      d[i + 1] = Math.min(255, d[i + 1] * f);
      d[i + 2] = Math.min(255, d[i + 2] * f);
    }
    this.ctx.putImageData(img, 0, 0);
    return this;
  }

  /** Copy another Pix onto this one (real pixel offsets), optionally mirrored. */
  blit(src, dx = 0, dy = 0, flipX = false) {
    const ctx = this.ctx;
    ctx.save();
    if (flipX) {
      ctx.translate(dx + src.W, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(src.canvas, 0, 0);
    } else ctx.drawImage(src.canvas, dx, dy);
    ctx.restore();
    return this;
  }

  /** Register as a Phaser texture (replacing any existing one). */
  toTexture(scene, key) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas(key, this.canvas);
    return key;
  }
}
