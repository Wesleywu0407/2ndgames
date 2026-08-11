# 2nd Eyes — Sky Room

An interactive browser-based art gallery. From a lobby (`index.html`) visitors
step into themed rooms; **Sky Room** (`sky-room.html`) is the flagship: a
first-person, flyable Three.js night-city where lantern-bearing residents live
on as a persistent world.

- **Static, no build step.** Plain HTML/CSS/ES modules. Three.js is loaded from
  a CDN via an import map — an internet connection is required for the 3D engine
  and Google Fonts.
- **Runs two ways.** As a plain static site (ephemeral *LOCAL WORLD*), or behind
  a small Node server that adds a persistent SQLite simulation (*LIVE WORLD*).

---

## Quick start

You need **[Node.js](https://nodejs.org) 24 or newer** for the Living World
server (it relies on the built-in `node:sqlite` module). A plain static server
works on any recent Node.

### Where the checkout lives

Every command below runs from the project root. On this machine:

```bash
cd '/Users/wumingjuan/Desktop/2ndgames新版'
```

This is the active checkout. The older `2ndgames` folder and the former
`~/Projects/2ndgames` path are not launch targets for this version.

> **Do not keep this repository in an iCloud-synced folder** — that means
> `~/Desktop` and `~/Documents` when "Desktop & Documents Folders" is on.
> iCloud evicts file contents to reclaim space, and Git cannot read an object
> whose contents have been evicted. With a 601 MB history full of `.glb` and
> `.mp4` assets, a checkout dies partway through with
> `fatal: mmap failed: Operation timed out` and leaves the working tree half
> written. A copy that ends up there is faster to re-clone than to repair.

### Option A — Static site (simplest, LOCAL WORLD)

Serve the folder over HTTP and open the page. Any static server works; the
project ships a config for `http-server`:

```bash
cd '/Users/wumingjuan/Desktop/2ndgames新版' && npx http-server . -p 4322 -c-1
```

Then open:

```text
http://127.0.0.1:4322/sky-room.html
```

The game is fully playable this way. NPCs are procedural and reset each session,
and the top-right HUD reads **LOCAL WORLD**.

> The page uses ES modules and `fetch()` for character data, so it must be
> served over `http://` — opening the file directly with `file://` will not work.

### Option B — Living World server (persistent, LIVE WORLD)

One Node process serves the game **and** owns the persistent simulation on the
same origin (the browser client calls `/api/world` relative to the page, so
persistence only works when the game is served by this server):

```bash
cd '/Users/wumingjuan/Desktop/2ndgames新版' && node server/living-world.js
```

It prints the URL to open, and the database path it is actually using:

```text
Sky Room Living World: http://127.0.0.1:4322/sky-room.html
World database: /Users/wumingjuan/Desktop/2ndgames新版/server/data/sky-world.db
```

**Check that second line.** It must contain `2ndgames新版`; otherwise an older
copy is serving stale game code.

When persistence is connected the HUD reads **LIVE WORLD · DAY n · time**. If
the server is unavailable the client falls back to LOCAL WORLD and queues up to
100 recent actions to replay on the next connection.

**Server flags & environment** (from the project root — see above):

```bash
node server/living-world.js            # serve + simulate (default, local only)
node server/living-world.js --lan      # also accept players from your local network
node server/living-world.js --reset    # wipe history and start a fresh world
node server/living-world.js --check    # validate schema + sync characters, then exit
```

| Variable         | Default     | Purpose                                       |
| ---------------- | ----------- | --------------------------------------------- |
| `SKY_WORLD_PORT` | `4322`      | HTTP + WebSocket port                         |
| `SKY_WORLD_HOST` | `127.0.0.1` | Bind address (`--lan` switches to `0.0.0.0`)  |
| `SKY_WORLD_DB_PATH` | `server/data/sky-world.db` | Alternate SQLite path for isolated QA or parallel worlds |

### Multiplayer over LAN

The Living World server also carries a WebSocket presence channel (`/ws`),
so friends on the same network share the night city and **see each other as
lantern-bearer figures** with floating name tags — and can **defend the same
city together** in the Lantern Vanguard siege (see below).

1. Host starts the server in LAN mode:

   ```bash
   node server/living-world.js --lan
   ```

   The console prints the join URL(s), e.g. `LAN players can join:
   http://192.168.x.x:4322/sky-room.html`.

2. Friends on the same Wi-Fi open that URL. Each player needs internet
   access too (Three.js loads from a CDN).

3. Pick your display name and cloak colour in the ⚙ settings panel
   (**MULTIPLAYER** section). The top-right HUD shows how many lanterns are
   in the world (e.g. `LIVE WORLD · DAY 2 · 02:38 · 2 LANTERNS`).

**Co-op siege.** Pick **SIEGE · PREVIEW** from the Sky Room menu. When you're
connected to the server, the siege is **shared and server-authoritative**:
everyone defends the same five ward cores, sees the same night/wave clock, and
each player's cleansing and stoking (hold **E**) affects the same wards. The HUD
shows the lantern count (e.g. `2▲`). Played offline (no server), the same siege
runs as a local single-player game.

Notes:

- Everyone shares the same persistent world — one player's actions
  (greeting, helping, attacking residents) are visible to all.
- Duel modes (Solo Hunt / Local Versus) stay local; presence broadcasting
  pauses while you play them.
- macOS may ask to allow incoming connections for `node` the first time —
  accept, or other devices cannot reach the server.
- The channel is capped at 16 players and intended for trusted local
  networks only; do not port-forward it to the public internet as-is.

The world database is generated at `server/data/sky-world.db` and is
intentionally git-ignored. Full details: [`LIVING_WORLD.md`](docs/LIVING_WORLD.md).

### Optional — LLM proxy (for NPC dialogue)

A tiny local proxy keeps API keys out of browser JavaScript. It is optional and
separate from the Sky Room server (used mainly by chat NPCs such as the Nekoland
chef). Copy the example env file and fill in your key:

```bash
cp .env.example .env         # then edit .env and set OPENAI_API_KEY
node server/llm-proxy.js     # runs at http://127.0.0.1:8787/api/chat
```

`.env` is git-ignored — never commit real keys, and never put a key directly in
front-end code. The browser side is configured in `js/llm-config.js`.

---

## Controls (Sky Room)

| Input                | Action                          |
| -------------------- | ------------------------------- |
| `SPACE` / `F`        | Take off while grounded         |
| `W A S D`            | Fly                             |
| `SPACE` / `SHIFT`    | Rise / descend while flying     |
| Mouse                | 360° look (click to capture)    |
| Left click           | Cast / interact                 |
| `1` `2` `3`          | Switch weapon                   |
| `E`                  | Use facilities / greet resident |
| `V`                  | Change view                     |
| `B`                  | Mute                            |
| `ESC`                | Release cursor / close settings |

Three modes are available from the Sky Room menu: **Solo Story** (The Lantern
Bearer), **Solo Hunt** (Warden's Trial), and **Local Versus** (Twin Lanterns,
split-screen for two players on one keyboard). Language (English / 繁體中文),
audio, graphics quality and controls are adjustable via the ⚙ settings panel and
saved per-device.

---

## Project layout

```text
index.html            Gallery lobby → links to each room
sky-room.html         Sky Room markup, import map, settings UI
rain-room.html        Rain room
nekoland-room.html    Nekoland ramen bar (LLM chat NPC)
candy-maze.html       Candy maze

css/
  sky-room.css        Sky Room styles
  gallery.css         Lobby styles
  ...                 Numbered foundation/room/interface layers

js/
  sky-room.js         Sky Room scene, actors, story/duel systems, rendering (~4.4k lines)
  sky-living-world.js Resilient browser client + offline action queue
  sky-multiplayer.js  LAN presence + Story PvP — avatars, health, hits and respawns
  sky-characters.js   Character-data loader with safe fallbacks
  sky-audio.js        Sky Room audio
  llm-config.js       LLM provider/endpoint + per-NPC prompts
  npc-llm.js          NPC chat client

data/
  sky-characters.json Editable character / appearance / motion / weapon data (source of truth)

server/
  living-world.js     Static server + REST API + SQLite schema + simulation
  lantern-net.js      Zero-dependency WebSocket presence, Story PvP and hit validation
  siege.js            Server-authoritative shared Lantern Vanguard siege
  llm-proxy.js        Local-only LLM proxy (reads .env)
  data/sky-world.db   Generated world database (git-ignored)

assets/images/        Photography and room artwork

docs/                 Design plans, character bible, audits, acceptance sheets
```

## Living World API (served by `server/living-world.js`)

```text
GET  /api/health
GET  /api/world
POST /api/world/action        # { actionId, type, npcId, ... }  — attack | greet | help
```

`actionId` makes retries idempotent, so a lost response never applies an action
twice. One real hour equals one world day; the server ticks every 15 seconds and
the browser polls a snapshot every 10 seconds — no AI runs in the render loop.
See [`LIVING_WORLD.md`](docs/LIVING_WORLD.md) for the data model, offline catch-up,
and character-authoring guide.

## Editing characters

Residents are defined in [`data/sky-characters.json`](data/sky-characters.json).
Each picks an `archetype` and may override `appearance`, `movement`, and
`weapon`. Supported weapon models: `wand`, `staff`, `flask`, `moonbow`. The JSON
is the design source of truth; the server copies resolved profiles into SQLite
on startup. Run `node server/living-world.js --check` after edits to validate.

## Story Mode maintenance

Boss visibility, combat activation, server ownership, automated checks, and the
manual regression route are documented in
[`STORY_MODE_BOSS_LIFECYCLE.md`](docs/STORY_MODE_BOSS_LIFECYCLE.md).
