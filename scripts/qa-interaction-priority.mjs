import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closeLoopingRootMotion } from '../js/sky-room/characters/animation-utils.js';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const multiplayer = read('js/sky-multiplayer.js');
const npcInteraction = read('js/sky-room/npc-interaction.js');
const residents = read('js/sky-room/resident-system.js');
const villagers = read('js/sky-room/characters/villagers.js');
const animationController = read('js/sky-room/characters/animation-controller.js');
const animationUtils = read('js/sky-room/characters/animation-utils.js');
const main = read('js/sky-room.js');
const css = read('css/sky-room.css');

assert.match(multiplayer,
  /!this\.connected \|\| !this\.inStory \|\| !this\.storySnapshot\?\.started/,
  'shared Story actions must fall back locally until the authoritative run has started');
assert.match(npcInteraction,
  /!isPrimaryInteractionReady\(\)/,
  'a ready primary interaction must take priority over resident greeting on E');
assert.match(npcInteraction,
  /interactPressed && current && !primaryInteractionReady/,
  'resident greeting priority must be rechecked in the update that consumes E');
assert.match(main,
  /interactionPromptEl\?\.classList\.contains\('on'\)[\s\S]*!interactionPromptEl\.classList\.contains\('blocked'\)/,
  'the visible unblocked interaction prompt must drive primary interaction priority');
assert.match(css,
  /#npcCard\.primary-interaction-ready \.npc-card-action \{ display: none; \}/,
  'the duplicate resident E hint must disappear while a primary interaction is ready');
assert.match(villagers,
  /get usesAuthoredAnimation\(\) \{ return state\.ready; \}/,
  'resident figures must report when their authored skeletal animation is active');
assert.match(residents,
  /if \(n\.fig\.usesAuthoredAnimation\)[\s\S]*n\.fig\.group\.rotation\.z = 0;/,
  'authored villager clips must not receive a second procedural bob and lean pass');
assert.match(animationUtils,
  /function closeLoopingRootMotion\(sourceClip\)[\s\S]*track\.values\[offset \+ 2\] -= drift\[2\] \* progress;/,
  'villager walk clips must close their authored root-motion loop without an endpoint snap');
assert.match(animationController,
  /locomotionClips\.has\(clipName\)[\s\S]*closeLoopingRootMotion\(sourceClip\)/,
  'playable imported characters, including Aldous, must receive stable walk/run loops');
assert.match(villagers,
  /state\.walking \? state\.motion < 0\.07 : state\.motion > 0\.14/,
  'villager idle/walk switching must use hysteresis instead of flickering at one threshold');
assert.match(residents,
  /const targetYaw = Math\.atan2\(-travelledX, -travelledZ\)/,
  'autonomous residents must face their resolved movement after collision handling');
assert.match(residents,
  /const actualSpeed = travelled \/ Math\.max\(dt, 1 \/ 240\)/,
  'autonomous walk animation must be driven by actual travel rather than target distance');
assert.match(residents,
  /n\.visualDt = Math\.min\(0\.12, n\.visualDt \+ dt\)/,
  'decimated resident animation updates must retain skipped frame time');

const rootMotionSource = {
  clone() {
    return {
      tracks: [{
        name: 'Hips.position',
        times: new Float32Array([0, 0.5, 1]),
        values: new Float32Array([0, 1, 2, 2, 4, 6, 4, 7, 8]),
        getValueSize: () => 3
      }]
    };
  }
};
const closedTrack = closeLoopingRootMotion(rootMotionSource).tracks[0];
assert.deepEqual([...closedTrack.values.slice(6, 9)], [...closedTrack.values.slice(0, 3)],
  'root-motion correction must make the last Hips position equal the first');
assert.deepEqual([...closedTrack.values.slice(3, 6)], [0, 1, 3],
  'root-motion correction must distribute drift while preserving the authored movement curve');

console.info('Interaction and resident motion QA passed: E priority, resolved facing, stable walk loops, and frame-time retention verified.');
