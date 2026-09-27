import Phaser from 'phaser';
import { App, setupCamera } from '../state.js';
import { text, setText, panel, COLORS } from '../ui/text.js';
import { DEFAULT_KEYS, DEFAULT_PAD, ACTION_LABELS, keyName, padName, defaultSettings } from '../settings.js';
import { setFullscreen } from '../fullscreen.js';
import { PAD } from '../input/InputManager.js';

const TABS = ['AUDIO', 'VIDEO', 'GAMEPLAY', 'CONTROLS'];
const VISIBLE_ROWS = 12;
const KEY_ACTIONS = Object.keys(DEFAULT_KEYS);
const PAD_ACTIONS = Object.keys(DEFAULT_PAD);

// Options overlay (opened from the title screen or the pause menu).
export class OptionsScene extends Phaser.Scene {
  constructor() {
    super('Options');
  }

  init(data) {
    this.from = data.from || null; // scene key to resume on close
  }

  create() {
    setupCamera(this);
    this.add.rectangle(240, 135, 480, 270, 0x000000, 0.92);
    this.g = this.add.graphics();
    panel(this.g, 18, 10, 444, 250);
    text(this, 240, 16, 'OPTIONS', { origin: [0.5, 0], scale: 2, color: COLORS.brass });
    this.tabTexts = TABS.map((t, i) => text(this, 70 + i * 113, 42, t, { origin: [0.5, 0] }));
    this.help = text(this, 240, 226, '', { origin: [0.5, 0], color: COLORS.dim, maxWidth: 430 });
    this.footer = text(this, 240, 249, '', { origin: [0.5, 0], color: COLORS.dim });
    this.rowTexts = [];
    this.tab = 0;
    this.row = 0;
    this.scroll = 0;
    this.capture = null; // { kind: 'key'|'pad', action }
    this.confirmReset = false;
    this.flashMsg = '';
    this.buildRows();
    this.render();
    this.events.once('shutdown', () => {
      App.input.textCapture = null;
      App.input.padCapture = null;
    });
  }

  get s() {
    return App.save.data.settings;
  }

  save() {
    App.save.persist();
    App.audio.applyVolumes();
  }

  // ------------------------------------------------------------------ rows
  buildRows() {
    const s = this.s;
    const onOff = (v) => (v ? 'ON' : 'OFF');
    const toggle = (k, label, help, after) => ({
      label, help,
      value: () => onOff(s[k]),
      activate: () => {
        s[k] = !s[k];
        after?.(s[k]);
      },
      left: () => {
        s[k] = !s[k];
        after?.(s[k]);
      },
      right: () => {
        s[k] = !s[k];
        after?.(s[k]);
      },
    });
    const slider = (k, label, help, step = 0.1, fmt = (v) => bar(v)) => ({
      label, help,
      value: () => fmt(s[k]),
      left: () => (s[k] = Math.max(0, Math.round((s[k] - step) * 100) / 100)),
      right: () => (s[k] = Math.min(1, Math.round((s[k] + step) * 100) / 100)),
      activate: () => (s[k] = s[k] >= 1 ? 0 : Math.min(1, Math.round((s[k] + step) * 100) / 100)),
    });
    const bar = (v) => `${'#'.repeat(Math.round(v * 10))}${'-'.repeat(10 - Math.round(v * 10))} ${Math.round(v * 100)}%`;

    const tabs = [
      [
        slider('sfx', 'SOUND EFFECTS', 'Volume of weapons, hits, explosions and UI sounds.'),
        slider('music', 'MUSIC', 'Volume of the town, dungeon and boss music.'),
      ],
      [
        toggle('fullscreen', 'FULLSCREEN', 'Fill the whole screen. (F11 also works in the desktop app.)', (on) => setFullscreen(on)),
        slider('shake', 'SCREEN SHAKE', 'How much the camera shakes on hits and explosions. Left to lower, all the way down to OFF.', 0.1, (v) => (v <= 0 ? 'OFF' : bar(v))),
        toggle('flashes', 'SCREEN FLASHES', 'Red damage flash and bright explosion glows. Turn off to reduce flashing.'),
        toggle('hitstop', 'HIT-STOP', 'Tiny freeze-frames on big hits for extra impact.'),
        toggle('damageNumbers', 'DAMAGE NUMBERS', 'Show numbers when you land critical hits.'),
        toggle('showFps', 'SHOW FPS', 'Frames-per-second counter in the corner.'),
      ],
      [
        toggle('autoFire', 'AUTO-FIRE (MOUSE)', 'Keyboard & mouse players fire continuously toward the cursor without holding the button.'),
        {
          label: () => (this.confirmReset ? 'ERASE ALL PROGRESS? PRESS AGAIN' : 'RESET PROGRESS'),
          help: 'Deletes your Cogs, upgrades and unlocked characters. Settings are kept.',
          value: () => '',
          activate: () => {
            if (!this.confirmReset) {
              this.confirmReset = true;
              return;
            }
            const settings = this.s;
            App.save.reset();
            App.save.data.settings = settings;
            App.save.persist();
            this.confirmReset = false;
            this.flashMsg = 'PROGRESS RESET.';
          },
        },
      ],
      [
        { header: 'KEYBOARD  (ENTER TO REBIND, ESC TO CANCEL)' },
        ...KEY_ACTIONS.map((a) => ({
          label: ACTION_LABELS[a],
          help: `Rebind ${ACTION_LABELS[a].toLowerCase()}. Mouse: left click fires, right click dashes, middle click pings.`,
          value: () => (this.capture?.kind === 'key' && this.capture.action === a ? 'PRESS A KEY...' : (s.keys[a] || []).map(keyName).join(' / ') || '---'),
          activate: () => this.startKeyCapture(a),
        })),
        { header: 'GAMEPAD' },
        ...PAD_ACTIONS.map((a) => ({
          label: ACTION_LABELS[a],
          help: `Rebind ${ACTION_LABELS[a].toLowerCase()} on the gamepad. Sticks: left moves, right aims and fires.`,
          value: () => (this.capture?.kind === 'pad' && this.capture.action === a ? 'PRESS A BUTTON...' : (s.pad[a] || []).map(padName).join(' / ') || '---'),
          activate: () => this.startPadCapture(a),
        })),
        {
          label: 'RESET CONTROLS TO DEFAULTS',
          help: 'Restore every keyboard and gamepad binding.',
          value: () => '',
          activate: () => {
            const d = defaultSettings();
            s.keys = d.keys;
            s.pad = d.pad;
            this.flashMsg = 'CONTROLS RESET.';
          },
        },
      ],
    ];
    this.tabsRows = tabs;
  }

  get rows() {
    return this.tabsRows[this.tab];
  }

  startKeyCapture(action) {
    this.capture = { kind: 'key', action };
    App.input.textCapture = (e) => {
      const code = e.code;
      App.input.textCapture = null;
      this.capture = null;
      if (code === 'Escape') {
        this.flashMsg = 'CANCELLED.';
      } else {
        // A key can only do one thing: remove it from other actions first.
        const keys = this.s.keys;
        const stolen = [];
        for (const a of Object.keys(keys)) {
          if (a !== action && keys[a].includes(code)) {
            keys[a] = keys[a].filter((c) => c !== code);
            stolen.push(ACTION_LABELS[a]);
          }
        }
        keys[action] = [code];
        this.flashMsg = `${ACTION_LABELS[action]} = ${keyName(code)}${stolen.length ? `  (REMOVED FROM ${stolen.join(', ')})` : ''}`;
        this.save();
      }
      App.audio.play('ui_ok');
      this.cooldown = 8;
      this.render();
    };
    this.render();
  }

  startPadCapture(action) {
    this.capture = { kind: 'pad', action };
    // Any keyboard key cancels a gamepad rebind.
    App.input.textCapture = () => {
      App.input.textCapture = null;
      App.input.padCapture = null;
      this.capture = null;
      this.flashMsg = 'CANCELLED.';
      this.render();
    };
    App.input.padCapture = (btn) => {
      App.input.padCapture = null;
      App.input.textCapture = null;
      this.capture = null;
      if (btn === PAD.START) {
        this.flashMsg = 'START IS RESERVED FOR PAUSE.';
      } else {
        const pad = this.s.pad;
        for (const a of Object.keys(pad)) if (a !== action) pad[a] = pad[a].filter((b) => b !== btn);
        pad[action] = [btn];
        this.flashMsg = `${ACTION_LABELS[action]} = ${padName(btn)}`;
        this.save();
      }
      App.audio.play('ui_ok');
      this.cooldown = 8;
      this.render();
    };
    this.render();
  }

  // ------------------------------------------------------------------ drawing
  render() {
    this.tabTexts.forEach((t, i) => t.setTint(i === this.tab ? (this.row === -1 ? COLORS.brass : COLORS.text) : 0x6a6050).setText(i === this.tab ? `[${TABS[i]}]` : TABS[i]));
    for (const t of this.rowTexts) t.destroy();
    this.rowTexts = [];
    const rows = this.rows;
    if (this.row >= 0) {
      if (this.row < this.scroll) this.scroll = this.row;
      if (this.row >= this.scroll + VISIBLE_ROWS) this.scroll = this.row - VISIBLE_ROWS + 1;
    }
    rows.slice(this.scroll, this.scroll + VISIBLE_ROWS).forEach((r, k) => {
      const i = this.scroll + k;
      const y = 60 + k * 13;
      const sel = i === this.row;
      if (r.header) {
        this.rowTexts.push(text(this, 36, y + 2, r.header, { color: COLORS.cyan }));
        return;
      }
      const label = typeof r.label === 'function' ? r.label() : r.label;
      this.rowTexts.push(text(this, 36, y, `${sel ? '> ' : '  '}${label}`, { color: sel ? COLORS.brass : COLORS.text }));
      const v = r.value();
      if (v) this.rowTexts.push(text(this, 446, y, v, { origin: [1, 0], color: sel ? COLORS.brass : COLORS.copper }));
    });
    if (rows.length > VISIBLE_ROWS) {
      if (this.scroll > 0) this.rowTexts.push(text(this, 446, 52, '^ MORE', { origin: [1, 0], color: COLORS.dim }));
      if (this.scroll + VISIBLE_ROWS < rows.length) this.rowTexts.push(text(this, 446, 60 + VISIBLE_ROWS * 13, 'V MORE', { origin: [1, 0], color: COLORS.dim }));
    }
    const cur = rows[this.row];
    setText(this.help, this.flashMsg || (cur && !cur.header ? cur.help : this.row === -1 ? 'LEFT / RIGHT TO SWITCH TABS' : ''));
    const pad = App.input.lastDevice !== 'kbm';
    setText(this.footer, pad ? 'LB/RB: TABS   A: SELECT   LEFT/RIGHT: ADJUST   B: BACK' : 'TAB: SWITCH TABS   ENTER: SELECT   LEFT/RIGHT: ADJUST   ESC: BACK');
  }

  switchTab(d) {
    this.tab = (this.tab + d + TABS.length) % TABS.length;
    this.row = this.row === -1 ? -1 : this.firstRow();
    this.scroll = 0;
    this.confirmReset = false;
    App.audio.play('ui_move');
  }

  firstRow() {
    return this.rows.findIndex((r) => !r.header);
  }

  moveRow(d) {
    const rows = this.rows;
    let r = this.row;
    for (let n = 0; n < rows.length + 1; n++) {
      r += d;
      if (r < -1) r = rows.length - 1;
      if (r >= rows.length) r = -1;
      if (r === -1 || !rows[r].header) break;
    }
    this.row = r;
    this.confirmReset = false;
    App.audio.play('ui_move');
  }

  close() {
    App.audio.play('ui_back');
    this.save();
    App.input.textCapture = null;
    App.input.padCapture = null;
    this.scene.stop();
    if (this.from) this.scene.resume(this.from);
  }

  update() {
    const inp = App.input;
    inp.poll(this.input.activePointer);
    if (this.cooldown > 0) {
      // Ignore the confirm press that finished a rebind.
      this.cooldown--;
      inp.endFrame();
      return;
    }
    if (this.capture) {
      inp.endFrame();
      return;
    }
    let changed = false;
    const rows = this.rows;
    const cur = rows[this.row];
    // Tabs: Tab key, LB/RB, or left/right while on the tab bar.
    if (inp.keysPressed.has('Tab') || [0, 1, 2, 3].some((i) => inp.padPressed[i].has(PAD.RB))) {
      this.switchTab(1);
      changed = true;
    } else if ([0, 1, 2, 3].some((i) => inp.padPressed[i].has(PAD.LB))) {
      this.switchTab(-1);
      changed = true;
    } else if (inp.menu('back')) {
      this.close();
      inp.endFrame();
      return;
    } else if (inp.menu('up')) {
      this.moveRow(-1);
      changed = true;
    } else if (inp.menu('down')) {
      this.moveRow(1);
      changed = true;
    } else if (inp.menu('left')) {
      if (this.row === -1) this.switchTab(-1);
      else if (cur?.left) {
        cur.left();
        App.audio.play('ui_move');
        this.save();
      }
      changed = true;
    } else if (inp.menu('right')) {
      if (this.row === -1) this.switchTab(1);
      else if (cur?.right) {
        cur.right();
        App.audio.play('ui_move');
        this.save();
      }
      changed = true;
    } else if (inp.menu('confirm')) {
      if (this.row === -1) this.switchTab(1);
      else if (cur?.activate) {
        this.flashMsg = '';
        cur.activate();
        App.audio.play('ui_ok');
        if (!this.capture) this.save();
      }
      changed = true;
    }
    // Mouse: click a tab or a row.
    const m = inp.mouse;
    if (m.leftPressed) {
      this.tabTexts.forEach((t, i) => {
        const b = t.getBounds();
        if (m.x >= b.x - 4 && m.x <= b.right + 4 && m.y >= b.y - 3 && m.y <= b.bottom + 3) {
          this.tab = i;
          this.row = this.firstRow();
          this.scroll = 0;
          changed = true;
        }
      });
      const k = Math.floor((m.y - 60) / 13);
      const i = this.scroll + k;
      if (k >= 0 && k < VISIBLE_ROWS && rows[i] && !rows[i].header && m.x > 30 && m.x < 450) {
        this.row = i;
        rows[i].activate?.();
        App.audio.play('ui_ok');
        if (!this.capture) this.save();
        changed = true;
      }
    }
    if (changed) {
      if (!this.capture && !this.confirmReset && !inp.menu('confirm') && !m.leftPressed) this.flashMsg = '';
      this.render();
    }
    inp.endFrame();
  }
}
