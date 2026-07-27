import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const scratch = await mkdtemp(path.join(tmpdir(), 'sky-room-lan-'));
const dbPath = path.join(scratch, 'world.db');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port;
    probe.close(error => error ? reject(error) : resolve(value));
  });
});

const child = spawn(process.execPath, ['server/living-world.js'], {
  cwd: root,
  env: { ...process.env, SKY_WORLD_PORT: String(port), SKY_WORLD_HOST: '127.0.0.1', SKY_WORLD_DB_PATH: dbPath },
  stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
child.stdout.on('data', chunk => { serverOutput += chunk; });
child.stderr.on('data', chunk => { serverOutput += chunk; });

const waitUntil = async (predicate, timeoutMs = 5000, label = 'condition') => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await delay(20);
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const clients = new Set();
const connect = async name => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const messages = [];
  socket.addEventListener('message', event => {
    try { messages.push(JSON.parse(String(event.data))); } catch (_) {}
  });
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  clients.add(socket);
  socket.send(JSON.stringify({ t: 'hello', name, color: '#8d63d2', character: 'resident-01' }));
  const welcome = await waitUntil(() => messages.find(message => message.t === 'welcome'), 3000, `${name} welcome`);
  return { socket, messages, id: welcome.id, welcome };
};

const send = (client, message) => client.socket.send(JSON.stringify(message));
const state = (x = 0) => ({ t: 'state', p: [x, 10, 0], r: [0, 0], c: 0, w: 1, f: 0, rs: { a: 0, q: 1 } });
const waitMessage = (client, predicate, label) => waitUntil(
  () => client.messages.find(predicate), 4000, label
);

try {
  await waitUntil(() => serverOutput.includes('Sky Room Living World:'), 5000, 'isolated server startup');

  const party = [];
  for (let index = 1; index <= 4; index++) {
    const client = await connect(`QA Lantern ${index}`);
    assert.equal(client.welcome.players.length, index - 1, `player ${index} should receive the existing roster`);
    send(client, state(index));
    send(client, { t: 'siege-join' });
    party.push(client);
    await waitMessage(party[0], message => message.t === 'siege' && message.players === index,
      `${index}-player authoritative Siege snapshot`);
  }

  const [first, second, third, fourth] = party;
  send(fourth, state(44));
  await waitMessage(first, message => message.t === 'state' && message.id === fourth.id && message.p?.[0] === 44,
    'fourth player state broadcast');

  send(second, { t: 'pvp-shot', o: [2, 10, 0], d: [[0, 0, -1]], w: 1, p: 0 });
  await waitMessage(third, message => message.t === 'pvp-shot' && message.id === second.id,
    'visible remote projectile broadcast');

  send(second, state(51));
  await delay(150);
  send(second, state(52));
  await waitMessage(third, message => message.t === 'state' && message.id === second.id && message.p?.[0] === 52,
    '150ms delayed state ordering');
  const delayedStates = third.messages.filter(message => message.t === 'state' && message.id === second.id
    && [51, 52].includes(message.p?.[0])).map(message => message.p[0]);
  assert.deepEqual(delayedStates.slice(-2), [51, 52], '150ms-delayed packets should retain send order');

  const phaseBeforeDeparture = first.messages.filter(message => message.t === 'siege').at(-1)?.phase;
  first.socket.close(); clients.delete(first.socket);
  await waitMessage(second, message => message.t === 'leave' && message.id === first.id, 'first player departure');
  const afterDeparture = await waitMessage(second,
    message => message.t === 'siege' && message.players === 3, 'server ownership after first player departure');
  assert.equal(afterDeparture.phase, phaseBeforeDeparture, 'first player departure must not reset the authoritative phase');

  fourth.socket.close(); clients.delete(fourth.socket);
  await waitMessage(second, message => message.t === 'leave' && message.id === fourth.id, 'brief disconnect');
  const rejoined = await connect('QA Lantern 4 Rejoined');
  assert.equal(rejoined.welcome.players.length, 2, 'rejoining player should receive the two connected peers');
  send(rejoined, state(64));
  send(rejoined, { t: 'siege-join' });
  await waitMessage(second, message => message.t === 'siege' && message.players === 3, 'rejoin Siege snapshot');

  const late = await connect('QA Late Join');
  assert.equal(late.welcome.players.length, 3, 'late join should receive the complete live roster');
  send(late, state(75));
  send(late, { t: 'siege-join' });
  const lateSiege = await waitMessage(late, message => message.t === 'siege' && message.players === 4,
    'late-join authoritative Siege state');
  assert.equal(lateSiege.phase, phaseBeforeDeparture, 'late join should enter the current phase, not restart the mission');

  console.info('LAN transport QA passed', {
    isolatedPort: port,
    rosters: [1, 2, 3, 4],
    remoteProjectileVisible: true,
    delayedOrderingMs: 150,
    firstPlayerDeparturePreservedAuthority: true,
    briefDisconnectRejoined: true,
    lateJoinPlayers: lateSiege.players
  });
} finally {
  for (const socket of clients) {
    try { socket.close(); } catch (_) {}
  }
  child.kill('SIGTERM');
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    delay(2000).then(() => child.kill('SIGKILL'))
  ]);
  await rm(scratch, { recursive: true, force: true });
}
