import Phaser from 'phaser';
import { App, setupCamera } from '../state.js';
import { text, setText, panel, COLORS } from '../ui/text.js';
import { NetClient } from '../net/NetClient.js';

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

// Online co-op menu: name, server address, create a room or join one by code.
export class OnlineScene extends Phaser.Scene {
  constructor() {
    super('Online');
  }

  create() {
    setupCamera(this);
    App.audio.setMood('title');
    const g = this.add.graphics();
    panel(g, 90, 40, 300, 190);
    text(this, 240, 52, 'ONLINE CO-OP', { origin: [0.5, 0], scale: 2, color: COLORS.brass });
    this.code = '';
    this.server = localStorage.getItem('undercrank_server') || '';
    this.items = [
      { id: 'name', label: () => `NAME: ${App.save.data.name}${this.editing === 'name' ? '_' : ''}` },
      { id: 'server', label: () => `SERVER: ${this.server || 'THIS HOST'}${this.editing === 'server' ? '_' : ''}` },
      { id: 'create', label: () => 'CREATE ROOM' },
      { id: 'join', label: () => `JOIN ROOM: ${(this.code + '____').slice(0, 4)}${this.picker ? '  (UP/DOWN, LEFT/RIGHT)' : ''}` },
      { id: 'back', label: () => 'BACK' },
    ];
    this.index = 2;
    this.texts = this.items.map((_, i) => text(this, 110, 90 + i * 16, '', { color: COLORS.text }));
    this.status = text(this, 240, 186, '', { origin: [0.5, 0], color: COLORS.dim, maxWidth: 280 });
    this.help = text(this, 240, 210, 'TYPE TO EDIT FIELDS. ROOM CODES ARE 4 LETTERS.', { origin: [0.5, 0], color: COLORS.dim });
    // Desktop build: this machine is a server too, so tell the player what friends type in.
    const host = window.undercrankDesktop?.hostInfo();
    if (host && host.port) {
      const addr = host.addresses.length ? host.addresses.map((a) => `${a}:${host.port}`).join('  ') : `localhost:${host.port}`;
      text(this, 240, 222, `FRIENDS JOIN YOUR ROOMS AT: ${addr}`, { origin: [0.5, 0], color: COLORS.verdigris, maxWidth: 300 });
    }
    this.editing = null;
    this.picker = false;
    this.pickPos = 0;
    this.busy = false;
    App.input.textCapture = (e) => this.onKey(e);
    this.events.once('shutdown', () => (App.input.textCapture = null));
    this.refresh();
  }

  refresh() {
    this.items.forEach((it, i) => setText(this.texts[i], `${i === this.index ? '> ' : '  '}${it.label()}`).setTint(i === this.index ? COLORS.brass : COLORS.text));
  }

  onKey(e) {
    if (this.busy) return;
    const it = this.items[this.index].id;
    const k = e.key;
    if (k === 'ArrowUp') this.move(-1);
    else if (k === 'ArrowDown') this.move(1);
    else if (k === 'Enter') this.confirm();
    else if (k === 'Escape') this.scene.start('Title');
    else if (k === 'Backspace') {
      if (it === 'name') App.save.data.name = App.save.data.name.slice(0, -1);
      if (it === 'server') this.server = this.server.slice(0, -1);
      if (it === 'join') this.code = this.code.slice(0, -1);
    } else if (k.length === 1) {
      if (it === 'name' && App.save.data.name.length < 12 && /[a-z0-9 _-]/i.test(k)) App.save.data.name += k.toUpperCase();
      if (it === 'server' && this.server.length < 40 && /[a-z0-9.:\-/]/i.test(k)) this.server += k.toLowerCase();
      if (it === 'join' && this.code.length < 4 && /[a-z]/i.test(k)) this.code += k.toUpperCase();
    }
    this.editing = it === 'name' || it === 'server' ? it : null;
    this.refresh();
  }

  move(d) {
    this.index = (this.index + d + this.items.length) % this.items.length;
    this.picker = false;
    App.audio.play('ui_move');
  }

  status_(msg, color = COLORS.dim) {
    setText(this.status, msg).setTint(color);
  }

  async connect() {
    App.save.persist();
    localStorage.setItem('undercrank_server', this.server);
    let url = this.server.trim();
    if (url && !/^https?:\/\//.test(url)) url = `http://${url}`;
    if (App.net && App.net.url === url && App.net.socket.connected) return App.net;
    if (App.net) App.net.disconnect();
    const net = new NetClient(url || undefined);
    App.net = net;
    this.status_('CONNECTING...');
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timed out')), 6000);
      net.socket.once('connect', () => {
        clearTimeout(t);
        resolve();
      });
      net.socket.once('connect_error', (e) => {
        clearTimeout(t);
        reject(e);
      });
    });
    return net;
  }

  async confirm() {
    const it = this.items[this.index].id;
    if (it === 'back') {
      App.audio.play('ui_back');
      if (App.net) App.net.disconnect();
      this.scene.start('Title');
      return;
    }
    if (it === 'name' || it === 'server') return;
    if (it === 'join' && this.code.length < 4) {
      this.picker = true;
      if (!this.code.length) this.code = 'A';
      this.pickPos = this.code.length - 1;
      this.refresh();
      return;
    }
    this.busy = true;
    App.audio.play('ui_ok');
    try {
      const net = await this.connect();
      const res = it === 'create' ? await net.create() : await net.join(this.code);
      if (res.error) throw new Error(res.error);
      net.playerId = res.playerId;
      App.input.slots = [App.input.slots[0]]; // online: one local player
      this.scene.start('Town');
    } catch (e) {
      App.audio.play('deny');
      this.status_(`ERROR: ${e.message}`, COLORS.red);
      if (App.net && !App.net.lobby) {
        App.net.disconnect();
      }
    }
    this.busy = false;
  }

  update() {
    const inp = App.input;
    inp.poll(this.input.activePointer);
    // Gamepad navigation (keyboard is handled by onKey).
    for (let i = 0; i < 4; i++) {
      const dev = `pad${i}`;
      if (this.busy) break;
      if (this.picker) {
        const cur = LETTERS.indexOf(this.code[this.pickPos] || 'A');
        if (inp.pressedOn(dev, 'up')) this.code = this.code.slice(0, this.pickPos) + LETTERS[(cur + 1) % LETTERS.length] + this.code.slice(this.pickPos + 1);
        if (inp.pressedOn(dev, 'down')) this.code = this.code.slice(0, this.pickPos) + LETTERS[(cur - 1 + LETTERS.length) % LETTERS.length] + this.code.slice(this.pickPos + 1);
        if (inp.pressedOn(dev, 'right') && this.pickPos < 3) {
          this.pickPos++;
          if (this.code.length <= this.pickPos) this.code += 'A';
        }
        if (inp.pressedOn(dev, 'left') && this.pickPos > 0) this.pickPos--;
        if (inp.pressedOn(dev, 'back')) this.picker = false;
        if (inp.pressedOn(dev, 'confirm') && this.code.length === 4) {
          this.picker = false;
          this.confirm();
        }
      } else {
        if (inp.pressedOn(dev, 'up')) this.move(-1);
        if (inp.pressedOn(dev, 'down')) this.move(1);
        if (inp.pressedOn(dev, 'confirm')) this.confirm();
        if (inp.pressedOn(dev, 'back')) this.scene.start('Title');
      }
    }
    this.refresh();
    inp.endFrame();
  }
}
