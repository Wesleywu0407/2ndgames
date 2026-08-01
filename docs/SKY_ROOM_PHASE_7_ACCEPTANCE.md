# Sky Room — Phase 7 physical acceptance sheet

This sheet separates repeatable automated evidence from tests that require a real input device, physical GPU, multiple computers, or an unfamiliar player. Do not mark a physical item complete from browser automation alone.

## Automated evidence — 2026-07-17

- [x] Six-room camera transition sweep: Great Hall and all five side rooms switched between ground-shoulder and indoor profiles.
- [x] Camera obstruction recovery: blocker faded to `0.161`, one occluder was active, then the original material and `1.0` opacity were restored.
- [x] Isolated real-WebSocket LAN: 1/2/3/4-player rosters, remote projectile visibility, 150 ms ordering, first-player departure, brief reconnect, and four-player late join passed on temporary port `57562` with a temporary database.
- [x] Combined-load effect budget: 12 enemies, 3 fires, 6 smoke sprites, 3 embers, 3 residents, and 1 alarm stayed inside Balanced limits.
- [x] Performance-preset fire QA: the fire-state suite and combined combat/fire probe now derive the critical fire target from the active two-socket budget; both passed live after the former hard-coded three-socket assertion was removed.
- [x] In-app software-rendered degradation check: 34.7 average FPS, 44 ms p95, 269 draw calls, 72,932 triangles, no scheduler pauses, and correct `adaptive-performance` activation.
- [x] Browser console remained free of errors and warnings during the camera, obstruction, and combined-load probes.

The software-rendered performance result proves graceful degradation only. It is not a physical Mac GPU result.

## A. Physical Mac performance

Use the same Mac and Chrome version for both presets. Close unrelated GPU-heavy tabs and keep the browser visible and focused.

1. Open `http://127.0.0.1:4322/sky-room.html?story-coop-qa=1&perf-probe=1`.
2. Select Balanced, wait five seconds, then run **TEST COMBINED LOAD**.
3. Record the `[Sky QA] performance probe` console result.
4. Repeat on Performance quality after a full reload.

| Preset | Average FPS | p95 frame ms | Draw calls | Triangles | Adaptive activated | Pass |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Balanced |  |  |  |  |  | [ ] |
| Performance |  |  |  |  |  | [ ] |

Target: approach 60 FPS / 16.7 ms on the reference Mac. A slower device may use Performance or adaptive mode, but sustained p95 above 33.3 ms must be recorded as a performance failure.

## B. Ten-minute camera and input soak

Record the device used and run without reloading:

- Minutes 0–2: ground walking, 720° left and right rotation, pointer-lock enter/exit, and `T` recenter.
- Minutes 2–4: enter and leave Great Hall, Archive, Workshop, Infirmary, Practice Hall, and Owl Post on foot.
- Minutes 4–6: first takeoff, 720° flight rotation, rise/descent, first/third-person toggle, and landing.
- Minutes 6–8: repeat landing/takeoff ten times. Only the first story takeoff may use the long ritual.
- Minutes 8–10: fly close to roofs and trees, walk beside walls, trigger obstruction fading, and recover the camera.

| Input | Device/model | Completed | No stuck input | No forced reset | No trapped view |
| --- | --- | --- | --- | --- | --- |
| Keyboard + mouse |  | [ ] | [ ] | [ ] | [ ] |
| Trackpad |  | [ ] | [ ] | [ ] | [ ] |
| Gamepad |  | [ ] | [ ] | [ ] | [ ] |
| Touch |  | [ ] | [ ] | [ ] | [ ] |

Failure rule: any unrecoverable angle, stuck pointer, repeated flight ritual, lost heading, ceiling penetration, or required objective hidden by the camera is a Phase 7 failure, not polish.

## C. Physical 1/2/4-device LAN

Start only one server. If port `4322` reports `EADDRINUSE`, the server is already running—do not start a second copy.

| Test | 1 player | 2 players | 4 players |
| --- | --- | --- | --- |
| Correct lobby roster and ready state | [ ] | [ ] | [ ] |
| Remote movement and visible projectiles | [ ] | [ ] | [ ] |
| Story/Siege objective agreement | [ ] | [ ] | [ ] |
| Remote Dimmed and nearby revive | [ ] | [ ] | [ ] |
| Late join receives current state | [ ] | [ ] | [ ] |
| First player leaves without reset | — | [ ] | [ ] |
| Brief disconnect rejoins correctly | — | [ ] | [ ] |
| 150 ms delayed connection preserves order | — | [ ] | [ ] |
| Mission completion persists after reconnect | [ ] | [ ] | [ ] |

Record each device, browser, local IP, and any observable desync. The isolated automation can be repeated with:

```sh
node scripts/qa-lan-transport.mjs
```

## D. Unfamiliar-player pacing test

The tester must not read the Director Plan and should receive no explanation unless progression becomes impossible.

| Observation | Result |
| --- | --- |
| Tester/device |  |
| Solo or party size |  |
| Start time |  |
| First building attack understood at |  |
| First interior objective completed at |  |
| Campus restored at |  |
| Total completion time |  |
| Asked what to do next at |  |
| Missed danger or unreadable UI |  |
| Camera/input confusion |  |
| LAN/desync confusion |  |
| Unprompted positive moment |  |

Acceptance target: first completion is approximately 30–45 minutes without filler. Write every confusion point before explaining anything to the tester.

## Final sign-off

- [ ] All four physical input rows pass.
- [ ] Balanced and Performance have physical Mac results.
- [ ] Physical 1/2/4-device LAN matrix passes.
- [ ] At least one unfamiliar-player session is recorded.
- [ ] Complete session remains inside the agreed performance target.
- [ ] No Blocker, Combat failure, or Readability failure remains open.

Phase 7 is complete only after all six sign-off items are checked.
