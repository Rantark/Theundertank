import Phaser from 'phaser';
import { App, setupCamera } from '../state.js';
import { text, setText, panel, COLORS } from '../ui/text.js';
import { NetClient } from '../net/NetClient.js';
import { DEFAULT_PORT } from '@undercrank/shared';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ADDR_CHARS = '0123456789.:ABCDEFGHIJKLMNOPQRSTUVWXYZ-';

/** Turn "192.168.1.5", "myhost:4000" or "https://x.y" into a Socket.IO URL (empty = this host). */
export function serverUrl(addr) {
  let a = String(addr || '').trim();
  if (!a) return '';
  if (!/^https?:\/\//i.test(a)) {
    a = `http://${a}`;
    // Default to the game's port when none was typed.
    if (!/:\d+$/.test(a.replace(/^https?:\/\//, ''))) a += `:${DEFAULT_PORT}`;
  }
  return a.toLowerCase();
}

// Online co-op menu: host a game on this machine, or join one by IP address / room code.
export class OnlineScene extends Phaser.Scene {
  constructor() {
    super('Online');
  }

  create() {
    setupCamera(this);
    App.audio.setMood('title');
    const g = this.add.graphics();
    panel(g, 60, 26, 360, 222);
    text(this, 240, 34, 'ONLINE CO-OP', { origin: [0.5, 0], scale: 2, color: COLORS.brass });
    this.code = '';
    this.address = localStorage.getItem('undercrank_join_address') || '';
    this.items = [
      { id: 'name', label: () => `YOUR NAME:   ${App.save.data.name}${this.editing === 'name' ? '_' : ''}` },
      { id: 'host', label: () => 'HOST A GAME ON THIS MACHINE' },
      { id: 'sep' },
      { id: 'address', label: () => `HOST ADDRESS:  ${this.address || '(THIS MACHINE)'}${this.editing === 'address' ? '_' : ''}` },
      { id: 'code', label: () => `ROOM CODE:     ${this.code ? (this.code + '____').slice(0, 4) : '(OPTIONAL)'}${this.picker === 'code' ? '  <' : ''}` },
      { id: 'join', label: () => 'JOIN GAME' },
      { id: 'sep' },
      { id: 'back', label: () => 'BACK' },
    ];
    this.index = 1;
    this.texts = this.items.map((_, i) => text(this, 80, 64 + i * 14, '', { color: COLORS.text }));
    this.status = text(this, 240, 182, '', { origin: [0.5, 0], color: COLORS.dim, maxWidth: 340 });
    this.help = text(this, 240, 206, '', { origin: [0.5, 0], color: COLORS.dim, maxWidth: 340 });
    const host = window.undercrankDesktop?.hostInfo();
    this.hostLine = host?.port ? `FRIENDS JOIN YOU AT: ${(host.addresses.length ? host.addresses : ['localhost']).map((a) => `${a}:${host.port}`).join('  ')}` : '';
    this.editing = null;
    this.picker = null;
    this.pickPos = 0;
    this.busy = false;
    App.input.textCapture = (e) => this.onKey(e);
    this.events.once('shutdown', () => (App.input.textCapture = null));
    this.refresh();
  }

  refresh() {
    this.items.forEach((it, i) => {
      if (it.id === 'sep') return setText(this.texts[i], '');
      setText(this.texts[i], `${i === this.index ? '> ' : '  '}${it.label()}`).setTint(i === this.index ? COLORS.brass : COLORS.text);
    });
    const id = this.items[this.index].id;
    const tips = {
      name: 'Type to change your name.',
      host: 'Starts a lobby on this computer. Share the address shown below with your friends.',
      address: "Type the host's IP address (e.g. 192.168.1.20). Leave empty to join a game hosted on this machine.",
      code: 'Optional. Leave empty to join the host\'s open lobby, or type their 4-letter room code.',
      join: 'Connect to the host address and join their lobby.',
      back: '',
    };
    setText(this.help, `${tips[id] || ''}${this.hostLine && (id === 'host' || id === 'name') ? `\n${this.hostLine}` : ''}`);
  }

  onKey(e) {
    if (this.busy) return;
    const it = this.items[this.index].id;
    const k = e.key;
    if (k === 'ArrowUp') this.move(-1);
    else if (k === 'ArrowDown' || k === 'Tab') this.move(1);
    else if (k === 'Enter') this.confirm();
    else if (k === 'Escape') this.back();
    else if (k === 'Backspace') {
      if (it === 'name') App.save.data.name = App.save.data.name.slice(0, -1);
      if (it === 'address') this.address = this.address.slice(0, -1);
      if (it === 'code') this.code = this.code.slice(0, -1);
    } else if (k.length === 1) {
      if (it === 'name' && App.save.data.name.length < 12 && /[a-z0-9 _-]/i.test(k)) App.save.data.name += k.toUpperCase();
      if (it === 'address' && this.address.length < 40 && /[a-z0-9.:\-/]/i.test(k)) this.address += k.toLowerCase();
      if (it === 'code' && this.code.length < 4 && /[a-z]/i.test(k)) this.code += k.toUpperCase();
    }
    this.editing = it === 'name' || it === 'address' ? it : null;
    this.refresh();
  }

  move(d) {
    do this.index = (this.index + d + this.items.length) % this.items.length;
    while (this.items[this.index].id === 'sep');
    this.picker = null;
    this.editing = null;
    App.audio.play('ui_move');
  }

  back() {
    App.audio.play('ui_back');
    if (App.net) App.net.disconnect();
    this.scene.start('Title');
  }

  setStatus(msg, color = COLORS.dim) {
    setText(this.status, msg).setTint(color);
  }

  async connect(url) {
    if (App.net && App.net.url === (url || undefined) && App.net.socket.connected) return App.net;
    if (App.net) App.net.disconnect();
    const net = new NetClient(url || undefined);
    App.net = net;
    this.setStatus(`CONNECTING TO ${url ? url.replace(/^https?:\/\//, '') : 'THIS MACHINE'}...`);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timed out')), 7000);
      net.socket.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
      net.socket.once('connect_error', (e) => {
        clearTimeout(t);
        reject(e);
      });
    }).catch((e) => {
      throw new Error(
        url
          ? `Could not reach ${url.replace(/^https?:\/\//, '')} (${e.message}). Check the address, that the host's game is open, and that port ${DEFAULT_PORT} is allowed through their firewall/router.`
          : `Could not reach this machine's server (${e.message}).`,
      );
    });
    return net;
  }

  async confirm() {
    const it = this.items[this.index].id;
    if (it === 'back') return this.back();
    if (it === 'name' || it === 'address') {
      this.move(1);
      return;
    }
    if (it === 'code') {
      // Gamepad-friendly letter picker.
      this.picker = 'code';
      if (!this.code.length) this.code = 'A';
      this.pickPos = this.code.length - 1;
      this.refresh();
      return;
    }
    this.busy = true;
    App.audio.play('ui_ok');
    App.save.persist();
    localStorage.setItem('undercrank_join_address', this.address);
    try {
      let res;
      if (it === 'host') {
        const net = await this.connect('');
        res = await net.create();
      } else {
        const net = await this.connect(serverUrl(this.address));
        this.setStatus('JOINING...');
        res = await net.join(this.code);
      }
      if (res.error) throw new Error(res.error);
      App.net.playerId = res.playerId;
      App.net.hosting = it === 'host';
      App.input.slots = [App.input.slots[0]]; // online: one local player
      this.scene.start('Town');
    } catch (e) {
      App.audio.play('deny');
      this.setStatus(`ERROR: ${e.message}`, COLORS.red);
      if (App.net && !App.net.lobby) App.net.disconnect();
    }
    this.busy = false;
  }

  update() {
    const inp = App.input;
    inp.poll(this.input.activePointer);
    for (let i = 0; i < 4; i++) {
      const dev = `pad${i}`;
      if (this.busy) break;
      if (this.picker === 'code') {
        const cur = LETTERS.indexOf(this.code[this.pickPos] || 'A');
        const set = (ch) => (this.code = this.code.slice(0, this.pickPos) + ch + this.code.slice(this.pickPos + 1));
        if (inp.pressedOn(dev, 'up')) set(LETTERS[(cur + 1) % LETTERS.length]);
        if (inp.pressedOn(dev, 'down')) set(LETTERS[(cur - 1 + LETTERS.length) % LETTERS.length]);
        if (inp.pressedOn(dev, 'right') && this.pickPos < 3) {
          this.pickPos++;
          if (this.code.length <= this.pickPos) this.code += 'A';
        }
        if (inp.pressedOn(dev, 'left') && this.pickPos > 0) this.pickPos--;
        if (inp.pressedOn(dev, 'back')) {
          this.code = '';
          this.picker = null;
        }
        if (inp.pressedOn(dev, 'confirm')) {
          this.picker = null;
          this.move(1);
        }
      } else if (this.picker === 'address') {
        // Gamepad address entry: up/down cycles characters, right adds, left deletes.
        const last = this.address.slice(-1) || '1';
        const cur = ADDR_CHARS.indexOf(last.toUpperCase());
        const setLast = (ch) => (this.address = this.address.slice(0, -1) + ch.toLowerCase());
        if (!this.address) this.address = '1';
        if (inp.pressedOn(dev, 'up')) setLast(ADDR_CHARS[(cur + 1) % ADDR_CHARS.length]);
        if (inp.pressedOn(dev, 'down')) setLast(ADDR_CHARS[(cur - 1 + ADDR_CHARS.length) % ADDR_CHARS.length]);
        if (inp.pressedOn(dev, 'right')) this.address += last.toLowerCase();
        if (inp.pressedOn(dev, 'left')) this.address = this.address.slice(0, -1);
        if (inp.pressedOn(dev, 'confirm') || inp.pressedOn(dev, 'back')) {
          this.picker = null;
          this.editing = null;
        }
      } else {
        if (inp.pressedOn(dev, 'up')) this.move(-1);
        if (inp.pressedOn(dev, 'down')) this.move(1);
        if (inp.pressedOn(dev, 'confirm')) {
          if (this.items[this.index].id === 'address') {
            this.picker = 'address';
            this.editing = 'address';
          } else this.confirm();
        }
        if (inp.pressedOn(dev, 'back')) this.back();
      }
    }
    this.refresh();
    inp.endFrame();
  }
}
