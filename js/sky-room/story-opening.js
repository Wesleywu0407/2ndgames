import * as THREE from 'three';

export const STORY_START = Object.freeze({ x: -8, y: 1.6, z: 31, yaw: -0.55 });

export function createStoryOpening({ scene, colliders, reducedMotion = false }) {
  const root = new THREE.Group();
  root.name = 'Phase4D_OpeningSequence';
  scene.add(root);

  const memoryPosition = new THREE.Vector3(0, 1.05, 19);
  const encounterPosition = new THREE.Vector3(14, 4.4, -18);
  const exitPosition = new THREE.Vector3(0, 8, -54);
  const bossPosition = new THREE.Vector3(0, 11.5, -70);
  const restorePosition = new THREE.Vector3(15, 0.08, -19);
  const incidents = [
    { id: 'archive-slate', position: new THREE.Vector3(-12, 1.6, -68), color: 0x8fb9ff },
    { id: 'bell-rope', position: new THREE.Vector3(0, 1.6, -73), color: 0xe5bc78 },
    { id: 'mara-satchel', position: new THREE.Vector3(12, 1.6, -68), color: 0xc98be6 }
  ];

  const violet = new THREE.MeshStandardMaterial({
    color: 0x9c6bc5, emissive: 0x6f3c9f, emissiveIntensity: 1.1,
    roughness: 0.48, metalness: 0.04, transparent: true, opacity: 0.9
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xe5bc78, emissive: 0x8d5423, emissiveIntensity: 1.45,
    roughness: 0.4, metalness: 0.2
  });

  // The first destination: a grounded memory that can be reached before flight.
  const memory = new THREE.Group();
  memory.name = 'FirstCorruptedMemory';
  memory.position.copy(memoryPosition);
  const memoryCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 1), violet);
  memoryCore.rotation.z = Math.PI * 0.25;
  const memoryRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.86, 0.035, 8, 42),
    new THREE.MeshBasicMaterial({ color: 0xd7a3ff, transparent: true, opacity: 0.72 })
  );
  memoryRing.rotation.x = Math.PI / 2;
  const memoryLight = new THREE.PointLight(0xa96fe0, 7, 16, 2);
  memory.add(memoryCore, memoryRing, memoryLight);
  root.add(memory);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 1.35, 13, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x9d6bc7, transparent: true, opacity: 0.11,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  beam.position.copy(memoryPosition).setY(6.5);
  root.add(beam);

  // A readable trail whose petals travel uphill and against the natural breeze.
  const petalCount = 72;
  const petalPositions = new Float32Array(petalCount * 3);
  const petalProgress = new Float32Array(petalCount);
  const petalSeed = new Float32Array(petalCount);
  for (let index = 0; index < petalCount; index++) {
    petalProgress[index] = index / petalCount;
    petalSeed[index] = (index * 2.399963) % (Math.PI * 2);
  }
  const petalGeometry = new THREE.BufferGeometry();
  const petalAttribute = new THREE.BufferAttribute(petalPositions, 3);
  petalAttribute.setUsage(THREE.DynamicDrawUsage);
  petalGeometry.setAttribute('position', petalAttribute);
  const petalMaterial = new THREE.PointsMaterial({
    color: 0xc791ea, size: 0.2, sizeAttenuation: true,
    transparent: true, opacity: 0.95, depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const trail = new THREE.Points(petalGeometry, petalMaterial);
  trail.name = 'ReversedPetalTrail';
  trail.frustumCulled = false;
  root.add(trail);

  // A local corrupted jacaranda makes the first victory visibly consequential.
  const corruptedTree = new THREE.Group();
  corruptedTree.position.copy(restorePosition).setY(0);
  const corruptedTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x211a1d, roughness: 1 });
  const corruptedCrownMaterial = new THREE.MeshStandardMaterial({
    color: 0x160f1c, emissive: 0x120817, emissiveIntensity: 0.15, roughness: 0.96
  });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.68, 6.2, 8), corruptedTrunkMaterial);
  trunk.position.y = 3.1;
  corruptedTree.add(trunk);
  for (let index = 0; index < 5; index++) {
    const angle = index / 5 * Math.PI * 2;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.15, 1), corruptedCrownMaterial);
    crown.position.set(Math.cos(angle) * (index ? 1.55 : 0), 6.8 + (index % 2) * 0.55, Math.sin(angle) * (index ? 1.55 : 0));
    corruptedTree.add(crown);
  }
  root.add(corruptedTree);

  const restoredLight = new THREE.PointLight(0xc88cff, 0, 30, 2);
  restoredLight.position.copy(restorePosition).setY(5.5);
  root.add(restoredLight);
  const restoredLamp = new THREE.PointLight(0xffca83, 0, 24, 2);
  restoredLamp.position.copy(restorePosition).add(new THREE.Vector3(-5, 3.2, 4));
  root.add(restoredLamp);

  // Chapter I investigation points become visible after the player crosses
  // the restored cloister. Each is a physical memory incident, not a HUD-only
  // checkbox, and may be examined in any order.
  const chapterRoot = new THREE.Group();
  chapterRoot.name = 'NamesInTheCloisterIncidents';
  chapterRoot.visible = false;
  for (const incident of incidents) {
    const marker = new THREE.Group();
    marker.position.copy(incident.position).setY(0.08);
    const material = new THREE.MeshStandardMaterial({ color: incident.color, emissive: incident.color,
      emissiveIntensity: 1.1, roughness: 0.45, metalness: 0.18, transparent: true, opacity: 0.88 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.055, 8, 40), material);
    ring.rotation.x = Math.PI / 2;
    const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 1), material);
    shard.position.y = 1.25;
    const light = new THREE.PointLight(incident.color, 6, 12, 2);
    light.position.y = 1.2;
    marker.add(ring, shard, light);
    marker.userData = { id: incident.id, ring, shard, light, complete: false };
    incident.marker = marker;
    chapterRoot.add(marker);
  }
  root.add(chapterRoot);

  // A moonlit barrier keeps the cloister narratively closed until the reward.
  const gate = new THREE.Group();
  gate.name = 'CloisterMemoryGate';
  gate.position.set(0, 0, -58);
  const gateMaterial = new THREE.MeshStandardMaterial({
    color: 0x6d5680, emissive: 0x51306f, emissiveIntensity: 0.9,
    roughness: 0.52, metalness: 0.38, transparent: true, opacity: 0.86
  });
  const gateLeft = new THREE.Mesh(new THREE.BoxGeometry(4.1, 6.3, 0.28), gateMaterial);
  const gateRight = gateLeft.clone();
  gateLeft.position.set(-2.05, 3.15, 0);
  gateRight.position.set(2.05, 3.15, 0);
  const gateSeal = new THREE.Mesh(new THREE.TorusGeometry(1.35, 0.08, 10, 48), gold);
  gateSeal.position.y = 3.4;
  gate.add(gateLeft, gateRight, gateSeal);
  root.add(gate);
  const gateCollider = { kind: 'box', x: 0, z: -58, hw: 4.25, hd: 0.42, y0: 0, y1: 7, cos: 1, sin: 0 };
  colliders.push(gateCollider);

  let memoryRecovered = false;
  let encounterComplete = false;
  let enabled = true;
  let restoration = 0;
  const memoryTargetScale = new THREE.Vector3(1, 1, 1);
  const restoredCrownColour = new THREE.Color(0x8f63b7);
  const restoredCrownEmission = new THREE.Color(0x6e3c8e);
  const restoredTrunkColour = new THREE.Color(0x634b3d);

  function recoverMemory() {
    if (memoryRecovered) return false;
    memoryRecovered = true;
    return true;
  }

  function completeEncounter() {
    if (encounterComplete) return false;
    encounterComplete = true;
    const index = colliders.indexOf(gateCollider);
    if (index >= 0) colliders.splice(index, 1);
    return true;
  }

  function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled);
    root.visible = enabled;
    const index = colliders.indexOf(gateCollider);
    if (enabled && !encounterComplete && index < 0) colliders.push(gateCollider);
    if (!enabled && index >= 0) colliders.splice(index, 1);
  }

  function setChapterOneEnabled(value) { chapterRoot.visible = enabled && Boolean(value); }
  function setIncidentComplete(id, value = true) {
    const incident = incidents.find(item => item.id === id);
    if (!incident) return false;
    incident.marker.userData.complete = Boolean(value);
    return true;
  }

  function update(t, dt, playerPosition) {
    if (!enabled) return;
    const motionScale = reducedMotion ? 0.2 : 1;
    memory.rotation.y += dt * 0.42 * motionScale;
    memoryCore.rotation.x = Math.sin(t * 1.7 * motionScale) * 0.2 * motionScale;
    memoryRing.scale.setScalar(1 + Math.sin(t * 2.1 * motionScale) * 0.08 * motionScale);
    memoryLight.intensity = memoryRecovered ? 0 : 6 + Math.sin(t * 2.4 * motionScale) * 1.2 * motionScale;
    memoryTargetScale.setScalar(memoryRecovered ? 0.02 : 1);
    memory.scale.lerp(memoryTargetScale, Math.min(1, dt * 4.8));
    beam.material.opacity += ((memoryRecovered ? 0 : 0.11) - beam.material.opacity) * Math.min(1, dt * 3);

    const start = STORY_START;
    for (let index = 0; index < petalCount; index++) {
      // Progress increases toward the memory; wrapping makes the stream appear
      // to climb the path continuously instead of falling from the tree.
      const progress = (petalProgress[index] + t * 0.055 * (reducedMotion ? 0.28 : 1)) % 1;
      const eased = progress * progress * (3 - 2 * progress);
      const offset = Math.sin(progress * Math.PI * 3 + petalSeed[index]);
      petalPositions[index * 3] = THREE.MathUtils.lerp(start.x, memoryPosition.x, eased) + offset * 0.65;
      petalPositions[index * 3 + 1] = 0.15 + Math.sin(progress * Math.PI) * 0.7 + (index % 4) * 0.045;
      petalPositions[index * 3 + 2] = THREE.MathUtils.lerp(start.z, memoryPosition.z, eased) + Math.cos(petalSeed[index]) * 0.35;
    }
    petalAttribute.needsUpdate = true;
    petalMaterial.opacity += ((memoryRecovered ? 0.12 : 0.95) - petalMaterial.opacity) * Math.min(1, dt * 1.6);

    if (encounterComplete) restoration = Math.min(1, restoration + dt / 4.2);
    corruptedCrownMaterial.color.lerp(restoredCrownColour, restoration * 0.06);
    corruptedCrownMaterial.emissive.lerp(restoredCrownEmission, restoration * 0.05);
    corruptedCrownMaterial.emissiveIntensity = 0.15 + restoration * 1.05;
    corruptedTrunkMaterial.color.lerp(restoredTrunkColour, restoration * 0.04);
    restoredLight.intensity = restoration * 12;
    restoredLamp.intensity = restoration * 9;
    gateLeft.position.x = -2.05 - restoration * 4.5;
    gateRight.position.x = 2.05 + restoration * 4.5;
    gateSeal.scale.setScalar(Math.max(0.001, 1 - restoration));
    gateMaterial.opacity = 0.86 * (1 - restoration);
    gate.visible = restoration < 0.995;

    if (chapterRoot.visible) {
      for (let index = 0; index < incidents.length; index++) {
        const marker = incidents[index].marker;
        const complete = marker.userData.complete;
        marker.userData.ring.rotation.z += dt * (0.18 + index * 0.05) * motionScale;
        marker.userData.shard.rotation.y += dt * 0.55 * motionScale;
        marker.userData.shard.position.y = 1.25 + Math.sin(t * 1.6 + index) * 0.12 * motionScale;
        marker.userData.light.intensity += ((complete ? 0.7 : 6) - marker.userData.light.intensity) * Math.min(1, dt * 5);
        marker.scale.setScalar(THREE.MathUtils.lerp(marker.scale.x, complete ? 0.55 : 1, Math.min(1, dt * 5)));
      }
    }

    const distance = playerPosition ? playerPosition.distanceTo(memoryPosition) : Infinity;
    memory.userData.playerNear = !memoryRecovered && distance < 3.4;
  }

  return {
    root,
    memoryPosition,
    encounterPosition,
    exitPosition,
    bossPosition,
    restorePosition,
    recoverMemory,
    completeEncounter,
    setEnabled,
    setChapterOneEnabled,
    setIncidentComplete,
    update,
    incidents,
    get memoryRecovered() { return memoryRecovered; },
    get encounterComplete() { return encounterComplete; },
    get restoration() { return restoration; },
    get playerNearMemory() { return Boolean(memory.userData.playerNear); }
  };
}
