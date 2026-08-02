# SKYVEIL — 30-second trailer

**Status:** Storyboard for review. Nothing shot yet.
**Length:** 30s · 1920×1080 · 24fps
**Placement:** Not the cover loop. See §5.

---

## 1. What the trailer is about

**The hour stopped, and something is eating it.**

Not memory. "Recover the lost memories" is abstract — there is no shot you can
point a camera at. The boss is called the **Hour-Eater**, and the campaign is
called **The Twelfth Bell**: the concrete version is already in the material.

A bell that stopped. A night that will not end. Every clock on campus frozen at
the same minute. Something in the garden is the reason.

That premise needs no narration. It can be read from three shots.

The one line worth keeping from the existing script is not about remembering:

> They took the bell first, because a bell is how a place remembers to be afraid.

---

## 2. Cast

| Role | Character | Why |
|---|---|---|
| **Caretaker** | **Elian Voss** | Non-combat. He carries the lantern, lights the lamps, opens the garden. |
| Fighter | **Aldous Crane** — the Chancellor | `anim-cast`, `anim-cast-b`, `anim-idle-alert` |
| Fighter | **Sylwen Yarrow** — the Archive Keeper | `anim-cast`, `anim-cast-b`, `anim-idle-listen` |
| Fighter | **Kael Morrow** — the Breacher | `anim-strike`, `anim-idle-box`, `anim-idle-taunt` |
| Threat | **Hour-Eater** | `anim-entrance`, `anim-claw`, `anim-slam`, `anim-idle` |

**Elian is the caretaker here, in this film only.** The game roster is not
changing. This casting is also a technical fit rather than a compromise: his
motion comes from the shared KayKit library (`general.glb`, `movement.glb`),
while the other three carry clips retargeted onto their own skeletons. Beside
them he would read as a stock asset in a fight. Walking a corridor with a
lantern, that same plainness is exactly right — and his animation list already
contains `interact`, which is the door.

---

## 3. Shot list

Every shot below maps to an asset that exists today. No shot depends on
something being modelled, rigged, or generated first.

| # | Time | Shot | Asset | Motion / camera |
|---|---|---|---|---|
| 1 | 0.0–3.5 | Bell tower against the night. The pendulum is still. | establishing — see §4 | Slow push in. No cut. |
| 2 | 3.5–6.0 | Close: the bell's edge, unmoving. Jacaranda petals drift *upward* past it. | engine | Locked off. Petals are the only motion. |
| 3 | 6.0–9.0 | Corridor. The caretaker walks it, lighting lamps. Every clock he passes reads the same minute. | `elian-voss` + `movement.glb` | Tracking alongside, matched to his pace. |
| 4 | 9.0–11.5 | He stops at the garden door and opens it. | `elian-voss` `interact` | Behind him. He does not go through. |
| 5 | 11.5–14.0 | The Chancellor, lit from below, listening. | `chancellor/anim-idle-alert` | Slow rise from waist to face. |
| 6 | 14.0–16.5 | Sylwen casts — green light spills across the stone. | `sylwen-yarrow/anim-cast-b` | Static, wide enough to hold the light. |
| 7 | 16.5–18.5 | Kael strikes. | `kael-morrow/anim-strike` | Handheld, tight, cut on the impact frame. |
| 8 | 18.5–23.0 | **The Hour-Eater arrives.** | `hour-eater/anim-entrance` | Low angle, wide, slowest shot in the film. Let it finish. |
| 9 | 23.0–25.5 | Claw / dodge, cut against each other. | `anim-claw` ↔ heroes `anim-dodge` | Three cuts, ~0.8s each. |
| 10 | 25.5–28.0 | Slam. Frame shakes. Every lamp in shot goes out. | `anim-slam` | Impact, then hold on black. |
| 11 | 28.0–30.0 | Title. | existing wordmark | The bell rings once, over black. |

### Notes on cutting

- **Shot 8 is the film.** It runs 4.5s while nothing else runs over 3. The
  entrance animation was authored with its own timing; do not trim it to fit a
  rhythm. Everything before it is shorter so that it feels long.
- **Shots 1–4 have no combat and no cuts under 2.5s.** The contrast is what
  makes shots 5–10 read as fast.
- The bell in shot 11 is the first bell in the film. Shot 2 established that it
  had stopped; the last sound is it starting again.

---

## 4. What is rendered where

**Shots 2–11 are captured in-engine.** The tooling already exists —
`scripts/promo-record-server.mjs` is what produced the 90-second cut in
`artifacts/`. Cost: **zero credits**.

In-engine also means the trailer cannot misrepresent the game. Whatever a
viewer sees is what loads when they press ENTER THE NIGHT.

**Shot 1 is the only candidate for Higgsfield** — a painted establishing frame,
matching the existing cover poster, that the engine has no equivalent for. It is
a single ~4s clip.

### Why not generate the whole thing

Character consistency. Thirty seconds is five to eight generated clips, and the
Chancellor's face, robe and palette drift between them. The heroes are stylised
low-poly; a painterly or photoreal wizard does not connect to the thing the
player enters one second later. A trailer that promises a game that does not
exist is worse than no trailer.

---

## 5. Where it goes — not the cover

The cover video is **8s / 3.4 MB**. The same bitrate at 30s is roughly **13 MB**,
and it plays behind the wordmark while the visitor decides whether to click. Most
leave within about five seconds, so most of that download is never seen, and it
competes with the CTA it sits behind. The cover's job is to get people in.

Proposed instead:

- Cover keeps a short seamless loop (the current 8s already works).
- The 30s film is a **trailer**, opened deliberately: the Sky Room card in the
  gallery lobby, or a quiet secondary control on the cover.

---

## 6. Open questions

1. Shot 1 — Higgsfield painted frame, or in-engine like the rest?
2. Sound. The bell in shots 2 and 11 is doing structural work; is there a bell
   recording, or does it need to be made?
3. Where exactly the trailer opens from — lobby card, or cover.
