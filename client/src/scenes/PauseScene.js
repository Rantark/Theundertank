import Phaser from 'phaser';
import { App, setupCamera, ART } from '../state.js';
import { text, setText, panel, COLORS, rarityColor } from '../ui/text.js';
import { Menu } from '../ui/Menu.js';
import { ITEM_MAP, SYNERGY_MAP, CHARACTER_MAP, MODIFIER_MAP, PLAYER_COLORS, CONSUMABLE_MAP, itemDetails } from '@undercrank/shared';

const COLS = 12;
const CELL = 17;
const GRID_X = 24;
const GRID_Y = 70;

// Pause overlay: browse collected items (with full details), active synergies and stats.
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  init(data) {
    this.gs = data.gameScene;
  }

  create() {
    setupCamera(this);
    this.add.rectangle(240, 135, 480, 270, 0x000000, 0.72);
    const g = this.add.graphics();
    panel(g, 10, 8, 460, 254);
    g.lineStyle(1, 0x7a5a17, 0.8).lineBetween(242, 56, 242, 206);
    this.title = text(this, 240, 14, 'PAUSED', { origin: [0.5, 0], scale: 2, color: COLORS.brass });
    if (this.gs.session.online) text(this, 240, 4, 'ONLINE: THE GEARS KEEP TURNING', { origin: [0.5, 0], color: COLORS.red });
    this.tab = 0;
    this.sel = 0;
    this.focus = 'items';
    this.dyn = [];
    this.detail = [];
    this.confirmAbandon = false;
    this.menu = new Menu(this, [
      { label: 'RESUME', action: () => this.close() },
      { label: () => (this.confirmAbandon ? 'REALLY ABANDON? (COGS ARE KEPT)' : 'ABANDON RUN'), action: () => this.abandon() },
      { label: 'OPTIONS', action: () => this.openOptions() },
    ], { x: 240, y: 216, spacing: 11, depth: 5 });
    this.frame = this.add.graphics().setDepth(4);
    this.render();
  }

  openOptions() {
    this.scene.launch('Options', { from: 'Pause' });
    this.scene.bringToTop('Options');
    this.scene.pause();
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

  get player() {
    const view = this.gs.session.view;
    return view ? view.players[(this.tab + view.players.length) % view.players.length] : null;
  }

  get items() {
    const p = this.player;
    if (!p) return [];
    const all = [...(p.items || [])];
    if (p.active) all.push(p.active.id);
    return all;
  }

  render() {
    for (const d of this.dyn) d.destroy();
    this.dyn = [];
    const view = this.gs.session.view;
    if (!view) return;
    const players = view.players;
    this.tab = (this.tab + players.length) % players.length;
    const p = this.player;
    const add = (o) => (this.dyn.push(o), o);
    const mods = view.floor.modifiers.map((m) => MODIFIER_MAP[m]?.name).join(', ');
    add(text(this, 240, 34, `FLOOR ${view.depth}${mods ? ` - ${mods}` : ''}`, { origin: [0.5, 0], color: COLORS.dim }));
    if (players.length > 1) {
      const tabs = players.map((q, i) => `${i === this.tab ? '>' : ' '}P${q.slot + 1}${i === this.tab ? '<' : ' '}`).join('  ');
      add(text(this, 240, 44, `${tabs}   ([ / ] SWITCH PLAYER)`, { origin: [0.5, 0], color: PLAYER_COLORS[p.slot % 4] }));
    }

    // Item grid
    add(text(this, 20, 58, `${CHARACTER_MAP[p.character]?.name || ''} - ITEMS (${this.items.length})`, { color: PLAYER_COLORS[p.slot % 4] }));
    const items = this.items;
    this.sel = Math.max(0, Math.min(this.sel, items.length - 1));
    items.forEach((id, i) => {
      const x = GRID_X + (i % COLS) * CELL + 6;
      const y = GRID_Y + Math.floor(i / COLS) * CELL + 6;
      add(this.add.image(x, y, `item_${id}`).setScale(ART));
      if (p.active && id === p.active.id && i === items.length - 1) add(text(this, x + 5, y + 2, 'A', { color: COLORS.cyan }));
    });
    if (!items.length) add(text(this, 20, 72, 'NOTHING YET. DIG DEEPER.', { color: COLORS.dim }));
    if (p.consumable) add(text(this, 20, 196, `CONSUMABLE: ${CONSUMABLE_MAP[p.consumable]?.name} - ${CONSUMABLE_MAP[p.consumable]?.desc}`, { color: COLORS.verdigris, maxWidth: 215 }));

    // Active synergies
    add(text(this, 250, 58, 'ACTIVE SYNERGIES', { color: COLORS.cyan }));
    const syn = p.loadout?.synergies || [];
    let y = 70;
    for (const id of syn) {
      const sy = SYNERGY_MAP[id];
      add(text(this, 250, y, sy.name, { color: COLORS.cyan }));
      const d = add(text(this, 256, y + 9, sy.desc, { color: COLORS.text, maxWidth: 205 }));
      y += 12 + d.height;
      if (y > 150) break;
    }
    if (!syn.length) add(text(this, 250, 70, 'COMBINE ITEMS TO UNLOCK THEM.', { color: COLORS.dim }));
    const s = p.loadout?.stats;
    if (s && s.damage !== undefined) {
      const lines = [
        `DMG ${s.damage.toFixed(1)}  RATE ${s.fireRate.toFixed(1)}/S  SHOTS ${s.shotCount}`,
        `SPEED ${Math.round(s.moveSpeed)}  RANGE ${Math.round(s.range)}  PIERCE ${s.pierce}`,
        `DASHES ${s.dashCharges}  LUCK ${s.luck}  CRIT ${Math.round(s.critChance * 100)}%`,
      ];
      lines.forEach((l, i) => add(text(this, 250, 172 + i * 10, l, { color: COLORS.dim })));
    }
    this.renderDetail();
  }

  renderDetail() {
    for (const d of this.detail) d.destroy();
    this.detail = [];
    this.frame.clear();
    const items = this.items;
    const id = items[this.sel];
    if (!id || this.focus !== 'items') {
      if (items.length) this.detail.push(text(this, 20, GRID_Y + Math.ceil(items.length / COLS) * CELL + 6, 'ARROW KEYS / D-PAD TO INSPECT ITEMS', { color: COLORS.dim }));
      return;
    }
    const gx = GRID_X + (this.sel % COLS) * CELL;
    const gy = GRID_Y + Math.floor(this.sel / COLS) * CELL;
    this.frame.lineStyle(1, 0xf2cf6b, 1).strokeRect(gx - 0.5, gy - 0.5, 13, 13);
    const d = itemDetails(id);
    const p = this.player;
    const add = (o) => (this.detail.push(o), o);
    let y = GRID_Y + Math.ceil(items.length / COLS) * CELL + 4;
    const line = (str, col, indent = 0) => {
      const t = add(text(this, 20 + indent, y, str, { color: col, maxWidth: 214 - indent }));
      y += t.height + 2;
    };
    line(d.name, rarityColor(d.rarity));
    line(`${d.rarity}${d.kind === 'active' ? ' active' : ''}${d.tags.length ? ` - ${d.tags.join(' ')}` : ''}`, COLORS.dim);
    if (d.flavor) line(`"${d.flavor}"`, 0x8a7a64);
    for (const e of d.effects) line(`- ${e}`, COLORS.copper);
    const active = new Set(p.loadout?.synergies || []);
    for (const sy of d.synergies.slice(0, 3)) {
      const on = active.has(sy.synergy.id);
      line(`${on ? '* ' : '  '}${sy.synergy.name}${on ? ' (ACTIVE)' : ` - needs ${sy.partners.join(' + ')}`}`, on ? COLORS.cyan : 0x5a9aa8);
      if (y > 204) break;
    }
  }

  update() {
    const inp = App.input;
    inp.poll(this.input.activePointer);
    const view = this.gs.session.view;
    const n = this.items.length;
    if (view && view.players.length > 1) {
      if (inp.keysPressed.has('BracketLeft') || inp.menu('left') && this.focus === 'menu' && this.menu.index === 0) {
        this.tab--;
        this.sel = 0;
        this.render();
      } else if (inp.keysPressed.has('BracketRight') || inp.menu('right') && this.focus === 'menu' && this.menu.index === 0) {
        this.tab++;
        this.sel = 0;
        this.render();
      }
    }
    // Mouse hover over an item icon selects it.
    const m = inp.mouse;
    if (m.moved && n) {
      const cx = Math.floor((m.x - GRID_X) / CELL);
      const cy = Math.floor((m.y - GRID_Y) / CELL);
      const i = cy * COLS + cx;
      if (cx >= 0 && cx < COLS && cy >= 0 && i < n && i !== this.sel) {
        this.sel = i;
        this.focus = 'items';
        this.renderDetail();
      }
    }
    if (inp.menu('back') || inp.menu('pause')) {
      App.audio.play('ui_back');
      this.close();
      inp.endFrame();
      return;
    }
    if (this.focus === 'items' && n) {
      let moved = false;
      if (inp.menu('left') && this.sel > 0) (this.sel--, (moved = true));
      if (inp.menu('right') && this.sel < n - 1) (this.sel++, (moved = true));
      if (inp.menu('up') && this.sel >= COLS) (this.sel -= COLS, (moved = true));
      if (inp.menu('down')) {
        if (this.sel + COLS < n) (this.sel += COLS, (moved = true));
        else {
          this.focus = 'menu';
          this.menu.index = 0;
          this.menu.refresh();
          moved = true;
        }
      }
      if (moved) {
        App.audio.play('ui_move');
        this.renderDetail();
      }
      if (inp.menu('confirm')) this.close();
    } else {
      if (this.menu.index === 0 && inp.menu('up') && n) {
        this.focus = 'items';
        this.renderDetail();
        App.audio.play('ui_move');
      } else this.menu.update();
    }
    this.menu.cursor.setVisible(this.focus === 'menu');
    inp.endFrame();
  }
}
