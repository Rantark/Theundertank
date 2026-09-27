import Phaser from 'phaser';
import { App, ROOM_X, ROOM_Y } from '../state.js';
import { LocalSession } from '../net/LocalSession.js';
import { WorldRenderer } from '../gfx/worldRenderer.js';
import { Fx } from '../gfx/fx.js';

// Runs a dungeon run: drives the session (local sim or network), feeds input,
// renders the world and turns simulation events into juice.
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  init(data) {
    this.mode = data.mode || 'local';
    this.playersCfg = data.players || [{ slot: 0, character: 'tinker' }];
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0d0b0a');
    cam.setScroll(-ROOM_X, -ROOM_Y);
    if (this.mode === 'online') {
      this.session = App.net.startSession();
    } else {
      this.session = new LocalSession(this.playersCfg, App.save.data.upgrades);
    }
    this.fx = new Fx(this, 500);
    this.world = new WorldRenderer(this, this.fx);
    this.ending = false;
    this.lastRoomKey = null;
    this.scene.launch('Hud', { gameScene: this });
    this.scene.bringToTop('Hud');
    App.audio.setMood('dungeon');
    this.events.once('shutdown', () => this.cleanup());
    this.cameras.main.fadeIn(300);
  }

  get view() {
    return this.session.view;
  }

  get localIds() {
    return this.session.localIds;
  }

  inputHint(action) {
    return App.input.hint(0, action);
  }

  cleanup() {
    this.world.destroy();
    this.session.destroy();
    this.scene.stop('Hud');
    this.scene.stop('Pause');
  }

  openPause() {
    if (this.scene.isActive('Pause')) return;
    if (!this.session.online) this.session.paused = true;
    this.scene.launch('Pause', { gameScene: this });
    this.scene.bringToTop('Pause');
  }

  resume() {
    this.session.paused = false;
  }

  update(time, delta) {
    const inp = App.input;
    const pausedOverlay = this.scene.isActive('Pause');
    if (!pausedOverlay) inp.poll(this.input.activePointer);
    const view = this.session.view;
    if (!view || !view.room) {
      if (!pausedOverlay) inp.endFrame();
      return;
    }
    const dt = delta / 1000;

    if (!pausedOverlay && (inp.menu('pause') || inp.menu('tab')) && !this.ending) {
      this.openPause();
      inp.endFrame();
      return;
    }

    // Gather input for each local player.
    const inputs = {};
    if (!pausedOverlay) {
      const ptr = this.input.activePointer;
      const mouseWorld = { x: ptr.x - ROOM_X, y: ptr.y - ROOM_Y };
      this.localIds.forEach((pid, slot) => {
        const p = view.players.find((q) => q.id === pid);
        const screen = p ? { x: p.x + ROOM_X, y: p.y + ROOM_Y - 3 } : null;
        inputs[pid] = inp.playerInput(slot, screen, mouseWorld);
      });
    }
    this.session.update(delta, inputs);

    for (const e of this.session.drainEvents()) this.handleEvent(e);

    const v = this.session.view;
    if (v && v.room) {
      this.world.render(v, dt, this.localIds);
      const key = `${v.depth}:${v.room.id}`;
      if (key !== this.lastRoomKey) {
        this.lastRoomKey = key;
        this.cameras.main.fadeIn(160, 13, 11, 10);
      }
      const bossAlive = v.enemies.some((e) => e.boss);
      App.audio.setMood(bossAlive ? 'boss' : 'dungeon');
    }
    this.fx.update(dt);
    const [sx, sy] = this.fx.shakeOffset(dt);
    this.cameras.main.setScroll(-ROOM_X + sx, -ROOM_Y + sy);

    if (this.session.over && !this.ending) {
      this.ending = true;
      this.time.delayedCall(1800, () => this.finish());
    }
    if (!pausedOverlay) inp.endFrame();
  }

  finish() {
    const summary = this.session.summary;
    App.lastSummary = summary;
    this.cameras.main.fadeOut(400);
    this.time.delayedCall(420, () => this.scene.start('Summary', { summary, localIds: this.localIds, mode: this.mode }));
  }

  handleEvent(e) {
    const hud = this.scene.get('Hud');
    switch (e.type) {
      case 'fire':
        this.fx.flash(e.x, e.y, 'muzzle', { rot: e.a, scale: 0.9, dur: 50, tint: e.heat > 0.5 ? 0xff9c3a : 0xffe08a });
        this.fx.smoke.explode(1, e.x, e.y);
        App.audio.play('shoot');
        break;
      case 'hit':
        this.fx.sparks.explode(e.c ? 10 : 3, e.x, e.y);
        if (e.c) this.fx.flash(e.x, e.y, 'flash', { scale: 1.2, tint: 0xffffff });
        App.audio.play('hit');
        break;
      case 'kill': {
        const big = e.boss ? 3 : e.elite ? 2 : 1;
        this.fx.debris.explode(6 * big, e.x, e.y);
        this.fx.steam.explode(4 * big, e.x, e.y);
        this.fx.sparks.explode(6 * big, e.x, e.y);
        this.fx.flash(e.x, e.y, 'glow', { scale: 0.35 * big, tint: 0xffd08a, dur: 120 });
        App.audio.play('kill');
        break;
      }
      case 'hurt':
        this.world.flashPlayer(e.pid);
        this.fx.event({ k: 'hurt', x: e.x, y: e.y });
        if (this.localIds.includes(e.pid)) hud?.damageFlash();
        break;
      case 'shake':
        this.fx.shake(e.a);
        break;
      case 'hitstop':
        this.session.freeze(e.ms);
        break;
      case 'fx':
        this.fx.event(e);
        break;
      case 'bolt':
        this.fx.bolt(e.pts);
        break;
      case 'dmg':
        this.fx.number(e.x, e.y, e.v, 0xffe08a);
        break;
      case 'sfx':
        App.audio.play(e.n);
        break;
      case 'clear':
        App.audio.play('clear');
        break;
      case 'death':
        this.fx.debris.explode(20, e.x, e.y);
        this.fx.smoke.explode(12, e.x, e.y);
        break;
      default:
        break;
    }
    hud?.onEvent(e);
  }
}
