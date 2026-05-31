// ─── Shared State & Scene Setup ──────────────────────────────────────────────
// All modules import from here. Mutate S.* for runtime state.

import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

export { THREE, RectAreaLightUniformsLib };

// ── Constants ─────────────────────────────────────────────────────────────────
export const ROOM_W = 11;
export const ROOM_D = 15;
export const ROOM_H = 3.8;
export const PHOTO_W = 1.55;
export const PHOTO_H = 1.16;
export const INTERACT_DIST = 2.6;
export const DOOR_DIST = 2.2;
export const NL_CX = 200;
export const NL_W  = 6;
export const NL_D  = 24;
export const NL_H  = 3.8;
export const GRAVITY = 24;
export const JUMP_FORCE = 6.2;
export const GROUND_Y = 1.6;
export const STEP_INTERVAL = 0.52;
export const BAR = 3.2;

// ── Photo data ────────────────────────────────────────────────────────────────
export const photos = [
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

// ── Scene / Renderer / Camera ─────────────────────────────────────────────────
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x020202);
scene.fog = new THREE.FogExp2(0x030303, 0.048);

export const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 80);
camera.position.set(0, 1.6, 1.5);

export const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("mw-canvas"),
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const ambientLight = new THREE.AmbientLight(0x2a2520, 0.72);
scene.add(ambientLight);
export const hemiLight = new THREE.HemisphereLight(0x3a3828, 0x17110b, 0.38);
scene.add(hemiLight);

export const controls = new PointerLockControls(camera, document.body);

// ── Shared arrays (mutated by room modules) ───────────────────────────────────
export const photoMeshes    = [];   // Rain Room photo groups
export const sceneLights    = [];   // { light, onIntensity } — Rain Room lights
export const nkSceneLights  = [];   // { light, onIntensity } — Nekoland lights
export const nkInteractables = [];  // Nekoland interactive objects

export const textureLoader = new THREE.TextureLoader();

// ── Mutable runtime state ─────────────────────────────────────────────────────
// Use S.* so modules can share and mutate a single object reference.
export const S = {
  currentRoom: 'rain',    // 'rain' | 'nekolan'
  velocityY: 0,
  canJump: true,
  nearestTarget: null,
  previousTime: performance.now(),
  lightsOn: true,
  heldMapEnabled: true,
  bobTime: 0,
  stepClock: 0,

  // Rain Room door refs (set by rain-room.js)
  doorway: null,
  doorGlow: null,
  doorSpot: null,
  doorObj: null,
  heldGroup: null,

  // NK door refs (set by nekolan-room.js)
  nkEntryDoor: null,
  nkEntryDoorObj: null,
  nkEntryGlow: null,
  nkEntrySpot: null,
  rainExitDoor: null,
  rainExitDoorObj: null,
  rainExitGlow: null,
  rainExitSpot: null,

  // Audio (set by audio.js)
  audioCtx: null,
  vinylGainNode: null,
};

// ── Input ─────────────────────────────────────────────────────────────────────
export const keys      = { w: false, a: false, s: false, d: false };
export const velocity  = new THREE.Vector3();
export const direction = new THREE.Vector3();
export const colorTarget = new THREE.Color();

// ── DOM elements ──────────────────────────────────────────────────────────────
export const startOverlay = document.querySelector("[data-start-overlay]");
export const detailPanel  = document.querySelector("[data-detail-panel]");
export const promptEl     = document.querySelector("[data-prompt]");
export const enterButton  = document.querySelector("[data-enter-room]");
export const closeButton  = document.querySelector("[data-close-panel]");
export const panel = {
  section: document.querySelector("[data-panel-section]"),
  title:   document.querySelector("[data-panel-title]"),
  memory:  document.querySelector("[data-panel-memory]"),
  camera:  document.querySelector("[data-panel-camera]"),
  film:    document.querySelector("[data-panel-film]"),
  note:    document.querySelector("[data-panel-note]")
};
