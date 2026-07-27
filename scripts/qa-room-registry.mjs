import assert from 'node:assert/strict';
import { createRoomRegistry } from '../js/sky-room/room-registry.js';

const HALL = { x: 0, z: -80, w: 34, d: 18, h: 24, ry: 0 };
const EXPLORABLES = [
  { id: 'archive', x: -35, z: -25, ry: 0.95, title: 'MOON ARCHIVE' },
  { id: 'alchemy', x: 35, z: -27, ry: -0.91, title: "ALCHEMIST'S WORKSHOP" },
  { id: 'infirmary', x: -52, z: -8, ry: 1.42, title: 'MOON INFIRMARY' },
  { id: 'practice', x: 52, z: -10, ry: -1.38, title: 'PRACTICE HALL' },
  { id: 'owlpost', x: 0, z: 45, ry: Math.PI, title: 'OWL POST' }
];

const registry = createRoomRegistry({ hall: HALL, explorables: EXPLORABLES });
assert.equal(registry.rooms.length, 6, 'all six authored rooms are registered');
assert.deepEqual(registry.rooms.map(room => room.id),
  ['great-hall', 'archive', 'alchemy', 'infirmary', 'practice', 'owlpost']);

for (const room of registry.rooms) {
  assert.equal(room.camera.profile, 'indoor', `${room.id} has an indoor camera profile`);
  assert.equal(room.fireSockets.length, 4, `${room.id} has authored fire sockets`);
  assert.equal(room.restorationSockets.length, 3, `${room.id} has authored restoration sockets`);
  assert.ok(room.anchors.entrance.local.z > room.anchors.inside.local.z,
    `${room.id} entrance remains outside its inside navigation anchor`);
  const local = registry.worldToLocal(room, room.anchors.entrance.world);
  assert.ok(Math.abs(local.x - room.anchors.entrance.local.x) < 1e-9);
  assert.ok(Math.abs(local.z - room.anchors.entrance.local.z) < 1e-9);
  assert.ok(registry.contains(room, { x: room.center.x, y: room.floor + 0.2, z: room.center.z }),
    `${room.id} centre is inside its gameplay volume`);
  assert.ok(!registry.contains(room, { x: room.center.x + 100, y: room.floor, z: room.center.z }),
    `${room.id} rejects distant points`);
}

assert.equal(registry.byTitle('great hall')?.id, 'great-hall');
assert.equal(registry.roomAt({ x: -35, y: 1, z: -25 })?.id, 'archive');
assert.equal(registry.cameraAt({ x: 0, y: 2, z: -80 })?.id, 'great-hall');
assert.equal(registry.get('owlpost')?.purpose, 'messages');
assert.equal(registry.qaSummary().length, 6);

assert.equal(registry.groundSurfaceAt({ x: 0, z: -80 }), 1.4,
  'Great Hall interior uses its raised floor');
assert.equal(registry.groundSurfaceAt({ x: 0, z: -70.3 }), 1.15,
  'Great Hall highest entrance step is walkable');
assert.equal(registry.groundSurfaceAt({ x: 0, z: -69.15 }), 0.8,
  'Great Hall middle entrance step is walkable');
assert.equal(registry.groundSurfaceAt({ x: 0, z: -68 }), 0.45,
  'Great Hall lowest entrance step is walkable');
assert.equal(registry.groundSurfaceAt({ x: 5, z: -68 }), 0,
  'ground outside the entrance stair footprint stays at terrain height');

console.log('Room registry QA passed: 6 rooms, shared camera/navigation/streaming/fire/restoration contracts.');
