import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createModularRoomKit } from '../js/sky-room/room-shell-kit.js';

const WIDTH = 11.5;
const DEPTH = 12.5;
const HEIGHT = 8.4;
const DOOR_WIDTH = 3.5;
const kit = createModularRoomKit();

assert.deepEqual(kit.components,
  ['floor', 'wall', 'ceiling', 'column', 'stair', 'doorway', 'window', 'prop'],
  'the reusable room kit exposes every Phase 5 architecture primitive');

const shell = kit.createSideRoomShell({
  width: WIDTH, depth: DEPTH, height: HEIGHT, doorWidth: DOOR_WIDTH
});
assert.equal(shell.parts.length, 11, 'side-room shell has one authored reusable part list');
assert.equal(shell.colliders.length, 7, 'side-room shell has one matching structural collider list');
assert.equal(shell.opening.width, DOOR_WIDTH);
assert.equal(shell.opening.height, 5.4);
assert.equal(shell.parts.filter(part => part.component === 'floor').length, 1);
assert.equal(shell.parts.filter(part => part.component === 'wall').length, 3);
assert.equal(shell.parts.filter(part => part.component === 'doorway').length, 3);
assert.equal(shell.parts.filter(part => part.component === 'ceiling').length, 1);
assert.equal(shell.parts.filter(part => part.component === 'column').length, 2);
assert.equal(shell.parts.filter(part => part.component === 'prop').length, 1);
assert.ok(shell.parts.every(part => Object.isFrozen(part)), 'shell descriptors are immutable');

const steps = kit.parts.stair({ width: 3.2, totalRise: 1.2, totalRun: 2.4, steps: 4 });
assert.equal(steps.length, 4);
assert.ok(steps.every((step, index) => step.component === 'stair' && step.height === 0.3 * (index + 1)));
const windowParts = kit.parts.window({ y: 3, width: 2.4, height: 3.2 });
assert.equal(windowParts.length, 5, 'window kit contains four frame pieces and one pane');
assert.equal(windowParts.at(-1).shape, 'plane');
assert.throws(() => kit.parts.prop({
  id: 'bad-decoration', width: 1, height: 1, decorative: true, solid: true
}), /cannot own a collider/, 'decorative props cannot silently become collision traps');

const furniture = Object.freeze({
  archive: [
    { id: 'west-shelves', x: -4.7, z: -0.6, hw: 0.42, hd: 4.3, y0: 0, y1: 5.5 },
    { id: 'east-shelves', x: 4.7, z: -0.6, hw: 0.42, hd: 4.3, y0: 0, y1: 5.5 },
    { id: 'reading-desk', x: 0, z: -2.4, hw: 1.7, hd: 0.95, y0: 0, y1: 1.2 }
  ],
  alchemy: [
    { id: 'west-bench', x: -3.25, z: -0.45, hw: 1.25, hd: 3.9, y0: 0, y1: 1.2 },
    { id: 'east-bench', x: 3.25, z: -0.45, hw: 1.25, hd: 3.9, y0: 0, y1: 1.2 },
    { id: 'solar-vat', x: 0, z: -3.6, hw: 0.9, hd: 0.9, y0: 0, y1: 1.3 },
    { id: 'lunar-vat', x: 0, z: 1.8, hw: 0.9, hd: 0.9, y0: 0, y1: 1.3 }
  ],
  infirmary: [-3.25, 3.25].flatMap(x => [-3.25, 1.5].map(z => ({
    id: `bed-${x}-${z}`, x, z, hw: 1.2, hd: 1.78, y0: 0, y1: 1
  }))),
  practice: [],
  owlpost: [
    { id: 'sorting-desk', x: 0, z: -3.8, hw: 1.52, hd: 0.76, y0: 0, y1: 1.08 }
  ]
});

for (const [roomId, roomFurniture] of Object.entries(furniture)) {
  const guard = kit.createNavigationGuard({
    width: WIDTH, depth: DEPTH, doorwayWidth: DOOR_WIDTH
  });
  for (const collider of shell.colliders) guard.addCollider(collider, 'structure');
  for (const collider of roomFurniture) guard.addCollider(collider, 'furniture');
  const report = guard.validateWalkability([
    { id: 'inside-anchor', x: 0, z: DEPTH / 2 - 2.1 },
    { id: 'centre-anchor', x: 0, z: 0 }
  ]);
  assert.equal(report.walkable, true, `${roomId} keeps a ground route from its door to its centre`);
  assert.ok(report.reachableRatio > 0.35, `${roomId} retains meaningful walkable floor area`);
}

const blockedGuard = kit.createNavigationGuard({
  width: WIDTH, depth: DEPTH, doorwayWidth: DOOR_WIDTH
});
assert.throws(() => blockedGuard.addCollider({
  id: 'door-blocker', x: 0, z: DEPTH / 2 - 1, hw: 1.5, hd: 0.5, y0: 0, y1: 2
}, 'furniture'), /protected doorway corridor/, 'solid furniture cannot block the entry/exit route');
assert.throws(() => blockedGuard.addCollider({
  id: 'decorative-crate', x: 3, z: 0, hw: 0.5, hd: 0.5, y0: 0, y1: 1
}, 'decorative'), /non-colliding/, 'decorative collider registration is rejected everywhere');

const architectureSource = await readFile(new URL('../js/sky-room/architecture.js', import.meta.url), 'utf8');
assert.match(architectureSource, /createModularRoomKit\(\)/,
  'runtime architecture consumes the modular room kit');
assert.match(architectureSource, /navigationGuard\.validateWalkability/,
  'runtime room construction performs the anti-trap navigation check');
assert.doesNotMatch(architectureSource, /const frontW = \(W - DOOR\) \/ 2/,
  'the old duplicated side-room doorway shell is removed');

console.log('Room shell kit QA passed: 8 primitives, 5 navigable rooms, protected doorways, non-colliding decoration.');
