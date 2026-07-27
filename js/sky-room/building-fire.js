import * as THREE from 'three';
import { effectBudgets } from './effect-budgets.js';

const SOCKET_DEFS = Object.freeze({
  roof: [0, 8.75, 0],
  window: [-3.15, 4.15, 6.05],
  door: [0, 1.75, 6.35],
  courtyard: [4.2, 1.15, 2.4]
});

function canvasTexture(draw, size = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  draw(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowTexture(inner, outer) {
  return canvasTexture((context, size) => {
    const gradient = context.createRadialGradient(size / 2, size * 0.62, 1, size / 2, size * 0.55, size * 0.48);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.42, inner);
    gradient.addColorStop(1, outer);
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
}

function worldPoint(def, local, target = new THREE.Vector3()) {
  const cos = Math.cos(def.ry);
  const sin = Math.sin(def.ry);
  return target.set(
    def.x + local[0] * cos + local[2] * sin,
    local[1],
    def.z - local[0] * sin + local[2] * cos
  );
}

function makeStatusSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 96;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(6.4, 1.6, 1);
  sprite.userData = { canvas, texture, key: '' };
  return sprite;
}

function updateStatusSprite(sprite, ward, tr) {
  const key = `${ward.stage}:${ward.rescueCount}:${ward.residentCount}:${Math.round(ward.restoration * 10)}`;
  if (key === sprite.userData.key) return;
  sprite.userData.key = key;
  const { canvas, texture } = sprite.userData;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'rgba(10,7,12,.86)'; context.fillRect(6, 12, 372, 72);
  context.strokeStyle = ward.stage === 'critical' ? '#ff755f' : '#e8b06a'; context.lineWidth = 3; context.strokeRect(7.5, 13.5, 369, 69);
  context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#f4e8d5'; context.font = '600 24px sans-serif';
  const text = ward.dark
    ? tr(`RESTORE ${Math.round(ward.restoration * 100)}%`, `修復 ${Math.round(ward.restoration * 100)}%`)
    : tr(`RESCUE ${ward.rescueCount}/${ward.residentCount}`, `救援 ${ward.rescueCount}/${ward.residentCount}`);
  context.fillText(text, 192, 49);
  texture.needsUpdate = true;
}

export function createBuildingFireSystem({ scene, quality = 'balanced', getAccessibility = () => ({}), tr = (en) => en }) {
  const flameTexture = glowTexture('rgba(255,245,180,1)', 'rgba(255,74,20,0)');
  const smokeTexture = glowTexture('rgba(55,45,62,.72)', 'rgba(28,20,34,0)');
  const sootTexture = glowTexture('rgba(5,3,8,.72)', 'rgba(5,3,8,0)');
  const root = new THREE.Group();
  root.name = 'BuildingFireSystem';
  scene.add(root);
  const entries = new Map();
  const temp = new THREE.Vector3();
  const fireBudget = effectBudgets(quality).buildingFire;
  const maxSockets = fireBudget.socketsPerWard;
  const stats = { activeFires: 0, activeSmoke: 0, activeEmbers: 0, visibleSockets: 0, residentsShown: 0, activeAlarms: 0, reducedSmoke: false, reducedFlash: false, maxSmokeOpacity: 0 };

  const beamGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const beamMaterial = new THREE.LineBasicMaterial({ color: 0xb9f4ff, transparent: true, opacity: 0.82, blending: THREE.AdditiveBlending });
  const beam = new THREE.Line(beamGeometry, beamMaterial);
  beam.visible = false;
  root.add(beam);

  function register(ward) {
    if (entries.has(ward.id)) return entries.get(ward.id);
    const group = new THREE.Group();
    group.name = `BuildingFire:${ward.id}`;
    root.add(group);
    const sockets = Object.entries(SOCKET_DEFS).map(([id, local], index) => {
      const socket = new THREE.Group();
      socket.position.copy(worldPoint(ward.def, local));
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flameTexture, color: index % 2 ? 0xff8a3d : 0xffbd62,
        transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      flame.scale.set(1.5, 2.8, 1);
      const glow = new THREE.PointLight(0xff7a32, 0, 19, 2);
      const emberPositions = new Float32Array(27);
      for (let emberIndex = 0; emberIndex < 9; emberIndex++) {
        emberPositions[emberIndex * 3] = ((emberIndex % 3) - 1) * 0.34;
        emberPositions[emberIndex * 3 + 1] = 0.3 + (emberIndex % 5) * 0.42;
        emberPositions[emberIndex * 3 + 2] = ((emberIndex * 7) % 5 - 2) * 0.15;
      }
      const emberGeometry = new THREE.BufferGeometry();
      emberGeometry.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3));
      const embers = new THREE.Points(emberGeometry, new THREE.PointsMaterial({
        color: 0xffc16c, size: 0.12, transparent: true, opacity: 0,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
      }));
      const smoke = [0, 1].map(smokeIndex => {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: smokeTexture, color: smokeIndex ? 0x54495a : 0x302a36,
          transparent: true, opacity: 0, depthWrite: false
        }));
        sprite.position.set((smokeIndex - 0.5) * 0.6, 1.5 + smokeIndex * 0.9, 0);
        sprite.scale.setScalar(2.6 + smokeIndex);
        socket.add(sprite);
        return sprite;
      });
      const soot = new THREE.Sprite(new THREE.SpriteMaterial({ map: sootTexture, transparent: true, opacity: 0, depthWrite: false }));
      soot.position.y = 0.25; soot.scale.set(2.7, 3.2, 1);
      socket.add(soot, embers, flame, glow);
      group.add(socket);
      return { id, local, socket, flame, glow, embers, smoke, soot };
    });

    const alarm = new THREE.Group();
    alarm.position.copy(worldPoint(ward.def, [0, 11.8, 0]));
    const alarmRing = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.09, 8, 40), new THREE.MeshBasicMaterial({
      color: 0xff6b4a, transparent: true, opacity: 0, depthWrite: false
    }));
    alarmRing.rotation.x = Math.PI / 2;
    const alarmLight = new THREE.PointLight(0xff4f35, 0, 55, 2);
    alarm.add(alarmRing, alarmLight); group.add(alarm);

    const safePoint = worldPoint(ward.def, [0, 0.06, 11.5]);
    const doorPoint = worldPoint(ward.def, [0, 0.06, 6.8]);
    const status = makeStatusSprite(); status.position.copy(safePoint).add(temp.set(0, 3.2, 0)); group.add(status);
    const residentMaterial = new THREE.MeshStandardMaterial({ color: 0xd9c6a2, emissive: 0x5c3722, emissiveIntensity: 0.5, roughness: 0.86 });
    const residents = Array.from({ length: 3 }, (_, index) => {
      const resident = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.25, 6), residentMaterial);
      resident.userData.offset = new THREE.Vector3((index - 1) * 0.62, 0.62, 0);
      resident.position.copy(doorPoint).add(temp.set((index - 1) * 0.62, 0.62, 0));
      group.add(resident);
      return resident;
    });
    const entry = { ward, group, sockets, alarm, alarmRing, alarmLight, safePoint, doorPoint, status, residents };
    entries.set(ward.id, entry);
    return entry;
  }

  function attackSocket(ward, index = 0, out = new THREE.Vector3()) {
    const entry = register(ward);
    const activeIds = ward.affectedSockets?.length ? ward.affectedSockets : ['door'];
    const id = activeIds[Math.abs(index) % activeIds.length];
    const socket = entry.sockets.find(item => item.id === id) || entry.sockets[0];
    return out.copy(socket.socket.position);
  }

  function nearestSocket(player, ward, maxDistance = 18) {
    const entry = register(ward);
    let best = null;
    let distance = maxDistance;
    for (const socket of entry.sockets) {
      const next = player.distanceTo(socket.socket.position);
      if (next < distance) { distance = next; best = socket; }
    }
    return best ? { id: best.id, position: best.socket.position, distance } : null;
  }

  function setBeam(origin, target, restoring = false) {
    const positions = beam.geometry.attributes.position;
    positions.setXYZ(0, origin.x, origin.y + 0.3, origin.z);
    positions.setXYZ(1, target.x, target.y, target.z);
    positions.needsUpdate = true;
    beam.material.color.setHex(restoring ? 0xffdc9a : 0xb9f4ff);
    beam.visible = true;
  }

  function update(t, dt, player, wards) {
    beam.visible = false;
    stats.activeFires = stats.activeSmoke = stats.activeEmbers = stats.visibleSockets = stats.residentsShown = 0;
    const accessibility = getAccessibility();
    stats.activeAlarms = 0;
    stats.maxSmokeOpacity = 0;
    stats.reducedSmoke = Boolean(accessibility.reducedSmoke);
    stats.reducedFlash = Boolean(accessibility.reducedFlash);
    for (const ward of wards) {
      const entry = register(ward);
      const distance = player ? player.distanceTo(entry.alarm.position) : Infinity;
      const visible = distance < 145;
      entry.group.visible = visible;
      if (!visible) continue;
      const threatened = ['threatened', 'igniting', 'burning', 'critical'].includes(ward.stage);
      const showStatus = ['burning', 'critical', 'scorched'].includes(ward.stage);
      const showResidents = showStatus || ward.stage === 'restored';
      const pulse = accessibility.reducedFlash ? 1 : 0.72 + Math.sin(t * 5.2 + ward.seed) * 0.28;
      entry.alarmRing.material.opacity = threatened ? 0.34 + pulse * 0.48 : 0;
      entry.alarmRing.scale.setScalar(1 + (accessibility.reducedFlash ? 0 : Math.sin(t * 3.1) * 0.08));
      entry.alarmLight.intensity = threatened ? 5 + pulse * 8 : 0;
      if (threatened) stats.activeAlarms++;
      entry.alarm.rotation.y += dt * (accessibility.reducedFlash ? 0.35 : 1.1);
      const affected = new Set((ward.affectedSockets || []).slice(0, maxSockets));
      for (const socket of entry.sockets) {
        const active = affected.has(socket.id) && ward.fireIntensity > 0 && !ward.dark;
        const amount = active ? Math.max(0.18, ward.fireIntensity) : 0;
        const close = distance < 95;
        socket.flame.visible = close && active;
        socket.flame.material.opacity = close ? amount * (accessibility.reducedFlash ? 0.72 : 0.72 + Math.sin(t * 8 + socket.local[0]) * 0.2) : 0;
        socket.flame.scale.set(1.25 + amount * 1.6, 2.2 + amount * 4.2, 1);
        socket.flame.position.y = accessibility.reducedFlash ? 0.7 : 0.65 + Math.sin(t * 6.4 + socket.local[2]) * 0.18;
        socket.glow.intensity = close && active ? amount * 13 : 0;
        socket.embers.visible = close && active;
        socket.embers.material.opacity = close && active ? amount * (accessibility.reducedFlash ? 0.34 : 0.7) : 0;
        socket.embers.rotation.y += dt * (0.5 + amount);
        socket.embers.position.y = active ? ((t * 0.65 + ward.seed + socket.local[0]) % 1.4) : 0;
        socket.soot.material.opacity = ward.stage === 'scorched' ? 0.68 : amount * 0.32;
        if (active) { stats.activeFires++; stats.visibleSockets++; if (close) stats.activeEmbers++; }
        for (let smokeIndex = 0; smokeIndex < socket.smoke.length; smokeIndex++) {
          const smoke = socket.smoke[smokeIndex];
          const smokeVisible = active && distance < 78;
          smoke.visible = smokeVisible;
          smoke.material.opacity = smokeVisible ? amount * (accessibility.reducedSmoke ? 0.12 : 0.34) : 0;
          stats.maxSmokeOpacity = Math.max(stats.maxSmokeOpacity, smoke.material.opacity);
          if (!accessibility.reducedSmoke) {
            smoke.position.y = 1.6 + smokeIndex * 1.1 + ((t * (0.34 + smokeIndex * 0.08) + ward.seed) % 2.4);
            smoke.position.x = Math.sin(t * 0.7 + smokeIndex + ward.seed) * (0.5 + amount);
          }
          if (smokeVisible) stats.activeSmoke++;
        }
      }
      entry.status.visible = showStatus;
      if (showStatus) updateStatusSprite(entry.status, ward, tr);
      entry.residents.forEach((resident, index) => {
        resident.visible = showResidents;
        if (!showResidents) return;
        const rescued = ward.stage !== 'restored' && index < ward.rescueCount;
        const target = rescued ? entry.safePoint : entry.doorPoint;
        resident.userData.offset.z = rescued ? index * 0.34 : 0;
        resident.position.lerp(temp.copy(target).add(resident.userData.offset), Math.min(1, dt * 2.8));
        resident.rotation.y += dt * (rescued ? 0.3 : 1.2);
        stats.residentsShown++;
      });
    }
  }

  function dispose() {
    scene.remove(root);
    root.traverse(object => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach(material => material.dispose?.());
    });
    flameTexture.dispose(); smokeTexture.dispose(); sootTexture.dispose();
  }

  return {
    register, attackSocket, nearestSocket, setBeam, update, dispose,
    get stats() {
      const wardCapacity = entries.size;
      const fireCapacity = wardCapacity * maxSockets;
      return {
        ...stats,
        capacity: {
          wards: wardCapacity,
          alarms: wardCapacity,
          fires: fireCapacity,
          smoke: fireCapacity * fireBudget.smokeSpritesPerSocket,
          embers: fireCapacity,
          residents: wardCapacity * fireBudget.residentsPerWard,
          socketsPerWard: maxSockets
        }
      };
    }
  };
}

export { SOCKET_DEFS, worldPoint };
