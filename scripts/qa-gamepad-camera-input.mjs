import assert from 'node:assert/strict';
import { applyGamepadDeadzone, createGamepadCameraInput } from '../js/sky-room/gamepad-camera-input.js';

assert.equal(applyGamepadDeadzone(0.1), 0, 'stick drift should remain inside the deadzone');
assert(applyGamepadDeadzone(0.8) > 0.7, 'large stick movement should survive the deadzone');

const buttons = Array.from({ length: 12 }, () => ({ pressed: false, value: 0 }));
const pad = { connected: true, mapping: 'standard', id: 'QA Pad', axes: [0.5, -0.7, 0.4, -0.3], buttons };
const input = createGamepadCameraInput(() => [pad]);

let sample = input.sample();
assert(sample.connected, 'a standard pad should connect');
assert(sample.moveX > 0 && sample.moveY > 0, 'left stick should map to right and forward movement');
assert(sample.lookX > 0 && sample.lookY < 0, 'right stick should preserve camera direction');

buttons[0] = { pressed: true, value: 1 };
sample = input.sample();
assert(sample.takeoffPressed && sample.rise === 1, 'A should edge-trigger takeoff and hold rise');
sample = input.sample();
assert(!sample.takeoffPressed && sample.rise === 1, 'holding A should not repeat the takeoff edge');

buttons[0] = { pressed: false, value: 0 };
buttons[1] = { pressed: true, value: 1 };
buttons[2] = { pressed: true, value: 1 };
buttons[3] = { pressed: true, value: 1 };
buttons[10] = { pressed: true, value: 1 };
sample = input.sample();
assert(sample.landPressed && sample.descend === 1, 'B should edge-trigger landing and hold descent');
assert(sample.interactPressed, 'X should edge-trigger the shared interaction action');
assert(sample.viewPressed, 'Y should edge-trigger view changes');
assert(sample.recenterPressed, 'R3 should edge-trigger the optional camera recenter');
sample = input.sample();
assert(!sample.recenterPressed, 'holding R3 should not repeat camera recenter');

console.info('gamepad camera QA passed', {
  move: [Number(sample.moveX.toFixed(2)), Number(sample.moveY.toFixed(2))],
  look: [Number(sample.lookX.toFixed(2)), Number(sample.lookY.toFixed(2))]
});
