// Client-side movement prediction uses the exact same tile collision as the sim.
import { moveCircle } from '@undercrank/shared/sim/collision.js';

export function moveCircleForPrediction(room, x, y, me, dx, dy) {
  const ent = { x, y, r: me.r || 5 };
  if (room) moveCircle(ent, dx, dy, room.grid, room);
  else {
    ent.x += dx;
    ent.y += dy;
  }
  return [ent.x, ent.y];
}
