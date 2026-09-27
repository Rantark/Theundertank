// Tile-grid collision for circular entities.
import { TILE, T, ROOM_W, ROOM_H } from '../constants.js';

/** Is this tile solid for walkers? `doorsOpen` lets door tiles be walkable. */
export function solidForWalk(grid, tx, ty, room) {
  if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return true;
  const t = grid[ty * ROOM_W + tx];
  if (t === T.WALL || t === T.BLOCK || t === T.PIT) return true;
  if (t === T.DOOR) return !(room && room.doorOpenAt && room.doorOpenAt(tx, ty));
  return false;
}

/** Solid for flying things (projectiles, flying enemies): pits are passable. */
export function solidForShot(grid, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return true;
  const t = grid[ty * ROOM_W + tx];
  return t === T.WALL || t === T.BLOCK || t === T.DOOR;
}

export function tileAt(grid, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return T.WALL;
  return grid[ty * ROOM_W + tx];
}

/** Does a circle overlap any solid tile? */
export function circleHitsSolid(grid, x, y, r, room, flying = false) {
  const x0 = Math.floor((x - r) / TILE);
  const x1 = Math.floor((x + r) / TILE);
  const y0 = Math.floor((y - r) / TILE);
  const y1 = Math.floor((y + r) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const solid = flying ? solidForShot(grid, tx, ty) : solidForWalk(grid, tx, ty, room);
      if (!solid) continue;
      // closest point on tile to circle center
      const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      if ((cx - x) ** 2 + (cy - y) ** 2 < r * r) return true;
    }
  }
  return false;
}

/**
 * Move a circle by (dx, dy) with axis-separated sliding collision.
 * Returns flags telling which axes were blocked.
 */
export function moveCircle(ent, dx, dy, grid, room, flying = false) {
  let hitX = false;
  let hitY = false;
  // Sub-step to avoid tunnelling at high speed (dash).
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
  const sx = dx / steps;
  const sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) {
      if (!circleHitsSolid(grid, ent.x + sx, ent.y, ent.r, room, flying)) ent.x += sx;
      else hitX = true;
    }
    if (sy !== 0) {
      if (!circleHitsSolid(grid, ent.x, ent.y + sy, ent.r, room, flying)) ent.y += sy;
      else hitY = true;
    }
  }
  return { hitX, hitY };
}

/** Line of sight between two points (shots-solid tiles block). */
export function lineOfSight(grid, ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay);
  const steps = Math.ceil(d / (TILE / 2));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (solidForShot(grid, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}
