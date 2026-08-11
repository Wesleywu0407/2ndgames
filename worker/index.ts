import characterData from "../data/sky-characters.json";

export { WorldRoom } from "./realtime";

type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
};

type D1 = {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
};

type R2Object = {
  body: ReadableStream | null;
  size: number;
  httpEtag: string;
} | null;

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: D1;
  WORLD_ROOM: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  LARGE_ASSETS?: { get(key: string): Promise<R2Object> };
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  LLM_TIMEOUT_MS?: string;
  LLM_MAX_INPUT_CHARS?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const REAL_MS_PER_WORLD_DAY = 60 * 60 * 1000;
const MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000;

/** Retention caps so D1 cannot grow without bound (DEPLOYMENT_PLAN.md section 6). */
const MAX_WORLD_EVENTS = 500;
const MEMORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Chat guardrails (DEPLOYMENT_PLAN.md section 7). */
const CHAT_MAX_BODY_BYTES = 16 * 1024;
const CHAT_MAX_MESSAGES = 12;
const CHAT_MAX_CHARS_DEFAULT = 6000;
const CHAT_TIMEOUT_MS_DEFAULT = 30_000;

const ACTION_TYPES = new Set(["attack", "greet", "help"]);

/**
 * Files above Cloudflare's 25 MiB per-asset limit are uploaded to R2 instead and
 * streamed back under their original path, so the game's URLs stay unchanged.
 * Keep in sync with scripts/build-public.mjs.
 */
const LARGE_ASSET_PATHS = new Set([
  "/assets/models/architecture/skyveil-academy/skyveil-academy.glb",
  "/assets/video/skyveil/skyveil-opening-1080p.mp4",
]);

const CONTENT_TYPES: Record<string, string> = {
  glb: "model/gltf-binary",
  gltf: "model/gltf+json",
  mp4: "video/mp4",
  webm: "video/webm",
};

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/ws") {
        if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
          return json({ error: "Expected websocket upgrade" }, 426);
        }
        const room = env.WORLD_ROOM.get(env.WORLD_ROOM.idFromName("skyveil-world"));
        return room.fetch(request);
      }

      if (url.pathname === "/api/health" && request.method === "GET") {
        await ensureWorld(env.DB);
        await env.DB.prepare("SELECT 1").first();
        return json({ ok: true, service: "skyveil", database: "ok", realtime: "durable-object" });
      }

      if (url.pathname === "/api/world" && request.method === "GET") {
        await ensureWorld(env.DB);
        await tickWorld(env.DB, Date.now());
        ctx.waitUntil(pruneWorld(env.DB));
        return json(await worldSnapshot(env.DB));
      }

      if (url.pathname === "/api/world/action" && request.method === "POST") {
        const body = await readJsonBody(request, CHAT_MAX_BODY_BYTES);
        await ensureWorld(env.DB);
        await tickWorld(env.DB, Date.now());
        return json(await applyWorldAction(env.DB, body));
      }

      if (url.pathname === "/api/chat" && request.method === "POST") {
        return await proxyChat(request, env);
      }

      if (url.pathname.startsWith("/api/")) {
        return json({ error: "API endpoint not found" }, 404);
      }

      if (LARGE_ASSET_PATHS.has(url.pathname)) {
        return serveLargeAsset(url.pathname, env);
      }

      // Let the assets binding resolve `/` to index.html itself. Rewriting the
      // request to `/index.html` creates a canonical-URL redirect loop when
      // `run_worker_first` is enabled.
      const response = await env.ASSETS.fetch(request);
      return withHeaders(response, SECURITY_HEADERS);
    } catch (error) {
      const status = Number((error as { status?: number })?.status) || 500;
      // Only messages we raised deliberately are echoed; anything else is opaque.
      const message = status < 500 ? String((error as Error)?.message || "Bad request") : "Internal error";
      if (status >= 500) console.error("worker_error", { path: url.pathname, message: String(error) });
      return json({ error: message }, status);
    }
  },
};

async function serveLargeAsset(pathname: string, env: Env): Promise<Response> {
  if (!env.LARGE_ASSETS) return json({ error: "Asset storage not configured" }, 503);
  const object = await env.LARGE_ASSETS.get(pathname.replace(/^\//, ""));
  if (!object || !object.body) return json({ error: "Asset not found" }, 404);
  const extension = pathname.split(".").pop() || "";
  return new Response(object.body, {
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
      "Content-Length": String(object.size),
      ETag: object.httpEtag,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function withHeaders(response: Response, headers: Record<string, string>) {
  const merged = new Headers(response.headers);
  for (const [key, value] of Object.entries(headers)) merged.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: merged });
}

async function readJsonBody(request: Request, limit: number): Promise<any> {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > limit) throw httpError(413, "Request body too large");
  const text = await request.text();
  if (text.length > limit) throw httpError(413, "Request body too large");
  try {
    return JSON.parse(text);
  } catch {
    throw httpError(400, "Invalid JSON body");
  }
}

async function ensureWorld(db: D1) {
  const now = Date.now();
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS world_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS npcs (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, home TEXT NOT NULL, location TEXT NOT NULL, activity TEXT NOT NULL, goal TEXT NOT NULL, mood TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', health REAL NOT NULL DEFAULT 3, max_health REAL NOT NULL DEFAULT 3, energy REAL NOT NULL DEFAULT 80, curiosity REAL NOT NULL DEFAULT 50, sociability REAL NOT NULL DEFAULT 50, courage REAL NOT NULL DEFAULT 50, trust_player REAL NOT NULL DEFAULT 0, fear_player REAL NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS memories (id INTEGER PRIMARY KEY AUTOINCREMENT, npc_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE, kind TEXT NOT NULL, summary_en TEXT NOT NULL, summary_zh TEXT NOT NULL, intensity REAL NOT NULL DEFAULT 0.5, created_at INTEGER NOT NULL, expires_at INTEGER)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS relationships (source_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE, target_id TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE, affinity REAL NOT NULL DEFAULT 0, trust REAL NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL, PRIMARY KEY (source_id, target_id))",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS world_events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, summary_en TEXT NOT NULL, summary_zh TEXT NOT NULL, payload_json TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL)",
    ),
    db.prepare(
      "CREATE TABLE IF NOT EXISTS processed_actions (action_id TEXT PRIMARY KEY, result_json TEXT NOT NULL, created_at INTEGER NOT NULL)",
    ),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_memories_npc_created ON memories(npc_id, created_at DESC)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_world_events_created ON world_events(created_at DESC)"),
  ]);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO world_state(key,value) VALUES('world_epoch_ms',?)").bind(String(now)),
    db.prepare("INSERT OR IGNORE INTO world_state(key,value) VALUES('last_simulated_at',?)").bind(String(now)),
    db.prepare("INSERT OR IGNORE INTO world_state(key,value) VALUES('world_name','The Second Eyes')"),
    db.prepare("INSERT OR IGNORE INTO world_state(key,value) VALUES('city_alert','0')"),
  ]);
  await db.batch(
    RESIDENTS.map((resident, index) =>
      db
        .prepare(
          "INSERT OR IGNORE INTO npcs(id,name,role,home,location,activity,goal,mood,energy,curiosity,sociability,courage,updated_at) VALUES(?,?,?,?,?,'wandering','complete tonight''s duties','calm',?,?,?,?,?)",
        )
        .bind(
          resident[0],
          resident[1],
          resident[2],
          resident[3],
          resident[3],
          62 + ((index * 11) % 34),
          35 + ((index * 17) % 60),
          30 + ((index * 23) % 65),
          25 + ((index * 29) % 70),
          now,
        ),
    ),
  );
}

/** Trims events and expired memories so the database stays bounded. */
async function pruneWorld(db: D1) {
  const now = Date.now();
  try {
    await db.batch([
      db
        .prepare(
          "DELETE FROM world_events WHERE id NOT IN (SELECT id FROM world_events ORDER BY created_at DESC LIMIT ?)",
        )
        .bind(MAX_WORLD_EVENTS),
      db
        .prepare("DELETE FROM memories WHERE (expires_at IS NOT NULL AND expires_at < ?) OR created_at < ?")
        .bind(now, now - MEMORY_RETENTION_MS),
      db.prepare("DELETE FROM processed_actions WHERE created_at < ?").bind(now - MEMORY_RETENTION_MS),
    ]);
  } catch (error) {
    console.error("prune_failed", String(error));
  }
}

async function getState(db: D1, key: string) {
  return (await db.prepare("SELECT value FROM world_state WHERE key=?").bind(key).first<{ value: string }>())?.value;
}

async function setState(db: D1, key: string, value: string | number) {
  await db
    .prepare("INSERT INTO world_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value")
    .bind(key, String(value))
    .run();
}

async function tickWorld(db: D1, now: number) {
  const last = Number((await getState(db, "last_simulated_at")) || now);
  const elapsedMs = Math.max(0, Math.min(now - last, MAX_OFFLINE_MS));
  if (elapsedMs < 1000) return;
  const worldMinutes = ((elapsedMs / REAL_MS_PER_WORLD_DAY) * 24 * 60);
  const cityAlert = clamp(Number((await getState(db, "city_alert")) || 0) - worldMinutes * 0.035, 0, 100);
  const { results: rows } = await db.prepare("SELECT * FROM npcs ORDER BY id").all<any>();
  const clock = await worldClock(db, now);
  const updates = rows.map(npc => {
    let health = Number(npc.health);
    let status = npc.status;
    let energy = Number(npc.energy);
    const fear = clamp(Number(npc.fear_player) - worldMinutes * 0.025, 0, 100);
    let trust = Number(npc.trust_player);
    if (status === "recovering") {
      health = Math.min(Number(npc.max_health), health + worldMinutes * 2);
      if (health >= Number(npc.max_health)) status = "active";
    }
    trust += Math.sign(-trust) * Math.min(Math.abs(trust), worldMinutes * 0.002);
    const plan = choosePlan(npc, clock.hour, status, fear, cityAlert);
    energy =
      plan.activity === "sleeping"
        ? clamp(energy + worldMinutes * 0.12, 0, 100)
        : clamp(energy - worldMinutes * 0.018, 0, 100);
    return db
      .prepare(
        "UPDATE npcs SET location=?,activity=?,goal=?,mood=?,status=?,health=?,energy=?,trust_player=?,fear_player=?,updated_at=? WHERE id=?",
      )
      .bind(plan.location, plan.activity, plan.goal, plan.mood, status, health, energy, trust, fear, now, npc.id);
  });
  if (updates.length) await db.batch(updates);
  await setState(db, "city_alert", cityAlert.toFixed(3));
  await setState(db, "last_simulated_at", now);
}

function choosePlan(npc: any, hour: number, status: string, fear: number, alert: number) {
  if (status === "recovering")
    return { location: "infirmary", activity: "recovering", goal: "recover from the spell", mood: "shaken" };
  if (fear > 65)
    return {
      location: "warden station",
      activity: "seeking protection",
      goal: "avoid the lantern bearer",
      mood: "afraid",
    };
  if (fear > 20)
    return { location: npc.home, activity: "fleeing", goal: "keep away from the lantern bearer", mood: "wary" };
  if (alert >= 35 && String(npc.role).includes("warden"))
    return {
      location: "rune court",
      activity: "searching for the player",
      goal: "question the lantern bearer",
      mood: alert >= 70 ? "alarmed" : "alert",
    };
  if (hour < 6) return { location: npc.home, activity: "sleeping", goal: "rest before dawn", mood: "quiet" };
  if (hour < 9)
    return { location: "great hall", activity: "eating breakfast", goal: "prepare for the day", mood: "hopeful" };
  if (hour < 17)
    return {
      location: roleLocation(npc.role, npc.home),
      activity: workActivity(npc.role),
      goal: "complete today's work",
      mood: "focused",
    };
  if (hour < 21)
    return Number(npc.sociability) > 55
      ? { location: "great hall", activity: "socialising", goal: "share news with friends", mood: "warm" }
      : { location: "rune court", activity: "walking alone", goal: "think over the day", mood: "thoughtful" };
  return { location: npc.home, activity: "returning home", goal: "close the day", mood: "calm" };
}

function roleLocation(role: string, fallback: string) {
  if (/alchemist|potion/.test(role)) return "alchemy workshop";
  if (/healer/.test(role)) return "infirmary";
  if (/owl|courier/.test(role)) return "owl post";
  if (/archivist|librarian|researcher/.test(role)) return "moon archive";
  if (/warden|groundskeeper/.test(role)) return "rune court";
  if (/tutor|spell/.test(role)) return "practice hall";
  return fallback;
}

function workActivity(role: string) {
  if (role.includes("student")) return "studying";
  if (role.includes("warden")) return "patrolling";
  if (role.includes("healer")) return "treating residents";
  if (/owl|courier/.test(role)) return "sorting messages";
  if (/archive|librarian/.test(role)) return "cataloguing memories";
  if (/alchemist|potion/.test(role)) return "brewing";
  return "working";
}

async function worldClock(db: D1, now: number) {
  const epoch = Number((await getState(db, "world_epoch_ms")) || now);
  const totalMinutes = ((Math.max(0, now - epoch) / REAL_MS_PER_WORLD_DAY) * 24 * 60);
  const minuteOfDay = Math.floor(totalMinutes % 1440);
  return { day: Math.floor(totalMinutes / 1440) + 1, hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 };
}

async function worldSnapshot(db: D1) {
  const now = Date.now();
  const clock = await worldClock(db, now);
  const { results: rows } = await db.prepare("SELECT * FROM npcs ORDER BY id").all<any>();
  const { results: memoryRows } = await db
    .prepare(
      "SELECT * FROM memories WHERE expires_at IS NULL OR expires_at>? ORDER BY created_at DESC LIMIT ?",
    )
    .bind(now, 200)
    .all<any>();
  const memories = new Map<string, any[]>();
  for (const row of memoryRows) {
    const list = memories.get(row.npc_id) || [];
    if (list.length < 5)
      list.push({
        kind: row.kind,
        summary_en: row.summary_en,
        summary_zh: row.summary_zh,
        intensity: row.intensity,
        created_at: row.created_at,
      });
    memories.set(row.npc_id, list);
  }
  const authoredById = new Map((characterData as any).characters.map((entry: any) => [entry.id, entry]));
  const archetypes = (characterData as any).archetypes || {};
  const npcs = rows.map(row => {
    const authored: any = authoredById.get(row.id);
    const base = authored ? archetypes[authored.archetype] || {} : {};
    return {
      id: row.id,
      name: authored?.name || row.name,
      role: authored?.role || row.role,
      home: row.home,
      location: row.location,
      activity: row.activity,
      goal: row.goal,
      mood: row.mood,
      status: row.status,
      health: row.health,
      maxHealth: row.max_health,
      energy: row.energy,
      trustPlayer: row.trust_player,
      fearPlayer: row.fear_player,
      memories: memories.get(row.id) || [],
      character: authored
        ? {
            archetype: authored.archetype,
            appearance: { ...(base.appearance || {}), ...(authored.appearance || {}) },
            movement: { ...(base.movement || {}), ...(authored.movement || {}) },
            weapon: { ...(base.weapon || {}), ...(authored.weapon || {}) },
            version: (characterData as any).version || 1,
          }
        : null,
      updatedAt: row.updated_at,
    };
  });
  const { results: events } = await db
    .prepare("SELECT * FROM world_events ORDER BY created_at DESC LIMIT 20")
    .all<any>();
  return {
    world: {
      name: await getState(db, "world_name"),
      day: clock.day,
      hour: clock.hour,
      minute: clock.minute,
      alert: Number((await getState(db, "city_alert")) || 0),
      updatedAt: now,
    },
    npcs,
    events: events.map(event => ({ ...event, payload: safeJson(event.payload_json), payload_json: undefined })),
  };
}

async function applyWorldAction(db: D1, body: any) {
  const type = String(body?.type || "");
  if (!ACTION_TYPES.has(type)) throw httpError(400, "Unsupported action");

  const actionId = String(body?.actionId || "").slice(0, 120);
  if (!actionId) throw httpError(400, "actionId is required");

  // Claim the id first so a concurrent retry cannot apply the action twice.
  const claimed = await db
    .prepare("INSERT OR IGNORE INTO processed_actions(action_id,result_json,created_at) VALUES(?,'',?)")
    .bind(actionId, Date.now())
    .run();
  if (!rowsWritten(claimed)) {
    const previous = await db
      .prepare("SELECT result_json FROM processed_actions WHERE action_id=?")
      .bind(actionId)
      .first<{ result_json: string }>();
    if (previous?.result_json) return safeJson(previous.result_json);
    throw httpError(409, "Action already in progress");
  }

  const npcId = String(body?.npcId || "");
  const npc = await db.prepare("SELECT * FROM npcs WHERE id=?").bind(npcId).first<any>();
  if (!npc) {
    await db.prepare("DELETE FROM processed_actions WHERE action_id=?").bind(actionId).run();
    throw httpError(404, "NPC not found");
  }

  const now = Date.now();
  if (type === "attack") {
    const damage = clamp(Number(body.damage) || 1, 0.1, 3);
    const health = Math.max(0, Number(npc.health) - damage);
    const status = health <= 0 ? "recovering" : "active";
    await db.batch([
      db
        .prepare(
          "UPDATE npcs SET health=?,status=?,activity=?,goal=?,mood='afraid',trust_player=MAX(-100,trust_player-?),fear_player=MIN(100,fear_player+?),updated_at=? WHERE id=?",
        )
        .bind(
          health,
          status,
          status === "recovering" ? "recovering" : "fleeing",
          status === "recovering" ? "recover at the infirmary" : "escape the attacker",
          12 + damage * 5,
          18 + damage * 8,
          now,
          npcId,
        ),
      db
        .prepare(
          "INSERT INTO memories(npc_id,kind,summary_en,summary_zh,intensity,created_at,expires_at) VALUES(?,'player_attack','The lantern bearer attacked me.','提燈者曾攻擊我。',?,?,?)",
        )
        .bind(npcId, Math.min(1, 0.45 + damage * 0.18), now, now + 14 * 86400000),
      db
        .prepare(
          "INSERT INTO world_events(type,summary_en,summary_zh,payload_json,created_at) VALUES('npc_attacked',?,?,?,?)",
        )
        .bind(
          `${npc.name} was struck by the lantern bearer.`,
          `${npc.name} 被提燈者的法術擊中。`,
          JSON.stringify({ npcId, damage, weapon: String(body.weapon || "unknown").slice(0, 32) }),
          now,
        ),
    ]);
    await setState(db, "city_alert", clamp(Number((await getState(db, "city_alert")) || 0) + 10 + damage * 7, 0, 100));
  } else {
    const gain = type === "help" ? 8 : 2;
    await db.batch([
      db
        .prepare("UPDATE npcs SET trust_player=MIN(100,trust_player+?),fear_player=MAX(0,fear_player-?),updated_at=? WHERE id=?")
        .bind(gain, gain * 0.8, now, npcId),
      db
        .prepare("INSERT INTO memories(npc_id,kind,summary_en,summary_zh,intensity,created_at) VALUES(?,?,?,?,?,?)")
        .bind(
          npcId,
          type === "help" ? "player_help" : "player_greeting",
          type === "help" ? "The lantern bearer helped me." : "The lantern bearer greeted me.",
          type === "help" ? "提燈者曾幫助我。" : "提燈者曾向我打招呼。",
          type === "help" ? 0.7 : 0.25,
          now,
        ),
    ]);
  }

  const result = { ok: true, npc: (await worldSnapshot(db)).npcs.find((entry: any) => entry.id === npcId) };
  await db
    .prepare("UPDATE processed_actions SET result_json=? WHERE action_id=?")
    .bind(JSON.stringify(result), actionId)
    .run();
  return result;
}

function rowsWritten(result: unknown) {
  const meta = (result as { meta?: { changes?: number; rows_written?: number } })?.meta;
  const changes = meta?.changes ?? meta?.rows_written;
  return changes === undefined ? true : changes > 0;
}

async function proxyChat(request: Request, env: Env) {
  // Validate the request before checking configuration so malformed or
  // oversized payloads receive their own deterministic 4xx response even on a
  // local machine without an API key.
  const body = await readJsonBody(request, CHAT_MAX_BODY_BYTES);
  if (!env.OPENAI_API_KEY) {
    return json({ error: "NPC chat is not configured yet.", code: "llm_unconfigured" }, 503);
  }
  if (!Array.isArray(body?.messages) || body.messages.length === 0) {
    throw httpError(400, "messages must be a non-empty array");
  }

  const maxChars = Number(env.LLM_MAX_INPUT_CHARS || CHAT_MAX_CHARS_DEFAULT);
  let total = 0;
  const messages = body.messages.slice(-CHAT_MAX_MESSAGES).map((entry: any) => {
    const role = ["system", "user", "assistant"].includes(entry?.role) ? entry.role : "user";
    const content = String(entry?.content ?? "");
    total += content.length;
    if (total > maxChars) throw httpError(413, "Conversation too long");
    return { role, content };
  });

  const base = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const timeoutMs = Number(env.LLM_TIMEOUT_MS || CHAT_TIMEOUT_MS_DEFAULT);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const model = String(body.model || env.OPENAI_MODEL || "gpt-4.1-mini").slice(0, 64);

  try {
    const upstream = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.8 }),
      signal: controller.signal,
    });
    console.log("llm_upstream", { status: upstream.status, ms: Date.now() - startedAt, model });
    if (!upstream.ok) {
      // Never forward upstream headers or bodies — they can carry provider detail.
      return json({ error: "NPC chat is unavailable right now.", code: "llm_upstream" }, 502);
    }
    const payload = await upstream.json();
    return json(payload);
  } catch (error) {
    const aborted = (error as Error)?.name === "AbortError";
    console.error("llm_failed", { aborted, ms: Date.now() - startedAt });
    return json({ error: aborted ? "NPC chat timed out." : "NPC chat is unavailable right now." }, 504);
  } finally {
    clearTimeout(timer);
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...SECURITY_HEADERS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function httpError(status: number, message: string) {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

const RESIDENTS = [
  ["resident-01", "Elian Voss", "astronomy student", "moon archive"],
  ["resident-02", "Mara Thorne", "apprentice alchemist", "alchemy workshop"],
  ["resident-03", "Tobin Reed", "owl keeper", "owl post"],
  ["resident-04", "Lyra Quill", "memory archivist", "moon archive"],
  ["resident-05", "Corin Ash", "junior warden", "rune court"],
  ["resident-06", "Nessa Vale", "healer", "infirmary"],
  ["resident-07", "Orin Bell", "spell student", "practice hall"],
  ["resident-08", "Sable Wynn", "night courier", "owl post"],
  ["resident-09", "Perrin Moss", "groundskeeper", "rune court"],
  ["resident-10", "Iris Flint", "potion researcher", "alchemy workshop"],
  ["resident-11", "Alden Grey", "senior warden", "rune court"],
  ["resident-12", "Mina Lark", "first-year student", "great hall"],
  ["resident-13", "Theo Rook", "duelling tutor", "practice hall"],
  ["resident-14", "Celia Frost", "librarian", "moon archive"],
  ["resident-15", "Rowan Pike", "student", "great hall"],
  ["resident-16", "Vera Loom", "student", "great hall"],
  ["resident-17", "Bram Hollow", "warden", "rune court"],
  ["resident-18", "Edda Moon", "dream researcher", "moon archive"],
] as const;
