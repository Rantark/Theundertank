// Deterministic seeded RNG (mulberry32) with helpers.
// Floor generation uses RNGs forked from the run seed so every client that
// knows the seed reproduces the identical dungeon layout.

export function hashString(str) {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed) {
    this.state = (typeof seed === 'number' ? seed : hashString(seed)) >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Float in [0, 1). */
  next() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(a, b) {
    return a + (b - a) * this.next();
  }

  /** Integer in [a, b] inclusive. */
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  chance(p) {
    return this.next() < p;
  }

  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  /** Pick using a weight accessor; returns undefined for empty/zero weights. */
  weighted(arr, weightFn = (x) => x.weight ?? 1) {
    let total = 0;
    for (const x of arr) total += Math.max(0, weightFn(x));
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const x of arr) {
      r -= Math.max(0, weightFn(x));
      if (r <= 0) return x;
    }
    return arr[arr.length - 1];
  }

  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Derive an independent RNG stream from this seed + a label. */
  fork(label) {
    return new RNG(hashString(`${this.state}:${label}`));
  }
}

export function makeSeed() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
