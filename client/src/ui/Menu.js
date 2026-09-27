// Simple vertical menu driven by any input device.
import { App } from '../state.js';
import { text, setText, COLORS } from './text.js';

export class Menu {
  /**
   * @param {Phaser.Scene} scene
   * @param {Array} items [{ label, action?, value?(), left?(), right?(), disabled?() }]
   * @param {object} o { x, y, spacing, align ('left'|'center'), device (restrict input), depth }
   */
  constructor(scene, items, o = {}) {
    this.scene = scene;
    this.items = items;
    this.o = { x: 240, y: 140, spacing: 13, align: 'center', depth: 10, ...o };
    this.index = 0;
    this.texts = items.map((it, i) =>
      text(scene, this.o.x, this.o.y + i * this.o.spacing, '', { origin: [this.o.align === 'center' ? 0.5 : 0, 0], depth: this.o.depth }),
    );
    this.cursor = scene.add.image(0, 0, 'ui_cog').setDepth(this.o.depth);
    this.active = true;
    this.refresh();
  }

  refresh() {
    this.items.forEach((it, i) => {
      const v = it.value ? `  ${it.value()}` : '';
      const t = this.texts[i];
      setText(t, `${typeof it.label === 'function' ? it.label() : it.label}${v}`);
      const dis = it.disabled && it.disabled();
      t.setTint(i === this.index ? COLORS.brass : dis ? 0x5a5040 : COLORS.text);
    });
    const t = this.texts[this.index];
    if (t) {
      const left = this.o.align === 'center' ? t.x - t.width / 2 : t.x;
      this.cursor.setPosition(left - 8, t.y + 4);
      this.cursor.rotation += 0.0;
    }
  }

  update() {
    if (!this.active) return null;
    const inp = App.input;
    const dev = this.o.device || null;
    this.cursor.rotation += 0.05;
    let moved = false;
    if (inp.menu('up', dev)) {
      this.index = (this.index - 1 + this.items.length) % this.items.length;
      moved = true;
    }
    if (inp.menu('down', dev)) {
      this.index = (this.index + 1) % this.items.length;
      moved = true;
    }
    const it = this.items[this.index];
    if (inp.menu('left', dev) && it.left) {
      it.left();
      moved = true;
    }
    if (inp.menu('right', dev) && it.right) {
      it.right();
      moved = true;
    }
    // Mouse hover/click support.
    const m = inp.mouse;
    if (m.moved || m.leftPressed) {
      const px = this.scene.input.activePointer;
      this.texts.forEach((t, i) => {
        const b = t.getBounds();
        if (px.x >= b.x - 10 && px.x <= b.right + 4 && px.y >= b.y - 2 && px.y <= b.bottom + 2) {
          if (this.index !== i) {
            this.index = i;
            moved = true;
          }
          if (m.leftPressed) this.clicked = true;
        }
      });
    }
    if (moved) {
      App.audio.play('ui_move');
      this.refresh();
    }
    if (inp.menu('confirm', dev) || this.clicked) {
      this.clicked = false;
      if (it.disabled && it.disabled()) {
        App.audio.play('deny');
        return null;
      }
      App.audio.play('ui_ok');
      if (it.action) it.action();
      this.refresh();
      return it;
    }
    return null;
  }

  destroy() {
    this.texts.forEach((t) => t.destroy());
    this.cursor.destroy();
  }
}
