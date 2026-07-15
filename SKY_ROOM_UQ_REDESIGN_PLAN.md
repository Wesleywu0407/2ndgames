# Sky Room — UQ Campus Redesign Plan

## Project status

**Current stage:** All five redesign phases are complete and verified.

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

## Phase 4 — Playable character roster and meaningful first mission

**Phase status:** [x] Complete — 2026-07-15

### Phase 4A — Game design and asset rules

Playable-character definitions are maintained in [`SKY_ROOM_CHARACTER_BIBLE.md`](SKY_ROOM_CHARACTER_BIBLE.md).

- [x] Select a stylized low-poly magical UQ art direction for playable characters.
- [x] Limit the first production roster to four complete playable characters.
- [x] Keep Ember Bolt, Scatter Fan, and Moonbow as shared core weapons.
- [x] Give each playable character one passive and one signature ability.
- [x] Keep the first mission shared across characters, with small role-aware dialogue differences only.
- [x] Write final names, biographies, silhouettes, colour scripts, passives, and signature abilities for all four characters.
- [x] Define external-asset acceptance rules: CC0, CC-BY, or an explicit commercial licence that permits modification and repository distribution.
- [x] Reject Editorial Only, No Derivatives, personal-use-only, unclear, or untraceable assets.
- [x] Add a licence record for every sourced model, texture, and animation: source URL, author, licence, modifications, and export date.
- [x] Decide whether each source licence permits committing the derived game-ready GLB to the public repository.

**Phase 4A status:** [x] Complete — 2026-07-14. See [`SKY_ROOM_CHARACTER_BIBLE.md`](SKY_ROOM_CHARACTER_BIBLE.md), [`ASSET_LICENSE_POLICY.md`](ASSET_LICENSE_POLICY.md), and [`assets/models/characters/LICENSES.md`](assets/models/characters/LICENSES.md).

### Approved first roster

- [x] **Lantern Student — Balanced:** Memory Flare reveals nearby enemies, interactables, and memory traces.
- [x] **Moon Warden — Defender:** Ward Dome briefly blocks or reduces incoming damage for nearby allies.
- [x] **Jacaranda Alchemist — Controller:** Violet Bloom creates a temporary control field that disrupts Unlight enemies.
- [x] **Campus Healer — Support:** Restoration Pulse restores lantern health and accelerates environmental cleansing.

Role differences must remain readable without making the common Story mission four separate games. Core navigation, flight, interaction, objectives, and shared weapons remain consistent.

### Phase 4B — Character-selection foundation

- [x] Replace the Settings-only character dropdown as the primary selection flow.
- [x] Add a dedicated character-selection screen after choosing Solo Story.
- [x] Show a rotatable 3D preview, name, role, biography, passive, signature ability, and simple capability ratings.
- [x] Support English and Traditional Chinese selection content.
- [x] Let the player customise an approved accent or cloak colour without destroying character identity.
- [x] Save the selected character and cosmetic choice locally.
- [x] Add a data-driven character manifest containing model path, role, animations, scale, camera offset, collider, ability configuration, thumbnail, and licence metadata.
- [x] Add one shared asynchronous character loader with cancellation and disposal when switching previews.
- [x] Keep the existing procedural cloaked figure as the loading and failure fallback.
- [x] Add a shared animation controller for idle, walk, run, fly, cast, hit, down, and interact states.
- [x] Synchronise character ID, cosmetic choice, weapon, and required role state through multiplayer.
- [x] Load preview images first and lazily load only the selected full GLB.

**Phase 4B status:** [x] Complete — 2026-07-14. The selection, manifest, ability configuration, thumbnail-first loader, animation controller, persistence, responsive UI, procedural fallback, and validated multiplayer role-state foundations are implemented and browser/WebSocket verified.

### Phase 4B completion note — 2026-07-14

- Added four project-authored SVG preview illustrations and recorded their repository rights in the character asset register.
- The selected illustration is requested and decoded before the matching full GLB is loaded; switching characters cancels and disposes stale preview work.
- Added explicit role keys and passive/signature configuration to the character manifest.
- Added server-sanitised multiplayer role state for signature activity and charge, retained validated weapon state, and consumed the state in remote-character presentation.
- Verified thumbnail-first loading, rapid preview switching, manifest completeness, procedural fallback readiness, desktop layout, responsive layout, and two-client WebSocket state validation.

### Character asset specification

- [x] Establish `Rig_Medium` as the compatible humanoid skeleton standard for the remaining first-four production models where practical; procedural fallbacks remain approved until those asset phases.
- [x] Review against the 20k–45k local-hero and 8k–20k remote/NPC LOD targets; Elian has an approved 7,776-triangle stylised/mobile exception recorded below.
- [x] Limit each game-ready character to one to three materials.
- [x] Prefer 1K textures; allow 2K only where a hero visibly benefits.
- [x] Target a maximum game-ready GLB size of 5–8 MB per hero before exceptional review.
- [x] Keep origin, scale, forward direction, foot placement, bone names, and animation clip names consistent.
- [x] Test the selected model in walking, running, flight, casting, lantern-holding, interaction, hit, and down poses before art polish.
- [x] Preserve silhouettes at gameplay distance through cloak shape, head profile, prop, colour blocking, and effects.
- [x] Plan Meshopt/Draco geometry compression and KTX2 texture compression after the first character is visually approved; defer compression until the roster grows because Elian plus all animation clips is already below 2 MB.

### Phase 4C — One-character vertical slice

- [x] Source two or three legally suitable base-model candidates for the Lantern Student.
- [x] Record each candidate's licence before downloading or modifying it.
- [x] Run a visual and technical comparison in Blender and Three.js.
- [x] Select one base model only after reviewing silhouette, topology, rig quality, animation compatibility, size, and licence.
- [x] Redesign the selected base into the Lantern Student rather than shipping it unchanged.
- [x] Add UQ-magical clothing, lantern, role prop, colour language, and readable face/head treatment.
- [x] Integrate the complete idle, walk, run, fly, cast, hit, down, and interact animation set.
- [x] Verify first-person and third-person camera compatibility.
- [x] Verify Story, multiplayer, mobile, and procedural-fallback behaviour.
- [x] Do not build the remaining three final models until this vertical slice passes visual, gameplay, licence, and performance review.

### Phase 4C completion note — 2026-07-14

- Compared Quaternius Universal Base Characters, KayKit Adventurers, and Kenney Animated Characters Protagonists after recording their CC0 terms; original archives remain outside the repository.
- Selected KayKit Mage and rebuilt it as Elian Voss: stock mage hat/cape removed, with academic cap, memory halo, sandstone trim, constellation details, lantern, broken star chart, and a project-specific navy/gold/light material language.
- Final model: 7,776 triangles, 23-joint Rig_Medium skeleton, three materials, one 1K atlas, and a 431 KB GLB. The lower-than-target triangle count is an approved exception because the silhouette reads clearly at gameplay distance and improves mobile/networked performance without visible loss in the current art style.
- Integrated 26 compatible animation clips and mapped the required idle, walk, run, fly, cast, hit, down, and interact states. Corrected the one-shot animation timer and verified real bone deformation rather than clip-name-only loading.
- Verified production preview and Story loading, third-person visibility, first-person body hiding, flying animation, forced mobile controls, missing-model procedural fallback, and two-client multiplayer character/role-state transmission.
- Kept Corin, Iris, and Nessa on procedural fallbacks; their final models remain intentionally unbuilt until later character-production work.

### Phase 4D — Opening sequence

- [x] Spawn the player beneath or beside a healthy jacaranda facing the central path.
- [x] Present one clear destination in the first five seconds.
- [x] Use reversed or unnaturally moving purple petals to lead toward the first corrupted memory.
- [x] Introduce walking, looking, interaction, and light casting through the environment.
- [x] Delay unrestricted flight until after the first meaningful interaction.

### First encounter and reward

- [x] Stage one carefully directed Stray encounter.
- [x] Teach anticipation, dodge movement, casting, and enemy recovery through play.
- [x] Cleanse the nearby tree after victory.
- [x] Restore colour, petals, lamps, ambience, and NPC activity in the cleansed area.
- [x] Reveal the first memory as a meaningful narrative reward.
- [x] Open access to the cloister after the memory is recovered.
- [x] Reveal the Bell Warden at a distance as the next major threat.

### Weapon purpose

- [x] Define a distinct combat role for Ember Bolt.
- [x] Define a distinct combat role for Scatter Fan.
- [x] Define a distinct combat role for Moonbow.
- [x] Ensure weapon differences are based on tactical use, not only projectile count or damage.

### Phase 4 verification

- [x] Select and confirm a character from a fresh page load without using Settings.
- [x] Verify preview switching does not leak scenes, materials, textures, mixers, or event listeners.
- [x] Verify a missing or failed model falls back to a playable procedural character.
- [x] Verify the Lantern Student model and animations meet the applicable character asset specification and recorded triangle-count exception.
- [x] Verify passive and signature abilities are understandable, useful, and do not replace shared weapon purpose.
- [x] Complete the first mission from a fresh page load without developer shortcuts.
- [x] Verify a new player can find the objective without confusion.
- [x] Verify the first encounter teaches the intended combat rhythm.
- [x] Verify the environmental restoration feels like a substantial reward.
- [x] Verify the complete sequence lasts approximately five to ten minutes at a natural pace.
- [x] Mark Phase 4 complete only after every Phase 4 item above passes.

### Phase 4D completion note — 2026-07-15

- Added a ground-first opening beside the jacaranda, a single readable objective, a reversed 72-petal trail, an interactable corrupted memory, and a hard flight lock until that first narrative interaction.
- Added walking and ground camera controls, position-preserving takeoff, mobile interaction and signature controls, and role-aware passive/signature feedback in the objective HUD.
- Reframed the first combat beat as one directed Stray with an orange warning ring and explicit seek, wind-up, dive, recovery, and counterattack windows. Victory restores the jacaranda, colour, local lamps, ambience, and a wide environmental cleansing pulse.
- Opened the cloister only after victory, delivered the first recovered-memory line, and revealed the passive Bell Warden beyond the gate as the next threat.
- Defined Ember Bolt as rapid mid-range precision, Scatter Fan as close-range area control, and Moonbow as a held heavy-range shot; weapon-switch cards explain those tactical purposes during the encounter.
- Implemented all four role kits: Second Sight / Memory Flare, Steadfast Flame / Ward Dome, Catalyst Chain / Violet Bloom, and Gentle Rekindling / Restoration Pulse, while preserving the three shared weapons.
- Stress-tested 20 rapid character-preview switches. The final two cycles held exactly one mounted figure and one canvas with stable geometry, texture, and shader counts; closing the selector returned preview textures to zero. This test exposed and fixed a skinned-mesh bone-texture leak by disposing skeletons as well as scene materials and parser-owned textures.
- Completed the mission from a fresh page using keyboard, mouse-look, and mobile-button input events only: early flight remained locked, the ground memory unlocked flight, all three drifting memories were recovered, takeoff kept zero horizontal avatar offset, the Stray produced wind-up/dive/recovery states, restoration opened the gate, the Bell Warden appeared, and the run reached phase 4 with no browser exceptions or overlapping objective/world HUD.
- Completed a paced browser walkthrough in 424.4 seconds (7:04), including orientation, control learning, reading, memory observation, the complete Stray rhythm, restoration, and the cloister reveal. The separate ideal-route automation is intentionally much faster and is used only as a regression test, not as the pacing result.

---

## Phase 5 — Polish, accessibility, and performance

**Phase status:** [x] Complete — 2026-07-15

### Presentation polish

- [x] Improve spell impact, enemy hit, cleansing, and restoration effects.
- [x] Improve camera feedback while respecting the camera-shake setting.
- [x] Add spatial enemy audio and stronger attack cues.
- [x] Refine objective presentation and reduce unnecessary competing HUD information.
- [x] Polish menu presentation so it previews the new campus identity.
- [x] Ensure the dawn finale pays off the sandstone, lawn, and jacaranda colour palette.

### Performance

- [x] Use instancing for trees, blossoms, grass, petals, and repeated props where practical.
- [x] Add distance-based detail reduction for vegetation and architecture.
- [x] Pool frequently created combat and environmental effects.
- [x] Check for unnecessary per-frame allocations and material updates.
- [x] Verify stable performance during combat with the full campus active.

### Accessibility and device testing

- [x] Verify keyboard and mouse controls.
- [x] Verify mobile layout and decide whether mobile gameplay is supported or view-only.
- [x] Verify Traditional Chinese and English UI after layout changes.
- [x] Verify brightness, sensitivity, quality, volume, mute, and camera-shake settings.
- [x] Verify readable contrast without depending solely on purple versus black.
- [x] Provide reduced-motion behaviour for petals, camera effects, and large restoration sequences.

### Phase 5 verification

- [x] Run a complete Solo Story playthrough.
- [x] Check browser console errors during a complete playthrough.
- [x] Test representative desktop and mobile viewport sizes.
- [x] Compare final screenshots with the approved art direction.
- [x] Confirm no regression in settings, NPC interaction, building entry, multiplayer status, or secondary modes.
- [x] Mark Phase 5 complete only after every Phase 5 item above passes.

### Phase 5 progress note — 2026-07-15

- Replaced per-hit sprite and ring allocation with bounded pools for weapon-coloured spell impacts, enemy-hit bursts, healing motes, cleansing defeats, and restoration waves.
- Added quality-scaled capacities for High, Balanced, and Performance presets; the Performance preset uses 14 impact, 8 mote, and 3 restoration slots instead of Balanced's 22, 12, and 5.
- Added the opt-in `?effects-showcase=1` QA route for repeatable effect timing and pool-capacity inspection without changing normal play.
- Visually reviewed the combined impact and restoration sequence in the running campus and verified a clean browser console on Balanced and Performance presets; restored the saved preset to Balanced.
- Replaced random camera jitter with smooth trauma-based displacement, roll, and FOV feedback; light weapon recoil and enemy hits respect both the camera-shake setting and the operating system's reduced-motion preference.
- Routed enemy notice, wind-up, attack, hit, and defeat voices through short-lived HRTF panners with distance attenuation, while strengthening the Stray's final wind-up cue.
- Simplified the opening HUD by hiding weapon choices until they become usable, made the objective an accessible live status, and verified the desktop and 390 × 844 touch layouts in English and Traditional Chinese.
- Reframed the menu around “The Last Jacaranda · Great Court” with a clearer live campus preview, and expanded the finale into a warm sky/fog, sandstone, lawn, path, lamp, and jacaranda palette transition.
- Added reduced-motion scaling for opening petals, canopy sway, reactive campus petals, camera feedback, and restoration effects. Rechecked existing vegetation/prop instancing and removed accumulating listener automation from the spatial-audio update path.
- Added opt-in `?camera-showcase=1` and `?dawn-showcase=1` QA routes; reviewed the night menu, active effects, localized mobile HUD, and full dawn frame against the approved art direction.
- Added distance-based campus LOD: far grass, petals, and insects are hidden; distant canopy matrices stop updating; small architectural ornament is culled; and distant shadow casters are disabled on a throttled 450 ms cadence with tighter Performance-preset thresholds.
- Added the opt-in `?perf-probe=1` eight-second telemetry route. With the full campus, three enemy silhouettes, and repeating pooled combat/restoration effects active, Balanced held 60.0 FPS with a 17.5 ms p95 frame, 858 draw calls, and 151,104 triangles; Performance held 60.0 FPS with a 17.3 ms p95 frame, 674 draw calls, and 129,008 triangles.
- The Performance pass hid 310 small architectural details and disabled 311 distant shadow casters, compared with 157 and 242 on Balanced. Both runs completed without browser warnings or errors; the saved preset was restored to Balanced.
- Restored ground-first locomotion across Story and Lantern Vanguard: both modes now enter on foot, flight begins only after an explicit F/Space or touch action, F requests a controlled landing, Shift descends to the ground, and touchdown returns the controller, camera, HUD, and animation state to normal walking. Verified the full ground → lift → fly → land → ground loop without browser warnings or errors.
- Rechecked the post-polish keyboard and pointer paths, including menu/selection clicks, settings focus, F takeoff/landing, HUD state changes, and weapon switching. Exercised volume, mute, quality, brightness, sensitivity, camera shake, and language with non-default values, reloaded to verify persistence, then restored the original English/Balanced/90% defaults; both language layouts and the full settings cycle remained console-clean.
- Raised the weakest menu, settings, help, duel-instruction, objective, and weapon text to measured WCAG-readable contrast on the dark interface (the audited samples now range from 5.42:1 to 8.87:1). Added a visible ▶ marker plus `aria-current` to the selected weapon; world connectivity already uses explicit LOCAL/LIVE/ALERT text, siege wards use distinct glyphs, and duel targeting changes both colour and reticle scale.
- Re-reviewed all secondary-mode entry paths after Phase 4: Warden's Trial now survives its first update and accepts weapon input, Twin Lanterns shows both reticles and the split-screen HUD, and Lantern Vanguard starts on foot before explicit takeoff. All three checks completed without browser warnings or errors.
- Reused the pooled weapon-coloured impacts, defeat bursts, motes, reduced-motion handling, and smooth trauma camera feedback in Warden's Trial and Twin Lanterns so their combat reads as the same campus world instead of a mode-specific visual layer.
- Completed a fresh input-only Solo Story regression on the final ground-first build: walked to and investigated the opening memory, explicitly took flight, recovered all three drifting memories, cleansed the marked Stray, explicitly landed, then walked into the restored cloister to reach phase 4. The final playthrough produced no browser warnings or errors.
- Confirmed the post-landing objective and enemy awareness remain active on the ground, the restored-cloister/building entry completes while walking, a nearby resident card opens and the grounded E action returns “remembers that you stopped to speak,” and the disconnected multiplayer presentation remains the explicit `LOCAL WORLD` state. Settings persistence and all three secondary-mode entries remained unchanged.

---

## Secondary modes

These modes remain part of the project, but they should not lead the redesign until the Solo Story campus and core enemy experience are strong.

- [x] Review Warden's Trial after Phase 4.
- [x] Review Twin Lanterns after Phase 4.
- [x] Review Lantern Vanguard siege after Phase 4.
- [x] Reuse the new campus, enemy language, and combat feedback across secondary modes.
- [x] Avoid creating mode-specific art that weakens the shared world identity.

## Technical approach

- Continue using Three.js for the runtime world and gameplay.
- Preserve the central animation loop while keeping architecture, textures, duel systems, characters, controls, UI, and gameplay in focused modules.
- Prefer procedural geometry, shared materials, instancing, and object pooling for repeated world content.
- Use authored GLB assets for the four playable heroes after licence and performance review.
- Keep character identity and abilities data-driven rather than branching the render loop by character name.
- Lazy-load playable models and dispose rejected previews; do not preload every full-resolution character at startup.
- Keep the current procedural resident system as an inexpensive NPC and failure fallback.
- Use Python only for optional offline asset generation such as texture sheets, masks, or controlled variations; Python must not be required to run the game.
- Primary implementation areas are expected to include:
  - `js/sky-room.js`
  - `js/sky-room/architecture.js`
  - `js/sky-room/duel.js`
  - `js/sky-room/textures.js`
  - `js/sky-room/characters/` for the future manifest, loader, animation controller, and role abilities
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

### 2026-07-14 — Playable-character production direction

- Continue this UQ Campus Redesign Plan instead of creating a competing second roadmap.
- Selected **stylized low-poly magical UQ** as the playable-character art direction.
- Approved a first production roster of four roles: Lantern Student, Moon Warden, Jacaranda Alchemist, and Campus Healer.
- Retain Ember Bolt, Scatter Fan, and Moonbow as shared weapons; each role adds one passive and one signature ability.
- Keep the first mission shared across roles to control narrative, QA, and balancing scope.
- Source legally suitable base models where useful, then substantially redesign, optimise, and integrate them rather than shipping marketplace assets unchanged.
- Use licence suitability, public-repository redistribution rights, silhouette, topology, rig compatibility, and runtime cost as model-selection gates.
- Build and approve one complete Lantern Student vertical slice before producing the other three hero models.

## Final completion definition

The redesign is complete only when:

- [x] All five phases are marked complete.
- [x] The opening view unmistakably communicates a magical UQ-inspired campus.
- [x] The environment feels alive before combat begins.
- [x] Enemies read as dangerous characters rather than particles.
- [x] Cleansing visibly restores the campus.
- [x] The first five-to-ten-minute Solo Story sequence is understandable, memorable, and stable.
- [x] The player can compare, preview, select, and persist one of four complete playable characters.
- [x] Every playable character has a distinct silhouette, passive, signature ability, complete animation set, and documented asset provenance.
- [x] All sourced character assets are legally suitable for the shipped game and public repository.
- [x] Performance, accessibility, language, and regression checks pass.
