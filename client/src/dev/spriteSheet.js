// Dev-only sprite viewer: renders procedural art without Phaser, scaled up.
import { drawCharacterFrame, CHARACTER_SPECS, NPC_SPECS, townieSpec, CHAR_FRAMES } from '../gfx/chars.js';

const out = document.getElementById('out');
const params = new URLSearchParams(location.search);
const SCALE = Number(params.get('scale') || 3);

export function section(title) {
  const h = document.createElement('h3');
  h.textContent = title;
  out.appendChild(h);
  const row = document.createElement('div');
  out.appendChild(row);
  return row;
}

export function show(row, pix, scale = SCALE) {
  const c = document.createElement('canvas');
  c.width = pix.W * scale;
  c.height = pix.H * scale;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(pix.canvas, 0, 0, c.width, c.height);
  row.appendChild(c);
}

const specs = { ...CHARACTER_SPECS, ...Object.fromEntries(Object.entries(NPC_SPECS).map(([k, v]) => [`npc_${k}`, v])), townie0: townieSpec(0), townie1: townieSpec(1), townie2: townieSpec(2) };
const only = params.get('only');
for (const [name, spec] of Object.entries(only ? {} : specs)) {
  const row = section(name);
  for (const [view, pf] of CHAR_FRAMES) show(row, drawCharacterFrame(spec, view, pf.replace(/\d$/, ''), Number(pf.slice(-1))));
}

// Other sheets register themselves via dynamic import so the viewer grows with the art.
for (const m of ['../gfx/enemyArt.js', '../gfx/worldArt.js'].filter((m) => !only || m.includes(only))) {
  import(m).then((mod) => mod.preview?.({ section, show })).catch((e) => console.warn('preview skipped', m, e.message));
}
