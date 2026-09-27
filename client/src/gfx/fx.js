// GAME FEEL: particles, muzzle flashes, lightning, screen shake, floating numbers.
// Driven by simulation events; purely cosmetic.
import { text } from '../ui/text.js';
import { App } from '../state.js';

const SPARK_TINTS = [0xfff2b0, 0xffc93c, 0xffffff];

export class Fx {
  constructor(scene, depth = 50) {
    this.scene = scene;
    this.shakeAmt = 0;
    this.bolts = [];
    this.floaters = [];
    const add = (tex, cfg, d = depth) => {
      const e = scene.add.particles(0, 0, tex, { emitting: false, ...cfg });
      e.setDepth(d);
      return e;
    };
    this.sparks = add('px', { speed: { min: 40, max: 140 }, lifespan: { min: 120, max: 280 }, scale: { start: 1, end: 0 }, tint: SPARK_TINTS, blendMode: 'ADD' });
    this.esparks = add('px', { speed: { min: 20, max: 70 }, lifespan: { min: 100, max: 220 }, scale: { start: 1, end: 0 }, tint: [0xff2e63, 0xffd1dc] });
    this.steam = add('puff', { speed: { min: 8, max: 30 }, lifespan: { min: 500, max: 900 }, scale: { start: 0.5, end: 1.6 }, alpha: { start: 0.55, end: 0 }, tint: 0xe6e9e4 }, depth - 1);
    this.smoke = add('puff', { speed: { min: 6, max: 20 }, lifespan: { min: 600, max: 1100 }, scale: { start: 0.6, end: 2 }, alpha: { start: 0.5, end: 0 }, tint: 0x3a332d }, depth - 1);
    this.fire = add('puff', { speed: { min: 20, max: 70 }, lifespan: { min: 200, max: 450 }, scale: { start: 1.2, end: 0.2 }, alpha: { start: 1, end: 0 }, tint: [0xffd08a, 0xff9c3a, 0xff5a1f], blendMode: 'ADD' });
    this.debris = add('gearbit', { speed: { min: 50, max: 150 }, lifespan: { min: 300, max: 600 }, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.4 }, tint: [0xc99a2e, 0xb8683a, 0x8a8178] });
    this.electric = add('px', { speed: { min: 30, max: 90 }, lifespan: { min: 100, max: 250 }, scale: { start: 1, end: 0 }, tint: [0x6ff0ff, 0xffffff], blendMode: 'ADD' });
    this.heal = add('px', { speedY: { min: -40, max: -15 }, speedX: { min: -12, max: 12 }, lifespan: 600, scale: { start: 1.2, end: 0 }, tint: [0x8fd14f, 0xd0ffb0] });
    this.gold = add('px', { speed: { min: 20, max: 60 }, lifespan: 400, scale: { start: 1, end: 0 }, tint: [0xffe08a, 0xffffff], blendMode: 'ADD' });
    this.ember = add('px', { speedY: { min: -30, max: -10 }, speedX: { min: -8, max: 8 }, lifespan: 500, scale: { start: 1, end: 0 }, tint: [0xff9c3a, 0xffd08a], blendMode: 'ADD' });
    this.boltGfx = scene.add.graphics().setDepth(depth + 2).setBlendMode('ADD');
    this.flashes = scene.add.group();
  }

  shake(a) {
    this.shakeAmt = Math.min(12, this.shakeAmt + a * App.save.data.settings.shake);
  }

  /** Returns [dx, dy] camera offset for this frame. */
  shakeOffset(dt) {
    if (this.shakeAmt <= 0.05) {
      this.shakeAmt = 0;
      return [0, 0];
    }
    const a = this.shakeAmt;
    this.shakeAmt *= Math.exp(-dt * 10);
    return [(Math.random() * 2 - 1) * a, (Math.random() * 2 - 1) * a];
  }

  flash(x, y, tex = 'flash', o = {}) {
    const s = this.scene;
    const img = s.add.image(x, y, tex).setDepth(o.depth ?? 60).setBlendMode('ADD').setTint(o.tint ?? 0xffffff).setScale(o.scale ?? 1).setRotation(o.rot ?? 0);
    img.setAlpha(o.alpha ?? 1);
    s.tweens.add({ targets: img, alpha: 0, scale: (o.scale ?? 1) * (o.grow ?? 1.2), duration: o.dur ?? 80, onComplete: () => img.destroy() });
    return img;
  }

  ring(x, y, r, tint = 0xffffff, dur = 300) {
    const img = this.scene.add.image(x, y, 'ringfx').setDepth(61).setTint(tint).setScale(0.1).setBlendMode('ADD');
    this.scene.tweens.add({ targets: img, scale: (r * 2) / 32, alpha: 0, duration: dur, ease: 'Cubic.Out', onComplete: () => img.destroy() });
  }

  number(x, y, str, color = 0xffe08a) {
    const t = text(this.scene, x, y, str, { origin: [0.5, 1], color, depth: 70 });
    this.scene.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 650, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }

  bolt(pts) {
    this.bolts.push({ pts, t: 0.14, seed: Math.random() });
    for (const [x, y] of pts) this.electric.explode(4, x, y);
  }

  update(dt) {
    const g = this.boltGfx;
    g.clear();
    this.bolts = this.bolts.filter((b) => (b.t -= dt) > 0);
    for (const b of this.bolts) {
      const a = Math.min(1, b.t / 0.08);
      for (const [w, c] of [[3, 0x2a8aff], [1, 0xe8ffff]]) {
        g.lineStyle(w, c, a);
        g.beginPath();
        for (let i = 0; i < b.pts.length - 1; i++) {
          const [x0, y0] = b.pts[i];
          const [x1, y1] = b.pts[i + 1];
          const segs = 5;
          g.moveTo(x0, y0);
          for (let s = 1; s <= segs; s++) {
            const t = s / segs;
            const jx = s === segs ? 0 : (Math.random() - 0.5) * 7;
            const jy = s === segs ? 0 : (Math.random() - 0.5) * 7;
            g.lineTo(x0 + (x1 - x0) * t + jx, y0 + (y1 - y0) * t + jy);
          }
        }
        g.strokePath();
      }
    }
  }

  /** Map a simulation 'fx' event to particles. */
  event(e) {
    const { x, y } = e;
    switch (e.k) {
      case 'spark':
        this.sparks.explode(4, x, y);
        break;
      case 'esplat':
        this.esparks.explode(3, x, y);
        break;
      case 'puff':
        this.steam.explode(1, x, y);
        break;
      case 'dash':
        this.steam.explode(5, x, y);
        break;
      case 'spawn':
        this.steam.explode(8, x, y);
        this.ring(x, y, 12, 0xe6e9e4, 400);
        break;
      case 'steam':
        this.steam.explode(10, x, y);
        break;
      case 'steamburst':
        this.steam.explode(24, x, y);
        this.ring(x, y, e.r || 60, 0xe6e9e4, 350);
        break;
      case 'explosion': {
        const r = e.r || 20;
        this.fire.explode(Math.min(30, 8 + r / 2), x, y);
        this.smoke.explode(6, x, y);
        this.sparks.explode(8, x, y);
        this.flash(x, y, 'flash', { scale: r / 5, tint: 0xffd08a, dur: 140 });
        this.ring(x, y, r, 0xffc93c, 250);
        break;
      }
      case 'vent':
        this.steam.explode(18, x, y);
        this.ring(x, y, e.r || 14, 0xffffff, 300);
        break;
      case 'impact':
        this.smoke.explode(8, x, y);
        this.debris.explode(6, x, y);
        this.ring(x, y, e.r || 16, 0xff9c3a, 250);
        break;
      case 'land':
        this.smoke.explode(e.big ? 14 : 6, x, y);
        this.ring(x, y, e.big ? 40 : 18, 0xd9d2c3, 300);
        break;
      case 'blink':
        this.electric.explode(14, x, y);
        this.flash(x, y, 'flash', { tint: 0x6ff0ff, scale: 2 });
        break;
      case 'trail':
        this.smoke.explode(1, x, y);
        break;
      case 'ignite':
        this.fire.explode(5, x, y);
        break;
      case 'heal':
        this.heal.explode(12, x, y);
        break;
      case 'cog':
        this.gold.explode(5, x, y);
        break;
      case 'smoke':
        this.smoke.explode(30, x, y);
        break;
      case 'timestop':
        this.ring(x, y, 200, 0x9fe8ff, 600);
        break;
      case 'debris':
        this.debris.explode(4, x, y);
        break;
      case 'hurt':
        this.esparks.explode(8, x, y);
        break;
      default:
        break;
    }
  }
}
