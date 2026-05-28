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

const ROOM_W = 11;
const ROOM_D = 15;
const ROOM_H = 3.8;
const PHOTO_W = 1.55;
const PHOTO_H = 1.16;
const INTERACT_DIST = 2.6;
const DOOR_DIST = 2.2;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x030303, 0.045);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 80);
camera.position.set(0, 1.6, 5.5);

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

scene.add(new THREE.AmbientLight(0x242631, 0.62));
scene.add(new THREE.HemisphereLight(0x3a4050, 0x17110b, 0.34));

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
buildDoorway();
buildHeldMap();
const dust = buildDust();
bindEvents();
animate();

function buildRoom() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_W, ROOM_D),
    new THREE.MeshStandardMaterial({ color: 0x151311, roughness: 0.52, metalness: 0.18 })
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

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x25221e, roughness: 0.9, metalness: 0.02 });

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
}

function buildCeilingLight() {
  const lampBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.78, 0.9, 0.1, 48),
    new THREE.MeshStandardMaterial({
      color: 0x1d1811,
      roughness: 0.55,
      metalness: 0.25
    })
  );
  lampBody.position.set(0, ROOM_H - 0.08, -0.9);
  scene.add(lampBody);

  const lampGlow = new THREE.Mesh(
    new THREE.CircleGeometry(0.72, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffd29a,
      transparent: true,
      opacity: 0.62,
      depthWrite: false
    })
  );
  lampGlow.rotation.x = Math.PI / 2;
  lampGlow.position.set(0, ROOM_H - 0.15, -0.9);
  scene.add(lampGlow);

  const overheadPoint = new THREE.PointLight(0xffd2a0, 5.8, 14, 1.35);
  overheadPoint.position.set(0, ROOM_H - 0.32, -0.9);
  scene.add(overheadPoint);

  const overheadSpot = new THREE.SpotLight(0xffc88f, 7.5, 18, Math.PI / 2.7, 0.82, 0.8);
  overheadSpot.position.set(0, ROOM_H - 0.2, -0.9);
  const target = new THREE.Object3D();
  target.position.set(0, 0.2, -0.9);
  scene.add(target);
  overheadSpot.target = target;
  scene.add(overheadSpot);
}

function buildPhotos() {
  createPhoto(photos[2], new THREE.Vector3(-2.4, 1.65, -ROOM_D / 2 + 0.06), 0);
  createPhoto(photos[3], new THREE.Vector3(2.4, 1.65, -ROOM_D / 2 + 0.06), 0);
  createPhoto(photos[0], new THREE.Vector3(-ROOM_W / 2 + 0.06, 1.65, -1.5), Math.PI / 2);
  createPhoto(photos[1], new THREE.Vector3(ROOM_W / 2 - 0.06, 1.65, -1.5), -Math.PI / 2);
}

function buildDoorway() {
  doorway = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 2.3),
    new THREE.MeshBasicMaterial({ color: 0x1f1810 })
  );
  doorway.position.set(0, 1.15, -ROOM_D / 2 + 0.05);
  scene.add(doorway);

  doorGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 2.8),
    new THREE.MeshBasicMaterial({
      color: 0x6a5028,
      transparent: true,
      opacity: 0.18,
      depthWrite: false
    })
  );
  doorGlow.position.set(0, 1.3, -ROOM_D / 2 + 0.04);
  scene.add(doorGlow);

  doorSpot = new THREE.SpotLight(0xffb070, 2.4, 7, Math.PI / 4.5, 0.72, 1.25);
  doorSpot.position.set(0, 2.6, -ROOM_D / 2 + 1.6);

  const doorTarget = new THREE.Object3D();
  doorTarget.position.set(0, 1.3, -ROOM_D / 2);
  scene.add(doorTarget);
  doorSpot.target = doorTarget;
  scene.add(doorSpot);

  doorObj = { position: doorway.position, isDoor: true };
}

function createPhoto(data, position, rotationY) {
  const group = new THREE.Group();

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(PHOTO_W + 0.14, PHOTO_H + 0.14),
    new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.5 })
  );
  group.add(back);

  const borderMat = new THREE.MeshBasicMaterial({
    color: 0x3a2f1a,
    transparent: true,
    opacity: 0.55
  });
  const border = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_W + 0.08, PHOTO_H + 0.08), borderMat);
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
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(PHOTO_W, PHOTO_H), photoMat);
  photo.position.z = 0.008;
  group.add(photo);

  group.position.copy(position);
  group.rotation.y = rotationY;

  const normal = new THREE.Vector3(Math.sin(rotationY), 0, Math.cos(rotationY));
  const spot = new THREE.SpotLight(0xffd6a0, 7.2, 9, Math.PI / 5.2, 0.58, 1.05);
  spot.position.copy(position).add(normal.clone().multiplyScalar(1.6)).add(new THREE.Vector3(0, 0.6, 0));

  const target = new THREE.Object3D();
  target.position.copy(position);
  scene.add(target);
  spot.target = target;
  scene.add(spot);

  group.userData = { data, borderMat, photoMat, spot };
  scene.add(group);
  photoMeshes.push(group);
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
  renderer.render(scene, camera);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampColor(value) {
  return Math.max(0, Math.min(255, value));
}
