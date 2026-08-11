const SIDE_ROOM = Object.freeze({
  width: 11.5,
  depth: 12.5,
  height: 8.4,
  floor: 0,
  streamDistance: 38
});

export const GREAT_HALL_ENTRY_STEPS = Object.freeze([
  Object.freeze({ width: 6.4, height: 1.15, zOffset: 0.7, depth: 1.2 }),
  Object.freeze({ width: 6.9, height: 0.8, zOffset: 1.85, depth: 1.2 }),
  Object.freeze({ width: 7.4, height: 0.45, zOffset: 3, depth: 1.2 })
]);

const ROOM_PURPOSES = Object.freeze({
  archive: 'evidence',
  alchemy: 'weapon-reactions',
  infirmary: 'recovery',
  practice: 'combat-training',
  owlpost: 'messages'
});

function worldPoint(room, point) {
  const cos = Math.cos(room.rotation);
  const sin = Math.sin(room.rotation);
  return Object.freeze({
    x: room.center.x + point.x * cos + point.z * sin,
    y: point.y,
    z: room.center.z - point.x * sin + point.z * cos
  });
}

function localPoint(room, point) {
  const dx = point.x - room.center.x;
  const dz = point.z - room.center.z;
  const cos = Math.cos(room.rotation);
  const sin = Math.sin(room.rotation);
  return {
    x: dx * cos - dz * sin,
    y: point.y,
    z: dx * sin + dz * cos
  };
}

function finishRoom(spec) {
  const room = {
    ...spec,
    center: Object.freeze({ ...spec.center }),
    camera: Object.freeze({ ...spec.camera }),
    cameraBounds: Object.freeze({ ...spec.cameraBounds })
  };
  const anchors = {
    entrance: { x: 0, y: room.floor + 0.035, z: room.navigationDepth / 2 + 2.6 },
    inside: { x: 0, y: room.floor + 0.035, z: room.navigationDepth / 2 - 2.1 },
    centre: { x: 0, y: room.floor + 0.035, z: 0 },
    service: { x: 0, y: room.floor + 0.035, z: -room.depth * 0.28 }
  };
  room.anchors = Object.freeze(Object.fromEntries(Object.entries(anchors).map(([name, local]) => [name,
    Object.freeze({ local: Object.freeze(local), world: worldPoint(room, local) })
  ])));
  room.fireSockets = Object.freeze([
    { id: 'front-left', local: { x: -room.width * 0.28, y: room.floor + room.height * 0.72, z: room.depth * 0.42 } },
    { id: 'front-right', local: { x: room.width * 0.28, y: room.floor + room.height * 0.72, z: room.depth * 0.42 } },
    { id: 'roof', local: { x: 0, y: room.floor + room.height, z: 0 } },
    { id: 'rear', local: { x: 0, y: room.floor + room.height * 0.58, z: -room.depth * 0.45 } }
  ].map(socket => Object.freeze({
    id: socket.id,
    local: Object.freeze(socket.local),
    world: worldPoint(room, socket.local)
  })));
  room.restorationSockets = Object.freeze([
    { id: 'threshold', local: anchors.inside },
    { id: 'heart', local: { x: 0, y: room.floor + 0.08, z: 0 } },
    { id: 'service', local: anchors.service }
  ].map(socket => Object.freeze({
    id: socket.id,
    local: Object.freeze({ ...socket.local }),
    world: worldPoint(room, socket.local)
  })));
  return Object.freeze(room);
}

/**
 * Shared authored room data. Camera, streaming, navigation, fire, and
 * restoration systems consume this registry so entrances cannot drift apart.
 */
export function createRoomRegistry({ hall, explorables }) {
  const greatHall = finishRoom({
    id: 'great-hall',
    title: 'GREAT HALL',
    purpose: 'refuge',
    center: { x: hall.x, z: hall.z },
    rotation: hall.ry,
    width: hall.w - 2,
    depth: hall.d - 2,
    height: 14,
    floor: 1.4,
    navigationDepth: hall.d,
    streamDistance: 46,
    camera: { profile: 'indoor', distance: 3.15, shoulder: 0.36, height: 1.32, pitchLift: 0.8 },
    cameraBounds: { width: hall.w - 0.8, depth: hall.d - 0.8, minY: 0, maxY: 10 }
  });
  const sideRooms = explorables.map(def => finishRoom({
    id: def.id,
    title: def.title,
    purpose: ROOM_PURPOSES[def.id] || 'service',
    center: { x: def.x, z: def.z },
    rotation: def.ry,
    ...SIDE_ROOM,
    navigationDepth: SIDE_ROOM.depth,
    camera: { profile: 'indoor', distance: 3.15, shoulder: 0.36, height: 1.32, pitchLift: 0.8 },
    cameraBounds: { width: 10.7, depth: 11.9, minY: 0, maxY: 10 }
  }));
  const rooms = Object.freeze([greatHall, ...sideRooms]);
  const byId = new Map(rooms.map(room => [room.id, room]));
  const byRoomTitle = new Map(rooms.map(room => [room.title.toLowerCase(), room]));
  const resolve = roomOrId => typeof roomOrId === 'string' ? byId.get(roomOrId) : roomOrId;
  const groundSurfaceAt = position => {
    if (!position) return 0;
    const local = localPoint(greatHall, position);
    const halfWidth = greatHall.width / 2;
    const halfDepth = greatHall.depth / 2;
    let surface = 0;

    if (Math.abs(local.x) <= halfWidth
      && local.z >= -halfDepth && local.z <= halfDepth) {
      surface = greatHall.floor;
    }

    // Bridge the short doorway threshold between the interior floor and the
    // highest exterior step. Without this surface the player drops into the
    // plinth gap while crossing the arch.
    const topStep = GREAT_HALL_ENTRY_STEPS[0];
    if (Math.abs(local.x) <= topStep.width / 2
      && local.z > halfDepth
      && local.z <= greatHall.navigationDepth / 2 + topStep.zOffset - topStep.depth / 2) {
      surface = Math.max(surface, greatHall.floor);
    }

    for (const step of GREAT_HALL_ENTRY_STEPS) {
      const centreZ = greatHall.navigationDepth / 2 + step.zOffset;
      if (Math.abs(local.x) <= step.width / 2
        && Math.abs(local.z - centreZ) <= step.depth / 2) {
        surface = Math.max(surface, step.height);
      }
    }
    return surface;
  };

  const contains = (roomOrId, position, padding = 0.5) => {
    const room = resolve(roomOrId);
    if (!room || !position) return false;
    const local = localPoint(room, position);
    return Math.abs(local.x) < room.width / 2 - padding
      && Math.abs(local.z) < room.depth / 2 - padding
      && position.y >= room.floor - 1.6
      && position.y < room.floor + room.height;
  };
  const cameraContains = (room, position) => {
    const local = localPoint(room, position);
    const bounds = room.cameraBounds;
    return Math.abs(local.x) < bounds.width / 2
      && Math.abs(local.z) < bounds.depth / 2
      && position.y >= bounds.minY
      && position.y <= bounds.maxY;
  };

  return Object.freeze({
    rooms,
    get: id => byId.get(id) || null,
    byTitle: title => byRoomTitle.get(String(title).toLowerCase()) || null,
    worldToLocal: (roomOrId, position) => {
      const room = resolve(roomOrId);
      return room ? localPoint(room, position) : null;
    },
    localToWorld: (roomOrId, point) => {
      const room = resolve(roomOrId);
      return room ? worldPoint(room, point) : null;
    },
    groundSurfaceAt,
    contains,
    cameraContains: (roomOrId, position) => {
      const room = resolve(roomOrId);
      return Boolean(room && position && cameraContains(room, position));
    },
    roomAt: position => rooms.find(room => contains(room, position)) || null,
    cameraAt: position => rooms.find(room => cameraContains(room, position)) || null,
    qaSummary: () => rooms.map(room => ({
      id: room.id,
      purpose: room.purpose,
      streamDistance: room.streamDistance,
      fireSockets: room.fireSockets.length,
      restorationSockets: room.restorationSockets.length
    }))
  });
}
