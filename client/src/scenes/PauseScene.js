import Phaser from 'phaser';
import { App } from '../state.js';
import { text, setText, panel, COLORS, rarityColor } from '../ui/text.js';
import { Menu } from '../ui/Menu.js';
import { ITEM_MAP, SYNERGY_MAP, CHARACTER_MAP, MODIFIER_MAP, PLAYER_COLORS, CONSUMABLE_MAP } from '@undercrank/shared';

// Pause overlay: collected items, active synergies and stats for each player.
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  init(data) {
    this.gs = data.gameScene;
  }

  create() {
    this.add.rectangle(240, 135, 480, 270, 0x000000, 0.72);
    const g = this.add.graphics();
    panel(g, 10, 8, 460, 254);
    this.title = text(this, 240, 16, 'PAUSED', { origin: [0.5, 0], scale: 2, color: COLORS.brass });
    if (this.gs.session.online) text(this, 240, 27, '', { origin: [0.5, 0], color: COLORS.red }).setText('ONLINE: THE GEARS KEEP TURNING').setY(4);
    this.tab = 0;
    this.dyn = [];
    this.confirmAbandon = false;
    this.menu = new Menu(this, [
      { label: 'RESUME', action: () => this.close() },
      { label: () => (this.confirmAbandon ? 'REALLY ABANDON? (COGS ARE KEPT)' : 'ABANDON RUN'), action: () => this.abandon() },
      { label: 'SFX', value: () => `${Math.round(App.save.data.settings.sfx * 10)}`, left: () => this.vol('sfx', -0.1), right: () => this.vol('sfx', 0.1) },
      { label: 'MUSIC', value: () => `${Math.round(App.save.data.settings.music * 10)}`, left: () => this.vol('music', -0.1), right: () => this.vol('music', 0.1) },
    ], { x: 240, y: 214, spacing: 10, depth: 5 });
    this.render();
  }

  vol(k, d) {
    const s = App.save.data.settings;
    s[k] = Math.max(0, Math.min(1, Math.round((s[k] + d) * 10) / 10));
    App.audio.applyVolumes();
    App.save.persist();
  }

  abandon() {
    if (!this.confirmAbandon) {
      this.confirmAbandon = true;
      return;
    }
    this.close();
    this.gs.session.abandon();
  }

  close() {
    this.gs.resume();
    this.scene.stop();
  }

  render() {
    for (const d of this.dyn) d.destroy();
    this.dyn = [];
    const view = this.gs.session.view;
    if (!view) return;
    const players = view.players;
    this.tab = (this.tab + players.length) % players.length;
    const p = players[this.tab];
    const add = (o) => (this.dyn.push(o), o);
    const mods = view.floor.modifiers.map((m) => MODIFIER_MAP[m]?.name).join(', ');
    add(text(this, 240, 36, `FLOOR ${view.depth}${mods ? ` - ${mods}` : ''}`, { origin: [0.5, 0], color: COLORS.dim }));
    const tabs = players.map((q, i) => `${i === this.tab ? '>' : ' '}P${q.slot + 1}${i === this.tab ? '<' : ' '}`).join('  ');
    if (players.length > 1) add(text(this, 240, 46, `${tabs}   (LEFT/RIGHT)`, { origin: [0.5, 0], color: PLAYER_COLORS[p.slot % 4] }));

    // Items
    add(text(this, 20, 58, `${CHARACTER_MAP[p.character]?.name || ''} - ITEMS`, { color: PLAYER_COLORS[p.slot % 4] }));
    const all = [...(p.items || [])];
    if (p.active) all.push(p.active.id);
    let y = 70;
    const cols = 2;
    all.slice(0, 22).forEach((id, i) => {
      const it = ITEM_MAP[id];
      const x = 20 + (i % cols) * 110;
      const yy = y + Math.floor(i / cols) * 12;
      add(this.add.image(x + 6, yy + 4, `item_${id}`).setScale(0.7));
      add(text(this, x + 14, yy, it.name, { color: rarityColor(it.rarity) }));
    });
    if (!all.length) add(text(this, 20, 70, 'NOTHING YET. DIG DEEPER.', { color: COLORS.dim }));
    if (p.consumable) add(text(this, 20, 200, `CONSUMABLE: ${CONSUMABLE_MAP[p.consumable]?.name}`, { color: COLORS.verdigris }));

    // Synergies
    add(text(this, 250, 58, 'ACTIVE SYNERGIES', { color: COLORS.cyan }));
    const syn = p.loadout?.synergies || [];
    y = 70;
    for (const id of syn) {
      const s = SYNERGY_MAP[id];
      add(text(this, 250, y, s.name, { color: COLORS.cyan }));
      const d = add(text(this, 256, y + 9, s.desc, { color: COLORS.text, maxWidth: 205 }));
      y += 12 + d.height;
    }
    if (!syn.length) add(text(this, 250, 70, 'COMBINE ITEMS TO UNLOCK THEM.', { color: COLORS.dim }));
    // Stats
    const s = p.loadout?.stats;
    if (s) {
      const lines = [
        `DMG ${s.damage.toFixed(1)}  RATE ${s.fireRate.toFixed(1)}/S`,
        `SPEED ${Math.round(s.moveSpeed)}  RANGE ${Math.round(s.range)}`,
        `SHOTS ${s.shotCount}  PIERCE ${s.pierce}  LUCK ${s.luck}`,
      ];
      lines.forEach((l, i) => add(text(this, 250, 176 + i * 10, l, { color: COLORS.dim })));
    }
  }

  update() {
    const inp = App.input;
    inp.poll(this.input.activePointer);
    const view = this.gs.session.view;
    if (view && view.players.length > 1) {
      if (inp.menu('left') && this.menu.index === 0) {
        this.tab--;
        this.render();
      } else if (inp.menu('right') && this.menu.index === 0) {
        this.tab++;
        this.render();
      }
    }
    if (inp.menu('back') || inp.menu('pause')) {
      App.audio.play('ui_back');
      this.close();
    } else this.menu.update();
    inp.endFrame();
  }
}
