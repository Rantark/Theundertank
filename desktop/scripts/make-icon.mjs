// Generates resources/icon.png (512x512) procedurally: a brass cog around a dark shaft,
// matching the game's no-external-assets approach. Pure Node (zlib PNG encoder).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const S = 512;
const px = Buffer.alloc(S * S * 4);
const set = (x, y, [r, g, b, a = 255]) => {
  const i = (y * S + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
};
const c = S / 2;
const BRASS = [201, 154, 46], BRASS_L = [242, 207, 107], BRASS_D = [122, 90, 23], SOOT = [20, 17, 15], GLOW = [255, 156, 58], COPPER = [184, 104, 58];
// Draw at 64x64 "pixel art" resolution, then upscale 8x for crisp edges.
const N = 64, K = S / N;
for (let gy = 0; gy < N; gy++) {
  for (let gx = 0; gx < N; gx++) {
    const x = gx + 0.5 - N / 2, y = gy + 0.5 - N / 2;
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    const tooth = Math.cos(a * 10) > 0.25;
    let col = null;
    if (r < 29 && (r < 25 || tooth)) {
      const edge = r > 27.8 || (r > 23.8 && r < 25 && !tooth) || (tooth && r >= 25 && Math.cos(a * 10) < 0.4);
      col = edge ? SOOT : r > 21 ? (y < -x * 0.3 ? BRASS_L : BRASS) : null;
    }
    if (r <= 21 && r > 19) col = BRASS_D;
    if (r <= 19) col = r > 14 ? COPPER : r > 8 ? SOOT : GLOW;
    if (r <= 19 && r > 14 && Math.cos(a * 6) > 0.9) col = BRASS_L;
    if (!col) continue;
    for (let yy = 0; yy < K; yy++) for (let xx = 0; xx < K; xx++) set(gx * K + xx, gy * K + yy, col);
  }
}
void c;
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let k = n;
  for (let i = 0; i < 8; i++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
  return k >>> 0;
});
const crc = (buf) => {
  let x = 0xffffffff;
  for (const b of buf) x = crcTable[(x ^ b) & 255] ^ (x >>> 8);
  return (x ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, cr]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'resources', 'icon.png');
fs.writeFileSync(out, png);
console.log('wrote', out);
