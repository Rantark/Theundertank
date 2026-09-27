// Small math helpers used throughout the simulation.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
export const dist = (ax, ay, bx, by) => Math.sqrt(dist2(ax, ay, bx, by));
export const len = (x, y) => Math.sqrt(x * x + y * y);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

/** Shortest signed difference between two angles. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rotate angle `a` toward `b` by at most `max` radians. */
export function turnToward(a, b, max) {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= max) return b;
  return a + Math.sign(d) * max;
}

export function norm(x, y) {
  const l = Math.sqrt(x * x + y * y);
  return l > 1e-6 ? [x / l, y / l] : [0, 0];
}
