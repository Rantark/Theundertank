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

test('every boss pattern runs to completion at deep tiers', async () => {
  const { BOSSES } = await import('../src/data/bosses.js');
  const { PATTERNS } = await import('../src/sim/bosses.js');
  for (const def of BOSSES) {
    for (const pat of def.patterns) {
      const g = new Game({ seed: `BOSS-${def.id}-${pat.id}`, players: [{ id: 1, slot: 0 }, { id: 2, slot: 1 }] });
      g.startFloor(25);
      g.floor.bossId = def.id;
      const room = [...g.floor.rooms.values()].find((r) => r.type === 'boss');
      g.enterRoom(room.id, 's');
      const b = g.boss;
      assert.ok(b, 'boss spawned');
      b.bs.mode = 'pattern';
      b.bs.phase = 2;
      b.untargetable = false;
      b.bs.pattern = PATTERNS[pat.id];
      b.bs.ps = {};
      b.bs.pattern.start(b, g, b.bs.ps);
      let done = false;
      for (let i = 0; i < 30 * 12 && !done; i++) {
        for (const p of g.players) p.hp = 99;
        g.step(1 / 30, {});
        done = b.bs.mode !== 'pattern';
        g.drainEvents();
      }
      assert.ok(done, `${def.id}.${pat.id} finished`);
    }
  }
});

test('every active item and consumable can be used', async () => {
  const { ITEMS, CONSUMABLES } = await import('../src/data/items.js');
  const { createEnemy } = await import('../src/sim/enemies.js');
  const g = new Game({ seed: 'ACTIVES', players: [{ id: 1, slot: 0 }, { id: 2, slot: 1 }] });
  const room = [...g.floor.rooms.values()].find((r) => r.type === 'combat');
  g.enterRoom(room.id, 's');
  const p = g.players[0];
  let seq = 0;
  const press = (key) => {
    seq++;
    const inp = emptyInput();
    inp[key] = seq;
    inp.ax = 1;
    return inp;
  };
  for (const it of ITEMS.filter((i) => i.kind === 'active')) {
    for (let k = 0; k < 3; k++) createEnemy(g, 'cogling', 80 + k * 40, 60, { instant: true });
    p.active = { id: it.id, charge: 999 };
    p.invuln = 99;
    g.step(1 / 60, { 1: press('active') });
    assert.equal(p.active.charge < 1, true, `${it.id} consumed its charge (charge=${p.active.charge} downed=${p.downed} alive=${p.alive} over=${g.over})`);
    for (let i = 0; i < 90; i++) {
      p.hp = 6;
      p.invuln = 99; // enemies path to the player now; keep the test about items
      g.step(1 / 60, { 1: emptyInput() });
    }
  }
  for (const c of CONSUMABLES) {
    p.consumable = c.id;
    g.step(1 / 60, { 1: press('cons') });
    for (let i = 0; i < 60; i++) g.step(1 / 60, {});
    assert.equal(p.consumable, null, `${c.id} consumed`);
  }
  g.drainEvents();
});

test('co-op: downed players are revived by a nearby teammate', () => {
  const g = new Game({ seed: 'REVIVE', players: [{ id: 1, slot: 0 }, { id: 2, slot: 1 }] });
  const [a, b] = g.players;
  a.iframes = 0;
  a.hp = 1;
  g.hurtPlayer(a, 2, a.x, a.y - 4);
  assert.equal(a.downed, true);
  b.x = a.x + 6;
  b.y = a.y;
  for (let i = 0; i < 120; i++) g.step(1 / 60, {});
  assert.equal(a.downed, false);
  assert.equal(a.alive, true);
});

test('enemies path around walls through a single gap', async () => {
  const { createEnemy } = await import('../src/sim/enemies.js');
  const { T, ROOM_W, ROOM_H, TILE } = await import('../src/constants.js');
  for (const type of ['cogling', 'boiler_bomb', 'brass_sentinel']) {
    const g = new Game({ seed: `PATH-${type}`, players: [{ id: 1, slot: 0 }] });
    const room = [...g.floor.rooms.values()].find((r) => r.type === 'combat');
    g.enterRoom(room.id, null);
    for (const e of g.enemies) e.dead = true;
    g.enemies = [];
    // Clear the room, then build a wall across the middle with one gap at the far right.
    for (let y = 1; y < ROOM_H - 1; y++) for (let x = 1; x < ROOM_W - 1; x++) room.grid[y * ROOM_W + x] = T.FLOOR;
    for (let x = 1; x < ROOM_W - 1; x++) if (x < ROOM_W - 4) room.grid[6 * ROOM_W + x] = T.BLOCK;
    const p = g.players[0];
    p.x = 3 * TILE + 8;
    p.y = 9 * TILE + 8;
    const e = createEnemy(g, type, 3 * TILE + 8, 3 * TILE + 8, { instant: true });
    room.locked = true;
    let reached = false;
    for (let i = 0; i < 60 * 30 && !reached; i++) {
      p.hp = 6;
      p.invuln = 99;
      p.x = 3 * TILE + 8;
      p.y = 9 * TILE + 8;
      g.step(1 / 60, {});
      g.drainEvents();
      // Sentinels deliberately halt ~40px away to fire.
      if (e.dead || Math.hypot(e.x - p.x, e.y - p.y) < 45) reached = true;
    }
    assert.ok(reached, `${type} found a way around the wall`);
  }
});
