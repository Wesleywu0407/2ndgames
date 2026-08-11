/**
 * WorldRoom — a single Durable Object instance that owns all realtime state.
 *
 * The Sites draft kept `clients`, `story` and `siege` in Worker module scope.
 * That works for one isolate and silently breaks across isolates/regions:
 * two players can connect to the same URL and never see each other.
 * Routing every /ws upgrade to one named DO gives a single authoritative room,
 * which is option 1 of DEPLOYMENT_PLAN.md section 8.
 */

const MAX_PLAYERS = 16;
const MAX_MESSAGE_BYTES = 8 * 1024;
const MESSAGE_BUDGET = 60; // messages per player per RATE_WINDOW_MS
const RATE_WINDOW_MS = 1000;
const PVP_MAX_RANGE = 130;
const RESPAWN_MS = 1800;

type Player = {
  id: string;
  socket: WebSocket;
  name: string;
  color: string;
  character: string;
  state: RealtimeState | null;
  hp: number;
  storyReady: boolean;
  windowStart: number;
  windowCount: number;
};

type RealtimeState = {
  p: number[];
  r: number[];
  c: number;
  w: number;
  f: number;
  rs: { a: number; q: number };
};

const WARD_IDS = ["archive", "alchemy", "infirmary", "practice", "owlpost"] as const;

export class WorldRoom {
  private clients = new Map<string, Player>();
  private nextPlayerId = 1;
  private timer: ReturnType<typeof setInterval> | null = null;

  private story = {
    hostId: null as string | null,
    started: false,
    phase: 0,
    relics: new Set<string>(),
    incidents: new Set<string>(),
    votes: new Map<string, string>(),
    choice: null as string | null,
    relays: new Set<string>(),
    bossHp: 0,
    bossMaxHp: 0,
    gardenVotes: new Map<string, string>(),
    gardenOutcome: null as string | null,
    runId: "twelfth-bell-edge-1",
  };

  private siege = {
    running: false,
    phase: "dusk",
    night: 1,
    waveIx: 0,
    shards: 0,
    elapsed: 0,
    participants: new Set<string>(),
    wards: new Map(WARD_IDS.map(id => [id, { id, hp: 100, dark: false }])),
  };

  constructor(_state: unknown, _env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected websocket upgrade", { status: 426 });
    }
    if (this.clients.size >= MAX_PLAYERS) {
      return new Response("World is full", { status: 503 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    const id = `p${this.nextPlayerId++}`;
    const player: Player = {
      id,
      socket: server,
      name: "",
      color: "#e8b06a",
      character: "resident-01",
      state: null,
      hp: 100,
      storyReady: false,
      windowStart: Date.now(),
      windowCount: 0,
    };
    this.clients.set(id, player);

    server.addEventListener("message", event => this.onMessage(player, event));
    server.addEventListener("close", () => this.dropPlayer(player));
    server.addEventListener("error", () => this.dropPlayer(player));

    this.ensureTimer();
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  private onMessage(player: Player, event: MessageEvent) {
    const raw = event.data;
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) {
      this.send(player, { t: "error", reason: "message-too-large" });
      return;
    }
    if (!this.withinRate(player)) {
      this.send(player, { t: "error", reason: "rate-limited" });
      return;
    }
    let message: any;
    try {
      message = JSON.parse(raw);
    } catch {
      this.send(player, { t: "error", reason: "invalid-json" });
      return;
    }
    if (!message || typeof message.t !== "string") {
      this.send(player, { t: "error", reason: "invalid-message" });
      return;
    }
    try {
      this.route(player, message);
    } catch {
      this.send(player, { t: "error", reason: "unhandled" });
    }
  }

  private withinRate(player: Player) {
    const now = Date.now();
    if (now - player.windowStart >= RATE_WINDOW_MS) {
      player.windowStart = now;
      player.windowCount = 0;
    }
    player.windowCount += 1;
    return player.windowCount <= MESSAGE_BUDGET;
  }

  private route(player: Player, message: any) {
    if (message.t === "hello") return this.onHello(player, message);
    if (!player.name) return; // must greet before anything else
    if (message.t === "state") return this.onState(player, message);
    if (message.t === "ping") return this.send(player, { t: "pong", at: Date.now() });
    if (message.t === "pvp-shot") return this.onShot(player, message);
    if (message.t === "pvp-hit") return this.onHit(player, message);
    if (message.t.startsWith("story")) return this.handleStory(player, message);
    if (message.t.startsWith("siege")) return this.handleSiege(player, message);
  }

  private onHello(player: Player, message: any) {
    player.name = cleanName(message.name) || `Lantern ${player.id.slice(1)}`;
    player.color = /^#[0-9a-f]{6}$/i.test(message.color) ? String(message.color).toLowerCase() : "#e8b06a";
    player.character = String(message.character || "resident-01").slice(0, 32);
    this.send(player, {
      t: "welcome",
      id: player.id,
      players: [...this.clients.values()]
        .filter(other => other !== player && other.name)
        .map(other => ({
          id: other.id,
          name: other.name,
          color: other.color,
          character: other.character,
          state: other.state ? { ...other.state, hp: other.hp } : null,
        })),
    });
    this.broadcast(
      { t: "join", id: player.id, name: player.name, color: player.color, character: player.character },
      player.id,
    );
  }

  private onState(player: Player, message: any) {
    const state = cleanRealtimeState(message);
    if (!state) return;
    player.state = state;
    this.broadcast({ t: "state", id: player.id, ...state, hp: player.hp }, player.id);
  }

  private onShot(player: Player, message: any) {
    this.broadcast(
      {
        t: "pvp-shot",
        id: player.id,
        o: cleanVector(message.o),
        d: Array.isArray(message.d) ? message.d.slice(0, 5).map(cleanVector) : [],
        w: [1, 2, 3].includes(message.w) ? message.w : 1,
        p: clamp(Number(message.p) || 0, 0, 1),
      },
      player.id,
    );
  }

  private onHit(player: Player, message: any) {
    const target = this.clients.get(String(message.target));
    if (!target?.state || !player.state || target.id === player.id) return;
    // Server decides damage from the weapon id; the client never supplies it.
    const weapon = [1, 2, 3].includes(message.weapon) ? message.weapon : 1;
    const distance = Math.hypot(...player.state.p.map((value, index) => value - target.state!.p[index]));
    if (distance > PVP_MAX_RANGE) return;
    const damage = ({ 1: 18, 2: 10, 3: 34 } as Record<number, number>)[weapon];
    target.hp = Math.max(0, target.hp - damage);
    this.broadcast({
      t: "pvp-hit",
      from: player.id,
      fromName: player.name,
      target: target.id,
      weapon,
      damage,
      hp: target.hp,
    });
    if (target.hp <= 0) {
      this.broadcast({ t: "pvp-down", from: player.id, fromName: player.name, target: target.id });
      setTimeout(() => {
        if (!this.clients.has(target.id)) return;
        target.hp = 100;
        this.broadcast({ t: "pvp-respawn", id: target.id, hp: 100 });
      }, RESPAWN_MS);
    }
  }

  private handleStory(player: Player, message: any) {
    const story = this.story;
    if (message.t === "story-join") {
      if (!story.hostId) story.hostId = player.id;
      this.send(player, {
        t: "story-fragment",
        runId: story.runId,
        fragment: [...this.clients.keys()].indexOf(player.id) % 4,
      });
      return this.broadcastStory("party-change", player.id);
    }
    if (message.t === "story-leave") {
      player.storyReady = false;
      story.votes.delete(player.id);
      story.gardenVotes.delete(player.id);
      if (story.hostId === player.id) {
        story.hostId = [...this.clients.keys()].find(id => id !== player.id) || null;
      }
      return this.broadcastStory("party-change", player.id);
    }
    if (message.t === "story-ready") {
      player.storyReady = Boolean(message.ready);
      return this.broadcastStory("party-ready", player.id);
    }
    if (message.t === "story-start" && player.id === story.hostId) {
      story.started = true;
      return this.broadcastStory("party-start", player.id);
    }
    if (message.t === "story-vote") {
      story.votes.set(player.id, String(message.choice).slice(0, 32));
      if (story.votes.size >= this.storyParticipants().length) {
        story.choice = story.votes.get(story.hostId || "") || [...story.votes.values()][0] || "mara";
        story.phase = 6;
      }
      return this.broadcastStory("story-vote", player.id);
    }
    if (message.t === "story-garden-vote") {
      story.gardenVotes.set(player.id, String(message.choice).slice(0, 32));
      if (story.gardenVotes.size >= this.storyParticipants().length) {
        story.gardenOutcome =
          story.gardenVotes.get(story.hostId || "") || [...story.gardenVotes.values()][0] || "restore";
        story.phase = 10;
      }
      return this.broadcastStory("garden-vote", player.id);
    }
    if (message.t === "story-ping") {
      return this.broadcast({
        t: "story-ping",
        id: player.id,
        name: player.name,
        kind: String(message.kind).slice(0, 16),
        p: player.state?.p || [0, 0, 0],
        at: Date.now(),
      });
    }
    if (message.t !== "story-act" || !story.started) return;

    const action = String(message.action || "");
    if (action === "recover-opening") story.phase = Math.max(story.phase, 1);
    else if (action === "recover-relic") {
      story.relics.add(String(message.relic).slice(0, 32));
      if (story.relics.size >= 3) story.phase = 2;
    } else if (action === "cleanse-stray") story.phase = 3;
    else if (action === "enter-cloister") story.phase = 4;
    else if (action === "investigate-incident") {
      story.incidents.add(String(message.incident).slice(0, 32));
      if (story.incidents.size >= 3) story.phase = 5;
    } else if (action === "enter-black-garden") story.phase = 7;
    else if (action === "charge-garden-relay") {
      story.relays.add(String(message.relay).slice(0, 32));
      if (story.relays.size >= 3) {
        story.phase = 8;
        story.bossMaxHp = 8;
        story.bossHp = 8;
      }
    } else if (action === "groundskeeper-hit" && story.phase === 8) {
      story.bossHp = Math.max(0, story.bossHp - 1);
      if (!story.bossHp) story.phase = 9;
    } else return;
    this.broadcastStory(action, player.id);
  }

  private storyParticipants() {
    return [...this.clients.values()].filter(player => player.name);
  }

  private broadcastStory(cause: string, actor: string | null) {
    const story = this.story;
    const party = this.storyParticipants().map(player => ({
      id: player.id,
      name: player.name,
      character: player.character,
      color: player.color,
      ready: player.storyReady,
      dimmed: false,
      host: player.id === story.hostId,
      voted:
        story.phase === 5
          ? story.votes.has(player.id)
          : story.phase === 9
            ? story.gardenVotes.has(player.id)
            : false,
    }));
    this.broadcast({
      t: "story-state",
      version: 3,
      runId: story.runId,
      started: story.started,
      phase: story.phase,
      chapter: story.phase >= 7 ? "black-garden" : story.phase >= 4 ? "names-in-cloister" : "prologue",
      checkpoint: "petal-trail",
      memoryRecovered: story.phase >= 1,
      relics: [...story.relics],
      relicCount: story.relics.size,
      relicNeeded: 3,
      cleansed: story.phase >= 3 ? 1 : 0,
      encounterComplete: story.phase >= 3,
      prologueComplete: story.phase >= 4,
      incidents: [...story.incidents],
      incidentCount: story.incidents.size,
      incidentNeeded: 3,
      voteOpen: story.phase === 5 && !story.choice,
      votesCast: story.votes.size,
      choice: story.choice,
      chapterOneComplete: story.phase >= 6,
      relays: [...story.relays],
      relayCount: story.relays.size,
      relayNeeded: 3,
      echoHeld: false,
      bossHp: story.bossHp,
      bossMaxHp: story.bossMaxHp,
      bossStage: story.bossHp ? Math.ceil((1 - story.bossHp / Math.max(1, story.bossMaxHp)) * 3) : 0,
      gardenVoteOpen: story.phase === 9 && !story.gardenOutcome,
      gardenVotesCast: story.gardenVotes.size,
      gardenOutcome: story.gardenOutcome,
      chapterTwoComplete: story.phase >= 10,
      completed: story.phase >= 10,
      hostId: story.hostId,
      party,
      partySize: party.length,
      cause,
      actor,
      updatedAt: Date.now(),
    });
  }

  private handleSiege(player: Player, message: any) {
    const siege = this.siege;
    if (message.t === "siege-join") {
      siege.participants.add(player.id);
      siege.running = true;
      return this.sendSiege();
    }
    if (message.t === "siege-leave") {
      siege.participants.delete(player.id);
      return;
    }
    if (message.t !== "siege-act" || !siege.running) return;
    const ward = siege.wards.get(String(message.ward) as (typeof WARD_IDS)[number]);
    if (message.act === "cleanse") siege.shards++;
    else if (ward && message.act === "stoke" && !ward.dark) ward.hp = Math.min(100, ward.hp + 4);
    else if (ward && message.act === "relight" && ward.dark) {
      ward.hp = Math.min(100, ward.hp + 6);
      if (ward.hp >= 50) ward.dark = false;
    } else return;
    this.sendSiege();
  }

  private sendSiege() {
    const siege = this.siege;
    this.broadcast({
      t: "siege",
      running: siege.running,
      night: siege.night,
      phase: siege.phase,
      waveIx: siege.waveIx,
      waves: 4,
      targets: [...siege.wards.keys()],
      focus: [...siege.wards.keys()][0],
      shards: siege.shards,
      upgrades: { embers: 0, cores: 0, lantern: 0 },
      players: siege.participants.size,
      wards: [...siege.wards.values()].map(ward => ({ ...ward, hp: Math.round(ward.hp * 10) / 10 })),
    });
  }

  private ensureTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      if (!this.clients.size) {
        clearInterval(this.timer!);
        this.timer = null;
        return;
      }
      const siege = this.siege;
      if (!siege.running) return;
      siege.elapsed += 1;
      if (siege.phase === "dusk" && siege.elapsed >= 8) {
        siege.phase = "wave";
        siege.elapsed = 0;
        siege.waveIx++;
      } else if (siege.phase === "wave") {
        for (const ward of siege.wards.values()) {
          if (ward.dark) continue;
          ward.hp = Math.max(0, ward.hp - 0.8);
          if (!ward.hp) ward.dark = true;
        }
        if (siege.elapsed >= 24) {
          siege.phase = "lull";
          siege.elapsed = 0;
        }
      } else if (siege.phase === "lull" && siege.elapsed >= 10) {
        siege.phase = siege.waveIx >= 4 ? "dawn" : "wave";
        siege.elapsed = 0;
        if (siege.phase === "wave") siege.waveIx++;
      }
      this.sendSiege();
    }, 1000);
  }

  private dropPlayer(player: Player) {
    if (!this.clients.delete(player.id)) return;
    this.siege.participants.delete(player.id);
    this.story.votes.delete(player.id);
    this.story.gardenVotes.delete(player.id);
    if (this.story.hostId === player.id) {
      this.story.hostId = this.storyParticipants()[0]?.id || null;
    }
    this.broadcast({ t: "leave", id: player.id });
    this.broadcastStory("party-change", player.id);
  }

  private send(player: Player, message: unknown) {
    try {
      player.socket.send(JSON.stringify(message));
    } catch {
      /* socket already closed */
    }
  }

  private broadcast(message: unknown, excludeId: string | null = null) {
    const payload = JSON.stringify(message);
    for (const player of this.clients.values()) {
      if (player.id === excludeId || !player.name) continue;
      try {
        player.socket.send(payload);
      } catch {
        /* socket already closed */
      }
    }
  }
}

function cleanName(value: unknown) {
  return String(value || "")
    .replace(/[<>\n\r\t]/g, "")
    .trim()
    .slice(0, 24);
}

function cleanVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== 3) return [0, 0, 0];
  return value.map(component => clamp(Number(component) || 0, -500, 500));
}

function cleanRealtimeState(message: any): RealtimeState | null {
  if (!Array.isArray(message.p) || !Array.isArray(message.r)) return null;
  return {
    p: cleanVector(message.p),
    r: [Number(message.r[0]) || 0, clamp(Number(message.r[1]) || 0, -1.6, 1.6)],
    c: message.c ? 1 : 0,
    w: [1, 2, 3].includes(message.w) ? message.w : 1,
    f: message.f ? 1 : 0,
    rs: { a: message.rs?.a ? 1 : 0, q: clamp(Number(message.rs?.q) || 0, 0, 1) },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
