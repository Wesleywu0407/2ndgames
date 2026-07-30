# Sky Room — Story Mode & Friends Expansion Plan

## Document status

**Status:** Active implementation roadmap — playable work currently reaches Chapter II.

**Working campaign title:** **The Twelfth Bell**

**Recommended format:** A 1–4 player, drop-in cooperative story campaign that remains fully playable alone.

This document is the implementation roadmap for improving Sky Room's story mode and making it meaningfully better with friends. It extends **The Last Jacaranda**, the current Solo Story opening, the four playable heroes, the living campus, and the existing LAN multiplayer systems. It does not replace the completed UQ redesign work.

Related documents:

- [`SKY_ROOM_UQ_REDESIGN_PLAN.md`](SKY_ROOM_UQ_REDESIGN_PLAN.md)
- [`SKY_ROOM_CHARACTER_BIBLE.md`](SKY_ROOM_CHARACTER_BIBLE.md)
- [`STORY_LANTERN_VANGUARD.md`](STORY_LANTERN_VANGUARD.md)
- [`LIVING_WORLD.md`](LIVING_WORLD.md)

---

## How this checklist must be maintained

- Use `[ ]` for planned work that is not yet implemented and verified.
- Use `[x]` only after the feature works in the running game.
- Do not mark a task complete for code alone when it requires gameplay, network, visual, or accessibility verification.
- Update this document in the same change as each implementation phase.
- Record changed design decisions in **Approved design decisions** rather than silently rewriting the plan.
- Preserve solo play while adding multiplayer. No required story objective may become impossible with one player.
- Complete and test the vertical slice before building the full campaign.

---

## 1. The new player promise

> At 11:47, every clock on campus stopped. At 11:48, the campus forgot one of its students. At midnight, it will forget everyone.

Sky Room should become a story about friends carrying pieces of a memory that none of them can understand alone.

The player fantasy is not simply “shoot the darkness.” It is:

- Explore a beautiful campus whose places remember what happened there.
- Discover why the Bell Warden stopped time at 11:47.
- Protect people and places while the Unlight tries to erase them.
- Combine lantern powers with friends in ways that feel clever and heroic.
- Make a final choice about whether memory should be restored, carried, or released.

The campaign should feel intimate, mysterious, and replayable—not like an MMO, a grind, or a sequence of enemy arenas.

### The line that defines the story

Near the finale, the Bell Warden tells the heroes:

> “I did not stop the hour to trap you. I stopped it because you asked me to.”

That revelation turns the Warden from a simple villain into a tragic guardian. The final chapters explain what the heroes were trying to prevent and why they chose to forget it.

---

## 2. Design pillars

### 2.1 Investigate

Players follow petals, sounds, NPC behaviour, damaged architecture, and memory traces. Objectives should be understandable without following a HUD arrow every second.

### 2.2 Traverse

Walking is the default grounded experience. Flight is a deliberate power used for height, rescue, pursuit, and special routes—not permanent hovering.

### 2.3 Fight

Combat is readable, mobile, and connected to story consequences. Enemies are corrupted memories with recognizable identities, not disposable targets.

### 2.4 Restore

Victories visibly heal the campus: jacarandas blossom, lamps relight, NPCs return, music gains layers, and new routes open.

### 2.5 Decide

Choices should concern people and memories rather than “good” and “evil” buttons. Decisions alter dialogue, rescued residents, optional scenes, and the epilogue without creating an impossible number of branches.

---

## 3. Campaign structure

**Target first-play length:** 60–90 minutes for the complete campaign.

**Target session shape:** Five authored chapters, each independently replayable after completion.

**First implementation target:** A polished 15–20 minute vertical slice containing the prologue and the beginning of Chapter 1.

### Prologue — The Bell Stops

This is a stronger version of the current Solo Story opening.

- The player begins on the ground and follows reverse-falling jacaranda petals.
- The first grounded memory teaches interaction and reveals the name of a missing student.
- Restoring it unlocks flight as an earned story moment.
- Three drifting memory fragments introduce aerial movement and the selected hero's perspective.
- The first Stray emerges from the combined memory instead of spawning as an unrelated enemy.
- Cleansing it reveals that it was trying to say: “You came back for me.”
- The cloister restores, the campus map opens, and the Bell Warden appears at a distance.
- In co-op, each player receives a different fragment of the first memory.

**Emotional job:** Establish beauty, loss, movement, and the mystery before expanding the systems.

### Chapter 1 — Names in the Cloister

The heroes reach a temporary refuge beneath the Great Hall and meet the remaining residents.

- NPCs remember places and feelings but have begun forgetting names.
- The party investigates three short campus incidents in any order.
- Each incident introduces one living-world relationship: trust, fear, or remembered help.
- Friends compare different visual or audio clues to reconstruct a complete event.
- The party discovers that someone inside the Great Hall helped silence the eastern bell.
- The chapter ends when the restored cloister speaks the missing student's name aloud.

**Primary mechanics:** Shared investigation, NPC trust, party voting, contextual pings.

### Chapter 2 — The Black Garden

The last healthy jacaranda is being strangled by the Groundskeeper beneath the central lawn.

- Players descend through corrupted roots into a memory-space shaped like the campus gardens.
- Walking routes reveal the past; short flight routes carry light between root chambers.
- The Groundskeeper is revealed as a former caretaker who chose to absorb the campus's grief.
- In co-op, players split between protecting the trunk, carrying light, and interrupting root attacks.
- In solo, lantern echoes hold secondary stations for a short time.
- Defeating or redeeming the Groundskeeper restores large areas of the campus.

**Primary mechanics:** Role synergy, simultaneous objectives, large environmental restoration.

### Chapter 3 — The East Ward

Corin's old ward contains evidence that the Bell Warden did not act alone.

- The party crosses a district where bells change gravity and repeat short pieces of time.
- Each hero receives role-specific observations without requiring a specific team composition.
- Corin confronts the belief that his hesitation caused the disaster.
- Players rescue trapped residents while choosing which evidence to preserve before a time loop collapses.
- The recovered record reveals that the heroes themselves approved the stopping of time.

**Primary mechanics:** Timed rescues, repeating spaces, role-aware dialogue, evidence choices.

### Chapter 4 — The Rooms That Remember

The five campus buildings each hold one part of the final truth.

| Memory room | Story question | Cooperative challenge |
| --- | --- | --- |
| Moon Archive | What was deliberately erased? | Players see different pages and assemble the correct order. |
| Alchemist's Workshop | How was the Unlight created? | Players combine weapon effects and catalysts safely. |
| Moon Infirmary | Who asked to be forgotten? | Protect memory patients while healing unstable echoes. |
| Practice Hall | Why did the wardens divide? | Mirror-combat puzzle followed by an opt-in sparring trial. |
| Owl Post | Who never received the warning? | Carry messages through air routes while partners open wind gates. |

- Rooms may be completed in any order.
- Completing a room restores its building and changes NPC activity there.
- The fourth restored room reveals the entrance to the Bell Tower.
- The fifth is optional before the finale but improves the available ending information.

**Primary mechanics:** Non-linear chapter selection, specialized puzzles, building restoration.

### Chapter 5 — The Twelfth Bell

The Bell Warden waits above the frozen clock.

- Stage 1 tests traversal: players climb the tower while bells invert wind and gravity.
- Stage 2 tests combat: the Warden separates the party with memory walls and attacks restored campus spaces.
- Stage 3 tests cooperation: every active player carries a different part of the final memory.
- The heroes learn that the Unlight is made from memories intentionally discarded to spare the campus from a catastrophe.
- The Bell Warden has been holding the final minute because ringing midnight will restore those memories and their pain.
- The ending is a choice, not simply a final shot.

**Final choices:**

1. **Break the Hour** — time resumes and all memories return. The campus heals, but everyone must face the truth.
2. **Carry the Hour** — the heroes inherit the Warden's burden and keep the campus safe at a personal cost.
3. **Share the Memory** — unlocked by sufficient restoration and trust. The burden is divided across the community, allowing dawn without one guardian being sacrificed.

The three choices converge on one canonical future with different epilogue shades. This preserves meaning without multiplying future production costs.

---

## 4. Why friends make the story better

Multiplayer must add meaning, not merely more enemy health.

### 4.1 Split memories

For selected mysteries, each player receives a different clue:

- One sees the event as it happened.
- One hears what a character was thinking.
- One sees what the Unlight removed.
- One sees a possible lie or altered detail.

Players use a simple clue board, pings, or conversation to reconstruct the event. Voice chat is helpful but never required.

Solo solution: the player discovers the fragments sequentially through lantern echoes.

### 4.2 Cooperative lantern actions

- **Lantern Link:** Two players focus light on the same target to reveal deeper corruption.
- **Relay Carry:** One player carries a memory flame while others open routes or protect them.
- **Ward Rescue:** One player stabilizes a downed ally while another blocks incoming corruption.
- **Altitude Pairing:** A ground player activates roots, bells, or doors while a flying player reaches exposed nodes.
- **Shared Restore:** Multiple players cleanse a major landmark faster, but one player can complete it through a longer solo interaction.

### 4.3 Role synergy without forced classes

Every hero keeps the shared weapons, movement, and lantern interactions. Signature abilities create faster or safer solutions but never gate progress.

| Hero | Story contribution with friends |
| --- | --- |
| Elian Voss | Reveals hidden clues, enemy intent, and alternate routes for the party. |
| Aldous Crane | Slows nearby threats and strengthens restored lanterns. |
| Kael Morrow | Breaks blocked routes and creates openings during pursuit. |
| Sylwen Yarrow | Seals threats and keeps marked evidence readable through darkness. |

Duplicate heroes remain allowed. Puzzles respond to capabilities, not character identity.

### 4.4 Shared decisions

- Reversible dialogue choices use a quick party vote.
- Irreversible chapter choices display their consequence category before confirmation.
- The session host breaks a tie only after every connected player has had time to vote.
- No player may skip a major scene for the entire group without consent.
- Personal lore responses may differ per player and do not block shared progress.

### 4.5 Rescue instead of punishment

- Story mode friendly fire is off by default.
- A player reduced to zero lantern health becomes **Dimmed**, not dead.
- Dimmed players can crawl slowly, ping danger, and hold a weak light for allies.
- Allies restore them through a short protected interaction.
- If the whole party is Dimmed, the group returns to the latest story checkpoint.
- Solo play uses one automatic lantern rekindling charge per encounter, refreshed at checkpoints.

### 4.6 Playing together without voice chat

- Contextual world pings: danger, clue, destination, help, wait, and ready.
- A small radial callout wheel using character voice and readable text.
- Party objective progress visible in one compact shared panel.
- “Follow my light” temporarily draws a petal trail from one player to another.
- Ready circles before major encounters, preventing accidental starts.

---

## 5. Multiplayer session experience

### Lobby and joining

- Support 1–4 players in Story mode.
- Allow LAN friends to join from the title screen or during safe exploration.
- Show hero choice, readiness, connection quality, current chapter, and friendly-fire setting.
- Permit duplicate heroes.
- Spawn a late joiner at the nearest safe lantern, not at the original campus spawn.
- Synchronize the current chapter, objective, restored world state, NPC state, and important choices before giving control.

### Leaving and reconnecting

- A disconnected player's required objective role returns to the shared pool immediately.
- Preserve their character, health, and carried story items for a short reconnect window.
- Never leave an encounter impossible because a player disconnected during a split objective.
- If the host leaves, either migrate the session or save everyone at the latest checkpoint and return them safely to the lobby.

### Story progress ownership

Recommended model:

- The host owns the campaign checkpoint.
- Every participant receives chapter unlocks, discovered lore, and cosmetic rewards earned during the session.
- Joining a later chapter does not mark earlier chapters complete.
- Players may replay unlocked chapters without overwriting their furthest checkpoint unless they confirm it.

---

## 6. Combat direction for story co-op

### Encounter rules

- Scale difficulty by adding patterns, directions, and simultaneous responsibilities—not only hit points.
- Keep major enemies readable at all party sizes.
- Give each player something useful to do within 30 seconds of an encounter starting.
- Avoid long periods where one player interacts while everyone else watches.
- Use protected interaction windows so Corin and Nessa can contribute beyond damage.
- Give Elian and Iris meaningful reveal/control moments without making them mandatory.
- Cap visual effects so four players firing together does not hide enemy telegraphs.

### Party-size scaling example

| Party size | Groundskeeper encounter change |
| --- | --- |
| 1 | One root lane; lantern echo briefly holds the second station. |
| 2 | Two simultaneous root lanes and one carried light. |
| 3 | Two lanes plus a corrupted canopy that needs interruption. |
| 4 | Three active jobs, faster rotations, and a rescue pressure event. |

Enemy health rises modestly, but the main scaling comes from coordination patterns.

### Relationship with PvP

- Story mode is cooperative by default, with player damage disabled.
- Add opt-in **Sparring Circles** to the Practice Hall for friendly duels that cannot affect story health or progress.
- Preserve Twin Lanterns as the dedicated competitive mode.
- Consider a later **Corrupted Lantern invasion** toggle only after the cooperative campaign is complete and stable.
- Never allow an invading or sparring player to block an objective, destroy story items, or alter campaign choices.

---

## 7. Narrative systems

### Story Director

A central story director should own:

- Current campaign, chapter, beat, and objective phase.
- Required and optional objectives.
- Encounter gates and checkpoint rules.
- Party-size adaptation.
- Role-aware dialogue requests.
- Restored locations and persistent story choices.
- Safe late-join snapshots.

Story scripts should be data-driven where practical so objectives and dialogue are not scattered through the main render file.

### Objective design

Each objective definition should include:

- Stable objective ID.
- Player-facing title and short instruction.
- Start and completion conditions.
- Solo adaptation.
- Multiplayer adaptation by party size.
- Late-join state.
- Failure and reset behaviour.
- Checkpoint behaviour.
- Accessibility guidance.

### NPC trust and memory

- Reuse living-world trust, fear, health, activity, and memory where possible.
- Authored story lines take priority for major beats.
- Procedural living-world dialogue may provide ambient reactions, not critical exposition.
- Critical clues must remain available even if an NPC is frightened, displaced, or absent.
- NPCs should remember rescues, friendly fire settings, restored locations, and prior chapter choices.

### Controlled branching

Branch at three levels:

1. **Moment:** Different line, animation, or reaction.
2. **Chapter:** Optional rescue, route, clue, or encounter modifier.
3. **Epilogue:** Restored locations, named residents, and final choice shade.

Avoid entirely separate campaign paths. The central mystery and chapter order remain coherent for every party.

---

## 8. Technical direction

### Authority model

The server should be authoritative for:

- Party membership and readiness.
- Current chapter, story phase, and shared objective progress.
- Checkpoints and campaign choices.
- Enemy identity, health, state, and defeat.
- Player health, Dimmed state, revive completion, and respawn.
- Interactive story objects and carried memory ownership.
- Restored locations and persistent NPC consequences.

Clients may predict and render:

- Local movement and flight.
- Weapon firing and immediate visual feedback.
- Projectiles and cosmetic effects.
- Petal trails, pings, animation, camera, and audio.

Server validation should reject impossible range, timing, damage, interaction, and duplicate-action claims.

### Recommended modules

Names are provisional and should follow the existing project structure when implemented.

- `story-director.js` — campaign phase machine, checkpoints, objective transitions.
- `story-content.js` — chapter and objective data.
- `party.js` — lobby, readiness, join/leave/reconnect, votes.
- `coop-interactions.js` — lantern links, relay carrying, shared restores, revives.
- `memory-puzzles.js` — clue assignment, solo adaptation, reconstruction state.
- `story-dialogue.js` — authored, role-aware, and party-aware dialogue selection.
- `story-save.js` — checkpoint serialization and compatible campaign snapshots.
- `story-network.js` — story-specific multiplayer messages and state snapshots.

Do not rewrite the entire game or transport layer in one phase. Extend the current working systems behind small, testable interfaces.

### Save data

A story save should include at minimum:

- Schema version.
- Campaign ID and difficulty.
- Current chapter, beat, and checkpoint.
- Completed required and optional objectives.
- Restored locations.
- Rescued and displaced NPCs.
- Party choices and final-choice eligibility.
- Per-player lore unlocks and chapter completion.
- Active encounter reset data, if supported.

Save migrations must preserve older campaigns where possible. An incompatible development save should fail safely with a clear message, never a broken world.

### Network messages to plan for

```text
server -> client  party-snapshot
client -> server  party-ready
client -> server  story-interact
server -> client  story-state
server -> client  objective-update
client -> server  clue-submit
server -> client  clue-result
client -> server  story-vote
server -> client  vote-result
client -> server  revive-intent
server -> client  player-dimmed | player-rekindled
server -> client  checkpoint-saved
```

Every state-changing request needs a stable action ID, validation, and idempotent handling.

---

## 9. Accessibility and story clarity

- Provide complete subtitles with speaker names and important sound labels.
- Support English and Traditional Chinese from the first vertical slice.
- Never encode a required clue using colour alone.
- Add a reduced-motion option for flight, time loops, camera shake, and memory distortion.
- Provide separate volume controls for dialogue, music, ambience, effects, and voice chat if added later.
- Allow hold/toggle alternatives for flight, aim, sprint, interaction, and clue focus.
- Provide aim assistance and adjustable puzzle timing without reducing story rewards.
- Give every timed co-op puzzle a relaxed mode and a solo-safe adaptation.
- Keep objectives understandable without voice chat or spatial audio.
- Make network interruption messages calm, specific, and non-destructive.
- Ensure mobile players can ping, vote, revive, switch weapons, and manage flight without crowded controls.

---

## 10. Replayability after the campaign

- Chapter replay with unlocked cutscene skip after first completion.
- Memory Archive showing recovered people, places, clues, and alternate hero observations.
- Optional resident rescues and building restoration targets.
- Hero-specific dialogue that rewards replay without hiding the central plot.
- End-of-chapter restoration medals based on rescues, clues, teamwork, and damage prevented—not kill count alone.
- Post-campaign Night Watch modifiers using Lantern Vanguard systems.
- Practice Hall sparring and time trials as social activities between story chapters.
- Cosmetic lantern colours, cloaks, titles, and petal trails earned through exploration and teamwork.

Do not use randomized loot or daily chores to manufacture replay value.

---

## 11. Implementation roadmap

### Phase 0 — Decisions, state model, and prototype contracts

**Phase status:** [ ] In progress — authoritative prologue contracts implemented 2026-07-15

- [ ] Approve campaign length, party size, progress ownership, and final-choice structure.
- [x] Inventory current Story, multiplayer, combat, NPC, and save-state code paths.
- [x] Define the story state schema and versioning rules.
- [ ] Define objective, checkpoint, clue, vote, and revive message contracts.
- [ ] Write the prologue and Chapter 1 beat sheet with exact triggers.
- [ ] Define solo adaptations for every vertical-slice cooperative interaction.
- [ ] Create test fixtures for 1-, 2-, and 4-player sessions.

**Phase 0 verification**

- [x] Every implemented prologue state transition has one clear authority owner.
- [x] A late joiner can be described entirely by one server snapshot.
- [x] No vertical-slice objective requires a specific hero.
- [x] The vertical slice has a complete start, reveal, encounter, and checkpoint.

### Phase 1 — Co-op story foundation

**Phase status:** [ ] In progress — shared Story foundation implemented 2026-07-15

- [x] Add a 1–4 player Story lobby with hero selection and readiness.
- [x] Add shared story state, objective progress, and safe prologue checkpoints.
- [x] Add prologue late join, disconnect recovery, and reconnect behaviour.
- [x] Add contextual pings, ready circles, and the shared objective panel.
- [x] Add Dimmed, revive, party wipe, and checkpoint recovery.
- [x] Disable friendly fire by default in Story mode while preserving visible synchronized projectiles.
- [ ] Synchronize restored environment and essential NPC state.

**Phase 1 verification**

- [ ] Complete a two-browser join, ready, objective, down, revive, disconnect, reconnect, and checkpoint test.
- [x] Confirm one player cannot start or skip a major scene for an unready party.
- [ ] Confirm a disconnect cannot make the objective impossible.
- [ ] Confirm solo Story still starts and progresses without a server-connected friend.

### Phase 2 — Prologue vertical slice

**Phase status:** [ ] In progress — first networked prologue slice implemented 2026-07-15

- [x] Refine the grounded opening and reverse-petal route.
- [x] Add the first named memory and earned flight unlock.
- [x] Add split-memory clues with sequential solo fallback.
- [x] Connect the first Stray directly to the recovered memory.
- [ ] Add role-aware observations for all four heroes.
- [x] Add the restored cloister threshold and Bell Warden reveal.
- [x] Add a stable end-of-slice checkpoint and live-session resume.
- [x] Add English and Traditional Chinese subtitles and objectives for the implemented slice.

**Phase 2 verification**

- [ ] New players understand walking, interaction, flight, firing, and cleansing without external instruction.
- [ ] Complete the slice solo and with 2, 3, and 4 players.
- [ ] Every player performs a meaningful action within the first three minutes.
- [ ] The story remains understandable without voice chat.
- [ ] The first run lasts approximately 15–20 minutes without filler.
- [x] All players see the same completed objective, restored cloister, and checkpoint.

### First co-op implementation note — 2026-07-15

- Added a versioned, server-authoritative prologue state machine for shared phase, checkpoint, memory IDs, Stray cleansing, cloister restoration, completion, and party size.
- Added idempotent Story actions, proximity validation for grounded-memory and cloister interactions, late-join snapshots, reconnect restoration, and distinct clue assignment.
- Added the in-game 1–4 Lantern Story presentation, party/memory HUD, four complementary memory perspectives, and sequential lantern echoes when playing alone.
- Story mode now rejects player damage while continuing to broadcast all three weapons' visible projectiles to friends.
- Added a query-gated `?story-coop-qa=1` route with F6–F9 checkpoint controls for repeatable multiplayer verification; it is inactive in normal play.
- Verified the protocol state machine independently, then completed the full prologue in two real browser clients. Both clients shared phases 0–4 and the same final checkpoint while receiving different clues. Reloading one client restored it to the completed checkpoint, and both browser consoles remained clean.

### Phase 3 — Names in the Cloister

**Phase status:** [ ] In progress — first playable chapter investigation implemented 2026-07-15

- [ ] Build the refuge and resident staging.
- [x] Add three non-linear investigation incidents.
- [x] Add clue board, clue submission, and party vote UI.
- [ ] Connect authored reactions to trust, fear, and remembered help.
- [ ] Add the Great Hall sabotage reveal.
- [ ] Add optional conversations and hero-specific observations.

**Phase 3 verification**

- [ ] Incidents work in any order and survive join/leave events.
- [ ] Critical exposition cannot be permanently missed.
- [ ] Party votes resolve, tie-break, and reconnect consistently.
- [ ] NPC reactions match saved trust and story events.

### Party, rescue, and Chapter I implementation note — 2026-07-15

- Added a server-authoritative 1–4 player lobby with host ownership, individual ready state, four visible ready circles, host-only start, and late-session joins.
- Added five contextual Story pings—look, danger, help, wait, and ready—with keyboard, mobile, network relay, rate limiting, and visible world markers.
- Added the Dimmed state, slowed movement, visible fallen friend presentation, range-validated `E` revives, partial-health rekindling, and full-party checkpoint recovery.
- Extended the shared Story snapshot to version 2 with party identity, ready/dimmed state, host, chapter, incidents, votes, and chapter completion.
- Added **Names in the Cloister** as a playable Chapter I sequence: archive slate, bell rope, and Mara's satchel may be investigated in any order before the shared clue board opens.
- Added synchronized voting with host tie-breaking. The first reveal establishes that Mara Vale asked the Bell Warden to stop the hour and to make the campus forget her first.
- Verified with two real browser clients: both players readied, only the host could start, a ping appeared for the friend, one player was Dimmed and revived by the other, all three incidents synchronized, opposing votes resolved consistently, and a full-party wipe restored both players at `names-restored`.
- Both browser consoles remained clean, the server protocol simulation passed, JavaScript syntax checks passed, and the Living World check synchronized all 18 character profiles.

### Phase 4 — The Black Garden

**Phase status:** [ ] In progress — playable Black Garden encounter implemented 2026-07-15

- [x] Build the underground root memory-space.
- [x] Add lantern relay, altitude pairing, and shared restoration interactions.
- [x] Create solo lantern-echo support.
- [x] Redesign the Groundskeeper encounter for 1–4 player pattern scaling.
- [x] Add redemption and defeat outcomes with controlled narrative convergence.
- [ ] Restore campus trees, lamps, ambience, and NPC routes after completion.

**Phase 4 verification**

- [ ] No party size is reduced to waiting during the boss encounter.
- [ ] Enemy telegraphs remain readable under four-player effects.
- [x] Solo support cannot solve the whole encounter automatically.
- [x] Both outcome routes produce valid shared saves and environmental restoration.

### Chapter II implementation note — 2026-07-15

- Extended the server-authoritative Story snapshot to version 3 with Black Garden relays, party-scaled Groundskeeper health and stages, outcome votes, shared checkpoints, and Chapter II completion.
- Built a physical root-memory arena beneath the campus with three non-linear relays: a grounded root, an aerial canopy node, and a root well. One player may complete all three, while friends can split the route.
- Added visible solo lantern echoes that hold completed relays without finding, charging, or fighting objectives automatically.
- Added a dedicated Groundskeeper with readable ground-ring telegraphs. Ring count scales from party size and encounter stage; deliberate flight counters the ground roots.
- Reused the existing Ember, Scatter, and Moonbow projectile path for boss collision while keeping boss health and hit-rate validation authoritative on the server.
- Added a synchronized restoration-or-force decision with individual votes and host tie-breaking. Both outcomes converge on the restored-campus checkpoint while preserving which memory the party chose.
- Added deterministic Chapter II QA controls behind `?story-coop-qa=1`, including visible one-click buttons that avoid Mac function-key conflicts; normal players cannot access them.
- Verified the complete encounter in one real connected browser, then with two simultaneous clients. Both clients shared 2/3 relay progress, completed the altitude relay together, received the 17-health two-player boss scale, opened the same choice, and resolved opposing votes to the host's selected outcome.
- Protocol simulation covered both outcome values, syntax checks passed for all changed JavaScript, and the temporary Living World server logged no runtime errors.

### Phase 5 — The East Ward and Memory Rooms

**Phase status:** [ ] Not started

- [ ] Build the bell-driven time-loop and gravity mechanics.
- [ ] Add timed resident rescues with relaxed accessibility settings.
- [ ] Implement Corin's East Ward reveal without requiring Corin in the party.
- [ ] Build the five non-linear memory rooms.
- [ ] Add role-aware shortcuts and duplicate-hero handling.
- [ ] Persist building restoration and room-specific NPC activity.

**Phase 5 verification**

- [ ] Every memory room is completable solo and with any hero combination.
- [ ] The time loop resets cleanly after wipe, disconnect, or checkpoint reload.
- [ ] Optional fifth-room information correctly changes finale context.
- [ ] Restored buildings remain synchronized for late joiners.

### Phase 6 — The Twelfth Bell finale

**Phase status:** [ ] Not started

- [ ] Build the Bell Tower traversal sequence.
- [ ] Expand the Bell Warden into a 1–4 player multi-stage encounter.
- [ ] Add party separation without disabling disconnected or solo players.
- [ ] Deliver the stopped-hour and discarded-memory revelations.
- [ ] Add the three final choices and clear party confirmation.
- [ ] Build epilogues from final choice, restored places, and rescued residents.
- [ ] Unlock chapter replay and the Memory Archive.

**Phase 6 verification**

- [ ] The encounter tests traversal, combat, cooperation, and story understanding.
- [ ] All final choices save and reload correctly.
- [ ] The Share the Memory requirements are visible before the final decision.
- [ ] Every participant receives the correct completion and lore unlocks.
- [ ] Credits and return-to-campus flow do not destroy the campaign save.

### Phase 7 — Polish, accessibility, performance, and network QA

**Phase status:** [ ] Not started

- [ ] Tune pacing, dialogue timing, encounter length, and checkpoint placement.
- [ ] Finish Traditional Chinese localization and subtitle timing.
- [ ] Complete keyboard, controller, and mobile control coverage.
- [ ] Add reduced motion, aim assist, timing assist, and hold/toggle options.
- [ ] Cap cooperative particles, lights, projectiles, and audio voices by quality preset.
- [ ] Test LAN latency, packet loss, duplicate messages, and reconnect edge cases.
- [ ] Test save migration and recovery from interrupted writes.
- [ ] Complete desktop and mobile visual QA for 1–4 players.
- [ ] Complete a clean first-time playtest with players who have not read this plan.

**Phase 7 verification**

- [ ] Stable frame pacing on the existing supported quality presets.
- [ ] Story remains playable and understandable at approximately 150 ms simulated latency.
- [ ] No core objective can be griefed by another Story player.
- [ ] No required clue depends only on colour, audio, or voice chat.
- [ ] Browser console and server logs remain clean through a complete campaign.
- [ ] All campaign acceptance criteria pass.

---

## 12. Vertical slice acceptance criteria

The first implementation milestone is approved only when:

- [ ] A new player can finish it alone without bots or developer guidance.
- [ ] Two to four players can join, play, disconnect, reconnect, and finish together.
- [ ] Ground movement is the default; flight begins only after the story unlock.
- [ ] Friends receive different information and can solve the memory without voice chat.
- [ ] All three weapons and remote projectiles remain visible and synchronized.
- [ ] All four heroes contribute without a mandatory party composition.
- [ ] Friendly fire cannot grief Story progress.
- [ ] A wipe returns the party to a fair checkpoint with consistent state.
- [ ] The Stray encounter changes the campus and advances the mystery.
- [ ] English and Traditional Chinese text fit on desktop and mobile.
- [ ] The complete slice runs without browser console or server errors.
- [ ] At least one external playtester asks what happens next.

---

## 13. Approved design decisions

Approved decisions are checked below; the remaining recommendations still need approval:

- [x] Story party size is 1–4 players.
- [x] Story is cooperative; friendly fire is off by default.
- [ ] The campaign uses five chapters and targets 60–90 minutes on a first playthrough.
- [x] Solo play uses lantern echoes only for simultaneous mechanics, not permanent combat companions.
- [ ] The host owns the campaign checkpoint; participants retain chapter unlocks and rewards.
- [x] Major shared choices use a party vote, with host tie-break after every active player has voted.
- [ ] The story has three final choices with convergent future continuity.
- [x] PvP remains opt-in and separated from core Story objectives.
- [x] The prologue vertical slice must prove the design before Chapter 2 production begins.

---

## 14. What I would not do

- Do not turn Sky Room into a giant open world or MMO.
- Do not make friends repeat the host's chores just to receive progress.
- Do not require voice chat to understand clues or coordinate objectives.
- Do not force a tank, healer, controller, and investigator team composition.
- Do not use inflated enemy health as the main multiplayer difficulty system.
- Do not allow PvP, friendly fire, or late joiners to grief story progress.
- Do not hide critical story information inside procedural dialogue.
- Do not create dozens of branching chapters that cannot be polished.
- Do not build every chapter before the 15–20 minute vertical slice is genuinely fun.
- Do not sacrifice the calm, beautiful campus atmosphere for constant combat.

---

## 15. Recommended first implementation step

When implementation begins, start with **Phase 0**, then build only this complete vertical-slice path:

```text
Story lobby
  -> grounded reverse-petal trail
  -> first named memory
  -> flight unlock
  -> split-memory cooperative puzzle
  -> first Stray encounter
  -> shared cleansing and cloister restoration
  -> Bell Warden reveal
  -> checkpoint, reconnect, and resume
```

This slice proves the hardest promises early: the story is stronger, walking and flight feel intentional, friends add something unique, solo still works, and the network can preserve a shared narrative state.
