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
  },
  {
    title: "Last Train",
    memory: "Everyone waiting for something that may not come.",
    camera: "Canon AE-1",
    film: "Kodak ColorPlus 200",
    note: "Melbourne underground",
    image: "assets/images/IMG_9558.JPG",
    tint: { r: 0.14, g: 0.16, b: 0.22 }
  },
  {
    title: "In Transit",
    memory: "The city blurred past. Nobody looked up.",
    camera: "Olympus Stylus",
    film: "Fuji Superia 400",
    note: "Motion blur, late afternoon",
    image: "assets/images/IMG_9556.JPG",
    tint: { r: 0.28, g: 0.26, b: 0.12 }
  },
  {
    title: "Under the Bridge",
    memory: "Two people in a small boat. The arch held everything still.",
    camera: "Canon AE-1",
    film: "Kodak Gold 200",
    note: "Sydney, overcast",
    image: "assets/images/sydney river.jpg",
    tint: { r: 0.12, g: 0.20, b: 0.28 }
  },
  {
    title: "St Kilda Baths",
    memory: "Summer tasted like salt and sunscreen and going nowhere.",
    camera: "Olympus Stylus",
    film: "Kodak Ultramax 400",
    note: "Film scan, slight overexposure",
    image: "assets/images/IMG_0758 2.JPG",
    tint: { r: 0.22, g: 0.28, b: 0.30 }
  }
];

const ROOM_W = 11;
const ROOM_D = 15;
const ROOM_H = 3.8;
const PHOTO_W = 1.55;
const PHOTO_H = 1.16;
const INTERACT_DIST = 2.6;
const DOOR_DIST = 2.2;

// Nekoland Room — offset far on X so Rain Room fog hides it completely
const NL_CX = 200;   // world X centre of Nekoland
const NL_W  = 8;
const NL_D  = 14;
const NL_H  = 3.6;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x030303, 0.048);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 80);
camera.position.set(0, 1.6, 1.5);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("mw-canvas"),
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.outputColorSpace = THREE.SRGBColorSpace;

let ambientLight = new THREE.AmbientLight(0x2a2520, 0.72);
scene.add(ambientLight);
let hemiLight = new THREE.HemisphereLight(0x3a3828, 0x17110b, 0.38);
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

// Room state
let currentRoom = 'rain';   // 'rain' | 'nekolan'
let nkEntryDoor, nkEntryDoorObj, nkEntryGlow, nkEntrySpot;
let rainExitDoor, rainExitDoorObj, rainExitGlow, rainExitSpot;
const nkInteractables = [];   // Nekoland interactable objects (Stages 3-5)
const nkSceneLights  = [];    // { light, onIntensity } — toggled when L pressed inside Nekolan

// Light toggle system
const sceneLights = [];   // { light, onIntensity }
let lightsOn = true;

// Audio system
let audioCtx = null;
let vinylGainNode = null;
let stepClock = 0;
const STEP_INTERVAL = 0.52;   // seconds between footsteps

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
buildBench();
buildFloorDecals();
buildHeldMap();
buildNKEntryDoor();
buildNekolandRoom();
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
    new THREE.MeshStandardMaterial({ color: 0x0e0c0a, roughness: 0.95 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_H;
  scene.add(ceiling);

  const wallTex = makeWallTexture();
  const wallNorm = makeWallNormalMap();
  const wallMat = new THREE.MeshStandardMaterial({
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
  const recessMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.5, metalness: 0.4 });
  const glowMat  = new THREE.MeshBasicMaterial({ color: 0xfff4d8, depthWrite: false });

  // 5 symmetric recessed spots along room centre line
  const spotZs = [-5.5, -2.8, 0, 2.8, 5.5];

  spotZs.forEach((z) => {
    // Recessed housing disc
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 20), recessMat);
    housing.position.set(0, ROOM_H - 0.025, z);
    scene.add(housing);

    // Inner glow circle
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), glowMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(0, ROOM_H - 0.051, z);
    scene.add(disc);

    // SpotLight
    const onInt = 7.5;
    const spot = new THREE.SpotLight(0xffd0a0, onInt, 11, Math.PI / 4.2, 0.52, 1.1);
    spot.position.set(0, ROOM_H - 0.06, z);
    const t = new THREE.Object3D();
    t.position.set(0, 0, z);
    scene.add(t);
    spot.target = t;
    scene.add(spot);
    sceneLights.push({ light: spot, onIntensity: onInt });
  });

  // Side wall-wash PointLights (left & right, two each)
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

function buildPhotos() {
  // Back wall — main visual, 1.5× centred
  createPhoto(photos[0], new THREE.Vector3(0, 2.0, -ROOM_D / 2 + 0.06), 0, 1.5);

  // Left wall — two photos, heights staggered
  createPhoto(photos[2], new THREE.Vector3(-ROOM_W / 2 + 0.06, 2.05, -3.2), Math.PI / 2);
  createPhoto(photos[3], new THREE.Vector3(-ROOM_W / 2 + 0.06, 1.35, -0.2), Math.PI / 2);

  // Right wall — two photos
  createPhoto(photos[1], new THREE.Vector3(ROOM_W / 2 - 0.06, 1.85, -3.0), -Math.PI / 2);
  createPhoto(photos[4], new THREE.Vector3(ROOM_W / 2 - 0.06, 1.45, -0.8), -Math.PI / 2);

  // Left wall — third photo closer to entrance
  createPhoto(photos[5], new THREE.Vector3(-ROOM_W / 2 + 0.06, 1.75, 1.8), Math.PI / 2);

  // Right wall — near entrance, small
  createPhoto(photos[6], new THREE.Vector3(ROOM_W / 2 - 0.06, 1.65, 2.2), -Math.PI / 2, 0.85);

  // Back wall — second photo offset left
  createPhoto(photos[7], new THREE.Vector3(-2.2, 1.55, -ROOM_D / 2 + 0.06), 0, 0.9);
}

function buildFloorGlows() {
  // Positions match the four photos in buildPhotos()
  const glowPositions = [
    { x: 0,                   z: -ROOM_D / 2 + 0.06 },  // main visual back wall
    { x: -ROOM_W / 2 + 0.06, z: -3.2 },                 // left wall upper
    { x: -ROOM_W / 2 + 0.06, z: -0.2 },                 // left wall lower
    { x:  ROOM_W / 2 - 0.06, z: -3.0 },                 // right wall upper
    { x:  ROOM_W / 2 - 0.06, z: -0.8 },                 // right wall lower
    { x: -ROOM_W / 2 + 0.06, z:  1.8 },                 // left wall entrance
    { x:  ROOM_W / 2 - 0.06, z:  2.2 },                 // right wall entrance
    { x: -2.2,                z: -ROOM_D / 2 + 0.06 }   // back wall second
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

  const BZ = -4.8;   // in front of main visual

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
  entrance.position.set(0, 0.005, 5.0);
  scene.add(entrance);

  // Viewing-spot decal — in front of bench, facing main visual
  const viewMat = new THREE.MeshBasicMaterial({
    map: makeCircleDecal("", "", 1.5),
    transparent: true, opacity: 0.45, depthWrite: false
  });
  const viewSpot = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.8), viewMat);
  viewSpot.rotation.x = -Math.PI / 2;
  viewSpot.position.set(0, 0.005, -3.8);
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

  // ── 3D frame: 4 strips leaving centre open for photo ─────────────────────
  const frameW = 0.042 * scale;
  const frameDepth = 0.032;

  const borderMat = new THREE.MeshStandardMaterial({
    color: 0x2a1f14,
    roughness: 0.72,
    metalness: 0.04
  });

  // top / bottom rails
  [1, -1].forEach((sy) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(pw + frameW * 2, frameW, frameDepth),
      borderMat
    );
    rail.position.set(0, sy * (ph / 2 + frameW / 2), 0);
    group.add(rail);
  });

  // left / right stiles
  [1, -1].forEach((sx) => {
    const stile = new THREE.Mesh(
      new THREE.BoxGeometry(frameW, ph, frameDepth),
      borderMat
    );
    stile.position.set(sx * (pw / 2 + frameW / 2), 0, 0);
    group.add(stile);
  });

  // Dark backing behind photo (wall fill)
  const backing = new THREE.Mesh(
    new THREE.PlaneGeometry(pw, ph),
    new THREE.MeshStandardMaterial({ color: 0x060504, roughness: 0.95 })
  );
  backing.position.z = -frameDepth / 2 + 0.001;
  group.add(backing);

  const texture = loadPhotoTexture(data);
  const photoMat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.3
  });
  // Photo flush with front face of frame
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

function makeWallNormalMap() {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext("2d");

  const img = ctx.createImageData(S, S);
  const px = img.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;

      // Base normal: (128, 128, 255) = surface pointing toward viewer
      let nx = 128, ny = 128;

      // Fine grain (plaster/concrete micro-texture)
      nx += (Math.random() - 0.5) * 18;
      ny += (Math.random() - 0.5) * 18;

      // Coarse horizontal sweep lines (lime/plaster strokes)
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

  const rooms = ["Rain Room", "Nekoland Room", "Transit Room", "Object Room", "Darkroom"];
  const hereIndex = currentRoom === 'nekolan' ? 1 : 0;
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
        playLightSwitch();
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

  // Footstep audio
  const moving = keys.w || keys.a || keys.s || keys.d;
  if (moving && camera.position.y <= GROUND_Y + 0.05) {
    stepClock += delta;
    if (stepClock >= STEP_INTERVAL) {
      stepClock = 0;
      playFootstep();
    }
  } else {
    stepClock = STEP_INTERVAL * 0.6;  // next step comes sooner after stopping
  }

  const margin = 0.7;
  if (currentRoom === 'rain') {
    camera.position.x = clamp(camera.position.x, -ROOM_W / 2 + margin, ROOM_W / 2 - margin);
    camera.position.z = clamp(camera.position.z, -ROOM_D / 2 + margin, ROOM_D / 2 - margin);
  } else {
    camera.position.x = clamp(camera.position.x, NL_CX - NL_W / 2 + margin, NL_CX + NL_W / 2 - margin);
    camera.position.z = clamp(camera.position.z, -NL_D / 2 + margin, NL_D / 2 - margin);
  }
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
  if (currentRoom === 'rain' && doorDist < DOOR_DIST && doorDist < closestDist) {
    closest = doorObj;
    closestDist = doorDist;
  }

  // NK entry door (Rain Room left wall → Nekolan)
  if (currentRoom === 'rain' && nkEntryDoor) {
    const nd = camera.position.distanceTo(nkEntryDoor.position);
    if (nd < DOOR_DIST && nd < closestDist) { closest = nkEntryDoorObj; closestDist = nd; }
  }

  // Rain exit door (Nekolan front wall → Rain Room)
  if (currentRoom === 'nekolan' && rainExitDoor) {
    const rd = camera.position.distanceTo(rainExitDoor.position);
    if (rd < DOOR_DIST && rd < closestDist) { closest = rainExitDoorObj; closestDist = rd; }
  }

  // Nekolan interactables
  if (currentRoom === 'nekolan') {
    for (const obj of nkInteractables) {
      const d = camera.position.distanceTo(obj.position);
      if (d < INTERACT_DIST && d < closestDist) { closestDist = d; closest = obj; }
    }
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

  const nkEntryClose = closest === nkEntryDoorObj;
  if (nkEntrySpot) nkEntrySpot.intensity += ((nkEntryClose ? 3.5 : 1.2) - nkEntrySpot.intensity) * 0.08;
  if (nkEntryGlow) nkEntryGlow.material.opacity += ((nkEntryClose ? 0.50 : 0.16) - nkEntryGlow.material.opacity) * 0.08;

  const rainExitClose = closest === rainExitDoorObj;
  if (rainExitSpot) rainExitSpot.intensity += ((rainExitClose ? 3.0 : 1.0) - rainExitSpot.intensity) * 0.08;
  if (rainExitGlow) rainExitGlow.material.opacity += ((rainExitClose ? 0.45 : 0.14) - rainExitGlow.material.opacity) * 0.08;

  nearestTarget = closest;

  if (closest && !detailPanel.classList.contains("mw-visible")) {
    const isDoor = closest === doorObj || closest === nkEntryDoorObj || closest === rainExitDoorObj;
    if (closest === nkEntryDoorObj)  promptEl.innerHTML = 'ENTER &nbsp;<span style="letter-spacing:0.12em">NEKOLAND ROOM</span> &nbsp;·&nbsp; <kbd>E</kbd>';
    else if (closest === rainExitDoorObj) promptEl.innerHTML = 'RETURN TO &nbsp;<span style="letter-spacing:0.12em">RAIN ROOM</span> &nbsp;·&nbsp; <kbd>E</kbd>';
    else if (closest === doorObj)    promptEl.innerHTML = 'NEXT ROOM &nbsp;·&nbsp; <kbd>E</kbd> FOLLOW THE MOVING LIGHT';
    else                             promptEl.innerHTML = 'PRESS <kbd>E</kbd> TO VIEW';
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

  if (nearestTarget === doorObj)         { openDoorMessage(); return; }
  if (nearestTarget === nkEntryDoorObj)  { switchRoom('nekolan'); return; }
  if (nearestTarget === rainExitDoorObj) { switchRoom('rain');    return; }

  if (nearestTarget && nearestTarget.userData && nearestTarget.userData.data) {
    openDetail(nearestTarget.userData.data);
  }
}

function openDetail(data) {
  playPhotoInteract();
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
  const ambTarget = lightsOn ? 0.72 : 0.05;
  ambientLight.intensity += (ambTarget - ambientLight.intensity) * speed;
  ambientLight.color.lerp(
    lightsOn ? new THREE.Color(0x2a2520) : new THREE.Color(0x0d1018),
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

// ─── Audio Engine ────────────────────────────────────────────────────────────

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  buildVinylMusic();
}

// ── Vinyl Music Engine ────────────────────────────────────────────────────────

const BAR = 3.2;   // seconds per bar

function buildVinylMusic() {
  const sr = audioCtx.sampleRate;

  // Lowpass for vinyl warmth (roll off harsh highs)
  const warmth = audioCtx.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.frequency.value = 6800;
  warmth.Q.value = 0.5;

  // Master gain — fade in slowly
  vinylGainNode = audioCtx.createGain();
  vinylGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  vinylGainNode.gain.linearRampToValueAtTime(0.72, audioCtx.currentTime + 4);

  warmth.connect(vinylGainNode);
  vinylGainNode.connect(audioCtx.destination);

  // Convolution reverb (simulates room/vinyl space)
  const revBuf = makeReverbBuffer(sr, 2.0);
  const reverb = audioCtx.createConvolver();
  reverb.buffer = revBuf;
  const revGain = audioCtx.createGain();
  revGain.gain.value = 0.22;
  reverb.connect(revGain);
  revGain.connect(vinylGainNode);

  // Start crackle + music
  startVinylCrackle(vinylGainNode);
  scheduleMusicLoop(audioCtx.currentTime + 0.3, warmth, reverb);
}

function makeReverbBuffer(sr, duration) {
  const len = sr * duration;
  const buf = audioCtx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
    }
  }
  return buf;
}

function makeNote(freq, dest, revDest, t0, dur, vol = 0.11) {
  // Two detuned oscillators for piano-like character
  [1, 1.002].forEach((ratio, idx) => {
    const osc = audioCtx.createOscillator();
    osc.type = idx === 0 ? "sine" : "triangle";
    osc.frequency.value = freq * ratio;

    const env = audioCtx.createGain();
    const att = Math.min(0.35, dur * 0.12);
    const rel = Math.min(1.0, dur * 0.35);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(vol * (idx === 0 ? 1 : 0.4), t0 + att);
    env.gain.setValueAtTime(vol * (idx === 0 ? 1 : 0.4), t0 + dur - rel);
    env.gain.linearRampToValueAtTime(0, t0 + dur);

    osc.connect(env);
    env.connect(dest);
    env.connect(revDest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
}

function scheduleMusicLoop(t0, dest, revDest) {
  // ── 4-bar loop, A minor feel ──────────────────────────────────────────────
  // Bar 1: Am  (A C E)
  makeNote(110.00, dest, revDest, t0,            BAR * 0.98, 0.13);  // A2
  makeNote(220.00, dest, revDest, t0,            BAR * 0.95, 0.09);  // A3
  makeNote(261.63, dest, revDest, t0 + 0.04,     BAR * 0.92, 0.07);  // C4
  makeNote(329.63, dest, revDest, t0 + 0.08,     BAR * 0.90, 0.06);  // E4

  // Bar 2: G   (G B D)
  makeNote(98.00,  dest, revDest, t0 + BAR,      BAR * 0.98, 0.12);
  makeNote(196.00, dest, revDest, t0 + BAR,      BAR * 0.94, 0.09);
  makeNote(246.94, dest, revDest, t0 + BAR + 0.05, BAR * 0.9, 0.07);
  makeNote(293.66, dest, revDest, t0 + BAR + 0.10, BAR * 0.88, 0.06);

  // Bar 3: F   (F A C)
  makeNote(87.31,  dest, revDest, t0 + BAR * 2,  BAR * 0.98, 0.12);
  makeNote(174.61, dest, revDest, t0 + BAR * 2,  BAR * 0.94, 0.09);
  makeNote(220.00, dest, revDest, t0 + BAR * 2 + 0.04, BAR * 0.9, 0.07);
  makeNote(261.63, dest, revDest, t0 + BAR * 2 + 0.08, BAR * 0.88, 0.06);

  // Bar 4: Em  (E G B)
  makeNote(82.41,  dest, revDest, t0 + BAR * 3,  BAR * 0.98, 0.12);
  makeNote(164.81, dest, revDest, t0 + BAR * 3,  BAR * 0.94, 0.09);
  makeNote(196.00, dest, revDest, t0 + BAR * 3 + 0.04, BAR * 0.9, 0.07);
  makeNote(246.94, dest, revDest, t0 + BAR * 3 + 0.08, BAR * 0.88, 0.06);

  // ── Melody (higher register, sparser) ────────────────────────────────────
  const mel = [
    [0.0,          440.00, 0.7,  0.075],
    [1.0,          392.00, 0.55, 0.065],
    [1.9,          349.23, 0.9,  0.072],
    [BAR + 0.3,    392.00, 0.65, 0.065],
    [BAR + 1.4,    369.99, 0.85, 0.058],
    [BAR * 2 + 0.1, 349.23, 0.75, 0.070],
    [BAR * 2 + 1.1, 329.63, 0.6,  0.062],
    [BAR * 2 + 2.0, 261.63, 1.1,  0.070],
    [BAR * 3 + 0.3, 329.63, 0.7,  0.062],
    [BAR * 3 + 1.3, 246.94, 0.85, 0.058],
    [BAR * 3 + 2.2, 220.00, 1.6,  0.072],
  ];

  for (const [dt, freq, dur, vol] of mel) {
    makeNote(freq, dest, revDest, t0 + dt, dur, vol);
  }

  // Re-schedule next iteration just before this one ends
  const loopDur = BAR * 4;
  setTimeout(() => {
    if (audioCtx && audioCtx.state !== "closed") {
      scheduleMusicLoop(t0 + loopDur, dest, revDest);
    }
  }, (loopDur - 0.5) * 1000);
}

function startVinylCrackle(dest) {
  const sr = audioCtx.sampleRate;

  // Random pops
  function pop() {
    if (!audioCtx || audioCtx.state === "closed") return;
    const buf = audioCtx.createBuffer(1, Math.floor(sr * 0.012), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 60);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const g = audioCtx.createGain();
    g.gain.value = 0.03 + Math.random() * 0.05;
    src.connect(g); g.connect(dest); src.start();
    setTimeout(pop, 600 + Math.random() * 2800);
  }

  // Occasional soft scratch
  function scratch() {
    if (!audioCtx || audioCtx.state === "closed") return;
    const len = Math.floor(sr * (0.04 + Math.random() * 0.06));
    const buf = audioCtx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(i / len * Math.PI);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    const f = audioCtx.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 4000;
    const g = audioCtx.createGain();
    g.gain.value = 0.04 + Math.random() * 0.03;
    src.connect(f); f.connect(g); g.connect(dest); src.start();
    setTimeout(scratch, 7000 + Math.random() * 14000);
  }

  setTimeout(pop, 1200);
  setTimeout(scratch, 5000);
}

function playFootstep() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Low thud — wooden floor feel
  const osc = audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);

  // Texture layer — tiny noise burst
  const nBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.06, audioCtx.sampleRate);
  const nd = nBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / 400);
  const nSrc = audioCtx.createBufferSource();
  nSrc.buffer = nBuf;

  const nFilter = audioCtx.createBiquadFilter();
  nFilter.type = "bandpass";
  nFilter.frequency.value = 800;
  nFilter.Q.value = 1.5;

  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  const nGain = audioCtx.createGain();
  nGain.gain.value = 0.15;

  osc.connect(gain);
  nSrc.connect(nFilter);
  nFilter.connect(nGain);
  nGain.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now); osc.stop(now + 0.14);
  nSrc.start(now);
}

function playPhotoInteract() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Soft shutter / paper rustle
  const len = audioCtx.sampleRate * 0.09;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.exp(-i / (len * 0.3));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 4500;
  filter.Q.value = 1.8;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.35;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);
  src.start(now);
}

function playLightSwitch() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Hard click transient
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.04, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 180);
  }
  const src = audioCtx.createBufferSource();
  src.buffer = buf;

  const gain = audioCtx.createGain();
  gain.gain.value = 0.55;

  src.connect(gain);
  gain.connect(audioCtx.destination);
  src.start(now);

  // Lights off: dim music a little; lights on: restore
  if (vinylGainNode) {
    const target = lightsOn ? 0.5 : 0.72;
    vinylGainNode.gain.linearRampToValueAtTime(target, now + 1.8);
  }
}

// ─── Room Switching ───────────────────────────────────────────────────────────

function switchRoom(target) {
  currentRoom = target;
  velocity.set(0, 0, 0);
  velocityY = 0;

  if (target === 'nekolan') {
    // Spawn near front of Nekoland (positive-Z side = entrance/shop front)
    camera.position.set(NL_CX, 1.6, NL_D / 2 - 1.8);
    scene.background.setHex(0x100806);
    scene.fog = new THREE.FogExp2(0x100806, 0.042);
    ambientLight.color.setHex(0x3a2010);
    ambientLight.intensity = 0.58;
    hemiLight.intensity = 0.22;
    document.querySelector('.mw-hud--right .mw-hud-value').textContent = 'Nekoland Room';
  } else {
    // Return to Rain Room — spawn near left-wall doorway
    camera.position.set(-ROOM_W / 2 + 1.8, 1.6, 2.5);
    scene.background.setHex(0x020202);
    scene.fog = new THREE.FogExp2(0x030303, 0.048);
    ambientLight.color.setHex(0x2a2520);
    ambientLight.intensity = 0.72;
    hemiLight.intensity = 0.38;
    document.querySelector('.mw-hud--right .mw-hud-value').textContent = 'Rain Room';
  }

  // Rebuild held map so "you are here" updates
  if (heldGroup) {
    camera.remove(heldGroup);
    scene.remove(camera);
  }
  buildHeldMap();
}

// ─── NK Entry Door (Rain Room left wall → Nekolan) ───────────────────────────

function buildNKEntryDoor() {
  const doorX = -ROOM_W / 2 + 0.05;
  const doorZ = 2.6;

  // Dark portal plane
  nkEntryDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 2.15),
    new THREE.MeshBasicMaterial({ color: 0x1a0c06 })
  );
  nkEntryDoor.rotation.y = Math.PI / 2;   // face into room (toward +X)
  nkEntryDoor.position.set(doorX, 1.08, doorZ);
  scene.add(nkEntryDoor);

  // Warm-red glow halo
  nkEntryGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2.7),
    new THREE.MeshBasicMaterial({ color: 0xc83020, transparent: true, opacity: 0.16, depthWrite: false })
  );
  nkEntryGlow.rotation.y = Math.PI / 2;
  nkEntryGlow.position.set(doorX + 0.01, 1.2, doorZ);
  scene.add(nkEntryGlow);

  // Frame strips (top / bottom / left / right)
  const fMat = new THREE.MeshStandardMaterial({ color: 0x4a1a0a, roughness: 0.7, metalness: 0.2 });
  const fw = 0.04;
  const doorW = 1.05, doorH = 2.15;
  [
    new THREE.BoxGeometry(doorW + fw * 2, fw, 0.02),  // top
    new THREE.BoxGeometry(doorW + fw * 2, fw, 0.02),  // bottom
  ].forEach((geo, i) => {
    const m = new THREE.Mesh(geo, fMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(doorX, i === 0 ? 1.08 + doorH / 2 + fw / 2 : 1.08 - doorH / 2 - fw / 2, doorZ);
    scene.add(m);
  });
  [
    new THREE.BoxGeometry(fw, doorH, 0.02),  // left
    new THREE.BoxGeometry(fw, doorH, 0.02),  // right
  ].forEach((geo, i) => {
    const m = new THREE.Mesh(geo, fMat);
    m.rotation.y = Math.PI / 2;
    m.position.set(doorX, 1.08, i === 0 ? doorZ - doorW / 2 - fw / 2 : doorZ + doorW / 2 + fw / 2);
    scene.add(m);
  });

  // Spotlight from inside the room pointing at the doorway
  nkEntrySpot = new THREE.SpotLight(0xff6030, 2.0, 7, Math.PI / 4.5, 0.72, 1.25);
  nkEntrySpot.position.set(doorX + 1.8, 2.6, doorZ);
  const nkT = new THREE.Object3D();
  nkT.position.set(doorX, 1.08, doorZ);
  scene.add(nkT);
  nkEntrySpot.target = nkT;
  scene.add(nkEntrySpot);

  // Small neon-red sign above door: "Nekoland"
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 400; signCanvas.height = 100;
  const sc = signCanvas.getContext('2d');
  sc.fillStyle = 'rgba(0,0,0,0)';
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

  nkEntryDoorObj = { position: nkEntryDoor.position, type: 'nkEntry' };
}

// ─── Nekoland Room Shell (Stage 1) ───────────────────────────────────────────

function buildNekolandRoom() {
  const cx = NL_CX;

  // ── Floor: warm wood ──────────────────────────────────────────────────────
  const nkFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(NL_W, NL_D),
    new THREE.MeshStandardMaterial({ map: makeNKFloorTexture(), roughness: 0.52, metalness: 0.04 })
  );
  nkFloor.rotation.x = -Math.PI / 2;
  nkFloor.position.set(cx, 0, 0);
  scene.add(nkFloor);

  // ── Ceiling front (shop area, +Z side) — warm white plaster ─────────────
  const nkCeilFront = new THREE.Mesh(
    new THREE.PlaneGeometry(NL_W, NL_D / 2),
    new THREE.MeshStandardMaterial({ color: 0xf0e8dc, roughness: 0.92 })
  );
  nkCeilFront.rotation.x = Math.PI / 2;
  nkCeilFront.position.set(cx, NL_H, NL_D / 4);
  scene.add(nkCeilFront);

  // ── Ceiling back (後院, -Z side) — corrugated iron ────────────────────────
  const nkCeilBack = new THREE.Mesh(
    new THREE.PlaneGeometry(NL_W, NL_D / 2),
    new THREE.MeshStandardMaterial({ map: makeNKCeilTexture(), roughness: 0.62, metalness: 0.38 })
  );
  nkCeilBack.rotation.x = Math.PI / 2;
  nkCeilBack.position.set(cx, NL_H, -NL_D / 4);
  scene.add(nkCeilBack);

  // ── Walls ─────────────────────────────────────────────────────────────────
  const woodMat  = new THREE.MeshStandardMaterial({ map: makeNKWoodWallTexture(), roughness: 0.86 });
  const stoneMat = new THREE.MeshStandardMaterial({ map: makeNKStoneTexture(),    roughness: 0.93 });

  // Back wall (後院 — stone)
  const wBack = new THREE.Mesh(new THREE.PlaneGeometry(NL_W, NL_H), stoneMat);
  wBack.position.set(cx, NL_H / 2, -NL_D / 2);
  scene.add(wBack);

  // Front wall (entrance — faces player on entry)
  const wFront = new THREE.Mesh(
    new THREE.PlaneGeometry(NL_W, NL_H),
    new THREE.MeshStandardMaterial({ color: 0xf4ede0, roughness: 0.90 })
  );
  wFront.rotation.y = Math.PI;
  wFront.position.set(cx, NL_H / 2, NL_D / 2);
  scene.add(wFront);

  // Left wall (wood vertical strips)
  const wLeft = new THREE.Mesh(new THREE.PlaneGeometry(NL_D, NL_H), woodMat);
  wLeft.rotation.y = Math.PI / 2;
  wLeft.position.set(cx - NL_W / 2, NL_H / 2, 0);
  scene.add(wLeft);

  // Right wall (wood vertical strips)
  const wRight = new THREE.Mesh(new THREE.PlaneGeometry(NL_D, NL_H), woodMat);
  wRight.rotation.y = -Math.PI / 2;
  wRight.position.set(cx + NL_W / 2, NL_H / 2, 0);
  scene.add(wRight);

  // ── Baseboards ────────────────────────────────────────────────────────────
  const bMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.9 });
  const bH = 0.06, bD = 0.022;
  [
    { geo: new THREE.BoxGeometry(NL_W, bH, bD), pos: [cx, bH / 2, -NL_D / 2 + bD / 2] },
    { geo: new THREE.BoxGeometry(NL_W, bH, bD), pos: [cx, bH / 2,  NL_D / 2 - bD / 2] },
    { geo: new THREE.BoxGeometry(bD, bH, NL_D), pos: [cx - NL_W / 2 + bD / 2, bH / 2, 0] },
    { geo: new THREE.BoxGeometry(bD, bH, NL_D), pos: [cx + NL_W / 2 - bD / 2, bH / 2, 0] },
  ].forEach(({ geo, pos }) => {
    const m = new THREE.Mesh(geo, bMat);
    m.position.set(...pos);
    scene.add(m);
  });

  // ── Lights ────────────────────────────────────────────────────────────────
  // Recessed overhead spots (warm amber)
  const spotZs = [-5.0, -2.2, 0.8, 3.8];
  spotZs.forEach((z) => {
    const recessMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.5, metalness: 0.4 });
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.05, 18), recessMat);
    housing.position.set(cx, NL_H - 0.025, z);
    scene.add(housing);

    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffcc80 });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.08, 18), glowMat);
    disc.rotation.x = Math.PI / 2;
    disc.position.set(cx, NL_H - 0.051, z);
    scene.add(disc);

    const onInt = 6.0;
    const spot = new THREE.SpotLight(0xffb060, onInt, 10, Math.PI / 4.2, 0.55, 1.1);
    spot.position.set(cx, NL_H - 0.06, z);
    const t = new THREE.Object3D();
    t.position.set(cx, 0, z);
    scene.add(t);
    spot.target = t;
    scene.add(spot);
    nkSceneLights.push({ light: spot, onIntensity: onInt });
  });

  // Warm directional fill from upper-left (shop feeling)
  const nkDir = new THREE.DirectionalLight(0xffd9a0, 0.45);
  nkDir.position.set(cx - 3, 3.2, 2);
  scene.add(nkDir);
  nkSceneLights.push({ light: nkDir, onIntensity: 0.45 });

  // ── Return doorway (Nekolan → Rain Room, at the front wall) ──────────────
  rainExitDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 2.15),
    new THREE.MeshBasicMaterial({ color: 0x060e1a })
  );
  rainExitDoor.rotation.y = Math.PI;   // faces inward (toward -Z)
  rainExitDoor.position.set(cx, 1.08, NL_D / 2 - 0.05);
  scene.add(rainExitDoor);

  // Blue-cool halo (rain feel)
  rainExitGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2.7),
    new THREE.MeshBasicMaterial({ color: 0x4060c0, transparent: true, opacity: 0.14, depthWrite: false })
  );
  rainExitGlow.rotation.y = Math.PI;
  rainExitGlow.position.set(cx, 1.2, NL_D / 2 - 0.06);
  scene.add(rainExitGlow);

  // Frame strips for return door
  const rfMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.7, metalness: 0.2 });
  const rfW = 0.04, rfDW = 1.05, rfDH = 2.15;
  [0, 1].forEach((i) => {
    const top = new THREE.Mesh(new THREE.BoxGeometry(rfDW + rfW * 2, rfW, 0.02), rfMat);
    top.rotation.y = Math.PI;
    top.position.set(cx, i === 0 ? 1.08 + rfDH / 2 + rfW / 2 : 1.08 - rfDH / 2 - rfW / 2, NL_D / 2 - 0.05);
    scene.add(top);
  });
  [0, 1].forEach((i) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(rfW, rfDH, 0.02), rfMat);
    side.rotation.y = Math.PI;
    side.position.set(i === 0 ? cx - rfDW / 2 - rfW / 2 : cx + rfDW / 2 + rfW / 2, 1.08, NL_D / 2 - 0.05);
    scene.add(side);
  });

  rainExitSpot = new THREE.SpotLight(0x6090ff, 1.8, 7, Math.PI / 4.5, 0.72, 1.25);
  rainExitSpot.position.set(cx, 2.6, NL_D / 2 - 1.8);
  const rT = new THREE.Object3D();
  rT.position.set(cx, 1.08, NL_D / 2 - 0.05);
  scene.add(rT);
  rainExitSpot.target = rT;
  scene.add(rainExitSpot);

  // Small label above return door
  const retCanvas = document.createElement('canvas');
  retCanvas.width = 400; retCanvas.height = 100;
  const rc = retCanvas.getContext('2d');
  rc.clearRect(0, 0, 400, 100);
  rc.font = 'italic 44px Georgia, serif';
  rc.fillStyle = '#8ab0ff';
  rc.shadowColor = '#4060ff';
  rc.shadowBlur = 18;
  rc.textAlign = 'center';
  rc.fillText('← Rain Room', 200, 68);
  const retTex = new THREE.CanvasTexture(retCanvas);
  const retSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.13),
    new THREE.MeshBasicMaterial({ map: retTex, transparent: true })
  );
  retSign.rotation.y = Math.PI;
  retSign.position.set(cx, 1.08 + rfDH / 2 + 0.13, NL_D / 2 - 0.06);
  scene.add(retSign);

  rainExitDoorObj = { position: rainExitDoor.position, type: 'rainExit' };
}

// ─── Nekoland Texture Generators ─────────────────────────────────────────────

function makeNKFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // Base warm brown
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(0, 0, 512, 512);

  // Directional wood grain (vertical lines = along room length Z)
  const planks = 8;
  const plankW = 512 / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * plankW;
    // Subtle plank color variation
    const darkness = (Math.random() - 0.5) * 18;
    ctx.fillStyle = `rgba(${darkness > 0 ? 255 : 0},${darkness > 0 ? 255 : 0},${darkness > 0 ? 255 : 0},${Math.abs(darkness) / 255})`;
    if (darkness > 0) ctx.fillStyle = `rgba(255,220,160,${darkness / 255 * 0.3})`;
    else ctx.fillStyle = `rgba(0,0,0,${Math.abs(darkness) / 255 * 0.3})`;
    ctx.fillRect(x, 0, plankW, 512);

    // Plank joint line
    ctx.strokeStyle = 'rgba(30,15,5,0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();

    // Wood grain lines (faint horizontal streaks within plank)
    for (let g = 0; g < 12; g++) {
      const gy = Math.random() * 512;
      const alpha = 0.04 + Math.random() * 0.07;
      const lighter = Math.random() > 0.5;
      ctx.strokeStyle = lighter ? `rgba(180,140,80,${alpha})` : `rgba(40,20,5,${alpha})`;
      ctx.lineWidth = Math.random() * 1.5 + 0.3;
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + plankW, gy + (Math.random() - 0.5) * 8);
      ctx.stroke();
    }
  }

  // Fine grain
  const img = ctx.getImageData(0, 0, 512, 512);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 14;
    px[i]     = clampColor(px[i]     + n);
    px[i + 1] = clampColor(px[i + 1] + n * 0.85);
    px[i + 2] = clampColor(px[i + 2] + n * 0.6);
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 10);
  return tex;
}

function makeNKCeilTexture() {
  // Corrugated iron / galvanised metal roof feel
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#dedad2';
  ctx.fillRect(0, 0, 512, 256);

  // Corrugation ridges — horizontal bands
  const ridgeCount = 14;
  const rH = 256 / ridgeCount;
  for (let r = 0; r < ridgeCount; r++) {
    const y = r * rH;
    // Light highlight at top of ridge
    const lg = ctx.createLinearGradient(0, y, 0, y + rH);
    lg.addColorStop(0,    'rgba(255,255,255,0.18)');
    lg.addColorStop(0.35, 'rgba(200,200,195,0.05)');
    lg.addColorStop(0.65, 'rgba(120,118,110,0.10)');
    lg.addColorStop(1,    'rgba(80,78,72,0.22)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, y, 512, rH);

    // Ridge line
    ctx.strokeStyle = 'rgba(100,98,92,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
  }

  // Horizontal rust streaks
  for (let s = 0; s < 8; s++) {
    const sy = Math.random() * 256;
    ctx.strokeStyle = `rgba(160,110,70,${0.04 + Math.random() * 0.06})`;
    ctx.lineWidth = Math.random() * 2 + 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 100, sy);
    ctx.lineTo(300 + Math.random() * 212, sy + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 4);
  return tex;
}

function makeNKWoodWallTexture() {
  // Vertical wood-plank wall (darker, more dramatic than floor)
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#4a3220';
  ctx.fillRect(0, 0, 256, 512);

  const planks = 6;
  const pw = 256 / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    // Alternate slightly lighter/darker planks
    const alt = i % 2 === 0 ? 'rgba(90,58,31,0.18)' : 'rgba(20,8,2,0.22)';
    ctx.fillStyle = alt;
    ctx.fillRect(x, 0, pw, 512);

    // Vertical grain
    for (let g = 0; g < 20; g++) {
      const gx = x + Math.random() * pw;
      ctx.strokeStyle = `rgba(30,15,5,${0.05 + Math.random() * 0.09})`;
      ctx.lineWidth = Math.random() * 1.2 + 0.2;
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx + (Math.random() - 0.5) * 4, 512); ctx.stroke();
    }

    // Plank joint
    ctx.strokeStyle = 'rgba(10,4,1,0.7)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

function makeNKStoneTexture() {
  // Irregular stone-block wall (back/後院 wall)
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#cac4b6';
  ctx.fillRect(0, 0, 512, 512);

  // Draw irregular stone blocks
  const rows = 7;
  const rowH = 512 / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const offset = r % 2 === 0 ? 0 : 40 + Math.random() * 30;
    const blockW = 80 + Math.random() * 40;
    let x = -offset;
    while (x < 512) {
      const bw = blockW + (Math.random() - 0.5) * 30;
      const bh = rowH - 4;
      // Stone face colour
      const lightness = 0.88 + (Math.random() - 0.5) * 0.12;
      const r_c = Math.round(202 * lightness), g_c = Math.round(196 * lightness), b_c = Math.round(182 * lightness);
      ctx.fillStyle = `rgb(${r_c},${g_c},${b_c})`;
      ctx.fillRect(x + 2, y + 2, bw - 4, bh);

      // Mortar joint
      ctx.strokeStyle = 'rgba(80,72,60,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 2, y + 2, bw - 4, bh);

      x += bw;
    }
  }

  // Slight grain
  const img = ctx.getImageData(0, 0, 512, 512);
  const px = img.data;
  for (let i = 0; i < px.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    px[i]     = clampColor(px[i]     + n);
    px[i + 1] = clampColor(px[i + 1] + n);
    px[i + 2] = clampColor(px[i + 2] + n);
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}
