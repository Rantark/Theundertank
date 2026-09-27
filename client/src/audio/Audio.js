// PROCEDURAL AUDIO
// All sound effects are synthesised with the Web Audio API from a few primitives
// (enveloped oscillators and filtered noise). Music is a tiny step sequencer with
// three moods: 'town' (warm waltz), 'dungeon' (ticking clockwork drone), 'boss'.

const MIN_GAP = { shoot: 0.05, hit: 0.035, eshoot: 0.06, zap: 0.07, cog: 0.03, spark: 0.05, pop: 0.05, boom: 0.06, hiss: 0.2, clink: 0.05, kill: 0.03 };

export class Audio {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.last = {};
    this.mood = null;
    this.step = 0;
    this.nextNote = 0;
  }

  /** Must be called from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.applyVolumes();
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.timer = setInterval(() => this.schedule(), 40);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = this.settings.sfx;
    this.musicGain.gain.value = this.settings.music * 0.55;
  }

  // ------------------------------------------------------------ primitives
  tone({ type = 'square', f0 = 440, f1 = null, dur = 0.1, vol = 0.1, attack = 0.005, at = 0, dest = null, curve = 'exp' }) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) {
      if (curve === 'exp') o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      else o.frequency.linearRampToValueAtTime(f1, t + dur);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.2, type = 'lowpass', f0 = 1000, f1 = null, q = 1, at = 0, attack = 0.005, dest = null }) {
    const c = this.ctx;
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest || this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------ effects
  play(name) {
    if (!this.ctx || this.settings.sfx <= 0) return;
    const now = this.ctx.currentTime;
    const gap = MIN_GAP[name] ?? 0.02;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const fn = SFX[name];
    if (fn) fn(this);
  }

  // ------------------------------------------------------------ music
  setMood(mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.step = 0;
    if (this.ctx) this.nextNote = this.ctx.currentTime + 0.1;
  }

  schedule() {
    if (!this.ctx || !this.mood || this.settings.music <= 0) return;
    const song = SONGS[this.mood];
    if (!song) return;
    const stepDur = 60 / song.bpm / song.div;
    while (this.nextNote < this.ctx.currentTime + 0.25) {
      const at = this.nextNote - this.ctx.currentTime;
      song.play(this, this.step, Math.max(0, at), stepDur);
      this.step++;
      this.nextNote += stepDur;
    }
  }
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Each effect is a small recipe of primitives.
const SFX = {
  shoot: (a) => { a.tone({ type: 'square', f0: 920, f1: 380, dur: 0.06, vol: 0.05 }); a.noise({ dur: 0.04, vol: 0.04, type: 'highpass', f0: 3000 }); },
  eshoot: (a) => a.tone({ type: 'triangle', f0: 340, f1: 180, dur: 0.09, vol: 0.06 }),
  hit: (a) => { a.noise({ dur: 0.05, vol: 0.09, type: 'bandpass', f0: 2400, q: 3 }); a.tone({ type: 'square', f0: 220, f1: 110, dur: 0.05, vol: 0.04 }); },
  clink: (a) => a.tone({ type: 'triangle', f0: 2600, f1: 2200, dur: 0.05, vol: 0.06 }),
  kill: (a) => {
    a.noise({ dur: 0.22, vol: 0.18, type: 'lowpass', f0: 1400, f1: 200 });
    a.tone({ type: 'square', f0: 200, f1: 60, dur: 0.16, vol: 0.06 });
    a.tone({ type: 'triangle', f0: 1900, dur: 0.07, vol: 0.05, at: 0.03 });
    a.tone({ type: 'triangle', f0: 2500, dur: 0.06, vol: 0.04, at: 0.07 });
  },
  hurt: (a) => { a.tone({ type: 'sawtooth', f0: 420, f1: 90, dur: 0.28, vol: 0.14 }); a.noise({ dur: 0.18, vol: 0.12, type: 'lowpass', f0: 1800 }); },
  dash: (a) => a.noise({ dur: 0.16, vol: 0.12, type: 'bandpass', f0: 900, f1: 4200, q: 1.5 }),
  boom: (a) => { a.noise({ dur: 0.55, vol: 0.4, type: 'lowpass', f0: 900, f1: 60 }); a.tone({ type: 'sine', f0: 110, f1: 30, dur: 0.45, vol: 0.3 }); },
  pop: (a) => { a.noise({ dur: 0.22, vol: 0.18, type: 'lowpass', f0: 1500, f1: 150 }); a.tone({ type: 'sine', f0: 160, f1: 50, dur: 0.18, vol: 0.14 }); },
  steam: (a) => a.noise({ dur: 0.7, vol: 0.2, type: 'highpass', f0: 2200, f1: 5000, attack: 0.03 }),
  hiss: (a) => a.noise({ dur: 0.5, vol: 0.06, type: 'highpass', f0: 4000, attack: 0.1 }),
  zap: (a) => { for (let i = 0; i < 4; i++) a.tone({ type: 'square', f0: 900 + Math.random() * 1500, dur: 0.03, vol: 0.04, at: i * 0.025 }); },
  cog: (a) => { a.tone({ type: 'triangle', f0: 1500, dur: 0.05, vol: 0.06 }); a.tone({ type: 'triangle', f0: 2250, dur: 0.08, vol: 0.05, at: 0.04 }); },
  pickup: (a) => [0, 4, 7].forEach((n, i) => a.tone({ type: 'triangle', f0: mtof(76 + n), dur: 0.12, vol: 0.07, at: i * 0.05 })),
  item: (a) => [0, 4, 7, 12].forEach((n, i) => a.tone({ type: 'square', f0: mtof(72 + n), dur: 0.16, vol: 0.05, at: i * 0.07 })),
  legendary: (a) => {
    [0, 4, 7, 12, 16, 19].forEach((n, i) => a.tone({ type: 'square', f0: mtof(72 + n), dur: 0.22, vol: 0.05, at: i * 0.07 }));
    a.noise({ dur: 0.8, vol: 0.05, type: 'highpass', f0: 6000, at: 0.2 });
  },
  synergy: (a) => {
    [0, 4, 7].forEach((n) => a.tone({ type: 'sawtooth', f0: mtof(60 + n), dur: 0.6, vol: 0.05, attack: 0.02 }));
    [12, 16, 19, 24].forEach((n, i) => a.tone({ type: 'triangle', f0: mtof(72 + n), dur: 0.3, vol: 0.06, at: 0.1 + i * 0.06 }));
  },
  heal: (a) => a.tone({ type: 'sine', f0: 520, f1: 1040, dur: 0.25, vol: 0.1 }),
  door: (a) => { a.tone({ type: 'square', f0: 120, f1: 70, dur: 0.18, vol: 0.08 }); a.noise({ dur: 0.3, vol: 0.1, type: 'lowpass', f0: 500 }); a.noise({ dur: 0.4, vol: 0.05, type: 'highpass', f0: 3500, at: 0.1 }); },
  secret: (a) => [12, 7, 4, 0, -5].forEach((n, i) => a.tone({ type: 'triangle', f0: mtof(72 + n), dur: 0.2, vol: 0.07, at: i * 0.08 })),
  chime: (a) => { [1, 2.76, 5.4].forEach((m, i) => a.tone({ type: 'sine', f0: 660 * m, dur: 1.2 / (i + 1), vol: 0.1 / (i + 1) })); },
  descend: (a) => { a.tone({ type: 'sawtooth', f0: 380, f1: 50, dur: 0.9, vol: 0.1 }); a.noise({ dur: 1.0, vol: 0.12, type: 'lowpass', f0: 1200, f1: 100 }); },
  roar: (a) => { a.tone({ type: 'sawtooth', f0: 140, f1: 55, dur: 0.7, vol: 0.18 }); a.noise({ dur: 0.7, vol: 0.2, type: 'bandpass', f0: 500, q: 0.7 }); },
  bossdown: (a) => { SFX.boom(a); [0, 3, 7, 12, 15, 19, 24].forEach((n, i) => a.tone({ type: 'square', f0: mtof(60 + n), dur: 0.3, vol: 0.05, at: 0.3 + i * 0.08 })); },
  down: (a) => [7, 4, 0, -5].forEach((n, i) => a.tone({ type: 'triangle', f0: mtof(64 + n), dur: 0.2, vol: 0.08, at: i * 0.12 })),
  death: (a) => { a.tone({ type: 'sawtooth', f0: 300, f1: 40, dur: 1.4, vol: 0.14 }); a.noise({ dur: 1.2, vol: 0.15, type: 'lowpass', f0: 800, f1: 60 }); },
  buy: (a) => { a.tone({ type: 'triangle', f0: 1600, dur: 0.07, vol: 0.07 }); a.tone({ type: 'triangle', f0: 2100, dur: 0.12, vol: 0.07, at: 0.07 }); },
  deny: (a) => { a.tone({ type: 'square', f0: 150, dur: 0.1, vol: 0.07 }); a.tone({ type: 'square', f0: 120, dur: 0.12, vol: 0.07, at: 0.12 }); },
  spring: (a) => a.tone({ type: 'sine', f0: 260, f1: 900, dur: 0.14, vol: 0.07 }),
  fuse: (a) => a.noise({ dur: 0.6, vol: 0.05, type: 'highpass', f0: 5000 }),
  fire: (a) => a.noise({ dur: 0.35, vol: 0.12, type: 'lowpass', f0: 1400, f1: 300 }),
  throw: (a) => a.noise({ dur: 0.18, vol: 0.08, type: 'bandpass', f0: 600, f1: 2000, q: 2 }),
  use: (a) => a.tone({ type: 'square', f0: 300, f1: 900, dur: 0.12, vol: 0.06 }),
  active: (a) => { a.tone({ type: 'square', f0: 200, f1: 1200, dur: 0.2, vol: 0.06 }); a.noise({ dur: 0.2, vol: 0.06, type: 'highpass', f0: 3000 }); },
  ping: (a) => { a.tone({ type: 'sine', f0: 1320, dur: 0.1, vol: 0.08 }); a.tone({ type: 'sine', f0: 1760, dur: 0.12, vol: 0.07, at: 0.09 }); },
  lever: (a) => { SFX.door(a); for (let i = 0; i < 5; i++) a.tone({ type: 'square', f0: 800, dur: 0.02, vol: 0.04, at: 0.2 + i * 0.05 }); },
  ui_move: (a) => a.tone({ type: 'triangle', f0: 880, dur: 0.03, vol: 0.05 }),
  ui_ok: (a) => a.tone({ type: 'square', f0: 700, f1: 1400, dur: 0.08, vol: 0.05 }),
  ui_back: (a) => a.tone({ type: 'square', f0: 600, f1: 300, dur: 0.08, vol: 0.05 }),
  step: (a) => a.noise({ dur: 0.04, vol: 0.02, type: 'lowpass', f0: 700 }),
  clear: (a) => [0, 7, 12].forEach((n, i) => a.tone({ type: 'triangle', f0: mtof(67 + n), dur: 0.15, vol: 0.06, at: i * 0.06 })),
};

// ---------------------------------------------------------------- songs
const TOWN_CHORDS = [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]]; // C Am F G (waltz)
const TOWN_SCALE = [72, 74, 76, 79, 81, 84];
const SONGS = {
  town: {
    bpm: 104,
    div: 2,
    play(a, step, at, sd) {
      const d = a.musicGain;
      const bar = Math.floor(step / 6);
      const beat = step % 6;
      const ch = TOWN_CHORDS[bar % 4];
      if (beat === 0) a.tone({ type: 'triangle', f0: mtof(ch[0] - 12), dur: sd * 5, vol: 0.12, at, dest: d, attack: 0.01 });
      if (beat === 2 || beat === 4) ch.slice(1).forEach((n) => a.tone({ type: 'square', f0: mtof(n), dur: sd * 1.2, vol: 0.025, at, dest: d }));
      if ((beat === 0 || beat === 3 || (beat === 5 && Math.random() < 0.4)) && Math.random() < 0.7) {
        const n = TOWN_SCALE[(bar * 3 + beat + Math.floor(Math.random() * 3)) % TOWN_SCALE.length];
        a.tone({ type: 'triangle', f0: mtof(n), dur: sd * 2.5, vol: 0.05, at, dest: d, attack: 0.01 });
      }
    },
  },
  dungeon: {
    bpm: 88,
    div: 4,
    play(a, step, at, sd) {
      const d = a.musicGain;
      const beat = step % 16;
      // Clockwork ticking.
      if (step % 4 === 0) a.noise({ dur: 0.03, vol: 0.05, type: 'highpass', f0: 5000, at, dest: d });
      if (step % 4 === 2) a.noise({ dur: 0.02, vol: 0.025, type: 'highpass', f0: 7000, at, dest: d });
      // Drone.
      if (step % 32 === 0) {
        const root = [38, 38, 36, 41][Math.floor(step / 32) % 4];
        a.tone({ type: 'sawtooth', f0: mtof(root), dur: sd * 32, vol: 0.05, at, dest: d, attack: 0.4 });
        a.tone({ type: 'sine', f0: mtof(root - 12), dur: sd * 32, vol: 0.12, at, dest: d, attack: 0.4 });
      }
      // Sparse minor bells.
      if (beat === 10 && Math.random() < 0.5) a.tone({ type: 'sine', f0: mtof([62, 65, 69, 70, 74][Math.floor(Math.random() * 5)]), dur: 1.5, vol: 0.04, at, dest: d });
      if (step % 64 === 60) a.noise({ dur: 1.2, vol: 0.03, type: 'highpass', f0: 3000, at, dest: d, attack: 0.3 });
    },
  },
  boss: {
    bpm: 150,
    div: 2,
    play(a, step, at, sd) {
      const d = a.musicGain;
      const bar = Math.floor(step / 8);
      const riff = [0, 0, 12, 0, 3, 0, 7, 5];
      const root = [40, 40, 43, 38][bar % 4];
      a.tone({ type: 'square', f0: mtof(root + riff[step % 8]), dur: sd * 0.9, vol: 0.05, at, dest: d });
      if (step % 2 === 0) a.tone({ type: 'sine', f0: 140, f1: 40, dur: 0.12, vol: 0.25, at, dest: d });
      if (step % 4 === 2) a.noise({ dur: 0.1, vol: 0.08, type: 'bandpass', f0: 1800, at, dest: d });
      a.noise({ dur: 0.03, vol: 0.02, type: 'highpass', f0: 8000, at, dest: d });
      if (step % 16 === 0) a.tone({ type: 'sawtooth', f0: mtof(root + 24), dur: sd * 6, vol: 0.03, at, dest: d, attack: 0.05 });
    },
  },
  title: {
    bpm: 70,
    div: 2,
    play(a, step, at, sd) {
      const d = a.musicGain;
      if (step % 16 === 0) [45, 52, 57, 60].forEach((n) => a.tone({ type: 'triangle', f0: mtof(n), dur: sd * 15, vol: 0.035, at, dest: d, attack: 0.5 }));
      if (step % 4 === 0) a.noise({ dur: 0.03, vol: 0.03, type: 'highpass', f0: 5000, at, dest: d });
      if (step % 8 === 6 && Math.random() < 0.6) a.tone({ type: 'sine', f0: mtof([69, 72, 76, 81][Math.floor(Math.random() * 4)]), dur: 1.4, vol: 0.04, at, dest: d });
    },
  },
};
