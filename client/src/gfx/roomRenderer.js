// Draws the static part of a room (floor, walls, pits, blocks, wall decor) into a
// RenderTexture once per room visit. Dynamic bits (doors, hatch, features) are sprites.
import { TILE, ROOM_W, ROOM_H, ROOM_PX_W, ROOM_PX_H, T, DIRS, DOOR_TILE, hashString } from '@undercrank/shared';

const DOOR_PRIORITY = ['boss', 'treasure', 'shop', 'challenge'];

export function buildRoomLayer(scene, room, floor) {
  const seed = hashString(`${floor.seed}:${floor.depth}:${room.id}`);
  const h = (x, y, k = 0) => (((x * 73856093) ^ (y * 19349663) ^ (k * 83492791) ^ seed) >>> 0) % 1000;
  const rt = scene.add.renderTexture(0, 0, ROOM_PX_W, ROOM_PX_H).setOrigin(0, 0).setDepth(0);
  const g = room.grid;
  const at = (x, y) => (x < 0 || y < 0 || x >= ROOM_W || y >= ROOM_H ? T.WALL : g[y * ROOM_W + x]);

  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const t = at(x, y);
      const px = x * TILE;
      const py = y * TILE;
      if (t === T.WALL || t === T.DOOR) rt.draw(`wall_${h(x, y) < 180 ? 1 : 0}`, px, py);
      else if (t === T.PIT) rt.draw('pit', px, py);
      else {
        const v = h(x, y);
        rt.draw(`floor_${v < 700 ? 0 : v < 850 ? 1 : v < 930 ? 3 : 2}`, px, py);
        if (t === T.VENT) rt.draw('vent', px, py);
        if (t === T.BLOCK) rt.draw(h(x, y, 1) < 500 ? 'block' : 'crate', px, py);
      }
    }
  }

  // Inner wall shading & pit lips.
  const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
  gfx.fillStyle(0x000000, 0.35);
  gfx.fillRect(TILE, TILE, ROOM_PX_W - TILE * 2, 4);
  gfx.fillRect(TILE, TILE, 3, ROOM_PX_H - TILE * 2);
  gfx.lineStyle(1, 0x6b4a36, 1);
  gfx.strokeRect(TILE - 0.5, TILE - 0.5, ROOM_PX_W - TILE * 2 + 1, ROOM_PX_H - TILE * 2 + 1);
  for (let y = 1; y < ROOM_H - 1; y++) {
    for (let x = 1; x < ROOM_W - 1; x++) {
      if (at(x, y) === T.PIT && at(x, y - 1) !== T.PIT) {
        gfx.fillStyle(0x4a4038, 1);
        gfx.fillRect(x * TILE, y * TILE, TILE, 2);
      }
      if ((at(x, y) === T.BLOCK) && at(x, y + 1) !== T.BLOCK && at(x, y + 1) !== T.WALL) {
        gfx.fillStyle(0x000000, 0.35);
        gfx.fillRect(x * TILE, (y + 1) * TILE, TILE, 3);
      }
    }
  }
  // Soot stains on the floor.
  for (let i = 0; i < 6; i++) {
    const x = 32 + (h(i, 9, 3) / 1000) * (ROOM_PX_W - 64);
    const y = 32 + (h(i, 7, 5) / 1000) * (ROOM_PX_H - 64);
    gfx.fillStyle(0x000000, 0.12);
    gfx.fillEllipse(x, y, 16 + (h(i, 1) % 20), 8 + (h(i, 2) % 10));
  }
  rt.draw(gfx);
  gfx.destroy();

  // Wall decor: pipes along the top wall, gauges, lamps on side walls.
  const doorX = DOOR_TILE.n[0];
  for (let x = 1; x < ROOM_W - 1; x++) {
    if (Math.abs(x - doorX) <= 1) continue;
    rt.draw('pipe_h', x * TILE, 5);
  }
  for (let y = 1; y < ROOM_H - 1; y++) {
    if (Math.abs(y - DOOR_TILE.w[1]) <= 1) continue;
    if (h(0, y, 4) < 400) rt.draw('pipe_v', 5, y * TILE);
    if (h(22, y, 4) < 400) rt.draw('pipe_v', ROOM_PX_W - 11, y * TILE);
  }
  if (h(1, 1, 6) < 600) rt.draw('gauge', 3 * TILE, 2);
  if (h(2, 1, 6) < 600) rt.draw('gauge', 19 * TILE, 2);

  // Gaslight lamps (sprites so they can glow and flicker).
  const lamps = [];
  const lampPos = [[5, 0], [17, 0], [5, ROOM_H - 1], [17, ROOM_H - 1]];
  for (const [tx, ty] of lampPos) {
    const x = tx * TILE + 8;
    const y = ty === 0 ? 8 : ROOM_PX_H - 8;
    const lamp = scene.add.image(x, y, 'lamp_wall').setDepth(3).setFlipY(ty !== 0);
    const glow = scene.add.image(x, y + (ty === 0 ? 6 : -6), 'glow').setDepth(4).setBlendMode('ADD').setTint(0xff9c3a).setAlpha(0.35).setScale(1.3);
    lamps.push({ lamp, glow, x, y, phase: h(tx, ty, 8) });
  }
  return { rt, lamps };
}

export function doorTexture(room, floor, dir) {
  const target = floor.rooms.get(room.doors[dir]);
  let kind = 'normal';
  for (const k of DOOR_PRIORITY) {
    if (room.type === k || target?.type === k) {
      kind = k;
      break;
    }
  }
  if (target?.type === 'exit' || room.type === 'exit') kind = kind === 'normal' ? 'normal' : kind;
  return `door_${kind}_${room.doorOpen(dir) ? 'open' : 'closed'}`;
}

export function doorTransform(dir) {
  switch (dir) {
    case 'n':
      return { x: DOOR_TILE.n[0] * TILE + 8, y: 7, rot: 0 };
    case 's':
      return { x: DOOR_TILE.s[0] * TILE + 8, y: ROOM_PX_H - 7, rot: Math.PI };
    case 'w':
      return { x: 7, y: DOOR_TILE.w[1] * TILE + 8, rot: -Math.PI / 2 };
    default:
      return { x: ROOM_PX_W - 7, y: DOOR_TILE.e[1] * TILE + 8, rot: Math.PI / 2 };
  }
}

export { DIRS };
