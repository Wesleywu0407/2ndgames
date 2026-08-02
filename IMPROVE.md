# SKYVEIL Improvement Plan

## Performance objective

SKYVEIL currently renders a detailed academy, animated characters, combat
effects, lighting, shadows, post-processing, and the campus landscape in one
continuous Three.js scene. The existing adaptive-performance system reacts to
sustained slow frames, but it cannot fully solve the problem because the largest
costs remain active after degradation.

The goal of this plan is to make gameplay consistently responsive on the target
Apple M3-class laptop while preserving the SKYVEIL atmosphere and the authored
academy silhouette.

## Phase 0 — Verify the browser is using the GPU

Before changing the game, open `chrome://gpu` and capture these sections:

- `Graphics Feature Status`
- `Problems Detected`

Confirm that both WebGL and WebGL2 report `Hardware accelerated`. If either one
reports `Software only`, `Disabled`, or a software renderer, browser GPU setup
must be fixed first. Otherwise performance measurements would not represent the
game's real rendering cost.

This check determines whether the primary problem is Chrome not using the Apple
M3 GPU or the scene itself requiring further optimisation.

## Phase 1 — Stop background 3D rendering during the cover

The cinematic cover and the full 3D campus currently run at the same time. The
cover should pause the background render loop, or delay construction of the
expensive scene until the player selects **Enter the Night**.

Acceptance criteria:

- No full campus render pass while the cover video is playing.
- The cover remains visually complete using its video or poster.
- Entering the menu resumes or starts the 3D scene without a visible broken
  frame.
- Audio, language controls, and accessibility preferences remain functional.

## Phase 2 — Split the academy into visible spatial sections

The academy exterior is currently one mesh containing approximately 301,000
triangles. A single mesh prevents Three.js from hiding individual towers,
facades, roofs, or rear sections when they are outside the camera view.

Divide the academy into stable authored sections such as:

- central Great Hall and entrance;
- left and right wings;
- bell tower;
- secondary towers;
- roof groups;
- rear and distant facade groups;
- decorative windows and trim.

Each section must have reliable bounds so frustum and distance culling can remove
invisible work without changing collision or entrance alignment.

## Phase 3 — Create near, mid, and far LODs

Every major academy section should provide three levels of detail:

| Level | Use | Detail target |
| --- | --- | --- |
| Near | Player beside the building | Full silhouette, entrances, windows, and readable stone detail |
| Mid | Across the Great Court | Simplified trim, roof detail, and window depth |
| Far | Skyline and flight views | Silhouette-first geometry with minimal facade detail |

LOD transitions must avoid obvious popping. Important landmarks—the bell,
entrance, main towers, and skyline—must remain recognisable at every level.

## Phase 4 — Reduce academy geometry

Reduce the highest-detail academy from roughly 301,000 triangles to a target
range of **120,000–160,000 triangles**.

Prioritise removal of:

- hidden and internal faces;
- repeated unseen back surfaces;
- excessive subdivisions on flat stone walls;
- geometry that can be represented by normal maps;
- small roof and window details that are not readable during gameplay.

Do not change the authored entrance proportions, bell tower silhouette, collision
footprint, or SKYVEIL gothic-academy identity.

## Phase 5 — Optimise PBR textures

Convert the main environment textures to KTX2/Basis so the browser can use
GPU-friendly compressed textures.

Texture policy:

- retain higher resolution only for close hero surfaces;
- use 1024-pixel textures for distant academy and landscape materials;
- reduce normal and metallic/roughness maps before reducing the most visible
  colour texture;
- share compatible materials and texture sets between repeated sections;
- preserve the purple jacaranda and warm-window colour identity.

Texture optimisation must be evaluated using GPU memory usage and visual quality,
not only downloaded file size.

## Phase 6 — Reduce draw calls

The current scene can reach approximately 286 draw calls. The target is fewer
than **150 draw calls** during normal campus gameplay.

Use the following approaches where they preserve culling:

- instance repeated lamps, windows, benches, plants, flowers, and facade parts;
- merge only static objects that share a material and occupy the same spatial
  section;
- reuse materials instead of creating visually identical clones;
- remove duplicate fallback objects after authored models load;
- keep effect and particle budgets tied to the selected quality mode.

Large campus-wide merges must be avoided because they would recreate the current
single-mesh culling problem.

## Phase 7 — Start at a safe render resolution

The game should not begin at a high pixel ratio and wait several slow seconds
before adaptive performance reacts.

Instead:

- start Balanced and Performance modes at a conservative render scale;
- raise resolution only after stable frame-time evidence;
- lower resolution quickly when frame time remains over budget;
- use hysteresis so resolution does not repeatedly jump between levels;
- keep UI and required text at native CSS resolution while scaling only the 3D
  canvas.

## Recommended implementation order

1. Verify `chrome://gpu` hardware acceleration.
2. Pause background 3D rendering during the cover.
3. Start with a conservative render resolution.
4. Split the academy into spatial sections.
5. Produce and validate the three LOD levels.
6. Reduce the high-detail academy to 120,000–160,000 triangles.
7. Convert and resize PBR textures.
8. Reduce normal gameplay draw calls below 150.

## Validation requirements

Measure each phase independently on the same machine, browser version, viewport,
quality preset, and gameplay position. Record at least:

- average FPS and frame-time percentiles;
- draw calls and rendered triangles;
- canvas render resolution;
- GPU memory or texture allocation when available;
- model and texture load time;
- visible LOD transitions;
- academy entrance, collision, and story-path correctness.

An optimisation is accepted only when it improves repeatable gameplay metrics
without breaking the academy silhouette, purple-tree identity, lighting mood,
navigation, combat readability, or accessibility settings.
