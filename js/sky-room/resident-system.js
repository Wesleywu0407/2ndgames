import * as THREE from 'three';

/* ================= Outdoor residents ================= */
// A small night population for the courtyard and the road to the academy.
// Walkers use wrappers so CloakedFigure can keep animating its own local scale.
export function createResidentSystem({
  scene, HALL, roomRegistry, SPELL_TARGETS, HUNT_R,
  characterProfile, ResidentCharacter, livingWorld,
  storyCard, tr, resolveCollisions, lerp,
  getWeapon, isRuntimePerformance, getMode, isSiegeActive, getGamePhase,
  qaCanvas = null
}) {
  const residents = [];
  let knockdowns = 0;
  let residentNumber = 0;
  let residentFrame = 0;
  const doorX = HALL.x + (HALL.d / 2 + 3.2) * Math.sin(HALL.ry);
  const doorZ = HALL.z + (HALL.d / 2 + 3.2) * Math.cos(HALL.ry);
  const doorLen = Math.hypot(doorX, doorZ);
  // Begin inside the court so the population reads from the opening camera,
  // then naturally funnels onto the narrower causeway.
  const roadStart = new THREE.Vector3(doorX / doorLen * 13.5, 0.035, doorZ / doorLen * 13.5);
  const roadEnd = new THREE.Vector3(doorX, 0.035, doorZ);
  const roadDir = new THREE.Vector3().subVectors(roadEnd, roadStart).normalize();
  const roadSide = new THREE.Vector3(-roadDir.z, 0, roadDir.x);
  const navTarget = new THREE.Vector3();
  const navStep = new THREE.Vector3();
  const navProbe = new THREE.Vector3();
  const locationDefs = new Map(roomRegistry.rooms.map(room => [room.title.toLowerCase(), room]));

  const makeResident = ({ scale = 1, phase = 0 }) => {
    const id = `resident-${String(++residentNumber).padStart(2, '0')}`;
    const profile = characterProfile(id);
    const fig = ResidentCharacter(profile);
    const root = new THREE.Group();
    const visualHeight = scale * (profile.appearance.height || 1);
    root.scale.set(scale, visualHeight, scale);
    root.add(fig.group);
    scene.add(root);
    const item = {
      id, profile, fig, root, phase, speed: 0, kind: 'idle', scale: visualHeight,
      hp: 3, alive: true, downT: 0,
      autonomous: false, navLocation: '', navStage: 'entry', navPos: new THREE.Vector3(),
      hitOffset: new THREE.Vector3(), knockVel: new THREE.Vector3(),
      targetPos: new THREE.Vector3(), persistent: null, nextWorldSync: 0,
      visualPhase: residentNumber % 2, visualDt: 0
    };
    SPELL_TARGETS.push({
      position: item.targetPos,
      radius: 0.72 * scale * (profile.appearance.width || 1),
      projectileScale: 0.35,
      active: () => item.alive && root.visible,
      hit(dir, damage = 1) {
        if (!item.alive) return;
        item.hp -= damage;
        item.fig.hit();
        item.knockVel.addScaledVector(dir, 2.4);
        livingWorld.recordAttack(item.id, damage,
          ({ 1: 'ember', 2: 'scatter', 3: 'moonbow' })[getWeapon()] || 'spell');
        if (item.hp > 0) return;
        item.alive = false;
        item.downT = 0;
        item.hp = 0;
        knockdowns++;
        if (knockdowns === 1) {
          storyCard(tr('The spell knocks a resident down.', '法術將一名居民擊倒。'),
            tr('they will recover in a few moments', '對方會在片刻後恢復'));
        }
      }
    });
    residents.push(item);
    return item;
  };

  // Main causeway traffic: students and wardens travelling in both directions.
  for (let i = 0; i < 10; i++) {
    const n = makeResident({
      scale: 0.86 + (i % 4) * 0.045,
      phase: (i + 0.35) / 10
    });
    n.kind = 'road';
    n.speed = 0.028 + (i % 3) * 0.004;
    n.lateral = (i % 2 ? 1 : -1) * (0.72 + (i % 3) * 0.22);
  }

  // A few residents circulate around the rune court instead of crossing it.
  for (let i = 0; i < 4; i++) {
    const n = makeResident({
      scale: 0.84 + i * 0.035, phase: i / 4
    });
    n.kind = 'court';
    n.speed = 0.055 + i * 0.006;
    n.radius = 25.2 + (i % 2) * 1.7;
  }

  // Two quiet conversations beside the road make the population feel purposeful.
  const chats = [
    { k: 0.32, side: -1, gap: 1.05 },
    { k: 0.69, side: 1, gap: 1.12 }
  ];
  chats.forEach((chat, groupIndex) => {
    const centre = roadStart.clone().lerp(roadEnd, chat.k)
      .addScaledVector(roadSide, chat.side * 3.25);
    for (let j = 0; j < 2; j++) {
      const n = makeResident({
        scale: 0.88 + j * 0.05,
        phase: groupIndex * 1.7 + j
      });
      n.kind = 'chat';
      n.root.position.copy(centre).addScaledVector(roadDir, (j ? 1 : -1) * chat.gap);
      n.home = n.root.position.clone();
      const look = centre.clone().sub(n.root.position);
      n.root.rotation.y = Math.atan2(-look.x, -look.z);
    }
  });

  // Authored campus activity zones remain legible even when the persistent
  // living-world service is offline: readers by benches, groundskeepers on the
  // lawn edges, and cloister traffic under the Great Hall arches.
  const readers = [
    { x: -18.8, z: -10.15, ry: 2.92 },
    { x: 19.75, z: -11.75, ry: -2.96 },
    { x: -18.7, z: 20.25, ry: 2.35 }
  ];
  readers.forEach((spot, i) => {
    const n = makeResident({ scale: 0.78 + i * 0.025, phase: 3.2 + i * 0.9 });
    n.kind = 'reader';
    n.home = new THREE.Vector3(spot.x, 0.48, spot.z);
    n.root.rotation.y = spot.ry;
    n.root.scale.y *= 0.72;
  });

  for (let i = 0; i < 2; i++) {
    const n = makeResident({ scale: 0.92 + i * 0.04, phase: 5.1 + i * 1.7 });
    n.kind = 'grounds';
    n.speed = 0.022 + i * 0.004;
    n.groundA = new THREE.Vector3(i ? 32 : -33, 0.035, -8);
    n.groundB = new THREE.Vector3(i ? 24 : -25, 0.035, -48);
  }

  for (let i = 0; i < 5; i++) {
    const n = makeResident({ scale: 0.83 + (i % 3) * 0.045, phase: 6.4 + i * 0.31 });
    n.kind = 'cloister';
    n.speed = 0.024 + (i % 2) * 0.004;
    n.cloisterZ = -68.7 - (i % 2) * 1.1;
    n.cloisterLane = (i % 2 ? -1 : 1) * 0.45;
  }

  if (qaCanvas) qaCanvas.dataset.residentCount = String(residents.length);

  const roadPoint = new THREE.Vector3();
  function scheduledTarget(n, persistent, t) {
    const location = String(persistent.location || 'rune court').toLowerCase();
    const room = locationDefs.get(location);
    if (!room) {
      const angle = (residentNumber + Number(n.id.slice(-2))) * 1.7;
      navTarget.set(Math.cos(angle) * 20, 0.035, Math.sin(angle) * 20);
      return navTarget;
    }
    if (n.navLocation !== location) {
      n.navLocation = location;
      n.navStage = 'entry';
    }
    const sin = Math.sin(room.rotation), cos = Math.cos(room.rotation);
    const lane = ((Number(n.id.slice(-2)) % 5) - 2) * 0.52;
    const entryZ = room.anchors.entrance.local.z;
    const insideZ = room.anchors.inside.local.z;
    const entryX = room.center.x + lane * cos + entryZ * sin;
    const entryWorldZ = room.center.z - lane * sin + entryZ * cos;
    if (n.navStage === 'entry' && Math.hypot(n.navPos.x - entryX, n.navPos.z - entryWorldZ) < 1.4) {
      n.navStage = 'inside';
    }
    const localZ = n.navStage === 'entry' ? entryZ : insideZ;
    const idleSway = n.navStage === 'inside' ? Math.sin(t * 0.18 + n.phase * 8) * 0.35 : 0;
    navTarget.set(
      room.center.x + (lane + idleSway) * cos + localZ * sin,
      0.035,
      room.center.z - (lane + idleSway) * sin + localZ * cos
    );
    return navTarget;
  }

  function updateAutonomous(n, persistent, t, dt, playerPos) {
    let target = scheduledTarget(n, persistent, t);
    let speed = (1.15 + Math.min(0.55, Math.max(0, 55 - persistent.energy) * 0.01)) * n.profile.movement.speed;
    const distanceToPlayer = playerPos ? n.navPos.distanceTo(playerPos) : Infinity;
    const frightened = persistent.fearPlayer >= 38 && distanceToPlayer < 22;
    const searching = persistent.activity === 'searching for the player' && playerPos;
    if (frightened) {
      navStep.copy(n.navPos).sub(playerPos).setY(0);
      if (navStep.lengthSq() < 0.01) navStep.set(Math.sin(n.phase * 13), 0, Math.cos(n.phase * 13));
      target = navTarget.copy(n.navPos).addScaledVector(navStep.normalize(), 18);
      speed = 2.55;
    } else if (searching) {
      target = navTarget.copy(playerPos);
      target.y = 0.035;
      speed = 2.15;
    }

    const startX = n.navPos.x;
    const startZ = n.navPos.z;
    navStep.copy(target).sub(n.navPos).setY(0);
    const distance = navStep.length();
    if (distance > (searching ? 3.2 : 0.35)) {
      navStep.multiplyScalar(Math.min(distance, speed * dt) / Math.max(distance, 1e-5));
      const intendedX = n.navPos.x + navStep.x;
      const intendedZ = n.navPos.z + navStep.z;
      navProbe.set(intendedX, 0.92, intendedZ);
      resolveCollisions(navProbe, 0.38);
      n.navPos.x = navProbe.x;
      n.navPos.z = navProbe.z;
    }
    const rr = Math.hypot(n.navPos.x, n.navPos.z);
    if (rr > HUNT_R) { n.navPos.x *= HUNT_R / rr; n.navPos.z *= HUNT_R / rr; }
    n.navPos.y = 0.035;
    const travelledX = n.navPos.x - startX;
    const travelledZ = n.navPos.z - startZ;
    const travelled = Math.hypot(travelledX, travelledZ);
    if (travelled > 0.0001) {
      // Face the resolved displacement, not the blocked intended step. This
      // keeps residents from turning into a wall or walking sideways after
      // collision correction redirects them.
      const targetYaw = Math.atan2(-travelledX, -travelledZ);
      const yawDelta = ((targetYaw - n.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      n.root.rotation.y += yawDelta * Math.min(1, dt * n.profile.movement.turn);
    }
    const actualSpeed = travelled / Math.max(dt, 1 / 240);
    return actualSpeed > 0.04
      ? Math.min(0.72, Math.max(0.16, actualSpeed / 3))
      : 0.04;
  }

  function animateMovementStyle(n, t, motion) {
    // Rigged villagers already contain full-body idle/walk movement. Adding
    // the procedural cloak bob and lateral lean on top makes their feet slide
    // and exaggerates crouched frames, especially for quick movement styles.
    if (n.fig.usesAuthoredAnimation) {
      n.fig.group.position.y = 0;
      n.fig.group.rotation.z = 0;
      return;
    }
    const movement = n.profile.movement;
    const wave = Math.sin(t * movement.cadence + n.phase * 11);
    let lift = Math.abs(wave) * movement.bob * motion;
    let sway = wave * movement.sway * motion;
    if (movement.style === 'float' || movement.style === 'glide') lift = wave * movement.bob * (0.35 + motion);
    if (movement.style === 'limp') { lift *= wave > 0 ? 1.45 : 0.45; sway += Math.abs(wave) * 0.045 * motion; }
    if (movement.style === 'march' || movement.style.includes('march')) sway *= 0.35;
    n.fig.group.position.y = lift;
    n.fig.group.rotation.z = sway;
    if (n.fig.weaponGroup) n.fig.weaponGroup.rotation.x = -wave * 0.08 * motion;
  }

  return {
    residents,
    nearest(playerPos, maxDistance = 5) {
      if (!playerPos) return null;
      let best = null, bestDistance = maxDistance;
      for (const resident of residents) {
        if (!resident.alive || !resident.root.visible) continue;
        const distance = resident.targetPos.distanceTo(playerPos);
        if (distance < bestDistance) { best = resident; bestDistance = distance; }
      }
      return best ? { resident: best, distance: bestDistance } : null;
    },
    update(t, dt, playerPos, worldActive = true) {
      residentFrame++;
      const runtimePerformance = isRuntimePerformance();
      for (const n of residents) {
        const playerDistanceSq = playerPos ? n.root.position.distanceToSquared(playerPos) : 0;
        const farFromPlayer = playerPos && playerDistanceSq > 45 * 45;
        if (runtimePerformance && playerPos && playerDistanceSq > 30 * 30) {
          n.root.visible = false;
          continue;
        }
        const updateVisual = !runtimePerformance || !farFromPlayer || (residentFrame + n.visualPhase) % 2 === 0;
        // Visual updates may be intentionally decimated for distant residents.
        // Accumulate the skipped time so their skeletal clips keep the same
        // speed instead of running at half cadence and appearing to slide.
        n.visualDt = Math.min(0.12, n.visualDt + dt);
        const cloisterDormant = n.kind === 'cloister' && getMode() === 'story'
          && !isSiegeActive() && getGamePhase() < 3;
        if (cloisterDormant) {
          n.root.visible = false;
          continue;
        }
        if (n.alive) n.root.visible = true;
        if (!n.alive) {
          n.downT += dt;
          n.root.position.addScaledVector(n.knockVel, dt);
          n.knockVel.multiplyScalar(Math.exp(-dt * 5));
          n.root.rotation.z = Math.min(Math.PI * 0.48, n.downT * 3.8);
          n.root.position.y -= dt * 0.08;
          if (n.downT > 1) n.root.visible = false;
          if (n.downT > 6) {
            n.alive = true;
            n.hp = 3;
            n.downT = 0;
            n.hitOffset.set(0, 0, 0);
            n.knockVel.set(0, 0, 0);
            n.root.rotation.z = 0;
            n.root.visible = true;
          }
          if (updateVisual) {
            n.fig.update(t + n.phase * 2.3, n.visualDt, 0);
            n.visualDt = 0;
            animateMovementStyle(n, t, 0);
          }
          continue;
        }
        if (t >= n.nextWorldSync) {
          n.persistent = livingWorld.getNPC(n.id);
          n.nextWorldSync = t + 0.18 + n.visualPhase * 0.035;
        }
        const persistent = n.persistent;
        if (persistent && worldActive && !n.autonomous) {
          n.autonomous = true;
          n.navPos.copy(n.root.position);
        }
        if (n.autonomous && persistent && worldActive) {
          const motion = updateAutonomous(n, persistent, t, dt, playerPos);
          n.hitOffset.addScaledVector(n.knockVel, dt);
          n.knockVel.multiplyScalar(Math.exp(-dt * 7));
          n.hitOffset.multiplyScalar(Math.exp(-dt * 3.5));
          n.root.position.copy(n.navPos).add(n.hitOffset);
          n.targetPos.set(n.root.position.x, n.root.position.y + 0.9 * n.scale, n.root.position.z);
          if (updateVisual) {
            n.fig.update(t + n.phase * 2.3, n.visualDt, motion);
            n.visualDt = 0;
            animateMovementStyle(n, t, motion);
          }
          continue;
        }
        const urgency = persistent ? 1 + Math.max(0, persistent.fearPlayer) / 180 : 1;
        let motion = 0;
        if (n.kind === 'road') {
          // Ping-pong keeps both directions populated without visible teleporting.
          const cycle = (n.phase + t * n.speed * urgency * n.profile.movement.speed) % 2;
          const k = cycle <= 1 ? cycle : 2 - cycle;
          const direction = cycle <= 1 ? 1 : -1;
          roadPoint.copy(roadStart).lerp(roadEnd, k).addScaledVector(roadSide, n.lateral);
          n.root.position.copy(roadPoint);
          n.root.rotation.y = Math.atan2(-roadDir.x * direction, -roadDir.z * direction);
          n.root.position.y += Math.abs(Math.sin(t * 5.2 + n.phase * 12)) * 0.018;
          motion = 0.42;
        } else if (n.kind === 'court') {
          const angle = n.phase * Math.PI * 2 + t * n.speed * urgency * n.profile.movement.speed;
          n.root.position.set(Math.cos(angle) * n.radius, 0.035, Math.sin(angle) * n.radius);
          n.root.rotation.y = Math.PI - angle;
          motion = 0.32;
        } else if (n.kind === 'grounds') {
          const cycle = (n.phase * 0.17 + t * n.speed * urgency) % 2;
          const k = cycle <= 1 ? cycle : 2 - cycle;
          const direction = cycle <= 1 ? 1 : -1;
          n.root.position.copy(n.groundA).lerp(n.groundB, k);
          const dir = navStep.copy(n.groundB).sub(n.groundA).multiplyScalar(direction);
          n.root.rotation.y = Math.atan2(-dir.x, -dir.z);
          motion = 0.26;
        } else if (n.kind === 'cloister') {
          const cycle = (n.phase * 0.19 + t * n.speed * urgency) % 2;
          const k = cycle <= 1 ? cycle : 2 - cycle;
          const direction = cycle <= 1 ? 1 : -1;
          n.root.position.set(lerp(-25, 25, k), 0.035, n.cloisterZ + n.cloisterLane);
          n.root.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
          motion = 0.34;
        } else {
          n.root.position.copy(n.home);
          n.root.rotation.z = Math.sin(t * 0.42 + n.phase) * (n.kind === 'reader' ? 0.018 : 0.012);
          motion = n.kind === 'reader' ? 0.03 : 0;
        }
        n.hitOffset.addScaledVector(n.knockVel, dt);
        n.knockVel.multiplyScalar(Math.exp(-dt * 7));
        n.hitOffset.multiplyScalar(Math.exp(-dt * 3.5));
        n.root.position.add(n.hitOffset);
        n.targetPos.set(n.root.position.x, n.root.position.y + 0.9 * n.scale, n.root.position.z);
        if (updateVisual) {
          n.fig.update(t + n.phase * 2.3, n.visualDt, motion);
          n.visualDt = 0;
          animateMovementStyle(n, t, motion);
        }
      }
    }
  };
}
