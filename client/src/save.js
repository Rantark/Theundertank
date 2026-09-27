// Permanent progression, persisted in localStorage.
import { UPGRADE_MAP, upgradeCost, CHARACTER_MAP } from '@undercrank/shared';

const KEY = 'undercrank_save_v1';

const DEFAULT = () => ({
  cogs: 0,
  upgrades: {},
  unlocked: ['tinker'],
  characters: ['tinker', 'tinker', 'tinker', 'tinker'], // chosen character per local slot
  best: { depth: 0, kills: 0 },
  runs: 0,
  totalCogs: 0,
  name: `Tinker-${Math.floor(Math.random() * 9000 + 1000)}`,
  settings: { sfx: 0.7, music: 0.5, shake: 1 },
});

export class Save {
  constructor() {
    this.data = DEFAULT();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        const def = DEFAULT();
        this.data = { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) }, best: { ...def.best, ...(d.best || {}) } };
      }
    } catch (e) {
      console.warn('Save load failed', e);
    }
  }

  persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  level(id) {
    return this.data.upgrades[id] || 0;
  }

  costOf(id) {
    const u = UPGRADE_MAP[id];
    return upgradeCost(u, this.level(id));
  }

  canBuy(id) {
    const u = UPGRADE_MAP[id];
    return this.level(id) < u.maxLevel && this.data.cogs >= this.costOf(id);
  }

  buy(id) {
    if (!this.canBuy(id)) return false;
    this.data.cogs -= this.costOf(id);
    this.data.upgrades[id] = this.level(id) + 1;
    this.persist();
    return true;
  }

  unlock(charId) {
    const c = CHARACTER_MAP[charId];
    if (this.data.unlocked.includes(charId) || this.data.cogs < c.unlockCost) return false;
    this.data.cogs -= c.unlockCost;
    this.data.unlocked.push(charId);
    this.persist();
    return true;
  }

  /** Bank the results of a run. */
  recordRun(summary, localIds) {
    let earned = 0;
    let kills = 0;
    for (const p of summary.players) {
      if (localIds && !localIds.includes(p.id)) continue;
      earned += p.cogs;
      kills += p.kills;
    }
    this.data.cogs += earned;
    this.data.totalCogs += earned;
    this.data.runs++;
    this.data.best.depth = Math.max(this.data.best.depth, summary.depth);
    this.data.best.kills = Math.max(this.data.best.kills, kills);
    this.persist();
    return earned;
  }

  reset() {
    this.data = DEFAULT();
    this.persist();
  }
}
