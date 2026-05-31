// ─── 2nd Eyes — Core Engine ───────────────────────────────────────────────────
// Handles: init, animate loop, movement, proximity, UI, room switching

import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

import {
  scene, camera, renderer, controls,
  ambientLight, hemiLight,
  photoMeshes, sceneLights, nkSceneLights, nkInteractables,
  keys, velocity, direction, colorTarget,
  S,
  ROOM_W, ROOM_D, ROOM_H, NL_CX, NL_W, NL_D,
  INTERACT_DIST, DOOR_DIST,
  GRAVITY, JUMP_FORCE, GROUND_Y, STEP_INTERVAL,
  startOverlay, detailPanel, promptEl, enterButton, closeButton, panel
} from "./state.js";

import {
  buildRoom, buildCeilingLight, buildPhotos, buildFloorGlows,
  buildDoorway, buildBench, buildFloorDecals, buildDust, buildHeldMap
} from "./rain-room.js";

import { buildNKEntryDoor, buildNekolandRoom } from "./nekolan-room.js";

import { initAudio, playFootstep, playPhotoInteract, playLightSwitch } from "./audio.js";

// ── Init ──────────────────────────────────────────────────────────────────────
RectAreaLightUniformsLib.init();

buildRoom();
buildCeilingLight();
buildPhotos();
buildFloorGlows();
buildDoorway();
buildBench();
buildFloorDecals();
buildHeldMap();
buildNKEntryDoor();
buildNekolandRoom();

const dust = buildDust();
bindEvents();
animate();

// ── Animate loop ──────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = Math.min((time - S.previousTime) / 1000, 0.1);
  S.previousTime = time;

  updateMovement(delta);
  updateDust(time);
  updateProximity();
  updateHeldMap(delta);
  updateLights(delta);
  renderer.render(scene, camera);
}

// ── Movement ──────────────────────────────────────────────────────────────────
function updateMovement(delta) {
  if (!controls.isLocked) return;

  velocity.x -= velocity.x * 7 * delta;
  velocity.z -= velocity.z * 7 * delta;

  direction.z = Number(keys.w) - Number(keys.s);
  direction.x = Number(keys.d) - Number(keys.a);
  direction.normalize();

  const speed = 9.5;
  if (keys.w || keys.s) velocity.z -= direction.z * speed * delta;
  if (keys.a || keys.d) velocity.x -= direction.x * speed * delta;

  controls.moveRight(-velocity.x * delta);
  controls.moveForward(-velocity.z * delta);

  // Footstep audio
  const moving = keys.w || keys.a || keys.s || keys.d;
  if (moving && camera.position.y <= GROUND_Y + 0.05) {
    S.stepClock += delta;
    if (S.stepClock >= STEP_INTERVAL) {
      S.stepClock = 0;
      playFootstep();
    }
  } else {
    S.stepClock = STEP_INTERVAL * 0.6;
  }

  const margin = 0.7;
  if (S.currentRoom === 'rain') {
    camera.position.x = clamp(camera.position.x, -ROOM_W / 2 + margin, ROOM_W / 2 - margin);
    camera.position.z = clamp(camera.position.z, -ROOM_D / 2 + margin, ROOM_D / 2 - margin);
  } else {
    camera.position.x = clamp(camera.position.x, NL_CX - NL_W / 2 + margin, NL_CX + NL_W / 2 - margin);
    camera.position.z = clamp(camera.position.z, -NL_D / 2 + margin, NL_D / 2 - margin);
  }

  S.velocityY -= GRAVITY * delta;
  camera.position.y += S.velocityY * delta;

  if (camera.position.y <= GROUND_Y) {
    camera.position.y = GROUND_Y;
    S.velocityY = 0;
    S.canJump = true;
  }
}

// ── Proximity & interaction prompts ──────────────────────────────────────────
function updateProximity() {
  let closest = null;
  let closestDist = Infinity;

  for (const mesh of photoMeshes) {
    const distance = camera.position.distanceTo(mesh.position);
    if (distance < INTERACT_DIST && distance < closestDist) {
      closestDist = distance;
      closest = mesh;
    }
  }

  const doorDist = camera.position.distanceTo(S.doorway.position);
  if (S.currentRoom === 'rain' && doorDist < DOOR_DIST && doorDist < closestDist) {
    closest = S.doorObj;
    closestDist = doorDist;
  }

  if (S.currentRoom === 'rain' && S.nkEntryDoor) {
    const nd = camera.position.distanceTo(S.nkEntryDoor.position);
    if (nd < DOOR_DIST && nd < closestDist) { closest = S.nkEntryDoorObj; closestDist = nd; }
  }

  if (S.currentRoom === 'nekolan' && S.rainExitDoor) {
    const rd = camera.position.distanceTo(S.rainExitDoor.position);
    if (rd < DOOR_DIST && rd < closestDist) { closest = S.rainExitDoorObj; closestDist = rd; }
  }

  if (S.currentRoom === 'nekolan') {
    for (const obj of nkInteractables) {
      const d = camera.position.distanceTo(obj.position);
      if (d < INTERACT_DIST && d < closestDist) { closestDist = d; closest = obj; }
    }
  }

  // Highlight photos
  for (const mesh of photoMeshes) {
    const isClose = mesh === closest;
    const targetBorderOpacity = isClose ? 1 : 0.55;
    const targetBorderColor   = isClose ? 0xc9b88a : 0x3a2f1a;
    const targetSpot          = isClose ? 8 : 5;
    const targetEmissive      = isClose ? 0.55 : 0.3;

    mesh.userData.borderMat.opacity += (targetBorderOpacity - mesh.userData.borderMat.opacity) * 0.12;
    mesh.userData.borderMat.color.lerp(colorTarget.setHex(targetBorderColor), 0.1);
    mesh.userData.spot.intensity += (targetSpot - mesh.userData.spot.intensity) * 0.1;
    mesh.userData.photoMat.emissiveIntensity += (targetEmissive - mesh.userData.photoMat.emissiveIntensity) * 0.1;
  }

  // Door glow animations
  const doorIsClose = closest === S.doorObj;
  S.doorSpot.intensity += ((doorIsClose ? 3.5 : 1.5) - S.doorSpot.intensity) * 0.08;
  S.doorGlow.material.opacity += ((doorIsClose ? 0.42 : 0.18) - S.doorGlow.material.opacity) * 0.08;

  const nkEntryClose = closest === S.nkEntryDoorObj;
  if (S.nkEntrySpot) S.nkEntrySpot.intensity += ((nkEntryClose ? 3.5 : 1.2) - S.nkEntrySpot.intensity) * 0.08;
  if (S.nkEntryGlow) S.nkEntryGlow.material.opacity += ((nkEntryClose ? 0.50 : 0.16) - S.nkEntryGlow.material.opacity) * 0.08;

  const rainExitClose = closest === S.rainExitDoorObj;
  if (S.rainExitSpot) S.rainExitSpot.intensity += ((rainExitClose ? 3.0 : 1.0) - S.rainExitSpot.intensity) * 0.08;
  if (S.rainExitGlow) S.rainExitGlow.material.opacity += ((rainExitClose ? 0.45 : 0.14) - S.rainExitGlow.material.opacity) * 0.08;

  S.nearestTarget = closest;

  if (closest && !detailPanel.classList.contains("mw-visible")) {
    if (closest === S.nkEntryDoorObj)
      promptEl.innerHTML = 'ENTER &nbsp;<span style="letter-spacing:0.12em">NEKOLAND ROOM</span> &nbsp;·&nbsp; <kbd>E</kbd>';
    else if (closest === S.rainExitDoorObj)
      promptEl.innerHTML = 'RETURN TO &nbsp;<span style="letter-spacing:0.12em">RAIN ROOM</span> &nbsp;·&nbsp; <kbd>E</kbd>';
    else if (closest === S.doorObj)
      promptEl.innerHTML = 'NEXT ROOM &nbsp;·&nbsp; <kbd>E</kbd> FOLLOW THE MOVING LIGHT';
    else
      promptEl.innerHTML = 'PRESS <kbd>E</kbd> TO VIEW';
    promptEl.classList.add("mw-visible");
  } else {
    promptEl.classList.remove("mw-visible");
  }
}

// ── Lights (L-key toggle, lerp-based) ────────────────────────────────────────
function updateLights(delta) {
  const speed = delta * 1.8;
  const targetOn = S.lightsOn ? 1 : 0;

  for (const { light, onIntensity } of sceneLights) {
    light.intensity += (onIntensity * targetOn - light.intensity) * speed;
  }

  const ambTarget = S.lightsOn ? 0.72 : 0.05;
  ambientLight.intensity += (ambTarget - ambientLight.intensity) * speed;
  ambientLight.color.lerp(
    S.lightsOn ? new THREE.Color(0x2a2520) : new THREE.Color(0x0d1018),
    speed
  );

  const hemiTarget = S.lightsOn ? 0.34 : 0.04;
  hemiLight.intensity += (hemiTarget - hemiLight.intensity) * speed;
}

// ── Held map bob ──────────────────────────────────────────────────────────────
function updateHeldMap(delta) {
  if (!S.heldGroup) return;

  const moving = controls.isLocked && (keys.w || keys.a || keys.s || keys.d);
  S.bobTime += delta * (moving ? 9 : 2.2);
  S.heldGroup.position.y = Math.sin(S.bobTime) * (moving ? 0.012 : 0.004);
  S.heldGroup.position.x = Math.cos(S.bobTime * 0.5) * (moving ? 0.008 : 0.003);
  S.heldGroup.visible = S.heldMapEnabled && controls.isLocked;
}

// ── Dust particles ────────────────────────────────────────────────────────────
function updateDust(time) {
  const positions  = dust.geometry.attributes.position.array;
  const velocities = dust.userData.velocities;

  for (let i = 0; i < dust.userData.count; i++) {
    positions[i * 3 + 1] -= velocities[i];
    positions[i * 3]     += Math.sin(time * 0.0003 + i) * 0.0003;
    if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = ROOM_H;
  }
  dust.geometry.attributes.position.needsUpdate = true;
}

// ── Room switching ────────────────────────────────────────────────────────────
function switchRoom(target) {
  S.currentRoom = target;
  velocity.set(0, 0, 0);
  S.velocityY = 0;

  if (target === 'nekolan') {
    camera.position.set(NL_CX, 1.6, 10.5);
    scene.background.setHex(0x100806);
    scene.fog = new THREE.FogExp2(0x100806, 0.042);
    ambientLight.color.setHex(0x3a2010);
    ambientLight.intensity = 0.75;
    hemiLight.intensity = 0.38;
    document.querySelector('.mw-hud--right .mw-hud-value').textContent = 'Nekoland Room';

    // ── Performance: disable Rain Room lights, enable NK lights ──────────────
    for (const { light } of sceneLights)   light.intensity = 0;
    for (const { light, onIntensity } of nkSceneLights) light.intensity = onIntensity;
  } else {
    camera.position.set(-ROOM_W / 2 + 1.8, 1.6, 2.5);
    scene.background.setHex(0x020202);
    scene.fog = new THREE.FogExp2(0x030303, 0.048);
    ambientLight.color.setHex(0x2a2520);
    ambientLight.intensity = 0.72;
    hemiLight.intensity = 0.38;
    document.querySelector('.mw-hud--right .mw-hud-value').textContent = 'Rain Room';

    // ── Performance: disable NK lights, restore Rain Room lights ─────────────
    for (const { light } of nkSceneLights) light.intensity = 0;
    for (const { light, onIntensity } of sceneLights) light.intensity = S.lightsOn ? onIntensity : 0;
  }

  buildHeldMap();
}

// ── Interaction ───────────────────────────────────────────────────────────────
function tryInteract() {
  if (detailPanel.classList.contains("mw-visible")) {
    closeDetail(true);
    return;
  }

  if (!S.nearestTarget) return;

  if (S.nearestTarget === S.doorObj)         { openDoorMessage(); return; }
  if (S.nearestTarget === S.nkEntryDoorObj)  { switchRoom('nekolan'); return; }
  if (S.nearestTarget === S.rainExitDoorObj) { switchRoom('rain');    return; }

  if (S.nearestTarget && S.nearestTarget.userData && S.nearestTarget.userData.data) {
    openDetail(S.nearestTarget.userData.data);
  }
}

function openDetail(data) {
  playPhotoInteract();
  panel.section.textContent = "Gallery Label";
  panel.title.textContent   = data.title;
  panel.memory.textContent  = `"${data.memory}"`;
  panel.camera.textContent  = data.camera;
  panel.film.textContent    = data.film;
  panel.note.textContent    = data.note;

  detailPanel.classList.add("mw-visible");
  dimInterface(true);
  controls.unlock();
}

function openDoorMessage() {
  panel.section.textContent = "Next exhibition";
  panel.title.textContent   = "Transit Room";
  panel.memory.textContent  = '"Some memories only exist while moving."';
  panel.camera.textContent  = "-";
  panel.film.textContent    = "-";
  panel.note.textContent    = "Coming soon";

  detailPanel.classList.add("mw-visible");
  dimInterface(true);
  controls.unlock();
}

function closeDetail(triggeredByUserGesture) {
  detailPanel.classList.remove("mw-visible");
  dimInterface(false);

  if (triggeredByUserGesture) {
    controls.lock();
  } else {
    startOverlay.classList.remove("mw-hidden");
    document.body.classList.remove("mw-room-ready");
  }
}

function dimInterface(isDimmed) {
  document.querySelectorAll(".mw-hud, .mw-controls").forEach((item) => {
    item.classList.toggle("mw-dim", isDimmed);
  });
}

// ── Events ────────────────────────────────────────────────────────────────────
function bindEvents() {
  enterButton.addEventListener("click", () => controls.lock());
  startOverlay.addEventListener("click", () => controls.lock());
  closeButton.addEventListener("click", () => closeDetail(true));

  controls.addEventListener("lock", () => {
    startOverlay.classList.add("mw-hidden");
    document.body.classList.add("mw-room-ready");
    initAudio();
  });

  controls.addEventListener("unlock", () => {
    if (!detailPanel.classList.contains("mw-visible")) {
      startOverlay.classList.remove("mw-hidden");
      document.body.classList.remove("mw-room-ready");
    }
  });

  document.addEventListener("keydown", (event) => {
    switch (event.code) {
      case "KeyW": case "ArrowUp":    keys.w = true; break;
      case "KeyS": case "ArrowDown":  keys.s = true; break;
      case "KeyA": case "ArrowLeft":  keys.a = true; break;
      case "KeyD": case "ArrowRight": keys.d = true; break;
      case "KeyE":   tryInteract(); break;
      case "Space":
        if (S.canJump && controls.isLocked) {
          S.velocityY = JUMP_FORCE;
          S.canJump = false;
        }
        event.preventDefault();
        break;
      case "KeyH": S.heldMapEnabled = !S.heldMapEnabled; break;
      case "KeyL":
        S.lightsOn = !S.lightsOn;
        playLightSwitch();
        break;
      case "Escape":
        if (detailPanel.classList.contains("mw-visible")) closeDetail(false);
        break;
      default: break;
    }
  });

  document.addEventListener("keyup", (event) => {
    switch (event.code) {
      case "KeyW": case "ArrowUp":    keys.w = false; break;
      case "KeyS": case "ArrowDown":  keys.s = false; break;
      case "KeyA": case "ArrowLeft":  keys.a = false; break;
      case "KeyD": case "ArrowRight": keys.d = false; break;
      default: break;
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
