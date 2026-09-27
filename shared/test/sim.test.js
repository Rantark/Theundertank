// Headless smoke tests for the shared simulation (run with `npm test`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, emptyInput, recomputeLoadout, generateFloor, ITEMS, SYNERGIES, ITEM_MAP, buildLoadout, decodeSnapshot } from '../src/index.js';

function bot(g, p, t) {
  // A dumb bot: wander, aim at the nearest enemy, fire, dash sometimes, walk through doors.
  const e = g.nearestEnemy(p.x, p.y, 999);
  const inp = emptyInput();
  if (e) {
    inp.ax = e.x - p.x;
    inp.ay = e.y - p.y;
    inp.fire = true;
    inp.mx = Math.sin(t * 1.3 + p.slot);
    inp.my = Math.cos(t * 1.1);
  } else {
    // head to the first open door
    const dirs = { n: [184, 0], s: [184, 208], w: [0, 104], e: [368, 104] };
    const room = g.room;
    const opts = Object.keys(dirs).filter((d) => room.doorOpen(d));
    const d = opts[Math.floor(t / 4) % Math.max(1, opts.length)];
    if (room.hatch) [inp.mx, inp.my] = [184 - p.x, 104 - p.y];
    else if (d) [inp.mx, inp.my] = [dirs[d][0] - p.x, dirs[d][1] - p.y];
    const l = Math.hypot(inp.mx, inp.my) || 1;
    inp.mx /= l;
    inp.my /= l;
  }
  inp.dash = Math.floor(t / 2);
  inp.inter = Math.floor(t);
  return inp;
}

test('data integrity: 30+ items, 10+ synergies referencing real items', () => {
  assert.ok(ITEMS.length >= 30);
  assert.ok(SYNERGIES.length >= 10);
  for (const s of SYNERGIES) for (const id of s.requires.items || []) assert.ok(ITEM_MAP[id], `${s.id} -> ${id}`);
});

test('floor generation is deterministic', () => {
  const a = generateFloor('SEED', 7);
  const b = generateFloor('SEED', 7);
  assert.deepEqual([...a.rooms.keys()], [...b.rooms.keys()]);
  assert.deepEqual([...a.rooms.values()].map((r) => [...r.grid].join('')), [...b.rooms.values()].map((r) => [...r.grid].join('')));
});

test('synergies activate from item combos', () => {
  const L = buildLoadout({ items: ['tesla_coil', 'steam_canister', 'split_barrel', 'homing_gyroscope'] });
  assert.ok(L.synergies.includes('storm_front'));
  assert.ok(L.synergies.includes('seeker_shards'));
  assert.ok(L.proj.split.shardHoming > 0);
});

test('simulation runs with bots, every item, across floors and boss rooms without throwing', () => {
  for (const players of [1, 3]) {
    const g = new Game({ seed: 'SMOKE' + players, players: Array.from({ length: players }, (_, i) => ({ id: i + 1, slot: i, name: 'Bot' + i })) });
    // Give everyone everything to stress the pipeline.
    for (const p of g.players) {
      p.items = ITEMS.filter((i) => i.kind !== 'active' && i.id !== 'soot_lung').map((i) => i.id);
      p.active = { id: 'tesla_bomb', charge: 99 };
      recomputeLoadout(g, p);
    }
    for (const p of g.players) { p.hp = 99; }
    let t = 0;
    for (let i = 0; i < 60 * 90; i++) {
      t += 1 / 60;
      const inputs = {};
      for (const p of g.players) { inputs[p.id] = bot(g, p, t); p.hp = Math.max(p.hp, 20); }
      g.step(1 / 60, inputs);
      if (i % 600 === 0 && g.depth < 5) g.nextFloor();
      const snap = g.snapshot(i % 100 === 0);
      JSON.stringify(snap);
      decodeSnapshot(snap, {});
      g.drainEvents();
    }
    assert.ok(g.depth >= 5, 'reached boss floor');
  }
});
