# Story Mode Boss Lifecycle

This is the current source of truth for when a Story boss may exist, become
visible, attack, take damage, and leave the scene. Older planning documents may
describe an early Bell Warden apparition; that design is no longer used.

## Player-facing rule

A visible boss must always belong to an active encounter. Story investigation,
travel, voting, and post-fight decision phases must never leave an invulnerable
or inactive boss standing in the world.

## Phase contract

| Phase | Story beat | Physical boss | Combat |
| --- | --- | --- | --- |
| 0–1 | Opening memory and flight | Hidden | Off |
| 2 | Corrupted Stray encounter | No boss | Stray active |
| 3 | Restored cloister threshold | Hidden; bell narration only | Off |
| 4–6 | Investigation, vote, garden entrance | Hidden | Off |
| 7 | Charge three Black Garden relays | Hidden | Off |
| 8 | Groundskeeper encounter | Visible after the third relay | Active |
| 9 | Garden memory choice | Hidden | Off |
| 10 | Restored campus | Hidden | Off |

The Bell Warden / Hour-Eater asset remains available to Siege, explicit combat
QA, and enemy showcase routes. It is not spawned as a passive Story apparition.

## Runtime ownership

- `server/story.js` owns shared phase progression, relay completion, boss HP,
  boss stage, hit validation, and late-join snapshots.
- `js/sky-room.js` applies shared snapshots, clears prologue enemies, narrates
  the Phase 3 threshold, and routes player attacks.
- `js/sky-room/black-garden.js` owns Groundskeeper visibility, entrance timing,
  animation, hazard telegraphs, and local single-player state.
- `scripts/qa-story-enemy-lifecycle.mjs` guards the visibility and phase rules.
- `scripts/qa-story-combat-server.mjs` guards authoritative damage, party
  scaling, range checks, and late-join boss state.

## Required invariants

1. Phase 3 may play story text and audio, but it must not call a boss spawn
   function or load the Hour-Eater model.
2. The Groundskeeper is visible only when `phase === 8` and `bossHp > 0`.
3. Entering Phase 8 resets the encounter clock and hazard cycle.
4. The entrance animation completes before the first hazard can strike.
5. Phase 9 immediately hides the boss and clears every hazard-ring opacity.
6. Repeated Phase 8 snapshots must not restart the entrance or attack clock.
7. A reconnect directly into Phase 8 must receive the current shared HP while
   starting a clean local entrance presentation.

## Automated checks

Run these commands after changing Story phases, bosses, relays, or enemy
lifecycle code:

```bash
node --check js/sky-room.js
node --check js/sky-room/black-garden.js
node --check server/story.js
node scripts/qa-story-enemy-lifecycle.mjs
node scripts/qa-story-combat-server.mjs
```

## Browser QA

1. Start an isolated Living World server:

   ```bash
   SKY_WORLD_PORT=4327 \
   SKY_WORLD_DB_PATH=/tmp/sky-room-story-boss-qa.db \
   node server/living-world.js
   ```

2. Open `http://127.0.0.1:4327/sky-room.html?story-coop-qa=1`.
3. Start Story Mode and use **ENTER BLACK GARDEN**.
4. Confirm Phase 7 shows the relays and no boss.
5. Use **CHARGE 3 RELAYS** and confirm Phase 8 starts only after all three.
6. Confirm the boss completes its entrance, faces the player, and produces an
   orange root-ring telegraph before a strike.
7. Use **OPEN BOSS CHOICE** and confirm Phase 9 has no visible boss or rings.
8. Check the browser console for errors.

When the QA query flag is active, the game canvas exposes `data-boss-state`
with phase, visibility, HP, entrance time, combat readiness, and hazard opacity.
This attribute is not written in normal play.

