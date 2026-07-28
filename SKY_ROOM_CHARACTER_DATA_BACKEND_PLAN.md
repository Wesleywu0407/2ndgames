# Sky Room — Character Data Backend Plan

## Document status

**Status:** Implementation in progress — canonical catalog and Rust backend foundation delivered
**Date:** 2026-07-27  
**Goal:** Make a new resident or playable hero easy to add without editing character lists across the client, server, UI, and multiplayer code.

## Implementation review — 2026-07-28

The ownership model in this plan is approved and remains the target. The first
compatibility-first vertical slice is implemented:

- `data/characters/registry.json`, shared archetypes, schemas, and one package
  for each of the existing 20 residents now exist.
- Browser and Node resolve the same catalog contract and derived resident,
  playable, story, network, and Living World seed views.
- Settings, local activation, remote presence, LAN validation, villager body
  overrides, and Living World seeding no longer own independent resident ID
  lists.
- The Living World now discovers all 20 active residents non-destructively;
  Aldous Crane and Kael Morrow are no longer omitted from a new database.
- `rust-backend/` validates the canonical packages, transactionally caches
  authored definitions without touching evolved world state, and exposes a
  filtered read-only catalog API.
- Character QA compares browser and server catalog snapshots instead of
  searching source files for repeated IDs.

The repository review corrected one baseline detail in this plan: both imported
hero contracts had stale byte metrics. The checked-in Aldous GLB is 377,468
bytes and Kael is 378,544 bytes; their runtime animation libraries total
1,364,568 and 923,580 bytes respectively. Those contracts are now measured
against the actual assets.

The migration is deliberately not declared complete yet:

- Rich playable presentation/ability records still live in the compatibility
  manifest and are joined to catalog capability IDs. Moving those records into
  each package is the remaining Phase 1 authorship migration.
- Complete story cards and bilingual resident identity copy still need writer
  review; migration markers make that debt visible rather than inventing canon.
- The Rust service owns the character-data backend. The established Node
  process still owns the current Living World simulation and WebSocket
  Story/Siege protocols until those systems receive a separate parity-tested
  Rust migration.

## Short answer

Yes, this is achievable, and Sky Room already has most of the necessary pieces.

The project currently has editable character data, archetype inheritance, procedural fallbacks, playable-character asset contracts, a persistent SQLite world, and automated character checks. The problem is that these pieces do not yet share one complete character record. Adding a character can require changes in several places, so the different rosters can drift apart.

The proposed direction is:

> **One character package, one registry entry, one stable ID, many consumers.**

A storyteller authors the character's identity, voice, relationships, and dramatic purpose. Artists attach presentation assets. Designers attach gameplay and world behaviour. The game, character selector, multiplayer server, and Living World all discover the same record.

The JSON character packages remain the editable source of truth. SQLite stores changing world state such as health, mood, memories, relationships, and location. It must not become the only place where authored identity or lore exists.

---

## 1. The player-facing promise

This backend is not only a technical catalog. It should protect the feeling that every person in Sky Room belongs to the same haunted campus.

When a new character is added, the player should be able to understand:

- Who is this person?
- What did they lose when the clocks stopped at 11:47?
- What do they want tonight?
- What false belief keeps them stuck?
- Who in the campus do they care about?
- What changes in the world when they are helped, ignored, or betrayed?
- If they are playable, what new emotional and mechanical perspective do they offer?

The backend should make those questions required authoring decisions, not optional notes scattered through code.

### Story principle

Every character is one person with optional capabilities:

- They may exist as a persistent resident.
- They may appear in authored story scenes.
- They may be selectable as a playable hero.
- They may use a procedural body, an imported 3D model, or both through fallback.

These are components of one identity, not separate copies of the character.

---

## 2. Current repository reality

Sky Room already contains four useful foundations:

1. `data/sky-characters.json` defines 20 residents and reusable archetypes.
2. `js/sky-characters.js` resolves archetype defaults and safe procedural fallbacks.
3. `js/sky-room/characters/manifest.js` defines playable identity, bilingual copy, abilities, models, animations, budgets, attachments, accessibility, and licences.
4. `server/living-world.js` copies resolved character presentation into SQLite and stores changing NPC state.

The missing piece is a single catalog that owns the complete character contract.

### Current duplication and drift

| Concern | Current owner | Risk |
| --- | --- | --- |
| Resident identity and procedural look | `data/sky-characters.json` | Does not contain the full playable or narrative contract |
| Playable identity and assets | `characters/manifest.js` | Repeats name, role, colours, biography, and abilities |
| Local playable IDs | `js/sky-room.js` | Hardcoded roster |
| Remote playable IDs | `js/sky-multiplayer.js` | Separate hardcoded roster |
| Server-approved playable IDs | `server/lantern-net.js` | Separate hardcoded roster |
| Persistent residents | `server/living-world.js` | Hardcoded seed list stops at `resident-18` |
| Settings choices | `sky-room.html` | Hand-authored options can drift |
| Villager model exceptions | `characters/villagers.js` | Character-specific override |
| Character QA | `scripts/qa-character-contract.mjs` | Detects some drift after it has happened |

Observed planning baseline:

- The source JSON contains `resident-01` through `resident-20`.
- The Living World seed list contains only `resident-01` through `resident-18`.
- Kael Morrow (`resident-20`) is locally allowed but absent from the current multiplayer client and server allowlists.
- The current character contract check stops because Kael's recorded model byte count no longer matches the asset.
- Settings, selection, local activation, remote presence, persistence, and imported-model readiness are not all the same concept, but they currently use overlapping manual lists.

This is exactly the kind of drift the new backend must make impossible.

---

## 3. Product decisions

### 3.1 One canonical character ID

- Keep every existing `resident-01` to `resident-20` ID for save, database, story, and multiplayer compatibility.
- Never recycle an ID after a character is removed.
- Give each character a readable immutable slug, such as `elian-voss`, for filenames and authoring.
- References, relationships, memories, quests, and network messages use the canonical ID.
- Display names may change; IDs and slugs do not.

### 3.2 One character, component-based capabilities

A character package can opt into these components:

| Component | Purpose |
| --- | --- |
| `identity` | Stable name, pronouns, role, languages, accessibility description |
| `story` | Desire, wound, secret, voice, arc, first meeting, story reactions |
| `world` | Home, schedule, traits, starting mood, goals, relationships |
| `presentation` | Archetype, procedural appearance, model, materials, attachments |
| `movement` | Style, speed, animation mapping, fallback states |
| `combat` | Shared weapon preferences and NPC combat values |
| `playable` | Selector copy, ratings, camera, collider, passive, signature |
| `network` | Replication preset and permitted role-state fields |
| `production` | Release state, content version, ownership, licence, QA status |

An ordinary resident does not need empty playable fields. A playable hero must pass stricter validation before release.

### 3.3 JSON authors content; SQLite remembers events

| Authored, versioned content | Dynamic, persistent state |
| --- | --- |
| Name and role | Health and energy |
| Biography and voice | Mood and current goal |
| Home and schedule definition | Current location and activity |
| Appearance and model contract | Trust and fear |
| Abilities and ratings | Memories |
| Starting relationships | Changed relationships |
| Story hooks and reactions | World-event consequences |
| Licence and release state | Player-specific unlocks, if added later |

The server may cache a resolved character definition in SQLite for diagnostics, but the repository data remains authoritative.

### 3.4 Static and live modes use the same catalog

Sky Room must remain playable without the Living World server.

- Static mode loads the versioned character registry and packages over HTTP.
- Live mode loads the same files on server startup.
- The server sends changing world state keyed by character ID.
- The client joins authored content and dynamic state by ID.
- A server snapshot never needs to resend full biographies, asset paths, or animation contracts.

### 3.5 Release state replaces scattered allowlists

Each character has an explicit lifecycle:

| State | Behaviour |
| --- | --- |
| `draft` | Authoring only; excluded from production UI and networking |
| `review` | Available in a query-gated preview and QA tools |
| `active` | Discoverable by every approved consumer |
| `hidden` | Valid and loadable for old saves, but not offered for new selection |
| `retired` | Preserved for compatibility and migration; never silently deleted |

Separate capability flags decide whether an active character is a world resident, story actor, or playable hero. No client or server maintains its own ID allowlist.

---

## 4. Proposed data layout

The recommended layout is one small registry plus one folder per character:

```text
data/characters/
  registry.json
  archetypes.json
  schemas/
    character.schema.json
    registry.schema.json
  resident-01/
    character.json
  resident-02/
    character.json
  ...
  resident-20/
    character.json
```

Assets remain in the existing asset folders:

```text
assets/models/characters/<slug>/
assets/images/characters/<slug>.svg
```

### Why not one giant file?

The current single JSON file is convenient at 20 residents, but it creates frequent merge conflicts and makes a complete playable record unwieldy. Per-character packages give each person a clear home and let story, design, and asset work happen without editing one large roster file.

The registry is necessary because a browser cannot discover files by listing a directory. It contains only ordering, package paths, stable IDs, release states, and capability summaries. Complete identity and gameplay data stays in each package.

### Why not one JavaScript manifest?

Character content should not require code syntax or a JavaScript deployment decision. JSON can be validated, read by both browser and Node, diffed cleanly, and edited by non-programmers.

---

## 5. Character package contract

The following is a planning shape, not implementation code. Exact field names should be frozen during Phase 1.

### 5.1 Header and identity

- Schema version
- Stable character ID
- Immutable slug
- Release state and content version
- Capability flags: resident, story actor, playable
- Localised display name, role, tagline, biography, and accessibility description
- Pronouns or form-of-address rules where relevant
- Search tags for authoring tools only

### 5.2 Story card

Every active named character should answer:

- **Dramatic function:** Why does the story need this person?
- **Outer desire:** What are they trying to achieve tonight?
- **Inner need:** What truth must they accept?
- **Wound:** What happened before the player met them?
- **False belief:** What mistaken idea drives their behaviour?
- **Secret:** What do they know or hide?
- **Cost of failure:** What changes if the player does nothing?
- **First meeting:** Place, situation, and emotional temperature.
- **Arc beats:** Introduction, pressure, choice, consequence, resolution.
- **Voice rules:** Sentence rhythm, vocabulary, humour, forbidden tones.
- **Relationship seeds:** Affinity, trust, obligation, conflict, and a short reason.
- **World reactions:** Lines or reaction keys for rescue, injury, corruption, restoration, and major choices.

This card gives an LLM or a human writer useful constraints without letting generated dialogue rewrite canon.

### 5.3 World component

- Home and allowed destinations from the shared room registry
- Occupation and schedule template
- Starting activity and goal
- Curiosity, sociability, courage, energy, and other bounded traits
- Starting relationship seeds
- Services or room functions the character operates
- Spawn and absence rules
- Optional event hooks, expressed as known event keys

World behaviour should refer to shared schedule, room, activity, and event definitions. A character record must not contain executable scripts.

### 5.4 Presentation component

- Procedural archetype and per-character overrides
- Thumbnail and fallback colours
- Optional model and animation-library paths
- Authored and gameplay forward axes
- Scale and measured bounds
- Semantic attachment anchors
- Material rules
- Asset budgets and measured metrics
- Licence/provenance record
- Fallback behaviour when assets fail

Every imported model uses semantic attachment names such as `lantern`, `rightHand`, or `effect`. Shared systems never learn the model's bone names.

### 5.5 Playable component

- Role key and selector ordering
- Bilingual selector copy
- Difficulty and ratings
- Passive ability key and tuning
- Signature ability key and tuning
- Optional primary-weapon override
- Camera profile
- Shared collider profile
- Required animation states and explicit fallbacks
- Availability rules

Ability data selects a registered behaviour. It does not embed arbitrary code. Adding a character with an existing ability family should require data only. Adding a genuinely new mechanic will still require a separately reviewed gameplay implementation.

This distinction is important:

> **A new character should usually be data work. A new game mechanic is still code work.**

### 5.6 Production component

- Content owner and review owner
- Licence status and source record
- Story review status
- Art review status
- Gameplay review status
- Network review status
- Accessibility review status
- Last validated schema version
- Known limitations

The release state can become `active` only when the required gates for its capabilities pass.

---

## 6. Registry and resolver responsibilities

The registry should be deliberately small. Its job is discovery, not authorship.

For every package it records:

- Character ID
- Slug
- Package path
- Release state
- Capability summary
- Sort order
- Minimum supported schema version

A shared resolver then:

1. Loads the registry.
2. Rejects duplicate IDs, slugs, and paths.
3. Loads each eligible package.
4. Validates the base contract.
5. Resolves archetype defaults.
6. Validates capability-specific requirements.
7. Verifies cross-character references.
8. Produces immutable runtime views for each consumer.

Recommended views:

- `allCharacters`
- `activeResidents`
- `activePlayableCharacters`
- `storyActors`
- `characterById`
- `networkCharacterSummary`
- `resolvedWorldSeed`

These views are derived from the same resolved catalog. They are not separately maintained lists.

---

## 7. Living World backend design

### 7.1 Startup sequence

On server start:

1. Load and validate the character catalog before opening the port.
2. Compare the catalog content version with the stored definition version.
3. Insert new active residents without resetting existing world history.
4. Update authored fields that are safe to refresh.
5. Preserve dynamic state, memories, relationships, health, trust, and fear.
6. Mark hidden or retired residents without deleting their history.
7. Reject invalid active packages with a clear path and field error.
8. Expose the catalog version through health diagnostics.

### 7.2 Database direction

Keep or migrate toward these ownership boundaries:

| Storage area | Owns |
| --- | --- |
| Character definition cache | Resolved authored snapshot and content version |
| Character world state | Location, health, energy, mood, activity, goal |
| Character memories | Episodic events and importance |
| Character relationships | Current affinity, trust, fear, and last change |
| Character migrations | Applied content/data migration IDs |

New authored relationship seeds apply only when the relationship does not already exist, unless an explicit migration says otherwise.

### 7.3 Safe update rules

- Renaming a character updates display data, not identity.
- Changing a home updates future scheduling but does not teleport the character during an active session.
- Changing starting traits does not overwrite a mature world's evolved values.
- Removing a character from the active roster hides or retires them; it does not cascade-delete memories.
- Changing an ID requires an explicit migration map and is otherwise forbidden.
- A failed catalog validation leaves the existing database untouched.

### 7.4 API direction

The first implementation can preserve the existing `/api/world` shape. A later read-only catalog API may provide:

- Catalog version and health
- Public character summaries
- One public character detail record

The server must filter production-only fields. Local filesystem paths, internal review notes, private writing notes, and licence work notes do not belong in public API responses.

---

## 8. Storyteller authoring workflow

Adding a character should feel like casting a new actor, not filling a spreadsheet.

### Step 1 — State the empty space

Before naming the character, write one sentence:

> “The story needs someone who can ________, but who is afraid that ________.”

If the character does not create a new relationship, dilemma, point of view, or play style, improve an existing character instead.

### Step 2 — Write the story card

Complete the dramatic function, desire, need, wound, false belief, secret, first meeting, arc beats, voice rules, and relationship seeds.

### Step 3 — Choose capabilities

Decide whether the person is:

- A persistent resident
- A story actor
- A playable hero
- Any valid combination of these

Do not make a character playable only because a model exists. Playability needs a clear player promise and a distinct contribution that does not gate shared objectives.

### Step 4 — Attach existing systems first

Choose existing:

- Archetype
- Schedule template
- Room destinations
- Procedural body
- Shared weapons
- Ability family
- Animation fallback policy

Create new mechanics only when the story and player promise cannot be expressed with existing systems.

### Step 5 — Add presentation

Start with a thumbnail and procedural fallback. A final imported model may arrive later without blocking the character's data, story review, or Living World appearance.

### Step 6 — Validate in draft

The package stays `draft` until schema, story references, assets, licences, and ID uniqueness pass.

### Step 7 — Preview in review

The `review` state enables query-gated selector, model, animation, dialogue, and world previews without exposing the character to ordinary players.

### Step 8 — Activate once

Changing one release state to `active` makes the character discoverable by every capability it owns. No JavaScript array, server allowlist, or HTML option is edited.

---

## 9. Target “add a character” experience

After the backend is complete, the normal workflow should be:

1. Run a future character scaffolding command and reserve the next stable ID.
2. Edit one new `character.json` package.
3. Add the thumbnail and optional model assets.
4. Add one entry to `registry.json`.
5. Run the character validation command.
6. Open the character preview route.
7. Change release state from `review` to `active`.

For a procedural resident using existing behaviours, this should require no gameplay code changes.

For a playable hero using existing abilities and animation states, this should require no roster, UI, network, or server code changes.

For a character introducing a new ability or world activity, only that new reusable behaviour is implemented in code; the character still joins the game through the same package.

---

## 10. Validation and failure messages

Validation should be layered so errors are useful to writers, artists, and engineers.

### Base contract

- Unique stable ID and slug
- Valid schema and content versions
- Valid release state
- Required English and Traditional Chinese player-facing fields
- No references to missing characters, rooms, schedules, activities, or abilities
- No production path outside approved asset roots

### Resident contract

- Valid home and schedule
- Bounded traits
- Valid relationship seeds
- Valid procedural fallback
- Safe initial world state

### Playable contract

- Selector identity and ordering
- Role, ratings, passive, signature, and tuning
- Shared collider fairness
- Camera contract
- Required animation states or explicit fallbacks
- Multiplayer-safe replicated state
- Thumbnail and accessibility description

### Imported-model contract

- Asset files exist and are valid glTF 2.0
- Animation clips resolve
- Semantic attachments resolve
- Bounds and forward axes are explicit
- Material and texture limits pass
- Recorded metrics match actual assets
- Licence record exists

### Cross-system contract

- Every active playable character is accepted by local play and network authority through the derived roster.
- Every active resident can be seeded or synchronized without losing existing state.
- Every settings and selector choice is generated from the resolved catalog.
- Hidden and retired IDs remain loadable for old settings and saves.
- Static mode and live mode resolve the same catalog version.

Errors should name the character, file, field, expected rule, and actual value. “Invalid character” is not sufficient.

---

## 11. Migration plan

### Phase 0 — Freeze the contract

**Purpose:** Agree on ownership before moving data.

- Inventory every current character consumer.
- Freeze stable IDs and slugs for the existing 20 residents.
- Decide required bilingual fields and release states.
- Decide the supported schedule, room, ability, weapon, and animation keys.
- Document which current fields are canonical and which are duplicated.
- Record the current catalog and database versions.

**Exit:** One approved field dictionary and migration map; no runtime changes.

### Phase 1 — Create the catalog structure

**Purpose:** Establish one complete package format.

- Define registry and character schemas.
- Split archetypes from individual packages.
- Move all 20 residents into per-character packages without changing behaviour.
- Merge playable manifest content into the relevant packages.
- Preserve procedural fallback defaults.
- Add reference validation and human-readable diagnostics.

**Exit:** The new catalog resolves to the same current character values.

### Phase 2 — Build one shared resolver

**Purpose:** Stop consumers from interpreting character data differently.

- Provide one resolution algorithm for browser and Node.
- Resolve archetypes, defaults, capabilities, release state, and references.
- Produce derived resident, playable, story, and network views.
- Fail closed for invalid active content and fail safely to procedural presentation for missing optional assets.

**Exit:** Static and server environments produce matching catalog snapshots.

### Phase 3 — Replace manual rosters

**Purpose:** Make activation truly single-source.

- Generate the character selector from active playable packages.
- Generate settings choices from the same view.
- Replace local and remote playable ID arrays.
- Replace server character allowlists.
- Replace the Living World hardcoded seed list.
- Move villager model overrides into presentation components.
- Preserve `mercury-xbot` either as a valid special character package or a clearly separate QA-only avatar.

**Exit:** Adding an existing-system character requires no roster edits.

### Phase 4 — Migrate Living World ownership

**Purpose:** Separate authored definitions from evolving state.

- Synchronize new residents non-destructively.
- Track catalog and per-character content versions.
- Add explicit migrations for renamed fields or changed IDs.
- Preserve memories and relationships for hidden or retired characters.
- Add startup health diagnostics and transaction rollback on invalid content.

**Exit:** Catalog updates cannot silently reset a world.

### Phase 5 — Improve authoring tools

**Purpose:** Make the safe path the easy path.

- Add a scaffold command that reserves an ID and creates a draft package.
- Add schema autocomplete or an editor-friendly schema reference.
- Add a catalog summary command.
- Add a query-gated draft/review selector.
- Extend the model viewer to load a package by ID.
- Provide a release-readiness report for writers, artists, and engineers.

**Exit:** A non-engineer can prepare a procedural resident package and receive actionable validation feedback.

### Phase 6 — Prove the workflow

Use two pilots:

1. **Kael Morrow migration pilot:** Resolve the existing local/network/persistence drift and stale asset metric through the new single source.
2. **One new procedural resident:** Add a new person with existing archetype, schedule, room, weapon, and reactions without modifying runtime code.

Then test one imported playable hero using existing ability families.

**Exit:** The target workflow succeeds in static, live, selector, multiplayer, reconnect, and old-save scenarios.

---

## 12. Recommended implementation order

Do not start by changing SQLite or deleting the existing manifest.

The safest order is:

1. Approve the schema and ownership rules.
2. Build the new catalog beside the existing files.
3. Prove that its resolved output matches current behaviour.
4. Move read-only consumers one at a time.
5. Move the server seed and persistence synchronization after catalog parity.
6. Remove old lists only when automated checks prove no production consumer still reads them.

During migration, the old and new systems may coexist briefly, but one comparison test must fail whenever their resolved values differ.

---

## 13. Risks and guardrails

| Risk | Guardrail |
| --- | --- |
| A giant “universal” schema becomes hard to author | Use optional capability components and small required cores |
| Writers accidentally control executable behaviour | Packages select registered keys; they do not contain scripts |
| Archetype changes unexpectedly alter every character | Version archetypes and snapshot resolved changes in review reports |
| Catalog update resets Living World personalities | Never overwrite evolved dynamic state without an explicit migration |
| Removed character breaks old saves | Use hidden/retired states; never silently reuse IDs |
| Imported model blocks character creation | Procedural fallback and thumbnail-first workflow |
| Network accepts a character the client cannot render | Both derive from the same active playable view and catalog version |
| Static and live modes disagree | Snapshot parity test across browser and Node resolvers |
| Story fields become decorative and unused | Require story reaction keys in relevant scenes and authoring reports |
| New hero introduces hardcoded branches | Ability and event registries use reusable keys, never character names |
| Merge conflicts return in the registry | Keep registry entries tiny and sort them by stable order |

---

## 14. Definition of done

The character data backend is complete when all of the following are true:

- There is one canonical package for every current character.
- Names, roles, biographies, colours, abilities, assets, and world identity are not independently duplicated.
- A new procedural resident can be added through one package and one registry entry.
- A new playable hero using existing mechanics requires no edits to UI, local, multiplayer, or server roster arrays.
- The Living World discovers new residents without resetting existing histories.
- Static and live modes resolve the same authored catalog.
- Draft and review characters can be previewed without appearing in production.
- Hidden and retired characters remain compatible with old saves.
- Invalid IDs, references, assets, animations, licences, or metrics fail with clear diagnostics.
- Character selection, settings, remote presence, server validation, and persistence all derive from capability views.
- The full existing roster passes migration parity checks.
- Kael Morrow is either consistently active across all intended systems or explicitly marked unavailable in the package.
- One genuinely new procedural resident is added without runtime code changes.
- Documentation contains a five-minute “add a character” path.

---

## 15. Decisions to approve before implementation

Recommended defaults are shown here so implementation does not begin with unresolved ownership:

1. **Canonical source:** Versioned JSON character packages in the repository.
2. **Runtime database:** SQLite stores changing world state; authored definitions are synchronized/cacheable, not hand-edited there.
3. **Identity model:** One character entity with optional resident, story, and playable components.
4. **Compatibility:** Preserve all existing `resident-XX` IDs.
5. **Discovery:** One small registry points to per-character packages.
6. **Activation:** Release state plus capability flags replaces hardcoded rosters.
7. **Localisation:** English and Traditional Chinese remain required for player-facing playable content; explicit fallback rules apply to lower-priority resident copy.
8. **Models:** Procedural fallback is mandatory even when an imported model exists.
9. **Abilities:** Packages select registered reusable behaviours; new mechanics receive separate code review.
10. **Deletion:** Characters are hidden or retired, never casually removed or renumbered.
11. **First migration pilot:** Kael Morrow, because his current records expose the exact roster and asset-metric drift this backend is meant to prevent.

---

## Final direction

The best backend for Sky Room is not a larger database and not another manifest. It is a disciplined character content pipeline:

> The storyteller defines a person.  
> The designer defines how that person lives and plays.  
> The artist defines how that person appears.  
> One validated package joins those truths.  
> Every game system reads the same identity.

That structure makes adding characters easier while protecting the thing that matters most: each new lantern should feel like it was always part of this world.
