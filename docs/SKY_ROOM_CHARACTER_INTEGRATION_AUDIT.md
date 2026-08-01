# Sky Room — playable character integration audit

**Audit date:** 2026-07-17  
**Scope:** Integration contract and runtime wiring review. This work does not edit Claude-owned models, animation libraries, thumbnails, identity, or character presentation.

## Current result

The existing playable-character system is safe to continue using, and Aldous Crane is selectable and network-valid. His code-side production contract is now complete: the manifest records model orientation and bounds, explicit animation fallbacks, semantic attachment anchors, material rules, measured budgets, and a bilingual accessibility description. Physical gameplay and final visual offset tuning remain pending.

## Verified integration contracts

- Stable playable ID and name: `resident-19` / Aldous Crane.
- Bilingual role, biography, passive, signature, ratings, colour identity and ability configuration exist.
- Main model and the three animation libraries used at runtime are valid glTF 2.0 GLB files.
- All eight runtime animation states resolve to real clips: idle, walk, run, fly, cast, hit, down and interact.
- Missing clips fall back to idle or the first available action; a failed GLB load falls back to the procedural resident.
- Local activation, remote presence and server sanitisation all accept `resident-19`.
- Duplicate character choice is not rejected by lobby or server authority.
- Every playable character uses the same `0.7` gameplay collider radius. Visual model scale does not change collision fairness.
- Shared camera, combat, fire, room, UI, network and loader systems contain no Aldous-specific bone names.
- Eleventh Hour and Bell Toll supplement shared weapons and objectives; neither is required to complete a core interaction.
- Thumbnail alt text is generated from the stable character name.
- All nine semantic attachment keys resolve to real model nodes at load time: lantern, both hands, head, chest, both feet, projectile and effect.
- The active player figure exposes the resolved attachments, while diagnostics report node name, resolution state and offset without exposing raw bone names to shared systems.
- Lift, land, revive and celebration have explicit safe mappings. Aldous now takes off with a shortened spell gesture, levitates upright on the restrained idle cycle, and uses the casual walk at two playback rates instead of the youthful sprint and forward swimming clips. Hit and Dimmed retain the idle bones but add bone-agnostic root recoil and a persistent visual fall until revive; interact and revive reuse a duration-fitted cast until bespoke clips are delivered.
- Imported `Material_1` remains fixed. Aldous's accent colour is applied only to UI and effects, preserving the authored model identity.

## Measured Aldous asset baseline

| Metric | Result |
| --- | ---: |
| Main GLB | 7,338,072 bytes |
| Runtime animation libraries | 197,700 bytes |
| Meshes / primitives | 1 / 1 |
| Triangles | 30,129 |
| Materials | 1 |
| Textures / embedded images | 2 / 1 |
| Nodes / skins | 26 / 1 |
| Runtime animation clips | 4 |

Available clips:

- `Armature|clip0|baselayer`
- `Armature|Idle|baselayer`
- `Armature|Casual_Walk|baselayer`
- `Armature|Charged_Spell_Cast|baselayer`

The local client loads one selected high-detail player. Remote LAN players continue using bounded procedural presence proxies, so a four-player session does not instantiate four Aldous GLBs on every client.

## Completed code-side delivery contract

- [x] Model format, scale, authored `+Z` forward axis, gameplay `-Z` forward axis, `Y=0` ground origin and measured bounds are explicit.
- [x] Semantic lantern, left/right hand, head, chest, left/right foot, projectile and effect anchors resolve through the loader.
- [x] Imported material remains fixed; accent customisation is limited to UI and effects.
- [x] Triangle, GLB byte, material, unique-image, texture-edge and decoded-texture budgets are recorded and enforced against the measured asset.
- [x] Lift, land, revive and celebration use explicit fallback mappings.
- [x] Hit and Dimmed intentionally reuse idle; interact and revive intentionally reuse cast.
- [x] A bilingual 3D-model accessibility description supplements the generated thumbnail alt text.

The nine attachment offsets are currently neutral `[0, 0, 0]`. This is a safe semantic baseline, not a claim that every held effect is visually final. Adjust offsets only after a physical Aldous preview shows a visible misalignment; no shared system should add character-specific bone logic.

## Animation correction — 2026-07-17

- The original `RunFast` mapping produced a low, youthful sprint that contradicted the elderly Chancellor silhouette. Run now keeps the measured `Casual_Walk` cycle and increases only its playback rate.
- The original `Swim_Idle` flight mapping held both hands forward like a swimmer. Flight now uses a slower upright idle; takeoff uses the spell-cast clip as the authored magical transition.
- The unused `RunFast` and `Swim_Idle` libraries remain archived as source assets but are no longer downloaded or mixed into the playable Chancellor at runtime, removing 88,524 bytes and two misleading actions.
- One-shot actions now use `LoopOnce`, fit the source clip to the requested gameplay window, and can restart cleanly on a new cast token. Aldous's 2.7-second source cast is presented as a readable 0.95-second gesture instead of being cut off at 0.72 seconds.
- Because no bespoke hit/down clips exist, the runtime adds a small visual-only recoil and holds a root-level fallen pose until revive. This does not change the shared collider or add character bone names.
- The locomotion path now emits a real landing transition. Elian uses `Jump_Start` → `Jump_Idle` → `Jump_Land`; Aldous keeps the upright idle skeleton and adds only a restrained root-level landing compression.
- One-shot states that share a source clip with locomotion now restart the shared looping action when they finish. This prevents Aldous from freezing after fallback land or hit reactions that reuse `Idle`.
- Elian now explicitly maps lift, land, revive and celebration, with measured one-shot windows for cast, hit, down and interaction states.
- `qa-model-viewer.html` can load the main GLB with any selected external animation libraries and expose each clip as an individual preview button.

## Remaining physical integration acceptance

- [ ] Ground walk/run and ten repeated quick takeoffs.
- [ ] Flight, rise/descent, landing and first/third-person camera.
- [ ] Indoor camera in all six completed rooms.
- [ ] Cast, Bell Toll projectile damage, hit reaction and Dimmed presentation.
- [ ] Nearby revive and full-party recovery.
- [ ] Reduced smoke, active building fire and four-player effect load.
- [ ] Duplicate Aldous selection from two physical LAN devices.

## Repeatable QA

Run:

```sh
node scripts/qa-character-contract.mjs
```

The QA parses the GLB containers directly, verifies every runtime animation mapping, resolves attachment node names, checks budgets and material rules, checks asset/licence paths, enforces equal collider radius, confirms local/network/server character allowlists, verifies loader/main-game attachment wiring, checks lift/land delivery and shared-clip recovery, and rejects playable-character bone coupling in shared systems.

The 2026-07-17 browser regression also confirmed Elian's 0.60-second `Jump_Start` and 0.67-second `Jump_Land` assets, Aldous idle → Bell Toll cast → idle recovery, 12 Bell Toll damage with pooled effects, and no browser warning/error logs.

## Approval status

**Integration foundation:** Pass.  
**Aldous code-side delivery contract:** Pass.  
**Physical gameplay acceptance:** Pending.  
**Safe to declare final production-ready:** No—not until the physical rows above are resolved.
