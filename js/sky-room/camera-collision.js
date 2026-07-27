const EPSILON = 1e-7;

const colliderExtent = collider => ({
  x: collider.kind === 'cyl'
    ? collider.r
    : Math.abs(collider.hw * collider.cos) + Math.abs(collider.hd * collider.sin),
  z: collider.kind === 'cyl'
    ? collider.r
    : Math.abs(collider.hw * collider.sin) + Math.abs(collider.hd * collider.cos)
});

/**
 * Uniform XZ broadphase for the static campus collision set. The source array
 * may still add or remove story gates and QA walls; a length change rebuilds
 * the index lazily before the next query.
 */
export function createColliderSpatialIndex(colliders, { cellSize = 16 } = {}) {
  const cells = new Map();
  const results = [];
  const seen = new Set();
  let indexedLength = -1;
  let lastCandidateCount = 0;

  const key = (x, z) => `${x}:${z}`;
  const cell = value => Math.floor(value / cellSize);

  function rebuild() {
    cells.clear();
    for (const collider of colliders) {
      const extent = colliderExtent(collider);
      const minX = cell(collider.x - extent.x);
      const maxX = cell(collider.x + extent.x);
      const minZ = cell(collider.z - extent.z);
      const maxZ = cell(collider.z + extent.z);
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          const id = key(x, z);
          let bucket = cells.get(id);
          if (!bucket) { bucket = []; cells.set(id, bucket); }
          bucket.push(collider);
        }
      }
    }
    indexedLength = colliders.length;
  }

  function queryAabb(minX, maxX, minZ, maxZ) {
    if (indexedLength !== colliders.length) rebuild();
    results.length = 0;
    seen.clear();
    const cellMinX = cell(minX), cellMaxX = cell(maxX);
    const cellMinZ = cell(minZ), cellMaxZ = cell(maxZ);
    for (let x = cellMinX; x <= cellMaxX; x++) {
      for (let z = cellMinZ; z <= cellMaxZ; z++) {
        const bucket = cells.get(key(x, z));
        if (!bucket) continue;
        for (const collider of bucket) {
          if (seen.has(collider)) continue;
          seen.add(collider);
          results.push(collider);
        }
      }
    }
    lastCandidateCount = results.length;
    return results;
  }

  rebuild();
  return {
    source: colliders,
    queryAabb,
    queryPoint(position, radius = 1) {
      return queryAabb(position.x - radius, position.x + radius, position.z - radius, position.z + radius);
    },
    rebuild,
    get stats() {
      return { colliders: colliders.length, cells: cells.size, lastCandidateCount };
    }
  };
}

function segmentCandidates(source, origin, target, radius) {
  if (!source?.queryAabb) return source;
  return source.queryAabb(
    Math.min(origin.x, target.x) - radius,
    Math.max(origin.x, target.x) + radius,
    Math.min(origin.z, target.z) - radius,
    Math.max(origin.z, target.z) + radius
  );
}

function slabInterval(origin, direction, min, max, near, far) {
  if (Math.abs(direction) < EPSILON) {
    return origin < min || origin > max ? null : [near, far];
  }
  let a = (min - origin) / direction;
  let b = (max - origin) / direction;
  if (a > b) [a, b] = [b, a];
  near = Math.max(near, a);
  far = Math.min(far, b);
  return near <= far ? [near, far] : null;
}

function hitInflatedBox(origin, direction, maxDistance, collider, radius) {
  const rx = origin.x - collider.x;
  const rz = origin.z - collider.z;
  const ox = rx * collider.cos - rz * collider.sin;
  const oz = rx * collider.sin + rz * collider.cos;
  const dx = direction.x * collider.cos - direction.z * collider.sin;
  const dz = direction.x * collider.sin + direction.z * collider.cos;
  let near = 0;
  let far = maxDistance;
  let interval = slabInterval(ox, dx, -collider.hw - radius, collider.hw + radius, near, far);
  if (!interval) return Infinity;
  [near, far] = interval;
  interval = slabInterval(origin.y, direction.y, collider.y0 - radius, collider.y1 + radius, near, far);
  if (!interval) return Infinity;
  [near, far] = interval;
  interval = slabInterval(oz, dz, -collider.hd - radius, collider.hd + radius, near, far);
  if (!interval) return Infinity;
  [near, far] = interval;
  return far >= 0 && near <= maxDistance ? Math.max(0, near) : Infinity;
}

function hitInflatedCylinder(origin, direction, maxDistance, collider, radius) {
  const rx = origin.x - collider.x;
  const rz = origin.z - collider.z;
  const expandedRadius = collider.r + radius;
  let near = 0;
  let far = maxDistance;
  const a = direction.x * direction.x + direction.z * direction.z;
  if (a < EPSILON) {
    if (rx * rx + rz * rz > expandedRadius * expandedRadius) return Infinity;
  } else {
    const b = 2 * (rx * direction.x + rz * direction.z);
    const c = rx * rx + rz * rz - expandedRadius * expandedRadius;
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return Infinity;
    const root = Math.sqrt(discriminant);
    let entry = (-b - root) / (2 * a);
    let exit = (-b + root) / (2 * a);
    if (entry > exit) [entry, exit] = [exit, entry];
    near = Math.max(near, entry);
    far = Math.min(far, exit);
    if (near > far) return Infinity;
  }
  const vertical = slabInterval(
    origin.y, direction.y,
    collider.y0 - radius, collider.y1 + radius,
    near, far
  );
  if (!vertical) return Infinity;
  [near, far] = vertical;
  return far >= 0 && near <= maxDistance ? Math.max(0, near) : Infinity;
}

/**
 * Shared line-of-sight test for combat and camera systems. End padding keeps a
 * target touching a wall from being treated as hidden by the wall behind it.
 */
export function segmentBlocked(origin, target, colliders, {
  radius = 0.08,
  startPadding = 0.12,
  endPadding = 0.28
} = {}) {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance < EPSILON) return false;
  const direction = { x: dx / distance, y: dy / distance, z: dz / distance };
  const maxDistance = Math.max(0, distance - endPadding);
  const minX = Math.min(origin.x, target.x) - radius;
  const maxX = Math.max(origin.x, target.x) + radius;
  const minY = Math.min(origin.y, target.y) - radius;
  const maxY = Math.max(origin.y, target.y) + radius;
  const minZ = Math.min(origin.z, target.z) - radius;
  const maxZ = Math.max(origin.z, target.z) + radius;
  for (const collider of segmentCandidates(colliders, origin, target, radius)) {
    const extent = colliderExtent(collider);
    const extentX = extent.x;
    const extentZ = extent.z;
    if (collider.x + extentX < minX || collider.x - extentX > maxX
      || collider.z + extentZ < minZ || collider.z - extentZ > maxZ
      || collider.y1 < minY || collider.y0 > maxY) continue;
    const hit = collider.kind === 'cyl'
      ? hitInflatedCylinder(origin, direction, maxDistance, collider, radius)
      : hitInflatedBox(origin, direction, maxDistance, collider, radius);
    if (hit >= startPadding && hit < maxDistance) return true;
  }
  return false;
}

/**
 * Pull a third-person camera toward its anchor before it crosses simplified
 * world collision. This is a segment sweep rather than a point correction, so
 * thin walls cannot be skipped by a fast camera transition or a frame hitch.
 */
export function sweepCameraPosition(anchor, desired, colliders, {
  radius = 0.32,
  padding = 0.12,
  out = desired
} = {}) {
  const dx = desired.x - anchor.x;
  const dy = desired.y - anchor.y;
  const dz = desired.z - anchor.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance < EPSILON) return out.copy(desired);

  const direction = { x: dx / distance, y: dy / distance, z: dz / distance };
  let nearest = distance;
  for (const collider of segmentCandidates(colliders, anchor, desired, radius)) {
    const hit = collider.kind === 'cyl'
      ? hitInflatedCylinder(anchor, direction, distance, collider, radius)
      : hitInflatedBox(anchor, direction, distance, collider, radius);
    if (hit < nearest) nearest = hit;
  }

  if (nearest >= distance) return out.copy(desired);
  const safeDistance = Math.max(0.08, nearest - padding);
  return out.set(
    anchor.x + direction.x * safeDistance,
    anchor.y + direction.y * safeDistance,
    anchor.z + direction.z * safeDistance
  );
}
