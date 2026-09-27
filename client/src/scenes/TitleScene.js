import Phaser from 'phaser';
import { App } from '../state.js';
import { text, COLORS } from '../ui/text.js';
import { Menu } from '../ui/Menu.js';

// Title screen: whoever presses first becomes Player 1.
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0d0b0a');
    // Slowly turning background gears.
    this.gears = [];
    const spots = [[40, 50, 3, 0x3a2a1a], [440, 60, 4, 0x2e2418], [420, 230, 3, 0x3a2a1a], [70, 220, 5, 0x2a2016], [240, 290, 7, 0x1e1812]];
    for (const [x, y, s, c] of spots) {
      const g = this.add.image(x, y, 'cog5').setScale(s).setTint(c);
      g.spin = (Math.random() < 0.5 ? -1 : 1) * (0.2 / s);
      this.gears.push(g);
    }
    this.steam = this.add.particles(0, 0, 'puff', {
      x: { min: 0, max: 480 }, y: 280, speedY: { min: -30, max: -12 }, speedX: { min: -6, max: 6 },
      lifespan: 6000, scale: { start: 1, end: 5 }, alpha: { start: 0.12, end: 0 }, frequency: 180, tint: 0xe6e9e4,
    });
    this.add.image(240, 64, 'gate').setScale(1.2).setAlpha(0.35);
    text(this, 240, 40, 'THE', { scale: 1, origin: [0.5, 0.5], color: COLORS.copper });
    text(this, 240, 62, 'UNDERCRANK', { scale: 3, origin: [0.5, 0.5], color: COLORS.brass });
    text(this, 240, 88, 'A CLOCKWORK ROGUELIKE', { origin: [0.5, 0.5], color: COLORS.verdigris });

    this.prompt = text(this, 240, 160, 'PRESS ANY KEY OR BUTTON', { origin: [0.5, 0.5] });
    this.menu = null;
    const best = App.save.data.best.depth;
    text(this, 240, 256, `COGS ${App.save.data.cogs}   RUNS ${App.save.data.runs}   DEEPEST FLOOR ${best}`, { origin: [0.5, 0.5], color: COLORS.dim });
    this.started = false;
  }

  openMenu() {
    this.prompt.destroy();
    App.audio.setMood('title');
    this.menu = new Menu(this, [
      { label: 'PLAY  (SOLO / COUCH CO-OP)', action: () => this.go('local') },
      { label: 'ONLINE CO-OP', action: () => this.go('online') },
      { label: 'SFX VOLUME', value: () => `${Math.round(App.save.data.settings.sfx * 10)}`, left: () => this.vol('sfx', -0.1), right: () => this.vol('sfx', 0.1), action: () => this.vol('sfx', 0.1, true) },
      { label: 'MUSIC VOLUME', value: () => `${Math.round(App.save.data.settings.music * 10)}`, left: () => this.vol('music', -0.1), right: () => this.vol('music', 0.1), action: () => this.vol('music', 0.1, true) },
      { label: 'SCREEN SHAKE', value: () => `${Math.round(App.save.data.settings.shake * 100)}%`, left: () => this.vol('shake', -0.25), right: () => this.vol('shake', 0.25), action: () => this.vol('shake', 0.25, true) },
    ], { y: 130, device: App.input.slots[0] });
    this.help = text(this, 240, 216, '', { origin: [0.5, 0.5], color: COLORS.dim, maxWidth: 460 });
    this.help.setText(
      App.input.slots[0] === 'kbm'
        ? 'WASD MOVE - MOUSE/ARROWS AIM+SHOOT - SPACE DASH - Q ACTIVE - F CONSUMABLE - E INTERACT - C PING'
        : 'L-STICK MOVE - R-STICK AIM+SHOOT - A DASH - Y ACTIVE - LB CONSUMABLE - X INTERACT - UP PING',
    );
  }

  vol(key, d, wrap = false) {
    const s = App.save.data.settings;
    const max = key === 'shake' ? 2 : 1;
    let v = Math.round((s[key] + d) * 100) / 100;
    if (wrap && v > max + 0.001) v = 0;
    s[key] = Math.max(0, Math.min(max, v));
    App.audio.applyVolumes();
    App.save.persist();
  }

  go(mode) {
    if (mode === 'local') this.scene.start('Town');
    else this.scene.start('Online');
  }

  update() {
    App.input.poll(this.input.activePointer);
    for (const g of this.gears) g.rotation += g.spin * 0.05;
    if (!this.started) {
      this.prompt.setAlpha(0.5 + Math.sin(this.time.now / 300) * 0.5);
      const dev = App.input.anyPress();
      if (dev) {
        App.audio.unlock();
        App.input.slots = [dev];
        this.started = true;
        this.openMenu();
      }
    } else if (this.menu) this.menu.update();
    App.input.endFrame();
  }
}
