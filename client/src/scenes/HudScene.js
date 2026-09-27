import Phaser from 'phaser';
import { App, ROOM_X, ROOM_Y, setupCamera, ART } from '../state.js';
import { text, setText, panel, COLORS, rarityColor } from '../ui/text.js';
import { ITEM_MAP, CONSUMABLE_MAP, SYNERGY_MAP, PLAYER_COLORS, CHARACTER_MAP, MODIFIER_MAP, ROOM_PX_W, ROOM_PX_H, BOSS_MAP } from '@undercrank/shared';

const MINI_X = 394;
const MINI_Y = 5;
const CELL_W = 9;
const CELL_H = 6;
const TYPE_DOT = { boss: 0xff3b3b, treasure: 0xffc93c, shop: 0x7fd6b8, secret: 0xc26bff, challenge: 0xe0588a, rest: 0x6ff0ff, exit: 0x14110f };

// Heads-up display drawn on top of the GameScene.
export class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  init(data) {
    this.gs = data.gameScene;
  }

  create() {
    setupCamera(this);
    this.bg = this.add.graphics();
    this.g = this.add.graphics();
    this.mini = this.add.graphics();
    this.panels = new Map();
    this.toasts = [];
    this.floorLabel = text(this, 28, ROOM_Y + 4, 'FLOOR', { origin: [0.5, 0], color: COLORS.dim });
    this.floorNum = text(this, 28, ROOM_Y + 14, '1', { origin: [0.5, 0], scale: 2, color: COLORS.brass });
    this.modText = text(this, 28, ROOM_Y + 40, '', { origin: [0.5, 0], color: COLORS.copper });
    this.buildIcons = [];
    this.bossName = text(this, ROOM_X + ROOM_PX_W / 2, ROOM_Y + ROOM_PX_H - 16, '', { origin: [0.5, 1], color: COLORS.red }).setDepth(5);
    this.dmg = this.add.rectangle(240, 135, 480, 270, 0xff0000, 0).setDepth(20);
    this.banner = text(this, ROOM_X + ROOM_PX_W / 2, ROOM_Y + 118, '', { origin: [0.5, 0.5], scale: 2, color: COLORS.brass }).setDepth(30).setAlpha(0);
    this.subBanner = text(this, ROOM_X + ROOM_PX_W / 2, ROOM_Y + 136, '', { origin: [0.5, 0.5], color: COLORS.text, maxWidth: 300 }).setDepth(30).setAlpha(0);
    this.fps = text(this, 476, 262, '', { origin: [1, 0], color: COLORS.dim }).setDepth(40);
    this.hint = text(this, ROOM_X + ROOM_PX_W / 2, ROOM_Y + ROOM_PX_H - 14, '', { origin: [0.5, 0], color: COLORS.dim }).setDepth(4);
    this.drawStatic();
  }

  drawStatic() {
    const g = this.bg;
    g.clear();
    panel(g, 0, 0, 480, 55, { alpha: 0.96 });
    panel(g, 0, 55, ROOM_X - 2, 215, { alpha: 0.96 });
    panel(g, ROOM_X + ROOM_PX_W + 2, 55, 480 - (ROOM_X + ROOM_PX_W + 2), 215, { alpha: 0.96 });
  }

  get view() {
    return this.gs.session.view;
  }

  // ------------------------------------------------------------------ events
  onEvent(e) {
    const locals = this.gs.localIds;
    const view = this.view;
    const pName = (pid) => {
      const p = view?.players.find((q) => q.id === pid);
      return p ? `P${p.slot + 1}` : '';
    };
    const multi = (view?.players.length || 1) > 1;
    switch (e.type) {
      case 'toast':
        if (e.pid && !locals.includes(e.pid)) return;
        this.toast(`${e.pid && multi ? `${pName(e.pid)}: ` : ''}${e.text}`, e.color ? rarityColor(e.color) : COLORS.text);
        break;
      case 'item': {
        const it = ITEM_MAP[e.id];
        if (!it) return;
        const who = multi ? `${pName(e.pid)} ` : '';
        this.toast(`${who}${it.name}${it.rarity === 'cursed' ? ' (CURSED)' : ''}`, rarityColor(it.rarity));
        if (locals.includes(e.pid)) this.toast(it.desc, COLORS.dim);
        break;
      }
      case 'synergy': {
        const s = SYNERGY_MAP[e.id];
        if (!s) return;
        this.showBanner(`SYNERGY: ${s.name}`, `${multi ? `${pName(e.pid)} - ` : ''}${s.desc}`, COLORS.cyan);
        App.audio.play('synergy');
        this.gs.fx.shake(2);
        break;
      }
      case 'floor': {
        const mods = (e.modifiers || []).map((m) => MODIFIER_MAP[m]?.name).join(' / ');
        this.showBanner(`FLOOR ${e.depth}`, e.boss ? 'THE GEARS GROAN... A GUARDIAN AWAITS' : mods || 'THE GEARS SHIFT BENEATH YOU', e.boss ? COLORS.red : COLORS.brass);
        break;
      }
      case 'boss':
        this.showBanner(e.name, e.title + (e.mods?.length ? ` - ${e.mods.join(', ').toUpperCase()}` : ''), COLORS.red);
        break;
      case 'gameover':
        this.showBanner('THE UNDERCRANK CLAIMS YOU', '', COLORS.red, 3000);
        break;
      default:
        break;
    }
  }

  toast(str, color = COLORS.text) {
    const t = text(this, ROOM_X + ROOM_PX_W / 2, 0, str, { origin: [0.5, 0], color, maxWidth: 300 }).setDepth(25);
    this.toasts.push({ t, life: 3 });
    if (this.toasts.length > 5) this.toasts.shift().t.destroy();
  }

  showBanner(title, sub, color, ms = 2200) {
    setText(this.banner, title).setTint(color).setAlpha(1).setScale(1.3);
    setText(this.subBanner, sub).setAlpha(1);
    this.tweens.killTweensOf([this.banner, this.subBanner]);
    this.tweens.add({ targets: this.banner, scale: 1, duration: 200, ease: 'Back.Out' });
    this.tweens.add({ targets: [this.banner, this.subBanner], alpha: 0, delay: ms, duration: 500 });
  }

  damageFlash() {
    if (App.save.data.settings.flashes === false) return;
    this.dmg.setFillStyle(0xff0000, 0.28);
    this.tweens.killTweensOf(this.dmg);
    this.dmg.setAlpha(1);
    this.tweens.add({ targets: this.dmg, alpha: 0, duration: 260 });
  }

  // ------------------------------------------------------------------ player panels
  panelFor(p, index, count) {
    let o = this.panels.get(p.id);
    const w = Math.min(130, Math.floor(388 / count));
    const x = 3 + index * w;
    if (!o) {
      o = {
        name: text(this, 0, 4, '', { color: PLAYER_COLORS[p.slot % 4] }),
        cogs: text(this, 0, 4, '', { origin: [1, 0], color: COLORS.brass }),
        cogIcon: this.add.image(0, 8, 'ui_cog').setScale(ART),
        hearts: [],
        dash: [],
        active: this.add.image(0, 0, 'ui_cog').setVisible(false).setScale(ART),
        cons: this.add.image(0, 0, 'ui_cog').setVisible(false).setScale(ART),
        consKey: text(this, 0, 0, '', { color: COLORS.dim }),
        activeKey: text(this, 0, 0, '', { color: COLORS.dim }),
        status: text(this, 0, 0, '', { color: COLORS.red }),
      };
      this.panels.set(p.id, o);
    }
    o.x = x;
    o.w = w;
    return o;
  }

  drawPanels(view) {
    const g = this.g;
    const players = view.players;
    const count = players.length;
    const seen = new Set();
    players.forEach((p, i) => {
      seen.add(p.id);
      const o = this.panelFor(p, i, count);
      const x = o.x;
      const local = this.gs.localIds.includes(p.id);
      const slotIdx = this.gs.localIds.indexOf(p.id);
      const charName = (CHARACTER_MAP[p.character]?.name || '').split(' ')[0];
      setText(o.name, `P${p.slot + 1} ${p.name && !String(p.name).startsWith('P') ? p.name : charName}`.slice(0, Math.floor(o.w / 6) - 5));
      o.name.setPosition(x + 2, 4);
      setText(o.cogs, `${p.cogs}`).setPosition(x + o.w - 4, 4);
      o.cogIcon.setPosition(x + o.w - 10 - o.cogs.width, 8);

      // Hearts
      const maxHp = p.loadout?.stats?.maxHp || 6;
      const nh = Math.ceil(maxHp / 2);
      while (o.hearts.length < nh) o.hearts.push(this.add.image(0, 0, 'ui_heart').setOrigin(0, 0).setScale(ART));
      const perRow = Math.max(6, Math.floor((o.w - 4) / 8));
      o.hearts.forEach((h, hi) => {
        if (hi >= nh) return h.setVisible(false);
        const hp = p.hp;
        const key = hp >= (hi + 1) * 2 ? 'ui_heart' : hp === hi * 2 + 1 ? 'ui_heart_half' : 'ui_heart_empty';
        h.setTexture(key).setVisible(true).setPosition(x + 2 + (hi % perRow) * 8, 14 + Math.floor(hi / perRow) * 8);
      });

      // Dash pips
      const dc = p.loadout?.stats?.dashCharges ?? 1;
      while (o.dash.length < dc) o.dash.push(this.add.image(0, 0, 'ui_dash').setOrigin(0, 0).setScale(ART));
      o.dash.forEach((d, di) => {
        if (di >= dc) return d.setVisible(false);
        d.setVisible(true).setTexture(di < p.dashCharges ? 'ui_dash' : 'ui_dash_e').setPosition(x + 2 + di * 7, 33);
      });

      // Active item + charge bar
      if (p.active && ITEM_MAP[p.active.id]) {
        const def = ITEM_MAP[p.active.id];
        const ax = x + 2;
        const ay = 41;
        o.active.setTexture(`item_${p.active.id}`).setVisible(true).setOrigin(0, 0).setPosition(ax, ay - 1);
        const frac = Math.min(1, p.active.charge / def.active.charge);
        g.fillStyle(0x000000, 0.8).fillRect(ax + 16, ay + 8, 22, 4);
        g.fillStyle(frac >= 1 ? 0x6ff0ff : 0x3a7a8a, 1).fillRect(ax + 17, ay + 9, 20 * frac, 2);
        if (frac >= 1 && Math.floor(this.time.now / 250) % 2) g.lineStyle(1, 0xffffff, 0.9).strokeRect(ax + 15.5, ay + 7.5, 23, 5);
        setText(o.activeKey, local ? App.input.hint(slotIdx, 'active') : '').setPosition(ax + 16, ay - 1);
      } else {
        o.active.setVisible(false);
        setText(o.activeKey, '');
      }
      // Consumable
      if (p.consumable && CONSUMABLE_MAP[p.consumable]) {
        const cx = x + Math.min(o.w - 30, 48);
        o.cons.setTexture(`cons_${p.consumable}`).setVisible(true).setOrigin(0, 0).setPosition(cx, 42);
        setText(o.consKey, local ? App.input.hint(slotIdx, 'cons') : '').setPosition(cx + 13, 44);
      } else {
        o.cons.setVisible(false);
        setText(o.consKey, '');
      }
      // Status
      let st = '';
      if (!p.alive) st = 'FALLEN';
      else if (p.downed) st = `DOWN ${Math.ceil(p.downedT)}`;
      setText(o.status, st).setPosition(x + 40, 32);
      // Divider
      if (i > 0) g.lineStyle(1, 0x7a5a17, 0.8).lineBetween(x - 1, 4, x - 1, 51);
    });
    for (const [id, o] of this.panels) {
      if (seen.has(id)) continue;
      for (const v of Object.values(o)) {
        if (Array.isArray(v)) v.forEach((q) => q.destroy());
        else if (v && v.destroy) v.destroy();
      }
      this.panels.delete(id);
    }
  }

  // ------------------------------------------------------------------ minimap
  drawMinimap(view) {
    const g = this.mini;
    g.clear();
    g.fillStyle(0x0a0807, 1).fillRect(MINI_X - 2, MINI_Y - 2, CELL_W * 9 + 3, CELL_H * 8 + 3);
    for (const r of view.floor.rooms.values()) {
      if (!r.seen && !r.visited) continue;
      if (r.type === 'secret' && !r.visited && Object.values(r.hidden).some(Boolean)) continue;
      const x = MINI_X + r.gx * CELL_W;
      const y = MINI_Y + r.gy * CELL_H;
      const cur = r.id === view.room.id;
      const col = cur ? 0xf2cf6b : r.visited ? 0x8a7a64 : 0x3a332d;
      g.fillStyle(col, 1).fillRect(x, y, CELL_W - 1, CELL_H - 1);
      const dot = TYPE_DOT[r.type];
      if (dot !== undefined && !cur) {
        g.fillStyle(dot, 1).fillRect(x + 3, y + 1, 2, 3);
        if (r.type === 'exit') g.lineStyle(1, 0xc99a2e).strokeRect(x + 2.5, y + 0.5, 3, 4);
      }
      if (r.hatch && !cur) g.fillStyle(0xffc93c, 1).fillRect(x + 3, y + 2, 2, 1);
    }
  }

  update(time, delta) {
    const view = this.view;
    if (!view || !view.room) return;
    const dt = delta / 1000;
    this.g.clear();
    this.drawPanels(view);
    this.drawMinimap(view);
    setText(this.floorNum, `${view.depth}`);
    setText(this.modText, (view.floor.modifiers || []).map((m) => MODIFIER_MAP[m]?.short).join('\n'));

    // Build list for the first local player (right column).
    const me = view.players.find((p) => p.id === this.gs.localIds[0]);
    if (me) {
      const items = me.items || [];
      while (this.buildIcons.length < items.length) this.buildIcons.push(this.add.image(0, 0, 'ui_cog').setScale(ART));
      const colX = ROOM_X + ROOM_PX_W + 6;
      this.buildIcons.forEach((ic, i) => {
        if (i >= items.length || i >= 42) return ic.setVisible(false);
        ic.setVisible(true).setTexture(`item_${items[i]}`).setPosition(colX + 7 + (i % 3) * 16, ROOM_Y + 8 + Math.floor(i / 3) * 15);
      });
    }

    // Boss bar
    const boss = view.enemies.find((e) => e.boss);
    if (boss) {
      const fr = boss.hpFrac ?? boss.hp / boss.maxHp;
      const bx = ROOM_X + 60;
      const by = ROOM_Y + ROOM_PX_H - 12;
      const bw = ROOM_PX_W - 120;
      this.g.fillStyle(0x000000, 0.85).fillRect(bx - 2, by - 2, bw + 4, 8);
      this.g.fillStyle(0x5a1a1a, 1).fillRect(bx, by, bw, 4);
      this.g.fillStyle(0xe0303a, 1).fillRect(bx, by, bw * Math.max(0, fr), 4);
      this.g.fillStyle(0xff9c9c, 1).fillRect(bx, by, bw * Math.max(0, fr), 1);
      setText(this.bossName, BOSS_MAP[boss.type]?.name || '').setVisible(true);
    } else this.bossName.setVisible(false);

    // Toasts stack under the top bar.
    let y = ROOM_Y + 4;
    this.toasts = this.toasts.filter((q) => {
      q.life -= dt;
      if (q.life <= 0) {
        q.t.destroy();
        return false;
      }
      q.t.setY(y).setAlpha(Math.min(1, q.life * 2));
      y += q.t.height + 2;
      return true;
    });

    setText(this.fps, App.save.data.settings.showFps ? `${Math.round(this.game.loop.actualFps)} FPS` : '');
    // Contextual hint.
    const hintSlot = 0;
    if (view.depth === 1 && view.room.id === view.floor.startId) {
      setText(this.hint, `${App.input.hint(hintSlot, 'dash')}: DASH   ${App.input.hint(hintSlot, 'interact')}: USE   ${App.input.hint(hintSlot, 'active')}: ACTIVE   ${App.input.hint(hintSlot, 'pause')}: MENU`);
    } else if (view.room.hatch) setText(this.hint, 'STAND ON THE HATCH TO DESCEND');
    else setText(this.hint, '');
  }
}
