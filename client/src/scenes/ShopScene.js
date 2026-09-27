import Phaser from 'phaser';
import { App, setupCamera, ART } from '../state.js';
import { text, setText, panel, COLORS } from '../ui/text.js';
import { UPGRADES, SHOPS, CHARACTERS, PLAYER_COLORS, upgradePreview, characterStats } from '@undercrank/shared';

// Permanent-upgrade shop overlay (launched from the town).
export class ShopScene extends Phaser.Scene {
  constructor() {
    super('Shop');
  }

  init(data) {
    this.shop = data.shop;
    this.slot = data.slot || 0;
  }

  create() {
    setupCamera(this);
    this.add.rectangle(240, 135, 480, 270, 0x000000, 0.6).setScrollFactor(0);
    const g = this.add.graphics();
    panel(g, 20, 14, 440, 242);
    const info = SHOPS[this.shop];
    this.add.image(46, 38, `npc_${this.shop}_down_idle0`).setScale(ART * 1.6);
    text(this, 66, 22, info.name.toUpperCase(), { scale: 2, color: info.color });
    text(this, 66, 42, info.desc, { color: COLORS.dim });
    this.cogs = text(this, 448, 22, '', { origin: [1, 0], color: COLORS.brass });
    this.detailBox = this.add.graphics();
    this.detail = [];
    this.rows = [];
    this.buildEntries();
    this.index = 0;
    this.render();
  }

  buildEntries() {
    this.entries = UPGRADES.filter((u) => u.shop === this.shop).map((u) => ({ kind: 'upgrade', u }));
    if (this.shop === 'clockmaker') for (const c of CHARACTERS) this.entries.push({ kind: 'char', c });
    this.entries.push({ kind: 'leave' });
  }

  label(e) {
    const s = App.save;
    if (e.kind === 'upgrade') {
      const lvl = s.level(e.u.id);
      const maxed = lvl >= e.u.maxLevel;
      return { l: `${e.u.name}  ${'*'.repeat(lvl)}${'-'.repeat(e.u.maxLevel - lvl)}`, r: maxed ? 'MAX' : `${s.costOf(e.u.id)} COGS`, ok: !maxed && s.canBuy(e.u.id), desc: e.u.desc, flavor: e.u.flavor,
        extra: [`LEVEL ${lvl}/${e.u.maxLevel}${maxed ? '' : `  -  NEXT COSTS ${s.costOf(e.u.id)} COGS`}`, ...upgradePreview(e.u.id, s.data.upgrades, s.data.characters[this.slot] || 'tinker')] };
    }
    if (e.kind === 'char') {
      const owned = s.data.unlocked.includes(e.c.id);
      const chosen = s.data.characters[this.slot] === e.c.id;
      return {
        l: `${e.c.name} - ${e.c.title}`,
        r: chosen ? `P${this.slot + 1} SELECTED` : owned ? 'SELECT' : `UNLOCK ${e.c.unlockCost}`,
        ok: owned || s.data.cogs >= e.c.unlockCost,
        desc: e.c.desc,
        extra: characterStats(e.c.id, s.data.upgrades),
      };
    }
    return { l: 'LEAVE', r: '', ok: true, desc: '' };
  }

  render() {
    for (const r of this.rows) r.forEach((t) => t.destroy());
    this.rows = [];
    setText(this.cogs, `${App.save.data.cogs} COGS`);
    const top = 62;
    const visible = 10;
    const start = Math.max(0, Math.min(this.index - 6, this.entries.length - visible));
    this.entries.slice(start, start + visible).forEach((e, k) => {
      const i = start + k;
      const L = this.label(e);
      const sel = i === this.index;
      const col = sel ? COLORS.brass : L.ok ? COLORS.text : 0x6a6050;
      const row = [
        text(this, 40, top + k * 12, `${sel ? '>' : ' '} ${L.l}`, { color: col }),
        text(this, 446, top + k * 12, L.r, { origin: [1, 0], color: sel ? COLORS.brass : COLORS.dim }),
      ];
      if (e.kind === 'char') row.push(this.add.image(34, top + k * 12 + 2, `pl_${e.c.id}_down_idle0`).setScale(ART * 0.55));
      this.rows.push(row);
    });
    // Detail panel: description, flavour and a preview of what buying does.
    for (const d of this.detail) d.destroy();
    this.detail = [];
    const L = this.label(this.entries[this.index]);
    const g = this.detailBox;
    g.clear();
    if (!L.desc) return;
    g.fillStyle(0x100c0a, 0.9).fillRect(30, 186, 420, 64);
    g.lineStyle(1, 0x7a5a17, 1).strokeRect(30.5, 186.5, 419, 63);
    let y = 190;
    const add = (str, col, x = 36) => {
      const t = text(this, x, y, str, { color: col, maxWidth: 404 });
      this.detail.push(t);
      y += t.height + 2;
    };
    const isChar = this.entries[this.index].kind === 'char';
    add(L.desc, isChar ? PLAYER_COLORS[this.slot] : COLORS.text);
    if (L.flavor) add(`"${L.flavor}"`, 0x8a7a64);
    for (const line of L.extra || []) add(line, COLORS.copper);
  }

  activate() {
    const e = this.entries[this.index];
    const s = App.save;
    if (e.kind === 'leave') return this.close();
    if (e.kind === 'upgrade') {
      if (s.buy(e.u.id)) {
        App.audio.play('buy');
        App.net?.sendProfile();
      } else App.audio.play('deny');
    } else if (e.kind === 'char') {
      if (!s.data.unlocked.includes(e.c.id)) {
        if (s.unlock(e.c.id)) App.audio.play('legendary');
        else return App.audio.play('deny');
      }
      s.data.characters[this.slot] = e.c.id;
      s.persist();
      App.audio.play('ui_ok');
      App.net?.sendProfile();
    }
    this.render();
  }

  close() {
    App.audio.play('ui_back');
    this.scene.stop();
    this.scene.resume('Town');
  }

  update() {
    const inp = App.input;
    inp.poll(this.input.activePointer);
    const dev = inp.slots[this.slot];
    if (inp.menu('up', dev)) {
      this.index = (this.index - 1 + this.entries.length) % this.entries.length;
      App.audio.play('ui_move');
      this.render();
    } else if (inp.menu('down', dev)) {
      this.index = (this.index + 1) % this.entries.length;
      App.audio.play('ui_move');
      this.render();
    } else if (inp.menu('confirm', dev)) this.activate();
    else if (inp.menu('back', dev)) this.close();
    inp.endFrame();
  }
}
