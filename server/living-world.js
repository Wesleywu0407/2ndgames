#!/usr/bin/env node
/*
 * Sky Room Living World server.
 *
 * One process serves the static game and owns a persistent SQLite simulation.
 * NPC decisions run at a low frequency; the Three.js client only renders the
 * resulting state, so a growing world does not become a per-frame AI workload.
 */

const { createServer } = require('node:http');
const { readFile, readFileSync, mkdirSync } = require('node:fs');
const { extname, join, normalize, resolve } = require('node:path');
const { networkInterfaces } = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const lanternNet = require('./lantern-net');

const ROOT = resolve(__dirname, '..');
const CHARACTER_DATA = JSON.parse(readFileSync(resolve(ROOT, 'data/sky-characters.json'), 'utf8'));
const DATA_DIR = resolve(__dirname, 'data');
const DB_PATH = resolve(DATA_DIR, 'sky-world.db');
const PORT = Number(process.env.SKY_WORLD_PORT || 4322);
const LAN_MODE = process.argv.includes('--lan');
const HOST = process.env.SKY_WORLD_HOST || (LAN_MODE ? '0.0.0.0' : '127.0.0.1');
const REAL_MS_PER_WORLD_DAY = 60 * 60 * 1000; // one real hour = one world day
const MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000;

mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');

createSchema();
if (process.argv.includes('--reset')) resetWorld();
seedWorld();
tickWorld(Date.now());

if (process.argv.includes('--check')) {
  const count = db.prepare('SELECT COUNT(*) AS total FROM character_profiles').get().total;
  console.log(`Living World check passed: ${count} character profiles synchronized.`);
  db.close();
  process.exit(0);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url.pathname);
  } catch (error) {
    sendJson(res, error?.status || 500, { error: String(error?.message || error) });
  }
});

const timer = setInterval(() => tickWorld(Date.now()), 15_000);
timer.unref();

lanternNet.attach(server);

server.listen(PORT, HOST, () => {
  console.log(`Sky Room Living World: http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}/sky-room.html`);
  console.log(`World database: ${DB_PATH}`);
  if (HOST === '0.0.0.0') {
    for (const address of lanAddresses()) {
      console.log(`LAN players can join: http://${address}:${PORT}/sky-room.html`);
    }
  } else {
    console.log('Tip: run with --lan so friends on the same network can join.');
  }
});

function lanAddresses() {
  const addresses = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address);
    }
  }
  return addresses;
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS world_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS npcs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      home TEXT NOT NULL,
      location TEXT NOT NULL,
      activity TEXT NOT NULL,
      goal TEXT NOT NULL,
      mood TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      health REAL NOT NULL DEFAULT 3,
      max_health REAL NOT NULL DEFAULT 3,
      energy REAL NOT NULL DEFAULT 80,
      curiosity REAL NOT NULL DEFAULT 50,
      sociability REAL NOT NULL DEFAULT 50,
      courage REAL NOT NULL DEFAULT 50,
      trust_player REAL NOT NULL DEFAULT 0,
      fear_player REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      summary_zh TEXT NOT NULL,
      intensity REAL NOT NULL DEFAULT 0.5,
      created_at INTEGER NOT NULL,
      expires_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS relationships (
      source_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
      affinity REAL NOT NULL DEFAULT 0,
      trust REAL NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (source_id, target_id)
    );

    CREATE TABLE IF NOT EXISTS world_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      summary_en TEXT NOT NULL,
      summary_zh TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS processed_actions (
      action_id TEXT PRIMARY KEY,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS character_profiles (
      npc_id TEXT PRIMARY KEY REFERENCES npcs(id) ON DELETE CASCADE,
      archetype TEXT NOT NULL,
      appearance_json TEXT NOT NULL,
      movement_json TEXT NOT NULL,
      weapon_json TEXT NOT NULL,
      data_version INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS memories_npc_created ON memories(npc_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS world_events_created ON world_events(created_at DESC);
  `);
}

function resetWorld() {
  db.exec(`
    DELETE FROM processed_actions;
    DELETE FROM memories;
    DELETE FROM relationships;
    DELETE FROM world_events;
    DELETE FROM character_profiles;
    DELETE FROM npcs;
    DELETE FROM world_state;
  `);
  console.log('Living World database reset.');
}

function seedWorld() {
  const now = Date.now();
  const residents = [
    ['resident-01', 'Elian Voss', 'astronomy student', 'moon archive'],
    ['resident-02', 'Mara Thorne', 'apprentice alchemist', 'alchemy workshop'],
    ['resident-03', 'Tobin Reed', 'owl keeper', 'owl post'],
    ['resident-04', 'Lyra Quill', 'memory archivist', 'moon archive'],
    ['resident-05', 'Corin Ash', 'junior warden', 'rune court'],
    ['resident-06', 'Nessa Vale', 'healer', 'infirmary'],
    ['resident-07', 'Orin Bell', 'spell student', 'practice hall'],
    ['resident-08', 'Sable Wynn', 'night courier', 'owl post'],
    ['resident-09', 'Perrin Moss', 'groundskeeper', 'rune court'],
    ['resident-10', 'Iris Flint', 'potion researcher', 'alchemy workshop'],
    ['resident-11', 'Alden Grey', 'senior warden', 'rune court'],
    ['resident-12', 'Mina Lark', 'first-year student', 'great hall'],
    ['resident-13', 'Theo Rook', 'duelling tutor', 'practice hall'],
    ['resident-14', 'Celia Frost', 'librarian', 'moon archive'],
    ['resident-15', 'Rowan Pike', 'student', 'great hall'],
    ['resident-16', 'Vera Loom', 'student', 'great hall'],
    ['resident-17', 'Bram Hollow', 'warden', 'rune court'],
    ['resident-18', 'Edda Moon', 'dream researcher', 'moon archive']
  ];

  const insertNpc = db.prepare(`
    INSERT OR IGNORE INTO npcs
      (id, name, role, home, location, activity, goal, mood, energy,
       curiosity, sociability, courage, updated_at)
    VALUES (?, ?, ?, ?, ?, 'wandering', 'complete tonight''s duties', 'calm', ?, ?, ?, ?, ?)
  `);
  const insertRelationship = db.prepare(`
    INSERT OR IGNORE INTO relationships (source_id, target_id, affinity, trust, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const upsertProfile = db.prepare(`
    INSERT INTO character_profiles
      (npc_id, archetype, appearance_json, movement_json, weapon_json, data_version)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(npc_id) DO UPDATE SET archetype=excluded.archetype,
      appearance_json=excluded.appearance_json, movement_json=excluded.movement_json,
      weapon_json=excluded.weapon_json, data_version=excluded.data_version
  `);

  residents.forEach((npc, index) => {
    const curiosity = 35 + ((index * 17) % 60);
    const social = 30 + ((index * 23) % 65);
    const courage = 25 + ((index * 29) % 70);
    insertNpc.run(...npc, npc[3], 62 + ((index * 11) % 34), curiosity, social, courage, now);
    const authored = CHARACTER_DATA.characters.find(character => character.id === npc[0]);
    if (authored) {
      const base = CHARACTER_DATA.archetypes[authored.archetype] || {};
      const appearance = { ...(base.appearance || {}), ...(authored.appearance || {}) };
      const movement = { ...(base.movement || {}), ...(authored.movement || {}) };
      const weapon = { ...(base.weapon || {}), ...(authored.weapon || {}) };
      upsertProfile.run(authored.id, authored.archetype, JSON.stringify(appearance),
        JSON.stringify(movement), JSON.stringify(weapon), CHARACTER_DATA.version || 1);
      db.prepare('UPDATE npcs SET name=?, role=? WHERE id=?').run(authored.name, authored.role, authored.id);
    }
  });
  residents.forEach((npc, index) => {
    const friend = residents[(index + 1) % residents.length][0];
    insertRelationship.run(npc[0], friend, 18 + (index % 5) * 6, 24, now);
    insertRelationship.run(friend, npc[0], 15 + (index % 4) * 5, 20, now);
  });

  setStateDefault('world_epoch_ms', String(now));
  setStateDefault('last_simulated_at', String(now));
  setStateDefault('last_event_slot', '-1');
  setStateDefault('world_name', 'The Second Eyes');
  setStateDefault('city_alert', '0');
}

function tickWorld(now) {
  const last = Number(getState('last_simulated_at') || now);
  const elapsedMs = Math.max(0, Math.min(now - last, MAX_OFFLINE_MS));
  if (elapsedMs < 1000) return;

  const worldMinutes = elapsedMs / REAL_MS_PER_WORLD_DAY * 24 * 60;
  const clock = worldClock(now);
  const cityAlert = clamp(Number(getState('city_alert') || 0) - worldMinutes * 0.035, 0, 100);
  setState('city_alert', cityAlert.toFixed(3));
  const npcs = db.prepare('SELECT * FROM npcs').all();
  const update = db.prepare(`
    UPDATE npcs SET location=?, activity=?, goal=?, mood=?, status=?, health=?,
      energy=?, trust_player=?, fear_player=?, updated_at=? WHERE id=?
  `);

  db.exec('BEGIN');
  try {
    for (const npc of npcs) {
      let health = Number(npc.health);
      let energy = Number(npc.energy);
      let status = npc.status;
      let fear = Number(npc.fear_player);
      let trust = Number(npc.trust_player);

      if (status === 'recovering') {
        health = Math.min(npc.max_health, health + worldMinutes * 2);
        if (health >= npc.max_health) status = 'active';
      }
      fear = clamp(fear - worldMinutes * 0.025, 0, 100);
      trust = clamp(trust + Math.sign(-trust) * Math.min(Math.abs(trust), worldMinutes * 0.002), -100, 100);

      const plan = choosePlan(npc, clock.hour, status, fear, cityAlert);
      energy = plan.activity === 'sleeping'
        ? clamp(energy + worldMinutes * 0.12, 0, 100)
        : clamp(energy - worldMinutes * 0.018, 0, 100);
      if (energy < 12 && status === 'active') Object.assign(plan, {
        location: npc.home,
        activity: 'resting',
        goal: 'recover energy',
        mood: 'tired'
      });

      update.run(plan.location, plan.activity, plan.goal, plan.mood, status,
        health, energy, trust, fear, now, npc.id);
    }
    setState('last_simulated_at', String(now));
    maybeCreateWorldEvent(clock, now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function choosePlan(npc, hour, status, fear, cityAlert) {
  if (status === 'recovering') return {
    location: 'infirmary', activity: 'recovering', goal: 'recover from the spell', mood: 'shaken'
  };
  if (fear > 65) return {
    location: 'warden station', activity: 'seeking protection', goal: 'avoid the lantern bearer', mood: 'afraid'
  };
  if (fear > 20) return {
    location: npc.home, activity: 'fleeing', goal: 'keep away from the lantern bearer', mood: 'wary'
  };
  if (cityAlert >= 35 && npc.role.includes('warden')) return {
    location: 'rune court', activity: 'searching for the player',
    goal: 'question the lantern bearer', mood: cityAlert >= 70 ? 'alarmed' : 'alert'
  };
  if (hour < 6) return {
    location: npc.home, activity: 'sleeping', goal: 'rest before dawn', mood: 'quiet'
  };
  if (hour < 9) return {
    location: 'great hall', activity: 'eating breakfast', goal: 'prepare for the day', mood: 'hopeful'
  };
  if (hour < 17) {
    const location = roleLocation(npc.role, npc.home);
    return { location, activity: workActivity(npc.role), goal: roleGoal(npc.role), mood: 'focused' };
  }
  if (hour < 21) return Number(npc.sociability) > 55
    ? { location: 'great hall', activity: 'socialising', goal: 'share news with friends', mood: 'warm' }
    : { location: 'rune court', activity: 'walking alone', goal: 'think over the day', mood: 'thoughtful' };
  return {
    location: npc.home, activity: 'returning home', goal: 'close the day', mood: 'calm'
  };
}

function roleLocation(role, fallback) {
  if (role.includes('alchemist') || role.includes('potion')) return 'alchemy workshop';
  if (role.includes('healer')) return 'infirmary';
  if (role.includes('owl') || role.includes('courier')) return 'owl post';
  if (role.includes('archivist') || role.includes('librarian') || role.includes('researcher')) return 'moon archive';
  if (role.includes('warden') || role.includes('groundskeeper')) return 'rune court';
  if (role.includes('tutor') || role.includes('spell')) return 'practice hall';
  return fallback;
}

function workActivity(role) {
  if (role.includes('student')) return 'studying';
  if (role.includes('warden')) return 'patrolling';
  if (role.includes('healer')) return 'treating residents';
  if (role.includes('owl') || role.includes('courier')) return 'sorting messages';
  if (role.includes('archive') || role.includes('librarian')) return 'cataloguing memories';
  if (role.includes('alchemist') || role.includes('potion')) return 'brewing';
  return 'working';
}

function roleGoal(role) {
  if (role.includes('student')) return 'learn one useful spell';
  if (role.includes('warden')) return 'keep the city safe';
  if (role.includes('healer')) return 'leave no flame unattended';
  return "complete today's work";
}

function maybeCreateWorldEvent(clock, now) {
  const slot = clock.day * 4 + Math.floor(clock.hour / 6);
  const previous = Number(getState('last_event_slot') || -1);
  if (slot <= previous) return;
  setState('last_event_slot', String(slot));
  const events = [
    ['archive_whisper', 'A sealed shelf began whispering in the Moon Archive.', '月之檔案館的封印書架開始低語。'],
    ['owl_arrival', 'An owl arrived carrying a letter with no sender.', '一隻貓頭鷹帶來沒有寄件人的信。'],
    ['potion_spill', 'A silver potion escaped the workshop and crossed the court.', '一瓶銀色藥水逃出工坊，穿過了庭院。'],
    ['unlight_trace', 'Wardens found a fresh trace of Unlight beneath the eastern tower.', '守夜人在東塔下發現了新鮮的夜蝕痕跡。']
  ];
  const event = events[Math.abs(hash(`${slot}:sky-room`)) % events.length];
  db.prepare(`INSERT INTO world_events (type, summary_en, summary_zh, payload_json, created_at)
    VALUES (?, ?, ?, '{}', ?)`).run(event[0], event[1], event[2], now);
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'sky-living-world', database: 'connected' });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/world') {
    tickWorld(Date.now());
    sendJson(res, 200, snapshot());
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/world/action') {
    const body = await readJson(req);
    tickWorld(Date.now());
    const actionId = String(body?.actionId || '');
    const previous = actionId
      ? db.prepare('SELECT result_json FROM processed_actions WHERE action_id=?').get(actionId)
      : null;
    if (previous) {
      sendJson(res, 200, safeJson(previous.result_json));
      return;
    }
    const result = applyAction(body);
    if (actionId) {
      db.prepare('INSERT OR IGNORE INTO processed_actions(action_id,result_json,created_at) VALUES(?,?,?)')
        .run(actionId, JSON.stringify(result), Date.now());
    }
    sendJson(res, 200, result);
    return;
  }
  sendJson(res, 404, { error: 'API endpoint not found' });
}

function applyAction(body) {
  const type = String(body?.type || '');
  const npcId = String(body?.npcId || '');
  const npc = db.prepare('SELECT * FROM npcs WHERE id=?').get(npcId);
  if (!npc) throw new HttpError(404, 'NPC not found');
  const now = Date.now();

  if (type === 'attack') {
    const damage = clamp(Number(body.damage) || 1, 0.1, 3);
    const health = Math.max(0, Number(npc.health) - damage);
    const status = health <= 0 ? 'recovering' : 'active';
    const recentAttack = db.prepare(`SELECT id FROM memories
      WHERE npc_id=? AND kind='player_attack' AND created_at>? ORDER BY created_at DESC LIMIT 1`)
      .get(npcId, now - 60_000);
    db.exec('BEGIN');
    try {
      db.prepare(`UPDATE npcs SET health=?, status=?, activity=?, goal=?, mood='afraid',
        trust_player=MAX(-100, trust_player-?), fear_player=MIN(100, fear_player+?), updated_at=? WHERE id=?`)
        .run(health, status, status === 'recovering' ? 'recovering' : 'fleeing',
          status === 'recovering' ? 'recover at the infirmary' : 'escape the attacker',
          12 + damage * 5, 18 + damage * 8, now, npcId);
      const alertGain = (npc.role.includes('warden') ? 24 : 10) + damage * 7;
      setState('city_alert', String(clamp(Number(getState('city_alert') || 0) + alertGain, 0, 100)));
      if (recentAttack) {
        db.prepare('UPDATE memories SET intensity=MIN(1,intensity+?), created_at=? WHERE id=?')
          .run(damage * 0.08, now, recentAttack.id);
      } else {
        db.prepare(`INSERT INTO memories
          (npc_id, kind, summary_en, summary_zh, intensity, created_at, expires_at)
          VALUES (?, 'player_attack', ?, ?, ?, ?, ?)`)
          .run(npcId, 'The lantern bearer attacked me.', '提燈者曾攻擊我。',
            Math.min(1, 0.45 + damage * 0.18), now, now + 14 * 24 * 60 * 60 * 1000);
        db.prepare(`INSERT INTO world_events (type, summary_en, summary_zh, payload_json, created_at)
          VALUES ('npc_attacked', ?, ?, ?, ?)`)
          .run(`${npc.name} was struck by the lantern bearer.`, `${npc.name} 被提燈者的法術擊中。`,
            JSON.stringify({ npcId, damage, weapon: body.weapon || 'unknown' }), now);
        spreadAttackMemory(npc, damage, now);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    return { ok: true, npc: npcView(db.prepare('SELECT * FROM npcs WHERE id=?').get(npcId)) };
  }

  if (type === 'greet' || type === 'help') {
    const memoryKind = type === 'help' ? 'player_help' : 'player_greeting';
    const recentInteraction = db.prepare(`SELECT id FROM memories
      WHERE npc_id=? AND kind=? AND created_at>? LIMIT 1`).get(npcId, memoryKind, now - 30_000);
    if (recentInteraction) return { ok: true, cooldown: true, npc: npcView(npc) };
    const trustGain = type === 'help' ? 8 : 2;
    db.prepare('UPDATE npcs SET trust_player=MIN(100, trust_player+?), fear_player=MAX(0, fear_player-?), updated_at=? WHERE id=?')
      .run(trustGain, trustGain * 0.8, now, npcId);
    db.prepare(`INSERT INTO memories (npc_id, kind, summary_en, summary_zh, intensity, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(npcId, memoryKind,
        type === 'help' ? 'The lantern bearer helped me.' : 'The lantern bearer greeted me.',
        type === 'help' ? '提燈者曾幫助我。' : '提燈者曾向我打招呼。',
        type === 'help' ? 0.7 : 0.25, now);
    if (type === 'help') {
      setState('city_alert', String(clamp(Number(getState('city_alert') || 0) - 6, 0, 100)));
    }
    return { ok: true, npc: npcView(db.prepare('SELECT * FROM npcs WHERE id=?').get(npcId)) };
  }

  throw new HttpError(400, 'Unsupported action');
}

function snapshot() {
  const now = Date.now();
  const clock = worldClock(now);
  const npcs = db.prepare('SELECT * FROM npcs ORDER BY id').all().map(npcView);
  const events = db.prepare('SELECT * FROM world_events ORDER BY created_at DESC LIMIT 20').all()
    .map(event => ({ ...event, payload: safeJson(event.payload_json), payload_json: undefined }));
  return {
    world: {
      name: getState('world_name'), day: clock.day, hour: clock.hour, minute: clock.minute,
      alert: Number(getState('city_alert') || 0), updatedAt: now
    },
    npcs,
    events
  };
}

function spreadAttackMemory(victim, damage, now) {
  const confidants = db.prepare(`
    SELECT r.target_id, n.role, n.name FROM relationships r
    JOIN npcs n ON n.id=r.target_id
    WHERE r.source_id=? ORDER BY r.affinity DESC, r.trust DESC LIMIT 2
  `).all(victim.id);
  const wardens = db.prepare(`SELECT id AS target_id, role, name FROM npcs
    WHERE role LIKE '%warden%' AND id<>? ORDER BY courage DESC LIMIT 1`).all(victim.id);
  const recipients = new Map([...confidants, ...wardens].map(npc => [npc.target_id, npc]));
  const insert = db.prepare(`INSERT INTO memories
    (npc_id, kind, summary_en, summary_zh, intensity, created_at, expires_at)
    VALUES (?, 'heard_attack', ?, ?, ?, ?, ?)`);
  const react = db.prepare(`UPDATE npcs SET fear_player=MIN(100,fear_player+?),
    trust_player=MAX(-100,trust_player-?), mood='concerned', updated_at=? WHERE id=?`);
  for (const recipient of recipients.values()) {
    insert.run(recipient.target_id,
      `${victim.name} told me the lantern bearer attacked them.`,
      `${victim.name} 告訴我，提燈者曾攻擊對方。`,
      Math.min(0.9, 0.35 + damage * 0.15), now, now + 7 * 24 * 60 * 60 * 1000);
    react.run(5 + damage * 3, 3 + damage * 2, now, recipient.target_id);
  }
}

function npcView(npc) {
  const memories = db.prepare(`SELECT kind, summary_en, summary_zh, intensity, created_at
    FROM memories WHERE npc_id=? AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at DESC LIMIT 5`)
    .all(npc.id, Date.now());
  const character = db.prepare(`SELECT archetype, appearance_json, movement_json, weapon_json, data_version
    FROM character_profiles WHERE npc_id=?`).get(npc.id);
  return {
    id: npc.id, name: npc.name, role: npc.role, home: npc.home,
    location: npc.location, activity: npc.activity, goal: npc.goal, mood: npc.mood,
    status: npc.status, health: npc.health, maxHealth: npc.max_health,
    energy: npc.energy, trustPlayer: npc.trust_player, fearPlayer: npc.fear_player,
    memories,
    character: character ? {
      archetype: character.archetype,
      appearance: safeJson(character.appearance_json),
      movement: safeJson(character.movement_json),
      weapon: safeJson(character.weapon_json),
      version: character.data_version
    } : null,
    updatedAt: npc.updated_at
  };
}

function worldClock(now) {
  const epoch = Number(getState('world_epoch_ms') || now);
  const totalMinutes = Math.max(0, now - epoch) / REAL_MS_PER_WORLD_DAY * 24 * 60;
  const day = Math.floor(totalMinutes / (24 * 60)) + 1;
  const minuteOfDay = Math.floor(totalMinutes % (24 * 60));
  return { day, hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 };
}

function serveStatic(req, res, pathname) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  const requested = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const relative = normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^[/\\]+/, '');
  const filePath = resolve(join(ROOT, relative));
  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }
  readFile(filePath, (error, data) => {
    if (error) { sendJson(res, 404, { error: 'File not found' }); return; }
    res.writeHead(200, {
      'Content-Type': mimeType(filePath),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    if (req.method === 'HEAD') res.end(); else res.end(data);
  });
}

function readJson(req) {
  return new Promise((resolvePromise, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 200_000) { reject(new HttpError(413, 'Request too large')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolvePromise(data ? JSON.parse(data) : {}); }
      catch (_) { reject(new HttpError(400, 'Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const code = payload instanceof Error && payload.status ? payload.status : status;
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function mimeType(path) {
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav', '.glb': 'model/gltf-binary'
  })[extname(path).toLowerCase()] || 'application/octet-stream';
}

function getState(key) {
  return db.prepare('SELECT value FROM world_state WHERE key=?').get(key)?.value;
}
function setState(key, value) {
  db.prepare(`INSERT INTO world_state(key,value) VALUES(?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, String(value));
}
function setStateDefault(key, value) {
  db.prepare('INSERT OR IGNORE INTO world_state(key,value) VALUES(?,?)').run(key, String(value));
}
function safeJson(text) { try { return JSON.parse(text); } catch (_) { return {}; } }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) { value ^= text.charCodeAt(i); value = Math.imul(value, 16777619); }
  return value | 0;
}
function HttpError(status, message) { const error = new Error(message); error.status = status; return error; }

process.on('SIGINT', () => { clearInterval(timer); db.close(); server.close(() => process.exit(0)); });
process.on('SIGTERM', () => { clearInterval(timer); db.close(); server.close(() => process.exit(0)); });
