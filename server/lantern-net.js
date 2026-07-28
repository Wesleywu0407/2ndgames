/*
 * Lantern Net — zero-dependency WebSocket presence channel for Sky Room.
 *
 * Implements the server side of RFC 6455 directly on node:http upgrade
 * sockets, so the project keeps running without a package.json. Scope is
 * deliberately small: text frames, ping/pong, close. Enough for a LAN
 * lobby of lantern bearers; not a general-purpose WebSocket library.
 *
 * Protocol (JSON text frames):
 *   client → server  {t:'hello', name, color, character}
 *   client → server  {t:'state', p:[x,y,z], r:[yaw,pitch], c:0|1, w:1|2|3, f:0|1, rs:{a:0|1,q:0..1}}
 *   client → server  {t:'pvp-shot', o:[x,y,z], d:[[x,y,z],...], w:1|2|3|4, p:0..1}
 *   client → server  {t:'pvp-hit', target, weapon}
 *   client → server  {t:'story-join'|'story-leave'}
 *   client → server  {t:'story-act', actionId, action, ...payload}
 *   server → client  {t:'welcome', id, players:[{id,name,color,state}]}
 *   server → client  {t:'join', id, name, color}
 *   server → client  {t:'state', id, p, r, c, w, f, rs}
 *   server → client  {t:'pvp-shot', id, o, d, w, p}
 *   server → client  {t:'leave', id}
 *   server → client  {t:'pvp-hit', from, target, weapon, damage, hp}
 *   server → client  {t:'pvp-down', from, target} | {t:'pvp-respawn', id, hp}
 *   server → client  {t:'story-state', phase, checkpoint, relics, partySize, ...}
 *   server → client  {t:'story-fragment', runId, fragment}
 */

const { createHash } = require('node:crypto');
const { CHARACTER_CATALOG } = require('./character-catalog');

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 4096;          // presence packets are tiny; anything larger is abuse
const MAX_PLAYERS = 16;
const PING_INTERVAL_MS = 30_000;
const ALLOWED_CHARACTER_IDS = Object.freeze([
  ...CHARACTER_CATALOG.activePlayableCharacters.map(character => character.id),
  'mercury-xbot'
]);
const ALLOWED_CHARACTER_ID_SET = new Set(ALLOWED_CHARACTER_IDS);

const players = new Map();         // id → { socket, name, color, state, alive, buffer }
let nextId = 1;
let siegeHandler = null;           // optional (id, message) sink for siege-* messages
let storyHandler = null;           // optional (id, message) sink for story-* messages

// The siege module registers here; keeps this transport dumb about game rules.
function setSiegeHandler(fn) { siegeHandler = fn; }
function setStoryHandler(fn) { storyHandler = fn; }
function storyFriendlyFireBlocked(attackerId, targetId = '') {
  return Boolean(storyHandler?.hasParticipant?.(attackerId)
    || (targetId && storyHandler?.hasParticipant?.(targetId)));
}

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
    const player = { socket, name: '', color: '#e8b06a', character: 'resident-01', state: null,
      hp: 100, lastHitAt: 0, lastShotAt: 0, alive: true, buffer: Buffer.alloc(0) };
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
    player.character = cleanCharacter(message.character);
    const roster = [];
    for (const [otherId, other] of players) {
      if (otherId === id || !other.name) continue;
      roster.push({ id: otherId, name: other.name, color: other.color, character: other.character,
        state: other.state ? { ...other.state, hp: other.hp } : null });
    }
    sendJson(player, { t: 'welcome', id, players: roster });
    broadcast({ t: 'join', id, name: player.name, color: player.color, character: player.character }, id);
    return;
  }

  if (message.t === 'state' && player.name) {
    const state = cleanState(message);
    if (!state) return;
    player.state = state;
    broadcast({ t: 'state', id, ...state, hp: player.hp }, id);
    return;
  }

  if (message.t === 'pvp-hit' && player.name) {
    if (storyFriendlyFireBlocked(id, String(message.target || ''))) return;
    handlePvpHit(id, player, message);
    return;
  }

  if (message.t === 'pvp-shot' && player.name) {
    handlePvpShot(id, player, message);
    return;
  }

  if (player.name && typeof message.t === 'string' && message.t.startsWith('siege') && siegeHandler) {
    siegeHandler(id, message);
    return;
  }

  if (player.name && typeof message.t === 'string' && message.t.startsWith('story') && storyHandler) {
    storyHandler.handle(id, message);
  }
}

const PVP_WEAPONS = {
  1: { damage: 18, cooldown: 220, range: 70 },
  2: { damage: 10, cooldown: 90, range: 38 },
  3: { damage: 34, cooldown: 650, range: 130 },
  4: { damage: 38, cooldown: 900, range: 18 }
};

const PVP_SHOT_RULES = {
  1: { cooldown: 180, rays: 1 },
  2: { cooldown: 650, rays: 5 },
  3: { cooldown: 650, rays: 1 },
  4: { cooldown: 900, rays: 8 }
};

function handlePvpShot(id, player, message) {
  if (!player.state) return;
  const weapon = PVP_SHOT_RULES[message.w] ? Number(message.w) : 1;
  const rule = PVP_SHOT_RULES[weapon];
  const now = Date.now();
  if (now - player.lastShotAt < rule.cooldown) return;
  const shot = cleanShot(message, player.state, weapon, rule.rays);
  if (!shot) return;
  player.lastShotAt = now;
  broadcast({ t: 'pvp-shot', id, ...shot }, id);
}

function handlePvpHit(id, player, message) {
  const weapon = PVP_WEAPONS[message.weapon] ? Number(message.weapon) : 1;
  const rule = PVP_WEAPONS[weapon];
  const targetId = String(message.target || '');
  const target = players.get(targetId);
  if (!target || targetId === id || !target.name || !player.state || !target.state || target.hp <= 0) return;
  if (storyFriendlyFireBlocked(id, targetId)) return;
  const now = Date.now();
  if (now - player.lastHitAt < rule.cooldown) return;
  const [ax, ay, az] = player.state.p;
  const [bx, by, bz] = target.state.p;
  if (Math.hypot(ax - bx, ay - by, az - bz) > rule.range) return;
  player.lastHitAt = now;
  target.hp = Math.max(0, target.hp - rule.damage);
  broadcast({ t: 'pvp-hit', from: id, fromName: player.name, target: targetId,
    weapon, damage: rule.damage, hp: target.hp });
  if (target.hp > 0) return;
  broadcast({ t: 'pvp-down', from: id, fromName: player.name, target: targetId });
  setTimeout(() => {
    const current = players.get(targetId);
    if (current !== target) return;
    target.hp = 100;
    broadcast({ t: 'pvp-respawn', id: targetId, hp: target.hp });
  }, 1800);
}

function dropPlayer(id) {
  const player = players.get(id);
  if (!player) return;
  players.delete(id);
  player.socket.destroy();
  if (player.name) {
    if (siegeHandler) siegeHandler(id, { t: 'siege-leave' });
    storyHandler?.leave?.(id);
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

function sendTo(id, message) {
  const player = players.get(id);
  if (!player || !player.name) return false;
  sendJson(player, message);
  return true;
}

function getPlayerState(id) {
  return players.get(id)?.state || null;
}

function getPlayerInfo(id) {
  const player = players.get(id);
  return player ? { name: player.name, color: player.color, character: player.character } : null;
}

/* ---------------- sanitizers ---------------- */

function cleanName(value) {
  return String(value || '').replace(/[<>\n\r\t]/g, '').trim().slice(0, 24);
}

function cleanColor(value) {
  return /^#[0-9a-fA-F]{6}$/.test(String(value)) ? String(value).toLowerCase() : '#e8b06a';
}

function cleanCharacter(value) {
  return ALLOWED_CHARACTER_ID_SET.has(value) ? value : ALLOWED_CHARACTER_IDS[0];
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
    f: message.f ? 1 : 0,
    rs: cleanRoleState(message.rs)
  };
}

function cleanShot(message, state, weapon, maxRays) {
  const origin = message.o;
  const directions = message.d;
  if (!Array.isArray(origin) || origin.length !== 3 || !origin.every(Number.isFinite)) return null;
  if (!Array.isArray(directions) || !directions.length || directions.length > maxRays) return null;
  if (Math.hypot(origin[0] - state.p[0], origin[1] - state.p[1], origin[2] - state.p[2]) > 4) return null;
  const cleanDirections = [];
  for (const value of directions) {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) return null;
    const length = Math.hypot(value[0], value[1], value[2]);
    if (length < 0.5 || length > 1.5) return null;
    cleanDirections.push(value.map(component => component / length));
  }
  const bound = value => Math.max(-500, Math.min(500, value));
  return {
    o: origin.map(bound),
    d: cleanDirections,
    w: weapon,
    p: Math.max(0, Math.min(1, Number(message.p) || 0))
  };
}

function cleanRoleState(value) {
  if (!value || typeof value !== 'object') return { a: 0, q: 1 };
  const charge = Number(value.q);
  return {
    a: value.a ? 1 : 0,
    q: Number.isFinite(charge) ? Math.max(0, Math.min(1, charge)) : 1
  };
}

module.exports = { attach, playerCount, broadcast, sendTo, getPlayerState, getPlayerInfo, setSiegeHandler, setStoryHandler,
  storyFriendlyFireBlocked, allowedCharacterIds: ALLOWED_CHARACTER_IDS };
