/**
 * Integration tests against a real local worker (miniflare via `wrangler dev`),
 * covering the minimum contract in DEPLOYMENT_PLAN.md section 12: route
 * recognition, JSON errors, invalid methods, world-action validation, duplicate
 * actionId idempotency, chat validation, WebSocket message validation, and the
 * static 404 path.
 *
 * Runs fully offline — no Cloudflare account and no OPENAI_API_KEY required.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;

let child;

before(async () => {
  child = spawn(
    "npx",
    ["wrangler", "dev", "--local", "--port", String(PORT), "--inspector-port", "0", "--log-level", "error"],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } },
  );
  child.stdout.on("data", () => {});
  child.stderr.on("data", chunk => process.stderr.write(chunk));

  const deadline = Date.now() + 90_000;
  for (;;) {
    if (Date.now() > deadline) throw new Error("wrangler dev did not become ready in 90s");
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}, { timeout: 120_000 });

after(() => {
  child?.kill("SIGTERM");
});

describe("health and world", () => {
  test("GET /api/health reports database connectivity", async () => {
    const response = await fetch(`${BASE}/api/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.database, "ok");
  });

  test("GET /api/world returns a bounded snapshot", async () => {
    const response = await fetch(`${BASE}/api/world`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.world && typeof body.world.day === "number");
    assert.ok(Array.isArray(body.npcs) && body.npcs.length > 0);
    assert.ok(Array.isArray(body.events) && body.events.length <= 20);
  });

  test("world state survives a second read", async () => {
    const first = await (await fetch(`${BASE}/api/world`)).json();
    const second = await (await fetch(`${BASE}/api/world`)).json();
    assert.equal(first.npcs.length, second.npcs.length);
    assert.equal(first.world.name, second.world.name);
  });
});

describe("routing and method handling", () => {
  test("unknown /api/ route returns JSON 404", async () => {
    const response = await fetch(`${BASE}/api/nope`);
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.ok((await response.json()).error);
  });

  test("wrong method on /api/world falls through to JSON 404", async () => {
    const response = await fetch(`${BASE}/api/world`, { method: "DELETE" });
    assert.equal(response.status, 404);
    assert.match(response.headers.get("content-type"), /application\/json/);
  });

  test("missing static file returns 404, not an SPA fallback", async () => {
    const response = await fetch(`${BASE}/definitely-not-here.html`);
    assert.equal(response.status, 404);
  });

  test("root serves the game page with security headers", async () => {
    const response = await fetch(`${BASE}/`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(await response.text(), /<html/i);
  });
});

describe("world action validation and idempotency", () => {
  const post = (body) =>
    fetch(`${BASE}/api/world/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  test("rejects an unsupported action type", async () => {
    const response = await post({ actionId: `t-${Date.now()}`, npcId: "resident-01", type: "detonate" });
    assert.equal(response.status, 400);
  });

  test("rejects a missing actionId", async () => {
    const response = await post({ npcId: "resident-01", type: "greet" });
    assert.equal(response.status, 400);
  });

  test("rejects an unknown npc", async () => {
    const response = await post({ actionId: `t-${Date.now()}`, npcId: "nobody", type: "greet" });
    assert.equal(response.status, 404);
  });

  test("rejects malformed JSON", async () => {
    const response = await fetch(`${BASE}/api/world/action`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    assert.equal(response.status, 400);
  });

  test("a repeated actionId returns the first result without re-applying", async () => {
    const actionId = `dup-${Date.now()}`;
    const body = { actionId, npcId: "resident-01", type: "help" };

    const first = await (await post(body)).json();
    assert.equal(first.ok, true);
    const trustAfterFirst = first.npc.trustPlayer;

    const second = await (await post(body)).json();
    assert.equal(second.npc.trustPlayer, trustAfterFirst, "duplicate action must not apply twice");
  });
});

describe("chat proxy", () => {
  test("returns a controlled 503 when no key is configured", async () => {
    const response = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });
    // 503 without a key; if a key is present locally the request must still be well-formed.
    assert.ok([200, 502, 503, 504].includes(response.status), `unexpected status ${response.status}`);
    if (response.status === 503) {
      const body = await response.json();
      assert.equal(body.code, "llm_unconfigured");
      assert.ok(!JSON.stringify(body).includes("Bearer"));
    }
  });

  test("never leaks an authorization header", async () => {
    const response = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    assert.equal(response.headers.get("authorization"), null);
    assert.equal(response.headers.get("www-authenticate"), null);
  });

  test("rejects an oversized body", async () => {
    const response = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "x".repeat(64 * 1024) }] }),
    });
    assert.equal(response.status, 413);
  });
});

describe("websocket", () => {
  const open = () =>
    new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
      socket.addEventListener("open", () => resolve(socket), { once: true });
      socket.addEventListener("error", reject, { once: true });
      setTimeout(() => reject(new Error("websocket open timed out")), 15_000);
    });

  const next = (socket) =>
    new Promise((resolve, reject) => {
      socket.addEventListener("message", event => resolve(JSON.parse(event.data)), { once: true });
      setTimeout(() => reject(new Error("no websocket message in 10s")), 10_000);
    });

  test("rejects a plain GET on /ws", async () => {
    const response = await fetch(`${BASE}/ws`);
    assert.equal(response.status, 426);
  });

  test("hello yields a welcome frame", async () => {
    const socket = await open();
    const welcome = next(socket);
    socket.send(JSON.stringify({ t: "hello", name: "Tester", color: "#ffffff" }));
    const message = await welcome;
    assert.equal(message.t, "welcome");
    assert.ok(message.id);
    socket.close();
  });

  test("malformed JSON is rejected without dropping the socket", async () => {
    const socket = await open();
    const error = next(socket);
    socket.send("{{{not json");
    assert.equal((await error).reason, "invalid-json");
    // Socket must still work afterwards.
    const welcome = next(socket);
    socket.send(JSON.stringify({ t: "hello", name: "Still Here" }));
    assert.equal((await welcome).t, "welcome");
    socket.close();
  });

  test("a message without a type is rejected", async () => {
    const socket = await open();
    const error = next(socket);
    socket.send(JSON.stringify({ nope: true }));
    assert.equal((await error).reason, "invalid-message");
    socket.close();
  });

  test("two clients see each other", async () => {
    const a = await open();
    a.send(JSON.stringify({ t: "hello", name: "Alice" }));
    await next(a); // welcome

    const joined = next(a);
    const b = await open();
    b.send(JSON.stringify({ t: "hello", name: "Bob" }));

    const message = await joined;
    assert.equal(message.t, "join");
    assert.equal(message.name, "Bob");
    a.close();
    b.close();
  });
});
