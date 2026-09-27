// ENEMY NAVIGATION
// ----------------
// A flow field over the room grid, rebuilt a few times per second: every walkable tile
// stores its path distance to the nearest living player (8-way Dijkstra, no corner
// cutting). Hazard tiles (erupting vents, the players' fire/steam/oil) cost extra so
// enemies route around them. Walkers read the field to approach (descend the gradient)
// or retreat (climb it), with look-ahead smoothing so they cut clean diagonals instead of
// hugging tile centres. Straight lines are used whenever the path is clear.
import { TILE, ROOM_W, ROOM_H } from '../constants.js';
import { solidForWalk, circleHitsSolid, lineOfSight } from './collision.js';

const N = ROOM_W * ROOM_H;
const INF = 1e9;
const NEIGH = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

export class Nav {
  constructor(g) {
    this.g = g;
    this.dist = new Float32Array(N);
    this.cost = new Float32Array(N);
    this.timer = 0;
    this.roomKey = null;
  }

  walkable(tx, ty) {
    return !solidForWalk(this.g.room.grid, tx, ty, this.g.room);
  }

  update(dt) {
    const key = `${this.g.depth}:${this.g.room.id}`;
    this.timer -= dt;
    if (key !== this.roomKey || this.timer <= 0) {
      this.roomKey = key;
      this.timer = 0.2;
      this.rebuild();
    }
  }

  /** Extra traversal cost per tile from hazards enemies should avoid. */
  hazardCosts() {
    const c = this.cost;
    c.fill(0);
    for (const z of this.g.zones) {
      let pen = 0;
      if (z.type === 'vent' && z.state >= 1) pen = 8;
      else if (z.team === 'player' && (z.type === 'fire' || z.type === 'cloud' || z.type === 'oil')) pen = z.type === 'oil' ? 2 : 5;
      if (!pen) continue;
      const r = z.r + 4;
      for (let ty = Math.floor((z.y - r) / TILE); ty <= Math.floor((z.y + r) / TILE); ty++) {
        for (let tx = Math.floor((z.x - r) / TILE); tx <= Math.floor((z.x + r) / TILE); tx++) {
          if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) continue;
          const cx = tx * TILE + TILE / 2;
          const cy = ty * TILE + TILE / 2;
          if ((cx - z.x) ** 2 + (cy - z.y) ** 2 <= r * r) c[ty * ROOM_W + tx] = Math.max(c[ty * ROOM_W + tx], pen);
        }
      }
    }
  }

  rebuild() {
    const d = this.dist;
    d.fill(INF);
    this.hazardCosts();
    const open = [];
    for (const p of this.g.players) {
      if (!p.alive || p.downed) continue;
      const tx = Math.floor(p.x / TILE);
      const ty = Math.floor(p.y / TILE);
      if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) continue;
      d[ty * ROOM_W + tx] = 0;
      open.push(ty * ROOM_W + tx);
    }
    // Dijkstra with a simple array heap (the grid is only ~300 cells).
    const done = new Uint8Array(N);
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (d[open[i]] < d[open[bi]]) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();
      if (done[cur]) continue;
      done[cur] = 1;
      const cx = cur % ROOM_W;
      const cy = (cur - cx) / ROOM_W;
      for (const [dx, dy, w] of NEIGH) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= ROOM_W || ny >= ROOM_H) continue;
        if (!this.walkable(nx, ny)) continue;
        // No diagonal corner cutting.
        if (dx && dy && (!this.walkable(cx + dx, cy) || !this.walkable(cx, cy + dy))) continue;
        const ni = ny * ROOM_W + nx;
        const nd = d[cur] + w + this.cost[ni];
        if (nd < d[ni]) {
          d[ni] = nd;
          open.push(ni);
        }
      }
    }
  }

  distAt(x, y) {
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    if (tx < 0 || ty < 0 || tx >= ROOM_W || ty >= ROOM_H) return INF;
    return this.dist[ty * ROOM_W + tx];
  }

  /** Is a straight walk from a to b clear for a circle of radius r? */
  clearWalk(ax, ay, bx, by, r, flying = false) {
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(len / 5));
    const grid = this.g.room.grid;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      if (circleHitsSolid(grid, ax + (bx - ax) * t, ay + (by - ay) * t, r * 0.9, this.g.room, flying)) return false;
    }
    return true;
  }

  /** Follow the gradient `sign` (-1 approach, +1 retreat) up to `look` tiles ahead. */
  chain(x, y, sign, look = 4) {
    let tx = Math.floor(x / TILE);
    let ty = Math.floor(y / TILE);
    const pts = [];
    for (let s = 0; s < look; s++) {
      let best = null;
      let bestD = this.dist[ty * ROOM_W + tx];
      if (bestD >= INF) bestD = sign < 0 ? INF : -INF;
      for (const [dx, dy] of NEIGH) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= ROOM_W || ny >= ROOM_H || !this.walkable(nx, ny)) continue;
        if (dx && dy && (!this.walkable(tx + dx, ty) || !this.walkable(tx, ty + dy))) continue;
        const nd = this.dist[ny * ROOM_W + nx];
        if (nd >= INF) continue;
        if (sign < 0 ? nd < bestD - 1e-3 : nd > bestD + 1e-3) {
          bestD = nd;
          best = [nx, ny];
        }
      }
      if (!best) break;
      [tx, ty] = best;
      pts.push([tx * TILE + TILE / 2, ty * TILE + TILE / 2]);
    }
    return pts;
  }

  /**
   * Unit direction for an enemy to approach the players (or retreat when retreat=true).
   * Returns null when no route is known.
   */
  steer(e, target, retreat = false) {
    if (e.flying) {
      // Fliers ignore pits; they only need to avoid blocks.
      if (!retreat && target && this.clearWalk(e.x, e.y, target.x, target.y, e.r, true)) return dir(e, target.x, target.y);
    } else if (!retreat && target && this.clearWalk(e.x, e.y, target.x, target.y, e.r)) {
      return dir(e, target.x, target.y);
    }
    const pts = this.chain(e.x, e.y, retreat ? 1 : -1, 4);
    if (!pts.length) return target && !retreat ? dir(e, target.x, target.y) : null;
    // Aim at the furthest waypoint we can reach in a straight line (smooth diagonals).
    for (let i = pts.length - 1; i >= 0; i--) {
      if (i === 0 || this.clearWalk(e.x, e.y, pts[i][0], pts[i][1], e.r, e.flying)) return dir(e, pts[i][0], pts[i][1]);
    }
    return dir(e, pts[0][0], pts[0][1]);
  }

  /** Does `e` have a clear shot at the point? */
  canShoot(e, t) {
    return lineOfSight(this.g.room.grid, e.x, e.y, t.x, t.y);
  }

  /** Nearest walkable tile centre to (x, y) (used when surfacing or landing). */
  nearestWalkable(x, y) {
    const tx0 = Math.floor(x / TILE);
    const ty0 = Math.floor(y / TILE);
    if (this.walkable(tx0, ty0)) return [x, y];
    for (let r = 1; r < 6; r++) {
      let best = null;
      let bd = INF;
      for (let ty = ty0 - r; ty <= ty0 + r; ty++) {
        for (let tx = tx0 - r; tx <= tx0 + r; tx++) {
          if (!this.walkable(tx, ty)) continue;
          const cx = tx * TILE + TILE / 2;
          const cy = ty * TILE + TILE / 2;
          const dd = (cx - x) ** 2 + (cy - y) ** 2;
          if (dd < bd) {
            bd = dd;
            best = [cx, cy];
          }
        }
      }
      if (best) return best;
    }
    return [x, y];
  }
}

function dir(e, x, y) {
  const dx = x - e.x;
  const dy = y - e.y;
  const l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}
