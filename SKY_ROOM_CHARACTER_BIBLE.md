# Sky Room — Playable Character Bible

## Document status

**Status:** Approved production direction — 2026-07-14. Balance values remain first implementation targets.

**Art direction:** Stylized low-poly magical UQ. Each hero must read clearly by silhouette at normal gameplay distance and still belong to the same campus, story, animation system, and shared weapon language.

## Roster principles

- Reuse established Sky Room residents so playable characters belong to the existing world.
- Launch with four complete heroes rather than many unfinished skins.
- Keep walking, flight, interaction, objectives, and the three core weapons consistent.
- Give each hero one passive and one signature ability.
- Keep movement and health differences modest so level design and mission scripting remain shared.
- Use role-aware dialogue and visual reactions without creating four separate first missions.
- Preserve the current procedural cloaked figure as a loading and model-failure fallback.
- Treat the values below as first balance targets, not final shipped numbers.

## Shared combat language

Every hero can use:

- **Ember Bolt:** reliable single-target pressure and the clearest interrupt tool.
- **Scatter Fan:** short-range crowd control and fast corruption clearing.
- **Moonbow:** deliberate long-range precision with charge commitment.
- **Dash:** a shared emergency movement action.
- **Lantern interaction:** reveals, activates, cleanses, and restores world objects.

Role abilities supplement these tools. They must not make any shared weapon irrelevant.

## Shared rating scale

Ratings run from 1 to 5 and communicate play style rather than exact statistics.

- **Mobility:** repositioning and safety while moving.
- **Defence:** ability to survive mistakes and hold space.
- **Control:** ability to interrupt, slow, reveal, or group threats.
- **Support:** healing, protection, information, and environmental restoration.
- **Difficulty:** mechanical and tactical complexity for a new player.

---

## 1. Elian Voss — The Lantern Student

**Role:** Balanced / first-playthrough hero  
**Existing identity:** Astronomy student, `resident-01`  
**Player promise:** I can understand the world, find what matters, and respond to any situation.

### Narrative

Elian was mapping the sky above the Great Court when every campus clock stopped at 11:47. The Unlight erased parts of his star chart and left the remaining constellations pointing toward memories rather than stars. He enters the first mission looking for the missing final page and gradually realises the chart records the campus's forgotten people.

Elian is curious, observant, and slightly uncertain. His dialogue should make a first-time player feel that discovery is brave even when it is imperfect.

### Silhouette and model direction

- Medium-small academic silhouette with an easy, readable centre of mass.
- Short layered cloak that leaves legs visible for clear movement animation.
- Soft round hood with a narrow star-chart visor or forehead lens.
- Cross-body map case and folded brass observation tool.
- Lantern hangs slightly forward and acts as the main warm focal point.
- Avoid oversized robes or props that interfere with Mixamo-style humanoid rigging.

### Colour script

- Cloak navy: `#252F51`
- Night blue secondary: `#354A72`
- Brass accent: `#B79358`
- Memory blue light: `#98B9FF`
- Shared lantern warmth: `#FFBD72`

Player customisation may alter the brass/accent band within an approved warm palette. Navy and memory blue remain identity colours.

### Ratings

- Mobility: 4
- Defence: 3
- Control: 3
- Support: 2
- Difficulty: 1

### Passive — Second Sight

After Elian focuses on an enemy, interactable, or memory trace for a short time, it remains softly outlined through nearby foliage and darkness. Recently revealed enemy weak points stay visible briefly after line of sight is lost.

First target:

- Focus time: 0.8 seconds
- Memory duration: 5 seconds
- No damage bonus in the first implementation
- Works on mission guidance without replacing objective markers

### Signature — Memory Flare

Elian raises the lantern and releases a quiet sphere of blue-gold light. The flare reveals nearby threats, memories, doors, and cleansable world objects. Enemies caught during an attack wind-up are briefly interrupted.

First target:

- Radius: 15 metres
- Reveal duration: 8 seconds
- One interrupt per enemy per cast
- Cooldown: 20 seconds
- Does not deal direct damage

### First-mission perspective

Elian recognises the reversed petals as a broken constellation and provides the clearest tutorial language. He is the recommended default character and the first model vertical slice.

---

## 2. Corin Ash — The Moon Warden

**Role:** Defender / space holder  
**Existing identity:** Junior warden, `resident-05`  
**Player promise:** I can protect people, hold dangerous ground, and recover from mistakes.

### Narrative

Corin was responsible for the eastern ward when the Bell Warden silenced it. He believes the campus fell because he hesitated, although the truth is that the ward was sabotaged from inside the Great Hall. His story is about learning that protection is not the same as carrying every failure alone.

Corin is direct and practical. His role-aware dialogue notices defensive positions, broken wards, safe routes, and threats to NPCs.

### Silhouette and model direction

- Broad shoulder line and slightly heavier boots without becoming bulky or realistic.
- Tall folded hood or short mantle that frames the head.
- One asymmetrical sandstone-and-metal pauldron.
- Compact ward plate on the off-hand; it unfolds into the Ward Dome focus.
- Lantern carried close to the torso for a guarded silhouette.
- Cape length stays above the ankles to preserve readable flight and run cycles.

### Colour script

- Warden charcoal: `#27313C`
- Deep slate: `#18242F`
- Moon-silver accent: `#94A5BD`
- Ward blue: `#B9D2FF`
- Restrained amber detail: `#EFB77F`

Player customisation may alter the pauldron edge and sash. Charcoal and ward blue remain identity colours.

### Ratings

- Mobility: 2
- Defence: 5
- Control: 3
- Support: 3
- Difficulty: 2

### Passive — Steadfast Flame

Corin resists stagger and gains modest damage reduction while close to a threatened ally, mission ward, or active objective. The passive rewards holding meaningful space rather than standing still anywhere.

First target:

- Trigger distance: 7 metres from an eligible protected target
- Damage reduction: 12 percent
- Stagger reduction: 35 percent
- No passive bonus in competitive PvP without a separate balance review

### Signature — Ward Dome

Corin projects a moonlit dome that reduces incoming Unlight damage and protects allies while they interact, revive, or cleanse. The dome is defensive, not a permanent safe zone.

First target:

- Radius: 5.5 metres
- Duration: 5 seconds
- Damage reduction: 60 percent against Unlight attacks
- Breaks after absorbing a capped amount of damage
- Cooldown: 26 seconds
- PvP version requires reduced duration and protection

### First-mission perspective

Corin identifies the first Stray's attack telegraph as damaged ward behaviour. His dialogue emphasises timing, protection, and the cost of allowing corruption to spread.

---

## 3. Iris Flint — The Jacaranda Alchemist

**Role:** Controller / advanced tactical hero  
**Existing identity:** Potion researcher, `resident-10`  
**Player promise:** I can shape the battlefield, combine effects, and turn corruption against itself.

### Narrative

Iris discovered that jacaranda petals store fragments of conversations, footsteps, and emotion. Her experimental catalyst could restore those memories, but the Unlight inverted the reaction and spread black petals across the lawn. She now needs to prove that the same research can heal what it damaged.

Iris is precise, inventive, and impatient with superstition. Her dialogue interprets magical events as reactions, compounds, and patterns.

### Silhouette and model direction

- Narrow asymmetric cloak with one split tail for a quick, angular read.
- Folded hood, side-swept head shape, or protective half-mask.
- Diagonal vial bandolier with three large readable catalyst shapes.
- One reinforced glove and a compact flask-launching focus.
- Violet glass and petal particles cluster around the belt, not the face.
- Avoid many tiny bottles; use a few exaggerated low-poly props.

### Colour script

- Plum cloak: `#3D2849`
- Burnt wine secondary: `#4B2730`
- Copper accent: `#C98355`
- Catalyst violet: `#B586FF`
- Living green trace: `#77D89C`

Player customisation may alter vial liquid and stitching colour. Plum and catalyst violet remain identity colours.

### Ratings

- Mobility: 3
- Defence: 2
- Control: 5
- Support: 2
- Difficulty: 4

### Passive — Catalyst Chain

Hitting the same enemy with different shared weapons adds distinct reagent marks. Completing the three-reagent chain triggers a small non-damaging reaction that slows the enemy and weakens its next attack.

First target:

- One mark each from Ember, Scatter, and Moonbow
- Marks expire after 8 seconds
- Completed reaction slows by 30 percent for 3 seconds
- Completed reaction reduces the next enemy attack's damage by 20 percent
- Each enemy has a reaction lockout to prevent repeated control loops

### Signature — Violet Bloom

Iris throws a catalyst seed that opens into a field of luminous purple petals. Enemies inside are slowed, their detection is disrupted, and corruption growth pauses. The field visually previews the healthy jacaranda restoration language.

First target:

- Radius: 7 metres
- Duration: 6 seconds
- Movement slow: 40 percent
- Pauses environmental corruption while active
- Interrupts one normal enemy wind-up; bosses resist repeated interruption
- Cooldown: 24 seconds

### First-mission perspective

Iris immediately recognises that the reversed petals are carrying a corrupted reaction upstream. Her dialogue contains more technical lore and less direct tutorial wording, making her better for a second playthrough.

---

## 4. Nessa Vale — The Campus Healer

**Role:** Support / restoration specialist  
**Existing identity:** Healer, `resident-06`  
**Player promise:** I can keep a group moving and make restoration visible in the world.

### Narrative

Nessa stayed in the Moon Infirmary after the clocks stopped, tending lantern flames that no longer remembered their owners. She hears the campus as overlapping heartbeats and knows the Last Jacaranda is fading before anyone else sees it. Her goal is not merely to survive the night, but to return enough memory that the campus can wake itself.

Nessa is calm, candid, and never sentimental about danger. Her dialogue notices injured NPCs, extinguished lamps, unhealthy trees, and safer alternatives to violence.

### Silhouette and model direction

- Layered medium-length healer cape with a rounded, welcoming shoulder line.
- Open or lowered hood so the head silhouette differs from the other three.
- Luminous belt containing three large restoration seals.
- Short staff or lantern crook with a crescent-shaped head.
- Soft leaf-like panels echo healthy jacaranda petals without literal flower clothing.
- Effects should communicate care through expanding light and restored colour, not generic green particles alone.

### Colour script

- Deep eucalyptus: `#3A625A`
- Soft charcoal green: `#29453F`
- Pale sandstone accent: `#C9B99B`
- Restoration mint: `#8BE0C1`
- Lantern cream: `#FFE1A6`

Player customisation may alter the belt seals and inner cape. Eucalyptus and restoration mint remain identity colours.

### Ratings

- Mobility: 3
- Defence: 3
- Control: 2
- Support: 5
- Difficulty: 3

### Passive — Gentle Rekindling

Nessa and nearby allies begin natural lantern recovery sooner after avoiding damage. Cleansed lamps and plants remain brighter for longer around her.

First target:

- Self regeneration begins 2 seconds earlier than the shared rule
- Nearby allies begin regeneration 1 second earlier
- Ally radius: 9 metres
- Does not stack with another Nessa
- Competitive PvP receives a separate, weaker tuning profile

### Signature — Restoration Pulse

Nessa releases a two-stage pulse. The first wave heals lantern health; the second removes minor corruption and accelerates restoration of nearby trees, lamps, and petals. It cannot erase major mission corruption before its objective is completed.

First target:

- Radius: 10 metres
- Immediate healing: 28 percent of maximum lantern health
- Reduced self-healing compared with ally healing if balance requires it
- Clears minor slow and corruption effects
- Strengthens existing environmental restoration but cannot skip mission gates
- Cooldown: 28 seconds

### First-mission perspective

Nessa senses the first memory as an injured living presence. Her dialogue gives the strongest environmental and NPC context and frames victory as restoration rather than defeat of an enemy.

---

## 5. Aldous Crane — The Chancellor

**Role:** Sage / control-support hybrid
**Existing identity:** Chancellor of the Great Hall, `resident-19`
**Player promise:** I carry the authority and memory of the whole campus, and I can hold back the hour itself.
**Added:** 2026-07-16 as the fifth hero, after the original four-hero slice. First hero produced through the AI generation pipeline (see `assets/models/characters/LICENSES.md`).

### Narrative

Aldous Crane signed every ward order the campus has forgotten. When the clocks stopped at 11:47, he alone remembered that the failure began inside his own Great Hall — but not who carried it there. He plays as an old, immensely knowledgeable wizard confronting the possibility that the betrayal wears a face he trusted.

His dialogue should carry calm authority with an undertone of guilt. He never panics; he apologises to the campus by restoring it.

### Silhouette and model direction

- Tall, dignified silhouette — the visual counterweight to Elian's small student frame.
- Long white beard and hair; layered navy academic gown with brass trim.
- Brass chain of office with a glowing lantern medallion as the warm focal point.
- Constellation embroidery at the hems ties him to the astronomy theme.
- Robes end above the ankles so leg movement stays readable.
- Model: AI-generated (Meshy image-to-3D), 24-joint Mixamo-named rig, A-pose source.

### Colour script

- Deep chancellor navy: `#1f2747`
- Cloak navy (shared campus identity): `#252F51`
- Brass accent: `#B79358`
- Shared lantern warmth: `#FFBD72`
- Memory blue detail: `#98B9FF`

### Ratings

- Mobility: 2
- Defence: 3
- Control: 4
- Support: 4
- Difficulty: 3

### Primary attack — Bell Toll (replaces Ember Bolt)

The Chancellor is the roster's one exception to the shared first weapon. Instead of casting Ember Bolt, his primary attack rings a Bell Toll: a golden chime-wave centred on himself that strikes every enemy nearby. Scatter Fan and Moonbow remain the shared weapons on slots 2 and 3.

First target:

- Radius: 9 metres, no aiming required
- Damage: 0.85 to every enemy in range, with a short stagger
- Cooldown: 1.6 seconds — deliberate, bell-like pacing versus Ember Bolt's 0.3 s
- Unique property: usable on the ground as well as in flight (all other attacks require flight)
- Trade-off: no ranged option on slot 1; he must let threats come close, which suits his low mobility

### Passive — Chancellor's Word

Lanterns restored near the Chancellor burn brighter and reveal slightly farther. (First implementation: descriptive only, matching the other unimplemented hero passives; a HUD-readable effect is required before it can be called complete.)

### Signature — Eleventh Hour

The Chancellor holds the current minute in place. Nearby Unlight moves and acts more slowly while the bell of the Great Hall tolls.

First target:

- Slow factor: 0.55 on Unlight stage speed (shares the Violet Bloom slow channel)
- Duration: 6 seconds
- Cooldown: 24 seconds
- Does not deal direct damage and does not stack with Violet Bloom beyond the cap

### Animation identity and motion depth

Updated 2026-07-27 to 16 clips. A chancellor must never read as a fighter: every clip is measured, upright, and deliberate.

- **Standing is never static.** Every 7–12 seconds an idle break plays once and returns to idle: a long breath while surveying the court, an alert glance, a turn in place, a stepped turn. Declared in the manifest as `idleBreaks`, driven by `CharacterAnimationController`.
- **Movement is layered.** Casual walk for normal travel, a slow surveying walk, and a real hurried stride for running — replacing the earlier hack of playing the walk clip at 1.42× speed, which read as skating.
- **The wound shows.** Below 32% lantern health his walk and run both become a limp.
- **Combat never repeats one motion.** The two authored casts alternate on every attack (raised staff, then staff-slam). Light hits alternate between a flinch and a sidestep; a blow over 22 damage — or any hit while under 30% health — escalates to the magic-struck heavy reaction. Death is a slow backward fall rather than the old idle-pose fallback.
- **Flight is two motions.** A slowed tread reads as a held hover; once he is genuinely travelling (speed over 0.42) a spread-armed soar takes over. Added 2026-07-27, 18 clips total.

Reaction routing lives in `hurtReaction()` in `js/sky-room.js`; every branch is guarded by `avatar.supportsAnimation()` so heroes without these clips keep their original single flinch.

### First-mission perspective

Aldous recognises administrative details the others cannot: which ward orders were genuine, which signatures are missing. His dialogue frames the mystery from inside the institution and foreshadows that the Great Hall sabotage came from someone with his trust.

---

## 6. Kael Morrow — The Breacher

**Role:** Striker / mobility diver
**Existing identity:** Door-breaker of the sealed halls, `resident-20`
**Player promise:** I go first. I open the way, and everything between me and the door gets moved.
**Added:** 2026-07-23 as the sixth hero. Second character through the AI generation pipeline; first with a fully bespoke animation set (no clip shared with any other character).

### Narrative

When the Unlight sealed the campus halls, Kael Morrow broke the first door open with a salvaged bell-foundry gauntlet — and then the next, and the next. He is not a scholar and does not pretend to be one; he counts debts instead of stars, and the Unlight owes him every door it closed.

His dialogue is blunt, physical, and loyal. He respects the Chancellor, teases Elian, and runs toward every locked thing.

### Silhouette and model direction

- Athletic mid-height frame with a deliberately asymmetric silhouette: one oversized brass breaching gauntlet on the right forearm.
- Rust-red fitted jacket, forge-orange trim, cracked door-sigil chest emblem, no cape or hood.
- Ember-orange glow core in the gauntlet knuckles as the warm focal point.
- Model generated with symmetry off to preserve the gauntlet.

### Colour script

- Rust crimson: `#4a2a24`
- Forge orange: `#c96f3b`
- Ember glow: `#ffab6e`
- Shared lantern warmth: `#FFBD72`

### Ratings

- Mobility: 5
- Defence: 2
- Control: 2
- Support: 1
- Difficulty: 4

### Primary attack — Breach Dash (replaces Ember Bolt)

Weapon slot 1 is a 6-metre lunge along the aim line. Everything in the lane takes damage, is shoved sideways out of the path, and staggers. The dash samples the path against architecture collision, so it stops at walls instead of passing through. Usable on the ground as well as in flight. Cooldown 1.1 s. Scatter Fan and Moonbow remain on slots 2 and 3.

### Passive — Momentum

Right after a Breach Dash his next strikes land harder. (First implementation: descriptive, consistent with the other unimplemented hero passives.)

### Signature — Breach

A single crushing blow that tears through a wider, longer lane (10 m, heavy damage) in front of him. Cooldown 20 s.

### Animation identity and motion depth

Every clip is unique to Kael: guarded Idle_02, fight-forward walk, head-down charge run, Flying_Fist_Kick strike, distinct hit reaction and knock-down. No animation is shared with the Chancellor, villagers, or the Hour-Eater.

Motion depth added 2026-07-27 (16 clips). A brawler's downtime is restless where the Chancellor's is contemplative:

- **Idle breaks every 6–11 seconds:** a chest-pound taunt, shadow-boxing practice, or a combat-stance turn.
- **Flight is two motions:** a treading hover when holding position, a forward crawl-stroke glide once travelling.
- **Wounded below 32% health:** a hunched, guarded crouch-advance rather than the Chancellor's limp.
- **Combat variety:** the flying kick and a kung-fu punch alternate on every attack; light hits alternate between a flinch and a full roll-dodge; heavy blows launch him with a knock-up.

### First-mission perspective

Kael reads the first mission as a rescue with too many locked doors. His tutorial language is about momentum and commitment: pick a line, go through it, and let the lantern light what the fist opens.

---

## Role balance guardrails

- No hero receives more than a 7 percent base movement-speed difference from the shared baseline in the first implementation.
- No hero changes the player's collision radius, flight ceiling, required interaction distance, or mission triggers.
- Shared weapons retain the same core purpose and input across all heroes.
- Signature abilities use a dedicated input and visible cooldown.
- Passives must be readable in the HUD or world; invisible numerical bonuses alone are insufficient.
- Story and co-op are the first balance targets. Competitive PvP uses separate tuning where necessary.
- Duplicate heroes in multiplayer cannot stack the strongest protection, regeneration, or control effects without caps.
- Every role must be able to complete Solo Story without an AI companion.

## Character-selection presentation

The selection screen presents the heroes in this order:

1. Elian Voss — recommended and initially focused.
2. Corin Ash — clear defensive alternative.
3. Iris Flint — advanced control option.
4. Nessa Vale — support and restoration option.
5. Aldous Crane — sage control-support hybrid, added 2026-07-16.
6. Kael Morrow — breacher striker, added 2026-07-23.

The preview should show:

- A full-body turntable with idle animation.
- A short role statement and difficulty label.
- Five capability ratings.
- Passive and signature ability demonstrations using restrained preview effects.
- A biography no longer than 70 words per language in the primary panel.
- A Confirm action plus Back to menu.
- Loading and fallback states that never leave the screen empty.

## Model-sourcing brief for the Lantern Student

The first sourcing search should look for a legally reusable stylized humanoid with:

- Clean humanoid topology and a neutral pose.
- A readable head, hands, feet, and legs suitable for flight and casting.
- No embedded copyrighted franchise identity.
- No large coat, cape, hair, wings, or separate floating parts that obstruct auto-rigging.
- A topology and licence that permit substantial clothing and silhouette redesign.
- A skeleton that can be replaced or normalised without destroying weights.
- A source licence compatible with the public GitHub repository, not only a compiled commercial game.

The base model does not need to look like Elian when downloaded. It must be a sound legal and technical foundation for the final authored design.

## Approval gate

Before model sourcing begins, approve or revise:

- The four character identities and names.
- Each silhouette and colour script.
- Each passive and signature ability.
- The first balance targets.
- Elian Voss as the first model vertical slice.

Once approved, link candidate models in a separate sourcing review. Do not commit or redesign a candidate before its licence is recorded.
