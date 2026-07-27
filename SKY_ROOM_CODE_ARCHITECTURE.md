# Sky Room code architecture

This document is the guardrail for continuing to split `js/sky-room.js` without changing gameplay behavior.

## Runtime order

1. **Configuration and shared state** — constants, language, input state, collider/target registries.
2. **Renderer and scene** — WebGL renderer, camera, post-processing.
3. **World presentation** — architecture, residents, ambient memories and particles.
4. **Actors and combat** — player avatar, enemies, projectiles, Story and Siege state machines.
5. **Input and UI** — camera controller, touch controls, settings, party UI.
6. **Boot and frame loop** — compose systems, update in deterministic order, render once.

## Extracted modules

| Module | Owns | Must not own |
| --- | --- | --- |
| `settings-controller.js` | persistence, settings DOM, quality/accessibility application | story or combat rules |
| `performance-governor.js` | frame sampling, adaptive pixel ratio/shadows, performance QA report | saved user quality preference |
| `ambient-memories.js` | procedural relic textures, floating memory objects and their animation | story phase transitions or preview UI |
| `resident-system.js` | outdoor resident spawning, navigation, movement style, recovery and spell targets | resident card UI or global story transitions |
| `room-registry.js` | shared room volumes, entrances, camera profiles, navigation anchors, streaming distance, fire/restoration sockets | meshes, story transitions or player movement |
| `room-shell-kit.js` | pure modular floor/wall/ceiling/column/stair/doorway/window/prop descriptors, doorway clearance guard and walkability validation | Three.js meshes, materials or story state |
| `archive-room.js` | Moon Archive evidence reconstruction, interaction prompts, rewards and revisit cooldown | room meshes, global story phases or input listeners |
| `infirmary-room.js` | patient stabilization, fire-driven smoke route, healing rates and treatment cooldown | room meshes, Siege authority or global input listeners |
| `practice-room.js` | telegraph/dodge/counter drill state, target gating, rewards and replay cooldown | room meshes, projectile creation or global input listeners |
| `alchemy-room.js` | ordered weapon recipes, vat gating, volatility hazard, rewards and replay cooldown | room meshes, projectile movement or global input listeners |
| `owlpost-room.js` | message collection/delivery routes, vertical proximity, rewards and replay cooldown | room meshes, player teleportation or global input listeners |
| `npc-interaction.js` | nearest-resident card, greeting interaction, resident text localization | resident movement or spawning |
| `architecture.js` | campus/building construction, interior visibility, architecture LOD | player controls |
| `combat-difficulty.js` | pure difficulty/party scaling | enemy rendering |
| `combat-balance.js` | immutable enemy archetype and weapon damage/timing baselines plus ideal TTK measurement | hit detection or visual effects |
| `building-fire.js` | fire visuals and bounded effect pools | authoritative fire state |
| `effect-budgets.js` | immutable quality caps for enemies, projectiles, combat effects and building fire presentation | effect animation or gameplay damage |
| `camera-collision.js` / `camera-occlusion.js` | spatial collider broadphase, pure camera collision and visual obstruction | locomotion state machine |
| `camera-heading.js` | shortest-angle and optional 0.24-second recenter plans | input listeners or camera rendering |
| `chancellor-magic.js` | Aldous Crane tuning and bounded violet effect pools | generic enemy AI or story phase rules |
| `coop-story-ui.js` / `coop-pings.js` | party UI, votes, ping presentation | server authority |
| `qa-controls.js` | query-gated QA panel, scripted scenarios and F6–F12 shortcuts | normal game boot or frame-loop work |

## Dead-code guard

- Run `node scripts/qa-module-reachability.mjs` after moving or deleting a Sky Room module.
- Run `node scripts/qa-room-shell-kit.mjs` after changing a side-room shell, doorway, solid furniture footprint or decorative-prop collision rule.
- The guard follows static and literal dynamic imports from `js/sky-room.js`, rejects orphaned `js/sky-room` modules, rejects exports with no project reference, and rejects unused named imports.
- Character models, animations, thumbnails and licence records are assets rather than JavaScript modules; asset deletion requires a separate manifest/licence audit and is never inferred from this guard.

## Frame-budget rules

- Target 60 FPS: 16.7 ms average frame budget; watch p95, not only average.
- A normal balanced frame skips post-processing when bloom is disabled.
- Slow ambient buffers update at 20–30 Hz.
- Persistent resident state is sampled instead of fetched for every resident every frame.
- DOM classes/styles are written only when their value changes or at a bounded UI cadence.
- Architecture LOD and distant resident animation become more aggressive only after sustained slow frames.
- Movement, camera sweeps, duel visibility and enemy line-of-sight query the collider spatial index instead of scanning the full campus registry.
- Adaptive mode never overwrites the player's saved quality choice and can recover when frame time stabilizes.
- Scheduler/app suspension over 250 ms is counted separately from active render p95.
- QA orchestration is dynamically imported only when a QA query flag is present.

## Next safe extraction order

1. Split `GameFlow` by chapter while keeping one public state-machine facade.
2. Move `SiegeLoop` into `siege-client.js` after its client/server snapshot contract is covered by tests.
3. Move `CameraController` last; it touches the most shared input and gameplay state.

Do not split a function merely to reduce line count. Extract only when a module has one clear owner, an injected dependency boundary, and a regression test or browser probe.
