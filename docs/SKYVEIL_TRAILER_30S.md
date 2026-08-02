# SKYVEIL — 30-second trailer

**Status:** Storyboard for review. Nothing shot yet.
**Length:** 30s · 1920×1080 · 24fps
**Goal:** One reaction — *"I want to play this."*

---

## 1. The three things the trailer has to land

Not a mood piece. Thirty seconds to make someone want to play, which means
showing what this game has that others do not.

1. **A magical UQ.** Sandstone Great Court, round-headed arches, cloister
   passages, the Forgan Smith tower silhouette, purple jacarandas. Anyone who
   has walked that campus should recognise it in the first three seconds.
2. **They fly.** This is the signature and the previous draft missed it
   entirely. Flight is not a traversal convenience — it is the shot.
3. **Colour comes back when you win.** `ENV_RESTORE_PULSES` already drives this,
   and jacarandas are weighted `0.72` against `0.28` for everything else, so the
   blossoms carry the moment. That is the ending.

The hook is concrete and already in the script: **11:47** — *"At 11:47 the city
fled the rising dark."* A campus frozen on one minute. No narration needed.

**No memory angle.** The Unlight drains "memory, colour and life"; the trailer
shows colour and life, because those are the two you can point a camera at.

---

## 2. Cast

| Role | Character | Key clips |
|---|---|---|
| **Caretaker** | **Elian Voss** | `movement.glb` walk · `interact` |
| Fighter | **Aldous Crane** — Chancellor | `anim-fly`, `anim-fly-glide`, `anim-cast`, `anim-idle-alert` |
| Fighter | **Sylwen Yarrow** — Archive Keeper | `anim-fly`, `anim-fly-glide`, `anim-cast-b` |
| Fighter | **Kael Morrow** — Breacher | `anim-fly`, `anim-fly-hover`, `anim-strike` |
| Threat | **Hour-Eater** | `anim-entrance`, `anim-claw`, `anim-slam` |

**Elian is the caretaker in this film only.** The game roster is unchanged. It is
also the honest casting: his motion comes from the shared KayKit library while
the other three carry clips retargeted onto their own skeletons, so in a fight
beside them he would read as a stock asset. On the ground with a lantern, that
plainness is the point — he is the one person here who cannot fly.

---

## 3. Shot list

| # | Time | Shot | Asset | Motion / camera |
|---|---|---|---|---|
| 1 | 0.0–2.5 | Black. A clock face at **11:47**, unmoving. Sandstone behind it. | ✅ `artifacts/trailer/shot01-clock-1147.mp4` | Locked off. First sound is a bell that does *not* ring. |
| 2 | 2.5–5.5 | Great Court, wide. Jacarandas black and brittle, lamps dead, no colour. | Great Court + Forgan Smith silhouette | Slow drift right. Establish the place and that it is wrong. |
| 3 | 5.5–8.0 | The caretaker lights one lamp under an arch. One small warm point in a dead frame. | `elian-voss` `movement` | Human scale. Wide enough that he is small. |
| 4 | 8.0–10.5 | Three figures run the cloister toward camera. | `anim-run` ×3 | Low, tracking back. Arches strobe past. |
| 5 | 10.5–12.5 | **They lift.** Held hover, feet leaving stone. | `anim-fly` (`state: 'lift'` → `'fly'`) | Cut up as they rise. Hold the hover a beat. |
| 6 | 12.5–17.0 | **Glide over the Great Court.** Sandstone, arcades and dead jacarandas pass below. | `anim-fly-glide` (triggers at speed > 0.42) | The signature shot. Longest in the film. Chase from behind and slightly above. |
| 7 | 17.0–20.5 | The Hour-Eater rises into frame beneath them. | `hour-eater/anim-entrance` | Low angle from the court floor. They are small, it is not. |
| 8 | 20.5–23.0 | Casting from the air — Chancellor, then Sylwen. Green and amber light across sandstone. | `anim-cast`, `anim-cast-b` | Two cuts. Airborne, never grounded. |
| 9 | 23.0–25.0 | Claw swipe → Kael dives through it and strikes. | `anim-claw` → `anim-fly-hover` → `anim-strike` | Three fast cuts, ~0.6s. Handheld. |
| 10 | 25.0–28.5 | Impact. **The campus turns.** Grass and stone lerp from night to dawn, jacaranda crowns light up, every lamp pool brightens, petals thicken in the air — all the way to the horizon. | `env.finale(k)` | Pull back and up. Widest shot in the film. Let it run. |
| 11 | 28.5–30.0 | Title over the restored court. The bell finally rings. | wordmark | — |

### Cutting notes

- **Shot 6 is the sell.** 4.5 seconds while nothing before it exceeds 3. If a
  viewer stops watching after this shot, they should already want the game.
- **Shot 10 is the payoff and must not be rushed.** It is the only moment the
  campus is beautiful, and it is 3.5s against a fight cut at 0.6s. The contrast
  is the point: this is what winning looks like.
- Shots 1–3 are the only slow ones. They exist so 4–9 read as fast.
- The bell bookends: shot 1 is a bell that will not ring, shot 11 is it ringing.

### Capture detail that matters

Flight animation is two-stage in the engine — `fly` is a held hover, and
`flyGlide` only takes over once horizontal speed passes `0.42`
(`js/sky-room.js:800`). Shot 5 needs the hero near-stationary in the air; shot 6
needs real horizontal travel or the glide clip never plays and the signature
shot shows a hover instead.

---

## 4. How the character shots are actually made

Three methods were tried. The third one works.

**1 · Generate from a text description of the character — rejected.**
Identity drifts between clips and the model pulls hard toward photoreal. The
heroes are stylised and low-poly; a realistic wizard does not connect to the
thing the player enters a second later.

**2 · Render the real models frame by frame — works, but not alone.**
`qa/shot-render.html` + `scripts/shot-capture-server.mjs` step the animation
mixer by an exact delta, render, and POST each frame, so nothing depends on
requestAnimationFrame — which does not run at all in a backgrounded tab, and is
why earlier attempts froze on the first pose of a clip. The character and its
motion are then exactly the game's. What it cannot supply is a world: the output
is a correct character standing on empty ground, which reads as a test render.
The tooling stays, because it is the only way to capture the game's real
animation.

**3 · Generate from the character concept art — this is the method.**

The original character sheets already exist in Higgsfield, and they are better
source material than a low-poly render: cleaner, painterly, and the same
lineage as the cover poster. Passed as `image_references`, seedance holds the
identity across the shot.

```
image_references : the character sheets (2–3 per shot)
prompt begins    : explicit style lock — stylised low-poly toon-shaded game
                   art, NOT photoreal, NOT live action, plus the exact
                   costume details to preserve
staging          : two subjects in frame acting on each other, never one
camera           : "arcs", "cranes", "whips", "is knocked sideways"
                   — never the word zoom
```

| Character | Reference |
|---|---|
| Aldous Crane · Chancellor | `a860739c-3ba4-40fe-876a-ab764d5971f8` |
| Kael Morrow · Breacher | `69e0739c-25ef-4f1b-9af5-d130ba4c3413` |
| Sylwen Yarrow · Archive Keeper | `c76a2653-8bf7-44bc-bff5-114f6eb4974f` |
| Hour-Eater · boss | `49048bf0-465b-4505-b0c3-d5e35327e038` |

Higgsfield offers an "IN THE DARK" preset for these prompts. Decline it with
`declined_preset_id` — the shots are staged, not templated.

### Why the shots stopped feeling like zooms

The first board was a series of presentational shots: one subject each, so the
only available verb was moving the camera, and a push-in is what a shot does
when nothing is happening inside it.

The fix is staging, not camera work:

1. **Two subjects per frame, acting on each other.** The Chancellor alone can
   only be pushed in on. The Chancellor with a claw stopping over his head is an
   event, and the camera can hold still.
2. **Cut on action.** A swing begins in one shot and lands in the next.
3. **The camera is a participant** — it gets knocked sideways by the impact.
4. **The world answers.** Light hits the arch, the arch lights, the branch above
   it blossoms. Cause and effect inside one frame, across depth.

## 5. Rendering

**Shots 2–11 are captured in-engine** via `scripts/promo-record-server.mjs`, the
tool that produced the 90-second cut in `artifacts/`. **Zero credits.**

In-engine is not a budget compromise here. The campus, the flight arc, and the
restore pulse are all systems that already run; no generator can reproduce them
and stay honest about what the player gets.

**Higgsfield is optional and only for shot 1** — a painted 11:47 clock face
matching the cover poster. Everything after it must be the real game.

### Why not generate the whole film

Thirty seconds is five to eight generated clips, and the Chancellor's face, robe
and palette drift between them. The heroes are stylised low-poly; a painterly
wizard does not connect to what loads one second after the viewer clicks. A
trailer that promises a game that does not exist is worse than no trailer.

---

## 5. Shot 10 is already built

`ENV_RESTORE_PULSES` is local — it carries a `position` and `radius`
(`js/sky-room.js:1296`), so it lights the ground near a cleansed enemy and no
further. That is not the shot.

The shot is **`env.finale(k)`** (`js/sky-room/architecture.js:926`), which is
campus-wide and does all of this as `k` runs 0 → 1:

| | night → dawn |
|---|---|
| grass | `grassNight` → `grassDawn` |
| paths | `pathNight` → `pathDawn` |
| jacaranda crowns | emissive `0.62` → `0.90` |
| lamp pools | opacity `0.16` → `0.27` |
| petals | opacity `0.82` → `0.98` |

The game drives it at `dt / 5` — a five-second sweep — and it can also be set
outright with `env.finale(1)`, which `js/sky-room.js:4681` already does.

For capture, trigger it on the impact frame and let it run. Shot 10 is 3.5s
against a 5s sweep, so it shows the steepest part of the change and the title
card lands while the campus is still brightening.

`SkyAudio.finale()` exists alongside it (`js/sky-room.js:2486`), so the audio
swell for this moment is already authored.

## 6. The bell already exists

There is no audio file anywhere in the project, because none of the sound is
recorded — it is synthesised. `js/sky-audio.js:128`:

```js
// a full bell strike: hum, prime, tierce, nominal — minor-third flavor
function bell(base, t0, vol = 0.05, dur = 5, destination = master)
```

Four partials with a fast attack and a long exponential tail. Both bell moments
— the one that does not ring under shot 1, the one that does under shot 11 — are
a call away, and `SkyAudio.finale()` covers the swell under shot 10.

## 7. Progress

| Shot | State | Cost |
|---|---|---|
| 1 | ✅ `artifacts/trailer/shot01-clock-1147.mp4` · 1920×1080 · 24fps · 4.0s | 44 credits |
| 2–11 | not shot | 0 — in-engine |

**Shot 1 notes.** Four stills were generated before one was usable. Image models
draw clocks at the "10:10" advertising pose almost every time, and the first two
attempts did exactly that — beautiful, and useless, since the frozen hour is the
entire point of the shot. Describing the hands as *geometry* rather than as a
time worked: *"the short hour hand points almost straight upward, nearly touching
the XII; the long minute hand points to the LEFT and very slightly UPWARD."* The
result reads 11:45 — twelve degrees off 11:47, and imperceptible in a 2.5s shot.

Verified on the render: the hands are identical in the first and last frame.
Only petals, mist and the lantern flame move.

**Real prices**, measured with `get_cost` (which does not charge):

| | credits |
|---|---|
| image, 1K, 16:9 | 2 |
| video, 5s, 720p | 22.5 |
| video, 4s, 1080p | 36 |

At those rates a fully generated 30s film is roughly 135 credits — under 5% of
the balance. **Cost is therefore not a reason to prefer in-engine capture, and
earlier drafts of this document were wrong to imply it was.** The reason is
character consistency, and it only applies to shots with characters in them.
Shot 1 has none, which is why it is generated.

*Placement of the finished film is deliberately not decided here.*
