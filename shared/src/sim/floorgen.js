// SEEDED FLOOR GENERATION
// -----------------------
// generateFloor(seed, depth) is a pure function of its inputs: the server and every
// client produce the exact same layout (room graph, templates, tiles) from the
// shared run seed. Dynamic state (cleared/visited/secret-found) lives in the sim
// and is synchronised separately.
import { RNG } from '../rng.js';
import { ROOM_W, ROOM_H, T, DIRS, DIR_VEC, OPPOSITE, DOOR_TILE } from '../constants.js';
import { ROOM_TEMPLATES } from '../data/rooms.js';
import { FLOOR_MODIFIERS } from '../data/modifiers.js';
import { BOSSES } from '../data/bosses.js';

const GRID_W = 9;
const GRID_H = 8;

export const isBossFloor = (depth) => depth % 5 === 0;

function key(x, y) {
  return `${x},${y}`;
}

/** Build the tile grid for a room from a template, optionally mirrored. */
function buildGrid(tpl, flipX, flipY) {
  const grid = new Uint8Array(ROOM_W * ROOM_H);
  const marks = { spawns: [], vents: [], pedestal: null };
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const border = x === 0 || y === 0 || x === ROOM_W - 1 || y === ROOM_H - 1;
      if (border) {
        grid[y * ROOM_W + x] = T.WALL;
        continue;
      }
      let ix = x - 1;
      let iy = y - 1;
      if (flipX) ix = ROOM_W - 3 - ix;
      if (flipY) iy = ROOM_H - 3 - iy;
      const ch = tpl.rows[iy][ix];
      let t = T.FLOOR;
      if (ch === '#' || ch === 'c') t = T.BLOCK;
      else if (ch === 'o') t = T.PIT;
      else if (ch === 'v') {
        t = T.VENT;
        marks.vents.push([x, y]);
      } else if (ch === 'e') marks.spawns.push([x, y]);
      else if (ch === 'P') marks.pedestal = [x, y];
      grid[y * ROOM_W + x] = t;
    }
  }
  return { grid, marks };
}

export class Room {
  constructor(o) {
    Object.assign(this, o);
    this.cleared = false;
    this.visited = false;
    this.seen = false;
    this.locked = false;
    this.hidden = {}; // dir -> true while a secret passage is undiscovered
    this.hatch = false;
    this.pickups = []; // sim-only persistent pickups
    this.spawned = false;
    this.feature = null; // 'bench' | 'lever' ...
  }

  /** Called by collision: may a walker pass through the door tile at (tx, ty)? */
  doorOpenAt(tx, ty) {
    for (const d of DIRS) {
      const [dx, dy] = DOOR_TILE[d];
      if (dx === tx && dy === ty) return this.doorOpen(d);
    }
    return false;
  }

  doorOpen(d) {
    return !!this.doors[d] && !this.locked && !this.hidden[d];
  }
}

function pickTemplate(rng, type) {
  const list = ROOM_TEMPLATES.filter((t) => t.types.includes(type));
  return rng.pick(list.length ? list : ROOM_TEMPLATES.filter((t) => t.types.includes('combat')));
}

function rollModifiers(rng, depth) {
  const pool = FLOOR_MODIFIERS.filter((m) => depth >= m.minDepth);
  let n = 0;
  if (depth >= 15) n = rng.int(2, 3);
  else if (depth >= 9) n = rng.int(1, 2);
  else if (depth >= 3) n = rng.chance(0.7) ? 1 : 0;
  const out = [];
  const avail = [...pool];
  for (let i = 0; i < n && avail.length; i++) {
    const m = rng.weighted(avail);
    out.push(m.id);
    avail.splice(avail.indexOf(m), 1);
  }
  return out;
}

export function generateFloor(seed, depth) {
  const rng = new RNG(`${seed}:floor:${depth}`);
  const boss = isBossFloor(depth);
  const target = Math.min(7 + Math.floor(depth * 1.2) + rng.int(0, 2), 20);

  // --- 1. Grow a tree of cells from the centre (Isaac-style: new cells may only
  //        touch one existing cell, which keeps branches and dead ends).
  const cells = new Map();
  const sx = 4;
  const sy = 4;
  cells.set(key(sx, sy), { x: sx, y: sy, dist: 0, parent: null });
  const neighbors = (x, y) => DIRS.map((d) => [x + DIR_VEC[d][0], y + DIR_VEC[d][1], d]);
  const countAdj = (x, y) => neighbors(x, y).filter(([nx, ny]) => cells.has(key(nx, ny))).length;
  let guard = 0;
  while (cells.size < target && guard++ < 200) {
    const frontier = [...cells.values()];
    rng.shuffle(frontier);
    for (const c of frontier) {
      if (cells.size >= target) break;
      for (const [nx, ny] of rng.shuffle(neighbors(c.x, c.y))) {
        if (cells.size >= target) break;
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
        if (cells.has(key(nx, ny))) continue;
        if (countAdj(nx, ny) > 1) continue;
        if (!rng.chance(0.5)) continue;
        cells.set(key(nx, ny), { x: nx, y: ny, dist: c.dist + 1, parent: key(c.x, c.y) });
      }
    }
  }

  // --- 2. Assign room types: farthest dead end is boss/exit, then specials.
  const deadEnds = [...cells.values()].filter((c) => c.dist > 0 && countAdj(c.x, c.y) === 1).sort((a, b) => b.dist - a.dist);
  const types = new Map();
  for (const c of cells.values()) types.set(key(c.x, c.y), 'combat');
  types.set(key(sx, sy), 'start');

  const specialWanted = ['treasure', 'shop'];
  if (depth >= 2 && rng.chance(0.6)) specialWanted.push('challenge');
  if (depth >= 3 && (boss || rng.chance(0.45))) specialWanted.push('rest');
  if (depth >= 4 && rng.chance(0.35)) specialWanted.push('treasure');

  // Ensure enough dead ends by attaching extra leaf cells where possible.
  const addLeaf = () => {
    const list = [...cells.values()].filter((c) => c.dist > 0);
    rng.shuffle(list);
    for (const c of list) {
      for (const [nx, ny] of rng.shuffle(neighbors(c.x, c.y))) {
        if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
        if (cells.has(key(nx, ny)) || countAdj(nx, ny) > 1) continue;
        const cell = { x: nx, y: ny, dist: c.dist + 1, parent: key(c.x, c.y) };
        cells.set(key(nx, ny), cell);
        types.set(key(nx, ny), 'combat');
        return cell;
      }
    }
    return null;
  };
  while (deadEnds.length < specialWanted.length + 1) {
    const leaf = addLeaf();
    if (!leaf) break;
    // Adding a leaf may consume a previous dead end; recompute.
    deadEnds.length = 0;
    deadEnds.push(...[...cells.values()].filter((c) => c.dist > 0 && countAdj(c.x, c.y) === 1).sort((a, b) => b.dist - a.dist));
  }

  const exitCell = deadEnds.shift();
  types.set(key(exitCell.x, exitCell.y), boss ? 'boss' : 'exit');
  // Boss floors: put the rest room next to the boss when possible.
  for (const t of specialWanted) {
    const c = deadEnds.shift();
    if (!c) break;
    types.set(key(c.x, c.y), t);
  }

  // --- 3. Secret room: an empty cell touching 2+ normal rooms.
  let secretKey = null;
  const candidates = [];
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      if (cells.has(key(x, y))) continue;
      const adj = neighbors(x, y).filter(([nx, ny]) => {
        const t = types.get(key(nx, ny));
        return t && t !== 'boss' && t !== 'exit' && t !== 'secret';
      });
      if (adj.length >= 2) candidates.push([x, y, adj.length]);
    }
  }
  if (candidates.length) {
    candidates.sort((a, b) => b[2] - a[2]);
    const best = candidates.filter((c) => c[2] === candidates[0][2]);
    const [x, y] = rng.pick(best);
    secretKey = key(x, y);
    cells.set(secretKey, { x, y, dist: 99, parent: null });
    types.set(secretKey, 'secret');
  }

  // --- 4. Build rooms with doors and tiles.
  const rooms = new Map();
  for (const c of cells.values()) {
    const id = key(c.x, c.y);
    const type = types.get(id);
    const tplType = type === 'exit' ? 'combat' : type;
    const tpl = pickTemplate(rng, tplType);
    const { grid, marks } = buildGrid(tpl, rng.chance(0.5), rng.chance(0.5));
    const doors = {};
    for (const d of DIRS) {
      const nid = key(c.x + DIR_VEC[d][0], c.y + DIR_VEC[d][1]);
      const ntype = types.get(nid);
      if (!ntype) {
        doors[d] = null;
        continue;
      }
      // Boss/exit rooms only connect to their tree parent.
      const isParentLink = c.parent === nid || cells.get(nid)?.parent === id;
      if ((type === 'boss' || type === 'exit' || ntype === 'boss' || ntype === 'exit') && !isParentLink) {
        doors[d] = null;
        continue;
      }
      doors[d] = nid;
    }
    for (const d of DIRS) {
      if (!doors[d]) continue;
      const [tx, ty] = DOOR_TILE[d];
      grid[ty * ROOM_W + tx] = T.DOOR;
      // Clear the tile just inside the door so templates can never block it.
      const [dx, dy] = DIR_VEC[d];
      const ix = tx - dx;
      const iy = ty - dy;
      if (grid[iy * ROOM_W + ix] !== T.FLOOR && grid[iy * ROOM_W + ix] !== T.VENT) grid[iy * ROOM_W + ix] = T.FLOOR;
    }
    const room = new Room({ id, gx: c.x, gy: c.y, type, template: tpl.id, grid, doors, marks, dist: c.dist });
    rooms.set(id, room);
  }
  // Secret passages start hidden on both sides.
  if (secretKey) {
    const sr = rooms.get(secretKey);
    for (const d of DIRS) {
      if (!sr.doors[d]) continue;
      sr.hidden[d] = true;
      const other = rooms.get(sr.doors[d]);
      other.hidden[OPPOSITE[d]] = true;
    }
  }

  const bossId = boss ? pickBoss(seed, depth) : null;
  return {
    seed,
    depth,
    boss,
    bossId,
    rooms,
    startId: key(sx, sy),
    exitId: key(exitCell.x, exitCell.y),
    modifiers: rollModifiers(rng, depth),
  };
}

/** Bosses cycle through the pool in a seeded order, so consecutive boss floors differ. */
export function pickBoss(seed, depth) {
  const rng = new RNG(`${seed}:bossorder`);
  const order = rng.shuffle(BOSSES.map((b) => b.id));
  const idx = (depth / 5 - 1) % order.length;
  return order[idx];
}
