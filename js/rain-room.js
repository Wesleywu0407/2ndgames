// ─── Rain Room — Build functions & textures ───────────────────────────────────

import * as THREE from "three";
import {
  scene, camera,
  ROOM_W, ROOM_D, ROOM_H, PHOTO_W, PHOTO_H, INTERACT_DIST,
  photoMeshes, sceneLights, textureLoader,
  S
} from "./state.js";
import { photos } from "./rain-room-data.js";

// ── Utility ───────────────────────────────────────────────────────────────────
function clampColor(v) { return Math.max(0, Math.min(255, v)); }

const stillRainAnimation = {
  rainLines: [],
  floorRipples: [],
  lensRipples: [],
  glowMaterials: []
};

// ── Room shell ────────────────────────────────────────────────────────────────
export function buildRoom() {
  // GM showroom floor: bright polished white. Low roughness + envMap reflection
  // gives a glossy "wet white" sheen (the dark texture map is dropped so the
  // floor reads as pale poured resin, not charcoal stone).
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({
      color: 0xe2e5e7,
      roughness: 0.26,
      metalness: 0.2,
      envMapIntensity: 0.85
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ color: 0x97a0aa, roughness: 0.8, metalness: 0.1 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_H;
  scene.add(ceiling);

  // Brushed silver / stainless walls. Albedo map dropped (it was dark plaster);
  // the normal map stays for a faint brushed micro-texture. Brightness comes
  // from envMap reflection of the studio environment, not from diffuse light.
  const wallNorm = makeWallNormalMap();
  const wallMat  = new THREE.MeshStandardMaterial({
    normalMap: wallNorm,
    normalScale: new THREE.Vector2(0.12, 0.12),
    color: 0xb4bac0,
    roughness: 0.34,
    metalness: 0.85,
    envMapIntensity: 1.0
  });

  const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat);
  wallBack.position.set(0, ROOM_H / 2, -ROOM_D / 2);
  scene.add(wallBack);

  const wallFront = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat);
  wallFront.position.set(0, ROOM_H / 2, ROOM_D / 2);
  wallFront.rotation.y = Math.PI;
  scene.add(wallFront);

  const wallLeft = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat);
  wallLeft.position.set(-ROOM_W / 2, ROOM_H / 2, 0);
  wallLeft.rotation.y = Math.PI / 2;
  scene.add(wallLeft);

  const wallRight = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat);
  wallRight.position.set(ROOM_W / 2, ROOM_H / 2, 0);
  wallRight.rotation.y = -Math.PI / 2;
  scene.add(wallRight);

  // Baseboards
  const baseH = 0.07, baseD = 0.026;
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x11100e, roughness: 0.86 });

  const bbBack = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, baseH, baseD), baseMat);
  bbBack.position.set(0, baseH / 2, -ROOM_D / 2 + baseD / 2);
  scene.add(bbBack);

  const bbFront = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, baseH, baseD), baseMat);
  bbFront.position.set(0, baseH / 2, ROOM_D / 2 - baseD / 2);
  scene.add(bbFront);

  const bbLeft = new THREE.Mesh(new THREE.BoxGeometry(baseD, baseH, ROOM_D), baseMat);
  bbLeft.position.set(-ROOM_W / 2 + baseD / 2, baseH / 2, 0);
  scene.add(bbLeft);

  const bbRight = new THREE.Mesh(new THREE.BoxGeometry(baseD, baseH, ROOM_D), baseMat);
  bbRight.position.set(ROOM_W / 2 - baseD / 2, baseH / 2, 0);
  scene.add(bbRight);

  addArchitecturalReveals();
}

function addArchitecturalReveals() {
  const revealMat = new THREE.MeshBasicMaterial({ color: 0x020202, transparent: true, opacity: 0.82 });
  const warmEdgeMat = new THREE.MeshBasicMaterial({ color: 0x6a5a40, transparent: true, opacity: 0.04 });
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.82, metalness: 0.08 });
  const ceilingTrimMat = new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.85, metalness: 0.08 });

  // Fine shadow gaps make the room read as built architecture instead of a void.
  [
    { x: 0, z: -ROOM_D / 2 + 0.028, w: ROOM_W, rot: 0 },
    { x: 0, z: ROOM_D / 2 - 0.028, w: ROOM_W, rot: Math.PI },
  ].forEach(({ x, z, w, rot }) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.028, 0.018), revealMat);
    line.position.set(x, ROOM_H - 0.22, z);
    line.rotation.y = rot;
    scene.add(line);
  });

  [
    { x: -ROOM_W / 2 + 0.028, z: 0, rot: Math.PI / 2 },
    { x: ROOM_W / 2 - 0.028, z: 0, rot: -Math.PI / 2 },
  ].forEach(({ x, z, rot }) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(ROOM_D, 0.028, 0.018), revealMat);
    line.position.set(x, ROOM_H - 0.22, z);
    line.rotation.y = rot;
    scene.add(line);
  });

  // Keep side-wall architectural piers away from the Nekoland transition door.
  [-8.0, -4.4, -0.7, 5.1, 7.4].forEach((z) => {
    [-1, 1].forEach((sx) => {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(0.052, ROOM_H - 0.95, 0.12), pierMat);
      pier.position.set(sx * (ROOM_W / 2 - 0.035), (ROOM_H - 0.95) / 2, z);
      scene.add(pier);

      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, ROOM_H - 1.55, 0.08), warmEdgeMat);
      edge.position.set(sx * (ROOM_W / 2 - 0.052), (ROOM_H - 1.55) / 2 + 0.2, z);
      scene.add(edge);
    });
  });

  [-5.7, -2.0, 2.0, 5.7].forEach((x) => {
    const backPier = new THREE.Mesh(new THREE.BoxGeometry(0.052, ROOM_H - 1.0, 0.04), pierMat);
    backPier.position.set(x, (ROOM_H - 1.0) / 2, -ROOM_D / 2 + 0.035);
    scene.add(backPier);
  });

  // Ceiling bands establish an atrium-like rhythm above the sculpture court.
  [-5.5, 0, 5.5].forEach((z) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W - 1.4, 0.075, 0.055), ceilingTrimMat);
    beam.position.set(0, ROOM_H - 0.08, z);
    scene.add(beam);
  });
  [-4.2, 0, 4.2].forEach((x) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, ROOM_D - 2.0), ceilingTrimMat);
    beam.position.set(x, ROOM_H - 0.075, -0.15);
    scene.add(beam);
  });
}

// ── Ceiling lighting ──────────────────────────────────────────────────────────
export function buildCeilingLight() {
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ac, roughness: 0.42, metalness: 0.6 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xeaf4ff, transparent: true, opacity: 0.85, depthWrite: false });

  [-4.8, 0, 4.8].forEach((x) => {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, ROOM_D - 2.6), trackMat);
    track.position.set(x, ROOM_H - 0.11, -0.35);
    scene.add(track);
  });

  // Curated track heads — fewer, more asymmetric. The wall photos get their
  // own per-frame SpotLights in createPhoto(), so the ceiling track now mostly
  // shapes circulation: dim the central body, accent the back wall, leave the
  // right side darker than the left so the room feels composed, not lit.
  // Cool-white track grid, all lit and bright — now a primary light source.
  const trackHeads = [
    { x: -4.8, z: -8.8, tx: -4.1, tz: -ROOM_D / 2 + 0.16, int: 3.4, color: 0xeaf2ff },
    { x:  0.0, z: -8.9, tx:  0.0, tz: -ROOM_D / 2 + 0.16, int: 3.0, color: 0xf0f6ff },
    { x:  4.8, z: -4.7, tx:  ROOM_W / 2 - 0.18, tz: -5.6, int: 3.0, color: 0xe6efff },
    { x: -4.8, z: -0.4, tx: -ROOM_W / 2 + 0.18, tz: -0.8, int: 3.0, color: 0xeaf2ff },
    { x:  0.0, z:  6.7, tx: -2.7, tz: ROOM_D / 2 - 0.22, int: 2.6, color: 0xeef4ff },
  ];

  trackHeads.forEach(({ x, z, tx, tz, int, color }) => {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.102, 0.22, 16), trackMat);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(x, ROOM_H - 0.22, z);
    scene.add(housing);

    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.068, 16), glowMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(x, ROOM_H - 0.345, z);
    scene.add(disc);

    const spot = new THREE.SpotLight(color, int, 13.5, Math.PI / 7.8, 0.68, 1.24);
    spot.position.set(x, ROOM_H - 0.35, z);
    const target = new THREE.Object3D();
    target.position.set(tx, 1.45, tz);
    scene.add(target);
    spot.target = target;
    scene.add(spot);
    sceneLights.push({ light: spot, onIntensity: int });
  });

  [-5.8, -2.9, 0, 2.9, 5.8].forEach((z, i) => {
    const x = i % 2 === 0 ? -2.4 : 2.4;
    const downlight = new THREE.Mesh(new THREE.CircleGeometry(0.09, 18), glowMat.clone());
    downlight.rotation.x = Math.PI / 2;
    downlight.position.set(x, ROOM_H - 0.03, z);
    scene.add(downlight);
  });

  // Atrium + entry washes and point fills removed: the per-photo spots and
  // sculpture spot now do the lighting. The room should read as "dark with
  // intentional light pools", not "softly lit everywhere".
}

// ── Photos ────────────────────────────────────────────────────────────────────
export function buildPhotos() {
  // Back wall: four works across the left and centre, leaving the door corner bare.
  createPhoto(photos[0],  new THREE.Vector3(-5.05, 2.42, -ROOM_D / 2 + 0.06),  0,            0.92, 1.1);
  createPhoto(photos[1],  new THREE.Vector3(-2.45, 2.42, -ROOM_D / 2 + 0.06),  0,            0.86, 1.2);
  createPhoto(photos[2],  new THREE.Vector3( 0.50, 2.42, -ROOM_D / 2 + 0.06),  0,            0.86, 1.1);
  createPhoto(photos[3],  new THREE.Vector3( 3.20, 2.42, -ROOM_D / 2 + 0.06),  0,            0.80, 1.0);

  // Left wall: four works spaced between the architectural piers.
  createPhoto(photos[5],  new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.40, -9.00),  Math.PI / 2,  0.82, 1.0);
  createPhoto(photos[4],  new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.40, -5.40),  Math.PI / 2,  0.90, 1.1);
  createPhoto(photos[7],  new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.38,  2.20),  Math.PI / 2,  0.82, 1.0);
  createPhoto(photos[6],  new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.30,  6.10),  Math.PI / 2,  0.70, 0.8);

  // Right wall: four works, each in its own pier bay, reading front-to-back.
  createPhoto(photos[9],  new THREE.Vector3( ROOM_W / 2 - 0.06, 2.42, -6.20), -Math.PI / 2,  0.86, 1.0);
  createPhoto(photos[8],  new THREE.Vector3( ROOM_W / 2 - 0.06, 2.40, -2.20), -Math.PI / 2,  0.88, 0.9);
  createPhoto(photos[10], new THREE.Vector3( ROOM_W / 2 - 0.06, 2.38,  2.50), -Math.PI / 2,  0.82, 1.0);
  createPhoto(photos[11], new THREE.Vector3( ROOM_W / 2 - 0.06, 2.35,  6.50), -Math.PI / 2,  0.78, 0.9);
}

// ── Floor glows ───────────────────────────────────────────────────────────────
export function buildFloorGlows() {
  const glowPositions = [
    { x: 0, z: -8.8, sx: 6.2, sz: 1.22, opacity: 0.082 },
    { x: 0, z: -1.0, sx: 5.3, sz: 3.9, opacity: 0.088 },
    { x: 0, z: 3.1, sx: 3.2, sz: 1.3, opacity: 0.044 },
    { x: 0, z: 7.5, sx: 4.2, sz: 1.48, opacity: 0.052 },
    { x: -6.3, z: -4.2, sx: 1.55, sz: 2.25, opacity: 0.044 },
    { x: -6.3, z: 2.5, sx: 1.55, sz: 2.15, opacity: 0.038 },
    { x: 6.3, z: -4.0, sx: 1.55, sz: 2.25, opacity: 0.044 },
    { x: 6.3, z: 2.6, sx: 1.55, sz: 2.15, opacity: 0.038 }
  ];

  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0,    "rgba(220,238,245,0.13)");
  grad.addColorStop(0.42, "rgba(255,211,150,0.045)");
  grad.addColorStop(1,    "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(canvas);

  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending
  });

  for (const p of glowPositions) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.sx, p.sz), glowMat.clone());
    mesh.material.opacity = p.opacity;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, 0.012, p.z);
    scene.add(mesh);
  }
}

// ── Arcade cabinet (back-right, leads to Candy Maze Room) ─────────────────────
export function buildDoorway() {
  const doorX = ROOM_W / 2 - 2.25;
  const doorZ = -ROOM_D / 2 + 0.05;
  const cabinetZ = doorZ + 0.39;

  if (S.arcadeCabinet) {
    scene.remove(S.arcadeCabinet);
    disposeObject3D(S.arcadeCabinet);
  }

  const arcadeCabinet = new THREE.Group();
  arcadeCabinet.name = "arcadeCabinet";
  arcadeCabinet.position.set(doorX, 0, cabinetZ);

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.7,
    metalness: 0.2
  });
  const plasticMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.58,
    metalness: 0.12
  });
  const redPanelMat = new THREE.MeshStandardMaterial({
    color: 0xc41e3a,
    roughness: 0.34,
    metalness: 0.22
  });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.72, metalness: 0.12 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.8, 0.75), shellMat);
  body.position.y = 0.9;
  body.castShadow = true;
  body.receiveShadow = true;
  arcadeCabinet.add(body);

  const marquee = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.22, 0.18),
    new THREE.MeshStandardMaterial({
      color: 0x121212,
      emissive: 0x00ff66,
      emissiveIntensity: 0.4,
      roughness: 0.42,
      metalness: 0.15
    })
  );
  marquee.position.set(0, 1.72, 0.42);
  marquee.rotation.x = THREE.MathUtils.degToRad(-5);
  marquee.castShadow = true;
  arcadeCabinet.add(marquee);

  const marqueeFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.16),
    new THREE.MeshBasicMaterial({ map: makeMarqueeTexture(), transparent: true })
  );
  marqueeFace.position.set(0, 1.72, 0.515);
  marqueeFace.rotation.x = marquee.rotation.x;
  arcadeCabinet.add(marqueeFace);

  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.45, 0.05), plasticMat);
  bezel.position.set(0, 1.39, 0.405);
  bezel.rotation.x = THREE.MathUtils.degToRad(-10);
  bezel.castShadow = true;
  bezel.receiveShadow = true;
  arcadeCabinet.add(bezel);

  const screenTexture = createAttractTexture();
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.38),
    new THREE.MeshBasicMaterial({ map: screenTexture })
  );
  screen.position.set(0, 1.39, 0.438);
  screen.rotation.x = bezel.rotation.x;
  arcadeCabinet.add(screen);

  const controlPanel = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.08, 0.35), redPanelMat);
  controlPanel.position.set(0, 1.02, 0.52);
  controlPanel.rotation.x = THREE.MathUtils.degToRad(15);
  controlPanel.castShadow = true;
  controlPanel.receiveShadow = true;
  arcadeCabinet.add(controlPanel);

  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.10, 12), blackMat);
  stick.position.set(-0.17, 1.095, 0.57);
  stick.rotation.x = THREE.MathUtils.degToRad(15);
  stick.castShadow = true;
  arcadeCabinet.add(stick);
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.025, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xd7182a, roughness: 0.24, metalness: 0.2 })
  );
  ball.position.set(-0.17, 1.16, 0.59);
  ball.castShadow = true;
  arcadeCabinet.add(ball);

  const buttonColors = [0xff0038, 0xffcc00, 0x0088ff, 0x00ff66];
  buttonColors.forEach((color, i) => {
    const button = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.012, 18),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.18,
        roughness: 0.28,
        metalness: 0.12
      })
    );
    button.rotation.x = Math.PI / 2 + THREE.MathUtils.degToRad(15);
    button.position.set(0.13 + (i % 2) * 0.075, 1.115 + Math.floor(i / 2) * 0.004, 0.545 + Math.floor(i / 2) * 0.065);
    button.castShadow = true;
    arcadeCabinet.add(button);
  });

  const coinSlot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), blackMat);
  coinSlot.position.set(0, 0.73, 0.767);
  coinSlot.castShadow = true;
  arcadeCabinet.add(coinSlot);
  const coinText = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 0.052),
    new THREE.MeshBasicMaterial({ map: makeCoinTexture(), transparent: true })
  );
  coinText.position.set(0, 0.67, 0.779);
  arcadeCabinet.add(coinText);

  const sideTex = makeSideArtTexture();
  [
    { x: -0.332, rot: -Math.PI / 2 },
    { x:  0.332, rot:  Math.PI / 2 }
  ].forEach(({ x, rot }) => {
    const side = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 1.5),
      new THREE.MeshBasicMaterial({ map: sideTex, transparent: true })
    );
    side.position.set(x, 0.92, 0.08);
    side.rotation.y = rot;
    arcadeCabinet.add(side);
  });

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.2),
    new THREE.MeshBasicMaterial({
      map: makeFloorShadowTexture(),
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.012, 0.16);
  arcadeCabinet.add(shadow);

  S.arcadeScreenLight = new THREE.PointLight(0x00ff66, 0.3, 1.5, 1.65);
  S.arcadeScreenLight.position.set(0, 1.39, 0.82);
  arcadeCabinet.add(S.arcadeScreenLight);

  S.arcadeCabinet = arcadeCabinet;
  S.arcadeJoystick = { stick, ball };
  S.arcadeScreenTexture = screenTexture;
  S.arcadeScreenMesh = screen;
  S.arcadeScreenWorld = new THREE.Vector3();
  S.doorway = arcadeCabinet;
  S.doorGlow = null;
  S.doorSpot = S.arcadeScreenLight;
  S.doorObj = { position: arcadeCabinet.position, isDoor: true, isArcadeCabinet: true };
  scene.add(arcadeCabinet);
}

export function updateArcadeCabinet(time) {
  if (!S.arcadeCabinet) return;
  updateAttractTexture(time);
  const wobble = Math.sin(time * 0.0031) * THREE.MathUtils.degToRad(2);
  if (S.arcadeJoystick?.stick) S.arcadeJoystick.stick.rotation.z = wobble;
  if (S.arcadeJoystick?.ball) S.arcadeJoystick.ball.position.x = -0.17 + Math.sin(time * 0.0031) * 0.012;
  if (S.arcadeScreenLight) {
    const target = S.nearestTarget === S.doorObj ? 0.5 : 0.3;
    S.arcadeScreenLight.intensity += (target - S.arcadeScreenLight.intensity) * 0.08;
  }
}

function createAttractTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 384;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData = { canvas, ctx: canvas.getContext("2d"), flickerUntil: 0, lastFlicker: 0 };
  return texture;
}

function updateAttractTexture(time) {
  const texture = S.arcadeScreenTexture;
  if (!texture) return;
  const { canvas, ctx } = texture.userData;
  const speed = S.arcadeAttractSpeed || 1;
  const t = (time * 0.001 * speed) % 6;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillStyle = "rgba(0,255,102,0.08)";
    ctx.fillRect(0, y, canvas.width, 2);
  }

  if (time - texture.userData.lastFlicker > 3600 + Math.random() * 1800) {
    texture.userData.lastFlicker = time;
    texture.userData.flickerUntil = time + 60;
  }

  if (t < 2) {
    drawArcadeScreenText(ctx, "2ND EYES", 256, 166, 34, "#00ff66");
  } else if (t < 4) {
    drawArcadeScreenText(ctx, "ROOM 03", 256, 148, 34, "#ff0080");
    drawArcadeScreenText(ctx, "CANDY MAZE", 256, 216, 18, "#ff0080");
  } else if (Math.floor((t - 4) / 0.4) % 2 === 0) {
    drawArcadeScreenText(ctx, "INSERT COIN", 256, 176, 26, "#ffff00");
  }

  const noise = ctx.createImageData(canvas.width, canvas.height);
  for (let i = 0; i < noise.data.length; i += 4 * 83) {
    const n = Math.random() * 255;
    noise.data[i] = n;
    noise.data[i + 1] = n;
    noise.data[i + 2] = n;
    noise.data[i + 3] = 13;
  }
  ctx.putImageData(noise, 0, 0);

  const vignette = ctx.createRadialGradient(256, 192, 80, 256, 192, 300);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (time < texture.userData.flickerUntil) {
    ctx.fillStyle = "rgba(0,0,0,0.30)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  texture.needsUpdate = true;
}

function drawArcadeScreenText(ctx, text, x, y, size, color) {
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size}px "Press Start 2P", monospace`;
  ctx.fillStyle = "rgba(255,0,0,0.46)";
  ctx.fillText(text, x - 2, y);
  ctx.fillStyle = "rgba(0,0,255,0.46)";
  ctx.fillText(text, x + 2, y);
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.34;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 9;
  ctx.globalAlpha = 0.72;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function makeMarqueeTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawArcadeScreenText(ctx, "2ND EYES", 256, 78, 42, "#00ff66");
  ctx.font = 'bold 16px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.fillStyle = "#ff0080";
  ctx.shadowColor = "#ff0080";
  ctx.shadowBlur = 12;
  ctx.fillText("CANDY MAZE", 256, 126);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeCoinTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 20px "Press Start 2P", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffff00";
  ctx.shadowColor = "#ffff00";
  ctx.shadowBlur = 10;
  ctx.fillText("INSERT COIN", 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSideArtTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#ff0080";
  ctx.lineWidth = 8;
  ctx.strokeRect(18, 18, 220, 476);
  ctx.fillStyle = "#ff0080";
  ctx.shadowColor = "#ff0080";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(128, 190, 48, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#050505";
  ctx.beginPath();
  ctx.arc(144, 176, 6, 0, Math.PI * 2);
  ctx.arc(144, 204, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#00ff66";
  for (let i = 0; i < 7; i += 1) {
    ctx.beginPath();
    ctx.arc(60 + i * 24, 310 + Math.sin(i) * 26, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(52, 450);
  ctx.rotate(-Math.PI / 2);
  ctx.font = 'bold 24px "Press Start 2P", monospace';
  ctx.fillStyle = "#ff0080";
  ctx.fillText("2ND EYES", 0, 0);
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFloorShadowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(0,0,0,0.58)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function disposeObject3D(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((mat) => {
        if (mat.map) mat.map.dispose();
        mat.dispose();
      });
    }
  });
}

// ── Bench ─────────────────────────────────────────────────────────────────────
export function buildBench() {
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2c2620, roughness: 0.82, metalness: 0.02 });
  const legMat  = new THREE.MeshStandardMaterial({ color: 0x171411, roughness: 0.84, metalness: 0.04 });
  const BZ = -4.8;

  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.07, 0.44), seatMat);
  seat.position.set(0, 0.45, BZ);
  scene.add(seat);

  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.012, 0.44), legMat);
  strip.position.set(0, 0.487, BZ);
  scene.add(strip);

  for (const [lx, lz] of [[-0.8, -0.16], [0.8, -0.16], [-0.8, 0.16], [0.8, 0.16]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.44, 0.055), legMat);
    leg.position.set(lx, 0.22, BZ + lz);
    scene.add(leg);
  }

  const benchSpot = new THREE.SpotLight(0xffd0a0, 1.25, 6.2, Math.PI / 5.8, 0.68, 1.25);
  benchSpot.position.set(0, ROOM_H - 0.2, BZ - 0.5);
  const bt = new THREE.Object3D();
  bt.position.set(0, 0.45, BZ);
  scene.add(bt);
  benchSpot.target = bt;
  scene.add(benchSpot);
  sceneLights.push({ light: benchSpot, onIntensity: 1.25 });
}

// ── Floor decals ──────────────────────────────────────────────────────────────
export function buildFloorDecals() {
  function makeCircleDecal(innerText, subText) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext("2d");

    ctx.strokeStyle = "rgba(215,225,226,0.24)";
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(256, 256, 222, 0, Math.PI * 2); ctx.stroke();

    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(256, 256, 195, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = "rgba(215,225,226,0.22)";
    ctx.font = "500 36px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(innerText, 256, 248);

    ctx.font = "300 22px Georgia, serif";
    ctx.fillStyle = "rgba(205,194,162,0.20)";
    ctx.fillText(subText, 256, 282);

    return new THREE.CanvasTexture(canvas);
  }

  const entranceMat = new THREE.MeshBasicMaterial({
    map: makeCircleDecal("2ND EYES", "Rain Room"),
    transparent: true, opacity: 0.24, depthWrite: false
  });
  const entrance = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), entranceMat);
  entrance.rotation.x = -Math.PI / 2;
  entrance.position.set(0, 0.005, ROOM_D / 2 - 3.0);
  scene.add(entrance);

  const viewMat = new THREE.MeshBasicMaterial({
    map: makeCircleDecal("", ""),
    transparent: true, opacity: 0.14, depthWrite: false
  });
  const viewSpot = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), viewMat);
  viewSpot.rotation.x = -Math.PI / 2;
  viewSpot.position.set(0, 0.005, -4.6);
  scene.add(viewSpot);
}

// ── Museum layer: signage, rails, guide path, and gallery furniture ───────────
export function buildMuseumDetails() {
  buildMuseumEntryWall();
  buildCentralSculptureCourt();
  buildPictureRails();
  buildMuseumSectionLabels();
  buildVisitorGuidePath();
  buildQuietBarriers();
  buildInfoPlinth();
  buildNextGallerySign();
}

function buildCentralSculptureCourt() {
  stillRainAnimation.rainLines.length = 0;
  stillRainAnimation.floorRipples.length = 0;
  stillRainAnimation.lensRipples.length = 0;
  stillRainAnimation.glowMaterials.length = 0;

  const plasterTex = makePlasterTexture();
  plasterTex.wrapS = plasterTex.wrapT = THREE.RepeatWrapping;
  plasterTex.repeat.set(1.2, 1.8);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0xc8c7bf,
    map: plasterTex,
    bumpMap: plasterTex,
    bumpScale: 0.012,
    roughness: 0.76,
    metalness: 0.015
  });
  const plinthEdgeMat = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.42, metalness: 0.38 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.32, metalness: 0.58 });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0xd0c4a8, roughness: 0.34, metalness: 0.42 });
  const cx = 0;
  const cz = -0.9;

  // Central surreal-luxury staging: "03. SYNTHETIC WAVE".
  const floorRing = new THREE.Mesh(
    new THREE.CircleGeometry(2.42, 72),
    new THREE.MeshBasicMaterial({ color: 0xb8d8e4, transparent: true, opacity: 0.046, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.scale.set(1.24, 0.58, 1);
  floorRing.position.set(cx, 0.018, cz);
  scene.add(floorRing);

  [1.25, 1.82, 2.34].forEach((radius, i) => {
    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.014, 72),
      new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xe2f7ff : i === 1 ? 0xb7cbd3 : 0xd8d0ea,
        transparent: true,
        opacity: 0.085 - i * 0.018,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.scale.set(1.24, 0.58, 1);
    ripple.position.set(cx, 0.026 + i * 0.002, cz);
    scene.add(ripple);
    stillRainAnimation.floorRipples.push({
      mesh: ripple,
      baseOpacity: ripple.material.opacity,
      baseScale: ripple.scale.clone(),
      phase: i * 1.35
    });
  });

  const contactShadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.18, 48),
    new THREE.MeshBasicMaterial({ color: 0x010101, transparent: true, opacity: 0.32, depthWrite: false })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.scale.set(1.18, 0.72, 1);
  contactShadow.position.set(cx, 0.024, cz);
  scene.add(contactShadow);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.04, 1.14, 0.12, 72), plinthEdgeMat);
  base.position.set(cx, 0.06, cz);
  scene.add(base);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.98, 0.66, 72), plinthMat);
  plinth.position.set(cx, 0.45, cz);
  scene.add(plinth);

  const topLip = new THREE.Mesh(new THREE.CylinderGeometry(0.94, 0.88, 0.06, 72), plinthEdgeMat);
  topLip.position.set(cx, 0.81, cz);
  scene.add(topLip);

  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.22),
    new THREE.MeshBasicMaterial({ map: makeSculpturePlaqueTexture(), transparent: false })
  );
  plaque.position.set(cx, 0.47, cz + 0.594);
  plaque.rotation.x = -0.08;
  scene.add(plaque);

  // Abstract Wave Study: a single profile-swept form, staged as installation art.
  {
    // ── Step 1: J-shape profile in the y-z plane ──────────────────────────────
    // Control points are (z, y). z = +0.9 is the front-toe (anchor); the curve
    // climbs the back face with a -z dip (concave), peaks at the crest, then
    // curls forward and down to the lip tip.
    const PROFILE_CTRL = [
      [ 0.90, 0.00],   // 0  front toe (anchor for taper)
      [ 0.78, 0.05],   // 1
      [ 0.62, 0.18],   // 2  foot rising
      [ 0.45, 0.38],   // 3
      [ 0.30, 0.62],   // 4  entering the concave bowl
      [ 0.22, 0.92],   // 5  middle of the face (back-most point on the face)
      [ 0.10, 1.20],   // 6  climbing out of the bowl
      [-0.05, 1.45],   // 7
      [-0.10, 1.55],   // 8  crest (back-most point overall)
      [ 0.05, 1.65],   // 9  peeling forward over the top
      [ 0.28, 1.68],   // 10 top of the curl
      [ 0.50, 1.55],   // 11 lip coming down
      [ 0.58, 1.35],   // 12 lip diving toward the inside of the tube
      [ 0.52, 1.15],   // 13
      [ 0.42, 1.05],   // 14 lip tip — open (no closure back to the face)
    ];
    const ctrlV3 = PROFILE_CTRL.map(([pz, py]) => new THREE.Vector3(0, py, pz));
    const profileCurve = new THREE.CatmullRomCurve3(ctrlV3, false, "centripetal");
    const N_PROFILE = 48;
    // getPoints(N-1) yields N samples evenly along the curve.
    const profileSamples = profileCurve.getPoints(N_PROFILE - 1);

    // ── Step 2 & 3: sweep along x, apply gentle -z arc, taper anchored at toe ─
    const N_SEC   = 80;
    const X_HALF  = 1.25;
    const ANCHOR_Z = 0.90, ANCHOR_Y = 0.00;
    const positions = [];

    // Surreal-luxury distortion: the clean symmetric wave is twisted, leaned and
    // folded so it reads as "beautiful but slightly wrong" — a GM-style oddity.
    // Topology (counts/indices/end caps) is untouched; only vertex positions move.
    const TWIST = 0.95;   // radians the profile rolls from one end to the other
    for (let i = 0; i < N_SEC; i++) {
      const t  = i / (N_SEC - 1);                            // 0..1 along x
      const x  = -X_HALF + 2 * X_HALF * t;
      // Asymmetric taper: the bulk is pushed toward the -x end, not centred.
      const env    = Math.sin(Math.pow(t, 1.4) * Math.PI);
      const scale  = 0.22 + 0.86 * Math.pow(Math.max(env, 0), 0.7);
      // Bowed back plus a secondary fold gives an irregular, uneasy ridge.
      const zArc   = -0.18 * Math.sin(t * Math.PI) + 0.085 * Math.sin(t * Math.PI * 3 + 0.7);
      // Progressive roll of the profile about the toe anchor (the twist).
      const roll   = TWIST * (t - 0.5);
      const cosR = Math.cos(roll), sinR = Math.sin(roll);
      for (let j = 0; j < N_PROFILE; j++) {
        const p  = profileSamples[j];
        // Scale around the front-toe anchor so the ends shrink but stay grounded.
        const dy = (p.y - ANCHOR_Y) * scale;
        const dz = (p.z - ANCHOR_Z) * scale;
        // Roll in the y-z plane so the crest tips and twists along its length.
        const py = ANCHOR_Y + (dy * cosR - dz * sinR);
        const pz = ANCHOR_Z + (dy * sinR + dz * cosR) + zArc;
        positions.push(x, py, pz);
      }
    }

    // ── Step 4: indices — quads between adjacent sections ─────────────────────
    const indices = [];
    for (let i = 0; i < N_SEC - 1; i++) {
      for (let j = 0; j < N_PROFILE - 1; j++) {
        const a = i * N_PROFILE + j;
        const b = (i + 1) * N_PROFILE + j;
        const c = (i + 1) * N_PROFILE + (j + 1);
        const d = i * N_PROFILE + (j + 1);
        indices.push(a, b, c, a, c, d);
      }
    }

    // End-cap triangle fans close the two small tapered ends.
    function addEndCap(secIdx, reverseWind) {
      const base = secIdx * N_PROFILE;
      let mx = 0, my = 0, mz = 0;
      for (let j = 0; j < N_PROFILE; j++) {
        mx += positions[(base + j) * 3];
        my += positions[(base + j) * 3 + 1];
        mz += positions[(base + j) * 3 + 2];
      }
      mx /= N_PROFILE; my /= N_PROFILE; mz /= N_PROFILE;
      const centroidIdx = positions.length / 3;
      positions.push(mx, my, mz);
      for (let j = 0; j < N_PROFILE - 1; j++) {
        const a = base + j;
        const b = base + j + 1;
        if (reverseWind) indices.push(centroidIdx, b, a);
        else             indices.push(centroidIdx, a, b);
      }
    }
    addEndCap(0,         false);
    addEndCap(N_SEC - 1, true);

    const waveGeom = new THREE.BufferGeometry();
    waveGeom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    waveGeom.setIndex(indices);
    waveGeom.computeVertexNormals();

    const waveMat = new THREE.MeshStandardMaterial({
      color: 0xf1efe9,
      roughness: 0.5,
      metalness: 0,
      envMapIntensity: 0.5,
      emissive: 0x6e9fb0,
      emissiveIntensity: 0.012,
      side: THREE.DoubleSide
    });
    stillRainAnimation.glowMaterials.push({ mat: waveMat, base: 0.012, range: 0.008, phase: 0.4 });

    const wave = new THREE.Mesh(waveGeom, waveMat);
    // Plinth top sits just above y 0.84; the wave bites slightly into the stone.
    // Enlarged (and stretched taller) so it dominates the room with presence.
    wave.position.set(cx, 0.82, cz);
    wave.scale.set(1.4, 1.5, 1.4);
    wave.castShadow = true;
    wave.receiveShadow = true;
    scene.add(wave);

    const waveHalo = new THREE.Mesh(
      new THREE.PlaneGeometry(3.05, 2.05),
      new THREE.MeshBasicMaterial({
        map: makeWaveHaloTexture(),
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    waveHalo.position.set(cx, 1.72, cz + 0.62);
    scene.add(waveHalo);
    stillRainAnimation.lensRipples.push({
      mesh: waveHalo,
      baseOpacity: waveHalo.material.opacity,
      baseScale: waveHalo.scale.clone(),
      phase: 2.1
    });
  }

  // Museum barrier: even ellipse with an open front view toward the gallery entry.
  const barrierAngles = [145, 180, 215, 250, 290, 325, 35].map(a => THREE.MathUtils.degToRad(a));
  const barrierPoints = barrierAngles.map(a => [Math.cos(a) * 1.95, Math.sin(a) * 1.72]);
  barrierPoints.forEach(([x, z]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.045, 0.64, 12), postMat);
    post.position.set(cx + x, 0.32, cz + z);
    scene.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 8), postMat);
    cap.position.set(cx + x, 0.66, cz + z);
    scene.add(cap);
  });

  for (let i = 0; i < barrierPoints.length - 1; i++) {
    const a = barrierPoints[i];
    const b = barrierPoints[i + 1];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, len, 8), bronzeMat);
    rope.position.set(cx + (a[0] + b[0]) / 2, 0.58, cz + (a[1] + b[1]) / 2);
    rope.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx, 0, dz).normalize()
    );
    scene.add(rope);
  }

  // Tightly focused warm-white key on the wave. Casts a soft shadow into the
  // dark floor so the sculpture sits in its own light pool.
  const sculptureSpot = new THREE.SpotLight(0xe8f0ff, 6.0, 13.0, Math.PI / 7, 0.6, 1.5);
  sculptureSpot.position.set(cx - 0.28, ROOM_H - 0.22, cz + 0.18);
  sculptureSpot.castShadow = true;
  sculptureSpot.shadow.mapSize.set(1024, 1024);
  sculptureSpot.shadow.bias = -0.0005;
  const target = new THREE.Object3D();
  target.position.set(cx, 2.1, cz);
  scene.add(target);
  sculptureSpot.target = target;
  scene.add(sculptureSpot);
  sceneLights.push({ light: sculptureSpot, onIntensity: 6.0 });

  const fill = new THREE.PointLight(0x9edcff, 0.46, 4.8, 1.8);
  fill.position.set(cx + 1.85, 1.55, cz + 1.1);
  scene.add(fill);
  sceneLights.push({ light: fill, onIntensity: 0.46 });

  const sideFill = new THREE.PointLight(0xcfc2ff, 0.14, 4.2, 1.9);
  sideFill.position.set(cx - 1.6, 1.9, cz - 0.8);
  scene.add(sideFill);
  sceneLights.push({ light: sideFill, onIntensity: 0.14 });

  S.rainSculptureHotspot = {
    position: new THREE.Vector3(cx, 1.15, cz + 0.72),
    type: "rainSculpture"
  };
  S.rainSculptureFX = {
    sculptureSpot,
    coolFill: fill,
    lavenderFill: sideFill
  };
}

export function updateStillRainInstallation(time) {
  const hasAnimation =
    stillRainAnimation.rainLines.length ||
    stillRainAnimation.floorRipples.length ||
    stillRainAnimation.lensRipples.length ||
    stillRainAnimation.glowMaterials.length;
  if (!hasAnimation) return;
  const t = time * 0.001;
  const focus = S.rainSculptureFocused ? 1 : 0;

  stillRainAnimation.rainLines.forEach(({ mesh, baseY, baseOpacity, phase }) => {
    const shimmer = 0.5 + 0.5 * Math.sin(t * 1.35 + phase);
    mesh.material.opacity = baseOpacity * (0.78 + shimmer * 0.30);
    mesh.position.y = baseY + Math.sin(t * 0.82 + phase) * 0.018;
    mesh.scale.y = 0.96 + shimmer * 0.05;
  });

  stillRainAnimation.floorRipples.forEach(({ mesh, baseOpacity, baseScale, phase }) => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.42 + phase);
    const scale = 1 + pulse * (0.026 + focus * 0.018);
    mesh.material.opacity = baseOpacity * (0.70 + pulse * 0.36 + focus * 0.64);
    mesh.scale.set(baseScale.x * scale, baseScale.y * scale, baseScale.z);
  });

  stillRainAnimation.lensRipples.forEach(({ mesh, baseOpacity, baseScale, phase }) => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.36 + phase);
    const scale = 1 + pulse * (0.018 + focus * 0.012);
    mesh.material.opacity = baseOpacity * (0.68 + pulse * 0.34 + focus * 0.28);
    mesh.scale.set(baseScale.x * scale, baseScale.y * scale, baseScale.z);
  });

  stillRainAnimation.glowMaterials.forEach(({ mat, base, range, phase }) => {
    mat.emissiveIntensity = base + focus * 0.025 + range * (0.5 + 0.5 * Math.sin(t * 0.38 + phase));
  });

  if (S.rainSculptureFX) {
    S.rainSculptureFX.sculptureSpot.intensity += ((focus ? 7.0 : 6.0) - S.rainSculptureFX.sculptureSpot.intensity) * 0.06;
    S.rainSculptureFX.coolFill.intensity += ((focus ? 0.68 : 0.46) - S.rainSculptureFX.coolFill.intensity) * 0.06;
    S.rainSculptureFX.lavenderFill.intensity += ((focus ? 0.22 : 0.14) - S.rainSculptureFX.lavenderFill.intensity) * 0.06;
  }
}

function buildMuseumEntryWall() {
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.45, 1.42),
    new THREE.MeshBasicMaterial({
      map: makeMuseumPanelTexture({
        kicker: "GALLERY GUIDE",
        title: "Rain Room",
        subtitle: "Coastal Light Studies",
        body: "A controlled environment for water memory. Observe the photographs. Approach the central object. The room reacts when light is repeated."
      }),
      transparent: true
    })
  );
  panel.rotation.y = Math.PI;
  panel.position.set(-4.15, 2.14, ROOM_D / 2 - 0.045);
  scene.add(panel);

  const sideRule = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 1.50, 0.018),
    new THREE.MeshBasicMaterial({ color: 0xd6c49b, transparent: true, opacity: 0.42 })
  );
  sideRule.position.set(-6.42, 2.14, ROOM_D / 2 - 0.055);
  scene.add(sideRule);
}

function buildPictureRails() {
  const railMat = new THREE.MeshStandardMaterial({ color: 0x11100e, roughness: 0.68, metalness: 0.18 });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd0c0a0, transparent: true, opacity: 0.16 });

  const backRail = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.035, 0.035), railMat);
  backRail.position.set(0, 3.34, -ROOM_D / 2 + 0.04);
  scene.add(backRail);
  const backLine = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.012, 0.012), lineMat);
  backLine.position.set(0, 3.05, -ROOM_D / 2 + 0.035);
  scene.add(backLine);

  [
    { x: -ROOM_W / 2 + 0.04, rot: Math.PI / 2, z: -0.8 },
    { x:  ROOM_W / 2 - 0.04, rot: -Math.PI / 2, z: -0.8 }
  ].forEach(({ x, rot, z }) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.035, 0.035), railMat);
    rail.rotation.y = rot;
    rail.position.set(x, 3.28, z);
    scene.add(rail);

    const line = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.012, 0.012), lineMat);
    line.rotation.y = rot;
    line.position.set(x, 2.98, z);
    scene.add(line);
  });
}

function buildMuseumSectionLabels() {
  addWallLabel("A. COASTAL LIGHT", "headland / horizon / pale air", new THREE.Vector3(0, 3.62, -ROOM_D / 2 + 0.052), 0);
  addWallLabel("B. SYNTHETIC WEATHER", "tide / reflection / controlled light", new THREE.Vector3(-ROOM_W / 2 + 0.055, 3.54, -1.3), Math.PI / 2);
  addWallLabel("C. REPEATED LIGHT", "surface / distance / weather loop", new THREE.Vector3(ROOM_W / 2 - 0.055, 3.54, -1.15), -Math.PI / 2);
}

function addWallLabel(title, subtitle, position, rotationY) {
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.72, 0.36),
    new THREE.MeshBasicMaterial({
      map: makeMuseumLabelTexture(title, subtitle),
      transparent: true,
      depthWrite: false
    })
  );
  label.position.copy(position);
  label.rotation.y = rotationY;
  scene.add(label);
}

function buildVisitorGuidePath() {
  const pathMat = new THREE.MeshBasicMaterial({ color: 0xc9b88a, transparent: true, opacity: 0.16, depthWrite: false });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.042, 16.8), pathMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.011, -0.5);
  scene.add(line);

  const tickMat = new THREE.MeshBasicMaterial({ color: 0xc9b88a, transparent: true, opacity: 0.26, depthWrite: false });
  [-8.6, -5.8, -2.9, 0, 2.9, 5.8, 8.4].forEach((z, i) => {
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(i % 2 === 0 ? 0.78 : 0.48, 0.023), tickMat);
    tick.rotation.x = -Math.PI / 2;
    tick.position.set(0, 0.014, z);
    scene.add(tick);
  });

  const arrow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.46),
    new THREE.MeshBasicMaterial({ map: makeFloorArrowTexture(), transparent: true, depthWrite: false })
  );
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(0, 0.016, -9.25);
  scene.add(arrow);
}

function buildQuietBarriers() {
  const postMat = new THREE.MeshStandardMaterial({ color: 0x1b1916, roughness: 0.58, metalness: 0.24 });
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x6f6046, roughness: 0.7, metalness: 0.04 });
  const points = [
    [-6.85, -6.75], [-6.85, 1.85],
    [6.85, -6.6], [6.85, 4.25]
  ];

  points.forEach(([x, z]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.62, 10), postMat);
    post.position.set(x, 0.31, z);
    scene.add(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), postMat);
    cap.position.set(x, 0.64, z);
    scene.add(cap);
  });

  [
    [[-6.85, -6.75], [-6.85, 1.85]],
    [[6.85, -6.6], [6.85, 4.25]]
  ].forEach(([a, b]) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 8), ropeMat);
    rope.position.set((a[0] + b[0]) / 2, 0.56, (a[1] + b[1]) / 2);
    rope.rotation.z = Math.PI / 2;
    rope.rotation.y = Math.atan2(dz, dx);
    scene.add(rope);
  });
}

function buildInfoPlinth() {
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0x171615, roughness: 0.84, metalness: 0.04 });
  const topMat = new THREE.MeshStandardMaterial({ color: 0xc8beb0, roughness: 0.72 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.78, 0.52), plinthMat);
  plinth.position.set(5.85, 0.39, 8.65);
  scene.add(plinth);

  const reader = new THREE.Mesh(
    new THREE.PlaneGeometry(0.68, 0.42),
    new THREE.MeshBasicMaterial({ map: makeMuseumInfoTexture(), transparent: false })
  );
  reader.position.set(5.85, 0.86, 8.52);
  reader.rotation.x = -0.72;
  scene.add(reader);

  const top = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.035, 0.56), topMat);
  top.position.set(5.85, 0.80, 8.65);
  scene.add(top);
}

function buildNextGallerySign() {
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.35, 0.36),
    new THREE.MeshBasicMaterial({ map: makeMuseumLabelTexture("NEXT GALLERY", "Nekoland Room"), transparent: true })
  );
  sign.position.set(ROOM_W / 2 - 2.25, 3.12, -ROOM_D / 2 + 0.052);
  scene.add(sign);
}

// ── Dust particles ────────────────────────────────────────────────────────────
export function buildDust() {
  const dustCount = 54;
  const geo = new THREE.BufferGeometry();
  const positions  = new Float32Array(dustCount * 3);
  const velocities = new Float32Array(dustCount);

  for (let i = 0; i < dustCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * ROOM_W * 0.95;
    positions[i * 3 + 1] = Math.random() * ROOM_H;
    positions[i * 3 + 2] = (Math.random() - 0.5) * ROOM_D * 0.95;
    velocities[i]        = 0.00025 + Math.random() * 0.00045;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xb7a98b, size: 0.009,
      transparent: true, opacity: 0.18, depthWrite: false
    })
  );
  points.userData = { count: dustCount, velocities };
  scene.add(points);
  return points;
}

// ── Held map ──────────────────────────────────────────────────────────────────
export function buildHeldMap() {
  // Remove old group if present
  if (S.heldGroup) {
    camera.remove(S.heldGroup);
    scene.remove(camera);
  }

  S.heldGroup = new THREE.Group();

  const mapMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.235, 0.29),
    new THREE.MeshBasicMaterial({ map: makeMapTexture(), side: THREE.DoubleSide })
  );
  mapMesh.position.set(0.42, -0.405, -0.79);
  mapMesh.rotation.set(-0.16, -0.50, 0.08);
  S.heldGroup.add(mapMesh);

  const armSkin   = new THREE.MeshBasicMaterial({ color: 0x8a6440 });
  const armSleeve = new THREE.MeshBasicMaterial({ color: 0x26242c });

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), armSkin);
  hand.position.set(0.49, -0.49, -0.70);
  hand.rotation.set(0.1, -0.2, 0.25);
  S.heldGroup.add(hand);

  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.34), armSleeve);
  sleeve.position.set(0.56, -0.62, -0.53);
  sleeve.rotation.set(0.1, -0.2, 0.25);
  S.heldGroup.add(sleeve);

  camera.add(S.heldGroup);
  scene.add(camera);
}

// ── Photo helpers ─────────────────────────────────────────────────────────────
export function createPhoto(data, position, rotationY, scale = 1, lightMul = 1) {
  const baseW = data.frame?.w || PHOTO_W;
  const baseH = data.frame?.h || PHOTO_H;
  const pw = baseW * scale;
  const ph = baseH * scale;
  const group = new THREE.Group();

  const frameW = 0.0016 * scale, frameDepth = 0.010;
  const borderMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a0b,
    roughness: 0.7,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92
  });

  [1, -1].forEach((sy) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(pw + frameW * 2, frameW, frameDepth), borderMat);
    rail.position.set(0, sy * (ph / 2 + frameW / 2), 0);
    group.add(rail);
  });

  [1, -1].forEach((sx) => {
    const stile = new THREE.Mesh(new THREE.BoxGeometry(frameW, ph, frameDepth), borderMat);
    stile.position.set(sx * (pw / 2 + frameW / 2), 0, 0);
    group.add(stile);
  });

  const backing = new THREE.Mesh(
    new THREE.PlaneGeometry(pw, ph),
    new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.95 })
  );
  backing.position.z = -frameDepth / 2 + 0.001;
  group.add(backing);

  const texture = loadPhotoTexture(data);
  const photoMat = new THREE.MeshStandardMaterial({
    map: texture, roughness: 0.85,
    emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.24
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMat);
  photo.position.z = frameDepth / 2 + 0.001;
  group.add(photo);

  const lightMat = new THREE.MeshBasicMaterial({
    color: 0xc9d8e8,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const softWallWash = new THREE.Mesh(new THREE.PlaneGeometry(pw * 1.38, ph * 1.18), lightMat);
  softWallWash.position.z = 0.006;
  group.add(softWallWash);

  const barMat = new THREE.MeshBasicMaterial({
    color: 0xdce8f5,
    transparent: true,
    opacity: 0.30,
    depthWrite: false
  });
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.92, 0.035 * scale), barMat);
  bar.position.set(0, ph / 2 + 0.105 * scale, 0.018);
  group.add(bar);

  group.position.copy(position);
  group.rotation.y = rotationY;

  createPlacard(data, group, ph);
  group.userData = { data, borderMat, photoMat, lightMat, barMat };
  scene.add(group);
  photoMeshes.push(group);

  // Per-photo SpotLight: a narrow warm light pool framing this single work,
  // not the whole wall. Position the light a short distance in front of the
  // frame, pointed slightly downward at the photo center.
  const wallNormal = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
  const lightPos = position.clone().add(wallNormal.clone().multiplyScalar(0.85));
  lightPos.y = position.y + 1.05;
  const spotIntensity = 5.0 * lightMul;
  const photoSpot = new THREE.SpotLight(0xe6eefc, spotIntensity, 4.8, Math.PI / 8.5, 0.55, 1.6);
  photoSpot.position.copy(lightPos);
  const photoTarget = new THREE.Object3D();
  photoTarget.position.copy(position);
  scene.add(photoTarget);
  photoSpot.target = photoTarget;
  scene.add(photoSpot);
  sceneLights.push({ light: photoSpot, onIntensity: spotIntensity });
}

function createPlacard(data, group, photoH) {
  const PW = 0.44, PH = 0.12;
  const mat = new THREE.MeshBasicMaterial({ map: makePlacardTexture(data), transparent: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
  mesh.position.set(0, -(photoH / 2) - 0.20 - PH / 2, 0.012);
  group.add(mesh);
}

function loadPhotoTexture(data) {
  if (!data.image) return makePhotoTexture(data.tint);

  const fallback = makePhotoTexture(data.tint);
  const texture = textureLoader.load(
    encodeURI(data.image),
    (loadedTexture) => {
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      fitTextureToFrame(loadedTexture, data.frame);
      loadedTexture.needsUpdate = true;
    },
    undefined,
    () => { console.warn(`Could not load photo texture: ${data.image}`); }
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.offset.copy(fallback.offset);
  texture.repeat.copy(fallback.repeat);
  return texture;
}

function fitTextureToFrame(texture, frame = null) {
  const image = texture.image;
  if (!image || !image.width || !image.height) return;
  const frameAspect = frame?.w && frame?.h ? frame.w / frame.h : PHOTO_W / PHOTO_H;
  const imageAspect = image.width / image.height;
  texture.offset.set(0, 0);
  texture.repeat.set(1, 1);
  if (imageAspect > frameAspect) {
    texture.repeat.x = frameAspect / imageAspect;
    texture.offset.x = (1 - texture.repeat.x) / 2;
  } else {
    texture.repeat.y = imageAspect / frameAspect;
    texture.offset.y = (1 - texture.repeat.y) / 2;
  }
}

// ── Texture generators ────────────────────────────────────────────────────────
function makePhotoTexture(tint) {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 384;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = `rgb(${(tint.r * 30) | 0},${(tint.g * 30) | 0},${(tint.b * 30) | 0})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createRadialGradient(256, 240, 8, 256, 240, 300);
  grad.addColorStop(0,    `rgba(${(tint.r * 255) | 0},${(tint.g * 255) | 0},${(tint.b * 255) | 0},0.65)`);
  grad.addColorStop(0.35, `rgba(${(tint.r * 180) | 0},${(tint.g * 180) | 0},${(tint.b * 180) | 0},0.25)`);
  grad.addColorStop(1,    "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imgData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    pixels[i]     = clampColor(pixels[i]     + noise);
    pixels[i + 1] = clampColor(pixels[i + 1] + noise);
    pixels[i + 2] = clampColor(pixels[i + 2] + noise);
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePlacardTexture(data) {
  const W = 560, H = 180;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#111313";
  ctx.fillRect(0, 0, W, H);

  const imgData = ctx.getImageData(0, 0, W, H);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 5;
    px[i]     = clampColor(px[i]     + n);
    px[i + 1] = clampColor(px[i + 1] + n);
    px[i + 2] = clampColor(px[i + 2] + n * 0.85);
  }
  ctx.putImageData(imgData, 0, 0);

  ctx.strokeStyle = "rgba(218,226,226,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(28, 102); ctx.lineTo(W - 28, 102); ctx.stroke();

  const pad = 30;
  ctx.fillStyle = "#f0eadc";
  ctx.textAlign = "left";
  ctx.font = "500 25px 'IBM Plex Mono', monospace";
  fitCanvasText(ctx, data.title, pad, 66, W - pad * 2, 30);

  ctx.fillStyle = "#b9c6c9";
  ctx.font = "300 18px 'IBM Plex Mono', monospace";
  ctx.fillText(data.film, pad, 132);
  ctx.fillStyle = "#b5a889";
  fitCanvasText(ctx, data.note, pad, 158, W - pad * 2, 18);

  return new THREE.CanvasTexture(canvas);
}

function makeMuseumPanelTexture({ kicker, title, subtitle, body }) {
  const W = 900, H = 380;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#101212";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(218,226,226,0.22)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 34, W - 72, H - 68);
  ctx.strokeStyle = "rgba(202,190,152,0.20)";
  ctx.beginPath(); ctx.moveTo(72, 238); ctx.lineTo(W - 72, 238); ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#b8a77d";
  ctx.font = "500 24px 'IBM Plex Mono', monospace";
  ctx.fillText(kicker, 72, 86);

  ctx.fillStyle = "#f0eadc";
  ctx.font = "500 56px 'IBM Plex Mono', monospace";
  ctx.fillText(title, 72, 160);

  ctx.fillStyle = "#b9c6c9";
  ctx.font = "300 28px 'IBM Plex Mono', monospace";
  fitCanvasText(ctx, subtitle, 72, 210, W - 144, 31);

  ctx.fillStyle = "#bbb4a5";
  ctx.font = "300 22px 'IBM Plex Mono', monospace";
  wrapCanvasText(ctx, body, 72, 286, W - 144, 34, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMuseumLabelTexture(title, subtitle) {
  const W = 620, H = 160;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "rgba(8,9,9,0.84)";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(216,205,180,0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(34, 112); ctx.lineTo(W - 34, 112); ctx.stroke();
  ctx.fillStyle = "#eee7d6";
  ctx.textAlign = "left";
  ctx.font = "500 31px 'IBM Plex Mono', monospace";
  fitCanvasText(ctx, title, 38, 66, W - 76, 31);
  ctx.fillStyle = "rgba(184,198,202,0.72)";
  ctx.font = "300 20px 'IBM Plex Mono', monospace";
  fitCanvasText(ctx, subtitle, 38, 138, W - 76, 22);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeFloorArrowTexture() {
  const W = 256, H = 160;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(201,184,138,0.55)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(50, 80);
  ctx.lineTo(170, 80);
  ctx.moveTo(138, 40);
  ctx.lineTo(178, 80);
  ctx.lineTo(138, 120);
  ctx.stroke();
  ctx.fillStyle = "rgba(201,184,138,0.48)";
  ctx.font = "500 24px 'IBM Plex Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("FLOW", 128, 144);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeMuseumInfoTexture() {
  const W = 600, H = 360;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#111313";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(215,205,174,0.32)";
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 24, W - 52, H - 48);

  ctx.fillStyle = "#ebe6d6";
  ctx.textAlign = "left";
  ctx.font = "500 28px 'IBM Plex Mono', monospace";
  ctx.fillText("RAIN ROOM", 54, 76);
  ctx.strokeStyle = "rgba(215,205,174,0.20)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(54, 104); ctx.lineTo(W - 54, 104); ctx.stroke();
  ctx.font = "300 20px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#b9b4a8";
  [
    "A   COASTAL LIGHT",
    "B   SYNTHETIC WEATHER",
    "C   REPEATED LIGHT",
    "NEXT GALLERY   NEKOLAND ROOM"
  ].forEach((line, i) => ctx.fillText(line, 54, 146 + i * 46));

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeSculpturePlaqueTexture() {
  const W = 680, H = 180;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#161818";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(218,226,226,0.24)";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 22, W - 48, H - 44);
  ctx.strokeStyle = "rgba(178,205,214,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(38, 36, W - 76, H - 72);
  ctx.textAlign = "center";
  ctx.fillStyle = "#eee9dc";
  ctx.font = "600 30px 'IBM Plex Mono', monospace";
  ctx.fillText("03. SYNTHETIC WAVE", W / 2, 58);
  ctx.fillStyle = "#b8c9cd";
  ctx.font = "300 21px 'IBM Plex Mono', monospace";
  ctx.fillText("white resin / light / remembered weather", W / 2, 98);
  ctx.fillStyle = "#c8baa1";
  ctx.font = "400 15px 'IBM Plex Mono', monospace";
  ctx.fillText("A wave that no longer belongs to the sea.", W / 2, 136);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeWaveHaloTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const core = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
  core.addColorStop(0, "rgba(226, 246, 255, 0.38)");
  core.addColorStop(0.36, "rgba(158, 206, 224, 0.22)");
  core.addColorStop(0.62, "rgba(183, 177, 218, 0.12)");
  core.addColorStop(1, "rgba(120, 145, 164, 0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(223, 248, 255, 0.16)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const x = 72 + Math.random() * 112;
    ctx.beginPath();
    ctx.moveTo(x, 42 + Math.random() * 20);
    ctx.lineTo(x + (Math.random() - 0.5) * 8, 198 + Math.random() * 18);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(188, 214, 226, 0.12)";
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, 58 + i * 26, 70 + i * 22, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePlasterTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const base = ctx.createLinearGradient(0, 0, size, size);
  base.addColorStop(0, "#d9d4c8");
  base.addColorStop(0.45, "#c9c2b5");
  base.addColorStop(1, "#ebe4d6");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  const image = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 18;
    image.data[i] = Math.max(0, Math.min(255, image.data[i] + grain));
    image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + grain));
    image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + grain * 0.75));
  }
  ctx.putImageData(image, 0, 0);

  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#82786a";
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 18 + Math.random() * 34, y - 10 + Math.random() * 20, x + 44 + Math.random() * 38, y + 2 + Math.random() * 18);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function fitCanvasText(ctx, text, x, y, maxWidth, baseSize) {
  const font = ctx.font;
  let size = baseSize;
  while (ctx.measureText(text).width > maxWidth && size > 14) {
    size -= 1;
    ctx.font = font.replace(/\d+px/, `${size}px`);
  }
  ctx.fillText(text, x, y);
  ctx.font = font;
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = text.split(" ");
  let line = "";
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lines * lineHeight);
      line = word;
      lines += 1;
      if (lines >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lineHeight);
}

function makeMapTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 640;
  const ctx = canvas.getContext("2d");
  const rainCard = S.currentRoom === "rain";

  ctx.fillStyle = rainCard ? "#151716" : "#d9cba8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(256, 320, 40, 256, 320, 420);
  glow.addColorStop(0, rainCard ? "rgba(232,242,242,0.16)" : "rgba(255,250,235,0.45)");
  glow.addColorStop(1, rainCard ? "rgba(8,10,10,0.88)" : "rgba(110,90,60,0.40)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = rainCard ? "#a99a74" : "#6a5836";
  ctx.lineWidth = 6;
  ctx.strokeRect(22, 22, 468, 596);

  ctx.fillStyle = rainCard ? "#ede9dc" : "#3a2f1a";
  ctx.textAlign = "center";
  ctx.font = rainCard ? "500 34px 'IBM Plex Mono', monospace" : "600 40px Georgia, serif";
  ctx.fillText("2ND EYES", 256, 92);
  ctx.font = rainCard ? "300 18px 'IBM Plex Mono', monospace" : "italic 22px Georgia, serif";
  ctx.fillText("Exhibition Map", 256, 126);

  const rooms     = ["Rain Room", "Nekoland Room", "Transit Room", "Object Room", "Darkroom"];
  const hereIndex = S.currentRoom === 'nekolan' ? 1 : 0;
  ctx.textAlign = "left";

  rooms.forEach((name, index) => {
    const y = 188 + index * 78;
    if (index === hereIndex) {
      ctx.fillStyle = rainCard ? "rgba(184,216,228,0.16)" : "rgba(180,120,40,0.28)";
      ctx.fillRect(66, y, 380, 54);
    }
    ctx.strokeStyle = rainCard ? "#7f765f" : "#6a5836";
    ctx.lineWidth = 3;
    ctx.strokeRect(66, y, 380, 54);
    ctx.fillStyle = rainCard ? "#ede9dc" : "#3a2f1a";
    ctx.font = rainCard ? "400 22px 'IBM Plex Mono', monospace" : "500 26px Georgia, serif";
    ctx.fillText(name, 90, y + 35);
    if (index === hereIndex) {
      ctx.fillStyle = rainCard ? "#b8d8e4" : "#9a3b1a";
      ctx.font = rainCard ? "300 14px 'IBM Plex Mono', monospace" : "italic 18px Georgia, serif";
      ctx.fillText("you are here", 300, y + 35);
    }
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeWallNormalMap() {
  const S2 = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S2; canvas.height = S2;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(S2, S2);
  const px = img.data;

  for (let y = 0; y < S2; y++) {
    for (let x = 0; x < S2; x++) {
      const i = (y * S2 + x) * 4;
      let nx = 128 + (Math.random() - 0.5) * 18;
      let ny = 128 + (Math.random() - 0.5) * 18;
      const band = Math.sin(y * 0.055) * 10 + Math.sin(y * 0.012 + x * 0.003) * 6;
      ny += band;
      px[i]     = Math.max(0, Math.min(255, Math.round(nx)));
      px[i + 1] = Math.max(0, Math.min(255, Math.round(ny)));
      px[i + 2] = 255;
      px[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

function makeWallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#3f3b35";
  ctx.fillRect(0, 0, 512, 512);

  for (let pass = 0; pass < 60; pass++) {
    const y = Math.random() * 512;
    const alpha = Math.random() * 0.045;
    const lighter = Math.random() > 0.5;
    ctx.strokeStyle = lighter ? `rgba(82,76,66,${alpha})` : `rgba(22,20,18,${alpha})`;
    ctx.lineWidth = Math.random() * 2.5 + 0.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }

  const imgData = ctx.getImageData(0, 0, 512, 512);
  const pixels = imgData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    pixels[i]     = clampColor(pixels[i]     + n);
    pixels[i + 1] = clampColor(pixels[i + 1] + n * 0.9);
    pixels[i + 2] = clampColor(pixels[i + 2] + n * 0.75);
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 3);
  return texture;
}

function makeFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#342f29";
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "rgba(12,10,9,0.50)";
  ctx.lineWidth = 1.2;
  for (let x = 0; x < 512; x += 128) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }
  for (let y = 0; y < 512; y += 128) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
  }

  for (let pass = 0; pass < 30; pass++) {
    const x = Math.random() * 512;
    const alpha = Math.random() * 0.04;
    ctx.strokeStyle = `rgba(74,66,54,${alpha})`;
    ctx.lineWidth = Math.random() * 4 + 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 30, 512);
    ctx.stroke();
  }

  const imgData = ctx.getImageData(0, 0, 512, 512);
  const pixels = imgData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    pixels[i]     = clampColor(pixels[i]     + n);
    pixels[i + 1] = clampColor(pixels[i + 1] + n * 0.9);
    pixels[i + 2] = clampColor(pixels[i + 2] + n * 0.75);
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 10);
  return texture;
}
