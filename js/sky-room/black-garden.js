import * as THREE from 'three';

export const BLACK_GARDEN_ENTRY = Object.freeze([0, 1.6, -76]);
export const BLACK_GARDEN_SPAWN = Object.freeze([92, 1.6, 99]);

const RELAY_DEFS = Object.freeze([
  { id: 'root', position: [82, 1.6, 86], color: 0xd89a68 },
  { id: 'canopy', position: [92, 10, 79], color: 0xb58ae4 },
  { id: 'well', position: [102, 1.6, 86], color: 0x7fc4bd }
]);

export function createBlackGarden({ scene, reducedMotion = false }) {
  const root = new THREE.Group();
  root.name = 'ChapterTwoBlackGarden';
  scene.add(root);

  const entryPosition = new THREE.Vector3(...BLACK_GARDEN_ENTRY);
  const spawnPosition = new THREE.Vector3(...BLACK_GARDEN_SPAWN);
  const center = new THREE.Vector3(92, 1.6, 86);
  const arena = new THREE.Group();
  arena.position.set(center.x, 0, center.z);
  root.add(arena);

  const entry = new THREE.Group();
  entry.position.set(entryPosition.x, 0.08, entryPosition.z);
  const entryRing = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.075, 10, 64),
    new THREE.MeshBasicMaterial({ color: 0xb989d7, transparent: true, opacity: 0.72 }));
  entryRing.rotation.x = Math.PI / 2;
  const entryRoots = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.22, 8, 36, Math.PI * 1.45),
    new THREE.MeshStandardMaterial({ color: 0x30221e, emissive: 0x351b42, emissiveIntensity: 0.6, roughness: 1 }));
  entryRoots.rotation.set(Math.PI / 2, 0, -0.7);
  const entryLight = new THREE.PointLight(0xb989d7, 8, 20, 2);
  entryLight.position.y = 1.2;
  entry.add(entryRing, entryRoots, entryLight);
  root.add(entry);

  const earth = new THREE.Mesh(new THREE.CircleGeometry(24, 72), new THREE.MeshStandardMaterial({
    color: 0x0e1512, emissive: 0x120c19, emissiveIntensity: 0.32, roughness: 1,
    transparent: true, opacity: 0.97
  }));
  earth.rotation.x = -Math.PI / 2;
  earth.position.y = 0.045;
  arena.add(earth);

  const underglow = new THREE.Mesh(new THREE.RingGeometry(4.5, 23.5, 72), new THREE.MeshBasicMaterial({
    color: 0x5d326d, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false
  }));
  underglow.rotation.x = -Math.PI / 2;
  underglow.position.y = 0.07;
  arena.add(underglow);

  const rootMaterial = new THREE.MeshStandardMaterial({ color: 0x261b17, roughness: 1, emissive: 0x1a101c, emissiveIntensity: 0.38 });
  for (let index = 0; index < 18; index++) {
    const angle = index / 18 * Math.PI * 2;
    const length = 7 + (index % 5) * 2.1;
    const tendril = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.34, length, 7), rootMaterial);
    tendril.position.set(Math.cos(angle) * length * 0.48, 0.24, Math.sin(angle) * length * 0.48);
    tendril.rotation.z = Math.PI / 2;
    tendril.rotation.y = -angle;
    arena.add(tendril);
  }
  for (let index = 0; index < 9; index++) {
    const angle = index / 9 * Math.PI * 2;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(7.5 + (index % 3) * 3.2, 0.22, 7, 42, Math.PI * 0.72), rootMaterial);
    arch.position.set(Math.cos(angle) * 10.5, 0.1, Math.sin(angle) * 10.5);
    arch.rotation.set(Math.PI / 2, angle, angle + Math.PI * 0.15);
    arena.add(arch);
  }

  const relayMap = new Map();
  for (const def of RELAY_DEFS) {
    const group = new THREE.Group();
    group.position.set(def.position[0] - center.x, def.position[1] - 1.6, def.position[2] - center.z);
    const material = new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color,
      emissiveIntensity: 1.35, roughness: 0.42, metalness: 0.18, transparent: true, opacity: 0.92 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.07, 8, 48), material);
    ring.rotation.x = Math.PI / 2;
    const flame = new THREE.Mesh(new THREE.OctahedronGeometry(0.48, 1), material);
    flame.position.y = 1.25;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.4, 8, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.08,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    column.position.y = 4;
    const light = new THREE.PointLight(def.color, 8, 18, 2);
    light.position.y = 1.2;
    group.add(ring, flame, column, light);
    group.userData = { id: def.id, active: false, ring, flame, column, light, material };
    arena.add(group);
    relayMap.set(def.id, { id: def.id, position: new THREE.Vector3(...def.position), group });
  }

  const echoMaterial = new THREE.MeshBasicMaterial({ color: 0xf0d7a4, transparent: true, opacity: 0.38, wireframe: true });
  const echoes = [];
  for (let index = 0; index < 3; index++) {
    const echo = new THREE.Mesh(new THREE.OctahedronGeometry(0.72, 1), echoMaterial.clone());
    echo.visible = false;
    arena.add(echo);
    echoes.push(echo);
  }

  const boss = new THREE.Group();
  boss.position.y = 2.1;
  const bossCloth = new THREE.MeshStandardMaterial({ color: 0x111710, emissive: 0x2b1238, emissiveIntensity: 0.58, roughness: 0.96 });
  const bossWood = new THREE.MeshStandardMaterial({ color: 0x33251c, emissive: 0x2a142c, emissiveIntensity: 0.42, roughness: 1 });
  const bossMask = new THREE.MeshStandardMaterial({ color: 0xa18b6e, emissive: 0x5d315c, emissiveIntensity: 0.5, roughness: 0.82 });
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.45, 5.4, 9, 3, true), bossCloth);
  body.position.y = -0.25;
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.1, 0.22), bossMask);
  mask.position.set(0, 2.12, 0.8);
  boss.add(body, mask);
  for (const side of [-1, 1]) for (let index = 0; index < 3; index++) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.16, 2.1 - index * 0.18, 7), bossWood);
    branch.position.set(side * (0.52 + index * 0.35), 2.55 + index * 0.36, 0);
    branch.rotation.z = side * (0.55 + index * 0.24);
    boss.add(branch);
  }
  const bossCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.52, 1), new THREE.MeshStandardMaterial({
    color: 0xbe75d8, emissive: 0x8c3eaa, emissiveIntensity: 2.2, roughness: 0.3
  }));
  bossCore.position.set(0, 0.65, 0.92);
  const bossLight = new THREE.PointLight(0xa34ac2, 11, 25, 2);
  bossLight.position.set(0, 0.8, 0.7);
  boss.add(bossCore, bossLight);
  arena.add(boss);

  const hazardRings = [6.2, 10.2, 14.2].map(radius => {
    const mesh = new THREE.Mesh(new THREE.RingGeometry(radius - 0.75, radius + 0.75, 72), new THREE.MeshBasicMaterial({
      color: 0xe86d4d, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false
    }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.1;
    arena.add(mesh);
    return { radius, mesh };
  });

  const restoredCrown = new THREE.Group();
  const restoredMat = new THREE.MeshStandardMaterial({ color: 0x8b5eb1, emissive: 0x6d388b, emissiveIntensity: 1.2, roughness: 0.72 });
  for (let index = 0; index < 7; index++) {
    const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + (index % 2) * 0.45, 1), restoredMat);
    const angle = index / 7 * Math.PI * 2;
    bloom.position.set(Math.cos(angle) * 3, 5.8 + (index % 3) * 0.7, Math.sin(angle) * 3);
    restoredCrown.add(bloom);
  }
  restoredCrown.visible = false;
  arena.add(restoredCrown);

  let phase = 0;
  let partySize = 1;
  let bossHp = 0;
  let bossMaxHp = 12;
  let bossStage = 1;
  let outcome = null;
  let hitFlash = 0;
  let lastHazardCycle = -1;
  const activeRelays = new Set();

  function setSnapshot(snapshot = {}) {
    phase = Math.max(0, Number(snapshot.phase) || 0);
    partySize = Math.max(1, Math.min(4, Number(snapshot.partySize) || 1));
    bossHp = Math.max(0, Number(snapshot.bossHp) || 0);
    bossMaxHp = Math.max(1, Number(snapshot.bossMaxHp) || 12);
    bossStage = Math.max(1, Number(snapshot.bossStage) || 1);
    outcome = snapshot.gardenOutcome || outcome;
    activeRelays.clear();
    for (const id of Array.isArray(snapshot.relays) ? snapshot.relays : []) activeRelays.add(id);
    syncVisibility();
  }

  function syncVisibility() {
    root.visible = phase >= 6;
    entry.visible = phase === 6;
    arena.visible = phase >= 7;
    boss.visible = phase >= 8 && phase <= 9;
    restoredCrown.visible = phase >= 10;
    for (const [id, relay] of relayMap) {
      relay.group.visible = phase >= 7;
      relay.group.userData.active = activeRelays.has(id);
    }
  }

  function nearestRelay(position, radius = 5.1) {
    let nearest = null;
    let best = radius;
    for (const relay of relayMap.values()) {
      if (activeRelays.has(relay.id)) continue;
      const distance = position.distanceTo(relay.position);
      if (distance < best) { best = distance; nearest = relay; }
    }
    return nearest;
  }

  function activateOfflineRelay(id) {
    if (!relayMap.has(id)) return false;
    activeRelays.add(id);
    if (activeRelays.size >= RELAY_DEFS.length) {
      phase = 8; bossMaxHp = 12; bossHp = bossMaxHp; bossStage = 1;
    }
    syncVisibility();
    return true;
  }

  function tryHit(position, radius, damage = 1, weapon = 1) {
    if (phase !== 8 || !boss.visible) return false;
    const bossWorld = center.clone().add(new THREE.Vector3(0, 2.7, 0));
    if (bossWorld.distanceTo(position) > 2.8 + radius) return false;
    hitFlash = 1;
    return { weapon, damage };
  }

  function damageOffline(damage) {
    bossHp = Math.max(0, bossHp - Math.max(0, Number(damage) || 0));
    bossStage = bossHp <= bossMaxHp * 0.55 ? 2 : 1;
    if (bossHp <= bossMaxHp * 0.2) phase = 9;
    syncVisibility();
    return phase;
  }

  function chooseOffline(choice) {
    outcome = choice === 'break' ? 'break' : 'restore';
    phase = 10;
    syncVisibility();
  }

  function update(t, dt, playerPosition, onHazard = () => {}) {
    if (!root.visible) return;
    const motion = reducedMotion ? 0.22 : 1;
    entryRing.rotation.z += dt * 0.25 * motion;
    entryRoots.rotation.z = -0.7 + Math.sin(t * 0.5) * 0.08 * motion;
    entryLight.intensity = 7 + Math.sin(t * 1.7) * 1.4 * motion;
    underglow.material.opacity = 0.075 + Math.sin(t * 0.6) * 0.025 * motion;

    let echoIndex = 0;
    for (const [id, relay] of relayMap) {
      const data = relay.group.userData;
      const active = activeRelays.has(id);
      data.ring.rotation.z += dt * (active ? 0.52 : 0.18) * motion;
      data.flame.rotation.y += dt * 0.8 * motion;
      data.flame.position.y = 1.25 + Math.sin(t * 1.8 + echoIndex) * 0.12 * motion;
      data.material.emissiveIntensity += ((active ? 2.8 : 1.25) - data.material.emissiveIntensity) * Math.min(1, dt * 5);
      data.light.intensity += ((active ? 13 : 7) - data.light.intensity) * Math.min(1, dt * 4);
      data.column.material.opacity = active ? 0.18 : 0.06;
      const echo = echoes[echoIndex++];
      echo.visible = partySize === 1 && active && phase === 7;
      if (echo.visible) {
        echo.position.copy(relay.group.position).add(new THREE.Vector3(0, 2.8, 0));
        echo.rotation.y += dt * 0.7 * motion;
        echo.material.opacity = 0.28 + Math.sin(t * 1.5) * 0.1 * motion;
      }
    }

    hitFlash = Math.max(0, hitFlash - dt * 4);
    bossCloth.emissiveIntensity = 0.55 + hitFlash * 2.2 + (bossStage - 1) * 0.35;
    bossCore.material.emissiveIntensity = 1.8 + hitFlash * 3 + Math.sin(t * 2.4) * 0.35 * motion;
    boss.rotation.y = Math.sin(t * 0.3) * 0.22 * motion;
    boss.position.y = 2.1 + Math.sin(t * 0.8) * 0.12 * motion;

    const cycleLength = bossStage >= 2 ? 3.8 : 4.7;
    const cycle = Math.floor(t / cycleLength);
    const progress = (t % cycleLength) / cycleLength;
    const ringCount = Math.min(3, Math.max(1, partySize - 1 + bossStage));
    for (let index = 0; index < hazardRings.length; index++) {
      const hazard = hazardRings[index];
      const enabled = phase === 8 && index < ringCount;
      const telegraph = enabled && progress > 0.48 && progress < 0.82;
      const striking = enabled && progress >= 0.82 && progress < 0.9;
      hazard.mesh.material.opacity = striking ? 0.9 : telegraph ? 0.18 + (progress - 0.48) * 1.25 : 0;
      hazard.mesh.scale.setScalar(striking ? 1.02 : 0.98 + progress * 0.025);
    }
    if (phase === 8 && progress >= 0.82 && progress < 0.9 && cycle !== lastHazardCycle && playerPosition) {
      const horizontal = Math.hypot(playerPosition.x - center.x, playerPosition.z - center.z);
      const grounded = playerPosition.y < 5.2;
      const struck = hazardRings.slice(0, ringCount).some(hazard => Math.abs(horizontal - hazard.radius) < 1.55);
      if (grounded && struck) {
        lastHazardCycle = cycle;
        const direction = playerPosition.clone().sub(center).setY(0).normalize();
        onHazard(direction, bossStage >= 2 ? 22 : 16);
      }
    }
    if (phase >= 10) {
      restoredCrown.rotation.y += dt * 0.08 * motion;
      restoredMat.emissiveIntensity += ((outcome === 'break' ? 0.7 : 1.65) - restoredMat.emissiveIntensity) * Math.min(1, dt * 2);
    }
  }

  syncVisibility();
  return {
    root, entryPosition, spawnPosition, center, relays: [...relayMap.values()],
    setSnapshot, nearestRelay, activateOfflineRelay, tryHit, damageOffline, chooseOffline, update,
    beginOffline() { phase = 7; activeRelays.clear(); syncVisibility(); },
    markHit() { hitFlash = 1; },
    get phase() { return phase; },
    get relayCount() { return activeRelays.size; },
    get bossHp() { return bossHp; },
    get bossMaxHp() { return bossMaxHp; },
    get bossStage() { return bossStage; },
    get outcome() { return outcome; }
  };
}
