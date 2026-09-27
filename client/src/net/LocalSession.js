// Runs the shared simulation locally (solo and couch co-op) at a fixed 60Hz step.
import { Game, LOCAL_DT, makeSeed } from '@undercrank/shared';

export class LocalSession {
  /**
   * @param {Array} players [{ slot, character, name }]
   * @param {object} upgrades permanent upgrades from the save (shared by local players)
   */
  constructor(players, upgrades) {
    this.online = false;
    this.game = new Game({
      seed: makeSeed(),
      players: players.map((p, i) => ({ id: i + 1, slot: p.slot ?? i, name: p.name || `P${i + 1}`, character: p.character, upgrades })),
    });
    this.localIds = players.map((_, i) => i + 1);
    this.acc = 0;
    this.freezeMs = 0;
    this.paused = false;
    this.pending = [];
    this.pending.push(...this.game.drainEvents());
  }

  get view() {
    return this.game;
  }

  /** Hit-stop: freeze simulation for a few milliseconds. */
  freeze(ms) {
    this.freezeMs = Math.max(this.freezeMs, ms);
  }

  update(deltaMs, inputs) {
    if (this.paused || this.game.over) return;
    if (this.freezeMs > 0) {
      this.freezeMs -= deltaMs;
      return;
    }
    this.acc += Math.min(deltaMs, 100) / 1000;
    let steps = 0;
    while (this.acc >= LOCAL_DT && steps < 5) {
      this.game.step(LOCAL_DT, inputs);
      this.pending.push(...this.game.drainEvents());
      this.acc -= LOCAL_DT;
      steps++;
      // Freeze immediately on hit-stop events so the impact frame is held.
      if (this.pending.some((e) => e.type === 'hitstop')) break;
    }
  }

  drainEvents() {
    const ev = this.pending;
    this.pending = [];
    return ev;
  }

  get over() {
    return this.game.over;
  }

  get summary() {
    return this.game.summary;
  }

  abandon() {
    this.game.gameOver();
    this.pending.push(...this.game.drainEvents());
  }

  destroy() {}
}
