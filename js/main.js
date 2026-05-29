import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const photos = [
  {
    title: "Rain After Closing",
    memory: "The street looked empty, but the light made it feel remembered.",
    camera: "Rangefinder placeholder",
    film: "Tungsten film placeholder",
    note: "Shot on film - night walk",
    image: "assets/images/IMG_9638拷貝.JPG",
    tint: { r: 0.18, g: 0.24, b: 0.34 }
  },
  {
    title: "A Corner Store at 2AM",
    memory: "Some places only feel real after midnight.",
    camera: "Rangefinder placeholder",
    film: "Daylight film placeholder",
    note: "Available light",
    image: "assets/images/IMG_9652拷貝.JPG",
    tint: { r: 0.4, g: 0.3, b: 0.14 }
  },
  {
    title: "Taipei After Rain",
    memory: "The reflection was clearer than the street itself.",
    camera: "Rangefinder placeholder",
    film: "Tungsten film placeholder",
    note: "Wet pavement",
    image: "assets/images/mel2拷貝.jpg",
    tint: { r: 0.12, g: 0.18, b: 0.28 }
  },
  {
    title: "Someone Left the Light On",
    memory: "I do not remember the conversation, only the colour of the room.",
    camera: "Rangefinder placeholder",
    film: "Tungsten film placeholder",
    note: "Window glow",
    image: "assets/images/IMG_9654拷貝.JPG",
    tint: { r: 0.34, g: 0.22, b: 0.12 }
  }
];

const ROOM_W = 15;
const ROOM_D = 22;
const ROOM_H = 4.2;
const PHOTO_W = 1.55;
const PHOTO_H = 1.16;
const INTERACT_DIST = 2.6;
const DOOR_DIST = 2.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x03050a);
scene.fog = new THREE.FogExp2(0x04060a, 0.04);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 80);
camera.position.set(0, 1.6, -4);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("mw-canvas"),
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.42;
renderer.outputColorSpace = THREE.SRGBColorSpace;

let ambientLight = new THREE.AmbientLight(0x1c2028, 0.78);
scene.add(ambientLight);
let hemiLight = new THREE.HemisphereLight(0x2a3448, 0x12100c, 0.28);
scene.add(hemiLight);

const photoMeshes = [];
const textureLoader = new THREE.TextureLoader();
const keys = { w: false, a: false, s: false, d: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const colorTarget = new THREE.Color();
let velocityY = 0;
let canJump = true;
let nearestTarget = null;
let previousTime = performance.now();
let doorway;
let doorGlow;
let doorSpot;
let doorObj;
let heldGroup;
let bobTime = 0;
let heldMapEnabled = true;

// Light toggle system
const sceneLights = [];   // { light, onIntensity }
let lightsOn = true;

const GRAVITY = 24;
const JUMP_FORCE = 6.2;
const GROUND_Y = 1.6;

const startOverlay = document.querySelector("[data-start-overlay]");
const detailPanel = document.querySelector("[data-detail-panel]");
const promptEl = document.querySelector("[data-prompt]");
const enterButton = document.querySelector("[data-enter-room]");
const closeButton = document.querySelector("[data-close-panel]");
const panel = {
  section: document.querySelector("[data-panel-section]"),
  title: document.querySelector("[data-panel-title]"),
  memory: document.querySelector("[data-panel-memory]"),
  camera: document.querySelector("[data-panel-camera]"),
  film: document.querySelector("[data-panel-film]"),
  note: document.querySelector("[data-panel-note]")
};

const controls = new PointerLockControls(camera, document.body);

buildRoom();
buildCeilingLight();
buildPhotos();
buildFloorGlows();
buildDoorway();
buildPendantLight();
buildBench();
buildFloorDecals();
buildHeldMap();
const dust = buildDust();
bindEvents();
animate();

function buildRoom() {
  const floorTex = makeFloorTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ map: floorTex, color: 0xffffff, roughness: 0.42, metalness: 0.28 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ color: 0x11100f, roughness: 0.92 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_H;
  scene.add(ceiling);

  const wallTex = makeWallTexture();
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xffffff, roughness: 0.88, metalness: 0.02 });

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

  // Baseboards — thin strip at wall/floor junction
  const baseH = 0.055;
  const baseD = 0.022;
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

function buildCeilingLight() {
  // Track rail — dark metal bar mounted to ceiling
  const railMat = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.35, metalness: 0.8 });
  const rail = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.055, 0.07), railMat);
  rail.position.set(0, ROOM_H - 0.03, -2);
  scene.add(rail);

  // Three track-head positions along the rail
  const headXs = [-2, 0, 2];
  const headMat = new THREE.MeshStandardMaterial({ color: 0x242018, roughness: 0.3, metalness: 0.85 });

  headXs.forEach((x) => {
    // Head body (small cylinder tilted slightly toward back wall)
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.2, 14), headMat);
    head.position.set(x, ROOM_H - 0.18, -2);
    head.rotation.z = 0.18;
    scene.add(head);

    // Hot-spot glow disc inside cone
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.062, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.95, depthWrite: false })
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(x, ROOM_H - 0.3, -2);
    scene.add(glow);

    // Individual spot from each head — aimed at floor/photos
    const spot = new THREE.SpotLight(0xffc890, 9, 18, Math.PI / 4.5, 0.55, 0.85);
    spot.position.set(x, ROOM_H - 0.22, -2);
    const t = new THREE.Object3D();
    t.position.set(x * 0.4, 0, -ROOM_D / 2 + 3);
    scene.add(t);
    spot.target = t;
    scene.add(spot);
    sceneLights.push({ light: spot, onIntensity: 9 });
  });

  // Ambient fill — very faint cool point from opposite end to break monotone warmth
  const coolFill = new THREE.PointLight(0xb8c8d8, 0.55, 20, 1.6);
  coolFill.position.set(0, ROOM_H - 0.5, ROOM_D / 2 - 1);
  scene.add(coolFill);
  sceneLights.push({ light: coolFill, onIntensity: 0.55 });

  // Wall-wash lights — graze the textured walls to show material
  const washMat = 0xffe6b8;
  const washDecay = 1.9;

  [
    new THREE.Vector3(-ROOM_W / 2 + 0.4, 3.0, -3),
    new THREE.Vector3(-ROOM_W / 2 + 0.4, 3.0,  1),
    new THREE.Vector3( ROOM_W / 2 - 0.4, 3.0, -3),
    new THREE.Vector3( ROOM_W / 2 - 0.4, 3.0,  1),
  ].forEach((pos) => {
    const w = new THREE.PointLight(washMat, 1.4, 7, washDecay);
    w.position.copy(pos);
    scene.add(w);
    sceneLights.push({ light: w, onIntensity: 1.4 });
  });

  // Back-wall wash — illuminate the photos' backdrop
  const backWash = new THREE.PointLight(0xffd8a0, 1.8, 9, 1.7);
  backWash.position.set(0, 3.4, -ROOM_D / 2 + 1.2);
  scene.add(backWash);
  sceneLights.push({ light: backWash, onIntensity: 1.8 });

  // Back-corner fill — stop corners going pitch black
  [[-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const corner = new THREE.PointLight(0xffe0b0, 0.9, 10, 2.0);
    corner.position.set(sx * (ROOM_W / 2 - 0.8), 2.6, sz * (ROOM_D / 2 - 1.2));
    scene.add(corner);
    sceneLights.push({ light: corner, onIntensity: 0.9 });
  });

  // Front-area ambient fill — entrance zone
  const frontFill = new THREE.PointLight(0xfff0d8, 0.7, 12, 1.8);
  frontFill.position.set(0, 3.0, ROOM_D / 2 - 2);
  scene.add(frontFill);
  sceneLights.push({ light: frontFill, onIntensity: 0.7 });
}

function buildPhotos() {
  // Back wall — main visual, 1.5× centred
  createPhoto(photos[0], new THREE.Vector3(0, 2.0, -ROOM_D / 2 + 0.06), 0, 1.5);

  // Left wall — two photos, heights staggered
  createPhoto(photos[2], new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.15, -4.5), Math.PI / 2);
  createPhoto(photos[3], new THREE.Vector3(-ROOM_W / 2 + 0.06, 1.35, -1.0), Math.PI / 2);

  // Right wall — lone photo with breathing room
  createPhoto(photos[1], new THREE.Vector3(ROOM_W / 2 - 0.06, 1.65, -2.5), -Math.PI / 2);
}

function buildFloorGlows() {
  // Positions match the four photos in buildPhotos()
  const glowPositions = [
    { x: 0,               z: -ROOM_D / 2 + 0.06 },  // photos[0] back wall main visual
    { x: -ROOM_W / 2 + 0.06, z: -4.5 },             // photos[2] left wall upper
    { x: -ROOM_W / 2 + 0.06, z: -1.0 },             // photos[3] left wall lower
    { x:  ROOM_W / 2 - 0.06, z: -2.5 }              // photos[1] right wall
  ];

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0,    "rgba(255,210,150,0.18)");
  grad.addColorStop(0.45, "rgba(255,190,100,0.07)");
  grad.addColorStop(1,    "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(canvas);

  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  for (const p of glowPositions) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), glowMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, 0.005, p.z);
    scene.add(mesh);
  }
}

function buildPendantLight() {
  const PX = 0, PZ = 0.5;
  const hangY = ROOM_H - 1.5;   // 2.7m from floor
  const wireLen = ROOM_H - 0.06 - hangY;

  const metalMat = new THREE.MeshStandardMaterial({ color: 0x1a1814, roughness: 0.22, metalness: 0.92 });

  // Suspension rod from ceiling plate
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16), metalMat);
  plate.position.set(PX, ROOM_H - 0.05, PZ);
  scene.add(plate);

  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, wireLen, 8), metalMat);
  rod.position.set(PX, ROOM_H - 0.06 - wireLen / 2, PZ);
  scene.add(rod);

  // Outer ring — main artistic statement
  const outerRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.018, 14, 72), metalMat);
  outerRing.rotation.x = Math.PI / 2;
  outerRing.position.set(PX, hangY, PZ);
  scene.add(outerRing);

  // Inner ring
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.011, 10, 56), metalMat);
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.set(PX, hangY, PZ);
  scene.add(innerRing);

  // 3 thin suspension wires ceiling → outer ring edge
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const wx = PX + Math.cos(angle) * 0.58;
    const wz = PZ + Math.sin(angle) * 0.58;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, wireLen, 4), metalMat);
    wire.position.set(wx, hangY + wireLen / 2, wz);
    scene.add(wire);
  }

  // 4 radial spokes — inner ring to outer ring
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const spokeLen = 0.58 - 0.30;
    const midR = (0.58 + 0.30) / 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, spokeLen, 6), metalMat);
    spoke.rotation.z = Math.PI / 2;
    spoke.rotation.y = angle;
    spoke.position.set(PX + Math.cos(angle) * midR, hangY, PZ + Math.sin(angle) * midR);
    scene.add(spoke);
  }

  // Central bulb — slightly cool-white (不太黃)
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xf4f0ee });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), bulbMat);
  bulb.position.set(PX, hangY, PZ);
  scene.add(bulb);

  // Soft glow halo around bulb
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xe8f0f8, transparent: true, opacity: 0.12,
    depthWrite: false, blending: THREE.AdditiveBlending
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), haloMat);
  halo.position.set(PX, hangY, PZ);
  scene.add(halo);

  // Point light from pendant — cooler white, not amber
  const pendantPt = new THREE.PointLight(0xe8f2ff, 5.5, 16, 1.3);
  pendantPt.position.set(PX, hangY - 0.08, PZ);
  scene.add(pendantPt);
  sceneLights.push({ light: pendantPt, onIntensity: 5.5 });

  // Subtle downward spot for pool of light on floor
  const pendantSpot = new THREE.SpotLight(0xdce8ff, 3.5, 12, Math.PI / 3.8, 0.7, 1.2);
  pendantSpot.position.set(PX, hangY, PZ);
  const pst = new THREE.Object3D();
  pst.position.set(PX, 0, PZ);
  scene.add(pst);
  pendantSpot.target = pst;
  scene.add(pendantSpot);
  sceneLights.push({ light: pendantSpot, onIntensity: 3.5 });
}

function buildBench() {
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x4a3018, roughness: 0.78, metalness: 0.0 });
  const legMat  = new THREE.MeshStandardMaterial({ color: 0x332010, roughness: 0.82, metalness: 0.0 });

  const BZ = -7.8;   // 4m in front of main visual

  // Seat plank
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.07, 0.44), seatMat);
  seat.position.set(0, 0.45, BZ);
  scene.add(seat);

  // Seat surface detail — thin darker strip across top
  const strip = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.012, 0.44), legMat);
  strip.position.set(0, 0.487, BZ);
  scene.add(strip);

  // Four legs
  for (const [lx, lz] of [[-0.8, -0.16], [0.8, -0.16], [-0.8, 0.16], [0.8, 0.16]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.44, 0.055), legMat);
    leg.position.set(lx, 0.22, BZ + lz);
    scene.add(leg);
  }

  // Faint warm spot from above to light the bench
  const benchSpot = new THREE.SpotLight(0xffd0a0, 2.2, 7, Math.PI / 5, 0.65, 1.2);
  benchSpot.position.set(0, ROOM_H - 0.2, BZ - 0.5);
  const bt = new THREE.Object3D();
  bt.position.set(0, 0.45, BZ);
  scene.add(bt);
  benchSpot.target = bt;
  scene.add(benchSpot);
  sceneLights.push({ light: benchSpot, onIntensity: 2.2 });
}

function buildFloorDecals() {
  // Helper: make a circular canvas decal
  function makeCircleDecal(innerText, subText, size) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Outer ring
    ctx.strokeStyle = "rgba(210,190,150,0.35)";
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.arc(256, 256, 222, 0, Math.PI * 2); ctx.stroke();

    // Inner ring
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(256, 256, 195, 0, Math.PI * 2); ctx.stroke();

    // Main text
    ctx.fillStyle = "rgba(210,185,140,0.28)";
    ctx.font = "500 36px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText(innerText, 256, 248);

    // Sub text
    ctx.font = "300 22px Georgia, serif";
    ctx.fillStyle = "rgba(200,175,130,0.22)";
    ctx.fillText(subText, 256, 282);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // Entrance decal — front of room
  const entranceMat = new THREE.MeshBasicMaterial({
    map: makeCircleDecal("2ND EYES", "Rain Room", 3),
    transparent: true, opacity: 0.7, depthWrite: false
  });
  const entrance = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), entranceMat);
  entrance.rotation.x = -Math.PI / 2;
  entrance.position.set(0, 0.005, 7.5);
  scene.add(entrance);

  // Viewing-spot decal — in front of bench, facing main visual
  const viewMat = new THREE.MeshBasicMaterial({
    map: makeCircleDecal("", "", 1.5),
    transparent: true, opacity: 0.45, depthWrite: false
  });
  const viewSpot = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), viewMat);
  viewSpot.rotation.x = -Math.PI / 2;
  viewSpot.position.set(0, 0.005, -6);
  scene.add(viewSpot);
}

function buildDoorway() {
  const doorX = ROOM_W / 2 - 1.8;    // right corner of back wall
  const doorZ = -ROOM_D / 2 + 0.05;

  doorway = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 2.1),
    new THREE.MeshBasicMaterial({ color: 0x1a130c })
  );
  doorway.position.set(doorX, 1.05, doorZ);
  scene.add(doorway);

  doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 2.6),
    new THREE.MeshBasicMaterial({
      color: 0x6a5028,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    })
  );
  doorGlow.position.set(doorX, 1.2, doorZ - 0.01);
  scene.add(doorGlow);

  doorSpot = new THREE.SpotLight(0xffb070, 2.4, 7, Math.PI / 4.5, 0.72, 1.25);
  doorSpot.position.set(doorX, 2.6, doorZ + 1.6);

  const doorTarget = new THREE.Object3D();
  doorTarget.position.set(doorX, 1.05, doorZ);
  scene.add(doorTarget);
  doorSpot.target = doorTarget;
  scene.add(doorSpot);

  doorObj = { position: doorway.position, isDoor: true };
}

function createPhoto(data, position, rotationY, scale = 1) {
  const pw = PHOTO_W * scale;
  const ph = PHOTO_H * scale;
  const group = new THREE.Group();

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(pw + 0.14 * scale, ph + 0.14 * scale),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5 })
  );
  group.add(back);

  const borderMat = new THREE.MeshBasicMaterial({
    color: 0x3a2f1a,
    transparent: true,
    opacity: 0.55
  });
  const border = new THREE.Mesh(new THREE.PlaneGeometry(pw + 0.08 * scale, ph + 0.08 * scale), borderMat);
  border.position.z = 0.004;
  group.add(border);

  const texture = loadPhotoTexture(data);
  const photoMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.3
  });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMat);
  photo.position.z = 0.008;
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

function makePlacardTexture(data) {
  const W = 560, H = 180;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Paper base
  ctx.fillStyle = "#e8e1d2";
  ctx.fillRect(0, 0, W, H);

  // Subtle paper grain
  const imgData = ctx.getImageData(0, 0, W, H);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 9;
    px[i]     = clampColor(px[i] + n);
    px[i + 1] = clampColor(px[i + 1] + n);
    px[i + 2] = clampColor(px[i + 2] + n * 0.85);
  }
  ctx.putImageData(imgData, 0, 0);

  // Thin top border line
  ctx.strokeStyle = "#b8afa0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(28, 20);
  ctx.lineTo(W - 28, 20);
  ctx.stroke();

  const pad = 30;

  // Line 1: title
  ctx.fillStyle = "#3a2f1a";
  ctx.textAlign = "left";
  ctx.font = "500 38px Georgia, serif";
  ctx.fillText(data.title, pad, 70);

  // Line 2: film
  ctx.fillStyle = "#6a6358";
  ctx.font = "300 24px 'IBM Plex Mono', monospace";
  ctx.fillText(data.film, pad, 108);

  // Line 3: note
  ctx.font = "300 24px 'IBM Plex Mono', monospace";
  ctx.fillText(data.note, pad, 140);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

function createPlacard(data, group, photoH) {
  const PW = 0.28, PH = 0.09;
  const mat = new THREE.MeshBasicMaterial({
    map: makePlacardTexture(data),
    transparent: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat);

  // 30cm gap below photo bottom edge, flush with wall face
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
    () => {
      console.warn(`Could not load photo texture: ${data.image}`);
    }
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

function makePhotoTexture(tint) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = `rgb(${(tint.r * 30) | 0},${(tint.g * 30) | 0},${(tint.b * 30) | 0})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createRadialGradient(256, 240, 8, 256, 240, 300);
  grad.addColorStop(0, `rgba(${(tint.r * 255) | 0},${(tint.g * 255) | 0},${(tint.b * 255) | 0},0.65)`);
  grad.addColorStop(0.35, `rgba(${(tint.r * 180) | 0},${(tint.g * 180) | 0},${(tint.b * 180) | 0},0.25)`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imgData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const noise = (Math.random() - 0.5) * 22;
    pixels[i] = clampColor(pixels[i] + noise);
    pixels[i + 1] = clampColor(pixels[i + 1] + noise);
    pixels[i + 2] = clampColor(pixels[i + 2] + noise);
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeWallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#1a1714";
  ctx.fillRect(0, 0, 512, 512);

  // Horizontal plaster streaks
  for (let pass = 0; pass < 60; pass++) {
    const y = Math.random() * 512;
    const alpha = Math.random() * 0.045;
    const lighter = Math.random() > 0.5;
    ctx.strokeStyle = lighter
      ? `rgba(40,34,26,${alpha})`
      : `rgba(12,10,8,${alpha})`;
    ctx.lineWidth = Math.random() * 2.5 + 0.4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y + (Math.random() - 0.5) * 6);
    ctx.stroke();
  }

  // Fine grain
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const pixels = imgData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    pixels[i] = clampColor(pixels[i] + n);
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
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#151311";
  ctx.fillRect(0, 0, 512, 512);

  // Polished concrete — faint panel lines
  ctx.strokeStyle = "rgba(8,7,6,0.55)";
  ctx.lineWidth = 1.2;
  for (let x = 0; x < 512; x += 128) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }
  for (let y = 0; y < 512; y += 128) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
  }

  // Subtle sheen streaks
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

  // Fine grain
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const pixels = imgData.data;
  for (let i = 0; i < pixels.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    pixels[i] = clampColor(pixels[i] + n);
    pixels[i + 1] = clampColor(pixels[i + 1] + n * 0.95);
    pixels[i + 2] = clampColor(pixels[i + 2] + n * 0.9);
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 7);
  return texture;
}

function makeMapTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 640;
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

  const rooms = ["Rain Room", "Transit Room", "Object Room", "Summer Room", "Darkroom"];
  const hereIndex = 0;
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

function buildHeldMap() {
  heldGroup = new THREE.Group();

  const mapMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.42),
    new THREE.MeshBasicMaterial({
      map: makeMapTexture(),
      side: THREE.DoubleSide
    })
  );
  mapMesh.position.set(0.3, -0.24, -0.62);
  mapMesh.rotation.set(-0.22, -0.38, 0.1);
  heldGroup.add(mapMesh);

  const armSkin = new THREE.MeshBasicMaterial({ color: 0x8a6440 });
  const armSleeve = new THREE.MeshBasicMaterial({ color: 0x26242c });

  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), armSkin);
  hand.position.set(0.4, -0.34, -0.55);
  hand.rotation.set(0.1, -0.2, 0.25);
  heldGroup.add(hand);

  const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.34), armSleeve);
  sleeve.position.set(0.45, -0.46, -0.4);
  sleeve.rotation.set(0.1, -0.2, 0.25);
  heldGroup.add(sleeve);

  camera.add(heldGroup);
  scene.add(camera);
}

function buildDust() {
  const dustCount = 220;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(dustCount * 3);
  const velocities = new Float32Array(dustCount);

  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * ROOM_W * 0.95;
    positions[i * 3 + 1] = Math.random() * ROOM_H;
    positions[i * 3 + 2] = (Math.random() - 0.5) * ROOM_D * 0.95;
    velocities[i] = 0.0006 + Math.random() * 0.001;
  }

  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xc9b88a,
      size: 0.014,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    })
  );
  points.userData = { count: dustCount, velocities };
  scene.add(points);
  return points;
}

function bindEvents() {
  enterButton.addEventListener("click", () => controls.lock());
  startOverlay.addEventListener("click", () => controls.lock());
  closeButton.addEventListener("click", () => closeDetail(true));

  controls.addEventListener("lock", () => {
    startOverlay.classList.add("mw-hidden");
    document.body.classList.add("mw-room-ready");
  });

  controls.addEventListener("unlock", () => {
    if (!detailPanel.classList.contains("mw-visible")) {
      startOverlay.classList.remove("mw-hidden");
      document.body.classList.remove("mw-room-ready");
    }
  });

  document.addEventListener("keydown", (event) => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        keys.w = true;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.s = true;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.a = true;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.d = true;
        break;
      case "KeyE":
        tryInteract();
        break;
      case "Space":
        if (canJump && controls.isLocked) {
          velocityY = JUMP_FORCE;
          canJump = false;
        }
        event.preventDefault();
        break;
      case "KeyH":
        heldMapEnabled = !heldMapEnabled;
        break;
      case "KeyL":
        lightsOn = !lightsOn;
        break;
      case "Escape":
        if (detailPanel.classList.contains("mw-visible")) closeDetail(false);
        break;
      default:
        break;
    }
  });

  document.addEventListener("keyup", (event) => {
    switch (event.code) {
      case "KeyW":
      case "ArrowUp":
        keys.w = false;
        break;
      case "KeyS":
      case "ArrowDown":
        keys.s = false;
        break;
      case "KeyA":
      case "ArrowLeft":
        keys.a = false;
        break;
      case "KeyD":
      case "ArrowRight":
        keys.d = false;
        break;
      default:
        break;
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

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

  const margin = 0.7;
  camera.position.x = clamp(camera.position.x, -ROOM_W / 2 + margin, ROOM_W / 2 - margin);
  camera.position.z = clamp(camera.position.z, -ROOM_D / 2 + margin, ROOM_D / 2 - margin);
  velocityY -= GRAVITY * delta;
  camera.position.y += velocityY * delta;

  if (camera.position.y <= GROUND_Y) {
    camera.position.y = GROUND_Y;
    velocityY = 0;
    canJump = true;
  }
}

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

  const doorDist = camera.position.distanceTo(doorway.position);
  if (doorDist < DOOR_DIST && doorDist < closestDist) {
    closest = doorObj;
    closestDist = doorDist;
  }

  for (const mesh of photoMeshes) {
    const isClose = mesh === closest;
    const targetBorderOpacity = isClose ? 1 : 0.55;
    const targetBorderColor = isClose ? 0xc9b88a : 0x3a2f1a;
    const targetSpot = isClose ? 8 : 5;
    const targetEmissive = isClose ? 0.55 : 0.3;

    mesh.userData.borderMat.opacity += (targetBorderOpacity - mesh.userData.borderMat.opacity) * 0.12;
    mesh.userData.borderMat.color.lerp(colorTarget.setHex(targetBorderColor), 0.1);
    mesh.userData.spot.intensity += (targetSpot - mesh.userData.spot.intensity) * 0.1;
    mesh.userData.photoMat.emissiveIntensity += (targetEmissive - mesh.userData.photoMat.emissiveIntensity) * 0.1;
  }

  const doorIsClose = closest === doorObj;
  doorSpot.intensity += ((doorIsClose ? 3.5 : 1.5) - doorSpot.intensity) * 0.08;
  doorGlow.material.opacity += ((doorIsClose ? 0.42 : 0.18) - doorGlow.material.opacity) * 0.08;

  nearestTarget = closest;

  if (closest && !detailPanel.classList.contains("mw-visible")) {
    promptEl.innerHTML = closest === doorObj
      ? 'NEXT ROOM &nbsp;·&nbsp; <kbd>E</kbd> FOLLOW THE MOVING LIGHT'
      : 'PRESS <kbd>E</kbd> TO VIEW';
    promptEl.classList.add("mw-visible");
  } else {
    promptEl.classList.remove("mw-visible");
  }
}

function tryInteract() {
  if (detailPanel.classList.contains("mw-visible")) {
    closeDetail(true);
    return;
  }

  if (!nearestTarget) return;

  if (nearestTarget === doorObj) {
    openDoorMessage();
    return;
  }

  openDetail(nearestTarget.userData.data);
}

function openDetail(data) {
  panel.section.textContent = "Gallery Label";
  panel.title.textContent = data.title;
  panel.memory.textContent = `"${data.memory}"`;
  panel.camera.textContent = data.camera;
  panel.film.textContent = data.film;
  panel.note.textContent = data.note;

  detailPanel.classList.add("mw-visible");
  dimInterface(true);
  controls.unlock();
}

function openDoorMessage() {
  panel.section.textContent = "Next exhibition";
  panel.title.textContent = "Transit Room";
  panel.memory.textContent = '"Some memories only exist while moving."';
  panel.camera.textContent = "-";
  panel.film.textContent = "-";
  panel.note.textContent = "Coming soon";

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

function updateDust(time) {
  const positions = dust.geometry.attributes.position.array;
  const velocities = dust.userData.velocities;

  for (let i = 0; i < dust.userData.count; i++) {
    positions[i * 3 + 1] -= velocities[i];
    positions[i * 3] += Math.sin(time * 0.0003 + i) * 0.0003;
    if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = ROOM_H;
  }

  dust.geometry.attributes.position.needsUpdate = true;
}

function updateLights(delta) {
  const speed = delta * 1.8;   // lerp speed — slower = more cinematic fade
  const targetOn = lightsOn ? 1 : 0;

  for (const { light, onIntensity } of sceneLights) {
    light.intensity += (onIntensity * targetOn - light.intensity) * speed;
  }

  // Ambient: warm when on, cold moonlight blue when off
  const ambTarget = lightsOn ? 0.82 : 0.06;
  ambientLight.intensity += (ambTarget - ambientLight.intensity) * speed;
  ambientLight.color.lerp(
    lightsOn ? new THREE.Color(0x1c2028) : new THREE.Color(0x08101e),
    speed
  );

  const hemiTarget = lightsOn ? 0.34 : 0.04;
  hemiLight.intensity += (hemiTarget - hemiLight.intensity) * speed;
}

function updateHeldMap(delta) {
  if (!heldGroup) return;

  const moving = controls.isLocked && (keys.w || keys.a || keys.s || keys.d);
  bobTime += delta * (moving ? 9 : 2.2);
  heldGroup.position.y = Math.sin(bobTime) * (moving ? 0.012 : 0.004);
  heldGroup.position.x = Math.cos(bobTime * 0.5) * (moving ? 0.008 : 0.003);
  heldGroup.visible = heldMapEnabled && !detailPanel.classList.contains("mw-visible");
}

function animate() {
  requestAnimationFrame(animate);

  const time = performance.now();
  const delta = Math.min((time - previousTime) / 1000, 0.1);
  previousTime = time;

  updateMovement(delta);
  updateDust(time);
  updateProximity();
  updateHeldMap(delta);
  updateLights(delta);
  renderer.render(scene, camera);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}
