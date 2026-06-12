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
  const floorTex = makeFloorTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0x766d60, roughness: 0.54, metalness: 0.08 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ color: 0x22201c, roughness: 0.9 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_H;
  scene.add(ceiling);

  const wallTex  = makeWallTexture();
  const wallNorm = makeWallNormalMap();
  const wallMat  = new THREE.MeshStandardMaterial({
    map: wallTex,
    normalMap: wallNorm,
    normalScale: new THREE.Vector2(0.22, 0.22),
    color: 0x7c776f,
    roughness: 0.92,
    metalness: 0.02
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
  const revealMat = new THREE.MeshBasicMaterial({ color: 0x080706, transparent: true, opacity: 0.72 });
  const warmEdgeMat = new THREE.MeshBasicMaterial({ color: 0xb7a482, transparent: true, opacity: 0.12 });
  const pierMat = new THREE.MeshStandardMaterial({ color: 0x25231f, roughness: 0.88, metalness: 0.04 });
  const ceilingTrimMat = new THREE.MeshStandardMaterial({ color: 0x11100e, roughness: 0.68, metalness: 0.12 });

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
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 0.48, metalness: 0.35 });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xfff3dc, transparent: true, opacity: 0.78, depthWrite: false });

  [-4.8, 0, 4.8].forEach((x) => {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, ROOM_D - 2.6), trackMat);
    track.position.set(x, ROOM_H - 0.11, -0.35);
    scene.add(track);
  });

  const trackHeads = [
    { x: -4.8, z: -8.8, tx: -4.1, tz: -ROOM_D / 2 + 0.16, int: 6.4, color: 0xffe1ae },
    { x:  0.0, z: -8.9, tx:  0.0, tz: -ROOM_D / 2 + 0.16, int: 5.9, color: 0xfff4df },
    { x:  4.8, z: -8.8, tx:  2.6, tz: -ROOM_D / 2 + 0.16, int: 6.4, color: 0xffe1ae },
    { x: -4.8, z: -4.7, tx: -ROOM_W / 2 + 0.18, tz: -5.6, int: 4.9, color: 0xffe4b8 },
    { x: -4.8, z: -0.4, tx: -ROOM_W / 2 + 0.18, tz: -0.8, int: 4.6, color: 0xfff2dc },
    { x: -4.8, z:  3.0, tx: -ROOM_W / 2 + 0.18, tz:  1.2, int: 4.2, color: 0xffe2aa },
    { x:  4.8, z: -4.7, tx:  ROOM_W / 2 - 0.18, tz: -5.6, int: 4.9, color: 0xffe4b8 },
    { x:  4.8, z: -0.4, tx:  ROOM_W / 2 - 0.18, tz: -0.8, int: 4.6, color: 0xfff2dc },
    { x:  4.8, z:  3.0, tx:  ROOM_W / 2 - 0.18, tz:  1.2, int: 4.2, color: 0xffe2aa },
    { x:  0.0, z: -1.0, tx:  0.0, tz: -1.0, int: 7.0, color: 0xeaf7ff },
    { x:  0.0, z:  6.7, tx: -2.7, tz: ROOM_D / 2 - 0.22, int: 4.4, color: 0xffefd6 },
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

  const atriumWash = new THREE.RectAreaLight(0xf7f4ea, 4.15, 10.5, 14.2);
  atriumWash.position.set(0, ROOM_H - 0.45, -0.7);
  atriumWash.lookAt(0, 0.4, -0.7);
  scene.add(atriumWash);
  sceneLights.push({ light: atriumWash, onIntensity: 4.15 });

  const entryWash = new THREE.RectAreaLight(0xffefd6, 2.15, 7.5, 4.0);
  entryWash.position.set(0, ROOM_H - 0.55, ROOM_D / 2 - 3.7);
  entryWash.lookAt(0, 0.6, ROOM_D / 2 - 4.0);
  scene.add(entryWash);
  sceneLights.push({ light: entryWash, onIntensity: 2.15 });

  [
    { x: 0, y: 3.0, z: -ROOM_D / 2 + 1.0, i: 1.7, d: 12.5, color: 0xfff3de },
    { x: -ROOM_W / 2 + 0.45, y: 2.6, z: -1.0, i: 1.18, d: 10.5, color: 0xffe2aa },
    { x: ROOM_W / 2 - 0.45, y: 2.6, z: -1.0, i: 1.18, d: 10.5, color: 0xffe2aa },
    { x: 0, y: 2.4, z: 1.8, i: 1.35, d: 10, color: 0xf5f3ea },
    { x: 0, y: 1.3, z: 6.3, i: 0.78, d: 8.5, color: 0xffedce }
  ].forEach(({ x, y, z, i, d, color }) => {
    const wash = new THREE.PointLight(color, i, d, 1.85);
    wash.position.set(x, y, z);
    scene.add(wash);
    sceneLights.push({ light: wash, onIntensity: i });
  });
}

// ── Photos ────────────────────────────────────────────────────────────────────
export function buildPhotos() {
  // Curated coastal photography walls: generous spacing and portrait-scale frames.
  // The back-right transition stays open so the Nekoland doorway is never covered.
  createPhoto(photos[0], new THREE.Vector3(-5.55, 2.42, -ROOM_D / 2 + 0.06), 0, 0.86);
  createPhoto(photos[1], new THREE.Vector3(-2.05, 2.42, -ROOM_D / 2 + 0.06), 0, 0.86);
  createPhoto(photos[2], new THREE.Vector3(1.45, 2.42, -ROOM_D / 2 + 0.06), 0, 0.86);

  createPhoto(photos[3], new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.38, -6.55), Math.PI / 2, 0.82);
  createPhoto(photos[4], new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.38, -3.05), Math.PI / 2, 0.82);
  createPhoto(photos[5], new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.38, 0.45), Math.PI / 2, 0.82);
  createPhoto(photos[6], new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.34, 3.95), Math.PI / 2, 0.78);

  createPhoto(photos[7], new THREE.Vector3(ROOM_W / 2 - 0.06, 2.38, -6.65), -Math.PI / 2, 0.82);
  createPhoto(photos[8], new THREE.Vector3(ROOM_W / 2 - 0.06, 2.38, -3.0), -Math.PI / 2, 0.82);
  createPhoto(photos[9], new THREE.Vector3(ROOM_W / 2 - 0.06, 2.34, 0.65), -Math.PI / 2, 0.78);
}

// ── Floor glows ───────────────────────────────────────────────────────────────
export function buildFloorGlows() {
  const glowPositions = [
    { x: 0, z: -8.8, sx: 6.2, sz: 1.35, opacity: 0.095 },
    { x: 0, z: -1.0, sx: 4.8, sz: 3.6, opacity: 0.105 },
    { x: 0, z: 3.1, sx: 3.2, sz: 1.35, opacity: 0.06 },
    { x: 0, z: 7.5, sx: 4.2, sz: 1.55, opacity: 0.07 },
    { x: -6.3, z: -4.2, sx: 1.55, sz: 2.25, opacity: 0.052 },
    { x: -6.3, z: 2.5, sx: 1.55, sz: 2.15, opacity: 0.048 },
    { x: 6.3, z: -4.0, sx: 1.55, sz: 2.25, opacity: 0.052 },
    { x: 6.3, z: 2.6, sx: 1.55, sz: 2.15, opacity: 0.048 }
  ];

  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0,    "rgba(255,220,170,0.16)");
  grad.addColorStop(0.48, "rgba(255,205,145,0.055)");
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

// ── Doorway (back-right, leads to next room) ──────────────────────────────────
export function buildDoorway() {
  const doorX = ROOM_W / 2 - 2.25;
  const doorZ = -ROOM_D / 2 + 0.05;

  S.doorway = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 2.34),
    new THREE.MeshBasicMaterial({ color: 0x0b0c0d })
  );
  S.doorway.position.set(doorX, 1.17, doorZ);
  scene.add(S.doorway);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x181715, roughness: 0.62, metalness: 0.12 });
  const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.10, 2.56, 0.12), frameMat);
  jambL.position.set(doorX - 0.68, 1.28, doorZ + 0.02);
  scene.add(jambL);
  const jambR = jambL.clone();
  jambR.position.x = doorX + 0.68;
  scene.add(jambR);
  const header = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.10, 0.12), frameMat);
  header.position.set(doorX, 2.58, doorZ + 0.02);
  scene.add(header);

  S.doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.62, 2.82),
    new THREE.MeshBasicMaterial({
      color: 0xc7a66d, transparent: true, opacity: 0.10, depthWrite: false
    })
  );
  S.doorGlow.position.set(doorX, 1.36, doorZ - 0.01);
  scene.add(S.doorGlow);

  S.doorSpot = new THREE.SpotLight(0xffcf9a, 2.6, 7.5, Math.PI / 6.8, 0.74, 1.28);
  S.doorSpot.position.set(doorX, 3.2, doorZ + 1.85);

  const doorTarget = new THREE.Object3D();
  doorTarget.position.set(doorX, 1.17, doorZ);
  scene.add(doorTarget);
  S.doorSpot.target = doorTarget;
  scene.add(S.doorSpot);

  const threshold = new THREE.Mesh(
    new THREE.PlaneGeometry(1.75, 0.82),
    new THREE.MeshBasicMaterial({ color: 0xffd0a0, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  threshold.rotation.x = -Math.PI / 2;
  threshold.position.set(doorX, 0.014, doorZ + 0.66);
  scene.add(threshold);

  S.doorObj = { position: S.doorway.position, isDoor: true };
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

    ctx.strokeStyle = "rgba(210,190,150,0.35)";
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(256, 256, 222, 0, Math.PI * 2); ctx.stroke();

    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(256, 256, 195, 0, Math.PI * 2); ctx.stroke();

    ctx.fillStyle = "rgba(210,185,140,0.28)";
    ctx.font = "500 36px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(innerText, 256, 248);

    ctx.font = "300 22px Georgia, serif";
    ctx.fillStyle = "rgba(200,175,130,0.22)";
    ctx.fillText(subText, 256, 282);

    return new THREE.CanvasTexture(canvas);
  }

  const entranceMat = new THREE.MeshBasicMaterial({
    map: makeCircleDecal("2ND EYES", "Rain Room"),
    transparent: true, opacity: 0.34, depthWrite: false
  });
  const entrance = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), entranceMat);
  entrance.rotation.x = -Math.PI / 2;
  entrance.position.set(0, 0.005, ROOM_D / 2 - 3.0);
  scene.add(entrance);

  const viewMat = new THREE.MeshBasicMaterial({
    map: makeCircleDecal("", ""),
    transparent: true, opacity: 0.22, depthWrite: false
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
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xd7d7d0,
    map: plasterTex,
    bumpMap: plasterTex,
    bumpScale: 0.018,
    roughness: 0.74,
    metalness: 0.02,
    emissive: 0x141719,
    emissiveIntensity: 0.01
  });
  const shadowStoneMat = new THREE.MeshStandardMaterial({ color: 0x9fa7a7, roughness: 0.80, metalness: 0.02 });
  const plinthMat = new THREE.MeshStandardMaterial({ color: 0xcfcfc7, roughness: 0.76, metalness: 0.015 });
  const plinthEdgeMat = new THREE.MeshStandardMaterial({ color: 0xaab2b1, roughness: 0.78, metalness: 0.025 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.54, metalness: 0.32 });
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x7a6541, roughness: 0.58, metalness: 0.18 });
  const cx = 0;
  const cz = -0.9;

  // Central sculpture court: "Still Rain", a contemporary rain and light installation.
  const floorRing = new THREE.Mesh(
    new THREE.CircleGeometry(2.48, 96),
    new THREE.MeshBasicMaterial({ color: 0x9fb8c8, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  floorRing.rotation.x = -Math.PI / 2;
  floorRing.position.set(cx, 0.018, cz);
  scene.add(floorRing);

  [1.25, 1.82, 2.34].forEach((radius, i) => {
    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(radius, radius + 0.018, 96),
      new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xdcefff : i === 1 ? 0xa9c3d4 : 0xc3bce4,
        transparent: true,
        opacity: 0.14 - i * 0.03,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    ripple.rotation.x = -Math.PI / 2;
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
    new THREE.CircleGeometry(1.08, 64),
    new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, opacity: 0.22, depthWrite: false })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.set(cx, 0.024, cz);
  scene.add(contactShadow);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.06, 1.16, 0.16, 80), plinthEdgeMat);
  base.position.set(cx, 0.08, cz);
  scene.add(base);

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 1.0, 0.82, 80), plinthMat);
  plinth.position.set(cx, 0.55, cz);
  scene.add(plinth);

  const topLip = new THREE.Mesh(new THREE.CylinderGeometry(0.96, 0.90, 0.08, 80), plinthEdgeMat);
  topLip.position.set(cx, 0.99, cz);
  scene.add(topLip);

  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.82, 0.22),
    new THREE.MeshBasicMaterial({ map: makeSculpturePlaqueTexture(), transparent: false })
  );
  plaque.position.set(cx, 0.58, cz + 0.603);
  plaque.rotation.x = -0.08;
  scene.add(plaque);

  const installation = new THREE.Group();
  installation.position.set(cx, 1.02, cz);

  const frostedMat = new THREE.MeshPhysicalMaterial({
    color: 0xe5eef2,
    roughness: 0.34,
    metalness: 0.02,
    transmission: 0.46,
    transparent: true,
    opacity: 0.56,
    thickness: 0.16,
    ior: 1.22,
    emissive: 0x7fb7d0,
    emissiveIntensity: 0.045
  });
  const lensEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xaec4cf,
    roughness: 0.42,
    metalness: 0.16,
    emissive: 0x6d9db8,
    emissiveIntensity: 0.055
  });
  stillRainAnimation.glowMaterials.push(
    { mat: frostedMat, base: frostedMat.emissiveIntensity, range: 0.014, phase: 0.6 },
    { mat: lensEdgeMat, base: lensEdgeMat.emissiveIntensity, range: 0.018, phase: 1.4 }
  );
  const coolRainMat = new THREE.MeshBasicMaterial({
    color: 0xbff7ff,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const whiteRainMat = new THREE.MeshBasicMaterial({
    color: 0xf2fbff,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const rearLens = new THREE.Mesh(new THREE.CircleGeometry(0.68, 96), frostedMat);
  rearLens.scale.set(0.76, 1.48, 1);
  rearLens.position.set(0, 1.42, -0.014);
  installation.add(rearLens);

  const frontLens = new THREE.Mesh(new THREE.CircleGeometry(0.58, 96), frostedMat);
  frontLens.scale.set(0.72, 1.42, 1);
  frontLens.position.set(0, 1.42, 0.014);
  installation.add(frontLens);

  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.025, 14, 112), lensEdgeMat);
  outerRing.scale.set(0.76, 1.48, 1);
  outerRing.position.set(0, 1.42, 0.035);
  installation.add(outerRing);

  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.01, 10, 96), lensEdgeMat);
  innerRing.scale.set(0.74, 1.43, 1);
  innerRing.position.set(0, 1.42, 0.045);
  installation.add(innerRing);

  const mistCore = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 96),
    new THREE.MeshBasicMaterial({
      map: makeStillRainCoreTexture(),
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mistCore.scale.set(0.68, 1.32, 1);
  mistCore.position.set(0, 1.42, 0.052);
  installation.add(mistCore);
  stillRainAnimation.lensRipples.push({
    mesh: mistCore,
    baseOpacity: mistCore.material.opacity,
    baseScale: mistCore.scale.clone(),
    phase: 2.6
  });

  [-0.48, 0.48].forEach((x) => {
    const support = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 2.46, 14), lensEdgeMat);
    support.position.set(x, 1.26, -0.035);
    installation.add(support);
  });

  for (let i = 0; i < 17; i++) {
    const x = -0.39 + i * 0.049;
    const height = 1.46 + (i % 3) * 0.16;
    const lineMat = (i % 4 === 0 ? whiteRainMat : coolRainMat).clone();
    lineMat.opacity = i % 4 === 0 ? 0.40 : 0.50 + (i % 3) * 0.035;
    const rain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0045, 0.0045, height, 8),
      lineMat
    );
    rain.position.set(x, 1.38 + (i % 2) * 0.04, 0.065);
    installation.add(rain);
    stillRainAnimation.rainLines.push({
      mesh: rain,
      baseY: rain.position.y,
      baseOpacity: lineMat.opacity,
      phase: i * 0.47
    });
  }

  [0.34, 0.52, 0.70].forEach((r, i) => {
    const lensRipple = new THREE.Mesh(
      new THREE.RingGeometry(r, r + 0.007, 96),
      new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xf2fbff : i === 1 ? 0xaadff0 : 0xc6bdeb,
        transparent: true,
        opacity: 0.16 - i * 0.035,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    lensRipple.scale.set(0.76, 1.48, 1);
    lensRipple.position.set(0, 1.42, 0.074 + i * 0.002);
    installation.add(lensRipple);
    stillRainAnimation.lensRipples.push({
      mesh: lensRipple,
      baseOpacity: lensRipple.material.opacity,
      baseScale: lensRipple.scale.clone(),
      phase: i * 1.2
    });
  });

  const stoneCap = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.64, 0.12, 72), stoneMat);
  stoneCap.position.set(0, 0.08, 0);
  installation.add(stoneCap);

  scene.add(installation);

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

  const sculptureSpot = new THREE.SpotLight(0xdcefff, 5.35, 10.5, Math.PI / 10.8, 0.76, 1.25);
  sculptureSpot.position.set(cx - 0.28, ROOM_H - 0.22, cz + 0.18);
  const target = new THREE.Object3D();
  target.position.set(cx, 2.12, cz);
  scene.add(target);
  sculptureSpot.target = target;
  scene.add(sculptureSpot);
  sceneLights.push({ light: sculptureSpot, onIntensity: 5.35 });

  const fill = new THREE.PointLight(0x9edcff, 0.34, 4.8, 1.8);
  fill.position.set(cx + 1.85, 1.55, cz + 1.1);
  scene.add(fill);
  sceneLights.push({ light: fill, onIntensity: 0.34 });

  const sideFill = new THREE.PointLight(0xcfc2ff, 0.16, 4.2, 1.9);
  sideFill.position.set(cx - 1.6, 1.9, cz - 0.8);
  scene.add(sideFill);
  sceneLights.push({ light: sideFill, onIntensity: 0.16 });
}

export function updateStillRainInstallation(time) {
  if (!stillRainAnimation.rainLines.length) return;
  const t = time * 0.001;

  stillRainAnimation.rainLines.forEach(({ mesh, baseY, baseOpacity, phase }) => {
    const shimmer = 0.5 + 0.5 * Math.sin(t * 1.35 + phase);
    mesh.material.opacity = baseOpacity * (0.78 + shimmer * 0.30);
    mesh.position.y = baseY + Math.sin(t * 0.82 + phase) * 0.018;
    mesh.scale.y = 0.96 + shimmer * 0.05;
  });

  stillRainAnimation.floorRipples.forEach(({ mesh, baseOpacity, baseScale, phase }) => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.42 + phase);
    const scale = 1 + pulse * 0.026;
    mesh.material.opacity = baseOpacity * (0.70 + pulse * 0.36);
    mesh.scale.set(baseScale.x * scale, baseScale.y * scale, baseScale.z);
  });

  stillRainAnimation.lensRipples.forEach(({ mesh, baseOpacity, baseScale, phase }) => {
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.36 + phase);
    const scale = 1 + pulse * 0.018;
    mesh.material.opacity = baseOpacity * (0.68 + pulse * 0.34);
    mesh.scale.set(baseScale.x * scale, baseScale.y * scale, baseScale.z);
  });

  stillRainAnimation.glowMaterials.forEach(({ mat, base, range, phase }) => {
    mat.emissiveIntensity = base + range * (0.5 + 0.5 * Math.sin(t * 0.38 + phase));
  });
}

function buildMuseumEntryWall() {
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(4.45, 1.42),
    new THREE.MeshBasicMaterial({
      map: makeMuseumPanelTexture({
        kicker: "GALLERY GUIDE",
        title: "Rain Room",
        subtitle: "Coastal Light Studies",
        body: "A slow route around the sculpture court, coastal photographs, sea light, and reflected weather."
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
  addWallLabel("B. WATER SURFACE", "tide / reflection / white light", new THREE.Vector3(-ROOM_W / 2 + 0.055, 3.54, -1.3), Math.PI / 2);
  addWallLabel("C. BLUE ATMOSPHERE", "sea room / distance / weather", new THREE.Vector3(ROOM_W / 2 - 0.055, 3.54, -1.15), -Math.PI / 2);
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
    new THREE.PlaneGeometry(0.255, 0.315),
    new THREE.MeshBasicMaterial({ map: makeMapTexture(), side: THREE.DoubleSide })
  );
  mapMesh.position.set(0.405, -0.365, -0.76);
  mapMesh.rotation.set(-0.17, -0.48, 0.075);
  S.heldGroup.add(mapMesh);

  const armSkin   = new THREE.MeshBasicMaterial({ color: 0x8a6440 });
  const armSleeve = new THREE.MeshBasicMaterial({ color: 0x26242c });

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), armSkin);
  hand.position.set(0.47, -0.45, -0.69);
  hand.rotation.set(0.1, -0.2, 0.25);
  S.heldGroup.add(hand);

  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.34), armSleeve);
  sleeve.position.set(0.54, -0.58, -0.52);
  sleeve.rotation.set(0.1, -0.2, 0.25);
  S.heldGroup.add(sleeve);

  camera.add(S.heldGroup);
  scene.add(camera);
}

// ── Photo helpers ─────────────────────────────────────────────────────────────
export function createPhoto(data, position, rotationY, scale = 1) {
  const baseW = data.frame?.w || PHOTO_W;
  const baseH = data.frame?.h || PHOTO_H;
  const pw = baseW * scale;
  const ph = baseH * scale;
  const group = new THREE.Group();

  const frameW = 0.042 * scale, frameDepth = 0.032;
  const borderMat = new THREE.MeshStandardMaterial({
    color: 0x11100e,
    roughness: 0.66,
    metalness: 0.12,
    transparent: true,
    opacity: 0.62
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
    color: 0xffd8a4,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const softWallWash = new THREE.Mesh(new THREE.PlaneGeometry(pw * 1.38, ph * 1.18), lightMat);
  softWallWash.position.z = 0.006;
  group.add(softWallWash);

  const barMat = new THREE.MeshBasicMaterial({
    color: 0xfff1d1,
    transparent: true,
    opacity: 0.34,
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

  ctx.fillStyle = "#d7d0c2";
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

  ctx.strokeStyle = "rgba(48,43,36,0.34)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(28, 102); ctx.lineTo(W - 28, 102); ctx.stroke();

  const pad = 30;
  ctx.fillStyle = "#25231f";
  ctx.textAlign = "left";
  ctx.font = "500 30px Georgia, serif";
  fitCanvasText(ctx, data.title, pad, 66, W - pad * 2, 30);

  ctx.fillStyle = "#5a5247";
  ctx.font = "300 18px 'IBM Plex Mono', monospace";
  ctx.fillText(data.film, pad, 132);
  ctx.fillStyle = "#746b5e";
  fitCanvasText(ctx, data.note, pad, 158, W - pad * 2, 18);

  return new THREE.CanvasTexture(canvas);
}

function makeMuseumPanelTexture({ kicker, title, subtitle, body }) {
  const W = 900, H = 380;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#d5cec1";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(38,34,28,0.44)";
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 34, W - 72, H - 68);
  ctx.strokeStyle = "rgba(38,34,28,0.22)";
  ctx.beginPath(); ctx.moveTo(72, 238); ctx.lineTo(W - 72, 238); ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = "#766a58";
  ctx.font = "500 24px 'IBM Plex Mono', monospace";
  ctx.fillText(kicker, 72, 86);

  ctx.fillStyle = "#24211d";
  ctx.font = "600 66px Georgia, serif";
  ctx.fillText(title, 72, 160);

  ctx.fillStyle = "#51483d";
  ctx.font = "italic 31px Georgia, serif";
  fitCanvasText(ctx, subtitle, 72, 210, W - 144, 31);

  ctx.fillStyle = "#4b443b";
  ctx.font = "300 23px 'IBM Plex Mono', monospace";
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
  ctx.fillStyle = "rgba(18,17,15,0.72)";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(216,205,180,0.38)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(34, 112); ctx.lineTo(W - 34, 112); ctx.stroke();
  ctx.fillStyle = "#e1d6bf";
  ctx.textAlign = "left";
  ctx.font = "500 31px 'IBM Plex Mono', monospace";
  fitCanvasText(ctx, title, 38, 66, W - 76, 31);
  ctx.fillStyle = "rgba(232,225,210,0.66)";
  ctx.font = "300 22px Georgia, serif";
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
  ctx.fillStyle = "#d3ccbf";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(36,32,27,0.42)";
  ctx.lineWidth = 3;
  ctx.strokeRect(26, 24, W - 52, H - 48);

  ctx.fillStyle = "#24211d";
  ctx.textAlign = "left";
  ctx.font = "600 34px Georgia, serif";
  ctx.fillText("Gallery Guide", 54, 76);
  ctx.strokeStyle = "rgba(36,32,27,0.24)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(54, 104); ctx.lineTo(W - 54, 104); ctx.stroke();
  ctx.font = "300 21px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#534c42";
  [
    "A   COASTAL LIGHT",
    "B   WATER SURFACE",
    "C   BLUE ATMOSPHERE",
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
  ctx.fillStyle = "#d5d4cc";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(36,42,46,0.24)";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 22, W - 48, H - 44);
  ctx.strokeStyle = "rgba(70,92,102,0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(38, 36, W - 76, H - 72);
  ctx.textAlign = "center";
  ctx.fillStyle = "#2a231b";
  ctx.font = "600 32px Georgia, serif";
  ctx.fillText("STILL RAIN", W / 2, 70);
  ctx.fillStyle = "#5b5144";
  ctx.font = "300 21px 'IBM Plex Mono', monospace";
  ctx.fillText("frosted glass, light, rainfall", W / 2, 112);
  ctx.fillStyle = "#756956";
  ctx.font = "500 16px 'IBM Plex Mono', monospace";
  ctx.fillText("2ND EYES COLLECTION", W / 2, 144);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeStillRainCoreTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);

  const core = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size / 2);
  core.addColorStop(0, "rgba(228, 247, 255, 0.58)");
  core.addColorStop(0.32, "rgba(177, 224, 242, 0.34)");
  core.addColorStop(0.58, "rgba(191, 180, 231, 0.20)");
  core.addColorStop(1, "rgba(120, 145, 164, 0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = "rgba(223, 248, 255, 0.20)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 18; i++) {
    const x = 82 + Math.random() * 92;
    ctx.beginPath();
    ctx.moveTo(x, 34 + Math.random() * 16);
    ctx.lineTo(x + (Math.random() - 0.5) * 6, 206 + Math.random() * 18);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(198, 189, 236, 0.14)";
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(size / 2, size / 2, 42 + i * 24, 82 + i * 18, 0, 0, Math.PI * 2);
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

  ctx.fillStyle = "#d9cba8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(256, 320, 40, 256, 320, 420);
  glow.addColorStop(0, "rgba(255,250,235,0.45)");
  glow.addColorStop(1, "rgba(110,90,60,0.40)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "#6a5836";
  ctx.lineWidth = 6;
  ctx.strokeRect(22, 22, 468, 596);

  ctx.fillStyle = "#3a2f1a";
  ctx.textAlign = "center";
  ctx.font = "600 40px Georgia, serif";
  ctx.fillText("2ND EYES", 256, 92);
  ctx.font = "italic 22px Georgia, serif";
  ctx.fillText("Exhibition Map", 256, 126);

  const rooms     = ["Rain Room", "Nekoland Room", "Transit Room", "Object Room", "Darkroom"];
  const hereIndex = S.currentRoom === 'nekolan' ? 1 : 0;
  ctx.textAlign = "left";

  rooms.forEach((name, index) => {
    const y = 188 + index * 78;
    if (index === hereIndex) {
      ctx.fillStyle = "rgba(180,120,40,0.28)";
      ctx.fillRect(66, y, 380, 54);
    }
    ctx.strokeStyle = "#6a5836";
    ctx.lineWidth = 3;
    ctx.strokeRect(66, y, 380, 54);
    ctx.fillStyle = "#3a2f1a";
    ctx.font = "500 26px Georgia, serif";
    ctx.fillText(name, 90, y + 35);
    if (index === hereIndex) {
      ctx.fillStyle = "#9a3b1a";
      ctx.font = "italic 18px Georgia, serif";
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
