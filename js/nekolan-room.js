// ─── Nekoland Room — Build functions & textures ───────────────────────────────

import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import {
  scene,
  NL_CX, NL_W, NL_D,
  nkSceneLights, nkInteractables,
  S
} from "./state.js";

// ── Utility ───────────────────────────────────────────────────────────────────
function clampColor(v) { return Math.max(0, Math.min(255, v)); }

// ── NK Entry Door (Rain Room left wall → Nekolan) ─────────────────────────────
export function buildNKEntryDoor() {
  const ROOM_W = 11;
  const doorX = -ROOM_W / 2 + 0.05;
  const doorZ = 2.6;

  S.nkEntryDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 2.15),
    new THREE.MeshBasicMaterial({ color: 0x1a0c06 })
  );
  S.nkEntryDoor.rotation.y = Math.PI / 2;
  S.nkEntryDoor.position.set(doorX, 1.08, doorZ);
  scene.add(S.nkEntryDoor);

  S.nkEntryGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2.7),
    new THREE.MeshBasicMaterial({ color: 0xc83020, transparent: true, opacity: 0.16, depthWrite: false })
  );
  S.nkEntryGlow.rotation.y = Math.PI / 2;
  S.nkEntryGlow.position.set(doorX + 0.01, 1.2, doorZ);
  scene.add(S.nkEntryGlow);

  const fMat = new THREE.MeshStandardMaterial({ color: 0x4a1a0a, roughness: 0.7, metalness: 0.2 });
  const fw = 0.04, doorW = 1.05, doorH = 2.15;
  [new THREE.BoxGeometry(doorW + fw * 2, fw, 0.02), new THREE.BoxGeometry(doorW + fw * 2, fw, 0.02)].forEach((geo, i) => {
    const m = new THREE.Mesh(geo, fMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(doorX, i === 0 ? 1.08 + doorH / 2 + fw / 2 : 1.08 - doorH / 2 - fw / 2, doorZ);
    scene.add(m);
  });
  [new THREE.BoxGeometry(fw, doorH, 0.02), new THREE.BoxGeometry(fw, doorH, 0.02)].forEach((geo, i) => {
    const m = new THREE.Mesh(geo, fMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(doorX, 1.08, i === 0 ? doorZ - doorW / 2 - fw / 2 : doorZ + doorW / 2 + fw / 2);
    scene.add(m);
  });

  S.nkEntrySpot = new THREE.SpotLight(0xff6030, 2.0, 7, Math.PI / 4.5, 0.72, 1.25);
  S.nkEntrySpot.position.set(doorX + 1.8, 2.6, doorZ);
  const nkT = new THREE.Object3D();
  nkT.position.set(doorX, 1.08, doorZ);
  scene.add(nkT);
  S.nkEntrySpot.target = nkT;
  scene.add(S.nkEntrySpot);

  const signCanvas = document.createElement('canvas');
  signCanvas.width = 400; signCanvas.height = 100;
  const sc = signCanvas.getContext('2d');
  sc.clearRect(0, 0, 400, 100);
  sc.font = 'bold 52px Georgia, serif';
  sc.fillStyle = '#ff3a3a';
  sc.shadowColor = '#ff3a3a';
  sc.shadowBlur = 22;
  sc.textAlign = 'center';
  sc.fillText('Nekoland', 200, 70);
  const signTex = new THREE.CanvasTexture(signCanvas);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.14),
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true })
  );
  sign.rotation.y = Math.PI / 2;
  sign.position.set(doorX + 0.02, 1.08 + doorH / 2 + 0.14, doorZ);
  scene.add(sign);

  S.nkEntryDoorObj = { position: S.nkEntryDoor.position, type: 'nkEntry' };
}

// ── Nekoland Room (Three-Section Ramen Shop) ──────────────────────────────────
export function buildNekolandRoom() {
  const cx = NL_CX;

  // Section geometry
  const zA = { front: 12, back: 3,   h: 3.2 };
  const zB = { front:  3, back: -3,  h: 3.0 };
  const zC = { front: -3, back: -12, h: 3.8 };

  // ── FLOORS ────────────────────────────────────────────────────────────────────
  [
    [makeNKWoodFloor(),     zA, 0.42, 0.08],
    [makeNKTileFloor(),     zB, 0.55, 0.10],
    [makeNKConcreteFloor(), zC, 0.85, 0.00]
  ].forEach(([tex, sect, rough, metal]) => {
    const len = sect.front - sect.back;
    const f = new THREE.Mesh(
      new THREE.PlaneGeometry(NL_W, len),
      new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal })
    );
    f.rotation.x = -Math.PI / 2;
    f.position.set(cx, 0, (sect.front + sect.back) / 2);
    scene.add(f);
  });

  // ── CEILINGS ──────────────────────────────────────────────────────────────────
  [[zA, 0xf0e8dc], [zB, 0xece4d8]].forEach(([sect, col]) => {
    const c = new THREE.Mesh(
      new THREE.PlaneGeometry(NL_W, sect.front - sect.back),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.92 })
    );
    c.rotation.x = Math.PI / 2;
    c.position.set(cx, sect.h, (sect.front + sect.back) / 2);
    scene.add(c);
  });

  // Section C: corrugated iron strips
  const ironMat = new THREE.MeshStandardMaterial({ color: 0xe2ddd4, roughness: 0.50, metalness: 0.42 });
  const stripD = 0.30, stripStep = 0.38;
  for (let z = zC.front - stripD / 2; z > zC.back + stripD / 2; z -= stripStep) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(NL_W + 0.6, 0.055, stripD), ironMat);
    strip.position.set(cx, zC.h - 0.028, z);
    scene.add(strip);
  }

  // ── WALLS ─────────────────────────────────────────────────────────────────────
  const woodMat  = new THREE.MeshStandardMaterial({ map: makeNKWoodWallTexture(),   roughness: 0.86 });
  const tileMat  = new THREE.MeshStandardMaterial({ map: makeNKWhiteTileWall(),     roughness: 0.72, metalness: 0.08 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: makeNKStoneTexture(),      roughness: 0.93 });
  const hWoodMat = new THREE.MeshStandardMaterial({ map: makeNKHorizWoodWall(),     roughness: 0.88 });

  // Front wall (entrance, z=12)
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(NL_W, zA.h),
    new THREE.MeshStandardMaterial({ color: 0xf4ede0, roughness: 0.90 })
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
  const bMat = new THREE.MeshStandardMaterial({ color: 0x2a1808, roughness: 0.9 });
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

  // ── SECTION A LIGHTING: Wood lattice indirect ─────────────────────────────────
  const latMat  = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.88 });
  const latticeZ = 6.5;

  [-1.5, 1.5].forEach(lx => {
    const lat = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 5.0), latMat);
    lat.position.set(cx + lx, zA.h - 0.04, latticeZ);
    scene.add(lat);
  });

  const eStrip = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.025, 5.0),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffd9a0, emissiveIntensity: 1.3 })
  );
  eStrip.position.set(cx, zA.h - 0.036, latticeZ);
  scene.add(eStrip);

  [-1.8, 0, 1.8].forEach(dz => {
    const pl = new THREE.PointLight(0xffd9a0, dz === 0 ? 2.2 : 1.1, 5.0, 1.6);
    pl.position.set(cx, zA.h - 0.14, latticeZ + dz);
    scene.add(pl);
    nkSceneLights.push({ light: pl, onIntensity: dz === 0 ? 2.2 : 1.1 });
  });

  // 行灯 wall lantern
  const llMat = new THREE.MeshStandardMaterial({
    color: 0xf4ede0, emissive: 0xffd9a0, emissiveIntensity: 0.95, roughness: 0.85
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

  const llPt = new THREE.PointLight(0xffc870, 0.55, 2.8, 1.5);
  llPt.position.set(cx + NL_W / 2 - 0.24, 0.62, 8.0);
  scene.add(llPt);
  nkSceneLights.push({ light: llPt, onIntensity: 0.55 });

  // ── SECTION B LIGHTING ────────────────────────────────────────────────────────

  // Noren curtain
  const noC = document.createElement('canvas');
  noC.width = 512; noC.height = 256;
  const noCtx = noC.getContext('2d');
  noCtx.fillStyle = '#2a3a58'; noCtx.fillRect(0, 0, 512, 256);
  noCtx.strokeStyle = 'rgba(255,255,255,0.18)'; noCtx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 102) { noCtx.beginPath(); noCtx.moveTo(x, 0); noCtx.lineTo(x, 256); noCtx.stroke(); }
  noCtx.font = '700 72px serif'; noCtx.fillStyle = '#ffffff';
  noCtx.shadowColor = 'rgba(255,255,255,0.5)'; noCtx.shadowBlur = 8;
  noCtx.textAlign = 'center'; noCtx.fillText('招き猫', 256, 162);
  const noren = new THREE.Mesh(
    new THREE.PlaneGeometry(NL_W - 0.4, 0.58),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(noC), side: THREE.DoubleSide, roughness: 0.92 })
  );
  noren.position.set(cx, 2.44, 0);
  scene.add(noren);

  // Emissive strip above noren
  const norenStrip = new THREE.Mesh(
    new THREE.BoxGeometry(NL_W - 0.3, 0.055, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffd9a0, emissiveIntensity: 1.8 })
  );
  norenStrip.position.set(cx, 2.74, 0.04);
  scene.add(norenStrip);
  const norenPt = new THREE.PointLight(0xffd9a0, 0.65, 3.5, 1.5);
  norenPt.position.set(cx, 2.74, 0.04);
  scene.add(norenPt);
  nkSceneLights.push({ light: norenPt, onIntensity: 0.65 });

  // Red LED strip (strictly inside Section B, length 5.6)
  const ledLen = 5.6;
  const ledStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.04, ledLen),
    new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.5 })
  );
  ledStrip.position.set(cx + NL_W / 2 - 0.02, 2.88, 0);
  scene.add(ledStrip);
  const ledPt = new THREE.PointLight(0xff3a20, 0.65, 2.6, 1.5);
  ledPt.position.set(cx + NL_W / 2 - 0.15, 2.80, 0);
  scene.add(ledPt);
  nkSceneLights.push({ light: ledPt, onIntensity: 0.72 });

  // Placeholder fill (menu lightbox area)
  const menuFill = new THREE.PointLight(0xffeedd, 0.80, 3.5, 1.5);
  menuFill.position.set(cx, 2.8, -2);
  scene.add(menuFill);
  nkSceneLights.push({ light: menuFill, onIntensity: 0.80 });

  // ── SECTION C LIGHTING: Lanterns + string lights ──────────────────────────────

  // Red paper lanterns × 3
  [-4, -7, -10].forEach(z => {
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
    const lanPt = new THREE.PointLight(0xffaa50, 0.60, 3.0, 1.5);
    lanPt.position.set(lx, lanY, z);
    scene.add(lanPt);
    nkSceneLights.push({ light: lanPt, onIntensity: 0.60 });
  });

  // Bare-bulb string lights × 7
  const bulbPositions = [
    [cx - 1.7, -4.6], [cx + 1.1, -5.5], [cx - 0.3, -6.5],
    [cx + 1.6, -7.4], [cx - 1.0, -8.3], [cx + 0.4, -9.2], [cx - 1.4, -10.6]
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
    const bPt = new THREE.PointLight(0xffc870, 0.42, 2.4, 1.6);
    bPt.position.set(bx, by, bz);
    scene.add(bPt);
    nkSceneLights.push({ light: bPt, onIntensity: 0.42 });
  });

  // RectAreaLight for neon glow on back wall
  const neonRect = new THREE.RectAreaLight(0xff3a3a, 4, 1.5, 0.4);
  neonRect.position.set(cx, 2.3, -11.8);
  neonRect.lookAt(cx, 2.3, -11.0);
  scene.add(neonRect);
  nkSceneLights.push({ light: neonRect, onIntensity: 4 });

  // Warm fill for back wall stone texture visibility
  const backWallFill = new THREE.PointLight(0xffd9a0, 0.55, 3.8, 1.5);
  backWallFill.position.set(cx, 1.8, -11.4);
  scene.add(backWallFill);
  nkSceneLights.push({ light: backWallFill, onIntensity: 0.55 });

  // ── INTERACTABLE PLACEHOLDER OBJECTS ──────────────────────────────────────────

  // 1. 大紅貓 (Section C — Stage 3)
  const catMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 2.4, 0.9),
    new THREE.MeshStandardMaterial({ color: 0xc8342a, emissive: 0xc8342a, emissiveIntensity: 0.30, roughness: 0.62 })
  );
  catMesh.position.set(cx - 1.2, 1.2, -8);
  scene.add(catMesh);
  catMesh.userData = { data: {
    title: "The Big Cat",
    memory: "It stood there every single shift. Good fortune for the restaurant, they said.",
    camera: "—", film: "—", note: "Stage 3 — full model coming"
  }};
  nkInteractables.push(catMesh);

  // 2. 菜單燈箱 (Section B — Stage 2)
  const menuRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.25, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.5, metalness: 0.6 })
  );
  menuRod.position.set(cx, 2.5 + 0.7 / 2 + 0.125, -2);
  scene.add(menuRod);
  const menuMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.7, 0.2),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0.80, roughness: 0.4 })
  );
  menuMesh.position.set(cx, 2.5, -2);
  scene.add(menuMesh);
  menuMesh.userData = { data: {
    title: "Six Words",
    memory: "Matcha. Tsukemen. Draft beer. That was the whole menu once.",
    camera: "—", film: "—", note: "Stage 2 — full lightbox coming"
  }};
  nkInteractables.push(menuMesh);

  // 3. 吧台 (Section B left wall — Stage 2)
  const barMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.90, 1.10, 6.0),
    new THREE.MeshStandardMaterial({ color: 0x5a3a1f, roughness: 0.78 })
  );
  barMesh.position.set(cx - NL_W / 2 + 0.50, 0.55, -1);
  scene.add(barMesh);
  barMesh.userData = { data: {
    title: "Behind the Counter",
    memory: "Five hours on your feet and the ramen still sold out. Every time.",
    camera: "—", film: "—", note: "Stage 2 — full bar coming"
  }};
  nkInteractables.push(barMesh);

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
  ctx.fillStyle = '#4a3220'; ctx.fillRect(0, 0, 256, 512);
  const planks = 6, pw2 = 256 / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * pw2;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(90,58,30,0.18)' : 'rgba(18,6,1,0.22)';
    ctx.fillRect(x, 0, pw2, 512);
    for (let g = 0; g < 20; g++) {
      const gx = x + Math.random() * pw2;
      ctx.strokeStyle = `rgba(28,12,2,${0.05 + Math.random() * 0.09})`; ctx.lineWidth = Math.random() * 1.2 + 0.2;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx + (Math.random() - 0.5) * 4, 512); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(8,2,0,0.70)'; ctx.lineWidth = 2.5;
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
