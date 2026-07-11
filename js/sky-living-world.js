// Lightweight bridge between the Three.js scene and the persistent world.
// The game remains fully playable when the server is offline.

const QUEUE_KEY = 'sky-room-world-actions-v1';

class LivingWorldClient extends EventTarget {
  constructor() {
    super();
    this.connected = false;
    this.world = null;
    this.events = [];
    this.npcs = new Map();
    this.pollTimer = 0;
    this.syncing = false;
    this.failures = 0;
  }

  async connect() {
    const ok = await this.sync();
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.sync(), 10_000);
    return ok;
  }

  async sync() {
    if (this.syncing) return this.connected;
    this.syncing = true;
    try {
      const snapshot = await requestJson('/api/world', { timeoutMs: 2200 });
      this.world = snapshot.world;
      this.events = Array.isArray(snapshot.events) ? snapshot.events : [];
      this.npcs.clear();
      for (const npc of snapshot.npcs || []) this.npcs.set(npc.id, npc);
      const wasOffline = !this.connected;
      this.connected = true;
      this.failures = 0;
      await this.flushQueue();
      this.dispatchEvent(new CustomEvent('sync', { detail: { snapshot, reconnected: wasOffline } }));
      return true;
    } catch (_) {
      this.connected = false;
      this.failures++;
      this.dispatchEvent(new CustomEvent('offline', { detail: { failures: this.failures } }));
      return false;
    } finally {
      this.syncing = false;
    }
  }

  getNPC(id) { return this.npcs.get(id) || null; }

  async act(type, npcId, detail = {}) {
    const action = {
      actionId: globalThis.crypto?.randomUUID?.() || `action-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type, npcId, ...detail, clientTime: Date.now()
    };
    if (!this.connected) {
      this.queue(action);
      return { ok: false, queued: true };
    }
    try {
      const result = await requestJson('/api/world/action', {
        method: 'POST', body: action, timeoutMs: 2600
      });
      if (result.npc) this.npcs.set(result.npc.id, result.npc);
      this.dispatchEvent(new CustomEvent('action', { detail: { action, result } }));
      return result;
    } catch (_) {
      this.connected = false;
      this.queue(action);
      return { ok: false, queued: true };
    }
  }

  recordAttack(npcId, damage, weapon) {
    return this.act('attack', npcId, { damage, weapon });
  }

  queue(action) {
    const queue = readQueue();
    queue.push(action);
    // Bound offline storage; the newest consequences matter most.
    writeQueue(queue.slice(-100));
  }

  async flushQueue() {
    const queue = readQueue();
    if (!queue.length) return;
    const remaining = [];
    for (let i = 0; i < queue.length; i++) {
      const action = queue[i];
      try {
        const result = await requestJson('/api/world/action', {
          method: 'POST', body: action, timeoutMs: 2600
        });
        if (result.npc) this.npcs.set(result.npc.id, result.npc);
      } catch (_) {
        remaining.push(...queue.slice(i));
        break;
      }
    }
    writeQueue(remaining);
  }

  destroy() {
    clearInterval(this.pollTimer);
    this.pollTimer = 0;
  }
}

async function requestJson(url, { method = 'GET', body, timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Living World HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function readQueue() {
  try {
    const value = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch (_) { return []; }
}

function writeQueue(queue) {
  try {
    if (queue.length) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    else localStorage.removeItem(QUEUE_KEY);
  } catch (_) { /* private browsing or quota */ }
}

export const livingWorld = new LivingWorldClient();
