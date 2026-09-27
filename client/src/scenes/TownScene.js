import Phaser from 'phaser';
import { App } from '../state.js';
import { text, setText, panel, COLORS } from '../ui/text.js';
import { SHOPS, PLAYER_COLORS, CHARACTER_MAP } from '@undercrank/shared';

const W = 640;
const H = 400;
const GATE = { x: 320, y: 150 };
const BUILDINGS = [
  { id: 'tinkerer', x: 110, y: 120 },
  { id: 'gunsmith', x: 530, y: 120 },
  { id: 'alchemist', x: 110, y: 330 },
  { id: 'clockmaker', x: 530, y: 330 },
];

// The walkable town hub. Local players join here, visit shops and descend.
export class TownScene extends Phaser.Scene {
  constructor() {
    super('Town');
  }

  create() {
    App.audio.setMood('town');
    this.cameras.main.setBackgroundColor('#1a1410');
    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.fadeIn(400);
    this.solids = [];
    this.interactables = [];
    this.leaving = false;

    // Ground
    const rt = this.add.renderTexture(0, 0, W, H).setOrigin(0).setDepth(0);
    for (let y = 0; y < H; y += 16) for (let x = 0; x < W; x += 16) rt.draw(`cobble_${(x * 7 + y * 13) % 3}`, x, y);
    const gfx = this.make.graphics({}, false);
    gfx.fillStyle(0x000000, 0.18);
    gfx.fillRect(0, 0, W, 40);
    // Tram rails through the plaza.
    gfx.fillStyle(0x6b5d50, 1);
    gfx.fillRect(0, 226, W, 2);
    gfx.fillRect(0, 236, W, 2);
    gfx.fillStyle(0x2a2016, 1);
    for (let x = 0; x < W; x += 10) gfx.fillRect(x, 224, 3, 16);
    rt.draw(gfx);
    gfx.destroy();

    // Perimeter walls
    for (let x = 0; x < W; x += 24) this.add.image(x + 12, 6, 'bigpipe').setDepth(2);
    this.solids.push({ x: 0, y: 0, w: W, h: 24 }, { x: 0, y: H - 8, w: W, h: 8 }, { x: 0, y: 0, w: 8, h: H }, { x: W - 8, y: 0, w: 8, h: H });

    // The Undercrank
    this.gate = this.add.image(GATE.x, GATE.y, 'gate').setDepth(10);
    this.gateGlow = this.add.image(GATE.x, GATE.y, 'glow').setTint(0xff6a1f).setBlendMode('ADD').setScale(1.6).setAlpha(0.3).setDepth(11);
    this.solids.push({ circle: true, x: GATE.x, y: GATE.y, r: 40 });
    this.interactables.push({ kind: 'gate', x: GATE.x, y: GATE.y + 48, label: 'DESCEND INTO THE UNDERCRANK' });
    text(this, GATE.x, GATE.y - 58, 'THE UNDERCRANK', { origin: [0.5, 1], color: COLORS.brass, depth: 12 });
    this.add.particles(GATE.x, GATE.y, 'puff', {
      speed: { min: 5, max: 20 }, angle: { min: 250, max: 290 }, lifespan: 3000, scale: { start: 1, end: 4 }, alpha: { start: 0.25, end: 0 },
      frequency: 160, tint: 0xe6e9e4, emitZone: { type: 'random', source: new Phaser.Geom.Circle(0, 0, 18) },
    }).setDepth(13);

    // Shops
    for (const b of BUILDINGS) {
      const img = this.add.image(b.x, b.y, `bld_${b.id}`).setOrigin(0.5, 1).setDepth(b.y);
      this.solids.push({ x: b.x - 42, y: b.y - 54, w: 84, h: 52 });
      text(this, b.x, b.y - 82, SHOPS[b.id].name.toUpperCase(), { origin: [0.5, 1], color: SHOPS[b.id].color, depth: 500 });
      const npc = this.add.sprite(b.x + 22, b.y + 10, `npc_${b.id}`).setDepth(b.y + 10);
      this.interactables.push({ kind: 'shop', id: b.id, x: b.x + 22, y: b.y + 10, label: `TALK TO THE ${SHOPS[b.id].name.toUpperCase()}`, npc });
      // Chimney smoke.
      this.add.particles(b.x + 30, b.y - 80, 'puff', {
        speedY: { min: -18, max: -8 }, speedX: { min: 2, max: 10 }, lifespan: 2800, scale: { start: 0.6, end: 3 }, alpha: { start: 0.35, end: 0 }, frequency: 260, tint: 0x6b5d50,
      }).setDepth(600);
      img.setInteractive();
    }

    // Plaza decor
    this.add.image(320, 330, 'fountain').setDepth(330);
    this.solids.push({ circle: true, x: 320, y: 332, r: 14 });
    this.add.particles(320, 318, 'px', { speedY: { min: -40, max: -20 }, speedX: { min: -12, max: 12 }, gravityY: 80, lifespan: 700, tint: 0x9fe8ff, frequency: 40, scale: { start: 1, end: 0.5 } }).setDepth(331);
    const lamps = [[200, 90], [440, 90], [200, 260], [440, 260], [60, 220], [580, 220], [320, 380]];
    for (const [x, y] of lamps) {
      this.add.image(x, y, 'lamp').setOrigin(0.5, 1).setDepth(y);
      this.add.image(x, y - 24, 'glow').setBlendMode('ADD').setTint(0xff9c3a).setScale(2.2).setAlpha(0.35).setDepth(700);
      this.solids.push({ circle: true, x, y: y - 2, r: 3 });
    }
    for (const [x, y] of [[250, 60], [390, 60], [30, 150], [610, 380]]) {
      this.add.image(x, y, 'barrel').setDepth(y + 8);
      this.solids.push({ circle: true, x, y: y + 4, r: 6 });
    }
    // Records board
    this.board = text(this, 320, 262, '', { origin: [0.5, 0], color: COLORS.dim, depth: 500 });

    // Townsfolk wander the plaza for a bustling feel.
    this.townies = [];
    for (let i = 0; i < 9; i++) {
      const v = i % 5;
      const s = this.add.sprite(Phaser.Math.Between(60, 580), Phaser.Math.Between(200, 380), `townie_${v}_0`).setDepth(300);
      s.v = v;
      s.target = null;
      s.wait = Math.random() * 3;
      this.townies.push(s);
    }
    // Warm evening tint.
    this.add.rectangle(W / 2, H / 2, W, H, 0xff9c3a, 0.06).setBlendMode('ADD').setDepth(800);

    // Players
    this.players = [];
    App.input.slots.forEach((dev, slot) => this.spawnPlayer(slot));
    this.cameras.main.centerOn(GATE.x, GATE.y + 80);

    // UI layer (fixed to camera)
    this.ui = this.add.graphics().setScrollFactor(0).setDepth(1000);
    this.cogText = text(this, 16, 6, '', { color: COLORS.brass, depth: 1001 }).setScrollFactor(0);
    this.cogIcon = this.add.image(10, 10, 'ui_cog').setScrollFactor(0).setDepth(1001);
    this.joinText = text(this, 474, 6, '', { origin: [1, 0], color: COLORS.dim, depth: 1001 }).setScrollFactor(0);
    this.prompt = text(this, 240, 256, '', { origin: [0.5, 0], color: COLORS.text, depth: 1001 }).setScrollFactor(0);
    this.onlineText = text(this, 474, 18, '', { origin: [1, 0], color: COLORS.cyan, depth: 1001, maxWidth: 200 }).setScrollFactor(0);
    this.events.on('resume', () => this.refreshPlayers());
    if (App.net) {
      App.net.onLobby = () => this.updateOnline();
      App.net.onStart = () => {
        if (this.leaving) return;
        this.leaving = true;
        App.audio.play('descend');
        this.cameras.main.fadeOut(400);
        this.time.delayedCall(420, () => this.scene.start('Game', { mode: 'online' }));
      };
      App.net.onError = (msg) => {
        setText(this.onlineText, msg);
      };
      // The shop scene may have changed our character or upgrades.
      App.net.sendProfile();
      this.events.once('shutdown', () => {
        if (!App.net) return;
        App.net.onLobby = null;
        App.net.onStart = null;
        App.net.onError = null;
      });
    }
  }

  spawnPlayer(slot) {
    const ch = this.charFor(slot);
    const s = this.add.sprite(GATE.x + slot * 16, GATE.y + 80, `pl_${ch}_0`).setOrigin(0.5, 0.78);
    const ring = this.add.image(s.x, s.y + 3, `ring_${slot}`).setDepth(50);
    const label = text(this, s.x, s.y - 14, `P${slot + 1}`, { origin: [0.5, 1], color: PLAYER_COLORS[slot], depth: 900 });
    this.players[slot] = { s, ring, label, slot, x: s.x, y: s.y, r: 5, vx: 0, vy: 0, char: ch };
  }

  charFor(slot) {
    const c = App.save.data.characters[slot] || 'tinker';
    return App.save.data.unlocked.includes(c) ? c : 'tinker';
  }

  refreshPlayers() {
    for (const p of this.players) if (p) p.char = this.charFor(p.slot);
  }

  collide(p) {
    for (const s of this.solids) {
      if (s.circle) {
        const dx = p.x - s.x;
        const dy = p.y - s.y;
        const d = Math.hypot(dx, dy);
        const min = s.r + p.r;
        if (d < min && d > 0.001) {
          p.x = s.x + (dx / d) * min;
          p.y = s.y + (dy / d) * min;
        }
      } else {
        const cx = Math.max(s.x, Math.min(p.x, s.x + s.w));
        const cy = Math.max(s.y, Math.min(p.y, s.y + s.h));
        const dx = p.x - cx;
        const dy = p.y - cy;
        const d = Math.hypot(dx, dy);
        if (d < p.r) {
          if (d > 0.001) {
            p.x = cx + (dx / d) * p.r;
            p.y = cy + (dy / d) * p.r;
          } else p.y = s.y + s.h + p.r;
        }
      }
    }
  }

  nearestInteractable(p) {
    let best = null;
    let bd = 30;
    for (const it of this.interactables) {
      const d = Math.hypot(p.x - it.x, p.y - it.y);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  interact(p, it) {
    if (it.kind === 'shop') {
      App.audio.play('ui_ok');
      this.scene.launch('Shop', { shop: it.id, slot: p.slot, online: !!App.net });
      this.scene.pause();
    } else if (it.kind === 'gate') {
      if (App.net) {
        App.net.toggleReady();
        App.audio.play('ui_ok');
      } else this.descend();
    }
  }

  descend() {
    if (this.leaving || App.net) return;
    this.leaving = true;
    App.audio.play('descend');
    this.cameras.main.fadeOut(500);
    const players = App.input.slots.map((_, slot) => ({ slot, character: this.charFor(slot), name: `P${slot + 1}` }));
    this.time.delayedCall(520, () => this.scene.start('Game', { mode: 'local', players }));
  }

  updateOnline() {
    const n = App.net;
    if (!n || !n.lobby) return;
    const lines = [`ROOM CODE: ${n.lobby.code}`];
    for (const pl of n.lobby.players) lines.push(`${pl.ready ? '[READY]' : '[WAIT] '} ${pl.name}${pl.id === n.playerId ? ' (YOU)' : ''}`);
    if (n.lobby.inGame) lines.push('RUN IN PROGRESS...');
    else lines.push('ALL READY AT THE GATE = DESCEND');
    setText(this.onlineText, lines.join('\n'));
  }

  update(time, delta) {
    const inp = App.input;
    inp.poll(this.input.activePointer);
    const dt = delta / 1000;

    // Local co-op join / leave (not when online).
    if (!App.net) {
      const dev = inp.joinRequest();
      if (dev) {
        const slot = inp.addSlot(dev);
        if (slot >= 0) {
          this.spawnPlayer(slot);
          App.audio.play('pickup');
        }
      }
      for (let slot = inp.slots.length - 1; slot > 0; slot--) {
        if (inp.pressedOn(inp.slots[slot], 'leave')) {
          const pl = this.players[slot];
          pl.s.destroy();
          pl.ring.destroy();
          pl.label.destroy();
          inp.removeSlot(slot);
          this.players.splice(slot, 1);
          this.players.forEach((q, i) => {
            q.slot = i;
            setText(q.label, `P${i + 1}`).setTint(PLAYER_COLORS[i]);
            q.ring.setTexture(`ring_${i}`);
          });
          App.audio.play('ui_back');
        }
      }
    }
    if (inp.menu('back', inp.slots[0]) && !this.leaving) {
      if (App.net) App.net.disconnect();
      this.scene.start('Title');
      inp.endFrame();
      return;
    }

    let prompt = '';
    let cx = 0;
    let cy = 0;
    this.players.forEach((p) => {
      const pi = inp.playerInput(p.slot, { x: p.x - this.cameras.main.scrollX, y: p.y - this.cameras.main.scrollY }, null);
      const speed = 90;
      let mx = pi.mx;
      let my = pi.my;
      const l = Math.hypot(mx, my);
      if (l > 1) {
        mx /= l;
        my /= l;
      }
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      this.collide(p);
      const moving = l > 0.1;
      p.s.setTexture(`pl_${p.char}_${moving ? Math.floor(time / 110) % 2 : 0}`);
      if (Math.abs(mx) > 0.1) p.s.setFlipX(mx < 0);
      p.s.setPosition(p.x, p.y).setDepth(p.y);
      p.ring.setPosition(p.x, p.y + 3);
      p.label.setPosition(p.x, p.y - 14).setVisible(this.players.length > 1);
      cx += p.x;
      cy += p.y;
      const it = this.nearestInteractable(p);
      if (it) {
        const gateOnline = it.kind === 'gate' && App.net;
        prompt = `[${inp.hint(p.slot, 'interact')}] ${gateOnline ? 'TOGGLE READY' : it.label}`;
        const s = inp.seq[p.slot];
        if (p.lastInter !== undefined && s.inter !== p.lastInter) this.interact(p, it);
      }
      p.lastInter = inp.seq[p.slot].inter;
    });
    if (this.players.length) this.cameras.main.centerOn(cx / this.players.length, cy / this.players.length);

    // Townsfolk wander.
    for (const t of this.townies) {
      if (!t.target) {
        t.wait -= dt;
        if (t.wait <= 0) t.target = [Phaser.Math.Between(40, 600), Phaser.Math.Between(200, 385)];
        t.setTexture(`townie_${t.v}_0`);
      } else {
        const dx = t.target[0] - t.x;
        const dy = t.target[1] - t.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) {
          t.target = null;
          t.wait = 1 + Math.random() * 4;
        } else {
          t.x += (dx / d) * 28 * dt;
          t.y += (dy / d) * 28 * dt;
          t.setFlipX(dx < 0);
          t.setTexture(`townie_${t.v}_${Math.floor(time / 160) % 2}`);
        }
      }
      t.setDepth(t.y);
    }
    this.gate.rotation = Math.sin(time / 2000) * 0.03;
    this.gateGlow.setAlpha(0.25 + Math.sin(time / 300) * 0.06);

    // UI
    const ui = this.ui;
    ui.clear();
    panel(ui, 2, 2, 110, 14, { alpha: 0.8 });
    setText(this.cogText, `${App.save.data.cogs} COGS`);
    setText(this.joinText, App.net ? 'ONLINE' : `${this.players.length}/4 PLAYERS - START/ENTER TO JOIN`);
    this.updateOnline();
    setText(this.prompt, prompt);
    const d = App.save.data;
    setText(this.board, `DEEPEST FLOOR ${d.best.depth}\nRUNS ${d.runs}`);
    inp.endFrame();
  }
}
