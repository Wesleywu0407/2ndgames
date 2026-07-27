import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CAMERA_PITCH_LIMITS, cameraRecenterPlan, clampCameraPitch,
  groundCameraLookTargetY, shortestAngleDelta
} from '../js/sky-room/camera-heading.js';

const skyRoomSource = await readFile(new URL('../js/sky-room.js', import.meta.url), 'utf8');

assert(Math.abs(shortestAngleDelta(Math.PI - 0.05, -Math.PI + 0.05) - 0.1) < 1e-9,
  'recenter should cross the ±π boundary by the shortest route');

const stationary = cameraRecenterPlan({ yaw: 1.7, pitch: 0.48, state: 'ground' });
assert.equal(stationary.toYaw, 1.7, 'stationary recenter should preserve heading');
assert.equal(stationary.toPitch, 0.08, 'ground recenter should restore the neutral ground pitch');

const moving = cameraRecenterPlan({ yaw: -2.8, pitch: -0.6, velocityX: -1, velocityZ: 0, state: 'flying' });
assert(Math.abs(Math.sin(moving.toYaw) - 1) < 1e-9, 'moving recenter should face the travel direction');
assert.equal(moving.toPitch, 0.02, 'flight recenter should restore the neutral flight pitch');
assert.equal(moving.duration, 0.24, 'recenter should remain a short optional action');

assert(Object.isFrozen(moving), 'camera recenter plans should be immutable');

assert.equal(clampCameraPitch(-99, 'ground'), CAMERA_PITCH_LIMITS.ground.min,
  'ground camera must retain a useful downward view');
assert.equal(clampCameraPitch(99, 'ground'), CAMERA_PITCH_LIMITS.ground.max,
  'ground camera must permit looking up at building roofs');
assert.equal(clampCameraPitch(99, 'flying'), CAMERA_PITCH_LIMITS.flying.max,
  'flight camera pitch should retain its wider range');

const groundY = 1.6;
const maximumUpPitch = CAMERA_PITCH_LIMITS.ground.max;
const highLookTarget = groundCameraLookTargetY(groundY, maximumUpPitch);
const highCameraY = groundY + 1.65 + Math.sin(maximumUpPitch) * 1.4;
assert(highLookTarget > highCameraY + 1,
  'maximum ground pitch must aim above the camera instead of below the player');
assert.match(skyRoomSource,
  /state === 'lifting' \|\| \(state === 'flying' && !firstPerson\)[\s\S]*takeoff-chase/,
  'the visible avatar must use a third-person chase camera throughout first takeoff');

console.info('camera heading QA passed', {
  stationary, moving, limits: CAMERA_PITCH_LIMITS,
  maximumUpView: { highLookTarget, highCameraY }
});
