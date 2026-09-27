// THE UNDERCRANK - online co-op server
// Lightweight enough for a Raspberry Pi: one Node process, Socket.IO, a 30Hz simulation
// per active room. Also serves the built client (client/dist) when present, so a single
// machine can host everything: `npm run build && npm start`.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { DEFAULT_PORT } from '@undercrank/shared';
import { Room, makeCode } from './rooms.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '../../client/dist');
const PORT = Number(process.env.PORT) || DEFAULT_PORT;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Undercrank server running. Build the client (npm run build) to serve it from here, or use the Vite dev server.');
    return;
  }
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const io = new Server(server, {
  cors: { origin: true },
  perMessageDeflate: process.env.DEFLATE === '1',
  pingInterval: 10000,
  pingTimeout: 8000,
});

const rooms = new Map();
const roomOf = new Map(); // socketId -> code

function leave(socket) {
  const code = roomOf.get(socket.id);
  if (!code) return;
  roomOf.delete(socket.id);
  rooms.get(code)?.remove(socket.id);
}

io.on('connection', (socket) => {
  socket.on('create', (profile, ack) => {
    leave(socket);
    const code = makeCode(rooms);
    const room = new Room(io, code, (c) => rooms.delete(c));
    rooms.set(code, room);
    const err = room.add(socket, profile);
    if (err) return ack?.({ error: err });
    roomOf.set(socket.id, code);
    ack?.({ code, playerId: room.members.get(socket.id).simId });
    console.log(`[room ${code}] created`);
  });

  socket.on('join', (msg, ack) => {
    const code = String(msg?.code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return ack?.({ error: 'No room with that code' });
    leave(socket);
    const err = room.add(socket, msg?.profile);
    if (err) return ack?.({ error: err });
    roomOf.set(socket.id, code);
    ack?.({ code, playerId: room.members.get(socket.id).simId });
  });

  const withRoom = (fn) => (...args) => {
    const room = rooms.get(roomOf.get(socket.id));
    if (room) fn(room, ...args);
  };
  socket.on('profile', withRoom((room, profile) => room.updateProfile(socket.id, profile)));
  socket.on('ready', withRoom((room) => room.toggleReady(socket.id)));
  socket.on('input', withRoom((room, msg) => room.setInput(socket.id, msg)));
  socket.on('forfeit', withRoom((room) => room.forfeit(socket.id)));
  socket.on('leave', () => leave(socket));
  socket.on('disconnect', () => leave(socket));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Undercrank server listening on http://0.0.0.0:${PORT}${fs.existsSync(DIST) ? ' (serving client/dist)' : ''}`);
});
