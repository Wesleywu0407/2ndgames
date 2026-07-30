# Playable Character Asset Register

One external playable-character base has been approved: KayKit Adventurers Mage, substantially redesigned as Elian Voss under CC0-1.0.

Add one section per candidate before downloading, modifying, or committing its files.

## Phase 4C Lantern Student candidates

### Quaternius — Universal Base Characters

- **Character target:** Lantern Student / Elian Voss
- **Review status:** Rejected after technical and visual comparison
- **Source URL:** https://quaternius.com/packs/universalbasecharacters.html
- **Creator or publisher:** Quaternius
- **Licence:** Creative Commons Zero v1.0 Universal (CC0-1.0)
- **Licence URL or saved evidence:** https://creativecommons.org/publicdomain/zero/1.0/ — the official pack page identifies the pack as CC0 and free for personal, educational, and commercial projects
- **Downloaded on:** 2026-07-14 for local evaluation only
- **Commercial game use permitted:** Yes
- **Modification permitted:** Yes
- **Public repository redistribution of derivative permitted:** Yes
- **Attribution required:** No
- **Original file kept outside repository:** Yes — archive and extracted source remain outside the repository
- **Intended use:** Teen or regular humanoid base, hair, rig, and possible Universal Animation Library compatibility
- **Technical notes:** The evaluated Superhero Male glTF measured approximately 14.3k triangles, 65 joints, three materials, seven textures, and 11.1 MB resolved size
- **Art-direction notes:** Rejected because the available standard base reads as a muscular realistic superhero, is materially heavier than the selected candidate, and would require more reconstruction to reach the student silhouette
- **Modifications made:** None
- **Game-ready output path:** Not selected
- **Reviewer and date:** Codex / 2026-07-14

### Kay Lousberg — KayKit Adventurers

- **Character target:** Lantern Student / Elian Voss
- **Review status:** Approved for repository — selected and redesigned
- **Source URL:** https://kaylousberg.itch.io/kaykit-adventurers
- **Creator or publisher:** Kay Lousberg
- **Licence:** Creative Commons Zero v1.0 Universal (CC0-1.0)
- **Licence URL or saved evidence:** https://creativecommons.org/publicdomain/zero/1.0/ — the official asset page identifies the pack as CC0, including commercial use and no attribution requirement
- **Downloaded on:** 2026-07-14
- **Commercial game use permitted:** Yes
- **Modification permitted:** Yes
- **Public repository redistribution of derivative permitted:** Yes; do not ship or market an unmodified archive as a standalone asset pack
- **Attribution required:** No
- **Original file kept outside repository:** Yes — the original archive and unmodified pack remain outside the repository
- **Intended use:** Mage or rogue body/rig, book, staff, lantern-adjacent accessories, and KayKit animation compatibility
- **Technical notes:** The Mage base measured approximately 6.7k triangles, 23 joints, one material, one 1024×1024 atlas, and 352 KB. The final Elian model is 7,776 triangles, 23 joints, three materials, and 431 KB; two compatible animation libraries add 26 clips and keep the complete character payload below 2 MB
- **Art-direction notes:** Selected for its readable stylised proportions, mobile-friendly weight, clean single-atlas body, and direct Rig_Medium animation compatibility
- **Modifications made:** Removed the stock mage hat and cape; recoloured the body as dark academic clothing; added an academic cap, memory halo, sandstone collar, rune belt, constellation pins, right-hand lantern, left-hand broken star chart, and Elian-specific material language
- **Game-ready output path:** `assets/models/characters/elian-voss/elian-voss.glb`
- **Animation paths:** `assets/models/characters/elian-voss/general.glb`, `assets/models/characters/elian-voss/movement.glb`
- **Motion depth (2026-07-27, zero new assets):** the 26 clips already in these two KayKit libraries cover the depth states the other heroes needed generated art for — Idle_B as an idle break, Hit_B as the heavy reaction, Throw as a second attack, Walking_B/C as spare gaits, and Jump_Start/Jump_Idle/Jump_Land as the lift/hover/land chain. Wiring only; no new files.
- **Bundled licence evidence:** `assets/models/characters/elian-voss/KAYKIT-LICENSE.txt`
- **Rebuild script:** `scripts/characters/build-elian-voss.py`
- **Reviewer and date:** Codex / 2026-07-14

### Kenney — Animated Characters Protagonists

- **Character target:** Lantern Student / Elian Voss
- **Review status:** Rejected after technical and visual comparison
- **Source URL:** https://kenney.nl/assets/animated-characters-protagonists
- **Creator or publisher:** Kenney
- **Licence:** Creative Commons Zero (CC0)
- **Licence URL or saved evidence:** https://creativecommons.org/publicdomain/zero/1.0/ — the official asset page lists CC0; Kenney support confirms asset-page releases are public-domain licensed and permit commercial use without attribution
- **Downloaded on:** 2026-07-14 for local evaluation only
- **Commercial game use permitted:** Yes
- **Modification permitted:** Yes
- **Public repository redistribution of derivative permitted:** Yes
- **Attribution required:** No; do not use the Kenney logo
- **Original file kept outside repository:** Yes — archive and extracted source remain outside the repository
- **Intended use:** Neutral animated protagonist body and rig for silhouette/retargeting comparison
- **Technical notes:** The evaluated FBX measured approximately 1.6k triangles with 58 bones; the pack supplied only idle, run, and jump clips and required an FBX conversion/retargeting path
- **Art-direction notes:** Rejected because the contemporary neutral silhouette and limited included animation set provide less value than KayKit for this vertical slice
- **Modifications made:** None
- **Game-ready output path:** Not selected
- **Reviewer and date:** Codex / 2026-07-14

### Sylwen Yarrow — The Archive Keeper (AI-generated)

- **Character target:** Sylwen Yarrow, playable hero #7 (The Archive Keeper / 守書人, resident-21)
- **Review status:** Approved for repository — project-commissioned AI generation
- **Source URL:** Generated via Higgsfield MCP (Nano Banana Pro concept + Meshy `image_to_3d` and `3d_rigging`), 2026-07-29
- **Creator or publisher:** Project-commissioned AI output; concept, lore, and art direction project-authored
- **Licence:** Project-commissioned work; per Meshy/Higgsfield terms, generated outputs are usable commercially by the generating account. Original character design is project IP
- **Commercial game use permitted:** Yes, per provider terms for account-generated output
- **Modification permitted:** Yes
- **Public repository redistribution of derivative permitted:** Yes, as embedded game asset
- **Attribution required:** No
- **Original file kept outside repository:** Not applicable — generated directly for this project
- **Intended use:** Playable hero model with a 15-clip animation set built around a drawn shot: Archery_Shot and Draw_and_Shoot_from_Back for her seal arrow, Listening_Gesture and Checkout_Gesture as keeper-flavoured idle breaks, plus Idle_3, Stage_Walk, Run_02, Injured_Walk, Idle_Turn_Left, Stand_Dodge_1, Slap_Reaction, Gunshot_Reaction and dying_backwards. No clip is shared with another hero except the two flight loops, which are copied from the Chancellor and Kael — retargeted clips are portable between Meshy-rigged characters, so flight cost nothing to add
- **Technical notes:** 30,751 triangles, 24-joint rig, 1.68 m; compressed to WebP + Draco like the rest of the cast. Her clips arrived on a rig whose bone *names* sat in different places from her model's and whose rest pose was 168–180 degrees away on the whole spine chain; both are handled by the retargeting pass documented below
- **Art-direction notes:** Original green wood-elf design (no third-party IP): pointed ears, silver-green hair past the waist, moss keeper's tunic (#2f4a3a) with jade trim (#7fc9a0) and glowing mint vine embroidery (#bdf0d2). Deliberately outside the campus navy/rust palette because she predates the campus
- **Game-ready output path:** `assets/models/characters/sylwen-yarrow/sylwen-yarrow.glb`
- **Animation paths:** `assets/models/characters/sylwen-yarrow/anim-*.glb`
- **Reviewer and date:** Claude / 2026-07-29

## Asset compression (2026-07-27)

Every character base model is compressed with `@gltf-transform/cli`:

```bash
npx @gltf-transform/cli optimize <model>.glb <model>.glb \
  --texture-compress webp --texture-size 1024 --simplify false --compress false
npx @gltf-transform/cli draco <model>.glb <model>.glb
```

Textures dominated the payload — 83% of 56.7 MB was 2K PNG — so they are resized
to 1024 and stored as WebP, which needs no extra loader because `GLTFLoader`
decodes `EXT_texture_webp` through the browser. Draco then compresses the vertex
data; that one *does* need a decoder, wired once in
`js/sky-room/characters/gltf-loader.js` and shared by every loader that touches a
character GLB, with the decoder fetched from the same jsDelivr version already
used for three.js.

`--simplify false` is deliberate: decimating a skinned mesh risks the rig, and
geometry was never the bottleneck. Animation GLBs are left alone — they are
already ~0.05 MB each after track stripping, and `resample` would disturb the
carefully retargeted tracks.

`assets/models/mercury-xbot.glb` is intentionally untouched; it is a prototype
awaiting provenance review rather than part of the roster.

## Animation retargeting (2026-07-29)

`scripts/characters/strip-chancellor-anims.py <character-dir>` turns a Meshy
`3d_rigging` delivery into a clip the base model can actually play. Meshy
re-rigs the mesh on every animation job, so a clip never arrives in the model's
own rest pose, and three of those disagreements each break the character in a
different way:

1. **Different bone names in the same places.** Sylwen's model runs
   `Hips-Spine02-Spine01-Spine-neck-Head`; her clips came back as
   `Hips-neck-Spine02-Spine-Head1-Head`. Bound by name, a lower-spine curve
   drove her real neck and her head left the body. The bones are paired by
   depth-first position instead and the clip is renamed to match the model.
2. **Different rest orientations.** Even correctly paired, her spine sat
   168–180 degrees from the model's, and a rotation only means anything
   relative to the rest pose it was authored against — she folded in half.
   Every frame is converted to a world-space delta from the clip's own rest
   pose and replayed on the model's, so the mesh always starts from the pose it
   was skinned to. Bone offsets are then dropped outright: the model's rest
   skeleton alone defines proportions, which is what stops a character
   shrinking mid-attack.
3. **Root motion.** Gameplay owns the capsule, so root XZ is pinned — to the
   *model's* rest position, not the clip's first frame. Kael's boxing idle was
   authored 0.88 m to one side and used to teleport him sideways every time the
   break played. Vertical motion is kept, squashed for looping states, and
   re-based when a clip was authored far above the origin (`Leap_of_Faith`
   starts 25 m up a cliff).

`qa-anim-metrics.html?dir=…&model=…&clips=…` is the regression check. It plays
every clip on the real model and reports bone-length variance (must stay ~0%,
anything else is the shrinking bug) and hip drift off the capsule (must stay
~0 m). `qa-model-viewer.html?model=…&sources=…` is the visual counterpart —
numbers cannot tell a graceful glide from a T-pose hanging in mid-air.

## Candidate record template

### Asset name

- **Character target:**
- **Review status:** Candidate / Approved for prototype / Approved for repository / Rejected
- **Source URL:**
- **Creator or publisher:**
- **Licence:**
- **Licence URL or saved evidence:**
- **Downloaded on:**
- **Commercial game use permitted:** Yes / No / Unclear
- **Modification permitted:** Yes / No / Unclear
- **Public repository redistribution of derivative permitted:** Yes / No / Unclear
- **Attribution required:**
- **Original file kept outside repository:** Yes / No / Not applicable
- **Intended use:**
- **Technical notes:** topology, rig, materials, textures, scale, animation compatibility
- **Art-direction notes:** silhouette, redesign potential, conflicts
- **Modifications made:**
- **Game-ready output path:**
- **Reviewer and date:**

## Current project-authored or previously integrated assets

### Phase 4B character preview illustrations

- **Character target:** Elian Voss and Aldous Crane (Corin Ash, Iris Flint, and Nessa Vale previews retired 2026-07-30)
- **Review status:** Approved for repository
- **Creator:** Project-authored for Sky Room
- **Licence:** Original project work
- **Source paths:** `assets/images/characters/*.svg`
- **Commercial game use permitted:** Yes
- **Modification permitted:** Yes
- **Public repository redistribution permitted:** Yes
- **Attribution required:** No external attribution
- **Intended use:** Lightweight thumbnail-first character selection while production GLB files load lazily
- **Created on:** 2026-07-14

### Aldous Crane — The Chancellor (AI-generated)

- **Character target:** Aldous Crane, playable hero #5 (The Chancellor)
- **Review status:** Approved for repository — project-commissioned AI generation
- **Source URL:** Generated via Higgsfield MCP (Meshy `image_to_3d` + `3d_rigging`) from a project-authored concept image (Nano Banana Pro), 2026-07-16
- **Creator or publisher:** Project-commissioned AI output; concept and art direction project-authored
- **Licence:** Project-commissioned work; per Meshy/Higgsfield terms, generated outputs are usable commercially by the generating account. Original character design (name, lore, palette) is project IP
- **Licence URL or saved evidence:** Higgsfield/Meshy terms of service current as of 2026-07-16; generation job ids 361b98ba (model), 2a1b063f/3df01ce0/f8bcbf86/621df2cd (animation clips)
- **Commercial game use permitted:** Yes, per provider terms for account-generated output
- **Modification permitted:** Yes
- **Public repository redistribution of derivative permitted:** Yes, as embedded game asset
- **Attribution required:** No
- **Original file kept outside repository:** Not applicable — generated directly for this project
- **Intended use:** Playable hero model and animation library
- **Technical notes:** 30,129 triangles, one 2K texture, 24-joint Mixamo-named humanoid rig, 7.0 MB base model; four animation GLBs stripped to skeleton+clips (idle/walk/run/cast, 0.23 MB total) via `scripts/characters/strip-chancellor-anims.py`
- **Art-direction notes:** Original wizard-headmaster archetype (no third-party IP likeness); Sky Room palette (navy #252f51, brass #b79358, lantern warmth #ffbd72, memory blue #98b9ff)
- **Game-ready output path:** `assets/models/characters/chancellor/chancellor.glb`
- **Animation paths:** `assets/models/characters/chancellor/anim-*.glb` — 16 clips. Base set: idle, walk, run, fly, cast. Motion-depth pass 2026-07-27 added 12 (jobs f52162e9, 9fc0855e, f3142149, 48ce74d7, 8041efa5, e13e675c, 34f6058a, ca3a5450, b7957807, 3d43c452, 3c91c174, 148472ba): idle-look, idle-alert, turn, step-turn, walk-slow, wounded, run (Quick_Walk — replaces the sped-up walk), hit, hit-heavy, down, cast-b, dodge. Flight added 2026-07-27: hover re-enables the existing Swim_Idle clip, and the glide reuses Kael's Swim_Forward GLB — a generated Leap_of_Faith clip (job b8831794) was discarded because its motion was almost entirely root translation, leaving the hero standing in mid-air once the fall was removed. Retargeted clips are portable between Meshy-rigged heroes, so the file was simply copied.
- **Pipeline note:** the original Meshy source URL for this model had expired (HTTP 403) by the time of the second batch, failing all 12 jobs. The local GLB was re-uploaded with `media_upload` to obtain a fresh `model_url`. Always re-upload the shipped GLB rather than regenerating the base model, or the clips will target a mesh the game does not have.
- **Reviewer and date:** Claude / 2026-07-16

### The Hour-Eater — Unlight incarnate boss (AI-generated)

- **Character target:** The Hour-Eater (噬時者), final boss — replaces the procedural Bell Warden body in the boss encounter
- **Review status:** Approved for repository — project-commissioned AI generation
- **Source URL:** Generated via Higgsfield MCP (Nano Banana Pro concept + Meshy `image_to_3d` and `3d_rigging`), 2026-07-16
- **Creator or publisher:** Project-commissioned AI output; concept, lore, and art direction project-authored
- **Licence:** Project-commissioned work; per Meshy/Higgsfield terms, generated outputs are usable commercially by the generating account. Original character design (name, lore, palette) is project IP
- **Licence URL or saved evidence:** Higgsfield/Meshy terms current as of 2026-07-16; jobs f1b3ff72 (model), 12b328da/190104b0/1a3c7b86/9f6ebfec/61c042f0 (animation clips)
- **Commercial game use permitted:** Yes, per provider terms for account-generated output
- **Modification permitted:** Yes
- **Public repository redistribution of derivative permitted:** Yes, as embedded game asset
- **Attribution required:** No
- **Original file kept outside repository:** Not applicable — generated directly for this project
- **Intended use:** Boss model and animation library (entrance, idle, claw combo, ground slam, death)
- **Technical notes:** 30,698 triangles, one 2K texture, 24-joint humanoid rig, 7.8 MB base model; animation GLBs stripped to skeleton+clips via `scripts/characters/strip-chancellor-anims.py hour-eater`
- **Art-direction notes:** Original storybook devil (no third-party IP): ram horns, tattered bat wings, goat legs, purple-black body (#1a0d28) with violet cracks (#8d5bb8) and ember-orange chest core (#ff8c42) — the "stolen final minute" of the 11:47 lore
- **Game-ready output path:** `assets/models/characters/hour-eater/hour-eater.glb`
- **Animation paths:** `assets/models/characters/hour-eater/anim-entrance.glb`, `anim-idle.glb`, `anim-claw.glb`, `anim-slam.glb`, `anim-death.glb`
- **Reviewer and date:** Claude / 2026-07-16

### Villager body set — outdoor residents (AI-generated)

- **Character target:** Shared villager NPC bodies: student-m, student-f, elder, matron, warden (19 of 28 outdoor residents upgrade from the procedural cloaked figures)
- **Review status:** Approved for repository — project-commissioned AI generation
- **Source URL:** Generated via Higgsfield MCP (Nano Banana Pro concepts + Meshy `image_to_3d` and `3d_rigging`), 2026-07-17
- **Creator or publisher:** Project-commissioned AI output; concepts and palettes project-authored from data/sky-characters.json archetypes
- **Licence:** Project-commissioned work; per Meshy/Higgsfield terms, generated outputs are usable commercially by the generating account
- **Commercial game use permitted:** Yes, per provider terms for account-generated output
- **Modification permitted:** Yes
- **Public repository redistribution of derivative permitted:** Yes, as embedded game assets
- **Attribution required:** No
- **Original file kept outside repository:** Not applicable — generated directly for this project
- **Intended use:** Background villager bodies with idle + walk clips only, assigned per resident archetype by `js/sky-room/characters/villagers.js`; the Chancellor NPC reuses the playable hero model
- **Technical notes:** ~12k triangles each, 24-joint rigs, 5.9–7.0 MB per base model; idle/walk clips stripped to ≤0.07 MB each via `scripts/characters/strip-chancellor-anims.py villagers/<key>`
- **Game-ready output paths:** `assets/models/characters/villagers/<key>/<key>.glb` + `anim-idle.glb` + `anim-walk.glb` for key in student-m, student-f, elder, matron, warden
- **Reviewer and date:** Claude / 2026-07-17

### Kael Morrow — The Breacher (AI-generated)

- **Character target:** Kael Morrow, playable hero #6 (The Breacher / 攻堅手, resident-20)
- **Review status:** Approved for repository — project-commissioned AI generation
- **Source URL:** Generated via Higgsfield MCP (Nano Banana Pro concept + Meshy `image_to_3d` and `3d_rigging`), 2026-07-23
- **Creator or publisher:** Project-commissioned AI output; concept, lore, and art direction project-authored
- **Licence:** Project-commissioned work; per Meshy/Higgsfield terms, generated outputs are usable commercially by the generating account. Original character design is project IP
- **Commercial game use permitted:** Yes, per provider terms for account-generated output
- **Modification permitted:** Yes
- **Public repository redistribution of derivative permitted:** Yes, as embedded game asset
- **Attribution required:** No
- **Original file kept outside repository:** Not applicable — generated directly for this project
- **Intended use:** Playable hero model with a distinctive 8-clip animation set (Idle_02, Walk_Fight_Forward, Standard_Forward_Charge, Swim_Forward, Flying_Fist_Kick, Charged_Spell_Cast_1, Hit_Reaction, Shot_in_the_Back_and_Fall) — deliberately none shared with the Chancellor or the Hour-Eater
- **Technical notes:** ~30k triangles target, 24-joint rig, asymmetric breaching gauntlet (symmetry off during generation); clips stripped via `scripts/characters/strip-chancellor-anims.py kael-morrow`
- **Art-direction notes:** Original breacher design: single oversized brass gauntlet with ember core, rust-red jacket (#4a2a24), forge-orange trim (#c96f3b), cracked door-sigil emblem
- **Game-ready output path:** `assets/models/characters/kael-morrow/kael-morrow.glb`
- **Animation paths:** `assets/models/characters/kael-morrow/anim-*.glb` — 16 clips. Base eight: idle, walk, run, fly, strike, cast, hit, down. Motion-depth pass 2026-07-27 added eight (jobs 54694b37, 9eb76d5e, cc9cc0e9, 6ab3d11f, f576cfd5, b78fb91a, 336ad36b, 009d9e38): idle-taunt, idle-box, turn, dodge, hit-heavy, cast-b, wounded, fly-hover
- **Pipeline note:** the original Meshy source URL had expired, so the shipped GLB was re-uploaded via `media_upload` for this batch (see the Chancellor's note above).
- **Reviewer and date:** Claude / 2026-07-23

### Mercury Xbot prototype

- **Character target:** Technical prototype only; not part of the approved four-character production roster
- **Review status:** Requires provenance review before it can be treated as an approved external production asset
- **Game-ready output path:** `assets/models/mercury-xbot.glb`
- **Action required:** Locate and record the original source, creator, licence, redistribution permission, and modification history. If evidence cannot be established, keep it out of the production roster and replace it before release.
