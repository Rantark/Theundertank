// THE UNDERCRANK - online co-op server (CLI entry)
// Lightweight enough for a Raspberry Pi: one Node process, Socket.IO, a 30Hz simulation
// per active room. Also serves the built client (client/dist) when present, so a single
// machine can host everything: `npm run build && npm start`.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT } from '@undercrank/shared';
import { startServer } from './app.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

startServer({
  port: Number(process.env.PORT) || DEFAULT_PORT,
  distDir: path.resolve(__dirname, '../../client/dist'),
  deflate: process.env.DEFLATE === '1',
});
