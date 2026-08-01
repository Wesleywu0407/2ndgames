# Sky Room — Complete Game Director Plan

## Document status

**Status:** Active production roadmap. Implementation is authorized phase by phase.

**Purpose:** Turn the current collection of strong systems into a complete, readable, challenging game with dependable camera control, dangerous enemies, buildings that visibly suffer and recover, legible UI, and rooms worth entering.

**Implementation rule:** Change only the active phase, verify its acceptance tests, then update this document before beginning the next phase.

**Character-work boundary:** Claude-owned character assets, identity, silhouette, animation files, and authored presentation remain protected. The stable Aldous delivery is integrated only through manifest metadata, semantic runtime anchors, explicit fallbacks, budgets, and automated verification.

### Approval and implementation ledger

| Phase | Approval | Implementation | Ownership note |
| --- | --- | --- | --- |
| Phase 0 — Baseline | Approved as production support | Active alongside Phase 1 | Read-only measurement and documentation; no character assets |
| Phase 1 — View and camera | Approved | **Code-complete · manual QA pending** | Camera controller, collision, selective occlusion, input, settings, camera QA |
| Phase 2 — Enemy combat | Approved | **Complete · verified 2026-07-16** | Enemy state/authority and combat tuning; character-agnostic |
| Phase 3 — Building fire | Approved | Complete and verified | Building state, fire, rescue, restoration |
| Phase 4 — UI/UX | Approved | **Complete · verified 2026-07-16** | Readability, hierarchy, scaling, accessibility |
| Phase 5 — Rooms | Approved | **Implementation + multiplayer parity complete · physical performance sign-off pending 2026-07-17** | Shared rooms, refuge, investigation, rescue, training, recipes and message routes |
| Phase 6 — Integrated mission | Approved through existing Siege direction | **Feature-complete · manual pacing/LAN acceptance pending 2026-07-17** | Reuses authoritative Siege, fire, rescue, room and restoration contracts |
| Phase 7 — Final QA | Approved | **Code + automated matrix complete · physical device/LAN/playtest acceptance pending 2026-07-17** | Accessibility, effect budgets, migration, network recovery and combined-load QA |

The approved default decisions are: ground/flight/indoor camera profiles; behaviour-driven difficulty; recoverable scorching; authored fire zones; flexible solo/co-op roles; high-readability UI; and the Great Hall as the first completed building.

---

## 1. Director's diagnosis

Sky Room already has atmosphere, movement, a campus, combat effects, LAN co-op, Story chapters, Siege foundations, and memorable visual language. The problem is not a lack of ideas. The problem is that several systems do not yet support one another consistently.

The game currently makes five promises it does not always keep:

1. **“The player can see and control the action.”** Camera behaviour changes between ground, flight, browser modes, buildings, and overlays. A beautiful world is lost if the player cannot comfortably frame it.
2. **“The enemy is dangerous.”** Enemy visuals suggest threat, but aggression and player damage are limited to narrow phase conditions. Later enemies can appear without being able to complete an attack against the player.
3. **“The campus is truly under attack.”** Siege damages ward numbers and darkness states, but the buildings themselves do not visibly ignite, evacuate, deteriorate, or recover.
4. **“The interface communicates clearly.”** Important information competes in the same corners, while several labels use very small type, wide letter spacing, low opacity, and weak backing surfaces.
5. **“Buildings are places, not scenery.”** The campus exterior is promising, but the room experience needs consistent entrances, camera rules, interiors, activities, residents, and restoration states.

My director decision is to stop adding breadth temporarily. We should make the existing campus loop excellent before adding more chapters, enemies, buildings, or modes.

---

## 2. The new completion target

### Working milestone: **The Campus Under Siege**

Build one polished 30–45 minute session that proves the whole game:

```text
Walk through a readable campus
  → enter a functional room
  → receive a clear threat
  → fight enemies that can genuinely attack
  → see a building catch fire under pressure
  → rescue or defend its residents
  → extinguish the memory-fire
  → enter the damaged room
  → restore the building
  → see its lights, residents, and activities return
```

If this loop is good, Story, Siege, co-op, and future chapters can all reuse it. If this loop is weak, more content will only create more unfinished surfaces.

### Release-quality player promise

> I always understand where I am, what is threatening me, what is happening to the campus, and what action can improve the situation.

---

## 3. Non-negotiable design principles

- Walking remains the default grounded experience; flight is deliberate and responsive.
- The first story flight may be ceremonial. Repeat takeoff must stay fast.
- Enemies must be able to detect, telegraph, attack, damage, pursue, recover, and disengage reliably.
- Difficulty should come from enemy decisions, combinations, pressure, and space—not giant health bars.
- A building attack must be visible on the building, audible nearby, and meaningful inside its rooms.
- Fire is recoverable in the first implementation. Buildings may become scorched or dark, but they do not permanently disappear.
- Important words must remain readable during movement, combat, fire, bloom, and four-player effects.
- Rooms must have a gameplay purpose. No room exists only to contain furniture.
- Solo and 1–4 player co-op must use the same objective logic.
- No specific hero or new Claude character may be required to finish a core objective.
- Accessibility settings never reduce rewards.

---

## 4. Recommended production order

| Order | Workstream | Why it comes here |
| --- | --- | --- |
| 1 | View, camera, and spatial readability | Every later system is difficult to judge through an unreliable camera. |
| 2 | Combat threat and enemy difficulty | The player must believe enemies can hurt them before campus danger has meaning. |
| 3 | Building attack, fire, rescue, and recovery | Converts abstract Siege health into visible stakes. |
| 4 | UI/UX readability rebuild | Presents the more complex combat and building states clearly. Early rules are set in Phase 0; full pass follows the real gameplay. |
| 5 | Rooms and building completion | Gives damaged and restored buildings meaningful interior consequences. |
| 6 | Integrated mission vertical slice | Proves the systems as a game rather than separate demos. |
| 7 | Accessibility, performance, network, and playtest polish | Makes the complete loop shippable. |

UI emergency fixes that block testing may be handled with Phase 1, but the full HUD redesign should be validated against real combat and fire states in Phase 4.

---

## 5. Phase 0 — Baseline, ownership, and measurable targets

**Phase status:** [~] Automated baseline complete · media capture and physical soak evidence pending

### Director decisions

- [ ] Record a clean five-minute ground and flight camera test at desktop and laptop aspect ratios.
- [x] Record every current enemy from spawn through attempted player hit through the repeatable Stray, Groundskeeper and Bell Warden combat suite.
- [x] Measure ideal all-hit time-to-kill for Stray, Groundskeeper, and Bell Warden with all three weapons. The immutable 3×3 baseline is generated by `scripts/qa-combat-balance.mjs`.
- [~] Record one complete local and LAN Siege wave. Deterministic full-wave server flow and live combined-load excerpts pass; a physical LAN recording remains.
- [~] Inventory every current exterior, entrance, interior, room collider, camera obstruction, and unreachable surface. Finished-room volumes, anchors, sockets and collider broadphase are inventoried; the physical unreachable-surface walk remains.
- [~] Capture every HUD, lobby, clue, vote, Dimmed, settings, weapon, objective, mobile, and Siege screen. Automated DOM contracts and representative live states pass; the final visual contact sheet remains.
- [x] Create a shared bug vocabulary: blocker, combat failure, readability failure, visual defect, polish issue.
- [x] Define file ownership while Claude's character work is in progress.
- [x] Freeze new gameplay features until Phases 1–3 pass their acceptance tests. The gate has expired because those implementation gates now pass; new work is limited to plan acceptance and fixes.

### Required measurements

- [~] Establish current average and p95 frame time for balanced and performance presets. Automated/in-app measurements exist; physical Mac GPU measurements for both presets remain.
- [x] Establish current minimum readable text size and contrast failures through the Phase 4 typography/contrast contract and live 100–150% sweep.
- [~] Establish current enemy hit success against stationary and moving players. Deterministic ground, flight and dodge scenarios pass; a physical player sample remains.
- [x] Establish current camera collision and occlusion failure locations through straight wall, rotated wall, tree, six entrances and material-fade probes.
- [x] Establish current building state synchronization behaviour for two clients; the server matrix now extends this through four independent players and late join.

### Phase 0 verification

- [x] Every implemented Director Plan problem has a query-gated scene, deterministic script, or documented physical acceptance sequence.
- [x] Character work and systems work have no overlapping file ownership. Phase 1 uses the camera controller/settings plus new camera-only files; Claude retains character assets, identity, animation, and character presentation.
- [x] The milestone and Phase 1–7 order were approved sequentially before this implementation run.

### Shared bug vocabulary

- **Blocker:** the player cannot enter, resume, leave, reconnect, or reach a required outcome.
- **Combat failure:** authority, hit, damage, telegraph, visibility, recovery, or difficulty makes combat invalid rather than merely mistuned.
- **Readability failure:** required text, state, danger, prompt, route, or objective cannot be perceived in a supported layout or accessibility mode.
- **Visual defect:** presentation is visibly wrong but progression and required information still work.
- **Polish issue:** timing, animation, sound, spacing, or feedback can improve without repairing a broken contract.

The recorded ideal all-hit TTK baseline in seconds is: Stray `3.0 / 3.6 / 6.8`, Groundskeeper `9.3 / 10.8 / 20.1`, and Bell Warden `47.7 / 54.9 / 101.8` for Ember / Scatter / fully charged Moonbow respectively. These are reproducible balance measurements, not an aim-skill playtest substitute.

---

## 6. Phase 1 — View, camera, and spatial readability

**Phase status:** [~] Code-complete · physical hardware and soak sign-off pending

### 6.1 Camera modes

- [x] Define three explicit camera profiles: ground shoulder, flight chase, and indoor room.
- [x] Keep one consistent horizontal sensitivity model across all profiles.
- [x] Support full 360° yaw without screen-edge traps.
- [x] Make Pointer Lock and non-Pointer-Lock edge/drag fallback equally usable.
- [~] Preserve heading when taking off, landing, entering a room, reviving, and leaving a modal. These transitions no longer write yaw and stationary recenter explicitly preserves it; a live transition sweep remains after the local browser reconnects.
- [x] Play the full first-flight ritual only once per story introduction.
- [x] Use responsive repeat takeoff after landing.
- [x] Add a short, optional camera recenter action rather than automatic forced rotation. `T`, R3 and the touch `↻` button request a 0.24-second recenter; fresh look input cancels it.
- [x] Add invert-Y and separate ground/flight sensitivity options.
- [x] Add a standard gamepad path: left stick movement, right stick look, A/Cross takeoff and rise, B/Circle landing and descent, Y/Triangle view change.

### 6.2 Camera collision and occlusion

- [x] Replace camera penetration with a swept camera collision check.
- [~] Prevent walls, roofs, trees, characters, roots, and burning VFX from fully covering the player. World colliders, non-instanced blockers, and Phase 3 fire/smoke opacity budgets are covered; the remaining physical input soak tests still gate Phase 1 sign-off.
- [x] Fade only the obstruction between camera and player; shared materials are cloned temporarily so the rest of a room or building never fades with it.
- [x] Keep the camera outside ceilings and beneath-world geometry represented by world colliders.
- [x] Add indoor distance limits so small rooms do not become extreme close-ups.
- [x] Prevent camera shake from pushing the view through a wall.
- [x] Reduce camera displacement automatically when geometry leaves insufficient camera space.

### 6.3 Spatial composition

- [x] Place important objectives within readable approach angles from the ground route through authored approach paths, room entrances and bounded interaction layouts.
- [x] Add entrance lighting and silhouettes that remain clear without HUD arrows; every side room has a named sign, warm/role-coloured door glow, arch and branch paving.
- [x] Stop oversized architecture, tree crowns, or effects from blocking the objective at spawn/checkpoint positions through swept collision, selective occlusion and bounded smoke/fire opacity.
- [x] Define safe camera volumes for every finished room in the shared room registry and verify all six with the registry/entrance probes.
- [x] Verify ultrawide, 16:9, 16:10, and narrow laptop views. Browser verification passed at 1280×720, 1366×768, 1440×900, and 2560×1080.

### Phase 1 verification

- [~] A player can rotate 720° in both directions on ground and in flight without losing control. Yaw is deliberately unbounded and shortest-angle recenter wrapping passes; the sustained physical sweep remains.
- [x] Landing and immediate repeat takeoff never replay the long ritual.
- [~] No approved story checkpoint begins with the camera inside an object. Authored room entrances and camera sweeps pass; the final full-story checkpoint recording remains.
- [x] The player remains visible during every current building entrance transition. The repeatable QA sweep passed the Great Hall, Moon Archive, Alchemist's Workshop, Moon Infirmary, Practice Hall, and Owl Post.
- [ ] Ten minutes of movement produces no stuck cursor, involuntary camera reset, or unrecoverable angle.
- [~] Mouse, trackpad, controller, and touch each have a complete test path. Mouse and touch-look pass live; controller mapping/deadzone/button edges pass deterministic QA. A physical gamepad/trackpad pass and sustained touch-stick hold remain.

### Phase 1 implementation record — 2026-07-16

- Added a swept segment camera collision module for rotated boxes and cylindrical obstacles.
- Added ground-shoulder, flight-chase, and indoor-close profiles with a live `data-camera-profile` QA signal.
- Added separate ground/flight sensitivity plus invert-Y settings with persistence.
- Kept the existing one-time first-flight ritual and verified that landing returns to walking and repeat takeoff is immediate.
- Added repeatable camera collision QA covering clear paths, straight walls, rotated walls, and trees.
- Added standard gamepad movement and camera support with a repeatable deadzone/button-edge QA test.
- Added a player-requested camera recenter on keyboard, standard gamepad and touch. The pure heading QA verifies shortest-angle wrap, stationary heading preservation, movement alignment and separate neutral ground/flight pitch.
- Added a QA-only entrance sweep covering the Great Hall and all five current side-building interiors.
- Added selective mesh occlusion fading with isolated material cloning and automatic restoration.
- Added a QA-only fade probe; live result faded one blocker to 0.162 opacity and restored its original material to 1.0.
- Verified the live game at 1280×720, 1366×768, 1440×900, and 2560×1080 with no browser console errors.
- Verified touch drag-to-look in the live mobile-control layout.
- Performance probe after occlusion: 60 average FPS, 16.9 ms p95 frame time, 685 draw calls, and no runtime warnings at Balanced quality.
- Remaining before Phase 1 sign-off: physical gamepad/trackpad pass, sustained touch-stick hold, and ten-minute free-look soak test.

---

## 7. Phase 2 — Enemy threat, attacks, and difficulty

**Phase status:** [x] Complete · verified 2026-07-16

### 7.1 Fix the authority and phase problem

- [x] Define which Story, Siege, room, and boss phases permit enemy aggression. Story Stray combat, Siege waves, and the Black Garden boss are active; menus, clue boards, safe rooms, and completed story beats are protected.
- [x] Remove accidental phase gates that leave visible enemies unable to seek or attack.
- [x] Route all valid local enemy hits through one player-damage contract.
- [x] Keep Dimmed, revive, solo rekindle, checkpoint, and invulnerability windows consistent. Post-hit time follows difficulty; rekindle grants one second; nearby revive, remote-revive rejection, and full-party checkpoint recovery are server-tested.
- [x] Make the server authoritative for shared encounter health, enemy target selection, and major hits where required. Per-lantern tutorial Strays remain intentionally local; shared Groundskeeper health, range validation, party scaling, phases, and checkpoints are authoritative.
- [x] Ensure late joins and reconnects receive active enemy and encounter state, including shared boss HP and stage.

### 7.2 Complete enemy state machines

Every combat enemy must support:

```text
Dormant
  → Suspicious
  → Acquire target
  → Telegraph
  → Attack
  → Hit or miss
  → Recovery
  → Reposition
  → Repeat, retreat, stagger, or defeat
```

- [x] Give every state a readable procedural pose, spatial sound, timing window, and exit condition.
- [x] Prevent enemies from remaining in drift, windup, dive, stagger, or retreat indefinitely for the current Stray/Groundskeeper/Bell Warden state loop.
- [x] Add reliable ground-player targeting as well as flight-player targeting.
- [x] Add navigation recovery when an enemy is blocked by architecture.
- [x] Prevent attacks through solid walls and closed doors.
- [x] Prevent enemies from stacking inside one another.
- [x] Give enemies a brief spawn protection against immediate off-screen deletion.

### 7.3 Difficulty without health sponges

- [x] Establish Story, Normal, and Warden difficulty presets.
- [x] Keep Normal as the intended director experience and the default setting.
- [x] Tune Strays to pressure movement through speed, lateral flanking, readable rushes, and recovery timing.
- [x] Tune Groundskeepers to control ground space and punish stationary casting through a heavy rush plus the Black Garden's telegraphed root rings.
- [x] Tune Bell Wardens through a second stage, two summoned Strays, increased tempo, and arena pressure.
- [x] Scale party encounters through simultaneous decisions and attack coverage before adding health. The attack-budget system caps concurrent commitments independently of enemy count.
- [x] Limit enemy hit-stun chaining with archetype-specific stagger cooldowns.
- [x] Add behaviour changes to repeated weapon use rather than arbitrary armour: four repeated hits trigger repositioning, while switching weapons reopens stagger and Catalyst synergy.
- [x] Make Moonbow powerful but punish missed charged shots through draw time and recovery cooldown.
- [x] Make Scatter strong at close range without deleting major enemies in one burst.

### Recommended Normal targets

| Enemy | Intended threat | Recommended effective defeat time |
| --- | --- | --- |
| Stray | Fast pursuit and one readable rush | 4–7 seconds when fought correctly |
| Groundskeeper | Ground control, roots, forced reposition | 18–30 seconds |
| Bell Warden | Multi-stage encounter, adds, arena pressure | 90–150 seconds |

These are encounter targets, not promises to inflate HP. Recovery windows, positioning, and missed attacks count toward the time.

### 7.4 Combat readability

- [x] Show attack direction before damage.
- [x] Use shape, motion, sound, and colour together for telegraphs.
- [x] Add a clear player hit response without hiding the next incoming attack.
- [x] Distinguish damage, stagger, cleanse, shield, and invulnerability through existing combat effects, emissive hit response, role mitigation, sound, and recovery timing.
- [x] Cap overlapping warning rings through the concurrent attacker budget; the closest enemies reach wind-up first.
- [x] Preserve readable remote projectiles for friends.

### Phase 2 verification

- [x] Every enemy archetype successfully damages a stationary player in its approved encounter.
- [x] Every enemy can miss a moving player through skillful dodging.
- [x] A grounded player and a flying player can both be threatened.
- [x] No normal enemy is killed before it completes at least one readable decision unless the player uses a high-skill counter.
- [x] Two- and four-player difficulty adds pressure without quadrupling effective health. Four-player Normal uses three committed attackers and 1.36× health.
- [x] Full-party Dimmed and checkpoint recovery work during every new encounter type.
- [x] Friendly fire remains off in Story on both client and server.

### Phase 2 implementation record — 2026-07-16

- Replaced the phase-number-only AI gate with an explicit combat context: aggression, respawning, valid target, and concurrent attacker budget.
- Story combat now attacks the player on ground or in flight; Siege waves retain their ward-core objective; menus, clue boards, and safe story phases suppress aggression.
- Added one unified local enemy-damage path with role mitigation, knockback, hit animation, audio, death handling, a 0.65-second post-hit protection window, and a one-second rekindle protection window.
- Raised Normal baseline health from 2.2/5.2/10 to 11/32/160 for Stray/Groundskeeper/Bell Warden and retuned detection, pursuit, dive speed, turn rate, wind-up, collision radius, and damage per archetype.
- Added Story, Normal, and Warden settings with live retuning. Party size raises attack coverage first and health by only 12% per additional lantern.
- Added a concurrent-attack budget: Normal uses one attacker solo and three at four players; Siege always permits at least two. Enemy count therefore increases coverage without making unavoidable hit stacks.
- Added collision-aware line of sight, wall/door hit rejection, body collision, separation, obstacle sliding, and timed path recovery.
- Added Stray flanking, Bell Warden stage-two summons, 0.55-second spawn protection, archetype stagger cooldowns, and repeated-weapon repositioning.
- Added difficulty-based post-hit invulnerability: Story 0.9 seconds, Normal 0.65, Warden 0.48; every rekindle grants one second.
- Added query-gated deterministic combat telemetry and a `TEST ENEMY ATTACK` control.
- Final live browser suite passed 10/10 scenarios with no warnings or errors: all three archetypes hit a stationary player; all three missed a moving player; airborne pursuit hit; an initial wall prevented acquisition; a wall inserted during wind-up cancelled damage and produced path recovery; and a paused safe window recorded zero notices, wind-ups, attacks, or hits.
- Authoritative server QA passed nearby revive at 55 HP, rejected remote revive, full-party checkpoint rekindle, Story friendly-fire rejection, three-player boss scaling, out-of-range boss-hit rejection, valid shared boss damage, and late-join boss HP/state.
- Collision QA passed boxes, rotated walls, cylinders, vertical clearance, and target-edge padding.
- Combat difficulty QA passed relative Story/Normal/Warden timing and four-player non-sponge scaling.
- Final combat LOS broadphase benchmark: 13,440 segment checks against 725 colliders in 439.9 ms total under concurrent QA load, averaging 0.916 ms per simulated 60 Hz frame and remaining below the 1,500 ms budget.

---

## 8. Phase 3 — Buildings under attack: fire, rescue, and recovery

**Phase status:** [x] Complete · verified 2026-07-16

### 8.1 Building damage model

Use a shared state model instead of physics destruction:

| State | Building presentation | Gameplay meaning |
| --- | --- | --- |
| Safe | Normal lights and residents | Full services and routes |
| Threatened | Alarm light, target marks, residents react | Enemies are approaching |
| Igniting | Local sparks and first window fire | Short response window |
| Burning | Roof/window flames, smoke, interior hazards | Rescue and suppression active |
| Critical | Heavy smoke, dark services, blocked route | Building may fall dark |
| Scorched | Fire out, visible damage, reduced activity | Restoration objective available |
| Restored | Repaired materials, lamps, residents return | Services and bonuses return |

- [x] Extend ward state with damage stage, fire intensity, affected sockets, rescue count, and restoration progress.
- [x] Keep the server authoritative for shared building state.
- [x] Save and restore building state at story checkpoints where appropriate.
- [x] Never permanently delete a building in the first implementation.

### 8.2 Visible fire direction

- [x] Author fire sockets at roofs, windows, doors, courtyards, and interior hazard points.
- [x] Begin with localized ignition before covering the whole building.
- [x] Add smoke direction, embers, window glow, soot, alarms, and distance-based audio.
- [x] Make fire intensity match actual building state.
- [x] Prevent flames from appearing detached from geometry.
- [x] Use performance budgets by distance and graphics preset.
- [x] Add reduced-flash and reduced-smoke accessibility alternatives.

### 8.3 Enemy-to-building attacks

- [x] Give attacking enemies physical building target sockets instead of only abstract ward drains.
- [x] Show enemies reaching, charging, or channeling into the building before damage is applied.
- [x] Interrupt building attacks through combat, warding, or rescue actions.
- [x] Ensure enemies cannot damage a building from behind unrelated walls.
- [x] Prioritize threatened buildings consistently for all co-op clients.

### 8.4 Fire gameplay

- [x] Create one universal **Restoration Beam** interaction for suppressing memory-fire.
- [x] Let one player suppress fire slowly; multiple players divide work across sockets.
- [x] Require players to choose between fighting enemies, protecting residents, and suppressing fire.
- [x] Add resident evacuation routes and safe gathering points.
- [x] Add clear rescue state without requiring voice chat.
- [x] Allow a scorched building to be restored after the wave through a calm interaction.
- [x] Make restoration visibly repair lights, colour, ambience, and resident activity.

### Phase 3 verification

- [x] A player can identify which building is threatened without reading a tiny HUD label.
- [x] Building fire begins at a believable attack point and escalates through visible stages.
- [x] Solo players can fight, suppress, and rescue through sequential windows.
- [x] Four players can split responsibilities without any player being forced to wait.
- [x] Late joiners see the correct flames, smoke, residents, ward health, and objective state.
- [x] Extinguishing fire never leaves invisible damage continuing in the background.
- [x] Restored buildings return to the same state for every client.

### Phase 3 implementation record — 2026-07-16

- Server authority covers stage, intensity, sockets, residents, rescue, restoration, impact validation, and per-player action cooldowns.
- SQLite checkpoint `siege_checkpoint_v1` restores ward damage and recovery state after a server restart.
- Visual budgets are capped by graphics preset and distance; reduced-smoke and reduced-flash settings are persisted.
- Automated evidence: server lifecycle/restart QA, four-player parallel-action QA, late-join parity, and the in-browser building-fire suite all pass without console errors.

---

## 9. Phase 4 — UI/UX readability rebuild

**Phase status:** [x] Implemented and verified · ready for Phase 5

### 9.1 Readability rules

- [x] Set normal desktop HUD text to at least 14px.
- [x] Set primary objective and dialogue body text to at least 16px where space permits.
- [x] Keep metadata at 12px or larger; do not use 8–9px for required information.
- [x] Use minimum 4.5:1 contrast for required text.
- [x] Keep primary text opacity at 0.9 or above and secondary required text at 0.75 or above.
- [x] Reduce extreme letter spacing on small text.
- [x] Add solid or blurred backing surfaces behind text over gameplay.
- [x] Never place critical text directly over fire, bloom, bright windows, or black smoke without a backing surface.

### 9.2 Information hierarchy

Only show information needed for the current decision:

1. **Immediate:** health, lethal warning, revive, interaction prompt.
2. **Current objective:** one main instruction and one progress value.
3. **Context:** party, weapon, role ability, building status.

- [x] Remove duplicate instructions shown in objective, hint, story card, and test panel simultaneously.
- [x] Give subtitles a dedicated lower-safe-area container.
- [x] Separate world status, party status, and objective so they cannot overlap.
- [x] Collapse weapon and ability details when not in combat.
- [x] Add a readable building emergency panel during Siege/fire.
- [x] Replace long all-caps labels where normal title case reads faster.
- [x] Keep English and Traditional Chinese layouts independently tuned.

### 9.3 Interaction clarity

- [x] Use one consistent `E` interaction prompt component.
- [x] Show action, target name, distance/progress, and blocked reason when relevant.
- [x] Confirm votes only after the server accepts them.
- [x] Make waiting-for-party states explicit and provide leave/retry guidance.
- [x] Keep QA controls clearly separated from real game UI and never show them without the QA query.
- [x] Provide keyboard, controller, and touch glyph variants.

### 9.4 Settings and accessibility

- [x] Add UI scale presets: 100%, 115%, 130%, and 150%.
- [x] Add high-contrast HUD mode.
- [x] Add subtitle size, speaker label, and background opacity controls.
- [x] Add colour-independent enemy and building threat shapes.
- [x] Add reduced bloom and reduced smoke controls.
- [x] Preserve readable focus indicators and full keyboard navigation.

### Phase 4 verification

- [x] No required game text is below the approved minimum size.
- [x] Objectives remain readable against night sky, fire, smoke, bright interiors, and four-player combat.
- [x] No desktop or mobile HUD elements overlap at supported aspect ratios.
- [x] Traditional Chinese text does not clip or use inappropriate tracking.
- [x] A first-time player can describe health, objective, building danger, and interaction from one screenshot.

### Phase 4 implementation evidence

- Required HUD type now uses 12px metadata, 14px context, and 16px primary floors, with high-opacity ink and blurred dark backings.
- Story subtitles occupy a dedicated lower safe area with configurable size, speaker label, and 60–100% background opacity.
- UI scale presets, high contrast, reduced bloom, reduced smoke, and strong keyboard focus are persisted in local settings.
- A single interaction card reports input glyph, action, target, distance/progress, and blocked state; keyboard, gamepad, and touch variants are supported.
- Siege fire now exposes a colour-independent triangle emergency panel with building name, state, integrity, evacuation, and suppression guidance.
- English and Traditional Chinese were visually checked in the live browser; the automated `scripts/qa-ui-readability.mjs` contract and gamepad QA both pass.

---

## 10. Phase 5 — Rooms and complete buildings

**Phase status:** [~] All six room identities and authoritative completion parity implemented · physical performance sign-off pending

### 10.1 Room production rules

Every finished building requires:

- A readable entrance from the ground.
- A safe flight approach where appropriate.
- A camera transition or threshold profile.
- A complete collision shell.
- Interior lighting with safe performance limits.
- At least one resident activity.
- At least one story, combat, rescue, service, or puzzle purpose.
- Safe, threatened, burning, scorched, and restored presentation where the building can be attacked.
- A clear exit and recovery path.

### 10.2 First building set

Build in this order:

1. **Great Hall** — refuge, story staging, party recovery, large-room camera benchmark.
2. **Moon Archive** — investigation, readable text objects, shelving occlusion benchmark.
3. **Moon Infirmary** — rescue, healing, smoke and visibility benchmark.
4. **Practice Hall** — combat tutorial, enemy navigation, sparring benchmark.
5. **Alchemist's Workshop** — weapon reactions, hazardous props, fire benchmark.
6. **Owl Post** — vertical routes, messages, compact flight benchmark.

### 10.3 Interior architecture

- [x] Create a modular wall, floor, ceiling, column, stair, doorway, window, and prop kit.
- [x] Use threshold streaming or visibility groups so inactive interiors do not consume full rendering cost.
- [x] Keep exterior and interior door positions spatially consistent through the shared room registry.
- [x] Avoid teleporting the player to unrelated coordinates without a deliberate transition.
- [x] Author room-specific camera volumes and collision probes.
- [x] Add shared navigation anchors for residents and enemies.
- [x] Add fire sockets and restoration sockets during room construction, not afterward.
- [x] Prevent decorative props from creating accidental player traps.

### 10.4 Room gameplay identity

- [x] Great Hall: residents regroup, provide a campus briefing, and recover the party inside the refuge.
- [x] Archive: reconstruct three synchronized evidence records and revisit the Archivist's desk.
- [x] Infirmary: stabilize synchronized residents while shared Siege smoke changes routes.
- [x] Practice Hall: three readable lane telegraphs, directional dodges, named counter targets, synchronized completion, and replay service.
- [x] Workshop: ordered multi-weapon reactions, volatile-fume hazard, grounded training casts, synchronized vats, and replay service.
- [x] Owl Post: three synchronized indoor/outdoor message routes, vertical roof checks, route beacons, and replay service.

### Phase 5 verification

- [x] Each finished room has a reason to revisit it after its first story scene.
- [x] Entry and exit work on foot and never require accidental flight exploits.
- [x] Camera, collision, enemy navigation, resident navigation, fire, and restoration pass independently through the shared room registry and dedicated QA contracts.
- [~] Inactive-room draw calls were reduced through threshold visibility, stronger adaptive resolution, 30m resident culling, and lazy Hour-Eater loading. The software-rendered in-app probe remains below the physical-device target, so Mac/Chrome sign-off is still required.
- [x] Authoritative Story snapshots synchronize completed evidence, patients, training, recipes, and mail routes; existing Siege snapshots synchronize building damage/restoration. Late join and invalid/remote action rejection are covered by QA.

### Phase 5 implementation evidence — foundation and Great Hall

- `room-registry.js` is now the single authored source for all six room volumes, entrances, indoor camera profiles, resident/enemy navigation anchors, streaming distances, and fire/restoration sockets.
- Camera room detection, resident scheduled navigation, Great Hall streaming, and the five side-room visibility groups consume the shared registry without changing the established world coordinates.
- The Great Hall now has an explicit refuge identity: three gathered residents, a first-entry campus briefing, an immediate recovery grant, and bounded passive recovery while the player remains inside.
- `scripts/qa-room-registry.mjs` deterministically checks all room IDs, coordinate round trips, gameplay/camera volumes, anchors, streaming values, and socket contracts.
- All six Phase 5 room identities, shared completion snapshots, entry/exit contracts, and revisit loops are implemented. Remaining Phase 5 acceptance is a physical Mac/Chrome performance pass alongside the final project-wide unused-code audit.

### Phase 5 implementation evidence — Moon Archive

- Three readable floating folios now form a spatial investigation: each uses the shared `E` interaction prompt, reports distance/progress, and settles physically onto the reading desk when preserved.
- Preserving all three records reconstructs a non-spoiler conclusion about the Warden, restores a bounded amount of lantern health/signature charge, and leaves the completed evidence visible on the desk.
- The completed Archivist's desk provides a cooldown-limited campus report and small recovery benefit, giving the room a reason to revisit after its first scene.
- Archive shelves retain authored collision and instanced books; the indoor camera continues to use the shared room volume and collision sweep.
- `scripts/qa-archive-room.mjs` verifies evidence order, prompt range, reconstruction rewards, report service, and anti-spam cooldown. Preserved folio IDs now synchronize through the authoritative Story room-progress snapshot.

### Phase 5 implementation evidence — Moon Infirmary

- Three residents now occupy authored beds and use the shared `E` interaction card for distance, stabilization progress, and blocked-route guidance.
- Infirmary smoke reads the existing Siege ward `stage` and `fireIntensity`; `igniting`, `burning`, `critical`, and `scorched` states raise interior smoke while restoration clears it.
- Heavy smoke closes the centre interaction route, illuminates two low side aisles, disables broad passive healing, and leaves the low moonwell as the safer recovery point.
- Stabilizing all three residents restores full room healing and unlocks a cooldown-limited moonwell treatment service, giving the room a revisit purpose.
- Reduced-smoke accessibility lowers visual opacity without removing route or text guidance. `scripts/qa-infirmary-room.mjs` verifies fire coupling, route blocking, patient rescue, healing rates, restoration, rewards, and cooldown.
- Stabilized patient IDs now synchronize through the authoritative Story room-progress snapshot and apply without duplicating local rewards.

### Phase 5 implementation evidence — Practice Hall

- The former unstructured hit counter is now a three-round drill with left, right, and centre attack lanes that brighten and close over a readable 1.6-second telegraph.
- Each successful directional dodge opens one named counter target for five seconds; unrelated targets remain inactive, so the drill teaches recognition rather than projectile spam.
- Missed dodges and expired counter windows repeat the same tell without damaging or dimming the player, keeping the tutorial controlled while preserving combat timing pressure.
- The Practice Warden, warning floor, active target glow, gold start circle, bilingual interaction copy, completion reward, and cooldown-limited replay service give the room a complete first-visit and revisit loop.
- `scripts/qa-practice-room.mjs` verifies wrong-lane retries, all three directional dodges, target gating, one-time rewards, and replay cooldown. Completed drill state now synchronizes through the authoritative Story room-progress snapshot.

### Phase 5 implementation evidence — Alchemist's Workshop

- Two authored crucibles now require complete weapon recipes—`1 → 2 → 3` and `3 → 2 → 1`—with only the active vat accepting a projectile or Chancellor Bell Toll reaction.
- The active liquid, floor ring, reagent light, bilingual interaction card, and weapon-slot instruction all change to the next required weapon instead of relying on colour alone.
- Wrong reactions reduce recipe progress and raise volatility. Repeated errors create visible fumes that deal bounded six-point chip damage near the vat but can never Dim the player inside the teaching room.
- Practice Hall and Workshop now accept grounded casts and Moonbow draw/release while preserving the normal ground-first movement rule everywhere else; players no longer need to trigger indoor flight merely to use a training room.
- Completing both recipes grants one bounded health/signature reward and unlocks a cooldown-limited replay. `scripts/qa-alchemy-room.mjs` verifies sequences, target gating, hazard damage, one-time rewards, and replay cooldown.
- The former passive cauldron-light loop and unstructured Workshop decoration were replaced by the reaction-owned vat state. Stabilized vats now synchronize in server-validated order through the Story snapshot.

### Phase 5 implementation evidence — Owl Post

- The former single-purpose return portal has been replaced by a three-letter delivery loop: collect at the indoor sorting desk, follow one active violet beacon, deliver, and return for the next route.
- Two destinations require real vertical proximity at rooftop height while the third returns to ground level, creating a compact flight benchmark without forcing the player to stay airborne after delivery.
- Only the current route marker is visible and interactive. The bilingual interaction card reports target, three-dimensional distance, readiness, delivery count, and the return-to-desk instruction.
- Completing all deliveries grants one bounded health/signature reward and unlocks a cooldown-limited replay. `scripts/qa-owlpost-room.mjs` verifies desk collection, roof height, route order, rewards, and replay.
- The portal-only `usePressed` key listener, teleport branch, and portal animation state were removed after the message experience became the single owner of Owl Post interaction. Delivered routes now synchronize in server-validated order through the Story snapshot.

### Phase 5 implementation evidence — multiplayer completion parity and performance cleanup

- `server/story.js` owns bounded room item allowlists, room proximity validation, ordered Workshop/Owl Post progression, duplicate action rejection, snapshot serialization, and late-join delivery.
- Each side-room module applies shared completed-state artifacts without replaying story cards or granting duplicate health/signature rewards. `scripts/qa-room-progress-sync.mjs` covers every room; `scripts/qa-story-combat-server.mjs` covers remote rejection, invalid items, ordering, and late join.
- Hour-Eater geometry and four animation GLBs no longer load during initial campus boot; they are requested only when the Boss, Siege, showcase, or Bell Warden QA actually activates.
- Adaptive mode now uses a 0.68 render ratio, culls distant residents beyond 30m, and preserves stronger architecture detail culling. Static collision/line-of-sight performance remains within its deterministic budget; physical GPU p95 remains an explicit final sign-off item.

### Phase 5 implementation evidence — modular room shell and anti-trap contract

- `room-shell-kit.js` now owns immutable floor, wall, ceiling, column, stair, doorway, window, and prop descriptors. All five side buildings consume the same floor/wall/door/roof/trim/sign layout, preserving their established dimensions and world coordinates while removing the repeated shell construction block.
- Structural colliders are generated from the same descriptors as their visible meshes, so doorway gaps and collision openings cannot drift apart. The shared roof material also replaces five identical per-building material allocations.
- Decorative props are non-colliding by contract. Furniture collider registration rejects both decorative colliders and any ground-level solid that crosses the protected entry/exit corridor.
- Each room runs a grid walkability check after its authored furniture is registered and refuses to boot if its inside or centre navigation anchor is unreachable.
- `scripts/qa-room-shell-kit.mjs` verifies all eight primitives, immutable shell descriptors, exact shell collider count, doorway clearance rejection, the decoration rule, and the real Archive, Workshop, Infirmary, Practice Hall, and Owl Post furniture footprints.

---

## 11. Phase 6 — Integrated mission: The Campus Under Siege

**Phase status:** [~] Feature-complete · full-session pacing and physical LAN acceptance pending

### Mission structure

- [x] Start in the Great Hall with a short, readable briefing.
- [x] Let the player walk outside during a twelve-second deployment window before dusk and combat.
- [x] Signal one threatened building through residents, sound, smoke, emergency UI, ward light, and an authored target socket.
- [x] Spawn a mixed enemy group that now attacks the player while the authoritative ward/fire system applies visible building pressure.
- [x] Escalate from threatened to igniting only if enemies complete readable attacks.
- [x] Add optional resident rescue during burning/critical fire, with independent per-player server cooldowns.
- [x] Let the party suppress fire and finish remaining enemies in either order.
- [x] Open the damaged interior after the exterior is safe.
- [x] Complete one room objective inside the scorched building.
- [x] Restore scorched buildings through server-authoritative progress and return their fire stage, HP, services, and resident presentation.
- [x] End with a campus-state summary instead of a kill-count screen.

### Phase 6 verification

- [x] The mission has a clear beginning, escalation, climax, recovery, and visible consequence.
- [x] A solo player can finish without AI companions through the same local objective and restoration contract.
- [x] Two to four players gain meaningful parallel responsibilities: player pressure, visible building attackers, independent rescue, concurrent suppression, enemy clearing and interior/restoration work use separate authoritative actions.
- [x] The player is damaged only by readable, valid attacks.
- [x] The building burns only because visible attacks reached it.
- [x] UI clearly separates player combat feedback from the colour-independent building emergency panel, integrity, evacuation and suppression guidance; the combined-load layout passes at 150% scale.
- [x] Completion persists through reconnect and checkpoint reload.
- [ ] First-time completion lasts approximately 30–45 minutes without filler.

### Phase 6 implementation evidence — mission opening and shared danger

- Offline and network Siege now begin in a `briefing` phase at the Great Hall's shared inside anchor, followed by a twelve-second `deployment` phase before dusk selects the first threatened ward.
- The briefing, deployment, dusk, wave, lull, dawn, and day labels share the existing high-readability objective HUD and bilingual story-card system.
- Siege enemies now divide readable responsibilities: most pressure the lantern bearer through the unified Phase 2 damage contract, while designated attackers telegraph and dive toward the current authored building socket.
- Passive tide pressure can slowly strain integrity but cannot ignite a building. Fire intensity begins only after a visible enemy impact reaches the authoritative target, and global rate limiting prevents multiple clients from multiplying one impact.
- The dusk signal and first combat wave now name the same mission ward. During combat that room's service interaction is locked with a clear exterior-safety message; after dawn, completing its first-visit objective or full revisit service authorizes restoration.
- The mission ward cannot be restored early. After the room objective, the party must suppress remaining fire and explicitly repair or relight the exterior ward to full restoration before the `MISSION COMPLETE` campus summary appears.
- Archive consultation and Infirmary treatment now report a non-Story `service` completion for repeat Siege visits; Practice, Workshop and Owl Post retain their complete replay loops.
- Mission ward, room authorization, completed restoration and final outcome persist in the Siege checkpoint. A reconnect or server restart returns directly to the same completed summary.
- `scripts/qa-building-fire-server.mjs` verifies briefing/deployment timing, no passive ignition, visible impact escalation, independent four-player rescue/suppression, room mismatch rejection, pre-objective restoration rejection, successful matching-room handoff, mission completion, late join and restart persistence.
- Live browser smoke QA loaded `director-phase6-interior-1`, entered Siege in the Great Hall, advanced from Briefing to Dusk, and reported no browser console warnings or errors.
- Remaining acceptance work is a physical 2–4 player LAN run, first-time 30–45 minute pacing observation, and combined combat/fire UI playtest with players who have not read the plan.

---

## 12. Phase 7 — Accessibility, performance, network, and final QA

**Phase status:** [~] Code and automated matrix complete; physical device, LAN, GPU and unfamiliar-player acceptance retained

- [~] Test keyboard, mouse, trackpad, controller, and touch. Keyboard/mouse and deterministic gamepad/touch contracts pass; physical trackpad, controller and sustained touch hold remain.
- [x] Test reduced motion, reduced bloom, reduced smoke, high contrast, and UI scaling. Deterministic checks plus the live 150% high-contrast/reduced-effects sweep pass.
- [x] Test English and Traditional Chinese throughout the integrated mission. Live language switching during an active Siege updated settings, objective and HUD without a reload.
- [x] Cap active enemies, combat effects, fire sockets, smoke, fire lights, local projectiles, streamed interiors and short audio voices per quality preset.
- [~] Test p95 frame time during the worst combined fire and combat scene. The in-app software renderer activated adaptive mode correctly; physical Mac GPU p95 remains the acceptance measurement.
- [~] Test 1-, 2-, and 4-player LAN sessions. Deterministic ownership plus the isolated real-WebSocket 1/2/3/4-client harness pass; physical multi-device LAN remains.
- [~] Test 150ms latency, duplicate actions, brief disconnect, host departure, late join, and full-party Dimmed. Deterministic boundaries and isolated real transport pass; physical delayed multi-device LAN remains.
- [x] Test checkpoint recovery in every building damage state.
- [x] Test save migration before persisting new building/fire fields.
- [ ] Run a clean playtest with players who have not read this plan.
- [ ] Record every confusion point without explaining the game to the tester.

### Phase 7 acceptance

- [x] No enemy is harmless because of a phase or authority mistake in the Story, Siege, room-safe and boss matrix.
- [x] No building fire is only a HUD number; every fire state has authored sockets, flame/smoke/alarm presentation, resident consequence and restoration state.
- [x] No required text fails the automated size/contrast contract or the live 100–150% English/Traditional Chinese sweep.
- [x] No completed room feels like an empty shell; all six have a first objective, persistent visual completion and a revisit service or refuge loop.
- [ ] No supported camera mode traps the player's view.
- [ ] The complete session maintains the agreed performance targets.
- [x] Solo and co-op both use the same authoritative interior gate, restoration progress, `complete` summary and persisted checkpoint outcome.

### Phase 7 implementation evidence — automated matrix

- `effect-budgets.js` is now the single immutable source for 14 active enemies, four local projectiles, shared impact/mote/restoration pools, Chancellor violet pools, fire sockets, smoke sprites and resident presentation counts across High, Balanced and Performance.
- `building-fire.js` reports its live capacity next to active fire, smoke, ember, alarm and resident counts. The browser fire suite now fails if any active count exceeds the quality budget.
- `scripts/qa-effect-budgets.mjs` verifies quality ordering, safe unknown-preset fallback and immutable pool limits.
- The UI accessibility contract now checks reduced smoke, reduced flashing, reduced bloom, OS reduced-motion CSS/runtime wiring, high contrast, 100–150% UI scaling, subtitle scaling and bilingual typography.
- `scripts/qa-siege-network-checkpoint.mjs` loads safe, igniting, burning, critical and scorched wards in one matrix; verifies old Phase 3 saves gain safe mission defaults; rejects duplicate/sub-150ms actions; accepts the exact 150ms boundary; synchronizes late join; survives first-player departure; and restores all damage states after the final disconnect/rejoin.
- Existing Story server QA covers nearby revive, remote-revive rejection, full-party Dimmed checkpoint recovery, late-join boss state and shared room progress.
- `SkyAudio` now admits at most 32 simultaneous short SFX voices; ambience and music remain separate persistent channels. The effect-budget QA verifies this cap beside enemy, projectile, combat and fire pools.
- The live browser fire suite passes threatened, igniting, burning, critical, rescue, suppression, reduced-effects, scorched and restored states with every live count below its reported capacity.
- The query-gated combined-load probe held a ward at critical fire while nine enemies ran their notice, windup, attack and path-recovery loop. It passed with three active fires, six smoke sprites, three embers, three residents and one alarm, all within Balanced budgets.
- The in-app software-rendered combined scene measured 31.4 FPS and 88.2 ms p95 and correctly entered `adaptive-performance`. This validates degradation behavior only; it is not substituted for the required physical Mac GPU result.
- Live 1280×720 QA at 150% UI scale kept the menu, objective, world status, weapon and control hints inside the viewport. Traditional Chinese and English switched during active Siege, and the initial/restored QA state left no stale objective HUD.
- `scripts/qa-module-reachability.mjs` proves every `js/sky-room` module is reachable from the production entry and rejects unreferenced exports or unused named imports. Its first run identified and removed the obsolete `DEFAULT_PLAYABLE_CHARACTER_ID` export without changing the character roster.
- `scripts/qa-lan-transport.mjs` passed against an isolated real WebSocket server on 2026-07-17: 1/2/3/4-player rosters, remote projectile broadcast, 150ms send ordering, first-player departure, brief reconnect and four-player late join all succeeded using a temporary port and `SKY_WORLD_DB_PATH`.
- The latest live six-room camera sweep kept every exterior in `ground-shoulder` and every interior in `indoor`; the isolated obstruction probe faded one blocker to `0.161` and restored its material and opacity to `1.0` without console warnings.
- The latest combined-load probe ran 12 enemies beside three fires, six smoke sprites, three embers, three residents and one alarm, all inside Balanced effect budgets. The in-app software renderer measured 34.7 FPS and 44 ms p95 with 269 draw calls and correctly activated adaptive performance; this remains degradation evidence rather than physical GPU sign-off.
- The Performance preset exposed a false-negative in the QA harness: its intentional two-socket fire budget was being compared with a hard-coded Balanced target of three. Building-fire and combined-load acceptance now derive the critical target from `capacity.socketsPerWard`; both live Performance probes pass, and the effect-budget script guards against restoring the literal threshold.
- `SKY_ROOM_PHASE_7_ACCEPTANCE.md` is the physical sign-off sheet for Mac Balanced/Performance measurements, the ten-minute input/camera soak, 1/2/4-device LAN, and an unexplained 30–45 minute first-time playtest.

---

## 13. New character integration contract

Claude's stable Aldous character delivery is integrated through a semantic character contract. Systems depend on that contract rather than one character's internal hierarchy.

### Required delivery information

- [x] Stable character ID and display name.
- [x] Role, passive, signature ability, and intended combat contribution.
- [x] GLB 2.0 format, scale, authored/gameplay forward axes, raw ground origin and measured bounds are explicit.
- [x] Idle, walk, run, flight, cast, interact, hit and Dimmed map safely; lift, land, revive and celebration have explicit fallbacks.
- [x] Lantern, left/right hand, head, chest, left/right foot, projectile, and effect anchors resolve semantically at load time.
- [x] Imported model material remains fixed; runtime accent colour is limited to UI and effects so authored identity colours remain intact.
- [x] The enforced budget records 30,129 triangles, one material, one unique embedded image, 7,338,072 model bytes, 286,224 animation-library bytes, a 2048-pixel texture edge and 16 MiB decoded texture ceiling.
- [x] Portrait/thumbnail, generated alt text and a bilingual 3D-model accessibility description exist.

### Integration rules

- [x] No character-specific bone names in shared camera, enemy, fire, room, UI, network or loader systems.
- [x] Missing optional animations fall back to idle/the first clip, and failed model loading retains the procedural character.
- [x] Duplicate characters remain valid in co-op allowlists and server authority.
- [x] Character scale cannot change collision fairness; every playable uses the shared `0.7` radius.
- [x] Signature abilities may improve a solution but never gate a core objective.
- [x] Loader and active-player diagnostics expose semantic attachment resolution without adding Aldous bone names to shared gameplay systems.
- [~] Selection, animation mapping, Bell Toll combat and automated effect budgets pass; physical ground/flight/indoor/damage/Dimmed/revive/smoke/four-player acceptance remains.

---

## 14. Recommended decisions for discussion

These director defaults were approved during the Phase 1–5 discussions and are now production decisions unless testing proves that one needs revision.

| Topic | Recommended default | Reason |
| --- | --- | --- |
| Main difficulty | Normal | Enemies punish standing still but every major attack is telegraphed. |
| Easier option | Story | Longer telegraphs, fewer simultaneous attackers, same story rewards. |
| Harder option | Warden | Faster combinations and more coordinated pressure, not excessive HP. |
| Building consequence | Recoverable scorching | Creates stakes without deleting content or punishing experimentation permanently. |
| Camera | Ground shoulder + flight chase + indoor close profile | One camera cannot serve every space well. |
| Interior loading | Threshold streaming | Keeps rooms spatially connected while protecting performance. |
| Fire suppression | Universal Restoration Beam | Every hero and party composition can respond. |
| Death | Dimmed and checkpoint recovery | Preserves the game's rescue identity. |
| UI style | High-readability by default | Atmosphere belongs in framing and colour, not illegible text. |
| First complete building | Moon Infirmary after Great Hall baseline | It naturally combines rescue, smoke, residents, room navigation, and restoration. |

---

## 15. What I would deliberately postpone

- More playable characters after Claude's current character until the integration contract passes.
- More campaign chapters until one complete building-under-attack mission is excellent.
- Permanent building destruction.
- Procedural interiors.
- Large open-world expansion.
- New weapon families.
- Loot rarity and gear score.
- More currencies or upgrade trees.
- Ranked PvP changes.
- Voice chat.

These features are not rejected forever. They are postponed because they do not solve the current completeness problems.

---

## 16. Phase approval checklist

Before starting any implementation phase:

- [ ] Agree on the exact player problem being solved.
- [ ] Approve the phase acceptance tests.
- [ ] Identify files owned by this phase.
- [ ] Confirm no conflict with Claude's character branch/work.
- [ ] Define solo, two-player, and four-player behaviour.
- [ ] Define accessibility and performance budgets.
- [ ] Define rollback behaviour if the phase fails testing.
- [ ] Implement only the approved phase.
- [ ] Verify before checking any task complete.
- [ ] Update this document with the result and changed decisions.

---

## 17. Current implementation handoff

Continue **Phase 7 physical acceptance**, including the Aldous character rows, then close the production roadmap.

All six rooms and the complete Campus Under Siege feature path now share the room registry, fire sockets, objective reports, server snapshots and restoration checkpoint. Effect caps, bilingual accessibility, migration, network recovery, combined combat/fire load and module reachability are automated and passing.

Phases 2, 3, and 4 are signed off. Phases 1, 5, 6 and 7 are code-complete with explicit physical performance, input, LAN and pacing sign-off items retained. Aldous's code-side integration contract is complete without modifying Claude-owned assets. The final code audit is complete; remaining work requires real devices or unfamiliar players rather than another implementation pass.
