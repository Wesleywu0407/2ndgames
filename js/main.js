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
import { PLAYER, DOUBLE_TAP_RUN_MS } from "./core/player-settings.js";
import { applyRainQAView, applyNekolandQAView } from "./core/qa-views.js";

import {
  buildRoom, buildCeilingLight, buildPhotos, buildFloorGlows,
  buildDoorway, buildBench, buildFloorDecals, buildMuseumDetails,
  buildDust, buildHeldMap, updateStillRainInstallation
} from "./rain-room.js";

import { buildNKEntryDoor } from "./rooms/nekoland-entry-door.js";
import { askNPC, describeError } from "./npc-llm.js";

// ── Chef chat DOM ──────────────────────────────────────────────────────────────
const chatPanel = document.querySelector("[data-chat-panel]");
const chatLog   = document.querySelector("[data-chat-log]");
const chatForm  = document.querySelector("[data-chat-form]");
const chatInput = document.querySelector("[data-chat-input]");
const chatName  = document.querySelector("[data-chat-name]");
const chatClose = document.querySelector("[data-chat-close]");
const dnButton  = document.querySelector("[data-daynight]");
const objectiveLabel = document.querySelector(".nk-objective-label");
const objectiveTitle = document.querySelector("[data-objective-title]");
const objectiveLine = document.querySelector("[data-objective-line]");
const memoryProgress = document.querySelector("[data-memory-progress]");
const targetHint = document.querySelector("[data-target-hint]");
const toastEl = document.querySelector("[data-toast]");
let activeNpcId = null;
let toastTimer = 0;
const nkVisitedMemories = new Set();
let lastForwardTap = 0;
let isRunning = false;
let shiftRunHeld = false;
let interactionCooldown = 0;
let nekolandModulePromise = null;
let updateNekolandCustomersFrame = () => {};

const reduceMotionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
const prefersReducedMotion = () => !!reduceMotionQuery?.matches;

import { initAudio, playFootstep, playPhotoInteract, playLightSwitch } from "./audio.js";

// ── Init ──────────────────────────────────────────────────────────────────────
RectAreaLightUniformsLib.init();

const initialRoom = document.body.dataset.room === 'nekolan' ? 'nekolan' : 'rain';
S.currentRoom = initialRoom;
S.dnPhase  = 1;   // Now/Memory cross-fade state: 1 = Now, 0 = Memory
S.dnTarget = 1;

// Now/Memory profiles + scratch colors. Declared up here (not next to the
// functions) so the first animate() frame can call updateDayNight() without
// hitting a temporal-dead-zone on these consts.
const DN_PROFILE = {
  now:    { exposure: 0.82, ambIntensity: 0.30,  ambColor: 0x2a1208, fogColor: 0x0b0403, fogDensity: 0.055 },
  memory: { exposure: 0.54, ambIntensity: 0.08,  ambColor: 0x1b0d08, fogColor: 0x150807, fogDensity: 0.078 },
};
const _dnColA = new THREE.Color();
const _dnColB = new THREE.Color();
const _camForward = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _targetVelocity = new THREE.Vector3();
const _playerPos2 = new THREE.Vector2();
const _obstaclePos2 = new THREE.Vector2();

controls.pointerSpeed = 0.72;
controls.minPolarAngle = Math.PI * 0.08;
controls.maxPolarAngle = Math.PI * 0.92;

let dust = null;
init();

async function init() {
  if (initialRoom === 'rain') {
    buildRainPage();
  } else {
    await buildNekolandPage();
  }

  buildHeldMap();
  applyRainQAView(initialRoom);
  applyNekolandQAView(initialRoom, { toggleDayNight });

  dust = buildDust();
  bindEvents();
  updateNekolandObjective();
  animate();
}

async function loadNekolandModule() {
  nekolandModulePromise ??= import("./nekolan-room.js");
  return nekolandModulePromise;
}

function buildRainPage() {
  buildRoom();
  buildCeilingLight();
  buildPhotos();
  buildFloorGlows();
  buildDoorway();
  buildBench();
  buildFloorDecals();
  buildMuseumDetails();
  buildNKEntryDoor();
  setRoomEnvironment('rain');
}

async function buildNekolandPage() {
  const { buildNekolandRoom, updateNKCustomers } = await loadNekolandModule();
  buildNekolandRoom();
  updateNekolandCustomersFrame = updateNKCustomers;
  setRoomEnvironment('nekolan');
  updateDayNightLabel();
}

// ── Animate loop ──────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = Math.min((time - S.previousTime) / 1000, 0.1);
  S.previousTime = time;

  updateMovement(delta);
  updateDust(time);
  updateStillRainInstallation(time);
  updateProximity();
  updateHeldMap(delta);
  updateLights(delta);
  updateNekolandCustomersFrame(delta);
  updateDayNight(delta);
  renderer.render(scene, camera);
}

// ── Movement ──────────────────────────────────────────────────────────────────
function updateMovement(delta) {
  if (!controls.isLocked) return;

  const previousX = camera.position.x;
  const previousZ = camera.position.z;

  direction.z = Number(keys.w) - Number(keys.s);
  direction.x = Number(keys.d) - Number(keys.a);
  direction.normalize();

  const runningForward = (shiftRunHeld || isRunning) && keys.w && !keys.s;
  const speed = runningForward ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const moving = direction.lengthSq() > 0;
  _targetVelocity.set(
    direction.x * speed * PLAYER.strafeMul,
    0,
    direction.z * speed
  );

  const response = 1 - Math.exp(-(moving ? PLAYER.accel : PLAYER.decel) * delta);
  velocity.x += (_targetVelocity.x - velocity.x) * response;
  velocity.z += (_targetVelocity.z - velocity.z) * response;

  if (!moving && Math.abs(velocity.x) < 0.015) velocity.x = 0;
  if (!moving && Math.abs(velocity.z) < 0.015) velocity.z = 0;

  controls.moveRight(velocity.x * delta);
  controls.moveForward(velocity.z * delta);

  // Footstep audio
  const movingEnough = Math.hypot(velocity.x, velocity.z) > 0.35;
  if (movingEnough && camera.position.y <= PLAYER.height + 0.05) {
    S.stepClock += delta;
    const stepInterval = runningForward ? STEP_INTERVAL * 0.58 : STEP_INTERVAL * 0.82;
    if (S.stepClock >= stepInterval) {
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
    resolveNekolandCollisions(previousX, previousZ, delta);
  }

  S.velocityY -= GRAVITY * delta;
  camera.position.y += S.velocityY * delta;

  if (camera.position.y <= PLAYER.height) {
    camera.position.y = PLAYER.height;
    S.velocityY = 0;
    S.canJump = true;
  }
}

function resolveNekolandCollisions(previousX, previousZ, delta) {
  const playerRadius = PLAYER.radius;
  const beforeX = camera.position.x;
  const beforeZ = camera.position.z;

  if (S.nkBarBounds && intersectsAabb(S.nkBarBounds, playerRadius)) {
    const targetX = camera.position.x;
    const targetZ = camera.position.z;

    camera.position.x = previousX;
    if (intersectsAabb(S.nkBarBounds, playerRadius)) {
      camera.position.x = targetX;
      camera.position.z = previousZ;
      if (intersectsAabb(S.nkBarBounds, playerRadius)) {
        camera.position.x = previousX;
        camera.position.z = previousZ;
        velocity.x = 0;
        velocity.z = 0;
      } else {
        velocity.z = 0;
      }
    } else {
      velocity.x = 0;
    }
  }

  resolveCircleCollision(S.nkCatBounds, playerRadius);
  for (const table of S.nkTableBounds || []) {
    resolveCircleCollision(table, playerRadius);
  }

  const correctedX = camera.position.x - beforeX;
  const correctedZ = camera.position.z - beforeZ;
  if (correctedX) velocity.x *= Math.max(0, 1 - 12 * delta);
  if (correctedZ) velocity.z *= Math.max(0, 1 - 12 * delta);
}

function intersectsAabb(bounds, radius) {
  return (
    camera.position.x > bounds.minX - radius &&
    camera.position.x < bounds.maxX + radius &&
    camera.position.z > bounds.minZ - radius &&
    camera.position.z < bounds.maxZ + radius
  );
}

function resolveCircleCollision(circle, playerRadius) {
  if (!circle) return;
  _playerPos2.set(camera.position.x, camera.position.z);
  _obstaclePos2.set(circle.x, circle.z);
  const minDist = circle.radius + playerRadius;
  const dx = _playerPos2.x - _obstaclePos2.x;
  const dz = _playerPos2.y - _obstaclePos2.y;
  const distSq = dx * dx + dz * dz;
  if (distSq >= minDist * minDist) return;

  const dist = Math.max(Math.sqrt(distSq), 0.0001);
  const push = minDist - dist;
  const nx = dx / dist;
  const nz = dz / dist;
  camera.position.x += nx * push;
  camera.position.z += nz * push;
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

  if (S.currentRoom === 'rain' && S.doorway) {
    const doorDist = camera.position.distanceTo(S.doorway.position);
    if (doorDist < DOOR_DIST && doorDist < closestDist) {
      closest = S.doorObj;
      closestDist = doorDist;
    }
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
    camera.getWorldDirection(_camForward);
    _camForward.y = 0;
    _camForward.normalize();

    for (const obj of nkInteractables) {
      const d = camera.position.distanceTo(obj.position);
      if (d >= INTERACT_DIST || d >= closestDist) continue;

      _toTarget.copy(obj.position).sub(camera.position);
      _toTarget.y = 0;
      if (_toTarget.lengthSq() > 0.0001) _toTarget.normalize();
      const facing = _camForward.dot(_toTarget);
      const closeEnough = d < 1.05;
      if (facing > PLAYER.interactDot || closeEnough) {
        closestDist = d;
        closest = obj;
      }
    }
  }

  // Highlight photos
  for (const mesh of photoMeshes) {
    const isClose = mesh === closest;
    const targetBorderOpacity = isClose ? 1 : 0.55;
    const targetBorderColor   = isClose ? 0xc9b88a : 0x3a2f1a;
    const targetEmissive      = isClose ? 0.55 : 0.3;
    const targetWashOpacity   = isClose ? 0.28 : 0.16;
    const targetBarOpacity    = isClose ? 0.54 : 0.34;

    mesh.userData.borderMat.opacity += (targetBorderOpacity - mesh.userData.borderMat.opacity) * 0.12;
    mesh.userData.borderMat.color.lerp(colorTarget.setHex(targetBorderColor), 0.1);
    mesh.userData.photoMat.emissiveIntensity += (targetEmissive - mesh.userData.photoMat.emissiveIntensity) * 0.1;
    mesh.userData.lightMat.opacity += (targetWashOpacity - mesh.userData.lightMat.opacity) * 0.1;
    mesh.userData.barMat.opacity += (targetBarOpacity - mesh.userData.barMat.opacity) * 0.1;
  }

  // Door glow animations
  const doorIsClose = closest === S.doorObj;
  if (S.doorSpot) S.doorSpot.intensity += ((doorIsClose ? 3.5 : 1.5) - S.doorSpot.intensity) * 0.08;
  if (S.doorGlow) S.doorGlow.material.opacity += ((doorIsClose ? 0.42 : 0.18) - S.doorGlow.material.opacity) * 0.08;

  const nkEntryClose = closest === S.nkEntryDoorObj;
  if (S.nkEntrySpot) S.nkEntrySpot.intensity += ((nkEntryClose ? 3.5 : 1.2) - S.nkEntrySpot.intensity) * 0.08;
  if (S.nkEntryGlow) S.nkEntryGlow.material.opacity += ((nkEntryClose ? 0.50 : 0.16) - S.nkEntryGlow.material.opacity) * 0.08;

  const rainExitClose = closest === S.rainExitDoorObj;
  if (S.rainExitSpot) S.rainExitSpot.intensity += ((rainExitClose ? 3.0 : 1.0) - S.rainExitSpot.intensity) * 0.08;
  if (S.rainExitGlow) S.rainExitGlow.material.opacity += ((rainExitClose ? 0.45 : 0.14) - S.rainExitGlow.material.opacity) * 0.08;

  S.nearestTarget = closest;
  updateNekolandHover(closest);

  updateNekolandTargetHint(closest, closestDist);

  if (closest && !detailPanel.classList.contains("mw-visible") && !isChatOpen()) {
    if (closest === S.nkEntryDoorObj)
      promptEl.innerHTML = 'ENTER &nbsp;<span style="letter-spacing:0.12em">NEKOLAND ROOM</span> &nbsp;·&nbsp; <kbd>E</kbd>';
    else if (closest === S.rainExitDoorObj)
      promptEl.innerHTML = 'RETURN TO &nbsp;<span style="letter-spacing:0.12em">RAIN ROOM</span> &nbsp;·&nbsp; <kbd>E</kbd>';
    else if (closest === S.doorObj)
      promptEl.innerHTML = 'NEXT ROOM &nbsp;·&nbsp; <kbd>E</kbd> FOLLOW THE MOVING LIGHT';
    else if (closest.type === 'npcCook')
      promptEl.innerHTML = 'TALK TO THE CHEF &nbsp;·&nbsp; <kbd>E</kbd>';
    else if (closest.userData?.prompt)
      promptEl.innerHTML = `${closest.userData.prompt} &nbsp;·&nbsp; <kbd>E</kbd>`;
    else if (closest.userData?.data?.title)
      promptEl.innerHTML = `VIEW ${closest.userData.data.title.toUpperCase()} &nbsp;·&nbsp; <kbd>E</kbd>`;
    else
      promptEl.innerHTML = 'PRESS <kbd>E</kbd> TO VIEW';
    promptEl.classList.add("mw-visible");
  } else {
    promptEl.classList.remove("mw-visible");
  }
}

function updateNekolandHover(target) {
  if (S.currentRoom !== 'nekolan') {
    setNekolandHighlight(null);
    return;
  }
  setNekolandHighlight(nkInteractables.includes(target) ? target : null);
}

function setNekolandHighlight(target) {
  if (S.nkHighlightTarget === target) return;
  if (S.nkHighlightTarget) applyNekolandHighlight(S.nkHighlightTarget, false);
  S.nkHighlightTarget = target;
  if (S.nkHighlightTarget) applyNekolandHighlight(S.nkHighlightTarget, true);
}

function applyNekolandHighlight(obj, active) {
  if (!obj?.traverse) return;
  obj.traverse((child) => {
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!mat || !("emissiveIntensity" in mat)) continue;
      if (mat.userData.nkBaseEmissiveIntensity === undefined) {
        mat.userData.nkBaseEmissiveIntensity = mat.emissiveIntensity || 0;
      }
      if (mat.emissive && mat.userData.nkBaseEmissiveHex === undefined) {
        mat.userData.nkBaseEmissiveHex = mat.emissive.getHex();
      }
      const base = mat.userData.nkBaseEmissiveIntensity || 0;
      mat.emissiveIntensity = active ? base + 0.18 : base;
      if (mat.emissive && mat.userData.nkBaseEmissiveHex !== undefined) {
        mat.emissive.setHex(active ? 0xffb55a : mat.userData.nkBaseEmissiveHex);
      }
    }
  });
}

// ── Lights (L-key toggle, lerp-based) ────────────────────────────────────────
function updateLights(delta) {
  const speed = delta * 1.8;
  const targetOn = S.lightsOn ? 1 : 0;

  for (const { light, onIntensity } of sceneLights) {
    light.intensity += (onIntensity * targetOn - light.intensity) * speed;
  }

  const rainMode = S.currentRoom === 'rain';
  const ambTarget = S.lightsOn ? (rainMode ? 0.68 : 0.30) : 0.05;
  ambientLight.intensity += (ambTarget - ambientLight.intensity) * speed;
  ambientLight.color.lerp(
    S.lightsOn ? new THREE.Color(rainMode ? 0x4c4840 : 0x2a1208) : new THREE.Color(0x0d1018),
    speed
  );

  const hemiTarget = S.lightsOn ? (rainMode ? 0.42 : 0.18) : 0.04;
  hemiLight.intensity += (hemiTarget - hemiLight.intensity) * speed;
}

// ── Held map bob ──────────────────────────────────────────────────────────────
function updateHeldMap(delta) {
  if (!S.heldGroup) return;

  const moving = controls.isLocked && (keys.w || keys.a || keys.s || keys.d);
  S.bobTime += delta * (moving ? 9 : 2.2);
  const reduced = prefersReducedMotion();
  const bobY = reduced ? 0 : (moving ? 0.007 : 0.0025);
  const bobX = reduced ? 0 : (moving ? 0.004 : 0.0015);
  S.heldGroup.position.y = Math.sin(S.bobTime) * bobY;
  S.heldGroup.position.x = Math.cos(S.bobTime * 0.5) * bobX;
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
  setRoomEnvironment(target);
  buildHeldMap();
}

function setRoomEnvironment(target) {
  if (target === 'nekolan') {
    camera.position.set(NL_CX, 1.6, 11.45);
    scene.background.setHex(0x080302);
    scene.fog = new THREE.FogExp2(0x090403, 0.055);
    ambientLight.color.setHex(0x2a1208);
    ambientLight.intensity = 0.30;
    hemiLight.intensity = 0.18;
    renderer.toneMappingExposure = 0.82;
    document.querySelector('.mw-hud--right .mw-hud-value').textContent = 'Nekoland Room';

    // ── Performance: disable Rain Room lights, enable NK lights ──────────────
    for (const { light } of sceneLights)   light.intensity = 0;
    for (const { light, onIntensity } of nkSceneLights) light.intensity = onIntensity;
  } else {
    camera.position.set(0, 1.62, ROOM_D / 2 - 3.2);
    scene.background.setHex(0x1c1b18);
    scene.fog = new THREE.FogExp2(0x24221e, 0.012);
    ambientLight.color.setHex(0x6a665c);
    ambientLight.intensity = 0.86;
    hemiLight.intensity = 0.56;
    renderer.toneMappingExposure = 1.22;
    document.querySelector('.mw-hud--right .mw-hud-value').textContent = 'Rain Room';

    // ── Performance: disable NK lights, restore Rain Room lights ─────────────
    for (const { light } of nkSceneLights) light.intensity = 0;
    for (const { light, onIntensity } of sceneLights) light.intensity = S.lightsOn ? onIntensity : 0;
  }
}

// ── Now / Memory ──────────────────────────────────────────────────────────────
// Two states for the same Nekoland space, cross-faded inside the existing render
// loop. NOW is warm and alive; MEMORY desaturates the room and leaves only a few
// remembered objects glowing red.
function toggleDayNight() {
  if (S.currentRoom !== 'nekolan') return;
  S.dnTarget = S.dnTarget > 0.5 ? 0 : 1;
  updateDayNightLabel();
  updateNekolandObjective();
  showToast(S.dnTarget > 0.5
    ? "Night shift: the counter lights warm back up."
    : "After-hours: red shop signs reveal the specials.");
}

function updateDayNightLabel() {
  if (!dnButton) return;
  dnButton.textContent = S.dnTarget > 0.5 ? 'N SHIFT' : 'N AFTER';
}

function updateDayNight(delta) {
  if (S.currentRoom !== 'nekolan') return;

  const step = delta / 1.5;   // full fade in ~1.5s
  if (S.dnPhase < S.dnTarget)      S.dnPhase = Math.min(S.dnTarget, S.dnPhase + step);
  else if (S.dnPhase > S.dnTarget) S.dnPhase = Math.max(S.dnTarget, S.dnPhase - step);

  const t = S.dnPhase;                 // 1 = Now … 0 = Memory
  const d = DN_PROFILE.now, n = DN_PROFILE.memory;

  renderer.toneMappingExposure = n.exposure + (d.exposure - n.exposure) * t;

  ambientLight.intensity = n.ambIntensity + (d.ambIntensity - n.ambIntensity) * t;
  _dnColA.setHex(n.ambColor); _dnColB.setHex(d.ambColor);
  ambientLight.color.copy(_dnColA).lerp(_dnColB, t);

  if (scene.fog) {
    _dnColA.setHex(n.fogColor); _dnColB.setHex(d.fogColor);
    scene.fog.color.copy(_dnColA).lerp(_dnColB, t);
    scene.fog.density = n.fogDensity + (d.fogDensity - n.fogDensity) * t;
  }

  // Each NK light fades between its day intensity and (day × nightMul).
  for (const e of nkSceneLights) {
    const nm = e.nightMul ?? 0.12;
    e.light.intensity = e.onIntensity * (nm + (1 - nm) * t);
  }
}

// ── Interaction ───────────────────────────────────────────────────────────────
function tryInteract() {
  const now = performance.now();
  if (now < interactionCooldown) return;
  interactionCooldown = now + 180;

  if (detailPanel.classList.contains("mw-visible")) {
    closeDetail(true);
    return;
  }

  if (!S.nearestTarget) return;

  if (S.nearestTarget === S.doorObj)         { openDoorMessage(); return; }
  if (S.nearestTarget === S.nkEntryDoorObj)  { window.location.href = 'nekoland-room.html'; return; }
  if (S.nearestTarget === S.rainExitDoorObj) { window.location.href = 'rain-room.html';     return; }

  if (S.nearestTarget.type === 'npcCook') { openChat(S.nearestTarget); return; }

  if (S.nearestTarget && S.nearestTarget.userData && S.nearestTarget.userData.data) {
    openDetail(S.nearestTarget.userData.data);
  }
}

function openDetail(data) {
  playPhotoInteract();
  panel.section.textContent = data.section || "Gallery Label";
  panel.title.textContent   = data.title;
  panel.memory.textContent  = `"${data.memory}"`;
  panel.camera.textContent  = data.camera;
  panel.film.textContent    = data.film;
  panel.note.textContent    = data.note;

  detailPanel.classList.add("mw-visible");
  dimInterface(true);
  controls.unlock();

  if (S.currentRoom === 'nekolan' && data.title) {
    const wasNew = !nkVisitedMemories.has(data.title);
    nkVisitedMemories.add(data.title);
    updateNekolandObjective();
    if (wasNew) showToast(`${Math.min(nkVisitedMemories.size, 3)}/3 lucky stamps collected.`);
  }
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
  document.querySelectorAll(".mw-hud, .mw-controls, .nk-objective, .mw-room-guide").forEach((item) => {
    item.classList.toggle("mw-dim", isDimmed);
  });
}

function updateNekolandObjective() {
  if (!memoryProgress || S.currentRoom !== 'nekolan') return;
  const found = Math.min(nkVisitedMemories.size, 3);
  if (objectiveLabel) objectiveLabel.textContent = "Night Shift";
  memoryProgress.textContent = `${found}/3 lucky stamps`;

  if (found >= 3) {
    objectiveTitle.textContent = "Ask the chef";
    objectiveLine.textContent = "Today's Special is complete. Bring the stamps back to the counter.";
    if (targetHint) targetHint.textContent = "Counter is ready";
  } else if (S.dnTarget < 0.5) {
    objectiveTitle.textContent = "Find Today's Special";
    objectiveLine.textContent = "After-hours signs point toward hidden lucky stamps.";
  } else {
    objectiveTitle.textContent = "NIGHT SHIFT";
    objectiveLine.textContent = "Follow warm table lights, counter glow, and lucky-cat signs.";
  }
}

function updateNekolandTargetHint(target, distance) {
  if (!targetHint || S.currentRoom !== 'nekolan') return;
  if (!target || distance === Infinity) {
    targetHint.textContent = S.dnTarget < 0.5 ? "Look for red signs" : "Follow warm light";
    return;
  }

  if (target.type === 'npcCook') {
    targetHint.textContent = "Chef nearby";
  } else if (target === S.rainExitDoorObj) {
    targetHint.textContent = "Rain Room exit";
  } else if (target.userData?.data?.title) {
    targetHint.textContent = `${target.userData.data.title} nearby`;
  } else {
    targetHint.textContent = "Lucky stamp nearby";
  }
}

function showToast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.setAttribute("aria-hidden", "false");
  toastEl.classList.add("nk-toast-visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toastEl.classList.remove("nk-toast-visible");
    toastEl.setAttribute("aria-hidden", "true");
  }, 2400);
}

function isChatOpen() {
  return !!chatPanel && chatPanel.classList.contains("nk-chat-open");
}

// ── Chef chat ─────────────────────────────────────────────────────────────────
function openChat(npc) {
  if (!chatPanel || !chatLog || !chatInput || !chatName) return;
  activeNpcId = npc.npcId;
  chatName.textContent = npc.name || "拉麵師傅";
  if (!chatLog.dataset.greeted) {
    const found = Math.min(nkVisitedMemories.size, 3);
    addChatMsg("npc", found >= 3
      ? "（師傅看了一眼你手上的地圖）你已經看見幾個角落了。現在，還是記憶，哪一個比較像真的？"
      : "（師傅抬起頭）……歡迎光臨。先看看店裡的紅光吧，牠們會告訴你要問什麼。");
    chatLog.dataset.greeted = "1";
  }
  chatPanel.classList.add("nk-chat-open");
  chatPanel.setAttribute("aria-hidden", "false");
  dimInterface(true);
  promptEl.classList.remove("mw-visible");
  controls.unlock();
  setTimeout(() => chatInput.focus(), 50);
}

function closeChat() {
  if (!chatPanel) return;
  chatPanel.classList.remove("nk-chat-open");
  chatPanel.setAttribute("aria-hidden", "true");
  dimInterface(false);
  activeNpcId = null;
  controls.lock();
}

function addChatMsg(kind, text) {
  if (!chatLog) return null;
  const el = document.createElement("div");
  el.className = "nk-msg nk-msg-" + kind;
  el.textContent = text;
  chatLog.appendChild(el);
  chatLog.scrollTop = chatLog.scrollHeight;
  return el;
}

async function sendChat(event) {
  event.preventDefault();
  if (!chatInput || !chatForm) return;
  const text = chatInput.value.trim();
  if (!text || !activeNpcId) return;

  addChatMsg("you", text);
  chatInput.value = "";
  const sendBtn = chatForm.querySelector(".nk-chat-send");
  sendBtn.disabled = true;
  const thinking = addChatMsg("sys", "師傅在想…");

  try {
    const reply = await askNPC(activeNpcId, text);
    thinking.remove();
    addChatMsg("npc", reply);
  } catch (err) {
    thinking.remove();
    addChatMsg("sys", describeError(err));
  } finally {
    sendBtn.disabled = false;
    chatInput?.focus();
  }
}

// ── Events ────────────────────────────────────────────────────────────────────
function resetKeys() {
  keys.w = keys.a = keys.s = keys.d = false;
  velocity.x = 0;
  velocity.z = 0;
  isRunning = false;
  shiftRunHeld = false;
  lastForwardTap = 0;
}

function handleForwardDown(event) {
  if (!event.repeat) {
    const now = performance.now();
    if (now - lastForwardTap <= DOUBLE_TAP_RUN_MS) {
      isRunning = true;
    }
    lastForwardTap = now;
  }
  keys.w = true;
}

function bindEvents() {
  enterButton.addEventListener("click", () => controls.lock());
  startOverlay.addEventListener("click", () => controls.lock());
  if (startOverlay.classList.contains("nekoland-entry")) {
    enterButton.addEventListener("click", () => startOverlay.classList.add("is-entering"));
    startOverlay.addEventListener("pointermove", (event) => {
      const rect = startOverlay.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width - 0.5) * 18;
      const py = ((event.clientY - rect.top) / rect.height - 0.5) * 14;
      startOverlay.style.setProperty("--px", `${px}px`);
      startOverlay.style.setProperty("--py", `${py}px`);
    });
    startOverlay.addEventListener("pointerleave", () => {
      startOverlay.style.setProperty("--px", "0px");
      startOverlay.style.setProperty("--py", "0px");
    });
    startOverlay.querySelectorAll(".game-nav button").forEach((button) => {
      button.addEventListener("click", (event) => event.stopPropagation());
    });
  }
  closeButton.addEventListener("click", () => closeDetail(true));

  controls.addEventListener("lock", () => {
    startOverlay.classList.add("mw-hidden");
    document.body.classList.add("mw-room-ready");
    initAudio();
    updateNekolandObjective();
  });

  controls.addEventListener("unlock", () => {
    resetKeys();
    if (!detailPanel.classList.contains("mw-visible") && !isChatOpen()) {
      startOverlay.classList.remove("mw-hidden");
      document.body.classList.remove("mw-room-ready");
    }
  });

  if (chatForm) chatForm.addEventListener("submit", sendChat);
  if (chatClose) chatClose.addEventListener("click", closeChat);

  // Day / Night toggle button (mirrors the N key).
  if (dnButton) dnButton.addEventListener("click", toggleDayNight);

  // Clear stuck keys when the page loses focus (e.g. an extension popup or
  // tab switch swallows the keyup → player would keep walking forever).
  window.addEventListener("blur", resetKeys);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) resetKeys();
  });

  document.addEventListener("keydown", (event) => {
    // While the chef chat is open, let the user type freely; only Esc closes it.
    if (isChatOpen()) {
      if (event.code === "Escape") closeChat();
      return;
    }
    switch (event.code) {
      case "KeyW": handleForwardDown(event); break;
      case "ArrowUp": keys.w = true; break;
      case "KeyS": case "ArrowDown":  keys.s = true; break;
      case "KeyA": case "ArrowLeft":  keys.a = true; break;
      case "KeyD": case "ArrowRight": keys.d = true; break;
      case "ShiftLeft": case "ShiftRight": shiftRunHeld = true; break;
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
      case "KeyN": toggleDayNight(); updateNekolandObjective(); break;
      case "Escape":
        if (detailPanel.classList.contains("mw-visible")) closeDetail(false);
        break;
      default: break;
    }
  });

  document.addEventListener("keyup", (event) => {
    switch (event.code) {
      case "KeyW": keys.w = false; isRunning = false; break;
      case "ArrowUp": keys.w = false; break;
      case "KeyS": case "ArrowDown":  keys.s = false; break;
      case "KeyA": case "ArrowLeft":  keys.a = false; break;
      case "KeyD": case "ArrowRight": keys.d = false; break;
      case "ShiftLeft": case "ShiftRight": shiftRunHeld = false; break;
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
