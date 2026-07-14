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

- **Character target:** Elian Voss, Corin Ash, Iris Flint, and Nessa Vale
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

### Mercury Xbot prototype

- **Character target:** Technical prototype only; not part of the approved four-character production roster
- **Review status:** Requires provenance review before it can be treated as an approved external production asset
- **Game-ready output path:** `assets/models/mercury-xbot.glb`
- **Action required:** Locate and record the original source, creator, licence, redistribution permission, and modification history. If evidence cannot be established, keep it out of the production roster and replace it before release.
