// ─── Rain Room — Build functions & textures ───────────────────────────────────

import * as THREE from "three";
import {
  scene, camera,
  ROOM_W, ROOM_D, ROOM_H, PHOTO_W, PHOTO_H, INTERACT_DIST,
  photos, photoMeshes, sceneLights, textureLoader,
  S
} from "./state.js";

// ── Utility ───────────────────────────────────────────────────────────────────
function clampColor(v) { return Math.max(0, Math.min(255, v)); }

// ── Room shell ────────────────────────────────────────────────────────────────
export function buildRoom() {
  const floorTex = makeFloorTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0xffffff, roughness: 0.42, metalness: 0.28 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ color: 0x0e0c0a, roughness: 0.95 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_H;
  scene.add(ceiling);

  const wallTex  = makeWallTexture();
  const wallNorm = makeWallNormalMap();
  const wallMat  = new THREE.MeshStandardMaterial({
    map: wallTex,
    normalMap: wallNorm,
    normalScale: new THREE.Vector2(0.45, 0.45),
    color: 0x1c1814,
    roughness: 0.88,
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
  const baseH = 0.055, baseD = 0.022;
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x0e0c0a, roughness: 0.85 });

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
}

// ── Ceiling lighting ──────────────────────────────────────────────────────────
export function buildCeilingLight() {
  const recessMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.5, metalness: 0.4 });
  const glowMat   = new THREE.MeshBasicMaterial({ color: 0xfff4d8, depthWrite: false });

  const spotZs = [-5.5, -2.8, 0, 2.8, 5.5];

  spotZs.forEach((z) => {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 20), recessMat);
    housing.position.set(0, ROOM_H - 0.025, z);
    scene.add(housing);

    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), glowMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, ROOM_H - 0.051, z);
    scene.add(disc);

    const onInt = 7.5;
    const spot  = new THREE.SpotLight(0xffd0a0, onInt, 11, Math.PI / 4.2, 0.52, 1.1);
    spot.position.set(0, ROOM_H - 0.06, z);
    const t = new THREE.Object3D();
    t.position.set(0, 0, z);
    scene.add(t);
    spot.target = t;
    scene.add(spot);
    sceneLights.push({ light: spot, onIntensity: onInt });
  });

  // Side wall-wash PointLights
  [-3.5, 0.5].forEach((z) => {
    [-1, 1].forEach((sx) => {
      const w = new THREE.PointLight(0xffe0b0, 1.3, 6.5, 1.8);
      w.position.set(sx * (ROOM_W / 2 - 0.35), 2.8, z);
      scene.add(w);
      sceneLights.push({ light: w, onIntensity: 1.3 });
    });
  });

  // Back-wall wash for photos
  const backWash = new THREE.PointLight(0xffd8a0, 2.2, 8, 1.6);
  backWash.position.set(0, ROOM_H - 0.5, -ROOM_D / 2 + 1.0);
  scene.add(backWash);
  sceneLights.push({ light: backWash, onIntensity: 2.2 });
}

// ── Photos ────────────────────────────────────────────────────────────────────
export function buildPhotos() {
  createPhoto(photos[0], new THREE.Vector3(0, 2.0, -ROOM_D / 2 + 0.06), 0, 1.5);
  createPhoto(photos[2], new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.05, -3.2), Math.PI / 2);
  createPhoto(photos[3], new THREE.Vector3(-ROOM_W / 2 + 0.06, 1.35, -0.2), Math.PI / 2);
  createPhoto(photos[1], new THREE.Vector3(ROOM_W / 2 - 0.06, 1.85, -3.0), -Math.PI / 2);
  createPhoto(photos[4], new THREE.Vector3(ROOM_W / 2 - 0.06, 1.45, -0.8), -Math.PI / 2);
  createPhoto(photos[5], new THREE.Vector3(-ROOM_W / 2 + 0.06, 1.75, 1.8), Math.PI / 2);
  createPhoto(photos[6], new THREE.Vector3(ROOM_W / 2 - 0.06, 1.65, 2.2), -Math.PI / 2, 0.85);
  createPhoto(photos[7], new THREE.Vector3(-2.2, 1.55, -ROOM_D / 2 + 0.06), 0, 0.9);
}

// ── Floor glows ───────────────────────────────────────────────────────────────
export function buildFloorGlows() {
  const glowPositions = [
    { x: 0,                   z: -ROOM_D / 2 + 0.06 },
    { x: -ROOM_W / 2 + 0.06, z: -3.2 },
    { x: -ROOM_W / 2 + 0.06, z: -0.2 },
    { x:  ROOM_W / 2 - 0.06, z: -3.0 },
    { x:  ROOM_W / 2 - 0.06, z: -0.8 },
    { x: -ROOM_W / 2 + 0.06, z:  1.8 },
    { x:  ROOM_W / 2 - 0.06, z:  2.2 },
    { x: -2.2,                z: -ROOM_D / 2 + 0.06 }
  ];

  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0,    "rgba(255,210,150,0.18)");
  grad.addColorStop(0.45, "rgba(255,190,100,0.07)");
  grad.addColorStop(1,    "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(canvas);

  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending
  });

  for (const p of glowPositions) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), glowMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, 0.005, p.z);
    scene.add(mesh);
  }
}

// ── Doorway (back-right, leads to next room) ──────────────────────────────────
export function buildDoorway() {
  const doorX = ROOM_W / 2 - 1.8;
  const doorZ = -ROOM_D / 2 + 0.05;

  S.doorway = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 2.1),
    new THREE.MeshBasicMaterial({ color: 0x1a130c })
  );
  S.doorway.position.set(doorX, 1.05, doorZ);
  scene.add(S.doorway);

  S.doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.6),
    new THREE.MeshBasicMaterial({
      color: 0x6a5028, transparent: true, opacity: 0.18, depthWrite: false
    })
  );
  S.doorGlow.position.set(doorX, 1.2, doorZ - 0.01);
  scene.add(S.doorGlow);

  S.doorSpot = new THREE.SpotLight(0xffb070, 2.4, 7, Math.PI / 4.5, 0.72, 1.25);
  S.doorSpot.position.set(doorX, 2.6, doorZ + 1.6);

  const doorTarget = new THREE.Object3D();
  doorTarget.position.set(doorX, 1.05, doorZ);
  scene.add(doorTarget);
  S.doorSpot.target = doorTarget;
  scene.add(S.doorSpot);

  S.doorObj = { position: S.doorway.position, isDoor: true };
}

// ── Bench ─────────────────────────────────────────────────────────────────────
export function buildBench() {
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.78, metalness: 0.0 });
  const legMat  = new THREE.MeshStandardMaterial({ color: 0x332010, roughness: 0.82, metalness: 0.0 });
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

  const benchSpot = new THREE.SpotLight(0xffd0a0, 2.2, 7, Math.PI / 5, 0.65, 1.2);
  benchSpot.position.set(0, ROOM_H - 0.2, BZ - 0.5);
  const bt = new THREE.Object3D();
  bt.position.set(0, 0.45, BZ);
  scene.add(bt);
  benchSpot.target = bt;
  scene.add(benchSpot);
  sceneLights.push({ light: benchSpot, onIntensity: 2.2 });
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
    transparent: true, opacity: 0.7, depthWrite: false
  });
  const entrance = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), entranceMat);
  entrance.rotation.x = -Math.PI / 2;
  entrance.position.set(0, 0.005, 5.0);
  scene.add(entrance);

  const viewMat = new THREE.MeshBasicMaterial({
    map: makeCircleDecal("", ""),
    transparent: true, opacity: 0.45, depthWrite: false
  });
  const viewSpot = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), viewMat);
  viewSpot.rotation.x = -Math.PI / 2;
  viewSpot.position.set(0, 0.005, -3.8);
  scene.add(viewSpot);
}

// ── Dust particles ────────────────────────────────────────────────────────────
export function buildDust() {
  const dustCount = 220;
  const geo = new THREE.BufferGeometry();
  const positions  = new Float32Array(dustCount * 3);
  const velocities = new Float32Array(dustCount);

  for (let i = 0; i < dustCount; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * ROOM_W * 0.95;
    positions[i * 3 + 1] = Math.random() * ROOM_H;
    positions[i * 3 + 2] = (Math.random() - 0.5) * ROOM_D * 0.95;
    velocities[i]        = 0.0006 + Math.random() * 0.001;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xc9b88a, size: 0.014,
      transparent: true, opacity: 0.5, depthWrite: false
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
    new THREE.PlaneGeometry(0.34, 0.42),
    new THREE.MeshBasicMaterial({ map: makeMapTexture(), side: THREE.DoubleSide })
  );
  mapMesh.position.set(0.3, -0.24, -0.62);
  mapMesh.rotation.set(-0.22, -0.38, 0.1);
  S.heldGroup.add(mapMesh);

  const armSkin   = new THREE.MeshBasicMaterial({ color: 0x8a6440 });
  const armSleeve = new THREE.MeshBasicMaterial({ color: 0x26242c });

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), armSkin);
  hand.position.set(0.4, -0.34, -0.55);
  hand.rotation.set(0.1, -0.2, 0.25);
  S.heldGroup.add(hand);

  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.34), armSleeve);
  sleeve.position.set(0.45, -0.46, -0.4);
  sleeve.rotation.set(0.1, -0.2, 0.25);
  S.heldGroup.add(sleeve);

  camera.add(S.heldGroup);
  scene.add(camera);
}

// ── Photo helpers ─────────────────────────────────────────────────────────────
export function createPhoto(data, position, rotationY, scale = 1) {
  const pw = PHOTO_W * scale;
  const ph = PHOTO_H * scale;
  const group = new THREE.Group();

  const frameW = 0.042 * scale, frameDepth = 0.032;
  const borderMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.72, metalness: 0.04 });

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
    new THREE.MeshStandardMaterial({ color: 0x060504, roughness: 0.95 })
  );
  backing.position.z = -frameDepth / 2 + 0.001;
  group.add(backing);

  const texture = loadPhotoTexture(data);
  const photoMat = new THREE.MeshStandardMaterial({
    map: texture, roughness: 0.85,
    emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.3
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMat);
  photo.position.z = frameDepth / 2 + 0.001;
  group.add(photo);

  group.position.copy(position);
  group.rotation.y = rotationY;

  const normal = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
  const spotDist = 9 + scale * 3;
  const onInt = 7.2 * (scale > 1 ? scale * 1.3 : 1);
  const spot = new THREE.SpotLight(0xffd6a0, onInt, spotDist, Math.PI / 5.2, 0.58, 1.05);
  spot.position.copy(position).add(normal.clone().multiplyScalar(1.6 * scale)).add(new THREE.Vector3(0, 0.6, 0));

  const target = new THREE.Object3D();
  target.position.copy(position);
  scene.add(target);
  spot.target = target;
  scene.add(spot);
  sceneLights.push({ light: spot, onIntensity: onInt });

  createPlacard(data, group, ph);
  group.userData = { data, borderMat, photoMat, spot };
  scene.add(group);
  photoMeshes.push(group);
}

function createPlacard(data, group, photoH) {
  const PW = 0.28, PH = 0.09;
  const mat = new THREE.MeshBasicMaterial({ map: makePlacardTexture(data), transparent: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);
  mesh.position.set(0, -(photoH / 2) - 0.30 - PH / 2, 0.012);
  group.add(mesh);
}

function loadPhotoTexture(data) {
  if (!data.image) return makePhotoTexture(data.tint);

  const fallback = makePhotoTexture(data.tint);
  const texture = textureLoader.load(
    encodeURI(data.image),
    (loadedTexture) => {
      loadedTexture.colorSpace = THREE.SRGBColorSpace;
      fitTextureToFrame(loadedTexture);
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

function fitTextureToFrame(texture) {
  const image = texture.image;
  if (!image || !image.width || !image.height) return;
  const frameAspect = PHOTO_W / PHOTO_H;
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

  ctx.fillStyle = "#e8e1d2";
  ctx.fillRect(0, 0, W, H);

  const imgData = ctx.getImageData(0, 0, W, H);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    px[i]     = clampColor(px[i]     + n);
    px[i + 1] = clampColor(px[i + 1] + n);
    px[i + 2] = clampColor(px[i + 2] + n * 0.85);
  }
  ctx.putImageData(imgData, 0, 0);

  ctx.strokeStyle = "#b8afa0";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(28, 20); ctx.lineTo(W - 28, 20); ctx.stroke();

  const pad = 30;
  ctx.fillStyle = "#3a2f1a";
  ctx.textAlign = "left";
  ctx.font = "500 38px Georgia, serif";
  ctx.fillText(data.title, pad, 70);

  ctx.fillStyle = "#6a6358";
  ctx.font = "300 24px 'IBM Plex Mono', monospace";
  ctx.fillText(data.film, pad, 108);
  ctx.fillText(data.note, pad, 140);

  return new THREE.CanvasTexture(canvas);
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

  ctx.fillStyle = "#1a1714";
  ctx.fillRect(0, 0, 512, 512);

  for (let pass = 0; pass < 60; pass++) {
    const y = Math.random() * 512;
    const alpha = Math.random() * 0.045;
    const lighter = Math.random() > 0.5;
    ctx.strokeStyle = lighter ? `rgba(40,34,26,${alpha})` : `rgba(12,10,8,${alpha})`;
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
  texture.repeat.set(3, 2);
  return texture;
}

function makeFloorTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#151311";
  ctx.fillRect(0, 0, 512, 512);

  ctx.strokeStyle = "rgba(8,7,6,0.55)";
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
    ctx.strokeStyle = `rgba(50,44,36,${alpha})`;
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
  texture.repeat.set(5, 7);
  return texture;
}
