// Online join flows against real in-process servers (run with `npm test`).
import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { PROTOCOL_VERSION } from '@undercrank/shared';
import { startServer } from '../src/app.js';

const connect = (port) =>
  new Promise((resolve, reject) => {
    const s = io(`http://127.0.0.1:${port}`, { transports: ['websocket'], reconnection: false });
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
const call = (s, ev, arg) => new Promise((r) => s.emit(ev, arg, r));
const profile = (name) => ({ name, character: 'tinker', upgrades: {}, version: PROTOCOL_VERSION });

test('joining by address works; a code only exists on the server that made it', async (t) => {
  const quiet = () => {};
  // Two players each running the desktop app = two separate servers.
  const hostSrv = await startServer({ port: 0, log: quiet });
  const friendSrv = await startServer({ port: 0, log: quiet });
  const sockets = [];
  t.after(async () => {
    for (const s of sockets) s.close();
    await hostSrv.close();
    await friendSrv.close();
  });
  const connectT = async (port) => {
    const s = await connect(port);
    sockets.push(s);
    return s;
  };
  const host = await connectT(hostSrv.port);
  const created = await call(host, 'create', profile('HOST'));
  assert.ok(created.code, 'room created');

  // The old bug: the friend types the code while connected to their OWN server.
  const wrong = await connectT(friendSrv.port);
  const miss = await call(wrong, 'join', { code: created.code, profile: profile('FRIEND') });
  assert.match(miss.error, /IP address/, 'explains that you need the host address');
  wrong.close();

  // Join by the host's address with no code: lands in the host's lobby.
  const friend = await connectT(hostSrv.port);
  const joined = await call(friend, 'join', { code: '', profile: profile('FRIEND') });
  assert.equal(joined.code, created.code);

  // Join by address + code also works.
  const third = await connectT(hostSrv.port);
  const byCode = await call(third, 'join', { code: created.code.toLowerCase(), profile: profile('THIRD') });
  assert.equal(byCode.code, created.code);

  const list = await call(third, 'rooms', {});
  assert.equal(list.rooms[0].players, 3);

  // Mismatched builds are refused with a clear message.
  const old = await connectT(hostSrv.port);
  const vm = await call(old, 'join', { code: '', profile: { name: 'OLD' } });
  assert.match(vm.error, /Version mismatch/);

});

test('joining by address with nobody hosting gives a helpful error', async () => {
  const srv = await startServer({ port: 0, log: () => {} });
  const s = await connect(srv.port);
  const res = await call(s, 'join', { code: '', profile: profile('LONELY') });
  assert.match(res.error, /HOST A GAME/);
  s.close();
  await srv.close();
});
