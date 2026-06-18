// ─── Nekoland Room — Build functions & textures ───────────────────────────────

import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import {
  scene,
  NL_CX, NL_W, NL_D,
  nkSceneLights, nkInteractables, nkCustomers,
  S
} from "./state.js";

// ── Utility ───────────────────────────────────────────────────────────────────
function clampColor(v) { return Math.max(0, Math.min(255, v)); }

// ── Animated props (driven by updateNKCustomers each frame) ───────────────────
const nkCooks = [];      // { armA, armB, steams:[], mode, phase }
const nkMemoryLights = [];
const nkMemoryMarkers = [];
let nkLuckyCat = null;   // greeting maneki-neko that self-rotates at the entrance
let nkAnimClock = 0;
let nkFrameIndex = 0;

// Nekoland is visually dense, so keep the glow meshes but limit real-time lights.
// This preserves the ramen-shop mood while reducing the GPU cost that made the
// room feel heavy in browser.
const NK_PERF = {
  memoryParticles: 8,
  memoryParticleFrameStep: 2,
  enableMemoryPointLights: false,
  enableTablePointLights: false,
  enableTinyPendantPointLights: false,
  enableWallWashPointLights: false,
  enableLanternPointLights: false,
  enableStringBulbPointLights: false,
};

function addMemoryBeacon(x, z, options = {}) {
  // ── Memory points ──────────────────────────────────────────────────────────
  // A memory point is not just a floor decal: it gets a warm pool, a ring,
  // floating particles and, when requested, a small local light.
  const color = options.color || 0xff7a3d;
  const radius = options.radius || 0.56;
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: options.opacity || 0.12,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), mat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(x, 0.025, z);
  scene.add(glow);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.72, 0.012, 6, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, 0.042, z);
  scene.add(ring);

  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.18, radius * 0.28, 1.45, 18, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
  );
  pillar.position.set(x, 0.75, z);
  scene.add(pillar);

  const particleData = [];
  const particlePositions = new Float32Array(NK_PERF.memoryParticles * 3);
  const particleGeo = new THREE.BufferGeometry();
  const particleMat = new THREE.PointsMaterial({
    color: 0xffd7a0,
    size: 0.035,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  for (let i = 0; i < NK_PERF.memoryParticles; i++) {
    const angle = (i / NK_PERF.memoryParticles) * Math.PI * 2;
    const pRadius = radius * (0.24 + (i % 3) * 0.17);
    const baseY = 0.28 + (i % 4) * 0.18;
    particlePositions[i * 3] = x + Math.cos(angle) * pRadius;
    particlePositions[i * 3 + 1] = baseY;
    particlePositions[i * 3 + 2] = z + Math.sin(angle) * pRadius;
    particleData.push({ baseY, radius: pRadius, angle });
  }
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  let pointLight = null;
  if (options.light && NK_PERF.enableMemoryPointLights) {
    pointLight = new THREE.PointLight(color, options.light, 2.8, 1.7);
    pointLight.position.set(x, 0.75, z);
    scene.add(pointLight);
    nkSceneLights.push({ light: pointLight, onIntensity: options.light, nightMul: 1.2 });
  }

  nkMemoryMarkers.push({
    kind: 'beacon',
    glow,
    ring,
    pillar,
    particles: { mesh: particles, positions: particlePositions, data: particleData },
    pointLight,
    baseOpacity: options.opacity || 0.12,
    memoryOpacity: options.memoryOpacity || 0.32,
    phase: Math.random() * Math.PI * 2
  });
}

function addMemoryNote(text, position, rotationY, width = 1.35) {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = '700 38px IBM Plex Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff6a4a';
  ctx.shadowColor = '#ff3a2a';
  ctx.shadowBlur = 18;
  const lines = text.split('\n');
  lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, 92 + i * 54));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const note = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.4), mat);
  note.position.set(position.x, position.y, position.z);
  note.rotation.y = rotationY;
  scene.add(note);
  nkMemoryMarkers.push({
    kind: 'note',
    mesh: note,
    baseY: position.y,
    baseOpacity: 0,
    memoryOpacity: 0.86,
    phase: Math.random() * Math.PI * 2
  });
  return note;
}

// ── NK Entry Door (Rain Room left wall → Nekolan) ─────────────────────────────
// ── Nekoland Room (Three-Section Ramen Shop) ──────────────────────────────────
export function buildNekolandRoom() {
  const cx = NL_CX;

  // Section geometry
  const zA = { front: 14, back: 4,   h: 3.2 };
  const zB = { front:  4, back: -4,  h: 3.0 };
  const zC = { front: -4, back: -14, h: 3.8 };

  // ── FLOORS ────────────────────────────────────────────────────────────────────
  [
    [makeNKWoodFloor(),     zA, 0.62, 0.02, 0x7a5533],
    [makeNKTileFloor(),     zB, 0.78, 0.00, 0x7a6856],
    [makeNKWoodFloor(),     zC, 0.70, 0.00, 0x4f321f]
  ].forEach(([tex, sect, rough, metal, tint]) => {
    const len = sect.front - sect.back;
    const f = new THREE.Mesh(
      new THREE.PlaneGeometry(NL_W, len),
      new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: rough, metalness: metal })
    );
    f.rotation.x = -Math.PI / 2;
    f.position.set(cx, 0, (sect.front + sect.back) / 2);
    scene.add(f);
  });

  // ── CEILINGS ──────────────────────────────────────────────────────────────────
  [[zA, 0x2b1a12], [zB, 0x24140e]].forEach(([sect, col]) => {
    const c = new THREE.Mesh(
      new THREE.PlaneGeometry(NL_W, sect.front - sect.back),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.92 })
    );
    c.rotation.x = Math.PI / 2;
    c.position.set(cx, sect.h, (sect.front + sect.back) / 2);
    scene.add(c);
  });

  // Section C: corrugated iron strips
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x4b4038, roughness: 0.62, metalness: 0.18 });
  const stripD = 0.30, stripStep = 0.38;
  for (let z = zC.front - stripD / 2; z > zC.back + stripD / 2; z -= stripStep) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(NL_W + 0.6, 0.055, stripD), ironMat);
    strip.position.set(cx, zC.h - 0.028, z);
    scene.add(strip);
  }

  // ── WALLS ─────────────────────────────────────────────────────────────────────
  const woodMat  = new THREE.MeshStandardMaterial({ map: makeNKWoodWallTexture(), color: 0x5a3824, roughness: 0.92 });
  const tileMat  = new THREE.MeshStandardMaterial({ map: makeNKWhiteTileWall(), color: 0xc4b9a4, roughness: 0.82, metalness: 0.02 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: makeNKStoneTexture(), color: 0x7a6d5f, roughness: 0.96 });
  const hWoodMat = new THREE.MeshStandardMaterial({ map: makeNKHorizWoodWall(), color: 0x4a2c1d, roughness: 0.94 });

  // Front wall (entrance, z=12)
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(NL_W, zA.h),
    new THREE.MeshStandardMaterial({ map: makeNKHorizWoodWall(), color: 0x4a2c1d, roughness: 0.94 })
  );
  frontWall.rotation.y = Math.PI;
  frontWall.position.set(cx, zA.h / 2, zA.front);
  scene.add(frontWall);

  // Back wall (後院, z=-12)
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(NL_W, zC.h), stoneMat);
  backWall.position.set(cx, zC.h / 2, zC.back);
  scene.add(backWall);

  // Left + right walls per section
  [
    [woodMat,  woodMat,  zA],
    [tileMat,  woodMat,  zB],
    [stoneMat, hWoodMat, zC]
  ].forEach(([lMat, rMat, sect]) => {
    const len = sect.front - sect.back;
    const wL = new THREE.Mesh(new THREE.PlaneGeometry(len, sect.h), lMat);
    wL.rotation.y = Math.PI / 2;
    wL.position.set(cx - NL_W / 2, sect.h / 2, (sect.front + sect.back) / 2);
    scene.add(wL);
    const wR = new THREE.Mesh(new THREE.PlaneGeometry(len, sect.h), rMat);
    wR.rotation.y = -Math.PI / 2;
    wR.position.set(cx + NL_W / 2, sect.h / 2, (sect.front + sect.back) / 2);
    scene.add(wR);
  });

  // Baseboards (full room length)
  const bMat = new THREE.MeshStandardMaterial({ color: 0x120907, roughness: 0.94 });
  const bH = 0.06, bD = 0.022;
  [
    new THREE.BoxGeometry(NL_W, bH, bD),
    new THREE.BoxGeometry(NL_W, bH, bD),
    new THREE.BoxGeometry(bD, bH, NL_D),
    new THREE.BoxGeometry(bD, bH, NL_D),
  ].forEach((geo, i) => {
    const m = new THREE.Mesh(geo, bMat);
    m.position.set(
      i < 2 ? cx : i === 2 ? cx - NL_W / 2 + bD / 2 : cx + NL_W / 2 - bD / 2,
      bH / 2,
      i === 0 ? -NL_D / 2 + bD / 2 : i === 1 ? NL_D / 2 - bD / 2 : 0
    );
    scene.add(m);
  });

  buildNekolandTrim(cx, zA, zB, zC);

  // ── Entrance threshold ───────────────────────────────────────────────────────
  buildEntranceThreshold(cx, zA);

  // ── Overall ambience: keep it warm but with CONTRAST. The shop should read as
  //    "lights on, but with mood" — not a fluorescent convenience store. Soft
  //    ambient floor only; the real shape comes from the menu lightbox, the bar
  //    lattice strip and the red lanterns, while corners fall into shadow.
  //    `nightMul` = how much of the day intensity survives in NIGHT mode.
  const nkAmbient = new THREE.AmbientLight(0xffc48a, 0.24);
  scene.add(nkAmbient);
  nkSceneLights.push({ light: nkAmbient, onIntensity: 0.24, nightMul: 0.22 });

  const nkHemi = new THREE.HemisphereLight(0xffb55a, 0x180d08, 0.16);
  nkHemi.position.set(cx, 3.5, 0);
  scene.add(nkHemi);
  nkSceneLights.push({ light: nkHemi, onIntensity: 0.16, nightMul: 0.0 });

  // Faint overhead breath so the ceiling isn't pure black — deliberately weak so
  // the floor between light pools darkens. Off at night.
  [8.0, -5.6].forEach((z) => {
    const fill = new THREE.PointLight(0xffb55a, 0.08, 6.2, 1.9);
    fill.position.set(cx, 3.0, z);
    scene.add(fill);
    nkSceneLights.push({ light: fill, onIntensity: 0.08, nightMul: 0.0 });
  });

  // ── SECTION A LIGHTING: Wood lattice indirect ─────────────────────────────────
  const latMat  = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.88 });
  const latticeZ = 6.5;

  [-1.5, 1.5].forEach(lx => {
    const lat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 5.0), latMat);
    lat.position.set(cx + lx, zA.h - 0.04, latticeZ);
    scene.add(lat);
  });

  const eStrip = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.022, 4.5),
    new THREE.MeshStandardMaterial({ color: 0x7a3b22, emissive: 0xff8a42, emissiveIntensity: 0.26, roughness: 0.68 })
  );
  eStrip.position.set(cx, zA.h - 0.036, latticeZ);
  scene.add(eStrip);

  [0].forEach(dz => {
    const pl = new THREE.PointLight(0xff9a4a, 0.48, 4.0, 1.7);
    pl.position.set(cx, zA.h - 0.14, latticeZ + dz);
    scene.add(pl);
    nkSceneLights.push({ light: pl, onIntensity: 0.48, nightMul: 0.38 });
  });

  // 行灯 wall lantern
  const llMat = new THREE.MeshStandardMaterial({
    color: 0xf4ede0, emissive: 0xffd9a0, emissiveIntensity: 0.7, roughness: 0.85
  });
  const llBody = new THREE.Mesh(new THREE.BoxGeometry(0.40, 1.20, 0.40), llMat);
  llBody.position.set(cx + NL_W / 2 - 0.24, 0.62, 8.0);
  scene.add(llBody);

  const llC = document.createElement('canvas');
  llC.width = 128; llC.height = 512;
  const llCtx = llC.getContext('2d');
  llCtx.fillStyle = '#f4ede0'; llCtx.fillRect(0, 0, 128, 512);
  llCtx.font = 'bold 72px serif'; llCtx.fillStyle = '#c8342a'; llCtx.textAlign = 'center';
  ['ら','ー','め','ん'].forEach((ch, i) => llCtx.fillText(ch, 64, 100 + i * 102));
  const llFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 1.18),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(llC), transparent: true })
  );
  llFace.position.set(cx + NL_W / 2 - 0.46, 0.62, 8.0);
  llFace.rotation.y = Math.PI / 2;
  scene.add(llFace);

  if (NK_PERF.enableWallWashPointLights) {
    const llPt = new THREE.PointLight(0xffc870, 0.55, 2.8, 1.5);
    llPt.position.set(cx + NL_W / 2 - 0.24, 0.62, 8.0);
    scene.add(llPt);
    nkSceneLights.push({ light: llPt, onIntensity: 0.55, nightMul: 0.6 });
  }

  // ── SECTION B LIGHTING + MENU BAR ─────────────────────────────────────────────
  const menuX = cx - NL_W / 2 + 1.35;
  const menuY = 2.42;
  const menuZ = -1.65;

  const menuSign = buildMenuLightbox(cx, menuX, menuY, menuZ, zB.h);
  nkInteractables.push(menuSign);
  addMemoryBeacon(menuX + 0.55, menuZ, { color: 0xffb55a, radius: 0.58, light: 0.45, memoryOpacity: 0.38 });

  // Placeholder fill (menu lightbox area)
  const menuFill = new THREE.PointLight(0xffeedd, 1.25, 4.0, 1.4);
  menuFill.position.set(menuX, 2.8, menuZ);
  scene.add(menuFill);
  nkSceneLights.push({ light: menuFill, onIntensity: 1.25, nightMul: 0.75 });

  // Broad shop fills — pulled down so the aisle has light pools that fall off
  // into shadow toward the walls (contrast), instead of a uniform wash.
  [[0.85, 5.4], [0.75, -1.6]].forEach(([intensity, z]) => {
    const shopFill = new THREE.PointLight(0xffedd0, intensity, 6.0, 1.6);
    shopFill.position.set(cx, 2.25, z);
    scene.add(shopFill);
    nkSceneLights.push({ light: shopFill, onIntensity: intensity, nightMul: 0.1 });
  });

  // ── SECTION C LIGHTING: Lanterns + string lights ──────────────────────────────

  // Red paper lanterns × 3
  [-5, -9, -12].forEach(z => {
    const lx = cx - NL_W / 2 + 0.38;
    const lanY = 2.42;
    const cordLen = zC.h - lanY - 0.24;
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, cordLen, 4),
      new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.9 })
    );
    cord.position.set(lx, lanY + cordLen / 2 + 0.12, z);
    scene.add(cord);
    const sph = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xc8342a, emissive: 0xc8342a, emissiveIntensity: 0.90, roughness: 0.65 })
    );
    sph.scale.y = 1.15;
    sph.position.set(lx, lanY, z);
    scene.add(sph);
    if (NK_PERF.enableLanternPointLights) {
      const lanPt = new THREE.PointLight(0xff6a3a, 0.62, 3.2, 1.5);
      lanPt.position.set(lx, lanY, z);
      scene.add(lanPt);
      nkSceneLights.push({ light: lanPt, onIntensity: 0.62, nightMul: 1.5 });
    }
  });

  // Bare-bulb string lights × 7
  const bulbPositions = [
    [cx - 2.1, -4.9], [cx + 1.7, -5.9], [cx - 0.4, -7.0],
    [cx + 2.2, -8.2], [cx - 1.35, -9.4], [cx + 0.7, -10.7], [cx - 1.8, -12.2]
  ];
  const cordMatB = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.9 });
  bulbPositions.forEach(([bx, bz], idx) => {
    const by = 2.82 + (idx % 3) * 0.16;
    const cl = zC.h - by - 0.08;
    const cord2 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, cl, 4), cordMatB);
    cord2.position.set(bx, by + cl / 2 + 0.04, bz);
    scene.add(cord2);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.062, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc870 })
    );
    bulb.position.set(bx, by, bz);
    scene.add(bulb);
    if (NK_PERF.enableStringBulbPointLights) {
      const bPt = new THREE.PointLight(0xffc870, 0.42, 2.4, 1.6);
      bPt.position.set(bx, by, bz);
      scene.add(bPt);
      nkSceneLights.push({ light: bPt, onIntensity: 0.42, nightMul: 0.3 });
    }
  });

  // RectAreaLight for neon glow on back wall
  const neonRect = new THREE.RectAreaLight(0xff3a3a, 4, 1.5, 0.4);
  neonRect.position.set(cx, 2.3, -13.8);
  neonRect.lookAt(cx, 2.3, -13.0);
  scene.add(neonRect);
  nkSceneLights.push({ light: neonRect, onIntensity: 4, nightMul: 1.25 });

  if (NK_PERF.enableWallWashPointLights) {
    // Optional warm fill for back wall stone texture visibility.
    const backWallFill = new THREE.PointLight(0xffd9a0, 0.55, 3.8, 1.5);
    backWallFill.position.set(cx, 1.8, -13.2);
    scene.add(backWallFill);
    nkSceneLights.push({ light: backWallFill, onIntensity: 0.55, nightMul: 0.12 });

    const backyardFill = new THREE.PointLight(0xffd9a0, 0.4, 6.0, 1.5);
    backyardFill.position.set(cx, 2.0, -8.5);
    scene.add(backyardFill);
    nkSceneLights.push({ light: backyardFill, onIntensity: 0.4, nightMul: 0.12 });
  }

  // ── INTERACTABLE PLACEHOLDER OBJECTS ──────────────────────────────────────────

  const barGroup = buildShopBar(cx, zB);
  nkInteractables.push(barGroup);

  // ── Ramen counter ────────────────────────────────────────────────────────────
  buildCounterFocus(cx);

  // Talk-to-chef hotspot, standing in the aisle in front of the counter.
  const chefHotspot = {
    position: new THREE.Vector3(cx - 2.15, 1.5, -1.0),
    type: "npcCook",
    npcId: "cook",
    name: "拉麵師傅",
  };
  nkInteractables.push(chefHotspot);
  addMemoryBeacon(cx - 2.15, -1.0, { color: 0xff6a3a, radius: 0.66, light: 0.55, memoryOpacity: 0.46 });

  const catGroup = buildCatDisplay(cx, zC);
  nkInteractables.push(catGroup);

  // ── Wall decorations ────────────────────────────────────────────────────────
  buildWallDecorations(cx, zA, zB, zC);

  buildEntryDisplay(cx);
  buildDiningFurniture(cx);
  buildNekolandCustomers(cx);

  // ── RETURN DOORWAY (front wall z=12) ─────────────────────────────────────────
  S.rainExitDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 2.15),
    new THREE.MeshBasicMaterial({ color: 0x060e1a })
  );
  S.rainExitDoor.rotation.y = Math.PI;
  S.rainExitDoor.position.set(cx, 1.08, zA.front - 0.05);
  scene.add(S.rainExitDoor);

  S.rainExitGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2.7),
    new THREE.MeshBasicMaterial({ color: 0x4060c0, transparent: true, opacity: 0.14, depthWrite: false })
  );
  S.rainExitGlow.rotation.y = Math.PI;
  S.rainExitGlow.position.set(cx, 1.2, zA.front - 0.06);
  scene.add(S.rainExitGlow);

  const rfMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.7, metalness: 0.2 });
  const rfDW = 1.05, rfDH = 2.15, rfW = 0.04;
  [0, 1].forEach(i => {
    const tb = new THREE.Mesh(new THREE.BoxGeometry(rfDW + rfW * 2, rfW, 0.02), rfMat);
    tb.rotation.y = Math.PI;
    tb.position.set(cx, i === 0 ? 1.08 + rfDH / 2 + rfW / 2 : 1.08 - rfDH / 2 - rfW / 2, zA.front - 0.05);
    scene.add(tb);
    const sd = new THREE.Mesh(new THREE.BoxGeometry(rfW, rfDH, 0.02), rfMat);
    sd.rotation.y = Math.PI;
    sd.position.set(i === 0 ? cx - rfDW / 2 - rfW / 2 : cx + rfDW / 2 + rfW / 2, 1.08, zA.front - 0.05);
    scene.add(sd);
  });

  S.rainExitSpot = new THREE.SpotLight(0x6090ff, 1.8, 7, Math.PI / 4.5, 0.72, 1.25);
  S.rainExitSpot.position.set(cx, 2.6, zA.front - 1.8);
  const rT = new THREE.Object3D();
  rT.position.set(cx, 1.08, zA.front - 0.05);
  scene.add(rT);
  S.rainExitSpot.target = rT;
  scene.add(S.rainExitSpot);

  const retC = document.createElement('canvas');
  retC.width = 400; retC.height = 100;
  const rc = retC.getContext('2d');
  rc.clearRect(0, 0, 400, 100);
  rc.font = 'italic 44px Georgia, serif';
  rc.fillStyle = '#8ab0ff'; rc.shadowColor = '#4060ff'; rc.shadowBlur = 18;
  rc.textAlign = 'center'; rc.fillText('← Rain Room', 200, 68);
  const retSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.13),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(retC), transparent: true })
  );
  retSign.rotation.y = Math.PI;
  retSign.position.set(cx, 1.08 + rfDH / 2 + 0.14, zA.front - 0.06);
  scene.add(retSign);

  S.rainExitDoorObj = { position: S.rainExitDoor.position, type: 'rainExit' };

  // ── Performance: start with NK lights off (we begin in Rain Room) ─────────────
  for (const { light } of nkSceneLights) light.intensity = 0;
}

// ── Nekoland shop details ─────────────────────────────────────────────────────
function buildNekolandTrim(cx, zA, zB, zC) {
  const red = new THREE.MeshStandardMaterial({ color: 0x8f211b, roughness: 0.72 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.75 });

  [zA, zB, zC].forEach((sect) => {
    const len = sect.front - sect.back;
    [-1, 1].forEach(side => {
      const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.055, len), red);
      railTop.position.set(cx + side * (NL_W / 2 - 0.026), 2.12, (sect.front + sect.back) / 2);
      scene.add(railTop);
      const railMid = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.045, len), red);
      railMid.position.set(cx + side * (NL_W / 2 - 0.024), 1.02, (sect.front + sect.back) / 2);
      scene.add(railMid);
    });
  });

  for (let z = zA.front - 0.55; z > zC.back + 0.5; z -= 1.1) {
    [-1, 1].forEach(side => {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.1, 0.025), dark);
      rib.position.set(cx + side * (NL_W / 2 - 0.04), 1.08, z);
      scene.add(rib);
    });
  }
}

function buildEntranceThreshold(cx, zA) {
  const redMat = new THREE.MeshStandardMaterial({ color: 0x8f1f18, emissive: 0x4c0805, emissiveIntensity: 0.2, roughness: 0.72 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x140a07, roughness: 0.86 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xfff0c8, roughness: 0.78 });
  const z = zA.front - 1.42;

  const frame = new THREE.Group();
  frame.position.set(cx, 0, z);
  scene.add(frame);

  const railTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.09, 0.08), darkMat);
  railTop.position.y = 2.25;
  frame.add(railTop);
  [-1.72, 1.72].forEach(x => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), darkMat);
    post.position.set(x, 1.28, 0);
    frame.add(post);
  });

  const norenTex = makeNorenTexture();
  // Entrance threshold: keep the middle clear so the Rain Room return door
  // remains readable instead of being covered by the decorative curtain.
  [-1.18, 1.18].forEach((x, i) => {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.52, 0.64),
      new THREE.MeshBasicMaterial({ map: norenTex, transparent: true, side: THREE.DoubleSide })
    );
    strip.position.set(x, 1.86 + (i % 2) * 0.025, -0.012);
    strip.rotation.y = Math.PI;
    frame.add(strip);
  });

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 0.34),
    new THREE.MeshBasicMaterial({ map: makeShopSignTexture("NEKOLAND", "NIGHT RAMEN"), transparent: true })
  );
  sign.position.set(0, 2.55, -0.055);
  sign.rotation.y = Math.PI;
  frame.add(sign);

  const thresholdMat = new THREE.MeshBasicMaterial({ color: 0xd7352a, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
  const thresholdGlow = new THREE.Mesh(new THREE.CircleGeometry(1.55, 36), thresholdMat);
  thresholdGlow.rotation.x = -Math.PI / 2;
  thresholdGlow.position.set(cx, 0.03, z - 0.15);
  scene.add(thresholdGlow);

  const runner = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.018, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x4a0d09, roughness: 0.78 })
  );
  runner.position.set(cx, 0.012, z - 2.1);
  scene.add(runner);

  [-1.96, 1.96].forEach((x, i) => {
    buildLantern(cx + x, 2.1, z - 0.05, {
      radius: 0.18,
      height: 0.34,
      label: i === 0 ? "猫" : "麺",
      intensity: 0.78,
      distance: 3.5
    });
  });

  const smallPlaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.28),
    new THREE.MeshBasicMaterial({ map: makeShopSignTexture("営業中", "OPEN AS USUAL"), transparent: true })
  );
  smallPlaque.rotation.y = Math.PI;
  smallPlaque.position.set(cx - 2.55, 1.55, zA.front - 0.04);
  scene.add(smallPlaque);

  const plaqueBacking = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.36, 0.035), paperMat);
  plaqueBacking.position.set(cx - 2.55, 1.55, zA.front - 0.015);
  scene.add(plaqueBacking);
}

function buildCounterFocus(cx) {
  const barX = cx - NL_W / 2 + 1.62;
  const menuZ = -1.65;
  const amberMat = new THREE.MeshBasicMaterial({ color: 0xffb55a, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x8f1f18, roughness: 0.7 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xfff0c8, roughness: 0.76 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x130906, roughness: 0.82 });

  const counterPool = new THREE.Mesh(new THREE.CircleGeometry(1.15, 36), amberMat);
  counterPool.rotation.x = -Math.PI / 2;
  counterPool.scale.y = 2.5;
  counterPool.position.set(barX + 0.92, 0.028, -0.25);
  scene.add(counterPool);

  [
    [cx - 0.45, 7.2, 0.54],
    [cx - 1.1, 5.0, 0.42],
    [cx - 1.55, 2.75, 0.52],
    [cx - 2.05, 0.7, 0.46],
    [cx - 2.1, -1.25, 0.58],
    [cx + 0.5, -4.75, 0.5],
    [cx + 0.9, -8.45, 0.44]
  ].forEach(([x, z, r], i) => {
    addSoftFloorPool(x, z, r, i % 2 ? 0xd7352a : 0xffb55a, i % 2 ? 0.065 : 0.085, 1.55);
  });

  const pawMat = new THREE.MeshBasicMaterial({ map: makeCatStickerTexture("#d7352a", "#fff0c8"), transparent: true, opacity: 0.38, depthWrite: false });
  [[cx - 0.9, 6.15], [cx - 1.35, 4.1], [cx - 1.8, 1.8], [cx - 2.12, -0.15]].forEach(([x, z], i) => {
    const paw = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), pawMat);
    paw.rotation.x = -Math.PI / 2;
    paw.rotation.z = i * 0.45;
    paw.position.set(x, 0.033, z);
    scene.add(paw);
  });

  [-2.65, -0.45, 1.75].forEach((z, i) => {
    buildLantern(barX + 0.85, 2.2 + (i % 2) * 0.05, z, {
      radius: 0.14,
      height: 0.32,
      label: i === 1 ? "湯" : "麺",
      intensity: 0.42,
      distance: 2.6
    });
  });

  const chalk = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.52),
    new THREE.MeshBasicMaterial({ map: makePosterTexture("TSUKEMEN", "dipping noodles", "#2a1710", "#fff0c8", "#d7352a"), transparent: true })
  );
  chalk.rotation.y = Math.PI / 2;
  chalk.position.set(barX - 1.28, 1.5, 2.75);
  scene.add(chalk);

  const steamWall = new THREE.Group();
  steamWall.position.set(barX + 0.62, 0, -0.45);
  scene.add(steamWall);
  [-0.9, -0.3, 0.28, 0.9].forEach((z, i) => {
    const steam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.06, 0.82 + i * 0.08, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff1cf, transparent: true, opacity: 0.12, depthWrite: false })
    );
    steam.position.set(0.16 + i * 0.02, 1.58 + i * 0.04, z);
    steam.rotation.z = i % 2 ? -0.16 : 0.18;
    steamWall.add(steam);
  });

  [-3.05, -2.72, 2.38, 2.74].forEach((z, i) => {
    const tentCard = new THREE.Group();
    tentCard.position.set(barX + 0.94, 1.06, z);
    scene.add(tentCard);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.32), paperMat);
    card.rotation.x = -0.25;
    tentCard.add(card);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.01, 0.22), redMat);
    line.position.set(0.005, 0.055, 0);
    line.rotation.x = -0.25;
    tentCard.add(line);
    if (i % 2 === 0) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.1, 12), darkMat);
      cup.position.set(0.08, 0.06, 0.22);
      tentCard.add(cup);
    }
  });
}

function buildWallDecorations(cx, zA, zB, zC) {
  const leftX = cx - NL_W / 2 + 0.028;
  const rightX = cx + NL_W / 2 - 0.028;

  // Front threshold wall: branding and shop memory fragments.
  addWallPoster({
    title: "NEKOLAND",
    subtitle: "lucky cat ramen",
    x: cx + 2.35, y: 1.65, z: zA.front - 0.035,
    rotY: Math.PI,
    w: 1.15, h: 0.58,
    bg: "#fff0c8", fg: "#180d08", accent: "#d7352a"
  });
  addWallPoster({
    title: "OPEN",
    subtitle: "as usual",
    x: cx - 3.15, y: 1.02, z: zA.front - 0.035,
    rotY: Math.PI,
    w: 0.8, h: 0.46,
    bg: "#27120c", fg: "#fff0c8", accent: "#ffb55a"
  });

  // Long timber wall: smaller dense artifacts so it no longer feels blank.
  [
    ["ramen ticket", "no. 02", 8.15, 1.34],
    ["red light", "still warm", 5.45, 1.72],
    ["cat paw", "lucky stamp", 2.85, 1.25],
    ["after rain", "eat slowly", -1.75, 1.56],
    ["tsukemen", "thick broth", -5.95, 1.34],
    ["last seat", "closing time", -9.2, 1.72],
  ].forEach(([title, sub, z, y], i) => {
    addWallPoster({
      title,
      subtitle: sub,
      x: rightX,
      y,
      z,
      rotY: -Math.PI / 2,
      w: i % 2 ? 0.72 : 0.86,
      h: i % 2 ? 0.42 : 0.5,
      bg: i % 2 ? "#8f1f18" : "#fff0c8",
      fg: i % 2 ? "#fff0c8" : "#180d08",
      accent: i % 2 ? "#ffb55a" : "#d7352a"
    });
  });

  // Tile/kitchen wall: food signs and order scraps.
  [
    ["RAMEN", "tonkotsu night", -3.2, 1.35],
    ["MATCHA", "soft serve", -0.25, 1.88],
    ["DRAFT", "after work", 2.15, 1.22],
  ].forEach(([title, sub, z, y]) => {
    addWallPoster({
      title,
      subtitle: sub,
      x: leftX,
      y,
      z,
      rotY: Math.PI / 2,
      w: 0.88,
      h: 0.48,
      bg: "#fff0c8",
      fg: "#180d08",
      accent: "#d7352a"
    });
  });

  // Back wall: shrine-adjacent memory photos and plaques.
  [
    [cx - 2.15, "photo", "red cat"],
    [cx - 0.75, "receipt", "2 bowls"],
    [cx + 0.75, "promise", "come back"],
    [cx + 2.15, "ticket", "midnight"],
  ].forEach(([x, title, sub], i) => {
    addWallPoster({
      title,
      subtitle: sub,
      x, y: 1.75 + (i % 2) * 0.34, z: zC.back + 0.035,
      rotY: 0,
      w: 0.72,
      h: 0.46,
      bg: i % 2 ? "#3a2115" : "#fff0c8",
      fg: i % 2 ? "#fff0c8" : "#180d08",
      accent: "#d7352a"
    });
  });

  // A low red-and-cream sticker trail points from the counter toward the cat.
  const stickerMatA = new THREE.MeshBasicMaterial({ map: makeCatStickerTexture("#d7352a", "#fff0c8"), transparent: true, side: THREE.DoubleSide });
  const stickerMatB = new THREE.MeshBasicMaterial({ map: makeCatStickerTexture("#fff0c8", "#d7352a"), transparent: true, side: THREE.DoubleSide });
  for (let i = 0; i < 12; i++) {
    const sticker = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), i % 2 ? stickerMatA : stickerMatB);
    sticker.rotation.y = -Math.PI / 2;
    sticker.position.set(rightX, 0.62 + (i % 3) * 0.18, 8.2 - i * 0.72);
    scene.add(sticker);
  }

  addWallWashLight(rightX - 0.18, 1.55, 5.1, 0xffb55a, 0.48, 3.4);
  addWallWashLight(rightX - 0.18, 1.52, -4.6, 0xff8a4a, 0.42, 3.3);
  addWallWashLight(leftX + 0.18, 1.62, -0.45, 0xffc076, 0.46, 3.1);
  addWallWashLight(cx, 1.75, zC.back + 0.35, 0xff8a4a, 0.46, 3.4);
}

function buildLantern(x, y, z, options = {}) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  const radius = options.radius || 0.16;
  const height = options.height || 0.34;
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.58, 4),
    new THREE.MeshStandardMaterial({ color: 0x100906, roughness: 0.9 })
  );
  cord.position.y = 0.38;
  group.add(cord);

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xd7352a, emissive: 0xd7352a, emissiveIntensity: 0.85, roughness: 0.55 })
  );
  body.scale.y = height / (radius * 2);
  group.add(body);

  const bandMat = new THREE.MeshStandardMaterial({ color: 0x160c08, roughness: 0.72 });
  [-height * 0.42, height * 0.42].forEach(yy => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.92, 0.01, 6, 20), bandMat);
    band.position.y = yy;
    band.rotation.x = Math.PI / 2;
    group.add(band);
  });

  if (options.label) {
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(radius * 1.1, height * 0.62),
      new THREE.MeshBasicMaterial({ map: makeSmallLabelTexture(options.label), transparent: true })
    );
    label.position.z = radius * 0.84;
    group.add(label);
  }

  if (NK_PERF.enableLanternPointLights) {
    const light = new THREE.PointLight(0xff6a3a, options.intensity || 0.5, options.distance || 3, 1.55);
    light.position.set(0, 0, 0);
    group.add(light);
    nkSceneLights.push({ light, onIntensity: options.intensity || 0.5, nightMul: 1.45 });
  }
  return group;
}

function addTableLighting(x, z, rotate, index = 0) {
  // Table lights are intentionally small: they reveal bowls/chairs/diners
  // without flattening the whole room back into cafeteria brightness.
  const lampGroup = new THREE.Group();
  lampGroup.position.set(x, 0, z);
  lampGroup.rotation.y = rotate ? Math.PI / 2 : 0;
  scene.add(lampGroup);

  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xffe6b0,
    emissive: 0xff9d4a,
    emissiveIntensity: 0.34,
    roughness: 0.72,
    transparent: true,
    opacity: 0.92
  });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x8f1f18, roughness: 0.68 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x150a06, roughness: 0.8 });

  if (index % 3 === 1) {
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 12), paperMat);
    candle.position.set(0.24, 0.86, -0.18);
    lampGroup.add(candle);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.035, 0.105, 10),
      new THREE.MeshBasicMaterial({ color: 0xffb55a, transparent: true, opacity: 0.82, depthWrite: false })
    );
    flame.position.set(0.24, 0.97, -0.18);
    lampGroup.add(flame);
  } else {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.035, 14), darkMat);
    base.position.set(0.25, 0.83, -0.18);
    lampGroup.add(base);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.105, 0.16, 14), paperMat);
    shade.position.set(0.25, 0.94, -0.18);
    lampGroup.add(shade);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 16), redMat);
    cap.position.set(0.25, 1.03, -0.18);
    cap.rotation.x = Math.PI / 2;
    lampGroup.add(cap);
  }

  if (NK_PERF.enableTablePointLights) {
    const local = new THREE.PointLight(0xffb55a, 0.52, 2.45, 1.62);
    local.position.set(x, 1.05, z);
    scene.add(local);
    nkSceneLights.push({ light: local, onIntensity: 0.52, nightMul: 1.1 });
  }

  addSoftFloorPool(x, z, 0.88, 0xffb55a, 0.095, 1.35);

  if (index % 2 === 0) {
    const bulbY = 2.05;
    const cord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.005, 0.62, 4),
      new THREE.MeshStandardMaterial({ color: 0x120806, roughness: 0.9 })
    );
    cord.position.set(x, bulbY + 0.31, z);
    scene.add(cord);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc076 })
    );
    bulb.position.set(x, bulbY, z);
    scene.add(bulb);
    if (NK_PERF.enableTinyPendantPointLights) {
      const pendant = new THREE.PointLight(0xffb55a, 0.26, 2.25, 1.75);
      pendant.position.set(x, bulbY, z);
      scene.add(pendant);
      nkSceneLights.push({ light: pendant, onIntensity: 0.26, nightMul: 1.0 });
    }
  }
}

function addSoftFloorPool(x, z, radius = 0.7, color = 0xffb55a, opacity = 0.075, stretch = 1.0) {
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 24),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.scale.y = stretch;
  pool.position.set(x, 0.027, z);
  scene.add(pool);
  return pool;
}

function addWallWashLight(x, y, z, color = 0xffb55a, intensity = 0.28, distance = 2.8) {
  if (NK_PERF.enableWallWashPointLights) {
    const light = new THREE.PointLight(color, intensity, distance, 1.8);
    light.position.set(x, y, z);
    scene.add(light);
    nkSceneLights.push({ light, onIntensity: intensity, nightMul: 0.92 });
  }

  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.58, 20),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  glow.position.set(x, y, z);
  glow.rotation.y = x < NL_CX ? Math.PI / 2 : -Math.PI / 2;
  if (Math.abs(z + NL_D / 2) < 0.7) glow.rotation.y = 0;
  scene.add(glow);
}

function addWallPoster({ title, subtitle, x, y, z, rotY, w, h, bg, fg, accent }) {
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.05, h + 0.05, 0.025),
    new THREE.MeshStandardMaterial({ color: 0x120906, roughness: 0.88 })
  );
  backing.position.set(x, y, z);
  backing.rotation.y = rotY;
  scene.add(backing);

  const supportGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.18, h + 0.16),
    new THREE.MeshBasicMaterial({
      color: 0xffb55a,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    })
  );
  supportGlow.position.set(x, y, z);
  supportGlow.rotation.y = rotY;
  supportGlow.translateZ(0.011);
  scene.add(supportGlow);

  const tinyLamp = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.42, 0.025, 0.018),
    new THREE.MeshBasicMaterial({ color: accent || 0xffb55a, transparent: true, opacity: 0.72 })
  );
  tinyLamp.position.set(x, y + h * 0.56, z);
  tinyLamp.rotation.y = rotY;
  tinyLamp.translateZ(0.022);
  scene.add(tinyLamp);

  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: makePosterTexture(title, subtitle, bg, fg, accent), transparent: true })
  );
  poster.position.set(x, y, z);
  poster.rotation.y = rotY;
  // Pull forward along the poster normal to avoid z-fighting with backing.
  poster.translateZ(0.018);
  scene.add(poster);
  return poster;
}

function makeNorenTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8f1f18';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(24,13,8,0.26)';
  for (let y = 0; y < canvas.height; y += 18) ctx.fillRect(0, y, canvas.width, 4);
  ctx.fillStyle = '#fff0c8';
  ctx.font = '700 54px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('猫', 128, 132);
  ctx.font = '700 34px IBM Plex Mono, monospace';
  ctx.fillText('NEKO', 128, 205);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeShopSignTexture(title, subtitle) {
  return makePosterTexture(title, subtitle, "#fff0c8", "#180d08", "#d7352a", 640, 220);
}

function makeSmallLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 192);
  ctx.fillStyle = 'rgba(255,240,200,0.88)';
  ctx.fillRect(38, 14, 52, 164);
  ctx.fillStyle = '#8f1f18';
  ctx.font = '700 60px serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 64, 112);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCatStickerTexture(bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = fg;
  ctx.beginPath();
  ctx.arc(64, 70, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(42, 50); ctx.lineTo(52, 25); ctx.lineTo(62, 52);
  ctx.moveTo(86, 50); ctx.lineTo(76, 25); ctx.lineTo(66, 52);
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.fillRect(48, 70, 32, 5);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePosterTexture(title, subtitle, bg = "#fff0c8", fg = "#180d08", accent = "#d7352a", w = 512, h = 320) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = accent;
  ctx.lineWidth = Math.max(6, w * 0.018);
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.fillStyle = accent;
  ctx.fillRect(18, h - 58, w - 36, 10);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = `800 ${Math.round(h * 0.18)}px Arial, sans-serif`;
  ctx.fillText(String(title).toUpperCase(), w / 2, h * 0.42);
  ctx.font = `600 ${Math.round(h * 0.105)}px IBM Plex Mono, monospace`;
  ctx.fillText(String(subtitle), w / 2, h * 0.62);
  ctx.fillStyle = accent;
  ctx.font = `700 ${Math.round(h * 0.10)}px serif`;
  ctx.fillText('招き猫', w / 2, h * 0.82);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildMenuLightbox(cx, menuX, menuY, menuZ, ceilingH) {
  const group = new THREE.Group();
  group.position.set(menuX, menuY, menuZ);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.68, 4.45),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d6, emissiveIntensity: 0.9, roughness: 0.42 })
  );
  group.add(body);

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(4.25, 0.58),
    new THREE.MeshBasicMaterial({ map: makeMenuBoardTexture(), transparent: true })
  );
  face.rotation.y = Math.PI / 2;
  face.position.x = 0.085;
  group.add(face);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x15110d, roughness: 0.52, metalness: 0.35 });
  [-2.26, 2.26].forEach(z => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.76, 0.045), frameMat);
    side.position.z = z;
    group.add(side);
  });
  [-0.38, 0.38].forEach(y => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 4.55), frameMat);
    rail.position.y = y;
    group.add(rail);
  });

  [-1.65, 1.65].forEach(z => {
    const rodLen = Math.max(0.35, ceilingH - (menuY + 0.34));
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, rodLen, 8),
      new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.5, metalness: 0.6 })
    );
    rod.position.set(0, 0.34 + rodLen / 2, z);
    group.add(rod);
  });

  group.userData = { data: {
    title: "Lightbox Menu",
    section: "Nekoland Night Shift",
    memory: "Matcha, cocktails, soft serve, coffee, draft beer, dessert. The first stamp is hidden in the strange order board.",
    camera: "—", film: "—", note: "Lucky stamp 1 — check menu"
  }, prompt: "CHECK MENU" };
  scene.add(group);

  addMemoryNote(
    "FIRST ORDER\nALWAYS CHANGES THE ROOM",
    new THREE.Vector3(menuX + 0.09, 2.05, menuZ + 2.15),
    Math.PI / 2,
    1.6
  );

  if (NK_PERF.enableWallWashPointLights) {
    const signPt = new THREE.PointLight(0xfff0d6, 1.25, 4.8, 1.4);
    signPt.position.set(menuX + 0.45, menuY, menuZ);
    scene.add(signPt);
    nkSceneLights.push({ light: signPt, onIntensity: 1.25, nightMul: 0.7 });
  }

  return group;
}

function buildShopBar(cx, zB) {
  const group = new THREE.Group();
  group.position.set(cx - NL_W / 2 + 1.62, 0, -0.45);

  const slatMat = new THREE.MeshStandardMaterial({ color: 0x2a160f, roughness: 0.84 });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0x6f452b, roughness: 0.56, metalness: 0.04 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x8f1f18, roughness: 0.58 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.65 });
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xc9bdab, roughness: 0.78 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x5c5b55, roughness: 0.34, metalness: 0.42 });
  const warmWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfff0c8, emissive: 0xffb55a, emissiveIntensity: 0.28, roughness: 0.6 });
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xfff0c8, roughness: 0.76 });
  const kitchenWallShift = -0.95;

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.92, 6.55), slatMat);
  base.position.set(0.18, 0.46, 0);
  group.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.08, 6.75), counterMat);
  top.position.set(0.22, 0.93, 0);
  group.add(top);
  const frontLip = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.12, 0.08), counterMat);
  frontLip.position.set(0.24, 0.90, 3.42);
  group.add(frontLip);
  const sideReturnA = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.86, 0.08), slatMat);
  sideReturnA.position.set(0.18, 0.43, -3.35);
  group.add(sideReturnA);
  const sideReturnB = sideReturnA.clone();
  sideReturnB.position.z = 3.35;
  group.add(sideReturnB);

  for (let z = -3.05; z <= 3.05; z += 0.34) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.82, 0.025), blackMat);
    rib.position.set(0.79, 0.48, z);
    group.add(rib);
  }

  const register = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.42), blackMat);
  register.position.set(0.44, 1.12, 1.35);
  group.add(register);
  const sodaBox = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.48, 0.5), redMat);
  sodaBox.position.set(0.42, 1.24, -1.15);
  group.add(sodaBox);

  const kitchenBack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.18, 6.1), tileMat);
  kitchenBack.position.set(-0.43 + kitchenWallShift, 1.55, -0.25);
  group.add(kitchenBack);

  for (let z = -2.9; z <= 2.75; z += 0.55) {
    const grout = new THREE.Mesh(new THREE.BoxGeometry(0.055, 1.02, 0.012), steelMat);
    grout.position.set(-0.398 + kitchenWallShift, 1.55, z);
    grout.material = new THREE.MeshStandardMaterial({ color: 0xbcb5aa, roughness: 0.85 });
    group.add(grout);
  }
  [1.28, 1.58, 1.88].forEach(y => {
    const grout = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.012, 5.95), new THREE.MeshStandardMaterial({ color: 0xbcb5aa, roughness: 0.85 }));
    grout.position.set(-0.397 + kitchenWallShift, y, -0.25);
    group.add(grout);
  });

  const passWindow = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.52, 2.55), warmWhiteMat);
  passWindow.position.set(-0.46 + kitchenWallShift, 1.72, -0.45);
  group.add(passWindow);
  [-1.82, 0.92].forEach(z => {
    const passSide = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.64, 0.035), blackMat);
    passSide.position.set(-0.485 + kitchenWallShift, 1.72, z);
    group.add(passSide);
  });
  [1.41, 2.03].forEach(y => {
    const passRail = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 2.74), blackMat);
    passRail.position.set(-0.485 + kitchenWallShift, y, -0.45);
    group.add(passRail);
  });
  const passLight = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.46, 2.52), warmWhiteMat);
  passLight.position.set(-0.525 + kitchenWallShift, 1.72, -0.45);
  group.add(passLight);

  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 2.95), blackMat);
  hood.position.set(-0.17, 2.2, -0.45);
  group.add(hood);
  const hoodLip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.045, 3.08), steelMat);
  hoodLip.position.set(0.10, 2.07, -0.45);
  group.add(hoodLip);

  [-1.45, -0.35, 0.75].forEach((z, i) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.88), steelMat);
    shelf.position.set(-0.20 + kitchenWallShift, 1.36 + i * 0.24, z);
    group.add(shelf);
    [-0.36, 0.36].forEach(offset => {
      const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.018), blackMat);
      bracket.position.set(-0.27 + kitchenWallShift, 1.28 + i * 0.24, z + offset);
      bracket.rotation.z = -0.6;
      group.add(bracket);
    });
  });

  [-1.7, -1.45, -0.55, -0.32, 0.52, 0.78].forEach((z, i) => {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, 0.28, 10),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? 0x263c2c : i % 3 === 1 ? 0x2b1a11 : 0x6d1e19, roughness: 0.35, metalness: 0.12 })
    );
    bottle.position.set(-0.10 + kitchenWallShift, 1.50 + (i % 2) * 0.24, z);
    group.add(bottle);
  });

  const posStand = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.22, 0.055), blackMat);
  posStand.position.set(0.54, 1.1, 1.8);
  group.add(posStand);
  const posScreen = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.42), blackMat);
  posScreen.position.set(0.54, 1.34, 1.8);
  posScreen.rotation.x = -0.12;
  group.add(posScreen);
  const posFace = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.24, 0.32), new THREE.MeshBasicMaterial({ color: 0x1d2630 }));
  posFace.position.set(0.585, 1.34, 1.8);
  group.add(posFace);

  const orderRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 2.55), steelMat);
  orderRail.position.set(0.46, 1.56, 0.18);
  group.add(orderRail);
  [-0.72, -0.28, 0.16, 0.60].forEach(z => {
    const ticket = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.22, 0.18), paperMat);
    ticket.position.set(0.49, 1.43, z);
    ticket.rotation.x = -0.08;
    group.add(ticket);
  });

  [-2.25, 2.28].forEach(z => {
    const menuCard = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.36), new THREE.MeshStandardMaterial({ color: 0xf4ead2, roughness: 0.72 }));
    menuCard.position.set(0.54, 1.16, z);
    menuCard.rotation.x = -0.18;
    group.add(menuCard);
  });

  const glassCase = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.34, 0.82),
    new THREE.MeshStandardMaterial({ color: 0xbfd8e8, roughness: 0.08, metalness: 0.02, transparent: true, opacity: 0.34 })
  );
  glassCase.position.set(0.52, 1.18, 0.38);
  group.add(glassCase);
  const caseBase = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.08, 0.86), blackMat);
  caseBase.position.set(0.52, 1.0, 0.38);
  group.add(caseBase);

  [-1.95, -1.55, -1.15].forEach((z, i) => {
    const bottle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.055, 0.38, 10),
      new THREE.MeshStandardMaterial({ color: i === 1 ? 0x213820 : 0x2b1a11, roughness: 0.35, metalness: 0.15 })
    );
    bottle.position.set(0.50, 1.24, z);
    group.add(bottle);
  });

  const floorMat = new THREE.Mesh(
    new THREE.BoxGeometry(0.92, 0.022, 5.9),
    new THREE.MeshStandardMaterial({ color: 0x6f1d16, roughness: 0.74 })
  );
  floorMat.position.set(-0.18, 0.012, -0.25);
  group.add(floorMat);

  const prepBoard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.035, 0.72), new THREE.MeshStandardMaterial({ color: 0xd0a36a, roughness: 0.48 }));
  prepBoard.position.set(0.50, 1.035, -2.45);
  group.add(prepBoard);

  const sink = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.075, 0.62), steelMat);
  sink.position.set(0.48, 1.035, 2.15);
  group.add(sink);
  const basin = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.035, 0.46),
    new THREE.MeshStandardMaterial({ color: 0x1d2730, roughness: 0.18, metalness: 0.35 })
  );
  basin.position.set(0.50, 1.085, 2.15);
  group.add(basin);
  const faucetStem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.25, 10), steelMat);
  faucetStem.position.set(0.36, 1.22, 2.0);
  group.add(faucetStem);
  const faucetArm = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.028, 0.028), steelMat);
  faucetArm.position.set(0.46, 1.33, 2.0);
  group.add(faucetArm);

  [-0.95, -0.45, 0.05].forEach((z, i) => {
    const burner = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20), blackMat);
    burner.position.set(0.52, 1.035, z);
    group.add(burner);
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.16, 12),
      new THREE.MeshBasicMaterial({ color: i === 1 ? 0xffc35a : 0xff6b35, transparent: true, opacity: 0.72, depthWrite: false })
    );
    flame.position.set(0.52, 1.13, z);
    group.add(flame);
  });

  const dishMat = new THREE.MeshStandardMaterial({ color: 0xf7f0df, roughness: 0.5 });
  [-2.78, -2.62, 2.68, 2.84].forEach((z, i) => {
    const bowlStack = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.10, 0.08, 20), dishMat);
    bowlStack.position.set(0.50, 1.04, z);   // bottom flush on the counter top (y≈1.0)
    group.add(bowlStack);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.01, 6, 20), redMat);
    rim.position.set(0.50, 1.085, z);
    rim.rotation.x = Math.PI / 2;
    group.add(rim);
  });

  const utensilRail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 2.65), steelMat);
  utensilRail.position.set(-0.35 + kitchenWallShift, 1.96, 1.35);
  group.add(utensilRail);
  [0.55, 0.95, 1.35, 1.78, 2.15].forEach((z, i) => {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.006, 6, 14, Math.PI * 1.45), steelMat);
    hook.position.set(-0.32 + kitchenWallShift, 1.89, z);
    hook.rotation.y = Math.PI / 2;
    group.add(hook);
    const tool = new THREE.Mesh(
      new THREE.CylinderGeometry(i % 2 ? 0.012 : 0.018, 0.012, 0.36, 8),
      i % 2 ? blackMat : steelMat
    );
    tool.position.set(-0.32 + kitchenWallShift, 1.68, z);
    group.add(tool);
  });

  [-2.75, 2.72].forEach(z => {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.48), new THREE.MeshStandardMaterial({ color: 0x8f241d, roughness: 0.68 }));
    crate.position.set(-0.05, 0.18, z);
    group.add(crate);
    const crateRim = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.035, 0.52), blackMat);
    crateRim.position.set(-0.05, 0.34, z);
    group.add(crateRim);
  });

  const cook = createRamenCook(blackMat, redMat, steelMat, paperMat, warmWhiteMat);
  cook.position.set(-1.55, 0, -0.35);
  group.add(cook);
  nkCooks.push({
    armA: cook.userData.armA, armB: cook.userData.armB, headRig: cook.userData.headRig,
    mouth: cook.userData.mouth,
    steams: cook.userData.steams, mode: 'stir', phase: 0,
    armAz: cook.userData.armA.rotation.z, armBz: cook.userData.armB.rotation.z
  });

  // Second cook further along the bar, assembling a bowl with both hands.
  const cookB = createRamenCook(blackMat, redMat, steelMat, paperMat, warmWhiteMat);
  cookB.position.set(-1.55, 0, 0.85);
  group.add(cookB);
  nkCooks.push({
    armA: cookB.userData.armA, armB: cookB.userData.armB, headRig: cookB.userData.headRig,
    mouth: cookB.userData.mouth,
    steams: cookB.userData.steams, mode: 'assemble', phase: Math.PI,
    armAz: cookB.userData.armA.rotation.z, armBz: cookB.userData.armB.rotation.z
  });

  group.userData = { data: {
    title: "Behind the Counter",
    section: "Nekoland Night Shift",
    memory: "A narrow bar, warm timber, chefs over the noodles, and orders waiting under red lantern light. This is where Today's Special starts.",
    camera: "—", film: "—", note: "Lucky stamp 2 — counter"
  }, prompt: "COLLECT STAMP" };
  scene.add(group);
  addMemoryBeacon(group.position.x + 0.86, group.position.z + 0.25, { color: 0xffb36b, radius: 0.58, light: 0.24, memoryOpacity: 0.30 });
  S.nkBarBounds = {
    minX: group.position.x + 0.22 - 1.42 / 2,
    maxX: group.position.x + 0.22 + 1.42 / 2,
    minZ: group.position.z - 6.75 / 2,
    maxZ: group.position.z + 6.75 / 2,
  };
  return group;
}

function createRamenCook(blackMat, redMat, steelMat, paperMat, warmWhiteMat) {
  const cook = new THREE.Group();
  const chefX = 0.62;
  const chefZ = -0.25;
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc58a5c, roughness: 0.58 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf1eadc, roughness: 0.7 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.72 });
  const noodleMat = new THREE.MeshStandardMaterial({ color: 0xf3d36a, roughness: 0.62 });
  const brothMat = new THREE.MeshStandardMaterial({ color: 0x6e3a17, emissive: 0x3a1606, emissiveIntensity: 0.12, roughness: 0.5 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.62, 0.28), shirtMat);
  torso.position.set(chefX, 1.18, chefZ);
  cook.add(torso);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.50, 0.035), apronMat);
  apron.position.set(chefX + 0.155, 1.14, chefZ);
  apron.rotation.y = Math.PI / 2;
  cook.add(apron);

  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.16, 0.24), apronMat);
  waist.position.set(chefX, 0.84, chefZ);
  cook.add(waist);
  [-0.08, 0.08].forEach((z, i) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.62, 6, 10), apronMat);
    leg.position.set(chefX, 0.42, chefZ + z);
    leg.rotation.z = i === 0 ? -0.04 : 0.04;
    cook.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.065, 0.22), blackMat);
    shoe.position.set(chefX + 0.05, 0.035, chefZ + z + 0.025);
    cook.add(shoe);
  });

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.08, 10), skinMat);
  neck.position.set(chefX, 1.53, chefZ);
  cook.add(neck);

  const headRig = new THREE.Group();
  headRig.position.set(chefX, 1.68, chefZ);
  cook.add(headRig);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skinMat);
  head.scale.set(0.9, 1.05, 0.86);
  headRig.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.12, 16), paperMat);
  cap.position.y = 0.15;
  headRig.add(cap);
  const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.145, 16, 8), paperMat);
  capTop.scale.set(1, 0.35, 1);
  capTop.position.y = 0.22;
  headRig.add(capTop);

  const capBand = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.026, 0.30), blackMat);
  capBand.position.set(0.125, 0.10, 0);
  headRig.add(capBand);

  [-0.045, 0.045].forEach(z => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshStandardMaterial({ color: 0x241008, roughness: 0.48 }));
    eye.position.set(0.125, 0.02, z);
    headRig.add(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(0.138, 0.028, z + 0.005);
    headRig.add(glint);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.008, 0.05), blackMat);
    brow.position.set(0.132, 0.06, z);
    brow.rotation.x = z < 0 ? 0.16 : -0.16;
    headRig.add(brow);
  });
  [-0.08, 0.08].forEach(z => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf1a088, roughness: 0.56 }));
    cheek.scale.set(0.32, 0.78, 1.15);
    cheek.position.set(0.132, -0.04, z);
    headRig.add(cheek);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), skinMat);
  nose.scale.set(0.55, 0.7, 1.0);
  nose.position.set(0.142, -0.01, 0);
  headRig.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.01, 0.075), blackMat);
  mouth.position.set(0.145, -0.075, 0);
  headRig.add(mouth);

  const armA = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.42, 6, 10), skinMat);
  armA.position.set(chefX + 0.14, 1.28, chefZ - 0.17);
  armA.rotation.z = 1.15;
  armA.rotation.y = -0.25;
  cook.add(armA);
  const armB = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.42, 6, 10), skinMat);
  armB.position.set(chefX + 0.15, 1.26, chefZ + 0.15);
  armB.rotation.z = 1.05;
  armB.rotation.y = 0.25;
  cook.add(armB);

  const stove = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.54), blackMat);
  stove.position.set(1.05, 1.03, -0.30);
  cook.add(stove);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.18, 24), steelMat);
  pot.position.set(1.05, 1.20, -0.30);
  cook.add(pot);
  const potRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 8, 24), steelMat);
  potRim.position.set(1.05, 1.30, -0.30);
  potRim.rotation.x = Math.PI / 2;
  cook.add(potRim);
  const broth = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.018, 24), brothMat);
  broth.position.set(1.05, 1.305, -0.30);
  cook.add(broth);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.13, 24), warmWhiteMat);
  bowl.position.set(1.12, 1.035, 0.18);
  cook.add(bowl);
  const bowlRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.015, 8, 24), redMat);
  bowlRim.position.set(1.12, 1.11, 0.18);
  bowlRim.rotation.x = Math.PI / 2;
  cook.add(bowlRim);
  [0, 0.055, -0.055].forEach((offset, i) => {
    const noodle = new THREE.Mesh(new THREE.TorusGeometry(0.075 + i * 0.012, 0.008, 6, 18), noodleMat);
    noodle.position.set(1.12, 1.125, 0.18 + offset);
    noodle.rotation.x = Math.PI / 2;
    cook.add(noodle);
  });

  const chopsticks = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.62), new THREE.MeshStandardMaterial({ color: 0x5a2d18, roughness: 0.52 }));
  chopsticks.position.set(0.98, 1.46, -0.02);
  chopsticks.rotation.x = 0.55;
  chopsticks.rotation.z = -0.38;
  cook.add(chopsticks);
  const chopsticks2 = chopsticks.clone();
  chopsticks2.position.z += 0.045;
  cook.add(chopsticks2);

  const steams = [];
  [-0.08, 0.03, 0.15].forEach((z, i) => {
    const steam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.026, 0.5 + i * 0.08, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false })
    );
    steam.position.set(1.05 + i * 0.055, 1.62 + i * 0.06, -0.30 + z);
    steam.rotation.z = i % 2 === 0 ? 0.18 : -0.16;
    steam.userData.baseY = steam.position.y;
    steam.userData.seed = i * 1.7;
    cook.add(steam);
    steams.push(steam);
  });

  const warmSplash = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 32),
    new THREE.MeshBasicMaterial({ color: 0xffc36b, transparent: true, opacity: 0.10, depthWrite: false })
  );
  warmSplash.position.set(0.98, 1.5, -0.32);
  warmSplash.rotation.y = Math.PI / 2;
  cook.add(warmSplash);

  cook.userData.armA = armA;
  cook.userData.armB = armB;
  cook.userData.headRig = headRig;
  cook.userData.mouth = mouth;
  cook.userData.steams = steams;
  return cook;
}

function buildCatDisplay(cx, zC) {
  const redAcrylic = new THREE.MeshStandardMaterial({ color: 0xd62d24, emissive: 0xb91e18, emissiveIntensity: 0.18, roughness: 0.22, metalness: 0.06, transparent: true, opacity: 0.78 });
  const whiteAcrylic = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.24, transparent: true, opacity: 0.88 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.18 });

  const cols = 7, rows = 5, cell = 0.5;
  const baseX = cx + NL_W / 2 - 0.12;
  const baseY = 0.72;
  const baseZ = -10.85;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const mat = (r + c) % 2 === 0 ? whiteAcrylic : redAcrylic;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.11, cell * 0.9, cell * 0.9), mat);
      cube.position.set(baseX, baseY + r * cell, baseZ + c * cell);
      scene.add(cube);
      if ((r + c) % 3 === 0) addMiniCat(cx + NL_W / 2 - 0.23, baseY + r * cell, baseZ + c * cell);
    }
  }

  for (let c = -1; c <= cols; c++) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, cell * 0.92), frameMat);
    rail.position.set(baseX - 0.07, baseY - cell * 0.55, baseZ + c * cell);
    scene.add(rail);
  }

  // ── Lucky cat shrine ───────────────────────────────────────────────────────
  // The shrine sits to the player's left so the ramen counter remains the main
  // destination on entry, while the cat still reads as a strong side memory.
  const catX = cx - 2.15;
  const catZ = 9.15;

  const altarMat = new THREE.MeshStandardMaterial({ color: 0x180d08, roughness: 0.72, metalness: 0.03 });
  const altarTopMat = new THREE.MeshStandardMaterial({ color: 0x3a2115, roughness: 0.68 });
  const tagMat = new THREE.MeshStandardMaterial({ color: 0xfff0c8, roughness: 0.78 });
  const redTagMat = new THREE.MeshStandardMaterial({ color: 0x8f1f18, roughness: 0.72 });
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x140906, roughness: 0.86 });

  const altar = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.32, 0.82), altarMat);
  altar.position.set(catX, 0.16, catZ - 0.36);
  scene.add(altar);
  const altarTop = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.06, 0.92), altarTopMat);
  altarTop.position.set(catX, 0.35, catZ - 0.36);
  scene.add(altarTop);

  [-0.88, -0.44, 0.44, 0.88].forEach((x, i) => {
    const tag = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.025), i % 2 ? redTagMat : tagMat);
    tag.position.set(catX + x, 0.62 + (i % 2) * 0.06, catZ - 0.86);
    tag.rotation.x = -0.14 + i * 0.02;
    scene.add(tag);
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 4), cordMat);
    tie.position.set(catX + x, 0.8, catZ - 0.86);
    tie.rotation.x = Math.PI / 2;
    scene.add(tie);
  });

  [-1.12, 1.12].forEach((x, i) => {
    const mini = createLuckyCat();
    mini.scale.setScalar(0.18);
    mini.position.set(catX + x, 0.38, catZ - 0.42);
    mini.rotation.y = i === 0 ? 0.25 : -0.25;
    scene.add(mini);
  });

  const catBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.72, 0.15, 40),
    new THREE.MeshStandardMaterial({ color: 0x7c1a12, roughness: 0.55, metalness: 0.08 })
  );
  catBase.position.set(catX, 0.075, catZ);
  scene.add(catBase);

  const catShadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.86, 40),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.24, depthWrite: false })
  );
  catShadow.rotation.x = -Math.PI / 2;
  catShadow.position.set(catX, 0.01, catZ);
  scene.add(catShadow);

  const cat = createLuckyCat();
  cat.position.set(catX, 0.15, catZ);
  cat.rotation.y = 0;
  cat.userData = { baseRotationY: 0, data: {
    title: "Maneki-neko 招財貓",
    section: "Nekoland Night Shift",
    memory: "A red lacquer lucky cat with a raised paw, gold koban, soft cream face details and a little bell. It watches the shop like a tiny night-shift mascot.",
    camera: "—", film: "—", note: "Lucky stamp 3 — lucky cat"
  }, prompt: "INSPECT THE LUCKY CAT" };
  scene.add(cat);
  nkLuckyCat = cat;
  addMemoryBeacon(catX, catZ, { color: 0xff5a3a, radius: 0.92, light: 0.55, memoryOpacity: 0.52 });

  const catGlow = new THREE.PointLight(0xffb55a, 1.45, 4.8, 1.4);
  catGlow.position.set(catX, 1.9, catZ);
  scene.add(catGlow);
  nkSceneLights.push({ light: catGlow, onIntensity: 1.45, nightMul: 1.35 });

  [-1.35, 1.35].forEach((x, i) => {
    buildLantern(catX + x, 1.55, catZ + 0.2, {
      radius: 0.12,
      height: 0.28,
      label: i === 0 ? "福" : "猫",
      intensity: 0.44,
      distance: 2.5
    });
  });

  const shrineSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.24),
    new THREE.MeshBasicMaterial({ map: makePosterTexture("lucky cat", "room pulse", "#fff0c8", "#180d08", "#d7352a"), transparent: true, side: THREE.DoubleSide })
  );
  shrineSign.rotation.y = -0.22;
  shrineSign.position.set(catX + 0.82, 0.76, catZ + 0.34);
  scene.add(shrineSign);

  const shrineHalo = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 42),
    new THREE.MeshBasicMaterial({ color: 0xd7352a, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  shrineHalo.rotation.x = -Math.PI / 2;
  shrineHalo.position.set(catX, 0.035, catZ - 0.1);
  scene.add(shrineHalo);
  S.nkCatBounds = { x: catX, z: catZ, radius: 1.1 };

  const neon = makeNeonText("THIS MUST\\nBE THE\\nPLACE");
  neon.rotation.y = -Math.PI / 2;
  neon.position.set(cx + NL_W / 2 - 0.04, 1.7, -7.45);
  scene.add(neon);

  addMemoryNote(
    "SOMEONE SAT HERE\nUNTIL CLOSING",
    new THREE.Vector3(cx + NL_W / 2 - 0.045, 1.24, -5.9),
    -Math.PI / 2,
    1.45
  );

  return cat;
}

function buildEntryDisplay(cx) {
  const redAcrylic = new THREE.MeshStandardMaterial({ color: 0xd62d24, emissive: 0xb91e18, emissiveIntensity: 0.22, roughness: 0.2, transparent: true, opacity: 0.78 });
  const whiteAcrylic = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.18, transparent: true, opacity: 0.88 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.22 });
  const baseX = cx + NL_W / 2 - 0.13;
  const baseY = 0.72;
  const baseZ = 4.25;
  const rows = 4, cols = 5, cell = 0.46;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, cell * 0.9, cell * 0.9),
        (r + c) % 2 === 0 ? whiteAcrylic : redAcrylic
      );
      cube.position.set(baseX, baseY + r * cell, baseZ + c * cell);
      scene.add(cube);
      if ((r + c) % 3 === 1) addMiniCat(baseX - 0.1, baseY + r * cell, baseZ + c * cell);
    }
  }

  for (let c = -1; c <= cols; c++) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, cell * 0.92), frameMat);
    rail.position.set(baseX - 0.07, baseY - cell * 0.55, baseZ + c * cell);
    scene.add(rail);
  }

  if (NK_PERF.enableWallWashPointLights) {
    const displayGlow = new THREE.PointLight(0xffb55a, 0.74, 3.4, 1.45);
    displayGlow.position.set(cx + 1.9, 1.5, 5.25);
    scene.add(displayGlow);
    nkSceneLights.push({ light: displayGlow, onIntensity: 0.74, nightMul: 0.95 });
  }
}

function buildDiningFurniture(cx) {
  // Tables hug the two side walls so the centre aisle (around cx) stays clear and
  // the entrance greeter cat keeps its space.
  S.nkTableBounds.length = 0;
  const tablePositions = [
    [cx + 2.05, 0.52, 8.4],
    [cx - 1.9, 0.52, 6.2],
    [cx + 2.1, 0.52, 2.6],
    [cx - 1.95, 0.52, -2.4],
    [cx + 2.1, 0.52, -6.1],
    [cx - 1.85, 0.52, -9.0]
  ];
  tablePositions.forEach(([x, y, z], i) => {
    const rotate = i % 2 === 0;
    createTableSet(x, y, z, rotate);
    addTableLighting(x, z, rotate, i);
    S.nkTableBounds.push({ x, z, radius: 0.82 });
  });
}

function createTableSet(x, y, z, rotate) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rotate ? Math.PI / 2 : 0;

  const topMat = new THREE.MeshStandardMaterial({ color: 0xb37a42, emissive: 0x2a1208, emissiveIntensity: 0.04, roughness: 0.54 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0x8f1f18, roughness: 0.58 });
  const footMat = new THREE.MeshStandardMaterial({ color: 0xd9d0bd, emissive: 0x241006, emissiveIntensity: 0.035, roughness: 0.58, metalness: 0.04 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.72), topMat);
  top.position.y = 0.76;
  group.add(top);
  [[-0.38, -0.27], [0.38, -0.27], [-0.38, 0.27], [0.38, 0.27]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.72, 0.045), redMat);
    leg.position.set(lx, 0.38, lz);
    group.add(leg);
  });

  [[-0.74, 0, Math.PI / 2], [0.74, 0, -Math.PI / 2]].forEach(([cx2, cz2, rot]) => {
    const chair = createDiningChair(footMat, redMat);
    chair.position.set(cx2, 0, cz2);
    chair.rotation.y = rot;
    group.add(chair);
  });

  scene.add(group);
}

function createDiningChair(frameMat, cushionMat) {
  const chair = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.38), frameMat);
  seat.position.y = 0.45;
  chair.add(seat);

  const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.035, 0.30), cushionMat);
  cushion.position.y = 0.50;
  chair.add(cushion);

  [[-0.16, -0.14], [0.16, -0.14], [-0.16, 0.14], [0.16, 0.14]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 8), frameMat);
    leg.position.set(lx, 0.24, lz);
    chair.add(leg);
  });

  [-0.16, 0.16].forEach(lx => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.62, 8), frameMat);
    post.position.set(lx, 0.74, -0.18);
    chair.add(post);
  });

  const backRail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.045), frameMat);
  backRail.position.set(0, 0.96, -0.18);
  chair.add(backRail);
  const backPad = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.045), frameMat);
  backPad.position.set(0, 0.77, -0.195);
  chair.add(backPad);
  const redBackPad = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.20, 0.02), cushionMat);
  redBackPad.position.set(0, 0.77, -0.223);
  chair.add(redBackPad);

  const footRail = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.025, 0.025), frameMat);
  footRail.position.set(0, 0.31, 0.18);
  chair.add(footRail);
  return chair;
}

function createLuckyCat() {
  // Red lacquer maneki-neko: glossy crimson body, raised left paw beckoning,
  // cream face/foot details with a gold bell, a gold koban coin at the belly,
  // and a painted face (almond eyes, pink nose, whiskers).
  const group = new THREE.Group();
  const white     = new THREE.MeshStandardMaterial({ color: 0xd9342b, emissive: 0x6c0905, emissiveIntensity: 0.14, roughness: 0.30, metalness: 0.08 });
  const whiteWarm = new THREE.MeshStandardMaterial({ color: 0xf3ece0, roughness: 0.4 });
  const red       = new THREE.MeshStandardMaterial({ color: 0xd2342a, emissive: 0x4a0703, emissiveIntensity: 0.12, roughness: 0.4 });
  const pink      = new THREE.MeshStandardMaterial({ color: 0xf2a6ac, roughness: 0.5 });
  const gold      = new THREE.MeshStandardMaterial({ color: 0xe6b830, roughness: 0.26, metalness: 0.55, emissive: 0x6b4a05, emissiveIntensity: 0.22 });
  const goldDeep  = new THREE.MeshStandardMaterial({ color: 0xc4901c, roughness: 0.3, metalness: 0.5 });
  const dark      = new THREE.MeshStandardMaterial({ color: 0x171210, roughness: 0.55 });

  // ── Body: rounded seated lacquer form ──
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 28, 24), white);
  body.scale.set(0.95, 1.08, 0.82);
  body.position.y = 0.5;
  group.add(body);
  // cream belly panel (slightly proud, glossy)
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), whiteWarm);
  belly.scale.set(1, 1.05, 0.2);
  belly.position.set(0, 0.5, 0.42);
  group.add(belly);

  // ── Head ──
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 28, 24), white);
  head.scale.set(1.04, 0.9, 0.88);
  head.position.y = 1.26;
  group.add(head);

  // ── Ears: white outer, red/pink inner (maneki ears are large & rounded) ──
  [-0.25, 0.25].forEach(x => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 18), white);
    ear.position.set(x, 1.62, 0.0);
    ear.rotation.z = x < 0 ? 0.4 : -0.4;
    ear.rotation.x = -0.12;
    group.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 16), red);
    inner.position.set(x * 0.93, 1.6, 0.05);
    inner.rotation.z = ear.rotation.z;
    inner.rotation.x = -0.12;
    group.add(inner);
  });

  // ── Muzzle / cheeks ──
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 14), whiteWarm);
  muzzle.scale.set(1.15, 0.6, 0.42);
  muzzle.position.set(0, 1.12, 0.38);
  group.add(muzzle);

  // ── Eyes: classic almond shape, dark with a tiny catch-light ──
  [-0.15, 0.15].forEach(x => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), dark);
    eye.scale.set(0.62, 1.25, 0.4);
    eye.position.set(x, 1.3, 0.4);
    group.add(eye);
    const glint = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    glint.position.set(x + 0.012, 1.33, 0.43);
    group.add(glint);
  });

  // ── Nose (pink) and mouth ──
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), pink);
  nose.scale.set(1.2, 0.8, 0.6);
  nose.position.set(0, 1.16, 0.46);
  group.add(nose);
  [-1, 1].forEach(side => {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 12, Math.PI), dark);
    lip.position.set(side * 0.05, 1.1, 0.45);
    lip.rotation.z = Math.PI;
    lip.rotation.y = side * 0.3;
    group.add(lip);
  });

  // ── Whiskers ──
  [-1, 1].forEach(side => {
    [-0.04, 0.02, 0.08].forEach((dy, i) => {
      const whisker = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.01, 0.01), dark);
      whisker.position.set(side * 0.2, 1.12 + dy, 0.44);
      whisker.rotation.z = side * (i - 1) * 0.14;
      group.add(whisker);
    });
  });

  // ── Red collar + gold bell ──
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.04, 10, 36), red);
  collar.position.set(0, 0.98, 0.04);
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1, 0.85, 1);
  group.add(collar);
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 14), gold);
  bell.position.set(0, 0.92, 0.36);
  group.add(bell);
  const bellSlot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), dark);
  bellSlot.position.set(0, 0.9, 0.42);
  group.add(bellSlot);

  // ── Raised LEFT paw (beckoning gesture) ──
  const armUp = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 10, 16), white);
  armUp.position.set(0.34, 1.18, 0.08);
  armUp.rotation.z = -0.32;
  group.add(armUp);
  const pawUp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), white);
  pawUp.position.set(0.46, 1.46, 0.12);
  group.add(pawUp);
  const pawPad = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), whiteWarm);
  pawPad.scale.set(1, 1, 0.4);
  pawPad.position.set(0.49, 1.42, 0.24);
  group.add(pawPad);

  // ── Resting RIGHT paw ──
  const armDown = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.28, 10, 14), white);
  armDown.position.set(-0.34, 0.68, 0.28);
  armDown.rotation.x = 0.5;
  armDown.rotation.z = 0.2;
  group.add(armDown);
  const pawDown = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), white);
  pawDown.scale.set(1.1, 0.9, 1);
  pawDown.position.set(-0.3, 0.5, 0.42);
  group.add(pawDown);

  // ── Feet ──
  [-0.24, 0.24].forEach(x => {
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 12), white);
    foot.scale.set(1.2, 0.5, 0.75);
    foot.position.set(x, 0.07, 0.34);
    group.add(foot);
    const padBig = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), whiteWarm);
    padBig.scale.set(1, 0.4, 1);
    padBig.position.set(x, 0.05, 0.5);
    group.add(padBig);
  });

  // ── Gold koban coin held at the belly ──
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 28), gold);
  coin.scale.set(1, 1, 0.62);   // oval koban shape
  coin.position.set(-0.3, 0.5, 0.48);
  coin.rotation.x = Math.PI / 2;
  coin.rotation.z = 0.15;
  group.add(coin);
  const coinRim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 8, 28), goldDeep);
  coinRim.scale.set(1, 0.62, 1);
  coinRim.position.set(-0.3, 0.5, 0.515);
  coinRim.rotation.z = 0.15;
  group.add(coinRim);
  // "千万両" style vertical mark on the coin
  const coinMark = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.012), dark);
  coinMark.position.set(-0.3, 0.5, 0.52);
  coinMark.rotation.z = 0.15;
  group.add(coinMark);
  [-0.07, 0.06].forEach(off => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.026, 0.012), dark);
    bar.position.set(-0.3 + off * 0.15, 0.5 + off, 0.52);
    bar.rotation.z = 0.15;
    group.add(bar);
  });

  // ── Tabby-style colour patch on head (a common maneki marking) ──
  const patch = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), goldDeep);
  patch.scale.set(0.9, 0.5, 0.5);
  patch.position.set(-0.12, 1.5, -0.05);
  patch.material = new THREE.MeshStandardMaterial({ color: 0x8e1f18, roughness: 0.46, metalness: 0.05 });
  group.add(patch);

  return group;
}

function addMiniCat(x, y, z) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xc9342c, emissive: 0x7a0d08, emissiveIntensity: 0.18, roughness: 0.45 });
  const cat = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), mat);
  body.position.y = -0.035;
  cat.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), mat);
  head.position.y = 0.035;
  cat.add(head);
  const paw = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.08, 0.025), mat);
  paw.position.set(0.045, 0.03, 0);
  cat.add(paw);
  cat.position.set(x, y, z);
  scene.add(cat);
}

// ── Walking customers ─────────────────────────────────────────────────────────
function buildNekolandCustomers(cx) {
  // The shop now feels lived-in with two customers ordering at the counter and
  // three seated diners. palettes: [coat, pants, skin, hair]

  // ── Standing customers at the counter, facing the cooks (-x) ──
  // Backed off 0.4m from the counter so they stand just outside the front edge.
  const standing = [
    { palette: [0x2f4b5c, 0x20282e, 0xe2b48c, 0x2a1d12], x: cx - 2.9, z: -1.12, h: 0.94 },
    { palette: [0x7e302b, 0x25201d, 0xd9a87a, 0x140e0a], x: cx - 2.9, z:  0.86, h: 0.9 }
  ];
  standing.forEach((s, i) => {
    const person = createPerson(s.palette, s.h);
    const orderProps = addOrderSlip(person, i);
    person.group.position.set(s.x, 0, s.z);
    person.group.rotation.y = -Math.PI / 2;   // face -x toward the counter
    scene.add(person.group);
    addContactShadow(s.x, s.z, 0.46, 0.30, -Math.PI / 2, 0.24);
    nkCustomers.push({ ...person, ...orderProps, kind: 'stand', phase: Math.random() * Math.PI * 2 });
  });

  // ── Seated diners at three tables (thighs horizontal, shins down) ──
  // Each diner now sits squarely on a chair seat (chair seats sit at world
  // ±0.74 from their table centre). Placed ~0.82 out so the chest clears the
  // table edge by >0.15, facing the table. Hips rest at the cushion height.
  // Chair cushion top ≈ y 0.52; hips local y 0.90 → group.y = 0.52 - 0.90*h.
  const seated = [
    // table @ (cx-1.9, 6.2), chairs along x → sit on the -x chair, face +x
    { palette: [0xc4b696, 0x403a32, 0xc78f63, 0x3a2c1e], x: cx - 2.72, z: 6.2,  rotY:  Math.PI / 2, h: 0.96 },
    // table @ (cx+2.1, 2.6), chairs along z → sit on the -z chair, face +z
    { palette: [0x3f6043, 0x252525, 0xe0b48a, 0x241a12], x: cx + 2.1,  z: 1.78, rotY:  0,           h: 0.95 },
    // table @ (cx-1.85, -9.0), chairs along x → sit on the +x chair, face -x
    { palette: [0x6d427a, 0x2d252c, 0xcf9a6e, 0x141014], x: cx - 1.03, z: -9.0, rotY: -Math.PI / 2, h: 0.93 }
  ];
  seated.forEach((s, i) => {
    const person = createPerson(s.palette, s.h);
    const diningProps = addDiningProps(person, i);
    // sit pose
    person.legL.rotation.x = -Math.PI / 2;
    person.legR.rotation.x = -Math.PI / 2;
    person.shinL.rotation.x = Math.PI / 2;
    person.shinR.rotation.x = Math.PI / 2;
    person.armL.rotation.x = 0.28;
    person.armR.rotation.x = 0.36;
    person.armL.rotation.z = -0.05;
    person.armR.rotation.z = 0.05;
    person.foreL.rotation.x = 0.46;
    person.foreR.rotation.x = 0.72;
    person.armL.visible = false;
    person.armR.visible = false;
    person.group.position.set(s.x, 0.52 - 0.90 * s.h, s.z);
    person.group.rotation.y = s.rotY;
    scene.add(person.group);
    addContactShadow(s.x, s.z, 0.52, 0.34, s.rotY, 0.2);
    nkCustomers.push({ ...person, ...diningProps, kind: 'sit', phase: Math.random() * Math.PI * 2 });
  });
}

function addContactShadow(x, z, sx = 0.42, sz = 0.28, rotY = 0, opacity = 0.22) {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 24),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.rotation.z = rotY;
  shadow.scale.set(sx, sz, 1);
  shadow.position.set(x, 0.031, z);
  scene.add(shadow);
  return shadow;
}

function createPerson(palette, scaleH = 1.0) {
  const [coatC, pantsC, skinC, hairC] = palette;
  const coat   = new THREE.MeshStandardMaterial({ color: coatC, emissive: 0x3a1308, emissiveIntensity: 0.08, roughness: 0.74 });
  const coatLo = new THREE.MeshStandardMaterial({ color: shade(coatC, 0.82), emissive: 0x2a1008, emissiveIntensity: 0.06, roughness: 0.76 });
  const pants  = new THREE.MeshStandardMaterial({ color: pantsC, emissive: 0x160804, emissiveIntensity: 0.035, roughness: 0.82 });
  const skin   = new THREE.MeshStandardMaterial({ color: skinC, emissive: 0xff8a4a, emissiveIntensity: 0.055, roughness: 0.58 });
  const hair   = new THREE.MeshStandardMaterial({ color: hairC, emissive: 0x120604, emissiveIntensity: 0.03, roughness: 0.72 });
  const dark   = new THREE.MeshStandardMaterial({ color: 0x241008, emissive: 0x080202, emissiveIntensity: 0.025, roughness: 0.62 });
  const blush  = new THREE.MeshStandardMaterial({ color: 0xf1a088, emissive: 0xff6a4a, emissiveIntensity: 0.04, roughness: 0.56 });
  const shoe   = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.55, metalness: 0.1 });

  const group = new THREE.Group();
  group.scale.setScalar(scaleH);

  // ── Torso: chest + waist taper + collar ──
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.165, 0.30, 6, 14), coat);
  chest.position.y = 1.26;
  chest.scale.set(1, 1, 0.72);
  group.add(chest);
  const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.15, 0.22, 14), coatLo);
  waist.position.y = 1.02;
  waist.scale.set(1, 1, 0.78);
  group.add(waist);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.028, 8, 16), coatLo);
  collar.position.y = 1.44; collar.rotation.x = Math.PI / 2; collar.scale.set(1, 0.7, 1);
  group.add(collar);
  // shoulders
  [-1, 1].forEach(s => {
    const sh = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), coat);
    sh.position.set(s * 0.16, 1.40, 0);
    group.add(sh);
  });
  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.14, 0.18), pants);
  hips.position.y = 0.90;
  group.add(hips);

  // ── Neck + head + face ──
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.10, 10), skin);
  neck.position.y = 1.50;
  group.add(neck);

  const headRig = new THREE.Group();
  headRig.position.y = 1.63;
  group.add(headRig);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 16), skin);
  head.scale.set(0.94, 1.08, 0.96);
  headRig.add(head);
  // ears
  [-1, 1].forEach(s => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), skin);
    ear.scale.set(0.6, 1, 0.5);
    ear.position.set(s * 0.13, -0.01, 0);
    headRig.add(ear);
  });
  const eyes = [];
  const brows = [];
  // Simple rounded face: dark eyes + soft blush, now readable from the aisle.
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), dark);
    eye.scale.set(0.85, 1.1, 0.55);
    eye.position.set(s * 0.055, 0.015, 0.135);
    headRig.add(eye);
    eyes.push(eye);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    glint.position.set(s * 0.049, 0.024, 0.149);
    headRig.add(glint);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.008, 0.008), dark);
    brow.position.set(s * 0.055, 0.054, 0.135);
    brow.rotation.z = s * 0.10;
    headRig.add(brow);
    brows.push(brow);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), blush);
    cheek.scale.set(1.25, 0.72, 0.35);
    cheek.position.set(s * 0.088, -0.030, 0.132);
    headRig.add(cheek);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), skin);
  nose.scale.set(0.85, 1, 0.45);
  nose.position.set(0, -0.010, 0.150);
  headRig.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.010, 0.008), dark);
  mouth.position.set(0, -0.070, 0.148);
  headRig.add(mouth);

  // ── Hair: raised cap + small fringe. Keep it above the eyes so the face reads. ──
  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.44), hair);
  hairCap.position.y = 0.075;
  hairCap.scale.set(1.0, 1.02, 1.02);
  headRig.add(hairCap);
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.032, 0.040), hair);
  fringe.position.set(-0.018, 0.092, 0.118);
  fringe.rotation.x = 0.12;
  headRig.add(fringe);
  [-1, 1].forEach((s) => {
    const sideburn = new THREE.Mesh(new THREE.BoxGeometry(0.030, 0.075, 0.038), hair);
    sideburn.position.set(s * 0.112, 0.015, 0.065);
    sideburn.rotation.z = s * 0.08;
    headRig.add(sideburn);
  });

  // ── Arms: upper + forearm (slight elbow bend) + hand ──
  function makeArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.185, 1.40, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.22, 5, 10), coat);
    upper.position.y = -0.15;
    pivot.add(upper);
    const fore = new THREE.Group();
    fore.position.y = -0.30; fore.rotation.x = 0.25;
    const foreArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.20, 5, 10), coatLo);
    foreArm.position.y = -0.12;
    fore.add(foreArm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skin);
    hand.position.y = -0.26; hand.scale.set(1, 1.1, 0.8);
    fore.add(hand);
    pivot.add(fore);
    pivot.userData.fore = fore;
    pivot.userData.hand = hand;
    group.add(pivot);
    return pivot;
  }
  const armL = makeArm(-1), armR = makeArm(1);
  const foreL = armL.userData.fore, foreR = armR.userData.fore;
  const handL = armL.userData.hand, handR = armR.userData.hand;

  // ── Legs: thigh + shin (knee) + shoe ──
  function makeLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.085, 0.86, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.058, 0.26, 5, 10), pants);
    thigh.position.y = -0.17;
    pivot.add(thigh);
    const shin = new THREE.Group();
    shin.position.y = -0.34;
    const shinM = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.26, 5, 10), pants);
    shinM.position.y = -0.16;
    shin.add(shinM);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.07, 0.24), shoe);
    foot.position.set(0, -0.32, 0.06);
    shin.add(foot);
    const heel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.05, 0.08), shoe);
    heel.position.set(0, -0.30, -0.04);
    shin.add(heel);
    pivot.add(shin);
    pivot.userData.shin = shin;
    group.add(pivot);
    return pivot;
  }
  const legL = makeLeg(-1), legR = makeLeg(1);

  return {
    group,
    armL, armR, foreL, foreR, handL, handR,
    legL, legR, shinL: legL.userData.shin, shinR: legR.userData.shin,
    headRig, head, mouth, eyes, brows,
    skinMat: skin,
    sleeveMat: coatLo
  };
}

function addOrderSlip(person, index = 0) {
  const paper = new THREE.Mesh(
    new THREE.BoxGeometry(0.19, 0.14, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xf7efd9, roughness: 0.82 })
  );
  paper.position.set(0.17, 1.10, 0.32);
  paper.rotation.x = -0.22;
  paper.rotation.z = index === 0 ? -0.10 : 0.08;
  person.group.add(paper);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0x9a2f26 });
  [-0.035, 0.0, 0.035].forEach((y, i) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.12 - i * 0.018, 0.005, 0.012), lineMat);
    line.position.set(0, y, 0.008);
    paper.add(line);
  });

  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.035, 0.09, 12),
    new THREE.MeshStandardMaterial({ color: index === 0 ? 0xded6c2 : 0xb43a2e, roughness: 0.56 })
  );
  cup.position.set(-0.10, 1.02, 0.36);
  person.group.add(cup);

  person.armR.rotation.x = 0.32;
  person.armR.rotation.z = -0.14;
  person.foreR.rotation.x = 0.80;
  person.armL.rotation.x = 0.12;
  return { orderSlip: paper, orderCup: cup };
}

function addDiningProps(person, index = 0) {
  const bowlMat = new THREE.MeshStandardMaterial({ color: 0xf7f0df, roughness: 0.54 });
  const redMat = new THREE.MeshStandardMaterial({ color: 0xa92822, roughness: 0.58 });
  const noodleMat = new THREE.MeshStandardMaterial({ color: 0xf0ce68, roughness: 0.64 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a2d18, roughness: 0.58 });

  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.28), new THREE.MeshStandardMaterial({ color: 0x1e1814, roughness: 0.6 }));
  tray.position.set(0, 1.18, 0.48);
  person.group.add(tray);

  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.09, 0.095, 18), bowlMat);
  bowl.position.set(0, 1.245, 0.48);
  person.group.add(bowl);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.010, 6, 18), redMat);
  rim.position.set(0, 1.295, 0.48);
  rim.rotation.x = Math.PI / 2;
  person.group.add(rim);

  const noodle = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.007, 5, 16), noodleMat);
  noodle.position.set(0, 1.302, 0.48);
  noodle.rotation.x = Math.PI / 2;
  person.group.add(noodle);

  const eatingHand = new THREE.Group();
  eatingHand.position.set(index === 1 ? -0.02 : 0.09, 1.32, 0.43);
  person.group.add(eatingHand);

  const sleeveMat = person.sleeveMat || new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7 });
  const skinMat = person.skinMat || new THREE.MeshStandardMaterial({ color: 0xd8a077, roughness: 0.55 });
  const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.030, 0.24, 5, 10), sleeveMat);
  sleeve.position.set(0.03, -0.10, -0.11);
  sleeve.rotation.x = Math.PI / 2.25;
  sleeve.rotation.z = -0.18;
  eatingHand.add(sleeve);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), skinMat);
  hand.scale.set(1.08, 0.78, 0.95);
  hand.position.set(0.02, -0.02, 0.02);
  eatingHand.add(hand);

  const chopstickGroup = new THREE.Group();
  chopstickGroup.position.set(0.035, 0.045, 0.015);
  chopstickGroup.rotation.x = 0.92;
  chopstickGroup.rotation.z = index === 2 ? -0.38 : -0.25;
  [0, 0.022].forEach((x) => {
    const stick = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.010, 0.30), woodMat);
    stick.position.x = x;
    chopstickGroup.add(stick);
  });
  eatingHand.add(chopstickGroup);

  const liftedNoodles = new THREE.Group();
  liftedNoodles.position.set(0.045, -0.03, 0.055);
  [0, 0.016, -0.016].forEach((x, i) => {
    const strand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.004, 0.004, 0.25 + i * 0.035, 6),
      noodleMat
    );
    strand.position.set(x, -0.13 - i * 0.018, 0.02);
    strand.rotation.x = 0.12 + i * 0.05;
    liftedNoodles.add(strand);
  });
  eatingHand.add(liftedNoodles);

  const supportHand = new THREE.Group();
  supportHand.position.set(-0.11, 1.22, 0.45);
  person.group.add(supportHand);
  const supportSleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.20, 5, 10), sleeveMat);
  supportSleeve.rotation.x = Math.PI / 2.35;
  supportSleeve.rotation.z = 0.25;
  supportSleeve.position.set(-0.02, -0.06, -0.08);
  supportHand.add(supportSleeve);
  const supportPalm = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), skinMat);
  supportPalm.scale.set(1, 0.78, 0.9);
  supportHand.add(supportPalm);

  return {
    diningTray: tray,
    diningBowl: bowl,
    diningNoodle: noodle,
    diningChopsticks: chopstickGroup,
    eatingHand,
    supportHand,
    liftedNoodles
  };
}

// Darken/lighten a hex color by a factor (0..1 darkens, >1 lightens).
function shade(hex, f) {
  const r = clampColor(((hex >> 16) & 255) * f);
  const g = clampColor(((hex >> 8) & 255) * f);
  const b = clampColor((hex & 255) * f);
  return (r << 16) | (g << 8) | b;
}

export function updateNKCustomers(delta) {
  if (S.currentRoom !== 'nekolan') return;
  if (!document.body.classList.contains("mw-room-ready")) return;
  nkFrameIndex = (nkFrameIndex + 1) % 100000;
  nkAnimClock += delta;
  const t = nkAnimClock;
  updateMemoryMarkers(t, nkFrameIndex % NK_PERF.memoryParticleFrameStep === 0);

  // ── Entrance maneki-neko: gentle welcome sway, always facing the doorway. ──
  if (nkLuckyCat) nkLuckyCat.rotation.y = (nkLuckyCat.userData.baseRotationY || 0) + Math.sin(t * 0.75) * 0.08;

  // ── Cooks: looping sin-wave kitchen motions + rising steam ──
  for (const cook of nkCooks) {
    const cookPulse = t + cook.phase;
    if (cook.headRig) {
      cook.headRig.rotation.y = Math.sin(cookPulse * 0.75) * 0.10;
      cook.headRig.rotation.z = Math.sin(cookPulse * 1.15) * 0.035;
    }
    if (cook.mouth) {
      const talking = 1 + Math.abs(Math.sin(cookPulse * 3.1)) * 0.75;
      cook.mouth.scale.z = talking;
      cook.mouth.position.y = -0.075 - (talking - 1) * 0.006;
    }
    if (cook.mode === 'stir') {
      // Cook A: right hand stirs the pot (up/down + small circle)
      cook.armA.rotation.x = Math.sin(t * 3.4 + cook.phase) * 0.45;
      cook.armA.rotation.z = cook.armAz + Math.cos(t * 3.4 + cook.phase) * 0.12;
      cook.armB.rotation.x = Math.sin(t * 1.4 + cook.phase) * 0.08;
    } else {
      // Cook B: both hands assemble a bowl, small alternating up/down
      cook.armA.rotation.x = Math.sin(t * 4.0 + cook.phase) * 0.30;
      cook.armB.rotation.x = Math.sin(t * 4.0 + cook.phase + Math.PI) * 0.30;
    }
    for (const steam of cook.steams) {
      const p = (t * 0.4 + steam.userData.seed) % 1;       // 0..1 rise cycle
      steam.position.y = steam.userData.baseY + p * 0.35;
      steam.material.opacity = 0.22 * (1 - p);              // fade as it rises
    }
  }

  // ── Customers: idle breathing (standing) / eating motion (seated) ──
  for (const c of nkCustomers) {
    c.phase += delta * 2.2;
    const look = Math.sin(c.phase * 0.72);
    if (c.headRig) {
      c.headRig.rotation.y = look * (c.kind === 'sit' ? 0.11 : 0.08);
      c.headRig.rotation.x = (c.kind === 'sit' ? -0.045 : 0.0) + Math.sin(c.phase * 1.15) * 0.025;
    }
    if (c.mouth) {
      const open = c.kind === 'sit'
        ? 0.65 + Math.max(0, Math.sin(c.phase * 1.7)) * 0.55
        : 0.85 + Math.abs(Math.sin(c.phase * 1.25)) * 0.35;
      c.mouth.scale.x = open;
    }
    if (c.brows) {
      c.brows.forEach((brow, i) => {
        brow.rotation.z = (i === 0 ? -0.08 : 0.08) + Math.sin(c.phase * 0.9 + i) * 0.035;
      });
    }
    if (c.kind === 'sit') {
      const eat = Math.max(0, Math.sin(c.phase * 1.55));
      c.armR.rotation.x = 0.34 + eat * 0.18;
      c.armL.rotation.x = 0.28 + Math.sin(c.phase * 1.1 + 1.0) * 0.045;
      if (c.foreR) c.foreR.rotation.x = 0.70 + eat * 0.32;
      if (c.foreL) c.foreL.rotation.x = 0.44 + Math.sin(c.phase * 1.0) * 0.055;
      if (c.eatingHand) {
        c.eatingHand.position.set(
          (c.diningTray?.position.x || 0) + 0.09,
          1.34 + eat * 0.28,
          0.45 - eat * 0.23
        );
        c.eatingHand.rotation.x = -eat * 0.22;
        c.eatingHand.rotation.z = Math.sin(c.phase * 1.2) * 0.035;
      }
      if (c.supportHand) {
        c.supportHand.position.y = 1.21 + Math.sin(c.phase * 0.9) * 0.012;
        c.supportHand.rotation.z = Math.sin(c.phase * 0.8 + 0.4) * 0.05;
      }
      if (c.liftedNoodles) {
        c.liftedNoodles.visible = eat > 0.18;
        c.liftedNoodles.scale.y = 0.72 + eat * 0.55;
      }
      if (c.diningChopsticks) {
        c.diningChopsticks.rotation.x = 0.92 - eat * 0.18;
      }
      if (c.diningNoodle) c.diningNoodle.rotation.z += delta * 0.8;
      c.group.rotation.z = Math.sin(c.phase * 0.6) * 0.02;
    } else {
      // standing: subtle weight shift + arm sway while ordering
      const idle = Math.sin(c.phase) * 0.06;
      c.armL.rotation.x = idle;
      c.armR.rotation.x = 0.30 - idle * 0.6;
      if (c.foreR) c.foreR.rotation.x = 0.78 + Math.sin(c.phase * 1.4) * 0.10;
      if (c.foreL) c.foreL.rotation.x = 0.22 + Math.sin(c.phase * 0.9 + 1.2) * 0.05;
      if (c.orderSlip) c.orderSlip.rotation.z = Math.sin(c.phase * 1.25) * 0.055;
      if (c.orderCup) c.orderCup.rotation.z = Math.sin(c.phase * 0.8) * 0.04;
      c.group.position.y = Math.abs(Math.sin(c.phase * 0.5)) * 0.015;
    }
  }
}

function updateMemoryMarkers(t, updateParticles = true) {
  const memoryPhase = 1 - (S.dnPhase ?? 1);
  for (const marker of nkMemoryMarkers) {
    const pulse = 0.5 + Math.sin(t * 2.1 + marker.phase) * 0.5;
    if (marker.kind === 'beacon') {
      marker.glow.material.opacity = marker.baseOpacity + marker.memoryOpacity * memoryPhase + pulse * 0.035;
      marker.ring.material.opacity = 0.22 + memoryPhase * 0.42 + pulse * 0.12;
      marker.ring.scale.setScalar(1 + pulse * 0.055);
      if (marker.pillar) marker.pillar.material.opacity = 0.045 + memoryPhase * 0.11 + pulse * 0.025;
      if (marker.particles && updateParticles) {
        const { mesh, positions, data } = marker.particles;
        data.forEach((p, i) => {
          const drift = t * (0.22 + i * 0.006) + marker.phase + i;
          positions[i * 3] = marker.glow.position.x + Math.cos(drift) * p.radius;
          positions[i * 3 + 1] = p.baseY + Math.sin(t * 1.4 + i) * 0.04;
          positions[i * 3 + 2] = marker.glow.position.z + Math.sin(drift) * p.radius;
        });
        mesh.geometry.attributes.position.needsUpdate = true;
        mesh.material.opacity = 0.22 + memoryPhase * 0.36 + pulse * 0.08;
      }
    } else if (marker.kind === 'note') {
      marker.mesh.material.opacity = marker.baseOpacity + marker.memoryOpacity * memoryPhase;
      marker.mesh.position.y = marker.baseY + Math.sin(t * 1.2 + marker.phase) * 0.012;
    }
  }
}

function makeMenuBoardTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 940, 236);
  ctx.lineWidth = 4;
  [86, 166].forEach(y => {
    ctx.beginPath(); ctx.moveTo(16, y); ctx.lineTo(944, y); ctx.stroke();
  });
  ctx.beginPath(); ctx.moveTo(560, 16); ctx.lineTo(560, 240); ctx.stroke();
  ctx.fillStyle = '#c83228';
  ctx.font = '700 42px Arial, sans-serif';
  ctx.fillText('Matcha', 42, 62);
  ctx.fillText('Cocktails', 42, 144);
  ctx.fillText('Soft serve', 42, 222);
  ctx.font = '700 34px Arial, sans-serif';
  ctx.fillText('抹茶', 320, 62);
  ctx.fillText('カクテル', 320, 144);
  ctx.fillText('ソフトクリーム', 300, 222);
  ctx.font = '700 34px Arial, sans-serif';
  ctx.fillText('Coffee', 610, 62);
  ctx.fillText('Draft beer', 610, 144);
  ctx.fillText('Dessert', 610, 222);
  ctx.fillText('コーヒー', 790, 62);
  ctx.fillText('生ビール', 790, 144);
  ctx.fillText('デザート', 790, 222);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeNeonText(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.font = '700 58px Arial, sans-serif';
  ctx.fillStyle = '#ff5348';
  ctx.shadowColor = '#ff2a20';
  ctx.shadowBlur = 22;
  text.split('\\n').forEach((line, i) => ctx.fillText(line, 256, 95 + i * 66));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 0.8),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
}

// ── Texture generators ────────────────────────────────────────────────────────
function makeNKWoodFloor() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6b4a2b'; ctx.fillRect(0, 0, 512, 512);
  const planks = 8, pw = 512 / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    const d = (Math.random() - 0.5) * 0.22;
    ctx.fillStyle = d > 0 ? `rgba(255,200,120,${d})` : `rgba(0,0,0,${-d})`;
    ctx.fillRect(x, 0, pw, 512);
    ctx.strokeStyle = 'rgba(28,12,2,0.65)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    for (let g = 0; g < 14; g++) {
      const gy = Math.random() * 512, al = 0.04 + Math.random() * 0.07;
      ctx.strokeStyle = Math.random() > 0.5 ? `rgba(190,140,75,${al * 1.6})` : `rgba(20,6,0,${al * 1.6})`;
      ctx.lineWidth = Math.random() * 1.5 + 0.3;
      ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + pw, gy + (Math.random() - 0.5) * 8); ctx.stroke();
    }
  }
  const img = ctx.getImageData(0, 0, 512, 512); const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    px[i] = clampColor(px[i] + n); px[i+1] = clampColor(px[i+1] + n * 0.85); px[i+2] = clampColor(px[i+2] + n * 0.6);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 9);
  return tex;
}

function makeNKTileFloor() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#bab2a2'; ctx.fillRect(0, 0, 512, 512);
  const tSize = 122, gap = 5;
  for (let ty = 0; ty < 512; ty += tSize) {
    for (let tx = 0; tx < 512; tx += tSize) {
      const l = 0.92 + (Math.random() - 0.5) * 0.09;
      const r = Math.round(232 * l), g2 = Math.round(224 * l), b = Math.round(210 * l);
      ctx.fillStyle = `rgb(${r},${g2},${b})`;
      ctx.fillRect(tx + gap / 2, ty + gap / 2, tSize - gap, tSize - gap);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3);
  return tex;
}

function makeNKConcreteFloor() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ccc8be'; ctx.fillRect(0, 0, 512, 512);
  const tSize = 256, gap = 7;
  for (let ty = 0; ty < 512; ty += tSize) {
    for (let tx = 0; tx < 512; tx += tSize) {
      const l = 0.90 + (Math.random() - 0.5) * 0.10;
      const v = Math.round(204 * l);
      ctx.fillStyle = `rgb(${v+4},${v},${v-4})`;
      ctx.fillRect(tx + gap / 2, ty + gap / 2, tSize - gap, tSize - gap);
      ctx.strokeStyle = 'rgba(90,86,78,0.55)'; ctx.lineWidth = gap;
      ctx.strokeRect(tx + gap / 2, ty + gap / 2, tSize - gap, tSize - gap);
    }
  }
  const img = ctx.getImageData(0, 0, 512, 512); const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 20;
    px[i] = clampColor(px[i] + n); px[i+1] = clampColor(px[i+1] + n); px[i+2] = clampColor(px[i+2] + n);
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 4);
  return tex;
}

function makeNKWoodWallTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6a4930'; ctx.fillRect(0, 0, 256, 512);
  const planks = 6, pw2 = 256 / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * pw2;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(150,104,58,0.2)' : 'rgba(30,14,4,0.16)';
    ctx.fillRect(x, 0, pw2, 512);
    for (let g = 0; g < 20; g++) {
      const gx = x + Math.random() * pw2;
      ctx.strokeStyle = `rgba(45,22,8,${0.04 + Math.random() * 0.08})`; ctx.lineWidth = Math.random() * 1.2 + 0.2;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx + (Math.random() - 0.5) * 4, 512); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(18,7,1,0.58)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 2);
  return tex;
}

function makeNKWhiteTileWall() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9a9690'; ctx.fillRect(0, 0, 512, 512);
  const tW = 100, tH = 60, gap2 = 6;
  for (let ty = 0; ty < 512 + tH; ty += tH + gap2) {
    const rowOff = Math.floor(ty / (tH + gap2)) % 2 === 0 ? 0 : (tW + gap2) / 2;
    for (let tx = -(tW / 2); tx < 512 + tW; tx += tW + gap2) {
      const l = 0.94 + (Math.random() - 0.5) * 0.05;
      const v2 = Math.round(242 * l);
      ctx.fillStyle = `rgb(${v2},${v2-2},${v2-5})`;
      ctx.fillRect(tx + rowOff + gap2 / 2, ty + gap2 / 2, tW - gap2, tH - gap2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4);
  return tex;
}

function makeNKHorizWoodWall() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e8e0d4'; ctx.fillRect(0, 0, 512, 256);
  const boardH = 32, gap3 = 3;
  for (let y = 0; y < 256; y += boardH + gap3) {
    const l = 0.88 + (Math.random() - 0.5) * 0.12;
    const r = Math.round(240 * l), g3 = Math.round(232 * l), b3 = Math.round(218 * l);
    ctx.fillStyle = `rgb(${r},${g3},${b3})`;
    ctx.fillRect(0, y + gap3 / 2, 512, boardH - gap3);
    for (let gn = 0; gn < 8; gn++) {
      const gy2 = y + gap3 / 2 + Math.random() * (boardH - gap3);
      ctx.strokeStyle = `rgba(155,135,108,${0.05 + Math.random() * 0.08})`; ctx.lineWidth = Math.random() * 1.2 + 0.3;
      ctx.beginPath(); ctx.moveTo(0, gy2); ctx.lineTo(512, gy2 + (Math.random() - 0.5) * 3); ctx.stroke();
    }
    if (Math.random() > 0.7) {
      ctx.strokeStyle = `rgba(120,100,78,${0.06 + Math.random() * 0.05})`; ctx.lineWidth = Math.random() * 2 + 0.5;
      const sx = Math.random() * 512;
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(sx + (Math.random() - 0.5) * 18, y + boardH); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(100,88,70,0.40)'; ctx.lineWidth = gap3;
    ctx.beginPath(); ctx.moveTo(0, y + gap3 / 2); ctx.lineTo(512, y + gap3 / 2); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3);
  return tex;
}

function makeNKStoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#cac4b6'; ctx.fillRect(0, 0, 512, 512);
  const rows = 7, rowH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    let x = r % 2 === 0 ? 0 : 50 + Math.random() * 30;
    while (x < 512) {
      const bw = 80 + (Math.random() - 0.5) * 30;
      const bh = rowH - 4;
      const l = 0.88 + (Math.random() - 0.5) * 0.12;
      const rv = Math.round(202 * l), gv = Math.round(196 * l), bv = Math.round(182 * l);
      ctx.fillStyle = `rgb(${rv},${gv},${bv})`;
      ctx.fillRect(x + 2, y + 2, bw - 4, bh);
      ctx.strokeStyle = 'rgba(80,72,58,0.55)'; ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, bw - 4, bh);
      x += bw;
    }
  }
  const img2 = ctx.getImageData(0, 0, 512, 512); const px2 = img2.data;
  for (let i = 0; i < px2.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    px2[i] = clampColor(px2[i] + n); px2[i+1] = clampColor(px2[i+1] + n); px2[i+2] = clampColor(px2[i+2] + n);
  }
  ctx.putImageData(img2, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
  return tex;
}
