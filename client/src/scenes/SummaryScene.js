import Phaser from 'phaser';
import { App } from '../state.js';
import { text, panel, COLORS, rarityColor } from '../ui/text.js';
import { ITEM_MAP, SYNERGY_MAP, CHARACTER_MAP, PLAYER_COLORS } from '@undercrank/shared';

// Death screen: run summary and Cogs banked.
export class SummaryScene extends Phaser.Scene {
  constructor() {
    super('Summary');
  }

  init(data) {
    this.summary = data.summary;
    this.localIds = data.localIds || [];
    this.mode = data.mode;
  }

  create() {
    App.audio.setMood('title');
    const s = this.summary;
    const earned = App.save.recordRun(s, this.localIds);
    this.cameras.main.fadeIn(400);
    const g = this.add.graphics();
    panel(g, 12, 8, 456, 254);
    text(this, 240, 18, 'RUN OVER', { origin: [0.5, 0], scale: 2, color: COLORS.red });
    const mins = Math.floor(s.time / 60);
    const secs = Math.floor(s.time % 60).toString().padStart(2, '0');
    text(this, 240, 40, `REACHED FLOOR ${s.depth}  -  TIME ${mins}:${secs}  -  SEED ${s.seed}`, { origin: [0.5, 0], color: COLORS.dim });
    const n = s.players.length;
    const w = Math.floor(440 / n);
    s.players.forEach((p, i) => {
      const x = 20 + i * w;
      const c = PLAYER_COLORS[p.slot % 4];
      text(this, x, 56, `P${p.slot + 1} ${CHARACTER_MAP[p.character]?.name || ''}`.slice(0, Math.floor(w / 6)), { color: c });
      const rows = [
        `KILLS ${p.kills}`,
        `DAMAGE ${p.damage}`,
        `ROOMS ${p.roomsCleared}`,
        `ITEMS ${p.items.length}`,
        `COGS ${p.cogs}`,
      ];
      rows.forEach((r, j) => text(this, x, 68 + j * 10, r, { color: COLORS.text }));
      p.items.slice(0, 24).forEach((id, j) => {
        const cols = Math.max(3, Math.floor((w - 8) / 15));
        this.add.image(x + 7 + (j % cols) * 15, 128 + Math.floor(j / cols) * 15, `item_${id}`).setTint(ITEM_MAP[id] ? 0xffffff : 0x888888);
      });
      let yy = 128 + Math.ceil(Math.min(24, p.items.length) / Math.max(3, Math.floor((w - 8) / 15))) * 15 + 4;
      for (const sid of p.synergies || []) {
        text(this, x, yy, SYNERGY_MAP[sid]?.name || sid, { color: COLORS.cyan });
        yy += 10;
      }
    });
    text(this, 240, 222, `+${earned} COGS BANKED  (TOTAL ${App.save.data.cogs})`, { origin: [0.5, 0], color: COLORS.brass });
    this.prompt = text(this, 240, 240, 'PRESS CONFIRM TO RETURN TO TOWN', { origin: [0.5, 0], color: COLORS.text });
    this.t = 0;
  }

  update(time, delta) {
    this.t += delta;
    App.input.poll(this.input.activePointer);
    this.prompt.setAlpha(0.5 + Math.sin(time / 250) * 0.5);
    if (this.t > 800 && (App.input.menu('confirm') || App.input.mouse.leftPressed)) {
      App.audio.play('ui_ok');
      this.scene.start('Town');
    }
    App.input.endFrame();
  }
}
