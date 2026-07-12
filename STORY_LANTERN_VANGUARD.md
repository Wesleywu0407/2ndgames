# Story B — Lantern Vanguard · 燈守戰線

Design document for Sky Room's cooperative siege campaign. This is a **design
spec, not implementation**. It describes how a full story loop is layered on top
of the systems that already exist (world clock, five buildings, the hearth,
Unlight wisps, three weapons, eighteen residents, and the LAN presence channel),
and how it becomes multiplayer.

Status: proposed. Owner: design. See [`LIVING_WORLD.md`](LIVING_WORLD.md) for the
server it extends and [`README.md`](README.md) for how to run it.

---

## 1. The fantasy

> The city fled the Unlight at 11:47. The lantern bearers stayed.

You are not clearing a museum — you are **holding a living city through the
night**. Each world-day the Unlight tide rises at dusk and breaks against the
five houses of the academy. You fly, you light, you defend. When dawn comes the
residents come back out, rebuild, and remember who kept the light. When a house
falls, it *stays* dark — its resident stops appearing there, its function is lost
to the city, and the loss persists in the same SQLite world that already tracks
NPC memory.

The current Solo Story (recover 3 memories → cleanse 12 wisps → carry morning to
the hearth) becomes **Night 1** of this campaign — the tutorial night. Everything
after is new.

This solves the "buildings feel empty" problem directly: every building gets a
**defensive role, a resident who works it, a failure state, and a reason to
return to it each night.**

---

## 2. How it maps onto what exists

| Existing system | Role in Lantern Vanguard |
| --- | --- |
| World clock (1 real hr = 1 world day) | Drives the **day ▸ dusk ▸ night ▸ dawn** cycle. Night is the siege; day is preparation. |
| `city_alert` (0–100, decays over time) | Repurposed / paralleled as **Unlight Tide pressure** — rises during night, seeds wave intensity. |
| Wisps (`Wisps(14)`, orbit + dive, `tryHit`) | The Unlight enemies. Extended from ambient hazard into **directed wave attackers** that target buildings, not just the player. |
| Five buildings (archive, alchemy, infirmary, practice, owlpost) | The five **wards** to defend. Each has a light core with HP. |
| Great Hall + hearth | The **keep** — the last light. If every ward falls the tide reaches the hearth; losing the hearth ends the run. |
| Weapons 1/2/3 (ember · scatter · moonbow) | Combat kit. Day-phase upgrades unlock per-weapon tiers. |
| 18 residents (roles, trust, fear, health) | Each ward is **operated by a resident**. Protecting their ward raises trust; letting it fall makes them fear/flee. Reuses the existing trust/fear + memory columns. |
| LAN presence (`/ws`, lantern avatars) | Co-op defenders. Extended from presence-only to **shared wave state + revives**. |

---

## 3. The five wards

Positions are the existing `EXPLORABLES` coordinates in `js/sky-room.js`. Each
ward gains a **light core** (a glowing node with HP) and a **loss consequence**.

| Ward | 中文 | Resident role | Defensive gift while alive | If it falls (persists) |
| --- | --- | --- | --- | --- |
| Moon Archive | 月之檔案館 | archivist / student | Reveals next wave's attack lanes on the HUD | Lose foresight — waves arrive unannounced |
| Alchemist's Workshop | 鍊金工坊 | alchemist | Periodic ember-refill / cooldown reduction | Weapons overheat faster; no potion pickups |
| Moon Infirmary | 月之療養所 | healer | Slow lantern-HP regen aura near allies | No passive heal; revives cost more |
| Practice Hall | 演武堂 | duelist / warden | Spawns 1–2 allied warden NPCs that fight wisps | No NPC allies; you hold alone |
| Owl Post | 貓頭鷹郵所 | keeper | Calls owl escorts that intercept divers | Divers reach cores unblocked |

**Core HP model.** A ward core has `coreHp` (server-authoritative). Wisps that
reach a ward drain its core; the player/allies cleansing nearby wisps and
"stoking" the core (hold `E`) restores it. At `coreHp <= 0` the ward goes
**dark**: its gift is disabled, its resident flips to `status='displaced'` and
stops pathing there, and a `ward_fallen` world event is written. A dark ward can
be **relit during the day phase** for a resource cost (see §5) — but its resident
only trusts you again after a full night held.

---

## 4. The night — siege loop

Night runs from world-hour **21:00 → 05:00** (≈ 20 real minutes at the current
clock rate; tunable). It is divided into **waves** keyed off the world clock so
every connected player shares the same schedule.

```
DUSK  20:00–21:00   residents retreat indoors · you choose a ward to anchor
                    · HUD: "the tide is rising"
WAVE  21,22,23,00,01,02,03  one wave per world-hour, escalating
LULL  between waves  ~40s real · collect embers · stoke cores · reposition
DAWN  04:00–05:00   surviving wisps dissolve · bells · trust settles · rewards
```

### Wave anatomy

Each wave has: a **size** (wisp count), a **target set** (which wards it dives
at), and optionally a **special** (see below). Intensity scales with:

- `night` number (campaign progression)
- `tidePressure` (the alert-style accumulator — attacking residents in daytime
  raises it, so cruelty makes nights harder; a coherent moral hook)
- number of connected players (co-op scales up, so 2 players ≠ trivial)

```
waveSize   = base(night) * (1 + 0.25 * (players - 1)) * (1 + tidePressure/200)
targets    = pickWards(night, waveIndex)   // early nights hit 1 ward, later hit 3+
```

### Wisp behaviours (extends current dive AI)

- **Drifter** — the existing orbit-and-dive wisp, retargeted onto a ward core.
- **Lancer** — fast straight dive at a core; only the moonbow (weapon 3) reliably
  stops it in time. Rewards weapon-switching.
- **Shroud** *(special)* — slow, soaks hits, dims a ward's gift while alive;
  ignore it and the ward is blind, focus it and lancers slip past. Priority
  tension.
- **Breach** *(late nights)* — if a ward is already dark, breach wisps route
  straight for the hearth. The keep fight.

### Failure & the keep

If all five wards are dark, the next wave marches the hearth. Hearth HP is the
final bar. Lose it → **the city goes out**: a somber end card, the world records
a `city_dark` event, and the run resets to a chosen night (not the whole
campaign — see §7 persistence). This is the loss condition; there is no player
"death" game-over during the siege, only the city's.

---

## 5. The day — preparation loop

Dawn hands control back. Day (05:00–20:00, the long stretch) is calm, social, and
strategic — it reuses the **existing living world** almost unchanged:

1. **Residents re-emerge** and path to their wards (existing schedule system).
   Wards you held overnight have their resident present and warmer (trust up).
2. **Embers → upgrades.** Wisps cleansed at night bank as **ember shards**. Spend
   at the Alchemist's Workshop on weapon tiers (ember pierce, scatter width,
   moonbow charge) and at the Infirmary on max lantern HP.
3. **Relight fallen wards.** Pay shards + stoke the dark core to bring a ward
   back before dusk.
4. **Story beats.** One authored conversation per day advances the arc (§6),
   built from the resident's real memories in SQLite (who you saved, who you
   hurt). This is where the LLM proxy may optionally generate a line — **never
   in the render loop**, only on interact, per `LIVING_WORLD.md` guidance.
5. **Read the Archive** to preview tomorrow night's tide.

Day has no combat. It is the exhale, and the place the "empty buildings" become
full — each is a shop / heal / lore / ally station with a person in it.

---

## 6. Narrative arc

A campaign is a fixed number of nights (proposed: **7 nights**, one real ~40-min
sitting or resumable across sessions via persistence). The tide has a source, and
the arc is finding and closing it.

| Night | Beat (English · 中文) |
| --- | --- |
| 1 | *The lantern remembers.* Tutorial — the current Solo Story, reframed as the first watch. 提燈記得。 |
| 2 | *What the city left.* The Archive reveals the tide isn't weather — it's grief given shape. 城市所遺留的。 |
| 3 | *A resident goes missing.* First hard choice: hold a ward or search for them. 一位居民失蹤。 |
| 4 | *The Warden's doubt.* The grey wardens (existing duel faction) suspect the bearer causes the tide. Trust/fear from your past acts decides if they fight beside or against you. 守夜人的懷疑。 |
| 5 | *The source named.* The Unlight pools beneath the eastern tower (existing `unlight_trace` event). 夜蝕之源。 |
| 6 | *The long night.* Longest siege; all wards targeted. 漫漫長夜。 |
| 7 | *Dawn or dark.* Carry the gathered morning to the source, not just the hearth. Ending forks on wards still lit and residents still trusting. 破曉，或永夜。 |

**Endings** are computed from persistent state, not a cutscene flag:
- *Full Dawn* — all wards lit, high trust: the city wakes, residents named you.
- *Kept Light* — hearth held but wards lost: a smaller, quieter dawn.
- *City Dark* — hearth fell: the somber end, and a New Watch+ that starts harder.

This reuses trust/fear/memory columns already in the schema — the ending is a
*reading* of the world you actually made, which is the whole point of the living
world.

---

## 7. Multiplayer — server-authoritative siege

Presence (done) shows other lanterns. The siege needs **shared, authoritative
wave state** so two players see the same wisps hit the same cores. Principle
(unchanged from `LIVING_WORLD.md`): **the server owns simulation; clients render
and send intent.** No per-frame AI in the browser, no client trusted with damage.

### What the server owns

- The night schedule & current wave (derived from world clock → all clients agree
  for free).
- Each wisp's `id, kind, target ward, position seed, alive`. Spawned server-side
  at wave start; positions are **deterministic from a seed + clock** so clients
  animate them locally without streaming every position (bandwidth-cheap, matches
  the existing "server decides, client renders" model).
- Ward `coreHp` and dark/lit state.
- Hearth HP.
- Ember-shard banks (per player) and upgrades.

### New message types (over the existing `/ws` channel in `server/lantern-net.js`)

```text
server → client  {t:'wave',  night, index, seed, size, targets:[wardId], specials}
client → server  {t:'cleanse', wispId}                 // "I hit this wisp"
server → client  {t:'wisp',    wispId, state:'gone'}    // authoritative kill
client → server  {t:'stoke',   wardId}                  // holding E on a core
server → client  {t:'ward',    wardId, coreHp, dark}
server → client  {t:'hearth',  hp}
client → server  {t:'revive',  targetId}                // co-op pickup
server → client  {t:'down' | 'up', playerId}
```

Cleanse/stoke are **validated server-side** (range to wisp/core, cooldown,
idempotent like the existing `actionId` on `/api/world/action`). A lost packet
never double-counts.

### New persisted state (SQLite, alongside existing tables)

```sql
CREATE TABLE ward_state (
  ward_id TEXT PRIMARY KEY,   -- archive | alchemy | infirmary | practice | owlpost
  core_hp REAL NOT NULL,
  max_hp  REAL NOT NULL,
  dark    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE campaign (
  key TEXT PRIMARY KEY,       -- night, tide_pressure, hearth_hp, ending
  value TEXT NOT NULL
);
-- ember shards & upgrades: reuse world_state per player id, or a small
-- player_progress table keyed by the presence player id.
```

Because it is persistent, a co-op night can be **paused by everyone leaving and
resumed** — the world clock keeps advancing (capped at 7 days offline, as today),
so a night left unfinished is scored as it stood at dusk closure. Design decision
needed: whether offline hours auto-run waves or freeze the campaign clock (§9).

### Co-op roles (emergent, not hard classes)

Two+ players naturally split: one anchors a ward and stokes, one intercepts
lancers, one relights. The Practice Hall's NPC wardens fill gaps for solo play so
the mode is **not multiplayer-required** — it scales, it doesn't gate.

---

## 8. Implementation roadmap

Phased so each step is playable and testable before the next. Each phase is a
future task.

- **P0 — Skeleton (single-player, no persistence).** Day/night state machine off
  the world clock; dusk/dawn HUD + story cards; wisps retarget onto one ward core
  with local HP. Proves the loop is fun before wiring the server.
- **P1 — Wards & consequences.** All five cores, gifts while lit, dark state and
  resident displacement (client-side first).
- **P2 — Day economy.** Ember shards, Alchemist/Infirmary upgrade UI, relighting.
- **P3 — Server authority.** Move wave schedule, wisp seeds, core HP, hearth HP
  into `living-world.js` + `lantern-net.js`; add `ward_state`/`campaign` tables;
  the message types in §7. Single-player still works (one client).
- **P4 — Co-op siege.** Shared waves, server-validated cleanse/stoke, revives,
  co-op scaling, Practice Hall NPC allies.
- **P5 — Campaign & endings.** Seven-night arc, authored day beats, persistent
  ending computed from trust/wards. Optional LLM day dialogue.

Validation per phase: two-tab browser check as in MP-4, plus
`node server/living-world.js --check` for schema, and a scripted wave to confirm
cores drain and dark/relit states persist across a server restart.

---

## 9. Open design decisions

These need your call before P0 (they change the feel, not just the code):

1. **Night length.** 20 real minutes/night × 7 = a ~2.3 hr campaign. Shorten
   nights, or lean on persistence for multi-session? (Affects wave count/pacing.)
2. **Offline nights.** When everyone logs off mid-campaign, do waves auto-resolve
   (risk: lose while away) or does the campaign clock freeze while the *ambient*
   living world keeps ticking? Recommend **freeze campaign, keep ambient.**
3. **Permadeath of wards.** Fully permanent for a run, or relightable every day?
   Recommend **relightable at rising cost** — loss stings but isn't a spiral.
4. **Moral hook strength.** Should daytime cruelty (attacking residents) really
   raise tide pressure and harden nights? Strong theme, but can feel punishing.
   Recommend **on, but gentle** (small multiplier, clearly surfaced).
5. **Solo vs co-op tuning.** NPC wardens fill for solo — but how many, how
   strong, so co-op stays meaningfully easier without solo feeling hopeless?
6. **Ending permanence.** Does *City Dark* roll into a harder New Watch+, or fully
   reset? Recommend **New Watch+** to reward a long-running world.

---

## 10. What this reuses vs. builds new

**Reuses (already in the repo):** world clock, `city_alert` accumulator pattern,
`Wisps` dive AI, five building shells + interiors, hearth/finale, three weapons +
`Bolts`, 18 residents with trust/fear/memory, `/api/world/action` idempotency
pattern, `/ws` presence channel + lantern avatars, offline catch-up.

**Builds new:** day/night state machine, ward cores + gifts + dark state, wave
scheduler + wisp variants, ember economy + upgrades, `ward_state`/`campaign`
tables, siege message types, co-op wave sync + revives, seven-night script +
computed endings.

The through-line: Lantern Vanguard is not a new game bolted on — it is the
**living world given stakes**. The residents, their memories, and the buildings
you already have stop being scenery and start being the thing you're fighting
to keep lit.
