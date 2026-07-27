const underRoot = (object, root) => {
  for (let current = object; current; current = current.parent) {
    if (current === root) return true;
  }
  return false;
};

const materialsOf = material => Array.isArray(material) ? material : [material];

const visibleInHierarchy = object => {
  for (let current = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
};

/**
 * Fades only meshes directly blocking the player. Materials are cloned while
 * faded so shared campus materials never make an entire building disappear.
 */
export function createCameraOcclusion({ THREE, scene, camera, ignoreRoot }) {
  const raycaster = new THREE.Raycaster();
  const direction = new THREE.Vector3();
  let candidates = [];
  let refreshElapsed = Infinity;
  let rayElapsed = Infinity;
  let activeCount = 0;
  const entries = new Map();

  const eligible = object => object?.isMesh && !object.isInstancedMesh && object.geometry
    && visibleInHierarchy(object) && !underRoot(object, ignoreRoot) && !object.userData?.cameraFadeDisabled
    && materialsOf(object.material).some(material => material && material.visible !== false && material.depthTest !== false);

  const refreshCandidates = () => {
    candidates = [];
    scene.traverse(object => { if (eligible(object)) candidates.push(object); });
    refreshElapsed = 0;
    return candidates.length;
  };

  const ensureEntry = mesh => {
    if (entries.has(mesh)) return entries.get(mesh);
    const original = mesh.material;
    const originalMaterials = materialsOf(original);
    const clones = originalMaterials.map(material => {
      const clone = material.clone();
      clone.transparent = true;
      clone.depthWrite = false;
      clone.needsUpdate = true;
      return clone;
    });
    mesh.material = Array.isArray(original) ? clones : clones[0];
    const entry = {
      mesh,
      original,
      clones,
      baseOpacity: originalMaterials.map(material => Number.isFinite(material.opacity) ? material.opacity : 1),
      amount: 1,
      hit: true
    };
    entries.set(mesh, entry);
    return entry;
  };

  const restore = entry => {
    entry.mesh.material = entry.original;
    for (const material of entry.clones) material.dispose();
    entries.delete(entry.mesh);
  };

  const scan = target => {
    for (const entry of entries.values()) entry.hit = false;
    direction.copy(target).sub(camera.position);
    const distance = direction.length();
    if (distance < 0.5) return;
    direction.multiplyScalar(1 / distance);
    raycaster.set(camera.position, direction);
    raycaster.near = 0.04;
    raycaster.far = Math.max(0.05, distance - 0.34);
    const hits = raycaster.intersectObjects(candidates, false);
    let accepted = 0;
    const seen = new Set();
    for (const hit of hits) {
      const mesh = hit.object;
      if (!eligible(mesh) || seen.has(mesh)) continue;
      seen.add(mesh);
      ensureEntry(mesh).hit = true;
      accepted++;
      if (accepted >= 4) break;
    }
  };

  return {
    get activeCount() { return activeCount; },
    refreshCandidates,
    update(dt, target, enabled = true) {
      refreshElapsed += dt;
      rayElapsed += dt;
      if (refreshElapsed >= 1.25) refreshCandidates();
      if (enabled && rayElapsed >= 0.09) {
        rayElapsed = 0;
        scan(target);
      } else if (!enabled) {
        for (const entry of entries.values()) entry.hit = false;
      }

      activeCount = 0;
      for (const entry of [...entries.values()]) {
        const targetAmount = entry.hit ? 0.16 : 1;
        const speed = entry.hit ? 13 : 8;
        entry.amount += (targetAmount - entry.amount) * (1 - Math.exp(-dt * speed));
        for (let index = 0; index < entry.clones.length; index++) {
          entry.clones[index].opacity = entry.baseOpacity[index] * entry.amount;
        }
        if (entry.hit || entry.amount < 0.985) activeCount++;
        if (!entry.hit && entry.amount >= 0.985) restore(entry);
      }
    },
    dispose() {
      for (const entry of [...entries.values()]) restore(entry);
      candidates = [];
    }
  };
}
