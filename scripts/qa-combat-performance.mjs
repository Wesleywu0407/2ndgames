import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createColliderSpatialIndex, segmentBlocked } from '../js/sky-room/camera-collision.js';

const colliders = [];
for (let index = 0; index < 725; index++) {
  const x = (index % 29) * 9 - 126;
  const z = Math.floor(index / 29) * 9 - 108;
  if (index % 4 === 0) colliders.push({ kind: 'cyl', x, z, r: 1.2, y0: 0, y1: 8 });
  else colliders.push({ kind: 'box', x, z, hw: 2.5, hd: 0.4, y0: 0, y1: 7,
    cos: Math.cos(index * 0.17), sin: Math.sin(index * 0.17) });
}

let blocked = 0;
const collisionIndex = createColliderSpatialIndex(colliders);
const start = performance.now();
// Eight simulated seconds, 60 Hz, fourteen enemies, two LOS checks each.
for (let frame = 0; frame < 480; frame++) {
  for (let enemy = 0; enemy < 14; enemy++) {
    const origin = { x: -40 + enemy * 6, y: 1.6 + enemy % 3, z: 34 };
    const target = { x: Math.sin(frame * 0.02) * 28, y: enemy % 2 ? 10 : 1.6, z: -42 };
    if (segmentBlocked(origin, target, collisionIndex)) blocked++;
    if (segmentBlocked(target, origin, collisionIndex)) blocked++;
  }
}
const elapsedMs = performance.now() - start;
assert.ok(blocked > 0, 'benchmark must exercise actual intersections');
assert.ok(elapsedMs < 1500, `combat LOS broadphase exceeded budget: ${elapsedMs.toFixed(1)}ms`);
console.log('combat performance QA passed', {
  colliders: colliders.length,
  segmentChecks: 480 * 14 * 2,
  elapsedMs: Number(elapsedMs.toFixed(1)),
  averageMsPerFrame: Number((elapsedMs / 480).toFixed(3)),
  indexedCells: collisionIndex.stats.cells
});
