/*
 * Lantern Net — zero-dependency WebSocket presence channel for Sky Room.
 *
 * Implements the server side of RFC 6455 directly on node:http upgrade
 * sockets, so the project keeps running without a package.json. Scope is
 * deliberately small: text frames, ping/pong, close. Enough for a LAN
 * lobby of lantern bearers; not a general-purpose WebSocket library.
 *
 * Protocol (JSON text frames):
 *   client → server  {t:'hello', name, color}
 *   client → server  {t:'state', p:[x,y,z], r:[yaw,pitch], c:0|1, w:1|2|3, f:0|1}
 *   server → client  {t:'welcome', id, players:[{id,name,color,state}]}
 *   server → client  {t:'join', id, name, color}
 *   server → client  {t:'state', id, p, r, c, w, f}
 *   server → client  {t:'leave', id}
 */

const { createHash } = require('node:crypto');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 4096;          // presence packets are tiny; anything larger is abuse
const MAX_PLAYERS = 16;
const PING_INTERVAL_MS = 30_000;

const players = new Map();         // id → { socket, name, color, state, alive, buffer }
let nextId = 1;
let siegeHandler = null;           // optional (id, message) sink for siege-* messages

// The siege module registers here; keeps this transport dumb about game rules.
function setSiegeHandler(fn) { siegeHandler = fn; }

function attach(server) {
  server.on('upgrade', (req, socket) => {
    let pathname = '/';
    try { pathname = new URL(req.url, 'http://localhost').pathname; } catch (_) {}
    if (pathname !== '/ws') { socket.destroy(); return; }

    const key = req.headers['sec-websocket-key'];
    if (!key || players.size >= MAX_PLAYERS) {
      socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
      socket.destroy();
      return;
    }

    const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.setNoDelay(true);

    const id = `p${nextId++}`;
    const player = { socket, name: '', color: '#e8b06a', state: null, alive: true, buffer: Buffer.alloc(0) };
    players.set(id, player);

    socket.on('data', chunk => {
      player.buffer = Buffer.concat([player.buffer, chunk]);
      try { drainFrames(id, player); }
      catch (_) { dropPlayer(id); }
    });
    socket.on('close', () => dropPlayer(id));
    socket.on('error', () => dropPlayer(id));
  });

  const pinger = setInterval(() => {
    for (const [id, player] of players) {
      if (!player.alive) { dropPlayer(id); continue; }
      player.alive = false;
      sendFrame(player.socket, Buffer.alloc(0), 0x9); // ping
    }
  }, PING_INTERVAL_MS);
  pinger.unref();
}

function playerCount() { return players.size; }

/* ---------------- frame layer ---------------- */

function drainFrames(id, player) {
  for (;;) {
    const frame = readFrame(player.buffer);
    if (!frame) return;
    player.buffer = player.buffer.subarray(frame.consumed);

    if (frame.opcode === 0x8) { dropPlayer(id); return; }          // close
    if (frame.opcode === 0x9) { sendFrame(player.socket, frame.payload, 0xA); continue; } // ping → pong
    if (frame.opcode === 0xA) { player.alive = true; continue; }    // pong
    if (frame.opcode === 0x1) { player.alive = true; handleMessage(id, player, frame.payload); }
    // binary (0x2) and continuation (0x0) frames are ignored by design
  }
}

function readFrame(buffer) {
  if (buffer.length < 2) return null;
  const fin = (buffer[0] & 0x80) !== 0;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;

  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    const big = buffer.readBigUInt64BE(2);
    if (big > BigInt(MAX_PAYLOAD)) throw new Error('payload too large');
    length = Number(big);
    offset = 10;
  }
  if (!fin || !masked || length > MAX_PAYLOAD) throw new Error('unsupported frame');
  if (buffer.length < offset + 4 + length) return null;

  const mask = buffer.subarray(offset, offset + 4);
  const payload = Buffer.allocUnsafe(length);
  for (let i = 0; i < length; i++) payload[i] = buffer[offset + 4 + i] ^ mask[i & 3];
  return { opcode, payload, consumed: offset + 4 + length };
}

function sendFrame(socket, payload, opcode = 0x1) {
  if (socket.destroyed) return;
  const length = payload.length;
  let header;
  if (length < 126) {
    header = Buffer.from([0x80 | opcode, length]);
  } else {
    header = Buffer.allocUnsafe(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function sendJson(player, message) {
  sendFrame(player.socket, Buffer.from(JSON.stringify(message)), 0x1);
}

/* ---------------- presence layer ---------------- */

function handleMessage(id, player, payload) {
  let message;
  try { message = JSON.parse(payload.toString('utf8')); }
  catch (_) { return; }

  if (message.t === 'hello') {
    player.name = cleanName(message.name) || `Lantern ${id.slice(1)}`;
    player.color = cleanColor(message.color);
    const roster = [];
    for (const [otherId, other] of players) {
      if (otherId === id || !other.name) continue;
      roster.push({ id: otherId, name: other.name, color: other.color, state: other.state });
    }
    sendJson(player, { t: 'welcome', id, players: roster });
    broadcast({ t: 'join', id, name: player.name, color: player.color }, id);
    return;
  }

  if (message.t === 'state' && player.name) {
    const state = cleanState(message);
    if (!state) return;
    player.state = state;
    broadcast({ t: 'state', id, ...state }, id);
    return;
  }

  if (player.name && typeof message.t === 'string' && message.t.startsWith('siege') && siegeHandler) {
    siegeHandler(id, message);
  }
}

function dropPlayer(id) {
  const player = players.get(id);
  if (!player) return;
  players.delete(id);
  player.socket.destroy();
  if (player.name) {
    if (siegeHandler) siegeHandler(id, { t: 'siege-leave' });
    broadcast({ t: 'leave', id });
  }
}

function broadcast(message, excludeId = null) {
  const payload = Buffer.from(JSON.stringify(message));
  for (const [id, player] of players) {
    if (id === excludeId || !player.name) continue;
    sendFrame(player.socket, payload, 0x1);
  }
}

/* ---------------- sanitizers ---------------- */

function cleanName(value) {
  return String(value || '').replace(/[<>\n\r\t]/g, '').trim().slice(0, 24);
}

function cleanColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value).toLowerCase() : '#e8b06a';
}

function cleanState(message) {
  const p = message.p, r = message.r;
  if (!Array.isArray(p) || p.length !== 3 || !p.every(Number.isFinite)) return null;
  if (!Array.isArray(r) || r.length !== 2 || !r.every(Number.isFinite)) return null;
  const bound = value => Math.max(-500, Math.min(500, value));
  return {
    p: [bound(p[0]), bound(p[1]), bound(p[2])],
    r: [r[0] % (Math.PI * 2), Math.max(-1.6, Math.min(1.6, r[1]))],
    c: message.c ? 1 : 0,
    w: [1, 2, 3].includes(message.w) ? message.w : 1,
    f: message.f ? 1 : 0
  };
}

module.exports = { attach, playerCount, broadcast, setSiegeHandler };
