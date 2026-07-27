import assert from 'node:assert/strict';
import { segmentBlocked } from '../js/sky-room/camera-collision.js';

const box = { kind: 'box', x: 0, z: 0, hw: 1, hd: 0.3, y0: 0, y1: 5, cos: 1, sin: 0 };
const cylinder = { kind: 'cyl', x: 4, z: 0, r: 0.8, y0: 0, y1: 5 };
const origin = { x: 0, y: 1.6, z: 3 };

assert.equal(segmentBlocked(origin, { x: 0, y: 1.6, z: -3 }, [box]), true, 'wall must block an enemy hit');
assert.equal(segmentBlocked(origin, { x: 2, y: 1.6, z: 2 }, [box]), false, 'clear nearby target must remain hittable');
assert.equal(segmentBlocked({ x: 4, y: 1.6, z: 3 }, { x: 4, y: 1.6, z: -3 }, [cylinder]), true,
  'tree/cylinder must block an enemy hit');
assert.equal(segmentBlocked({ x: 0, y: 7, z: 3 }, { x: 0, y: 7, z: -3 }, [box]), false,
  'flight path above a wall must remain clear');
assert.equal(segmentBlocked(origin, { x: 0, y: 1.6, z: 0.42 }, [box], { endPadding: 0.5 }), false,
  'the target touching the near face must not be hidden by its own wall');

console.log('combat line-of-sight QA passed');
