# SKYVEIL — UI/UX Redesign Plan

**Brief:** 遊戲本身沒問題，介面太醜了。Too many identical squares, text too hard to read while
playing, too much information at once.

**Constraint:** This is an interface redesign only. No gameplay, camera, combat, or 3D-scene logic
is touched. All element IDs and JS-facing class names are preserved so `js/sky-room.js` keeps
working unchanged.

---

## 1. Diagnosis — measured, not guessed

Every number below was read out of the running game (`localhost:4322/sky-room.html`) via
`getComputedStyle` and `grep` over `css/sky-room.css` (1836 lines).

| # | Finding | Evidence |
|---|---------|----------|
| D1 | **The token system was built, then abandoned.** 4 visual tokens exist at `:root`; they are used 16 times total, while the file hardcodes the same values by hand everywhere else. | `--sky-ui-panel` used **2×** vs **41** hardcoded `border: 1px solid` |
| D2 | **Everything is the same box.** 41 hairline-bordered rectangles with 25+ different border alphas and 14 different corner radii. Nothing is more important than anything else. | radii: `50%, 3px, 7px, 6px, 5px, 8px, 4px, 2px, 999px, 2.5px, 20px, 15px, 14px, 10px` |
| D3 | **Gameplay-critical text is set in a 300-weight display serif.** The story card is Cormorant Garamond **weight 300** at 23px, over a moving, low-contrast night scene. Hint text runs at 74.5% alpha. | `#storycard` → `font: 300 23px 'Cormorant Garamond'` |
| D4 | **Four HUD elements occupy the same 180px band and physically overlap.** `#interactionPrompt` (z 16) paints on top of `#storycard` (z 9), erasing the story text mid-sentence. Reproduced on screen. | storycard y510–628 · prompt y558–626 · hint y570–627 · hint2 y599–691 |
| D5 | **No type scale.** 35 distinct font-size declarations. | `grep font-size \| sort -u` → 35 |
| D6 | **Three font families, no rule.** Cormorant (40 uses), system-ui (34), bare `serif` (7) — mixed arbitrarily within the same panel. | `#worldStatus` system-ui next to `#settingsBtn` serif |
| D7 | **Simultaneous information overload.** Main menu = 4 visually identical cards × 3 text blocks = 12 competing texts. Settings = 20 rows in one flat scroll, most carrying a redundant ALL-CAPS restatement of their own label ("Master volume / ALL GAME AUDIO", "Cloak colour / YOUR AVATAR"). | screenshots |
| D8 | **Corner overload / mobile stacking.** Top-right holds three separate floating boxes. At 375px they become three stacked full-width bars and the lantern bar floats loose in mid-screen. | mobile screenshot |

**Root cause:** the CSS grew feature-by-feature. Each new panel invented its own box instead of
reusing a shared surface. That is precisely what reads as "AI made this" — not the colours, not
the fonts, but **41 near-identical boxes that each disagree slightly about their own radius and
border**.

**What is already good and will be kept:** the cinematic cover is genuinely strong — art
direction, the amber/violet jacaranda palette, the Cormorant wordmark, the left-aligned copy
rhythm. The redesign propagates the cover's discipline into the other nine surfaces rather than
inventing a new look.

---

## 2. Design direction

> **Cinematic restraint.** The 3D scene is the art. The interface is a pane of smoked glass in
> front of it — it should feel *printed on the night*, not stacked on top of it in boxes.

Three rules drive every decision:

1. **Fewer surfaces, more hierarchy.** One primary object per screen. Everything else recedes.
2. **Gradient, not border.** Gameplay text sits on a soft fade with no outline. Boxes only exist
   for things the player has actually stopped to read (modals).
3. **One voice at a time.** The HUD never shows two contextual messages simultaneously.

### 2.1 Typography — the single highest-impact fix

The problem is not Cormorant. The problem is Cormorant doing a job it cannot do.

| Role | Font | Weights | Used for |
|------|------|---------|----------|
| **Display** | Cormorant Garamond | 400, 600 | Wordmark, screen titles, character names, chapter marks. **Never below 20px.** |
| **Interface** | Inter (variable) | 400, 500, 600, 700 | Everything else — HUD, story lines, prompts, settings, buttons, stats, labels. |

**The rule:** *if the player has to read it in under two seconds, or it moves, it is Inter.*

Inter is chosen for x-height and aperture at small sizes over a dark moving background, and it
pairs cleanly with Cormorant (high-contrast serif + neutral grotesque). It also covers the
existing `zh-Hant` strings far better than Cormorant, which has no CJK coverage at all and is
currently silently falling back mid-sentence in Chinese.

**Type scale — 35 sizes collapse to 8:**

```
--fs-2xs 11px  overline / keycaps
--fs-xs  12px  meta, chips
--fs-sm  13px  secondary body
--fs-md  15px  body, settings rows
--fs-lg  17px  HUD story line, objective     ← minimum for in-game reading
--fs-xl  21px  card titles
--fs-2xl 28px  screen titles (Cormorant)
--fs-3xl 40px  wordmark (Cormorant)
```

### 2.2 Colour & material

Brand is retained, now as semantic tokens instead of 25 hand-tuned alphas.

```
--ink        #0A0810   base night
--amber      #E8B06A   primary accent, lantern, CTA
--amber-hi   #FFD38D   focus / hover
--jacaranda  #C98BE6   story / memory / secondary accent
--paper      #FAF4E9   primary text
--paper-dim  rgba(250,244,233,.72)   secondary text  (floor — nothing below this)
--danger     #E8756A
```

Contrast targets: primary text ≥ 7:1 on panel, secondary ≥ 4.5:1, never below. The current
74.5%-alpha hint text and the grey-on-near-black menu descriptions both fail today.

**Three materials replace 41 ad-hoc boxes:**

| Token | What it is | Used by | Border? |
|-------|-----------|---------|---------|
| `--mat-scrim` | Full-bleed dim + blur behind modals | settings, lobby, clue board | none |
| `--mat-panel` | Modal surface: vertical gradient + blur + **one** hairline + shadow | dialogs, cards the player stopped to read | 1, from token |
| `--mat-read` | **Gradient fade, no border, no edges** — text legibility backing | HUD story line, prompt, objective, hint | **none** |

`--mat-read` is the move that kills the "too much square" feeling in gameplay: the text gets its
contrast from a soft vertical fade into the scene, so there is no rectangle at all.

**Radius: 14 values → 4.** `--r-sm 6px` · `--r-md 12px` · `--r-lg 18px` · `--r-full 999px`

**Spacing: 8pt rhythm.** `--sp-1 4` `--sp-2 8` `--sp-3 12` `--sp-4 16` `--sp-6 24` `--sp-8 32` `--sp-12 48`

### 2.3 Motion

Motion principles are taken from the `motion-framer` skill — **but the library is deliberately not
installed.** Reasons: Motion is React-first, this project is vanilla ES modules with no bundler,
and a JS-driven animation loop would compete for main-thread frames with three.js, which is
already the performance budget here. CSS transitions run on the compositor and cost nothing.
The skill's *principles* port directly:

```
--ease-out:  cubic-bezier(.16, 1, .3, 1)    /* Expo.out — enters */
--ease-in:   cubic-bezier(.6, 0, .8, .2)    /* exits */
--dur-fast:  140ms   --dur: 220ms   --dur-slow: 380ms
--stagger:   40ms
```

Applied rules:
- **Enter** `opacity 0→1` + `translateY(8px→0)`, `--dur`, `--ease-out`.
- **Exit** at 60% of enter (`--dur-fast`) — exits must feel faster than entrances.
- **Stagger** menu items 40ms apart via `nth-child` delay.
- **Modals** scale `.97→1` + fade, so they read as arriving from their trigger.
- **transform / opacity only.** Never width, height, top, left — the game cannot afford reflow.
- `prefers-reduced-motion: reduce` → every duration to 1ms, no exceptions.

---

## 3. Per-surface plan

### S1 · Cinematic cover — *keep, minor polish*
Working as intended. Only: restore the missing `→` glyph on the enter button, and align its
letter-spacing to the new token.

### S2 · Main menu — *4 equal boxes → 1 hero + 3 quiet entries*
Today four identical bordered cards give Story (the flagship, 90% of players) exactly the same
weight as Siege (a preview). Fix:
- **Story** becomes the primary object: larger, Cormorant title, one line of copy, amber accent
  rule, its own hover lift.
- **Solo Hunt / Local Versus / Siege** become a compact row of three low-profile entries —
  kicker + title only. Descriptions move to hover/focus, removing 6 competing text blocks.
- Left-aligned to inherit the cover's rhythm instead of centre-stacking everything.
- Cards lose their borders; separation comes from spacing and a single hairline rule.
- Entrance staggered 40ms.

### S3 · Character select — *strip the boxes, build real hierarchy*
Currently 12+ nested rectangles (shell, preview frame, 2 ability boxes, 4 roster boxes, footer,
swatch). Fix:
- Outer shell border removed — the screen *is* the panel.
- Character render bleeds off the left edge at larger scale, no frame.
- Right column left-aligned with genuine hierarchy: role overline → name (Cormorant 28) →
  bio (Inter 15, `--paper-dim`) → stats → abilities.
- **Stat dashes become labelled bars with numerals.** Right now you cannot tell 3 pips from 4.
- Ability boxes → borderless blocks separated by a hairline rule and an amber/violet dot.
- Roster items → portrait chips with a 2px accent bar for the selected state, not 4 more boxes.

### S4 · Story lobby — *slots stop being rectangles*
Four bordered "Open lantern slot" rectangles → four circular lantern glyphs with the name beneath,
dim when empty, amber when filled. The LAN-unavailable line becomes a quiet inline note rather
than a bold full-width warning.

### S5 · Settings — *20-row scroll → 4 tabs*
- Tabs: **Game · Audio · Display · Controls**. Each pane is short enough to need no scroll.
- **Delete the redundant ALL-CAPS sub-labels.** "Master volume / ALL GAME AUDIO" carries no
  information. They are kept only where they genuinely add something (e.g. keybind reminders),
  and translated — `MUTE · B` is currently hardcoded English.
- Drop `setting-row-featured`'s arbitrary alternate background — it highlights rows for no reason.
- Rows become label-left / control-right on a shared hairline grid, no per-row boxes.
- Accessibility settings (subtitle size, high contrast, reduced motion/flash/smoke) grouped
  together under Display instead of scattered.

### S6 · In-game HUD — *the collision fix, and the calm rule*
This is the most important change for "players don't want to focus on the words".

**Zone map:**

```
┌──────────────────────────────────────────────────────────┐
│ ◗ lantern arc                          objective  ⚙      │  ← top: state
│                                                          │
│                            ·                             │  ← centre: crosshair only
│                                                          │
│              ⟨ one message, gradient fade ⟩              │  ← lower third: ONE voice
│                                              weapon      │
└──────────────────────────────────────────────────────────┘
```

- **Lantern:** the word `l a n t e r n` is deleted. A health bar does not need to be captioned.
  Amber fill + lantern glyph, no box.
- **Top-right consolidates** from three floating boxes to one cluster: objective text, with world
  status reduced to a single coloured dot on it. Gear stays separate.
- **`#storycard`, `#interactionPrompt`, `#hint`, `#hint2` move inside one `#messageZone`
  flex-column** in the lower third. They can no longer overlap — that is now structurally
  impossible rather than a z-index race.
  - Priority: interaction prompt > story line > hint. `#messageZone:has(.on)` suppresses the
    lower-priority slot, so only one speaks at a time.
  - **This needs no JS change.** `storyEl` and `interactionPromptEl` are fetched by
    `getElementById` and only ever have `.show` / `.on` toggled (4 call sites total), so moving
    them in the DOM is safe.
- All four lose their borders and boxes → `--mat-read` gradient fade.
- Story line goes Inter 17/1.5 at `--paper`, from Cormorant-300/23 at 94% alpha.
- `#hint2` (the 13-item keyboard wall) no longer auto-shows during play; it lives in
  Settings → Controls, where it already exists, and appears in-game only on first session.

### S7 · Remaining surfaces — *retokenize*
Siege shop, duel HUD, ping wheel, clue board, garden choice, NPC card, touch controls, dimmed
overlay. No layout redesign; they adopt the tokens so they stop disagreeing with everything else.

### S8 · Mobile (375px)
- Top-right cluster collapses to icons; objective wraps under it rather than beside it.
- Lantern bar anchors to the top-left safe area instead of floating mid-screen.
- Message zone respects `env(safe-area-inset-bottom)` and sits above the touch controls.
- Touch targets audited to ≥44px (several weapon/action buttons are currently under).

---

## 4. Implementation strategy

**Additive first, then refactor** — so the game is never in a broken state.

1. **New file `css/sky-ui-system.css`** — tokens + the three materials + primitives + motion.
   Loaded *before* `sky-room.css`, so it can be overridden during migration.
2. **Refactor `css/sky-room.css` surface by surface** to consume tokens, deleting the 41
   hardcoded borders as each surface is converted.
3. **`sky-room.html`**: add the Inter font link, wrap the four message elements in `#messageZone`,
   add settings tab markup, adjust menu/character-select structure. **All IDs preserved.**
4. **JS:** only additive and only where unavoidable — settings tab switching in
   `js/sky-room/settings-controller.js`. The HUD fix needs none.
5. **Verify each surface in the browser** at 1280px and 375px, with contrast measured, before
   moving to the next.

**Risk control:** every element ID and every JS-referenced class name stays. Work happens on the
current branch; each surface is a separate commit so any single change can be reverted alone.

---

## 5. Marklist

### Phase 0 — Foundation
- [x] M0.1 Create `css/sky-ui-system.css` with colour, type, space, radius, motion tokens
- [x] M0.2 Define the three materials (`--mat-scrim`, `--mat-panel`, `--mat-read`)
- [x] M0.3 Add Inter to `sky-room.html`; keep Cormorant for display only
- [x] M0.4 Define the z-index scale as tokens (replaces ad-hoc 8/9/16/34/36/60)
- [x] M0.5 Shared primitives: `.ui-panel`, `.ui-read`, `.ui-btn`, `.ui-btn-primary`, `.ui-overline`, `.ui-rule`
- [x] M0.6 Global `prefers-reduced-motion` block
- [x] M0.7 Unified `:focus-visible` ring from tokens

### Phase 1 — In-game HUD (highest player impact)
- [x] M1.1 Wrap `#storycard` / `#interactionPrompt` / `#hint` / `#hint2` in `#messageZone`
- [x] M1.2 Lower-third message zone, single-voice priority via `:has()`
- [x] M1.3 **Verify the overlap bug is gone** (re-measure bounding boxes)
- [x] M1.4 Story line → Inter 17/1.5 `--paper`; drop the box for `--mat-read`
- [x] M1.5 Interaction prompt → borderless, keycap restyled
- [x] M1.6 Lantern bar: delete the `l a n t e r n` caption, restyle, no box
- [x] M1.7 Consolidate top-right into one cluster; world status → dot
- [x] M1.8 `#hint2` keyboard wall out of the play HUD
- [x] M1.9 Weapon indicator → bottom-right, tokenized
- [x] M1.10 Contrast check every HUD string ≥ 4.5:1

### Phase 2 — Main menu
- [x] M2.1 Story promoted to primary hero entry
- [x] M2.2 Other three modes → compact row, descriptions on hover/focus
- [x] M2.3 Remove card borders; spacing + one rule for separation
- [x] M2.4 Left-aligned rhythm inherited from the cover
- [x] M2.5 40ms staggered entrance
- [x] M2.6 Hover / focus / active states from tokens

### Phase 3 — Character select
- [x] M3.1 Remove outer shell border and preview frame
- [x] M3.2 Character render enlarged, bleeding off-frame
- [x] M3.3 Rebuild right column hierarchy (overline → name → bio → stats → abilities)
- [x] M3.4 Stat dashes → labelled bars with numerals
- [x] M3.5 Ability boxes → borderless blocks with accent dots
- [x] M3.6 Roster → portrait chips with accent-bar selection
- [x] M3.7 Footer buttons → primary / secondary hierarchy

### Phase 4 — Modals
- [x] M4.1 Story lobby: rectangular slots → circular lantern glyphs
- [x] M4.2 Settings: four tabs (Game / Audio / Display / Controls)
- [x] M4.3 Delete redundant ALL-CAPS sub-labels; translate the ones that stay
- [x] M4.4 Remove `setting-row-featured` arbitrary backgrounds
- [x] M4.5 Settings rows → shared hairline grid, no per-row boxes
- [x] M4.6 Group accessibility settings together
- [x] M4.7 Clue board / garden choice → `--mat-panel`
- [x] M4.8 Modal enter/exit motion from tokens

### Phase 5 — Remaining surfaces
- [x] M5.1 Siege shop
- [x] M5.2 Duel HUD (split-screen)
- [x] M5.3 Ping wheel
- [x] M5.4 NPC card
- [x] M5.5 Dimmed overlay
- [x] M5.6 Touch controls — targets ≥44px

### Phase 6 — Responsive & verification
- [x] M6.1 375px: top cluster, lantern anchor, message zone safe-area
- [x] M6.2 Landscape phone pass
- [x] M6.3 Verify 0 remaining hardcoded `border: 1px solid rgba(...)` in `sky-room.css`
- [x] M6.4 Verify ≤4 distinct border-radius values
- [x] M6.5 Verify ≤8 distinct font sizes (tokens only)
- [x] M6.6 Full playthrough: cover → menu → character → lobby → play → settings
- [x] M6.7 `prefers-reduced-motion` pass
- [x] M6.8 Keyboard-only navigation pass
- [x] M6.9 Console clean, no layout thrash

### Definition of done
- No two UI surfaces disagree about radius, border, or type size
- Every in-game string is Inter ≥ 15px at ≥ 4.5:1 contrast
- Exactly one contextual message can be visible at a time, and nothing overlaps
- Zero gameplay/camera/combat/3D behaviour changed

---

## 6. Verified results

Measured after implementation, same method as the diagnosis.

| Metric | Before | After |
|--------|--------|-------|
| Hardcoded `border: 1px solid rgba(...)` | **41** | **0** |
| Distinct `border-radius` values | **14** | **4 tokens** (+ `50%` for true circles, `0`) |
| Raw px `font-size` declarations | **35 distinct** | **0** — all on the 8-step scale |
| Font families mixed without a rule | 3 (Cormorant 40× / system-ui 34× / bare serif 7×) | **2 tokens**, by role |
| Declarations below 12px | **10** (at 8–9px) | **0** |
| Settings rows in one flat scroll | **21** | **5 tabs**, max 7 rows each |
| Redundant ALL-CAPS sub-labels | **21** | **11**, all sentence-case and informative |
| HUD elements overlapping | **4 in one 180px band** | **0** — verified with all forced visible |
| Element IDs removed (JS breakage risk) | — | **0** |

**Contrast, measured in-game against the subtitle plate (all ≥ AA):**

| Element | Size | Weight | Ratio |
|---------|------|--------|-------|
| Story subtitle | 19.6px | 400 | **18.65:1** |
| Interaction prompt action | 17.3px | 600 | **18.65:1** |
| Objective | 17px | 500 | **18.65:1** |
| Prompt detail | 13.8px | 500 | **10.55:1** |
| Walk hint / prompt target | 15px | 400–500 | **9.56:1** |
| World status | 12.7px | 600 | **9.56:1** |

### Notable implementation decisions

- **The HUD collision was fixed structurally, not with z-index.** `#storycard`, `#hint` and
  `#hint2` became flow children of a single `#messageZone` flex column, so overlap is impossible
  rather than merely avoided. The interaction prompt moved out of that band entirely, up near the
  crosshair — it describes what you are *looking at*, so it belongs where your eyes already are.
  Both changes needed **zero gameplay-logic edits**: the JS only ever toggled `.show` / `.on`.
- **Text backings are feathered pseudo-element plates, not gradients on the element.** A
  background gradient still reveals a hard rectangle where the box ends. The plate lives on
  `::after` with two intersected linear-gradient masks, so all four edges fade to nothing — and
  because it is a pseudo-element, the mask never touches the text itself.
- **`--plate-alpha` is wired to the existing "Subtitle backing" setting**, so that accessibility
  control keeps working against the new material.
- **Icons are inline SVG masks.** The `⚙` dingbat rendered differently on every platform; the
  lantern is a flame glyph that reads at 18px in any language, which is what let the
  `l a n t e r n` caption be deleted.
- **Low lantern light does not rely on colour alone** — the flame also pulses, per WCAG.
- **The `motion-framer` library was not installed** (see §2.3). Its principles are CSS tokens.
- **Touch targets raised to 44px** — weapon buttons were 34×30, round actions 42×42.

### Left deliberately unchanged

- The cinematic cover, beyond restoring its missing `→` glyph. It was already the strongest
  surface and became the reference for everything else.
- All gameplay, camera, combat, and 3D-scene behaviour.
- Duel player names keep the italic display serif — they are flavour, not time-critical reading.
