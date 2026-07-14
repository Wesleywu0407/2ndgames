# Sky Room — UQ Campus Redesign Plan

## Project status

**Current stage:** Planning approved; implementation has not started.

**Creative direction:** **The Last Jacaranda** — a magical, abandoned UQ-inspired campus frozen at 11:47, where the Unlight drains memory, colour, and life from the landscape.

## How this checklist must be maintained

- Use `[ ]` for work that has not been completed.
- Use `[x]` only after the work is implemented and verified in the running game.
- Mark a phase complete only when every required task and its phase verification are complete.
- After finishing a task, update this document in the same change as the implementation.
- If the design changes, record the decision in **Design decisions** instead of silently changing the plan.
- Do not mark a task complete for code alone when the task requires visual or gameplay verification.

## Vision

Sky Room should feel like a magical UQ Great Court rather than a generic gothic castle. The campus should be beautiful and inviting before it becomes threatening.

The visual identity comes from:

- Warm sandstone halls and arcades.
- Broad green lawns and a clear central walking axis.
- Eucalyptus and purple jacaranda trees.
- Shaded cloisters and campus-scale human details.
- Purple petals that guide exploration and react to movement.
- A night-to-dawn colour journey.
- Environmental corruption that visibly spreads and recedes.

The trees are part of the game system, not background decoration. Healthy jacarandas carry violet blossoms and memory-light. The Unlight turns them black and brittle. Cleansing enemies restores blossoms, lamps, sound, NPC activity, and colour.

## Current weaknesses to solve

- The opening view is dominated by a large, empty grey stone surface.
- The distant, dark architecture reads as a generic gothic castle rather than UQ.
- The scene lacks foreground, middle-ground, and background landscape layers.
- Thin pillars obstruct the opening view without creating an attractive place.
- There are too few campus-life details such as lawns, benches, bicycles, banners, books, and student activity.
- The first objective and route are not visually clear enough.
- The player receives several systems before the world establishes its identity.
- The Unlight is visually made from soft sprites and reads more like a particle or collectible than a dangerous enemy.
- Enemies lack a strong silhouette, environmental presence, damage state, and readable attack sequence.
- Multiple modes divide attention before the core Solo Story experience is strong enough.

## Player-experience principles

1. The player should understand the main destination within five seconds.
2. The opening view should contain foreground interest, a readable path, living landscape, and a strong sandstone landmark.
3. Beauty should come before danger so corruption has emotional contrast.
4. Combat must visibly change the campus.
5. Enemy attacks must be readable and fair: presence, detection, anticipation, attack, recovery, damage reaction, and defeat.
6. The first polished target is one excellent five-to-ten-minute Solo Story sequence.
7. Flight should feel earned by the first meaningful interaction rather than hiding the ground experience immediately.
8. Fewer distinctive enemies are better than many weak particles.

---

## Phase 1 — UQ campus transformation

**Phase status:** [x] Complete — 2026-07-12

### Landscape and composition

- [x] Replace most of the opening stone plane with a broad lawn.
- [x] Preserve stone only where it supports paths, courtyards, arcades, and entrances.
- [x] Create a clear central sandstone path from the spawn point to the main hall.
- [x] Recompose the opening camera so trees frame the destination without blocking it.
- [x] Establish foreground, middle-ground, and background layers.
- [x] Remove or reposition the thin opening pillars that weaken the first view.
- [x] Add low garden edges and planting beds to break up the large flat ground plane.

### Architecture

- [x] Rework the main hall into a lower, wider UQ Great Court-inspired landmark.
- [x] Emphasize sandstone colour variation, block texture, and warm window light.
- [x] Add repeated round-headed arches and readable cloister passages.
- [x] Reduce generic gothic spires in the central composition.
- [x] Keep selected fantasy towers only where they support Sky Room's magical identity.

### Trees and campus props

- [x] Build a reusable low-poly eucalyptus tree.
- [x] Build a reusable purple jacaranda tree with multiple canopy variations.
- [x] Place trees in designed clusters that frame paths, lawns, and architecture.
- [x] Add benches, campus lamps, banners, bicycles, books, bags, and picnic details.
- [x] Use instancing or shared geometry/materials for repeated trees and props.
- [x] Add suitable colliders without making navigation frustrating.

### Phase 1 verification

- [x] Verify the first frame clearly reads as a magical UQ-style campus.
- [x] Verify the central destination is understandable without reading UI text.
- [x] Verify the scene feels intentionally populated even when NPCs are not moving.
- [x] Verify the new landscape does not break walking, lift-off, flying, collision, or building entry.
- [x] Verify acceptable desktop performance at the high, balanced, and performance presets.
- [x] Capture and review desktop and mobile screenshots.
- [x] Mark Phase 1 complete only after every Phase 1 item above passes.

### Phase 1 completion note — 2026-07-12

- Replaced the exterior stone field with textured lawn and a smaller rune court.
- Added a central sandstone walk plus secondary campus paths.
- Added instanced jacaranda and eucalyptus systems, designed tree clusters, planting beds, benches, lamps, banners, bicycles, books, and bags.
- Centered and widened the Great Hall, lowered the central skyline, warmed the sandstone palette, and protected the Great Court from procedural tower placement.
- Verified the opening composition and lift-off/aerial view at a 1280 × 720 desktop viewport and reviewed the portrait layout at 390 × 844.
- Switched between high, balanced, and performance presets without console errors, returning the saved preset to balanced.

---

## Phase 2 — Atmosphere and campus life

**Phase status:** [x] Complete — 2026-07-12

### Lighting and colour

- [x] Warm the sandstone enough to remain readable at night.
- [x] Keep cool moonlight in the sky and shadows for colour contrast.
- [x] Improve grass, path, tree, and facade separation at gameplay distance.
- [x] Add warm pools of light beneath campus lamps and occupied windows.
- [x] Create a gradual night-to-dawn palette for the story finale.

### Environmental motion

- [x] Add subtle leaf and canopy movement.
- [x] Add drifting purple petals around jacarandas.
- [x] Make nearby petals react when the player walks or flies past.
- [x] Add grass variation and restrained atmospheric particles.
- [x] Add insects, distant birds, or other small signs of life where appropriate.

### Living campus

- [x] Arrange NPCs into believable activities rather than isolated standing figures.
- [x] Include walking pairs, readers, seated students, groundskeepers, and cloister traffic.
- [x] Add small activity zones around benches, trees, entrances, and lawns.
- [x] Use NPC motion and lit paths to guide the player naturally.
- [x] Add layered campus ambience with lawn, cloister, wind, and distant interior zones.

### Phase 2 verification

- [x] Verify that the campus feels alive before enemies appear.
- [x] Verify important routes remain readable in bright and dark display settings.
- [x] Verify environmental motion is visible but not distracting.
- [x] Verify the scene remains performant with NPCs, trees, petals, and lighting active.
- [x] Mark Phase 2 complete only after every Phase 2 item above passes.

### Phase 2 completion note — 2026-07-12

- Added independently swaying instanced canopies, quality-scaled grass tufts, reactive falling jacaranda petals, lamp fireflies, and distant bird silhouettes.
- Added radial light pools beneath campus lamps and connected the grass, paths, foliage, lamps, and a new dawn sun to the existing story finale.
- Expanded outdoor resident staging with readers, seated figures, groundskeepers, central walkers, conversation groups, and Great Hall cloister traffic.
- Added synthetic lawn and cloister ambience that blends according to player position while preserving the existing wind, bells, and score.
- Verified route and facade readability at the minimum 75% and maximum 140% brightness settings, then restored brightness to 100%.
- Verified desktop and 390 × 844 portrait layouts, complete lift-off, aerial composition, all three quality presets, and a clean browser console; the saved preset remains Balanced.

---

## Phase 3 — Enemy redesign

**Phase status:** [x] Complete — 2026-07-12

### Shared enemy language

- [x] Replace the soft wisp-only presentation with solid, readable enemy silhouettes.
- [x] Define a shared visual language: corrupted cloth, black petals, broken sandstone masks, and violet memory-light.
- [x] Give every enemy a visible awareness state.
- [x] Give every attack a clear anticipation pose and audio cue.
- [x] Add readable attack, recovery, stagger, damage, and defeat states.
- [x] Make enemy presence affect nearby grass, trees, petals, lamps, ambience, and colour.
- [x] Add distance-readable threat indicators without relying only on HUD markers.

### Enemy 1 — The Stray

- [x] Build a hunched, student-shaped shadow with an empty glowing face.
- [x] Give it a distinctive stalking silhouette and cloister behaviour.
- [x] Implement detection, pursuit, anticipation, rush attack, recovery, stagger, and defeat.
- [x] Add a fair warning before its rush attack.
- [x] Make its defeat release memory-light and restore a small area.

### Enemy 2 — The Groundskeeper

- [x] Build a tall root-and-branch silhouette surrounded by black petals.
- [x] Make it corrupt nearby jacarandas and control areas of the lawn.
- [x] Give it attacks that interact with roots, ground space, and player altitude.
- [x] Connect its defeat to large-scale tree restoration.

### Enemy 3 — The Bell Warden

- [x] Build a major enemy with a sandstone mask and torn academic gown.
- [x] Establish it visually at a distance before the first direct encounter.
- [x] Make its arrival extinguish lamps and alter the campus soundscape.
- [x] Design a multi-stage encounter around bells, time, light, and restored campus spaces.

### Phase 3 verification

- [x] Verify each enemy can be identified by silhouette alone.
- [x] Verify attacks are understandable without prior explanation.
- [x] Verify hit feedback communicates whether damage was dealt.
- [x] Verify corruption and cleansing visibly affect the environment.
- [x] Verify enemies remain threatening without unfair tracking or unavoidable damage.
- [x] Mark Phase 3 complete only after every Phase 3 item above passes.

### Phase 3 completion note — 2026-07-12

- Replaced the Unlight sprites with solid procedural characters sharing corrupted cloth, sandstone masks, black petals, violet eyes, corruption shadows, and ground telegraph rings.
- Added detection, pursuit, anticipation, attack, recovery, retreat, stagger, damage flash, defeat, respawn, and cleansing-reward states while preserving the Story and Siege combat interfaces.
- The Stray now stalks Great Hall cloisters and performs a fast, clearly announced rush.
- The Groundskeeper now spawns around jacaranda groves, spreads a wide lawn corruption field, uses a slower root rush that altitude can counter, and releases a large restoration wave on defeat.
- The Bell Warden now appears as a large masked academic figure with a bell halo, extinguishes nearby lamp pools, uses long bell telegraphs and heavy attacks, and enters a faster second stage below half health.
- Added enemy-specific notice, windup, attack, damage, and defeat audio, plus location-aware lamp dimming, corrupted petal movement, cleansing rings, restored foliage glow, and petal restoration waves.
- Added the opt-in `?enemy-showcase=1` QA route for staging all three silhouettes without affecting normal play.
- Versioned the Sky Audio import so enemy visuals and audio load atomically after updates.
- Verified a fresh offline Siege wave, first-person rendering, ward damage progression, high-level enemy readability, JavaScript syntax, and a clean fresh browser console.

### Phase 3 follow-up — Mobile play and Story PvP

**Follow-up status:** [x] Complete — 2026-07-13

- [x] Add a mobile movement joystick and drag-to-look camera control.
- [x] Add touch controls for altitude, interaction, view, weapons, flight, casting, and moonbow draw/release.
- [x] Keep the touch HUD out of desktop and non-Story modes.
- [x] Add server-validated Story-mode player-versus-player hits, weapon damage, cooldowns, and range checks.
- [x] Add remote-player health bars, damage flash, local hit feedback, defeat, and synchronized respawn.
- [x] Verify the 390 × 844 layout, flight transition, weapon switching, and clean browser console.
- [x] Verify two players can damage each other in both directions through the LAN WebSocket server.
- [x] Separate the mobile world status, objective, settings, and health HUD so top-screen text remains readable.
- [x] Add six player-selectable character silhouettes and synchronize the selected character across LAN multiplayer.

---

## Phase 4 — Meaningful first mission

**Phase status:** [ ] Not complete

### Opening sequence

- [ ] Spawn the player beneath or beside a healthy jacaranda facing the central path.
- [ ] Present one clear destination in the first five seconds.
- [ ] Use reversed or unnaturally moving purple petals to lead toward the first corrupted memory.
- [ ] Introduce walking, looking, interaction, and light casting through the environment.
- [ ] Delay unrestricted flight until after the first meaningful interaction.

### First encounter and reward

- [ ] Stage one carefully directed Stray encounter.
- [ ] Teach anticipation, dodge movement, casting, and enemy recovery through play.
- [ ] Cleanse the nearby tree after victory.
- [ ] Restore colour, petals, lamps, ambience, and NPC activity in the cleansed area.
- [ ] Reveal the first memory as a meaningful narrative reward.
- [ ] Open access to the cloister after the memory is recovered.
- [ ] Reveal the Bell Warden at a distance as the next major threat.

### Weapon purpose

- [ ] Define a distinct combat role for Ember Bolt.
- [ ] Define a distinct combat role for Scatter Fan.
- [ ] Define a distinct combat role for Moonbow.
- [ ] Ensure weapon differences are based on tactical use, not only projectile count or damage.

### Phase 4 verification

- [ ] Complete the first mission from a fresh page load without developer shortcuts.
- [ ] Verify a new player can find the objective without confusion.
- [ ] Verify the first encounter teaches the intended combat rhythm.
- [ ] Verify the environmental restoration feels like a substantial reward.
- [ ] Verify the complete sequence lasts approximately five to ten minutes at a natural pace.
- [ ] Mark Phase 4 complete only after every Phase 4 item above passes.

---

## Phase 5 — Polish, accessibility, and performance

**Phase status:** [ ] Not complete

### Presentation polish

- [ ] Improve spell impact, enemy hit, cleansing, and restoration effects.
- [ ] Improve camera feedback while respecting the camera-shake setting.
- [ ] Add spatial enemy audio and stronger attack cues.
- [ ] Refine objective presentation and reduce unnecessary competing HUD information.
- [ ] Polish menu presentation so it previews the new campus identity.
- [ ] Ensure the dawn finale pays off the sandstone, lawn, and jacaranda colour palette.

### Performance

- [ ] Use instancing for trees, blossoms, grass, petals, and repeated props where practical.
- [ ] Add distance-based detail reduction for vegetation and architecture.
- [ ] Pool frequently created combat and environmental effects.
- [ ] Check for unnecessary per-frame allocations and material updates.
- [ ] Verify stable performance during combat with the full campus active.

### Accessibility and device testing

- [ ] Verify keyboard and mouse controls.
- [ ] Verify mobile layout and decide whether mobile gameplay is supported or view-only.
- [ ] Verify Traditional Chinese and English UI after layout changes.
- [ ] Verify brightness, sensitivity, quality, volume, mute, and camera-shake settings.
- [ ] Verify readable contrast without depending solely on purple versus black.
- [ ] Provide reduced-motion behaviour for petals, camera effects, and large restoration sequences.

### Phase 5 verification

- [ ] Run a complete Solo Story playthrough.
- [ ] Check browser console errors during a complete playthrough.
- [ ] Test representative desktop and mobile viewport sizes.
- [ ] Compare final screenshots with the approved art direction.
- [ ] Confirm no regression in settings, NPC interaction, building entry, multiplayer status, or secondary modes.
- [ ] Mark Phase 5 complete only after every Phase 5 item above passes.

---

## Secondary modes

These modes remain part of the project, but they should not lead the redesign until the Solo Story campus and core enemy experience are strong.

- [ ] Review Warden's Trial after Phase 4.
- [ ] Review Twin Lanterns after Phase 4.
- [ ] Review Lantern Vanguard siege after Phase 4.
- [ ] Reuse the new campus, enemy language, and combat feedback across secondary modes.
- [ ] Avoid creating mode-specific art that weakens the shared world identity.

## Technical approach

- Continue using Three.js for the runtime world and gameplay.
- Prefer procedural geometry, shared materials, instancing, and object pooling for the initial implementation.
- Use Python only for optional offline asset generation such as texture sheets, masks, or controlled variations; Python must not be required to run the game.
- Primary implementation areas are expected to include:
  - `js/sky-room.js`
  - `css/sky-room.css`
  - `sky-room.html`
  - `js/sky-audio.js`
  - `js/sky-characters.js`
  - `data/sky-characters.json`
- Preserve current settings and quality presets while extending them for vegetation and effects.

## Design decisions

### 2026-07-12 — Initial direction

- Selected **The Last Jacaranda** as the working creative direction.
- The target is UQ-inspired rather than a literal reproduction of the university.
- Purple jacarandas are both the visual signature and a gameplay/narrative system.
- The Solo Story experience is the first quality target.
- The first enemy to prototype is The Stray.
- No implementation phase is complete at the time this document is created.

## Final completion definition

The redesign is complete only when:

- [ ] All five phases are marked complete.
- [ ] The opening view unmistakably communicates a magical UQ-inspired campus.
- [ ] The environment feels alive before combat begins.
- [ ] Enemies read as dangerous characters rather than particles.
- [ ] Cleansing visibly restores the campus.
- [ ] The first five-to-ten-minute Solo Story sequence is understandable, memorable, and stable.
- [ ] Performance, accessibility, language, and regression checks pass.
