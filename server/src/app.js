// Embeddable game server: serves the built client and hosts online rooms.
// Used by the CLI (index.js) and by the desktop app (desktop/src/main.js).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Server } from 'socket.io';
import { Room, makeCode } from './rooms.js';

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon',
};

/**
 * Start the HTTP + Socket.IO server.
 * @param {object} o
 * @param {number} o.port       port to listen on (0 = any free port)
 * @param {string} [o.distDir]  built client to serve (optional)
 * @param {string} [o.host]     bind address (default all interfaces, so LAN friends can join)
 * @returns {Promise<{ port: number, close: () => Promise<void> }>}
 */
export function startServer({ port, distDir = null, host = '0.0.0.0', deflate = false, log = console.log } = {}) {
  const rooms = new Map();
  const roomOf = new Map(); // socketId -> code
  const hasDist = distDir && fs.existsSync(distDir);

  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    if (!hasDist) {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('Undercrank server running. Build the client (npm run build) to serve it from here, or use the Vite dev server.');
      return;
    }
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = path.join(distDir, urlPath === '/' ? 'index.html' : urlPath);
    if (!file.startsWith(distDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  const io = new Server(server, { cors: { origin: true }, perMessageDeflate: deflate, pingInterval: 10000, pingTimeout: 8000 });

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
      log(`[room ${code}] created`);
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

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      log(`Undercrank server listening on http://${host}:${actual}${hasDist ? ' (serving the client)' : ''}`);
      resolve({
        port: actual,
        close: () => new Promise((r) => {
          for (const room of rooms.values()) room.stop();
          io.close(() => r());
        }),
      });
    });
  });
}
