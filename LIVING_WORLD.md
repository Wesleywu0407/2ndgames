# Sky Room Living World

Sky Room can run as a persistent local world instead of a disposable HTML
session. The Node server serves the game, stores NPC state in SQLite, advances
the world clock, and records actions even after the browser closes.

## Start

Requires Node.js 24 or newer because the server uses the built-in `node:sqlite`.

```bash
node server/living-world.js
```

Then open:

```text
http://127.0.0.1:4322/sky-room.html
```

The top-right HUD reads `LIVE WORLD` when persistence is connected. If the
server is unavailable, it reads `LOCAL WORLD`; the game still works and queues
up to 100 recent actions for the next connection.

To erase development history and begin a fresh world:

```bash
node server/living-world.js --reset
```

To validate the schema and synchronize character data without opening a port:

```bash
node server/living-world.js --check
```

## What persists

- 18 named residents with roles, homes, health, energy, mood and current goal
- daily schedules based on world time and occupation
- trust and fear toward the player
- recent episodic memories, including attacks and help
- directed NPC relationships
- social memory sharing: victims warn close contacts and a nearby warden
- a decaying city-alert level that changes warden goals
- goal-driven client navigation toward each NPC's scheduled building
- visible fear responses, guard searches, and a proximity resident card
- world events such as owl arrivals, potion spills and Unlight traces
- offline progress, capped at seven real days per catch-up

One real hour currently equals one world day. The simulation runs every 15
seconds on the server; the browser receives snapshots every 10 seconds. It does
not run AI reasoning in the render loop.

## Files

- `server/living-world.js` — static server, API, SQLite schema and simulation
- `js/sky-living-world.js` — resilient browser client and offline action queue
- `data/sky-characters.json` — editable character, appearance, motion and weapon data
- `js/sky-characters.js` — character-data loader and safe fallback profiles
- `js/sky-room.js` — visual NPCs and gameplay consequences
- `server/data/sky-world.db` — generated world database, intentionally ignored

## API

```text
GET  /api/health
GET  /api/world
POST /api/world/action
```

Action example:

```json
{
  "actionId": "unique-client-id",
  "type": "attack",
  "npcId": "resident-01",
  "damage": 1,
  "weapon": "ember"
}
```

`actionId` makes retries idempotent, so a lost response cannot deal damage
twice. Supported actions currently include `attack`, `greet`, and `help`.

## Designing characters

Edit `data/sky-characters.json`. Every resident selects an archetype and can
override any of these groups:

```json
{
  "id": "resident-13",
  "archetype": "duelist",
  "appearance": {
    "cloak": "#51282e",
    "height": 1.1,
    "width": 1,
    "hood": "sharp",
    "accessory": "half-cape"
  },
  "movement": {
    "style": "duellist-stride",
    "speed": 1.38,
    "cadence": 5.1,
    "bob": 0.035,
    "sway": 0.025,
    "turn": 12
  },
  "weapon": {
    "type": "moonbow",
    "name": "rook moonbow",
    "color": "#ff9d68",
    "damage": 2,
    "range": 42
  }
}
```

Supported weapon models are `wand`, `staff`, `flask`, and `moonbow`. Character
equipment is low-poly and shared with the existing procedural style, avoiding
the memory cost of loading a separate high-resolution model for every resident.
The server copies the resolved profile into SQLite on startup, while the JSON
file remains the design source of truth.

## Recommended evolution

1. Add interior occupation animations so residents read, brew, heal, eat and
   practise when they arrive instead of only standing at their destination.
2. Expand greetings into short authored conversations, apologies and help.
3. Add witness line-of-sight so only residents who saw an event can report it
   immediately; friends can still learn it later through conversation.
4. Upgrade searching wardens from approach behaviour to warnings, pursuit and
   a non-lethal arrest / reputation-repair loop.
5. Use the existing LLM proxy only for occasional dialogue. Build prompts from
   database memories and goals; never call an LLM for per-frame movement.
6. For a public shared world, add authentication, rate limits, migrations,
   backups and a hosted database before exposing the action API to the internet.
