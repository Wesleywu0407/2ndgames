const EPSILON = 1e-6;

const COMPONENTS = Object.freeze([
  'floor', 'wall', 'ceiling', 'column', 'stair', 'doorway', 'window', 'prop'
]);

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
}

function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be greater than zero`);
  return value;
}

function freezePart(part) {
  return Object.freeze({
    x: 0, y: 0, z: 0,
    rotationX: 0, rotationY: 0, rotationZ: 0,
    ...part
  });
}

function freezeCollider(collider) {
  return Object.freeze({ role: 'structure', ...collider });
}

function rectanglesOverlap(a, b) {
  return Math.abs(a.x - b.x) < a.hw + b.hw - EPSILON
    && Math.abs(a.z - b.z) < a.hd + b.hd - EPSILON;
}

function pointBlocked(point, collider, radius) {
  return Math.abs(point.x - collider.x) <= collider.hw + radius
    && Math.abs(point.z - collider.z) <= collider.hd + radius;
}

function createPartPrimitives() {
  const floor = ({ id = 'floor', width, depth, y = 0.035, material = 'floor' }) => freezePart({
    id, component: 'floor', shape: 'plane', width: positive(width, 'floor width'),
    height: positive(depth, 'floor depth'), x: 0, y: finite(y, 'floor y'), z: 0,
    rotationX: -Math.PI / 2, material, solid: false
  });

  const wall = ({ id, x = 0, y, z = 0, width, height, depth, material = 'stone',
    colliderThickness = 0.3 }) => {
    const part = freezePart({
      id, component: 'wall', shape: 'box', x: finite(x, 'wall x'), y: finite(y, 'wall y'),
      z: finite(z, 'wall z'), width: positive(width, 'wall width'),
      height: positive(height, 'wall height'), depth: positive(depth, 'wall depth'), material,
      solid: true
    });
    const collider = freezeCollider({
      id, x: part.x, z: part.z, hw: part.width / 2, hd: Math.min(part.depth / 2 + 0.06, colliderThickness),
      y0: part.y - part.height / 2, y1: part.y + part.height / 2
    });
    return Object.freeze({ part, collider });
  };

  const sideWall = ({ id, x, y, width, height, depth, material = 'stone',
    colliderThickness = 0.3 }) => {
    const part = freezePart({
      id, component: 'wall', shape: 'box', x: finite(x, 'side wall x'), y: finite(y, 'side wall y'),
      z: 0, width: positive(width, 'side wall width'), height: positive(height, 'side wall height'),
      depth: positive(depth, 'side wall depth'), material, solid: true
    });
    const collider = freezeCollider({
      id, x: part.x, z: 0, hw: Math.min(part.width / 2 + 0.06, colliderThickness), hd: part.depth / 2,
      y0: part.y - part.height / 2, y1: part.y + part.height / 2
    });
    return Object.freeze({ part, collider });
  };

  const ceiling = ({ id = 'roof', width, depth, baseY, radius, material = 'roof' }) => {
    const part = freezePart({
      id, component: 'ceiling', shape: 'prism', x: 0,
      y: finite(baseY, 'ceiling baseY') + positive(radius, 'ceiling radius') * 0.43, z: 0,
      radius, length: positive(width, 'ceiling width') * 1.08, sides: 3,
      rotationZ: Math.PI / 2, material, solid: true
    });
    const collider = freezeCollider({
      id, x: 0, z: 0, hw: width / 2 + 0.4, hd: positive(depth, 'ceiling depth') / 2 + 0.4,
      y0: baseY, y1: baseY + radius * 1.1
    });
    return Object.freeze({ part, collider });
  };

  const column = ({ id, x, y, z, width, height, depth, material = 'trim', solid = false }) => freezePart({
    id, component: 'column', shape: 'box', x: finite(x, 'column x'), y: finite(y, 'column y'),
    z: finite(z, 'column z'), width: positive(width, 'column width'),
    height: positive(height, 'column height'), depth: positive(depth, 'column depth'), material,
    solid: Boolean(solid)
  });

  const stair = ({ id = 'stair', x = 0, y = 0, z = 0, width, totalRise, totalRun, steps,
    material = 'floor', solid = true }) => {
    positive(width, 'stair width');
    positive(totalRise, 'stair rise');
    positive(totalRun, 'stair run');
    if (!Number.isInteger(steps) || steps < 1) throw new RangeError('stair steps must be a positive integer');
    return Object.freeze(Array.from({ length: steps }, (_, index) => {
      const height = totalRise * (index + 1) / steps;
      const depth = totalRun / steps;
      return freezePart({
        id: `${id}-${index + 1}`, component: 'stair', shape: 'box',
        x, y: y + height / 2, z: z - totalRun / 2 + depth * (index + 0.5),
        width, height, depth, material, solid: Boolean(solid)
      });
    }));
  };

  const doorway = ({ id = 'doorway', wallWidth, wallHeight, wallDepth, doorWidth, doorHeight,
    z, material = 'stone' }) => {
    positive(wallWidth, 'doorway wall width');
    positive(wallHeight, 'doorway wall height');
    positive(wallDepth, 'doorway wall depth');
    positive(doorWidth, 'doorway width');
    positive(doorHeight, 'doorway height');
    if (doorWidth >= wallWidth) throw new RangeError('doorway width must be smaller than its wall');
    if (doorHeight >= wallHeight) throw new RangeError('doorway height must be smaller than its wall');
    const sideWidth = (wallWidth - doorWidth) / 2;
    const sideOffset = (doorWidth + sideWidth) / 2;
    const lintelHeight = wallHeight - doorHeight;
    const entries = [
      wall({ id: `${id}-left`, x: -sideOffset, y: wallHeight / 2, z,
        width: sideWidth, height: wallHeight, depth: wallDepth, material }),
      wall({ id: `${id}-right`, x: sideOffset, y: wallHeight / 2, z,
        width: sideWidth, height: wallHeight, depth: wallDepth, material }),
      wall({ id: `${id}-lintel`, x: 0, y: doorHeight + lintelHeight / 2, z,
        width: doorWidth, height: lintelHeight, depth: wallDepth, material })
    ];
    return Object.freeze({
      parts: Object.freeze(entries.map(entry => freezePart({ ...entry.part, component: 'doorway' }))),
      colliders: Object.freeze(entries.map(entry => entry.collider)),
      opening: Object.freeze({ x: 0, z, width: doorWidth, height: doorHeight })
    });
  };

  const window = ({ id = 'window', x = 0, y, z = 0, width, height, frame = 0.16,
    material = 'trim', paneMaterial = 'window' }) => {
    positive(width, 'window width');
    positive(height, 'window height');
    positive(frame, 'window frame');
    if (frame * 2 >= Math.min(width, height)) throw new RangeError('window frame is too thick');
    const bars = [
      freezePart({ id: `${id}-top`, component: 'window', shape: 'box', x, y: y + height / 2 - frame / 2,
        z, width, height: frame, depth: frame, material, solid: false }),
      freezePart({ id: `${id}-bottom`, component: 'window', shape: 'box', x, y: y - height / 2 + frame / 2,
        z, width, height: frame, depth: frame, material, solid: false }),
      freezePart({ id: `${id}-left`, component: 'window', shape: 'box', x: x - width / 2 + frame / 2,
        y, z, width: frame, height: height - frame * 2, depth: frame, material, solid: false }),
      freezePart({ id: `${id}-right`, component: 'window', shape: 'box', x: x + width / 2 - frame / 2,
        y, z, width: frame, height: height - frame * 2, depth: frame, material, solid: false }),
      freezePart({ id: `${id}-pane`, component: 'window', shape: 'plane', x, y, z: z + 0.01,
        width: width - frame * 2, height: height - frame * 2, material: paneMaterial, solid: false })
    ];
    return Object.freeze(bars);
  };

  const prop = ({ id, shape = 'box', x = 0, y = 0, z = 0, width, height, depth = 0.05,
    material = 'prop', decorative = true, solid = false }) => {
    if (decorative && solid) throw new Error(`decorative prop ${id || '(unnamed)'} cannot own a collider`);
    return freezePart({
      id, component: 'prop', shape, x, y, z,
      width: positive(width, 'prop width'), height: positive(height, 'prop height'),
      depth: positive(depth, 'prop depth'), material, decorative: Boolean(decorative), solid: Boolean(solid)
    });
  };

  return Object.freeze({ floor, wall, sideWall, ceiling, column, stair, doorway, window, prop });
}

function createNavigationGuard({ width, depth, doorwayWidth, playerRadius = 0.46,
  thresholdDepth = 2.25 }) {
  positive(width, 'room width');
  positive(depth, 'room depth');
  positive(doorwayWidth, 'room doorway width');
  positive(playerRadius, 'player radius');
  const colliders = [];
  const protectedThreshold = Object.freeze({
    x: 0,
    z: depth / 2 - thresholdDepth / 2,
    hw: Math.max(0.35, doorwayWidth / 2 - playerRadius),
    hd: thresholdDepth / 2
  });

  const addCollider = (collider, role = 'furniture') => {
    const next = freezeCollider({ ...collider, role });
    for (const key of ['x', 'z', 'hw', 'hd', 'y0', 'y1']) finite(next[key], `collider ${key}`);
    positive(next.hw, 'collider half width');
    positive(next.hd, 'collider half depth');
    if (next.y1 <= next.y0) throw new RangeError('collider y1 must be greater than y0');
    if (role === 'decorative') throw new Error('decorative props must remain non-colliding');
    const blocksFeet = next.y0 < 1.2 && next.y1 > 0.05;
    if (role !== 'structure' && blocksFeet && rectanglesOverlap(next, protectedThreshold)) {
      throw new Error(`collider ${next.id || '(unnamed)'} blocks the protected doorway corridor`);
    }
    colliders.push(next);
    return next;
  };

  const validateWalkability = (targets = [{ id: 'centre', x: 0, z: 0 }], cellSize = 0.25) => {
    positive(cellSize, 'navigation cell size');
    const minX = -width / 2 + playerRadius;
    const maxX = width / 2 - playerRadius;
    const minZ = -depth / 2 + playerRadius;
    const maxZ = depth / 2 - playerRadius;
    const cols = Math.floor((maxX - minX) / cellSize) + 1;
    const rows = Math.floor((maxZ - minZ) / cellSize) + 1;
    const groundColliders = colliders.filter(collider => collider.y0 < 1.2 && collider.y1 > 0.05);
    const index = (col, row) => row * cols + col;
    const pointAt = (col, row) => ({ x: minX + col * cellSize, z: minZ + row * cellSize });
    const passable = new Uint8Array(cols * rows);
    let passableCount = 0;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const point = pointAt(col, row);
      if (groundColliders.some(collider => pointBlocked(point, collider, playerRadius))) continue;
      passable[index(col, row)] = 1;
      passableCount++;
    }
    const nearestCell = point => ({
      col: Math.max(0, Math.min(cols - 1, Math.round((point.x - minX) / cellSize))),
      row: Math.max(0, Math.min(rows - 1, Math.round((point.z - minZ) / cellSize)))
    });
    const start = nearestCell({ x: 0, z: maxZ - 0.55 });
    const startIndex = index(start.col, start.row);
    const visited = new Uint8Array(cols * rows);
    const queue = [];
    if (passable[startIndex]) {
      visited[startIndex] = 1;
      queue.push(start);
    }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const col = current.col + dc, row = current.row + dr;
        if (col < 0 || col >= cols || row < 0 || row >= rows) continue;
        const nextIndex = index(col, row);
        if (!passable[nextIndex] || visited[nextIndex]) continue;
        visited[nextIndex] = 1;
        queue.push({ col, row });
      }
    }
    const unreachableTargets = targets.filter(target => {
      const cell = nearestCell(target);
      return !visited[index(cell.col, cell.row)];
    }).map(target => target.id || 'target');
    return Object.freeze({
      walkable: unreachableTargets.length === 0,
      reachableRatio: passableCount ? queue.length / passableCount : 0,
      unreachableTargets: Object.freeze(unreachableTargets),
      colliderCount: colliders.length,
      protectedThreshold
    });
  };

  return Object.freeze({ addCollider, validateWalkability, colliders, protectedThreshold });
}

export function createModularRoomKit() {
  const parts = createPartPrimitives();

  const createSideRoomShell = ({ width, depth, height, doorWidth, doorHeight = 5.4,
    wallDepth = 0.48, roofRadius = 4.4 }) => {
    const shellParts = [];
    const colliders = [];
    const add = entry => {
      if (entry.part) {
        shellParts.push(entry.part);
        colliders.push(entry.collider);
      } else shellParts.push(entry);
    };
    add(parts.floor({ width, depth }));
    add(parts.wall({ id: 'back-wall', x: 0, y: height / 2, z: -depth / 2,
      width, height, depth: wallDepth }));
    add(parts.sideWall({ id: 'left-wall', x: -width / 2, y: height / 2,
      width: wallDepth, height, depth }));
    add(parts.sideWall({ id: 'right-wall', x: width / 2, y: height / 2,
      width: wallDepth, height, depth }));
    const doorway = parts.doorway({ wallWidth: width, wallHeight: height, wallDepth,
      doorWidth, doorHeight, z: depth / 2 });
    shellParts.push(...doorway.parts);
    colliders.push(...doorway.colliders);
    add(parts.ceiling({ width, depth, baseY: height, radius: roofRadius }));
    for (const x of [-doorWidth / 2, doorWidth / 2]) shellParts.push(parts.column({
      id: `door-column-${x < 0 ? 'left' : 'right'}`, x, y: 1.83, z: depth / 2 + 0.28,
      width: 0.34, height: 3.65, depth: 0.38
    }));
    shellParts.push(parts.prop({
      id: 'room-sign', shape: 'plane', x: 0, y: 7.15, z: depth / 2 + 0.3,
      width: 5.2, height: 0.98, material: 'sign'
    }));
    return Object.freeze({
      parts: Object.freeze(shellParts),
      colliders: Object.freeze(colliders),
      opening: doorway.opening
    });
  };

  return Object.freeze({
    components: COMPONENTS,
    parts,
    createSideRoomShell,
    createNavigationGuard
  });
}
