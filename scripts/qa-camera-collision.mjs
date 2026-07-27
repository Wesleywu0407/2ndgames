import assert from 'node:assert/strict';
import { createColliderSpatialIndex, sweepCameraPosition } from '../js/sky-room/camera-collision.js';

class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
  copy(value) { return this.set(value.x, value.y, value.z); }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}

const sweep = (anchor, desired, colliders) => sweepCameraPosition(
  new Vec3(...anchor),
  new Vec3(...desired),
  colliders,
  { out: new Vec3() }
);

const wall = { kind: 'box', x: 0, z: -3, hw: 2, hd: 0.1, y0: 0, y1: 5, cos: 1, sin: 0 };
const clear = sweep([4, 2, 0], [4, 3, 5], [wall]);
assert.deepEqual(clear, new Vec3(4, 3, 5), 'clear camera paths should remain unchanged');

const blocked = sweep([0, 2, 0], [0, 2, -6], [wall]);
assert(blocked.z > -3 && blocked.z < 0, 'a wall should pull the camera in front of its surface');

const angle = Math.PI / 4;
const rotatedWall = {
  kind: 'box', x: 0, z: -3, hw: 2, hd: 0.1, y0: 0, y1: 5,
  cos: Math.cos(angle), sin: Math.sin(angle)
};
const rotatedHit = sweep([0, 2, 0], [-4, 2, -6], [rotatedWall]);
assert(rotatedHit.z > -6, 'rotated wall collision should shorten the camera path');

const tree = { kind: 'cyl', x: 0, z: -3, r: 0.7, y0: 0, y1: 7 };
const treeHit = sweep([0, 2, 0], [0, 3, -7], [tree]);
assert(treeHit.z > -3, 'tree collision should keep the camera in front of the trunk');

const filler = Array.from({ length: 700 }, (_, index) => ({
  kind: 'cyl', x: 80 + index % 35 * 6, z: 80 + Math.floor(index / 35) * 6,
  r: 0.7, y0: 0, y1: 7
}));
const indexedColliders = [wall, tree, ...filler];
const index = createColliderSpatialIndex(indexedColliders);
const combinedHit = sweep([0, 2, 0], [0, 2, -6], indexedColliders);
const indexedHit = sweep([0, 2, 0], [0, 2, -6], index);
assert.deepEqual(indexedHit, combinedHit, 'spatial broadphase must preserve camera collision results');
assert(index.stats.lastCandidateCount < 10, 'nearby camera sweep should reject distant collider cells');

console.info('camera collision QA passed', {
  wallDistance: Number(Math.abs(blocked.z).toFixed(2)),
  rotatedDistance: Number(Math.hypot(rotatedHit.x, rotatedHit.z).toFixed(2)),
  treeDistance: Number(Math.abs(treeHit.z).toFixed(2)),
  indexedCandidates: index.stats.lastCandidateCount
});
