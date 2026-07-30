/**
 * Sky Room interactive gallery.
 *
 * Main sections are kept in runtime order: scene, architecture, actors,
 * story/duel systems, controls, UI, rendering helpers, then bootstrapping.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SkyAudio } from './sky-audio.js?v=night-beat-1';
import { livingWorld } from './sky-living-world.js';
import { skyMultiplayer } from './sky-multiplayer.js?v=interaction-priority-1';
import { loadCharacterProfiles, characterProfile, colorNumber } from './sky-characters.js';
import { createArchitectureSystem } from './sky-room/architecture.js?v=skyveil-academy-3';
import { createDuelSystem } from './sky-room/duel.js?v=performance-broadphase-1';
import { createCharacterSelection } from './sky-room/characters/selection.js?v=character-motion-4';
import { createVillagerFigureFactory } from './sky-room/characters/villagers.js?v=villager-motion-2';
import {
  PLAYABLE_CHARACTERS, playableCharacter
} from './sky-room/characters/manifest.js?v=character-catalog-1';
import { loadPlayableCharacter, disposeCharacterFigure } from './sky-room/characters/loader.js?v=character-animation-3';
import { CharacterAnimationController } from './sky-room/characters/animation-controller.js?v=character-motion-4';
import { createStoryOpening, STORY_START } from './sky-room/story-opening.js?v=story-coop-1';
import { createCombatEffects } from './sky-room/combat-effects.js?v=director-phase7-1';
import { createAmbientMemories } from './sky-room/ambient-memories.js?v=code-organize-1';
import { createResidentSystem } from './sky-room/resident-system.js?v=villager-motion-2';
import { createRoomRegistry } from './sky-room/room-registry.js?v=hall-entry-fix-1';
import { createCoopStoryUI } from './sky-room/coop-story-ui.js?v=story-black-garden-3';
import { createCoopPings } from './sky-room/coop-pings.js?v=story-chapter1-1';
import { createBlackGarden } from './sky-room/black-garden.js?v=story-black-garden-1';
import {
  sweepCameraPosition, segmentBlocked, createColliderSpatialIndex
} from './sky-room/camera-collision.js?v=performance-broadphase-1';
import { combatTuning } from './sky-room/combat-difficulty.js?v=director-phase2-1';
import { ENEMY_ARCHETYPES, WEAPON_PROFILES } from './sky-room/combat-balance.js?v=director-phase7-1';
import { createBuildingFireSystem } from './sky-room/building-fire.js?v=director-phase7-1';
import { createGamepadCameraInput } from './sky-room/gamepad-camera-input.js?v=director-phase1-1';
import {
  cameraRecenterPlan, clampCameraPitch, groundCameraLookTargetY
} from './sky-room/camera-heading.js?v=story-camera-fix-1';
import { createCameraOcclusion } from './sky-room/camera-occlusion.js?v=director-phase1-1';
import { createSettingsController } from './sky-room/settings-controller.js?v=code-organize-2';
import { createPerformanceGovernor } from './sky-room/performance-governor.js?v=performance-broadphase-1';
import { createNpcInteraction } from './sky-room/npc-interaction.js?v=interaction-priority-1';
import { MAX_ACTIVE_ENEMIES, MAX_LOCAL_PROJECTILES } from './sky-room/effect-budgets.js?v=director-phase7-1';
import {
  createChancellorMagic, chancellorTollStats, CHANCELLOR_TOLL_DIRECTIONS
} from './sky-room/chancellor-magic.js?v=director-phase7-1';
import { radialTexture } from './sky-room/textures.js';

await loadCharacterProfiles();

/* ================= palette / tuning ================= */
const BG     = 0x0a0a0f;
const AMBER  = 0xe8b06a;
const COOL   = 0x3a4a6a;

const GROUND_Y  = 1.6;
const FLY_Y     = 13.6;
const LIFT_SECS = 3.2;
const BOB_AMP   = 0.12;   // <= 0.15
const BOB_PERIOD = 4.0;
const FLY_SPEED = 15;     // units/sec at full tilt
const FLIGHT_GRAVITY = 9.8;
const FLIGHT_BUOYANCY = 9.8;   // explicit flight holds altitude until the player descends
const FLIGHT_LIFT = 15.5;      // Space: controlled upward thrust
const FLIGHT_DESCENT = 10.5;   // Shift: deliberate fast descent
const FLIGHT_VERTICAL_DRAG = 1.15;
const FLIGHT_MAX_RISE = 9.5;
const FLIGHT_MAX_FALL = 7.5;
const PLAYER_R  = 0.7;    // collision radius while flying
const PLAYER_PREFS = {
  lookSensitivity: 1,
  groundLookSensitivity: 1,
  flightLookSensitivity: 0.9,
  invertY: false,
  cameraShake: true
};
const TOUCH_INPUT = { moveX: 0, moveY: 0, rise: 0, descend: 0 };
const URL_QUERY = new URLSearchParams(window.location.search);
const MOBILE_TEST = URL_QUERY.has('mobile-test');
const QA_STORY_COOP_PROBE = URL_QUERY.has('story-coop-qa');
const QA_ENEMY_COMBAT_PROBE = URL_QUERY.has('enemy-combat-qa');
const QA_BUILDING_FIRE_PROBE = URL_QUERY.has('building-fire-qa');
const QA_CHARACTER_ANIMATION_PROBE = URL_QUERY.has('character-animation-qa');
let UI_BLOCKS_STEERING = false;
const SKY_SETTINGS_KEY = 'sky-room-settings-v1';
// The Archive Warden's seal: how much longer a marked target stays readable and
// how much harder every follow-up shot lands on it.
const SEAL_DAMAGE_MULTIPLIER = 1.4;
const SEAL_DURATION = 6;
const PLAYER_CHARACTER_IDS = Object.freeze([
  ...PLAYABLE_CHARACTERS.map(character => character.id),
  'mercury-xbot'
]);
let UI_LANG = 'en';
try {
  const savedLanguage = JSON.parse(localStorage.getItem(SKY_SETTINGS_KEY) || '{}').language;
  UI_LANG = savedLanguage === 'zh-Hant' ? 'zh-Hant' : 'en';
} catch (_) { UI_LANG = 'en'; }

const tr = (english, chinese) => UI_LANG === 'zh-Hant' ? chinese : english;
function applyDocumentLanguage() {
  const zh = UI_LANG === 'zh-Hant';
  document.documentElement.lang = zh ? 'zh-Hant' : 'en';
  for (const el of document.querySelectorAll('[data-en][data-zh]')) {
    el.textContent = zh ? el.dataset.zh : el.dataset.en;
  }
  for (const el of document.querySelectorAll('[data-en-aria][data-zh-aria]')) {
    el.setAttribute('aria-label', zh ? el.dataset.zhAria : el.dataset.enAria);
  }
}
applyDocumentLanguage();
const settingCharacter = document.getElementById('settingCharacter');
settingCharacter.replaceChildren(...[
  ...PLAYABLE_CHARACTERS.map(character => {
    const option = document.createElement('option');
    option.value = character.id;
    option.dataset.en = `${character.name} · ${character.role.en}`;
    option.dataset.zh = `${character.name} · ${character.role.zh}`;
    option.textContent = UI_LANG === 'zh-Hant' ? option.dataset.zh : option.dataset.en;
    return option;
  }),
  (() => {
    const option = document.createElement('option');
    option.value = 'mercury-xbot';
    option.dataset.en = 'Mercury Xbot · Chrome Voyager';
    option.dataset.zh = '水銀 Xbot · 鍍鉻旅人';
    option.textContent = UI_LANG === 'zh-Hant' ? option.dataset.zh : option.dataset.en;
    return option;
  })()
]);
document.body.dataset.inputDevice = matchMedia('(pointer: coarse)').matches || MOBILE_TEST ? 'touch' : 'keyboard';
window.addEventListener('keydown', event => { if (event.isTrusted) document.body.dataset.inputDevice = 'keyboard'; }, true);
window.addEventListener('pointerdown', event => {
  if (event.pointerType === 'touch') document.body.dataset.inputDevice = 'touch';
}, true);

// Keep keyboard focus inside the active modal while still allowing every
// action to be reached in source order.
document.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const modal = document.querySelector('#settingsPanel.open, #storyLobby.on, #clueBoard.on, #gardenChoice.on, #characterSelect.on');
  if (!modal) return;
  const focusable = [...modal.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hidden && element.getClientRects().length);
  if (!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}, true);

// the grand keep that hosts the great hall — Buildings() and GreatHall() share it
const HALL = { x: 0, z: -80, w: 34, d: 18, h: 24, ry: 0 };
const EXPLORABLES = [
  { id: 'archive', x: -35, z: -25, ry: 0.95, title: 'MOON ARCHIVE' },
  { id: 'alchemy', x: 35, z: -27, ry: -0.91, title: "ALCHEMIST'S WORKSHOP" },
  { id: 'infirmary', x: -52, z: -8, ry: 1.42, title: 'MOON INFIRMARY' },
  { id: 'practice', x: 52, z: -10, ry: -1.38, title: 'PRACTICE HALL' },
  { id: 'owlpost', x: 0, z: 45, ry: Math.PI, title: 'OWL POST' }
];
const roomRegistry = createRoomRegistry({ hall: HALL, explorables: EXPLORABLES });
const combatTrainingRoomAt = position => ['practice', 'alchemy']
  .some(id => roomRegistry.contains(roomRegistry.get(id), position));

// solid-world colliders, filled while the city is built.
// { kind:'cyl', x, z, r, y0, y1 } or { kind:'box', x, z, hw, hd, y0, y1, cos, sin }
const COLLIDERS = [];
let COLLIDER_INDEX = null;
const SPELL_TARGETS = [];
const ENV_THREAT_SOURCES = []; // active Unlight corruption sampled by landscape and lamps
const ENV_RESTORE_PULSES = []; // cleansing waves relight foliage, petals, and nearby paths

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
const QA_LOCOMOTION_PROBE = URL_QUERY.has('locomotion-probe');
const QA_PVP_PROJECTILE_PROBE = URL_QUERY.has('pvp-projectile-probe');

const LIT_MATS = []; // every windowed wall material — brightened together at the finale

/* ================= renderer / scene ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.24;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
if (QA_LOCOMOTION_PROBE) renderer.domElement.dataset.roomRegistry = JSON.stringify(roomRegistry.qaSummary());

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);
scene.fog = new THREE.Fog(0x0c0d16, 14, 230); // moonlit night blue

const camera = new THREE.PerspectiveCamera(57, window.innerWidth / window.innerHeight, 0.1, 400);
camera.rotation.order = 'YXZ';

/* ================= Scene (static architecture + light) ================= */
/* ================= RuneMarker ================= */
function RuneMarker() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.strokeStyle = '#e8b06a';
  g.lineCap = 'round';
  const cx = 256, cy = 256;
  g.lineWidth = 7;
  circle(g, cx, cy, 226);
  g.lineWidth = 2.5;
  circle(g, cx, cy, 196);
  circle(g, cx, cy, 96);
  // radial glyph ticks between the rings
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r1 = 200, r2 = i % 4 === 0 ? 222 : 212;
    g.lineWidth = i % 4 === 0 ? 4 : 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    g.stroke();
  }
  // inner script-like arcs
  g.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2 + 0.2;
    g.beginPath();
    g.arc(cx, cy, 140, a0, a0 + 0.75);
    g.stroke();
    g.beginPath();
    g.arc(cx + Math.cos(a0) * 140, cy + Math.sin(a0) * 140, 12, 0, Math.PI * 2);
    g.stroke();
  }
  // center mark
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(cx, cy - 52); g.lineTo(cx, cy + 52); g.stroke();
  g.beginPath(); g.moveTo(cx - 34, cy - 20); g.lineTo(cx + 34, cy + 20); g.stroke();
  g.beginPath(); g.moveTo(cx + 34, cy - 20); g.lineTo(cx - 34, cy + 20); g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(0, 0.02, 0);
  scene.add(mesh);

  return {
    mesh,
    update(t) {
      mat.opacity = 0.68 + Math.sin(t * 1.6) * 0.22;
      mesh.rotation.z = t * 0.05;
    }
  };

  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
}

/* ================= Particles (dust motes) ================= */
function Particles(count = 650) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 2); // phase, rise speed
  for (let i = 0; i < count; i++) {
    const r = Math.sqrt(Math.random()) * 24;
    const a = Math.random() * Math.PI * 2;
    pos[i * 3]     = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.random() * 44;
    pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i * 2]     = Math.random() * Math.PI * 2;
    seed[i * 2 + 1] = 0.05 + Math.random() * 0.16;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const mat = new THREE.PointsMaterial({
    map: radialTexture('rgba(240,224,196,1)', 'rgba(240,224,196,0)', 64),
    color: 0xe8caA0, size: 0.16, sizeAttenuation: true,
    transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const attr = geo.attributes.position;
  let accumulatedDt = 0;
  return {
    mat,
    update(t, dt) {
      // Slow dust does not need a full-frame buffer upload; adaptive mode can
      // reduce it further without affecting navigation or combat readability.
      accumulatedDt += dt;
      const particleHz = settings?.prefs?.runtimePerformance ? 20 : 30;
      if (accumulatedDt < 1 / particleHz) return;
      dt = Math.min(accumulatedDt, 0.066);
      accumulatedDt = 0;
      const a = attr.array;
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      for (let i = 0; i < count; i++) {
        const ph = seed[i * 2];
        a[i * 3]     += Math.sin(t * 0.35 + ph) * 0.09 * dt;
        a[i * 3 + 1] += seed[i * 2 + 1] * dt;
        a[i * 3 + 2] += Math.cos(t * 0.28 + ph * 1.7) * 0.09 * dt;
        // wrap the field around the player so motes surround you wherever you fly
        if (a[i * 3] - cx > 26) a[i * 3] -= 52; else if (a[i * 3] - cx < -26) a[i * 3] += 52;
        if (a[i * 3 + 1] - cy > 22) a[i * 3 + 1] -= 44; else if (a[i * 3 + 1] - cy < -22) a[i * 3 + 1] += 44;
        if (a[i * 3 + 2] - cz > 26) a[i * 3 + 2] -= 52; else if (a[i * 3 + 2] - cz < -26) a[i * 3 + 2] += 52;
      }
      attr.needsUpdate = true;
    }
  };
}

/* ================= CloakedFigure (player avatar + hall residents) ================= */
// Low-poly hooded figure, faces -z at rotation 0. Hem vertices are animated:
// idle sway on the ground, streaming backward with speed in flight.
function CloakedFigure({ cloak = 0x232433, lantern = false, plain = false,
  accent = null, cloakWidth = 1, hoodStyle = 'soft',
  lanternColor = 0xffb464, glowIn = 'rgba(255,190,110,0.7)', glowOut = 'rgba(255,170,80,0)' } = {}) {
  const g = new THREE.Group();
  const cloakMat = new THREE.MeshStandardMaterial({
    color: cloak, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide,
    emissive: 0xffffff, emissiveIntensity: 0 // pulsed white on hit
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x0d0b12, roughness: 0.9 });
  const accentColor = accent ?? (plain ? 0x4a3d2c : 0xb08a46);
  const goldMat = plain // monks wear rope, travelers wear gold
    ? new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.72, metalness: 0.22 })
    : new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.35, metalness: 0.85 });

  // cloak — lathe from hem (y=0) to shoulder line
  const profile = [
    new THREE.Vector2(0.52 * cloakWidth, 0), new THREE.Vector2(0.47 * cloakWidth, 0.24),
    new THREE.Vector2(0.40 * cloakWidth, 0.55), new THREE.Vector2(0.32 * cloakWidth, 0.88),
    new THREE.Vector2(0.25 * cloakWidth, 1.12), new THREE.Vector2(0.21 * cloakWidth, 1.30)
  ];
  const cloakGeo = new THREE.LatheGeometry(profile, 18);
  const cloakMesh = new THREE.Mesh(cloakGeo, cloakMat);
  cloakMesh.castShadow = !plain;
  g.add(cloakMesh);
  // Only player/combat figures deform their cape. Background NPCs use the
  // group sway below, avoiding dozens of geometry uploads every frame.
  const basePos = plain ? null : cloakGeo.attributes.position.array.slice();
  let cloakWeights = null, cloakPhases = null;
  if (basePos) {
    const count = cloakGeo.attributes.position.count;
    cloakWeights = new Float32Array(count);
    cloakPhases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const bx = basePos[i * 3], by = basePos[i * 3 + 1], bz = basePos[i * 3 + 2];
      cloakWeights[i] = Math.pow(Math.max(0, 1 - by / 1.3), 1.6);
      cloakPhases[i] = Math.atan2(bz, bx);
    }
  }

  const put = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = !plain; g.add(mesh); return mesh; };
  const shoulders = put(new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 12), cloakMat), 0, 1.32, 0);
  shoulders.scale.set(1, 0.72, 0.9);
  const hood = put(new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 12), cloakMat), 0, 1.5, 0.02);
  hood.scale.set(1, 1.08, 1.05);
  const peak = put(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 10), cloakMat), 0, 1.66, 0.06);
  peak.rotation.x = 0.42; // drapes back off the hood
  if (hoodStyle === 'round') peak.scale.set(0.55, 0.38, 0.55);
  else if (hoodStyle === 'tall') { peak.scale.set(1, 1.55, 1); peak.position.y += 0.09; }
  else if (hoodStyle === 'pointed' || hoodStyle === 'sharp') peak.scale.set(0.9, 1.25, 0.9);
  else if (hoodStyle === 'folded') { peak.scale.set(1.12, 0.72, 1.12); peak.rotation.x = 0.9; }
  put(new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0x050308 })), 0, 1.5, -0.115); // shadowed face
  const belt = put(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 8, 24), goldMat), 0, 0.98, 0);
  belt.rotation.x = Math.PI / 2;
  put(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), goldMat), 0, 1.26, -0.19); // clasp

  let lanternRig = null, glowRef = null, liRef = null, flareAmt = 0, hitAmt = 0, dimAmt = 0, dimTarget = 0;
  if (lantern) {
    const arm = put(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.52, 8), cloakMat), 0.27, 1.06, -0.14);
    arm.rotation.set(0.5, 0, -0.55);
    lanternRig = new THREE.Group();
    lanternRig.position.set(0.38, 0.82, -0.28);
    const cap = (y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.105, 0.035, 8), darkMat); m.position.y = y; lanternRig.add(m); };
    cap(0.1); cap(-0.1);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 14), darkMat);
    loop.position.y = 0.15;
    lanternRig.add(loop);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 8),
      new THREE.MeshStandardMaterial({ color: lanternColor, roughness: 0.4, emissive: lanternColor, emissiveIntensity: 2.2 }));
    lanternRig.add(glass);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: radialTexture(glowIn, glowOut, 64),
      transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(0.85);
    lanternRig.add(glow);
    // NPC lanterns keep their emissive glass and sprite glow, but not an
    // expensive dynamic light. The player light remains gameplay-readable.
    const li = plain ? null : new THREE.PointLight(lanternColor, 4, 8, 1.8);
    if (li) lanternRig.add(li);
    g.add(lanternRig);
    glowRef = glow;
    liRef = li;
  }

  return {
    group: g,
    update(t, dt, speed = 0) {
      if (basePos) {
        const attr = cloakGeo.attributes.position;
        for (let i = 0; i < attr.count; i++) {
          const bx = basePos[i * 3], by = basePos[i * 3 + 1], bz = basePos[i * 3 + 2];
          const f = cloakWeights[i], ph = cloakPhases[i]; // cached: hem moves most
          attr.array[i * 3]     = bx + Math.sin(t * 3.1 + ph * 2 + by * 3) * 0.05 * f * (0.35 + speed);
          attr.array[i * 3 + 2] = bz + Math.cos(t * 2.6 + ph * 3) * 0.05 * f * (0.35 + speed)
                                + f * speed * 0.45; // wind streams the hem behind
        }
        attr.needsUpdate = true;
      }
      g.scale.y = 1 + Math.sin(t * 1.7) * 0.008; // breathing
      cloakMat.emissiveIntensity = hitAmt * 0.45;  // white sting when struck
      hitAmt *= Math.exp(-dt * 7);
      if (lanternRig) {
        lanternRig.rotation.x = Math.sin(t * 1.9) * 0.12 - speed * 0.3;
        lanternRig.rotation.z = Math.cos(t * 1.5) * 0.1;
        dimAmt = lerp(dimAmt, dimTarget, Math.min(1, dt * 5)); // hushing the flame
        glowRef.material.opacity = (0.5 + flareAmt * 0.5) * (1 - dimAmt * 0.92);
        if (liRef) liRef.intensity = (4 + flareAmt * 8) * (1 - dimAmt * 0.94);
        flareAmt *= Math.exp(-dt * 6);
      }
    },
    flare() { flareAmt = 1; dimTarget = 0; },
    hit() { hitAmt = 1; },
    setDim(v) { dimTarget = v; },
    get dim() { return dimAmt; }
  };
}

// Builds a distinct low-poly resident from editable character data. Equipment
// stays deliberately simple so 18 authored silhouettes remain inexpensive.
function ResidentCharacter(profile, { player = false, cloakOverride = null } = {}) {
  const appearance = { ...profile.appearance };
  if (cloakOverride) appearance.cloak = cloakOverride;
  const carriesLantern = player || (appearance.lantern ??
    ['warden', 'courier', 'healer', 'keeper', 'dreamer'].includes(profile.archetype));
  const lanternColor = colorNumber(appearance.lanternColor, 0xffb464);
  const fig = CloakedFigure({
    cloak: colorNumber(appearance.cloak, 0x302b3d),
    accent: colorNumber(appearance.accent, 0xb08a46),
    cloakWidth: appearance.width || 1,
    hoodStyle: appearance.hood || 'soft',
    lantern: carriesLantern,
    plain: !player,
    lanternColor,
    glowIn: `rgba(${(lanternColor >> 16) & 255},${(lanternColor >> 8) & 255},${lanternColor & 255},0.68)`,
    glowOut: 'rgba(0,0,0,0)'
  });
  const group = fig.group;
  const accent = new THREE.MeshStandardMaterial({
    color: colorNumber(appearance.accent, 0xb08a46), roughness: 0.58, metalness: 0.42
  });
  const cloth = new THREE.MeshStandardMaterial({
    color: colorNumber(appearance.cloak, 0x302b3d), roughness: 0.9, metalness: 0.02,
    side: THREE.DoubleSide
  });
  const weaponColor = colorNumber(profile.weapon.color, 0xe8b06a);
  const weaponMat = new THREE.MeshStandardMaterial({
    color: weaponColor, roughness: 0.42, metalness: 0.58,
    emissive: weaponColor, emissiveIntensity: 0.18
  });
  const dark = new THREE.MeshStandardMaterial({ color: 0x17151c, roughness: 0.76, metalness: 0.24 });
  const add = (mesh, x, y, z, parent = group) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = false;
    parent.add(mesh);
    return mesh;
  };

  const accessory = appearance.accessory || 'none';
  if (['book', 'folio', 'spellbook', 'star-chart'].includes(accessory)) {
    const book = add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.045, 0.45), accent), 0, 1.02, -0.34);
    book.rotation.x = -0.28;
    if (accessory === 'star-chart') book.scale.x = 1.28;
  } else if (accessory === 'floating-pages') {
    for (let i = 0; i < 3; i++) {
      const page = add(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.31), accent), -0.24 + i * 0.24, 1.05 + i * 0.12, -0.33 + Math.abs(i - 1) * 0.08);
      page.rotation.set(-0.25 + i * 0.16, i * 0.3, 0.12 - i * 0.1);
    }
  } else if (['vials', 'healer-belt', 'tool-belt'].includes(accessory)) {
    for (let i = 0; i < 3; i++) {
      const vialMat = accessory === 'healer-belt' ? weaponMat : (i % 2 ? accent : weaponMat);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 6), vialMat), -0.16 + i * 0.16, 0.86, -0.28);
    }
    if (accessory === 'tool-belt') add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.09), dark), 0.28, 0.85, -0.2);
  } else if (['pauldrons', 'single-pauldron', 'scarred-pauldron'].includes(accessory)) {
    const left = add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), accent), -0.28, 1.3, 0);
    left.scale.set(1.25, 0.55, 1);
    if (accessory === 'pauldrons') {
      const right = add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), accent), 0.28, 1.3, 0);
      right.scale.copy(left.scale);
    }
  } else if (['satchel', 'tiny-satchel'].includes(accessory)) {
    const size = accessory === 'tiny-satchel' ? 0.72 : 1;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.3 * size, 0.34 * size, 0.14), dark), 0.36, 0.78, 0.02);
    const strap = add(new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.018, 5, 16, Math.PI), accent), 0.03, 1.05, 0.02);
    strap.rotation.set(0, Math.PI / 2, -0.68);
  } else if (accessory === 'owl-mask') {
    const mask = add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 7), accent), 0, 1.5, -0.18);
    mask.scale.set(1.15, 0.82, 0.3);
    for (const x of [-0.06, 0.06]) add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), dark), x, 1.52, -0.225);
  } else if (accessory === 'feather') {
    const feather = add(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.38, 6), accent), 0.18, 1.78, 0.06);
    feather.rotation.z = -0.35;
  } else if (accessory === 'half-cape') {
    const cape = add(new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.86), cloth), 0.25, 0.94, 0.11);
    cape.rotation.set(0.12, 0.42, -0.08);
  } else if (accessory === 'scarf') {
    const scarf = add(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 6, 18), accent), 0, 1.29, 0);
    scarf.rotation.x = Math.PI / 2;
  } else if (['moon-charm', 'thread-charms'].includes(accessory)) {
    const count = accessory === 'thread-charms' ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const charm = add(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 10), weaponMat), (i - (count - 1) / 2) * 0.12, 1.05 - i * 0.04, -0.28);
      charm.rotation.x = Math.PI / 2;
    }
  }

  const weapon = new THREE.Group();
  weapon.name = `${profile.id}:${profile.weapon.name}`;
  group.add(weapon);
  if (profile.weapon.type === 'staff') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.035, 1.72, 7), dark), -0.4, 0.84, 0, weapon);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), weaponMat), -0.4, 1.7, 0, weapon);
  } else if (profile.weapon.type === 'moonbow') {
    const bow = add(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.023, 6, 20, Math.PI * 1.45), weaponMat), -0.35, 1.02, -0.04, weapon);
    bow.rotation.set(0, 0.35, Math.PI * 0.24);
    const string = add(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.62, 4), accent), -0.35, 1.02, -0.04, weapon);
    string.rotation.z = -0.22;
  } else if (profile.weapon.type === 'flask') {
    add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), weaponMat), -0.34, 0.96, -0.22, weapon);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 6), dark), -0.34, 1.08, -0.22, weapon);
  } else {
    const wand = add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.027, 0.68, 7), dark), -0.34, 1.03, -0.2, weapon);
    wand.rotation.z = -0.72;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 7, 5), weaponMat), -0.12, 1.28, -0.2, weapon);
  }
  fig.profile = profile;
  fig.weaponGroup = weapon;
  return fig;
}

// Rigged Three.js Xbot supplied in mercury-xbot-game-package.zip. The model is
// loaded only when selected, so the normal Sky Room startup stays lightweight.
async function MercuryXbotFigure() {
  const gltf = await characterGLTFLoader().loadAsync(
    new URL('../assets/models/mercury-xbot.glb', import.meta.url).href
  );
  const group = new THREE.Group();
  const model = gltf.scene;
  model.rotation.y = Math.PI; // match the Sky Room avatar's -Z-facing convention
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const modelHeight = Math.max(0.001, bounds.max.y - bounds.min.y);
  const modelScale = 1.76 / modelHeight;
  model.scale.setScalar(modelScale);
  model.position.y = -bounds.min.y * modelScale;

  const mercuryMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#b9c7dc'),
    emissive: new THREE.Color('#10192c'),
    emissiveIntensity: 0.22,
    metalness: 1,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 2.8,
    iridescence: 0.72,
    iridescenceIOR: 1.45,
    iridescenceThicknessRange: [120, 460]
  });
  const replacedMaterials = new Set();
  model.traverse(node => {
    if (!node.isMesh) return;
    const originals = Array.isArray(node.material) ? node.material : [node.material];
    originals.filter(Boolean).forEach(material => replacedMaterials.add(material));
    node.material = mercuryMaterial;
    node.castShadow = true;
    node.receiveShadow = true;
    node.frustumCulled = false;
  });
  replacedMaterials.forEach(material => material.dispose?.());
  group.add(model);

  // Keep the imported character readable as the Lantern Bearer in the dark.
  const lantern = new THREE.Group();
  lantern.position.set(0.44, 0.92, -0.18);
  const lanternGlass = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xaeefff, emissive: 0x7edfff, emissiveIntensity: 2.6,
      roughness: 0.22, metalness: 0.08
    })
  );
  const lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture('rgba(150,235,255,0.78)', 'rgba(70,130,255,0)', 64),
    transparent: true, opacity: 0.62, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  lanternGlow.scale.setScalar(0.82);
  const lanternLight = new THREE.PointLight(0x91e8ff, 5.2, 9, 1.8);
  lantern.add(lanternGlass, lanternGlow, lanternLight);
  group.add(lantern);

  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map(gltf.animations.map(clip => [clip.name.toLowerCase(), clip]));
  const rig = {
    hips: model.getObjectByName('mixamorig:Hips'),
    spine: model.getObjectByName('mixamorig:Spine2') || model.getObjectByName('mixamorig:Spine'),
    leftArm: model.getObjectByName('mixamorig:LeftArm'),
    rightArm: model.getObjectByName('mixamorig:RightArm'),
    leftForeArm: model.getObjectByName('mixamorig:LeftForeArm'),
    rightForeArm: model.getObjectByName('mixamorig:RightForeArm'),
    leftUpLeg: model.getObjectByName('mixamorig:LeftUpLeg'),
    rightUpLeg: model.getObjectByName('mixamorig:RightUpLeg'),
    leftLeg: model.getObjectByName('mixamorig:LeftLeg'),
    rightLeg: model.getObjectByName('mixamorig:RightLeg')
  };
  let currentAction = null;
  let currentName = '';
  let flareAmount = 0;
  let airPose = 0;
  const play = name => {
    if (name === currentName) return;
    const clip = clips.get(name) || clips.get('idle');
    if (!clip) return;
    const next = mixer.clipAction(clip);
    next.reset().fadeIn(0.18).play();
    currentAction?.fadeOut(0.18);
    currentAction = next;
    currentName = name;
  };
  play('idle');

  return {
    group,
    update(t, dt, speed = 0, motion = {}) {
      const state = motion.state || 'ground';
      const forward = clamp((motion.horizontalSpeed || 0) / FLY_SPEED, 0, 1);
      const locomotion = state === 'flying'
        ? (speed > 0.62 ? 'run' : speed > 0.08 ? 'walk' : 'idle')
        : 'idle';
      // Preserve the original walk/run silhouette while gravity controls the
      // trajectory. The procedural air pose fades down as locomotion speeds up
      // so it supports rather than overwrites the authored animation.
      play(state === 'lifting' ? 'sneak_pose' : locomotion);
      if (currentAction) {
        currentAction.setEffectiveTimeScale(state === 'lifting' ? 0.55 : 0.82 + forward * 0.3);
      }
      mixer.update(dt);
      const airborne = state === 'lifting' || state === 'flying';
      airPose = lerp(airPose, airborne ? 1 : 0, Math.min(1, dt * (airborne ? 4.5 : 7)));
      const poseWeight = airPose * (1 - forward * 0.78);
      const vertical = clamp((motion.verticalSpeed || 0) / FLIGHT_MAX_RISE, -1, 1);
      const takeoff = state === 'lifting' ? Math.sin((motion.liftProgress || 0) * Math.PI) : 0;
      const drift = Math.sin(t * 2.2) * 0.035 * poseWeight;
      if (rig.spine) rig.spine.rotation.x += (-0.2 * forward + 0.08 * vertical - takeoff * 0.1) * poseWeight;
      if (rig.hips) rig.hips.rotation.z += drift * (0.35 + forward);
      if (rig.leftArm) rig.leftArm.rotation.z += (0.28 + forward * 0.34 + takeoff * 0.18) * poseWeight;
      if (rig.rightArm) rig.rightArm.rotation.z -= (0.28 + forward * 0.34 + takeoff * 0.18) * poseWeight;
      if (rig.leftForeArm) rig.leftForeArm.rotation.x += (-0.22 - Math.max(0, vertical) * 0.22) * poseWeight;
      if (rig.rightForeArm) rig.rightForeArm.rotation.x += (-0.22 - Math.max(0, vertical) * 0.22) * poseWeight;
      const legsDown = Math.max(0, -vertical);
      if (rig.leftUpLeg) rig.leftUpLeg.rotation.x += (0.12 + forward * 0.22 - drift + legsDown * 0.18) * poseWeight;
      if (rig.rightUpLeg) rig.rightUpLeg.rotation.x += (0.12 + forward * 0.22 + drift + legsDown * 0.18) * poseWeight;
      if (rig.leftLeg) rig.leftLeg.rotation.x += (-0.24 - forward * 0.18 - legsDown * 0.16) * poseWeight;
      if (rig.rightLeg) rig.rightLeg.rotation.x += (-0.24 - forward * 0.18 - legsDown * 0.16) * poseWeight;
      flareAmount *= Math.exp(-dt * 6);
      mercuryMaterial.emissiveIntensity = 0.22 + flareAmount * 1.5;
      lanternGlass.material.emissiveIntensity = 2.6 + flareAmount * 3.6;
      lanternGlow.material.opacity = 0.62 + flareAmount * 0.34;
      lanternLight.intensity = 5.2 + flareAmount * 8;
      lantern.rotation.x = Math.sin(mixer.time * 1.8) * 0.08 - speed * 0.18;
    },
    flare() { flareAmount = 1; },
    dispose() {
      mixer.stopAllAction();
      const geometries = new Set();
      const materials = new Set();
      group.traverse(node => {
        if (node.geometry) geometries.add(node.geometry);
        const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
        nodeMaterials.filter(Boolean).forEach(material => materials.add(material));
      });
      geometries.forEach(geometry => geometry.dispose?.());
      materials.forEach(material => { material.map?.dispose?.(); material.dispose?.(); });
    }
  };
}

// the traveler you play: rises off the rune, banks and leans in flight
function PlayerAvatar() {
  const g = new THREE.Group();
  g.position.set(STORY_START.x, 0.04, STORY_START.z);
  scene.add(g);
  let fig = null;
  let characterId = 'resident-01';
  let selectionVersion = 0;
  const positiveAnimationDuration = (value, fallback = 0.7) => {
    const duration = Number(value);
    return Number.isFinite(duration) && duration > 0 ? duration : fallback;
  };
  function disposeFigure(figure) {
    if (!figure) return;
    if (figure.dispose) { figure.dispose(); return; }
    const geometries = new Set();
    const materials = new Set();
    figure.group.traverse(node => {
      if (node.geometry) geometries.add(node.geometry);
      const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
      nodeMaterials.filter(Boolean).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose?.());
    materials.forEach(material => { material.map?.dispose?.(); material.dispose?.(); });
  }
  function replaceFigure(next, height = 1) {
    if (fig) { g.remove(fig.group); disposeFigure(fig); }
    fig = next;
    g.scale.set(1, height, 1);
    g.add(fig.group);
  }
  function setCharacter(id, cloakColor = null) {
    const version = ++selectionVersion;
    characterId = PLAYER_CHARACTER_IDS.includes(id) ? id : PLAYER_CHARACTER_IDS[0];
    const entry = playableCharacter(characterId);
    if (entry.id === characterId && entry.model) {
      const fallback = ResidentCharacter(characterProfile(entry.profileId), {
        player: true, cloakOverride: cloakColor
      });
      replaceFigure(fallback, 1);
      loadPlayableCharacter(entry, {
        createFallback: () => ResidentCharacter(characterProfile(entry.profileId), {
          player: true, cloakOverride: cloakColor
        })
      }).then(loaded => {
        if (version !== selectionVersion || characterId !== entry.id) {
          disposeCharacterFigure(loaded);
          return;
        }
        // Imported heroes declare their authored-to-gameplay forward-axis
        // correction in the manifest. Selection keeps the authored front;
        // gameplay rotates the visual once inside the movement root.
        loaded.group.rotation.y = Number.isFinite(entry.gameplayRotationY)
          ? entry.gameplayRotationY : 0;
        const baseModelPosition = loaded.group.position.clone();
        const baseModelQuaternion = loaded.group.quaternion.clone();
        const animation = new CharacterAnimationController(loaded);
        animation.play('idle');
        let override = null, overrideRemaining = 0, overrideDuration = 0;
        let overrideElapsed = 0, overridePersistent = false, overrideToken = 0;
        let previousPoseState = 'ground';
        let castVariant = 0;
        const beginOverride = (name, seconds = null) => {
          override = name;
          overrideDuration = positiveAnimationDuration(seconds, animation.preferredDuration(name, 0.7));
          overrideRemaining = overrideDuration;
          overrideElapsed = 0;
          overridePersistent = name === 'down';
          overrideToken++;
        };
        const animated = {
          group: loaded.group,
          get modelInfo() { return {
            source: loaded.source,
            animations: loaded.animations.map(clip => clip.name),
            attachments: Object.fromEntries(Object.entries(loaded.attachments || {}).map(([name, attachment]) => [
              name, { nodeName: attachment.nodeName, resolved: Boolean(attachment.node), offset: attachment.offset }
            ])),
            currentAnimation: animation.current,
            currentClip: animation.currentClip
          }; },
          attachments: loaded.attachments,
          supportsAnimation(name) { return animation.supports(name); },
          // Alternate the two authored casts so repeated attacks never replay
          // one identical motion.
          flare() {
            castVariant = animation.supports('castB') ? 1 - castVariant : 0;
            beginOverride(castVariant ? 'castB' : 'cast');
          },
          playAnimation(name, seconds = null) { beginOverride(name, seconds); },
          update(t, dt, speed, pose) {
            const landed = pose.state === 'ground'
              && (previousPoseState === 'flying' || previousPoseState === 'lifting');
            previousPoseState = pose.state;
            if (landed && !override) {
              beginOverride('land', animation.preferredDuration('land', 0.45));
            }
            let state = pose.state === 'lifting' ? 'lift' : pose.state === 'flying'
              ? 'fly' : speed > 0.58 ? 'run' : speed > 0.04 ? 'walk' : 'idle';
            // Flight reads as two motions: a held hover, and a committed glide
            // once the hero is actually travelling.
            if (state === 'fly' && speed > 0.42 && animation.supports('flyGlide')) {
              state = 'flyGlide';
            }
            // A badly hurt hero carries the wound into their walk.
            if ((state === 'walk' || state === 'run') && GAME.hp > 0
              && GAME.hp < GAME.maxHp * 0.32 && animation.supports('wounded')) {
              state = 'wounded';
            }
            let animationOptions = {};
            if (override && (overridePersistent || overrideRemaining > 0)) {
              state = override;
              overrideElapsed += dt;
              if (!overridePersistent) overrideRemaining -= dt;
              animationOptions = { duration: overrideDuration, restartToken: overrideToken };
            } else {
              override = null;
              overrideRemaining = 0;
              overrideElapsed = 0;
              overridePersistent = false;
            }
            loaded.group.position.copy(baseModelPosition);
            loaded.group.quaternion.copy(baseModelQuaternion);
            if (state === 'hit' && animation.usesFallbackState('hit')) {
              const progress = Math.min(1, overrideElapsed / Math.max(0.01, overrideDuration));
              loaded.group.rotateZ(Math.sin(progress * Math.PI) * 0.14);
              loaded.group.position.y += Math.sin(progress * Math.PI) * 0.035;
            } else if (state === 'down' && animation.usesFallbackState('down')) {
              const progress = Math.min(1, overrideElapsed / 0.58);
              const eased = progress * progress * (3 - 2 * progress);
              loaded.group.rotateZ(eased * 1.16);
              loaded.group.position.y -= eased * 0.16;
            } else if (state === 'land' && animation.usesFallbackState('land')) {
              const progress = Math.min(1, overrideElapsed / Math.max(0.01, overrideDuration));
              const settle = Math.sin(progress * Math.PI);
              loaded.group.position.y -= settle * 0.055;
              loaded.group.rotateX(settle * 0.07);
            }
            animation.update(t, dt, state, animationOptions);
          },
          dispose() { animation.dispose(); disposeCharacterFigure(loaded); }
        };
        replaceFigure(animated, entry.scale || 1);
      }).catch(error => console.warn(`Could not activate ${entry.name}; keeping the procedural fallback.`, error));
      return;
    }
    if (characterId === 'mercury-xbot') {
      // A lantern figure remains visible while the GLB is fetched and parsed.
      const fallback = ResidentCharacter(characterProfile('resident-01'), {
        player: true, cloakOverride: cloakColor
      });
      replaceFigure(fallback, 1);
      MercuryXbotFigure().then(next => {
        if (version !== selectionVersion || characterId !== 'mercury-xbot') {
          next.dispose();
          return;
        }
        replaceFigure(next, 1);
      }).catch(error => console.warn('Mercury Xbot could not be loaded; keeping the fallback avatar.', error));
      return;
    }
    const profile = characterProfile(characterId);
    replaceFigure(ResidentCharacter(profile, { player: true, cloakOverride: cloakColor }), profile.appearance.height || 1);
  }
  setCharacter(settings.prefs.characterId, settings.prefs.cloakColor);
  let heading = STORY_START.yaw, lean = 0, roll = 0;
  return {
    group: g,
    get characterId() { return characterId; },
    get modelInfo() { return fig?.modelInfo || {
      source: 'procedural', animations: [], currentAnimation: null, currentClip: null
    }; },
    setCharacter,
    flare() { fig?.flare(); },
    supportsAnimation(name) { return Boolean(fig?.supportsAnimation?.(name)); },
    playAnimation(name, seconds) { fig?.playAnimation?.(name, seconds); },
    update(t, dt, state, pos, yaw, vel, liftE) {
      const horizontalSpeed = Math.hypot(vel.x, vel.z);
      const speed = state === 'flying' ? Math.min(1, horizontalSpeed / FLY_SPEED)
        : state === 'lifting' ? 0.45 : Math.min(1, horizontalSpeed / 4.3);
      if (state === 'ground') {
        if (horizontalSpeed > 0.08) {
          const target = Math.atan2(-vel.x, -vel.z);
          const delta = ((target - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          heading += delta * Math.min(1, dt * 12);
        }
        g.position.set(pos.x, pos.y - GROUND_Y + 0.04, pos.z);
        g.rotation.set(0, heading, 0);
      } else if (state === 'lifting') {
        const groundVisualY = pos.y - GROUND_Y + 0.04;
        g.position.set(pos.x, lerp(groundVisualY, pos.y - 0.85, liftE), pos.z);
        g.rotation.set(0, heading + Math.sin(liftE * Math.PI) * 0.12, 0);
      } else {
        const hspeed = Math.hypot(vel.x, vel.z);
        const target = hspeed > 0.8 ? Math.atan2(-vel.x, -vel.z) : yaw;
        const dh = ((target - heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        const step = dh * Math.min(1, dt * 14);
        heading += step;
        roll = lerp(roll, clamp(-step / Math.max(dt, 1e-4) * 0.22, -0.5, 0.5), Math.min(1, dt * 4));
        lean = lerp(lean, Math.min(0.6, hspeed * 0.042) - vel.y * 0.012, Math.min(1, dt * 4));
        const bob = Math.sin(t * (Math.PI * 2 / BOB_PERIOD)) * BOB_AMP * (1 - speed * 0.7);
        g.position.set(pos.x, pos.y - 0.85 + bob, pos.z);
        g.rotation.set(0, heading, 0);
        g.rotateX(lean);
        g.rotateZ(roll);
      }
      fig?.update(t, dt, speed, {
        state,
        horizontalSpeed,
        verticalSpeed: vel.y,
        liftProgress: liftE
      });
    }
  };
}

/* ================= The Lantern Bearer — story & game systems ================= */
// Act 1: recover the three drifting memories. Act 2: cleanse the Unlight.
// Act 3: carry the morning to the great hall's hearth. HP is the lantern itself.
const GAME = {
  phase: 0,            // 0 ground · 1 memories · 2 purge · 3 ritual · 4 dawn
  flightUnlocked: false,
  missionStartedAt: 0,
  missionCompletedAt: 0,
  hp: 100, maxHp: 100,
  relics: 0, relicsNeeded: 3,
  cleansed: 0, cleanseNeeded: 1,
  lastHitAt: -99,
  weapon: 1,           // 1 ember bolt · 2 scatter fan · 3 moonbow (drawn shot)
  // Compact multiplayer-safe foundation for future signature abilities.
  roleState: { signatureActive: false, signatureCharge: 1, passive: 'second-sight', effect: null }
};
let game = null;       // assigned at boot
let siege = null;      // Lantern Vanguard director; null unless a siege is chosen
let storyCoopUI = null;

const hudEl = document.getElementById('hud');
const hpFillEl = document.getElementById('hpfill');
const objectiveEl = document.getElementById('objective');
const buildingEmergencyEl = document.getElementById('buildingEmergency');
const buildingEmergencyNameEl = buildingEmergencyEl?.querySelector('.building-emergency-name');
const buildingEmergencyStateEl = buildingEmergencyEl?.querySelector('.building-emergency-state');
const buildingEmergencyTrackEl = buildingEmergencyEl?.querySelector('.building-emergency-track i');
const buildingEmergencyActionEl = buildingEmergencyEl?.querySelector('.building-emergency-action');
const storyPartyEl = document.getElementById('storyParty');
const storyPartyStatusEl = storyPartyEl?.querySelector('.story-party-status');
const storyPartyClueEl = storyPartyEl?.querySelector('.story-party-clue');
const weaponEl = document.getElementById('weapon');
const crosshairEl = document.getElementById('crosshair');
const storyEl = document.getElementById('storycard');
const interactionPromptEl = document.getElementById('interactionPrompt');
const interactionKeyEl = interactionPromptEl?.querySelector('.interaction-key');
const interactionActionEl = interactionPromptEl?.querySelector('strong');
const interactionTargetEl = interactionPromptEl?.querySelector('em');
const interactionDetailEl = interactionPromptEl?.querySelector('small');
const vignetteEl = document.getElementById('vignette');
const fadeEl = document.getElementById('fade');
let storyTimer = 0;

function setInteractionPrompt(prompt = null) {
  const show = !!prompt && !UI_BLOCKS_STEERING;
  interactionPromptEl?.classList.toggle('on', show);
  interactionPromptEl?.setAttribute('aria-hidden', show ? 'false' : 'true');
  document.body.classList.toggle('interaction-active', show);
  if (!show) return;
  const device = document.body.dataset.inputDevice || 'keyboard';
  interactionKeyEl.textContent = prompt.key || (device === 'gamepad' ? 'X / □' : device === 'touch' ? tr('TAP', '點按') : 'E');
  interactionActionEl.textContent = prompt.action || tr('Interact', '互動');
  interactionTargetEl.textContent = prompt.target || '';
  interactionDetailEl.textContent = prompt.detail || '';
  interactionPromptEl.classList.toggle('blocked', !!prompt.blocked);
}

function storyCard(main, sub, holdMs = 5600) {
  const copy = String(main || '').toLowerCase();
  storyEl.dataset.speaker = copy.includes('mara') || copy.includes('瑪拉')
    ? tr('Mara Vale', '瑪拉・維爾')
    : copy.includes('warden') || copy.includes('守望者')
      ? tr('Bell Warden', '鐘樓守望者')
      : copy.includes('groundskeeper') || copy.includes('園丁')
        ? tr('Groundskeeper', '園丁')
        : tr('Story', '故事');
  storyEl.innerHTML = main + (sub ? `<small>${sub}</small>` : '');
  storyEl.classList.add('show');
  clearTimeout(storyTimer);
  storyTimer = setTimeout(() => storyEl.classList.remove('show'), holdMs);
}

// The Unlight is now a cast of readable corrupted memories rather than loose
// sprites. The public interface stays compatible with Story and Siege.
function Wisps(count = MAX_ACTIVE_ENEMIES, getTuning = () => combatTuning('normal', 1)) {
  const coreTex = radialTexture('rgba(190,120,255,1)', 'rgba(70,20,120,0)', 64);
  const moteTex = radialTexture('rgba(255,225,160,1)', 'rgba(255,170,80,0)', 64);
  const darkTex = radialTexture('rgba(9,3,15,0.82)', 'rgba(45,12,70,0)', 128);
  const CONFIG = ENEMY_ARCHETYPES;
  let s = 777123;
  const wr = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const _v = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _breachSeg = new THREE.Vector3();
  const _breachRel = new THREE.Vector3();
  const _breachClosest = new THREE.Vector3();
  const _breachPush = new THREE.Vector3();
  const list = [];
  const combatStats = {
    notices: 0,
    windups: 0,
    attacks: 0,
    hits: 0,
    blockedHits: 0,
    wallBlocks: 0,
    pathRecoveries: 0,
    dodges: 0,
    summons: 0
  };
  const effects = createCombatEffects({
    scene, camera, coreTexture: coreTex, moteTexture: moteTex,
    quality: settings.prefs.quality, reducedMotion: REDUCED_MOTION
  });
  const chancellorMagic = createChancellorMagic({
    scene, camera, coreTexture: coreTex,
    quality: settings.prefs.quality, reducedMotion: REDUCED_MOTION
  });

  function enemyVisual(type, ph) {
    const visual = new THREE.Group();
    const clothMat = new THREE.MeshStandardMaterial({
      color: type === 'groundskeeper' ? 0x121710 : 0x100b18,
      roughness: 0.94, metalness: 0.03, side: THREE.DoubleSide,
      emissive: 0x180b24, emissiveIntensity: 0.34
    });
    const maskMat = new THREE.MeshStandardMaterial({
      color: 0x9b856b, roughness: 0.92, metalness: 0.02,
      emissive: 0x382347, emissiveIntensity: 0.24
    });
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x201912, roughness: 1 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x2b2330, roughness: 0.48, metalness: 0.72 });
    const eye = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTex, color: 0xaf70ff, transparent: true, opacity: 0.86,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    let silhouetteScale = 1;

    if (type === 'stray') {
      const gown = new THREE.Mesh(new THREE.ConeGeometry(0.82, 2.45, 7, 2, true), clothMat);
      gown.position.y = -0.45;
      gown.rotation.z = 0.16;
      const shoulders = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.34, 0.58), clothMat);
      shoulders.position.set(0, 0.37, 0);
      shoulders.rotation.z = 0.12;
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.74), clothMat);
      hood.position.set(0.12, 0.78, 0);
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.46, 0.12), maskMat);
      mask.position.set(0.12, 0.68, 0.47);
      mask.rotation.z = -0.08;
      eye.position.set(0.12, 0.7, 0.57); eye.scale.set(0.42, 0.42, 1);
      for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 1.4, 6), clothMat);
        arm.position.set(side * 0.69, -0.04, 0.12);
        arm.rotation.z = side * 0.48;
        visual.add(arm);
      }
      visual.add(gown, shoulders, hood, mask, eye);
    } else if (type === 'groundskeeper') {
      silhouetteScale = 1.18;
      const gown = new THREE.Mesh(new THREE.ConeGeometry(1.08, 3.5, 8, 2, true), clothMat);
      gown.position.y = -0.55;
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.72, 1.65, 8), clothMat);
      torso.position.y = 0.58;
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 0.16), maskMat);
      mask.position.set(0, 1.35, 0.54);
      eye.position.set(0, 1.35, 0.66); eye.scale.set(0.6, 0.72, 1);
      visual.add(gown, torso, mask, eye);
      for (const side of [-1, 1]) for (let b = 0; b < 2; b++) {
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.11, 1.55 - b * 0.25, 6), branchMat);
        branch.position.set(side * (0.4 + b * 0.28), 1.72 + b * 0.28, 0);
        branch.rotation.z = side * (0.55 + b * 0.26);
        visual.add(branch);
      }
      for (let r = 0; r < 7; r++) {
        const root = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.2, 5), branchMat);
        const a = (r / 7) * Math.PI * 2;
        root.position.set(Math.cos(a) * 0.78, -1.88, Math.sin(a) * 0.78);
        root.rotation.z = Math.cos(a) * 0.85;
        root.rotation.x = Math.sin(a) * 0.85;
        visual.add(root);
      }
    } else {
      silhouetteScale = 1.42;
      const gown = new THREE.Mesh(new THREE.ConeGeometry(1.34, 4.2, 9, 3, true), clothMat);
      gown.position.y = -0.72;
      const mantle = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 1.28, 0.72, 10), clothMat);
      mantle.position.y = 0.72;
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.02, 0.2), maskMat);
      mask.position.set(0, 1.52, 0.65);
      eye.position.set(0, 1.52, 0.8); eye.scale.set(0.78, 0.9, 1);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.32, 0.08, 8, 40), metalMat);
      halo.position.set(0, 1.52, 0.02);
      halo.rotation.x = Math.PI / 2;
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.92, 1.0, 12, 1, true), metalMat);
      bell.position.set(0, -0.22, -0.52);
      bell.rotation.x = -0.22;
      visual.add(gown, mantle, mask, eye, halo, bell);
      for (const side of [-1, 1]) {
        const stole = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 3.1, 1, 5), maskMat);
        stole.position.set(side * 0.48, -0.18, 0.79);
        visual.add(stole);
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.7, 5), metalMat);
        chain.position.set(side * 0.88, -0.1, 0.08);
        chain.rotation.z = side * 0.08;
        visual.add(chain);
      }
    }

    const shadow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: darkTex, color: 0x160b22, transparent: true, opacity: 0.5, depthWrite: false
    }));
    shadow.scale.setScalar(type === 'bellwarden' ? 5.8 : type === 'groundskeeper' ? 4.5 : 3.2);
    shadow.position.y = 0.1;
    visual.add(shadow);

    const blackPositions = new Float32Array(30 * 3);
    for (let i = 0; i < 30; i++) {
      blackPositions[i * 3] = (wr() - 0.5) * 3.4;
      blackPositions[i * 3 + 1] = (wr() - 0.5) * 3.8;
      blackPositions[i * 3 + 2] = (wr() - 0.5) * 3.4;
    }
    const blackGeo = new THREE.BufferGeometry();
    blackGeo.setAttribute('position', new THREE.BufferAttribute(blackPositions, 3));
    const blackPetals = new THREE.Points(blackGeo, new THREE.PointsMaterial({
      color: 0x110916, size: type === 'bellwarden' ? 0.22 : 0.15,
      transparent: true, opacity: 0.82, depthWrite: false
    }));
    visual.add(blackPetals);
    visual.scale.setScalar(silhouetteScale);
    return { visual, clothMat, maskMat, eye, blackPetals, silhouetteScale, ph };
  }

  for (let i = 0; i < count; i++) {
    const type = i === 0 ? 'bellwarden' : (i % 5 === 0 ? 'groundskeeper' : 'stray');
    const cfg = CONFIG[type];
    const g = new THREE.Group();
    const art = enemyVisual(type, wr() * Math.PI * 2);
    g.add(art.visual);
    g.visible = false;
    scene.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({
      color: type === 'bellwarden' ? 0xffa76c : 0xb06dff,
      transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    scene.add(ring);
    const corruption = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({
      map: darkTex, color: 0x321342, transparent: true, opacity: 0,
      blending: THREE.MultiplyBlending, depthWrite: false
    }));
    corruption.rotation.x = -Math.PI / 2;
    corruption.visible = false;
    scene.add(corruption);
    const threat = { active: false, position: g.position, radius: cfg.corruption, intensity: 0 };
    ENV_THREAT_SOURCES.push(threat);
    list.push({
      type, cfg, g, art, ring, corruption, threat, ph: art.ph,
      home: new THREE.Vector3(), state: 'off', tState: 0, cool: 0,
      dir: new THREE.Vector3(), hp: cfg.hp, maxHp: cfg.hp,
      stage: 1, stageAnnounced: false, hitFlash: 0, sealed: 0,
      blockedFor: 0, avoidSign: i % 2 ? 1 : -1, spawnProtected: 0,
      navBefore: new THREE.Vector3(), navIntended: new THREE.Vector3(),
      staggerCooldown: 0, repeatedWeaponHits: 0,
      siegeRole: i % 3 === 1 ? 'building' : 'player'
    });
  }

  // The Hour-Eater: the Unlight incarnate. Replaces the procedural Bell Warden
  // body with the generated demon GLB once it loads; the procedural figure
  // remains the fallback if loading fails. Keeps the eye sprite, petal ring,
  // and ground shadow so the shared enemy state code needs no changes.
  let hourEaterRequested = false;
  function upgradeBellwarden(w) {
    if (!w || w.type !== 'bellwarden' || hourEaterRequested) return;
    hourEaterRequested = true;
    const dir = 'assets/models/characters/hour-eater/';
    const loader = characterGLTFLoader();
    loader.load(dir + 'hour-eater.glb', gltf => {
      const model = gltf.scene;
      const inv = 1 / w.art.silhouetteScale;
      model.scale.setScalar(inv);           // keep the authored 3 m height
      model.position.y = -1.5 * inv;        // center the body on the float origin
      let bodyMat = null;
      model.traverse(n => { if (n.isSkinnedMesh || n.isMesh) bodyMat = bodyMat || (Array.isArray(n.material) ? n.material[0] : n.material); });
      const removable = [];
      w.art.visual.traverse(n => { if (n.isMesh) removable.push(n); });
      for (const mesh of removable) { mesh.parent.remove(mesh); mesh.geometry.dispose(); }
      w.art.visual.add(model);
      if (bodyMat) { bodyMat.emissive = new THREE.Color(0x180b24); bodyMat.emissiveIntensity = 0.34; w.art.clothMat = bodyMat; }
      w.art.eye.position.set(0, 0.78, 0.52);
      w.art.eye.scale.set(0.9, 0.55, 1);

      const mixer = new THREE.AnimationMixer(model);
      const actions = new Map();
      const clipNames = {
        entrance: 'Armature|Jump_and_Slam_Back_Down|baselayer',
        idle: 'Armature|Idle|baselayer',
        claw: 'Armature|Punch_Combo|baselayer',
        slam: 'Armature|Charged_Ground_Slam|baselayer'
      };
      const register = clips => {
        for (const clip of clips) {
          for (const [key, name] of Object.entries(clipNames)) {
            if (clip.name === name && !actions.has(key)) actions.set(key, mixer.clipAction(clip));
          }
        }
      };
      register(gltf.animations);
      for (const file of ['anim-entrance.glb', 'anim-idle.glb', 'anim-claw.glb', 'anim-slam.glb']) {
        loader.load(dir + file, lib => register(lib.animations), undefined,
          () => console.warn(`Hour-Eater animation ${file} unavailable.`));
      }
      let current = null;
      let entranceLock = false;
      const play = (key, once = false) => {
        const next = actions.get(key);
        if (!next || current === next) return;
        next.reset();
        if (once) { next.setLoop(THREE.LoopOnce); next.clampWhenFinished = true; entranceLock = true; }
        next.fadeIn(0.22).play();
        current?.fadeOut(0.22);
        current = next;
      };
      mixer.addEventListener('finished', () => { entranceLock = false; current = null; w.art.setBossState('idle'); });
      w.art.mixer = mixer;
      w.art.setBossState = key => { if (!entranceLock) play(key); };
      w.art.playEntrance = () => { if (actions.has('entrance')) play('entrance', true); };
      w.art.setBossState('idle');
    }, undefined, error => console.warn('Hour-Eater model unavailable; keeping the procedural Bell Warden.', error));
  }
  function rehome(w) {
    if (w.type === 'bellwarden') {
      w.home.set(0, 11.5, -38);
      return;
    }
    if (w.type === 'groundskeeper') {
      const groves = [[-24, -40], [24, -44], [-29, 15], [30, 17], [-35, -7], [36, -9]];
      const grove = groves[Math.floor(wr() * groves.length) % groves.length];
      w.home.set(grove[0] + (wr() - 0.5) * 4, 2.2 + wr() * 1.3, grove[1] + (wr() - 0.5) * 4);
      return;
    }
    if (wr() < 0.48) {
      // Strays haunt the readable Great Hall cloister line before breaking into a rush.
      w.home.set(-24 + wr() * 48, 2.8 + wr() * 2.4, -64 - wr() * 5);
      return;
    }
    const a = wr() * Math.PI * 2;
    const r = 30 + wr() * 55;
    const y = 3.2 + wr() * 7.5;
    w.home.set(Math.cos(a) * r, y, Math.sin(a) * r - 8);
  }

  function sparkAt(p, dropMote, size = 1) {
    effects.impact(p, { weapon: GAME.weapon || 1, size });
    if (dropMote) effects.mote(p, size);
  }

  function setState(w, state, duration = 0) {
    if (w.state === state) return;
    w.state = state; w.tState = duration;
    if (state === 'seek') { combatStats.notices++; SkyAudio.enemyNotice(w.type, w.g.position); }
    if (state === 'windup') { combatStats.windups++; SkyAudio.enemyWindup(w.type, w.stage, w.g.position); }
    if (state === 'dive') combatStats.attacks++;
  }

  function spawn(w) {
    const tuning = getTuning();
    rehome(w);
    w.g.position.copy(w.home);
    w.maxHp = Math.max(1, Math.round(w.cfg.hp * tuning.health * 10) / 10);
    w.hp = w.maxHp; w.stage = 1; w.stageAnnounced = false;
    w.cool = w.type === 'bellwarden' ? 1.8 : 1;
    w.hitFlash = 0; w.blockedFor = 0; w.spawnProtected = 0.55;
    w.staggerCooldown = 0; w.repeatedWeaponHits = 0;
    w.lastWeapon = 0;
    setState(w, 'drift');
    w.g.visible = w.ring.visible = w.corruption.visible = true;
    w.threat.active = true;
    if (w.type === 'bellwarden') {
      SkyAudio.enemyNotice('bellwarden', w.g.position);
      w.art.playEntrance?.();
    }
  }

  function removeEnemy(w, respawn = 6, reward = true) {
    if (reward) {
      effects.defeat(w.g.position, w.type);
      SkyAudio.enemyDefeat(w.type, w.g.position);
      const position = w.g.position.clone(); position.y = 0.08;
      const radius = w.type === 'bellwarden' ? 32 : w.type === 'groundskeeper' ? 22 : 18;
      ENV_RESTORE_PULSES.push({ position: position.clone(), radius, age: 0, duration: 4.2 });
      effects.restoration(position, radius, w.type);
    }
    w.state = 'off'; w.tState = respawn;
    w.g.visible = w.ring.visible = w.corruption.visible = false;
    w.threat.active = false; w.threat.intensity = 0;
  }

  return {
    showcaseEffects(position) {
      const center = position || new THREE.Vector3(-1, 0.08, 25);
      effects.impact(_v.copy(center).add(_look.set(-2.4, 2.2, 1.5)), { weapon: 1, size: 1.15 });
      effects.impact(_v.copy(center).add(_look.set(0, 2.6, 0)), { weapon: 2, size: 1.3 });
      effects.impact(_v.copy(center).add(_look.set(2.4, 3, -1.5)), { weapon: 3, size: 1.55 });
      effects.defeat(_v.copy(center).add(_look.set(0, 2.2, -3)), 'groundskeeper');
      effects.restoration(center, 4.5, 'stray');
    },
    showcase() {
      upgradeBellwarden(list.find(w => w.type === 'bellwarden'));
      const chosen = [
        list.find(w => w.type === 'stray'),
        list.find(w => w.type === 'groundskeeper'),
        list.find(w => w.type === 'bellwarden')
      ];
      const spots = [[-5.5, 2.7, -13], [0, 2.8, -18], [6.5, 5.2, -25]];
      for (const w of list) removeEnemy(w, 1e9, false);
      chosen.forEach((w, i) => {
        if (!w) return;
        spawn(w);
        w.home.set(...spots[i]); w.g.position.copy(w.home);
        w.cool = 99;
      });
    },
    activate() {
      upgradeBellwarden(list.find(w => w.type === 'bellwarden'));
      list.forEach((w, i) => {
        if (i < 8) spawn(w);
        else { removeEnemy(w, 2 + wr() * 8, false); }
      });
    },
    activateFirstStray(position) {
      for (const enemy of list) removeEnemy(enemy, 1e9, false);
      const stray = list.find(enemy => enemy.type === 'stray');
      if (!stray) return;
      spawn(stray);
      stray.home.copy(position);
      stray.g.position.copy(position);
      stray.cool = 0.8;
    },
    activateForQA(type, position) {
      for (const enemy of list) removeEnemy(enemy, 1e9, false);
      const enemy = list.find(candidate => candidate.type === type);
      if (!enemy) return false;
      if (type === 'bellwarden') upgradeBellwarden(enemy);
      spawn(enemy);
      enemy.home.copy(position);
      enemy.g.position.copy(position);
      enemy.cool = 0.15;
      enemy.spawnProtected = 0;
      return true;
    },
    calmAll() {
      for (const w of list) if (w.state !== 'off') { setState(w, 'retreat'); w.cool = 3; }
    },
    dissolveAll() {
      for (const w of list) if (w.state !== 'off') removeEnemy(w, 1e9, true);
    },
    tryHit(p, radius, damage = 1, weapon = GAME.weapon || 1, seal = 0) {
      let best = null, bestD = Infinity;
      for (const w of list) {
        if (w.state === 'off' || w.spawnProtected > 0) continue;
        const distance = w.g.position.distanceTo(p);
        if (distance < w.cfg.hitRadius + radius && distance < bestD) { best = w; bestD = distance; }
      }
      if (!best) return false;
      const changedWeapon = best.lastWeapon && best.lastWeapon !== weapon;
      if (GAME.roleState.passive === 'catalyst-chain' && changedWeapon) {
        damage *= 1.35;
      }
      // A sealed target is a target the Warden has already read: everything
      // that lands on it afterwards bites harder, whoever fired it.
      if (best.sealed > 0) damage *= SEAL_DAMAGE_MULTIPLIER;
      if (seal) best.sealed = seal;
      best.repeatedWeaponHits = best.lastWeapon === weapon ? best.repeatedWeaponHits + 1 : 1;
      best.lastWeapon = weapon;
      best.hp -= damage;
      best.hitFlash = 1;
      sparkAt(best.g.position, false, best.type === 'bellwarden' ? 1.5 : 0.9);
      SkyAudio.enemyHurt(best.type, best.hp / best.maxHp, best.g.position);
      if (best.hp <= 0) {
        removeEnemy(best, best.type === 'bellwarden' ? 14 : best.type === 'groundskeeper' ? 10 : 6, true);
        return 'kill';
      }
      if (best.type === 'bellwarden' && best.hp <= best.maxHp * 0.5) best.stage = 2;
      if (best.staggerCooldown <= 0) {
        setState(best, 'stagger', changedWeapon ? 0.45 : best.type === 'bellwarden' ? 0.38 : 0.28);
        best.staggerCooldown = best.type === 'bellwarden' ? 1.45 : best.type === 'groundskeeper' ? 1.1 : 0.82;
      } else if (best.repeatedWeaponHits >= 4 && best.state !== 'windup' && best.state !== 'dive') {
        // Repeating one weapon makes the enemy reposition, not gain arbitrary
        // armour. Switching weapons reopens the immediate stagger response.
        setState(best, 'retreat');
        best.cool = 0.35;
        best.repeatedWeaponHits = 0;
      }
      return 'hit';
    },
    // The Chancellor's Bell Toll: a radial chime that strikes every nearby
    // enemy at once instead of firing a projectile.
    toll(p, { radius = 11.5, damage = 12, empowered = false } = {}) {
      chancellorMagic.toll(p, radius, empowered);
      let hits = 0, kills = 0;
      for (const w of list) {
        if (w.state === 'off') continue;
        if (w.g.position.distanceTo(p) > radius + w.cfg.hitRadius) continue;
        hits++;
        w.repeatedWeaponHits = w.lastWeapon === 1 ? w.repeatedWeaponHits + 1 : 1;
        w.lastWeapon = 1;
        w.hp -= damage;
        w.hitFlash = 1;
        chancellorMagic.impact(w.g.position, w.type === 'bellwarden' ? 1.7 : w.type === 'groundskeeper' ? 1.25 : 1, empowered);
        SkyAudio.enemyHurt(w.type, w.hp / w.maxHp, w.g.position);
        if (w.hp <= 0) {
          removeEnemy(w, w.type === 'bellwarden' ? 14 : w.type === 'groundskeeper' ? 10 : 6, true);
          kills++;
          continue;
        }
        if (w.type === 'bellwarden' && w.hp <= w.maxHp * 0.5) w.stage = 2;
        if (w.staggerCooldown <= 0) {
          setState(w, 'stagger', empowered ? 0.62 : w.type === 'bellwarden' ? 0.42 : 0.36);
          w.staggerCooldown = w.type === 'bellwarden' ? 1.45 : w.type === 'groundskeeper' ? 1.1 : 0.82;
        }
      }
      return { hits, kills };
    },
    // The Breacher's dash: damages and knocks back every enemy near the
    // segment travelled, like a battering ram punched through the line.
    breach(from, to, { radius = 2.4, damage = 10 } = {}) {
      const seg = _breachSeg.copy(to).sub(from);
      const lengthSq = Math.max(1e-6, seg.lengthSq());
      let hits = 0, kills = 0;
      for (const w of list) {
        if (w.state === 'off') continue;
        const rel = _breachRel.copy(w.g.position).sub(from);
        const k = THREE.MathUtils.clamp(rel.dot(seg) / lengthSq, 0, 1);
        const closest = _breachClosest.copy(from).addScaledVector(seg, k);
        if (w.g.position.distanceTo(closest) > radius + w.cfg.hitRadius) continue;
        hits++;
        w.repeatedWeaponHits = w.lastWeapon === 1 ? w.repeatedWeaponHits + 1 : 1;
        w.lastWeapon = 1;
        w.hp -= damage;
        w.hitFlash = 1;
        effects.impact(w.g.position, { weapon: 1, size: 1.15 });
        SkyAudio.enemyHurt(w.type, w.hp / w.maxHp, w.g.position);
        if (w.hp <= 0) {
          removeEnemy(w, w.type === 'bellwarden' ? 14 : w.type === 'groundskeeper' ? 10 : 6, true);
          kills++;
          continue;
        }
        // Shove survivors out of the lane so the dash reads as a breach.
        _breachPush.copy(w.g.position).sub(closest).setY(0);
        if (_breachPush.lengthSq() < 1e-4) _breachPush.set(-seg.z, 0, seg.x);
        w.g.position.addScaledVector(_breachPush.normalize(), 1.1);
        if (w.type === 'bellwarden' && w.hp <= w.maxHp * 0.5) w.stage = 2;
        if (w.staggerCooldown <= 0) {
          setState(w, 'stagger', w.type === 'bellwarden' ? 0.42 : 0.5);
          w.staggerCooldown = w.type === 'bellwarden' ? 1.45 : 0.9;
        }
      }
      return { hits, kills };
    },
    // Mark every live enemy within reach — the Keeper's signature.
    sealAll(p, radius, duration) {
      let sealed = 0;
      for (const w of list) {
        if (w.state === 'off') continue;
        if (w.g.position.distanceTo(p) > radius) continue;
        w.sealed = Math.max(w.sealed, duration);
        effects.impact(w.g.position, { weapon: 3, size: 0.8 });
        sealed++;
      }
      return sealed;
    },
    impactAt(p, size = 1) {
      effects.impact(p, { weapon: 1, size });
    },
    resetCombatStats() {
      for (const key of Object.keys(combatStats)) combatStats[key] = 0;
    },
    retune() {
      const tuning = getTuning();
      for (const enemy of list) {
        const ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1;
        enemy.maxHp = Math.max(1, Math.round(enemy.cfg.hp * tuning.health * 10) / 10);
        enemy.hp = Math.max(0, enemy.maxHp * ratio);
      }
    },
    update(t, dt, player, combat, cbs) {
      const tuning = getTuning();
      const combatActive = Boolean(combat?.active && player);
      const buildingTarget = combat?.buildingTarget || null;
      const allowRespawn = Boolean(combat?.respawn);
      const maxAttackers = Math.max(1, Math.min(4, Number(combat?.maxAttackers) || 2));
      let committedAttackers = list.filter(w => w.state === 'windup' || w.state === 'dive').length;
      for (const w of list) {
        if (w.state === 'off') {
          if (allowRespawn && w.tState < 1e8) { w.tState -= dt; if (w.tState <= 0) spawn(w); }
          continue;
        }
        if (!combatActive && (w.state === 'seek' || w.state === 'windup' || w.state === 'dive')) {
          if (w.state === 'windup' || w.state === 'dive') committedAttackers = Math.max(0, committedAttackers - 1);
          setState(w, 'retreat');
        }
        const p = w.g.position;
        const beforeMove = w.navBefore.copy(p);
        const attacksBuilding = Boolean(buildingTarget && w.siegeRole === 'building');
        const target = attacksBuilding ? buildingTarget : player;
        const dP = target ? p.distanceTo(target) : 1e9;
        const roleSlow = GAME.roleState.signatureActive && (GAME.roleState.effect === 'violet-bloom' || GAME.roleState.effect === 'eleventh-hour') ? 0.55 : 1;
        const stageMul = (w.stage === 2 ? 1.24 : 1) * roleSlow;
        w.cool = Math.max(0, w.cool - dt);
        w.staggerCooldown = Math.max(0, w.staggerCooldown - dt);
        w.spawnProtected = Math.max(0, w.spawnProtected - dt);
        w.hitFlash = Math.max(0, w.hitFlash - dt * 4.5);
        w.art.clothMat.emissive.setHex(w.hitFlash > 0 ? 0x8d5bb8 : 0x180b24);
        w.art.clothMat.emissiveIntensity = 0.34 + w.hitFlash * 1.7;
        w.art.maskMat.emissiveIntensity = 0.22 + (w.state === 'windup' ? 0.85 : 0) + (w.stage - 1) * 0.45;
        w.art.eye.material.opacity = 0.48 + (w.state === 'seek' ? 0.35 : 0) + (w.state === 'windup' ? 0.17 : 0);
        w.art.eye.material.color.setHex(w.state === 'windup' ? 0xff845e : (w.stage === 2 ? 0xffb067 : 0xaf70ff));
        w.art.blackPetals.rotation.y += dt * (w.state === 'windup' ? 3.8 : 0.55);
        w.art.blackPetals.rotation.x = Math.sin(t * 0.5 + w.ph) * 0.18;
        if (w.art.mixer) {
          w.art.mixer.update(dt);
          w.art.setBossState(w.state === 'windup' ? 'slam' : w.state === 'dive' ? 'claw' : 'idle');
        }
        w.art.visual.position.y = Math.sin(t * 1.1 + w.ph) * (w.type === 'groundskeeper' ? 0.05 : 0.14);
        w.art.visual.rotation.z = Math.sin(t * 0.75 + w.ph) * (w.state === 'stagger' ? 0.22 : 0.035);
        w.threat.intensity = Math.min(1.45, 0.35 + (w.state === 'seek' ? 0.28 : 0) + (w.state === 'windup' || w.state === 'dive' ? 0.52 : 0) + (w.stage - 1) * 0.28);
        w.corruption.position.set(p.x, 0.04, p.z);
        w.corruption.scale.setScalar(w.cfg.corruption * (0.78 + Math.sin(t * 1.7 + w.ph) * 0.04));
        w.corruption.material.opacity = 0.11 + w.threat.intensity * 0.11;
        w.ring.position.set(p.x, 0.065, p.z);
        w.ring.scale.setScalar(w.cfg.hitRadius * (w.state === 'windup' ? 1.8 + Math.sin(t * 9) * 0.22 : 1.08));
        w.ring.material.opacity = w.state === 'windup' ? 0.78 : w.state === 'seek' ? 0.24 : 0.08;
        w.sealed = Math.max(0, w.sealed - dt);
        const passiveReveal = (GAME.roleState.passive === 'second-sight' && dP < 18) || w.sealed > 0;
        if (GAME.roleState.signatureActive || passiveReveal) {
          w.ring.material.opacity = Math.max(w.ring.material.opacity, GAME.roleState.signatureActive ? 0.62 : 0.22);
          w.ring.material.depthTest = false;
          w.art.eye.material.depthTest = false;
        } else {
          w.ring.material.depthTest = true;
          w.art.eye.material.depthTest = true;
        }
        if (target) w.g.lookAt(_look.copy(target).setY(p.y));

        if (w.type === 'bellwarden' && w.stage === 2 && !w.stageAnnounced) {
          w.stageAnnounced = true;
          storyCard(tr('The Bell Warden breaks the hour.', '鐘樓守望者擊碎了時刻。'),
            tr('its second toll hunts through the dark', '第二聲鐘鳴正在黑暗中追獵'), 4200);
          SkyAudio.enemyWindup('bellwarden', 2, w.g.position);
          let summoned = 0;
          for (const add of list) {
            if (add.type !== 'stray' || add.state !== 'off' || summoned >= 2) continue;
            spawn(add);
            const angle = summoned ? Math.PI * 0.72 : -Math.PI * 0.72;
            add.home.copy(w.g.position).add(_v.set(Math.sin(angle) * 6, -1.2, Math.cos(angle) * 6));
            add.g.position.copy(add.home);
            add.cool = 0.65 + summoned * 0.3;
            summoned++;
          }
          combatStats.summons += summoned;
        }

        if (w.state === 'drift') {
          const amp = w.type === 'bellwarden' ? 2.2 : w.type === 'groundskeeper' ? 1.4 : 3.2;
          p.x = w.home.x + Math.sin(t * (w.type === 'bellwarden' ? 0.16 : 0.36) + w.ph) * amp;
          p.y = w.home.y + Math.sin(t * 0.48 + w.ph * 2) * (w.type === 'groundskeeper' ? 0.22 : 1.1);
          p.z = w.home.z + Math.cos(t * 0.29 + w.ph) * amp;
          const detectionRange = attacksBuilding ? Math.max(65, w.cfg.detect) : w.cfg.detect * tuning.detection;
          if (combatActive && w.cool <= 0 && dP < detectionRange
            && !segmentBlocked(p, target, COLLIDER_INDEX || COLLIDERS, { radius: 0.12 })) setState(w, 'seek');
        } else if (w.state === 'seek') {
          _v.copy(target).sub(p);
          if (w.type === 'groundskeeper') _v.y = clamp(_v.y, -0.5, 0.5); // altitude cleanly counters its root rush
          w.dir.copy(_v.normalize());
          if (w.type === 'stray' && dP > 7) {
            const flankStrength = clamp((dP - 7) / 24, 0, 0.58);
            w.dir.add(_look.set(-w.dir.z * w.avoidSign, 0, w.dir.x * w.avoidSign).multiplyScalar(flankStrength)).normalize();
          }
          p.addScaledVector(w.dir, dt * w.cfg.seek * stageMul * tuning.speed);
          const trigger = w.type === 'bellwarden' ? 14 : w.type === 'groundskeeper' ? 10.5 : 8.5;
          const hasLineOfSight = !segmentBlocked(p, target, COLLIDER_INDEX || COLLIDERS, { radius: 0.1 });
          if (dP < trigger && committedAttackers < maxAttackers && hasLineOfSight) {
            w.windupDuration = w.cfg.windup * tuning.windup / stageMul;
            setState(w, 'windup', w.windupDuration);
            committedAttackers++;
          }
          else if (dP > (attacksBuilding ? 90 : w.cfg.detect * tuning.detection * 1.45)) setState(w, 'retreat');
        } else if (w.state === 'windup') {
          if (segmentBlocked(p, target, COLLIDER_INDEX || COLLIDERS, { radius: 0.1 })) {
            combatStats.wallBlocks++;
            committedAttackers = Math.max(0, committedAttackers - 1);
            setState(w, 'seek');
            w.cool = 0.2;
            w.art.visual.scale.setScalar(w.art.silhouetteScale);
            continue;
          }
          w.tState -= dt;
          const progress = 1 - Math.max(0, w.tState) / Math.max(0.01, w.windupDuration || w.cfg.windup);
          const crouch = 1 - Math.sin(progress * Math.PI) * (w.type === 'bellwarden' ? 0.18 : 0.3);
          w.art.visual.scale.setScalar(w.art.silhouetteScale * crouch);
          if (w.tState <= 0) {
            _v.copy(target).sub(p);
            if (w.type === 'groundskeeper') _v.y = clamp(_v.y, -0.35, 0.35);
            w.dir.copy(_v.normalize());
            setState(w, 'dive', w.type === 'bellwarden' ? 1.85 : 1.35);
            SkyAudio.enemyAttack(w.type, w.stage, w.g.position);
          }
        } else if (w.state === 'dive') {
          w.tState -= dt;
          _v.copy(target).sub(p);
          if (w.type === 'groundskeeper') _v.y = clamp(_v.y, -0.2, 0.2);
          w.dir.lerp(_v.normalize(), dt * w.cfg.turn).normalize();
          p.addScaledVector(w.dir, dt * w.cfg.dive * stageMul * tuning.speed);
          w.art.visual.rotation.x = 0.42;
          if (dP < w.cfg.hitRadius + 0.35) {
            const blocked = segmentBlocked(p, target, COLLIDER_INDEX || COLLIDERS, { radius: 0.06, endPadding: 0.18 });
            const accepted = blocked ? false : attacksBuilding
              ? cbs.hitBuilding?.(w.dir, w.type)
              : cbs.hitPlayer(w.dir, w.cfg.damage * tuning.damage, w.type);
            if (blocked) combatStats.wallBlocks++;
            if (accepted === false) combatStats.blockedHits++;
            else combatStats.hits++;
            setState(w, 'recover', w.type === 'bellwarden' ? 1.4 : 0.85);
            committedAttackers = Math.max(0, committedAttackers - 1);
          } else if (w.tState <= 0) {
            combatStats.dodges++;
            setState(w, 'recover', 0.7);
            committedAttackers = Math.max(0, committedAttackers - 1);
          }
        } else if (w.state === 'stagger') {
          w.tState -= dt;
          p.addScaledVector(w.dir, -dt * 1.7);
          if (w.tState <= 0) setState(w, 'recover', 0.5);
        } else if (w.state === 'recover') {
          w.tState -= dt;
          w.art.visual.rotation.x *= Math.exp(-dt * 6);
          if (w.tState <= 0) { setState(w, 'retreat'); w.cool = 1.4; }
        } else if (w.state === 'retreat') {
          _v.copy(w.home).sub(p);
          w.art.visual.rotation.x *= Math.exp(-dt * 5);
          w.art.visual.scale.lerp(_look.setScalar(w.art.silhouetteScale), Math.min(1, dt * 6));
          if (_v.length() < 2) setState(w, 'drift');
          else p.addScaledVector(_v.normalize(), dt * (w.type === 'groundskeeper' ? 4.2 : 6.2));
        }

        // World collision and lightweight separation keep attackers outside
        // walls and one another. A blocked enemy slides around the obstacle;
        // a blocked dive is cancelled into recovery instead of damaging
        // through stone.
        if (p.distanceToSquared(beforeMove) > 1e-7) {
          const intended = w.navIntended.copy(p);
          const bodyRadius = w.type === 'bellwarden' ? 0.9 : w.type === 'groundskeeper' ? 0.78 : 0.58;
          resolveCollisions(p, bodyRadius);
          const correction = p.distanceTo(intended);
          w.blockedFor = correction > 0.06 ? w.blockedFor + dt : Math.max(0, w.blockedFor - dt * 2);
          if (correction > 0.06 && (w.state === 'seek' || w.state === 'retreat')) {
            const side = _look.set(-w.dir.z * w.avoidSign, 0, w.dir.x * w.avoidSign).normalize();
            p.addScaledVector(side, dt * w.cfg.seek * 0.72);
            resolveCollisions(p, bodyRadius);
          }
          if (w.blockedFor > 0.48) {
            w.blockedFor = 0;
            w.avoidSign *= -1;
            combatStats.pathRecoveries++;
            if (w.state === 'dive') setState(w, 'recover', 0.55);
          }
          for (const other of list) {
            if (other === w || other.state === 'off') continue;
            _v.copy(p).sub(other.g.position);
            _v.y = 0;
            const separation = bodyRadius + (other.type === 'bellwarden' ? 0.9 : 0.62);
            const distance = _v.length();
            if (distance > 0.001 && distance < separation) p.addScaledVector(_v.multiplyScalar(1 / distance), (separation - distance) * 0.35);
          }
          resolveCollisions(p, bodyRadius);
        }
      }

      const motionScale = REDUCED_MOTION ? 0.16 : 1;
      effects.update(dt, player, cbs.heal, motionScale);
      chancellorMagic.update(dt, motionScale);
    },
    spellImpact(position, weapon, size = 0.7) {
      effects.impact(position, { weapon, size });
    },
    get effectStats() { return { shared: effects.stats, chancellor: chancellorMagic.stats }; },
    get combatStats() { return { ...combatStats }; },
    get state() {
      return list.filter(enemy => enemy.state !== 'off').map(enemy => ({
        type: enemy.type, state: enemy.state, hp: enemy.hp, position: enemy.g.position.toArray()
      }));
    }
  };
}

const _spellHitDir = new THREE.Vector3();
function hitSpellTarget(position, radius, velocity, damage, weapon = GAME.weapon || 1) {
  for (const target of SPELL_TARGETS) {
    if (target.active && !target.active()) continue;
    const hitRadius = target.radius + radius * (target.projectileScale ?? 1);
    if (target.position.distanceTo(position) <= hitRadius) {
      _spellHitDir.copy(velocity).normalize();
      target.hit(_spellHitDir, damage, weapon);
      return true;
    }
  }
  return false;
}

function hitSpellTargetsInRadius(position, radius, damage, weapon = GAME.weapon || 1) {
  let hits = 0;
  _spellHitDir.set(0, 1, 0);
  for (const target of SPELL_TARGETS) {
    if (target.active && !target.active()) continue;
    if (target.position.distanceTo(position) > radius + target.radius) continue;
    target.hit(_spellHitDir, damage, weapon);
    hits++;
  }
  return hits;
}

// bolts of morning light, cast from the lantern
function Bolts(max = MAX_LOCAL_PROJECTILES) {
  const glowTex = radialTexture('rgba(255,236,190,0.9)', 'rgba(232,176,106,0)', 64);
  const pool = [];
  for (let i = 0; i < max; i++) {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xfff0d0 }));
    g.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.5);
    g.add(glow);
    g.visible = false;
    scene.add(g);
    pool.push({ g, core, glow, vel: new THREE.Vector3(), ttl: 0, r: 1.9, weapon: 1 });
  }
  const _p = { x: 0, y: 0, z: 0 };
  const _aim = new THREE.Vector3();
  return {
    // opts let each weapon shape its shot: scatter fires small short-lived
    // embers, the moonbow a fast stretched dart with a wider strike radius
    fire(origin, dir, {
      seal = 0,
      speed = WEAPON_PROFILES.ember.speed,
      ttl = WEAPON_PROFILES.ember.ttl,
      scale = WEAPON_PROFILES.ember.scale,
      r = WEAPON_PROFILES.ember.radius,
      stretch = 1,
      damage = WEAPON_PROFILES.ember.damage,
      weapon = GAME.weapon || WEAPON_PROFILES.ember.id
    } = {}) {
      const b = pool.find(bb => bb.ttl <= 0);
      if (!b) return false;
      b.g.position.copy(origin);
      b.vel.copy(dir).multiplyScalar(speed);
      b.ttl = ttl;
      b.r = r;
      b.damage = damage;
      b.weapon = weapon;
      b.seal = seal;
      b.core.scale.set(scale, scale, scale * stretch);
      b.glow.scale.setScalar(1.5 * scale);
      b.g.lookAt(_aim.copy(origin).add(dir));
      b.g.visible = true;
      return true;
    },
    update(dt, wisps, onCleanse, specialTarget = null, onSpecialHit = null) {
      for (const b of pool) {
        if (b.ttl <= 0) continue;
        b.ttl -= dt;
        const P = b.g.position;
        P.addScaledVector(b.vel, dt);
        let showImpact = P.y < 0.2;
        let dead = b.ttl <= 0 || showImpact || Math.hypot(P.x, P.z) > 210;
        if (!dead && MODE === 'story' && !(siege && siege.active)
          && skyMultiplayer.tryHitPeer(P, b.r, b.weapon)) { dead = true; showImpact = true; }
        if (!dead && hitSpellTarget(P, b.r, b.vel, b.damage, b.weapon)) { dead = true; showImpact = true; }
        if (!dead && specialTarget) {
          const specialHit = specialTarget.tryHit(P, b.r, b.damage, b.weapon);
          if (specialHit) {
            onSpecialHit?.(specialHit, b);
            dead = true;
            showImpact = true;
          }
        }
        if (!dead) {
          const enemyHit = wisps.tryHit(P, b.r, b.damage, b.weapon, b.seal);
          if (enemyHit) {
            if (enemyHit === 'kill') onCleanse();
            dead = true;
          }
        }
        if (!dead) { // stone stops light
          _p.x = P.x; _p.y = P.y; _p.z = P.z;
          resolveCollisions(_p, 0.15);
          if (Math.abs(_p.x - P.x) + Math.abs(_p.y - P.y) + Math.abs(_p.z - P.z) > 1e-4) {
            dead = true;
            showImpact = true;
          }
        }
        if (dead) {
          if (showImpact) wisps.spellImpact(P, b.weapon, b.weapon === 3 ? 1.05 : 0.7);
          b.ttl = 0;
          b.g.visible = false;
        }
      }
    }
  };
}

function GameFlow(ctrl, avatar, env, opening, blackGarden) {
  const currentCombatTuning = () => combatTuning(
    settings.prefs.difficulty,
    skyMultiplayer.storySnapshot?.partySize || skyMultiplayer.storySnapshot?.party?.length || 1
  );
  const wisps = Wisps(14, currentCombatTuning);
  const bolts = Bolts(12); // scatter needs five live embers per shot
  const _o = new THREE.Vector3();
  const _sc = new THREE.Vector3();
  let castCd = 0, vigPulse = 0, finaleK = 0, dead = false, nowT = 0;
  let playerInvulnerableUntil = 0, enemyCombatProbeActive = false, enemyCombatProbeSnapshot = null;
  let enemyCombatProbeWall = null;
  let interactQueued = false, signatureRemaining = 0, storyStarted = false;
  let storyFragment = null, strayActivated = false, cloisterThresholdNarrated = false, firstFlightNarrated = false;
  const chapterIncidents = new Set();
  let chapterChoice = null;
  let gardenOutcome = null;
  let lastBossHp = null;
  const enemyShowcase = URL_QUERY.has('enemy-showcase');
  const effectsShowcase = URL_QUERY.has('effects-showcase');

  const OBJ = {
    0: () => tr('follow the rising petals · E investigate', '跟隨逆流花瓣 · E 調查'),
    1: () => ctrl.state === 'ground'
      ? tr('flight restored · press F or SPACE', '飛行已恢復 · 按 F 或 SPACE')
      : `${tr('recover the drifting memories', '尋回飄流的記憶')} &nbsp;·&nbsp; ${GAME.relics} / ${GAME.relicsNeeded}`,
    2: () => `${tr('cleanse the marked Stray', '淨化被標記的迷途者')} &nbsp;·&nbsp; ${GAME.cleansed} / ${GAME.cleanseNeeded}`,
    3: () => tr('enter the restored cloister', '進入復甦的迴廊'),
    4: () => `${tr('Names in the Cloister · investigate the memory incidents', '迴廊裡的名字 · 調查記憶事件')} &nbsp;·&nbsp; ${chapterIncidents.size} / 3`,
    5: () => tr('clue board · decide who asked to stop the hour', '線索板 · 判斷是誰要求停止時刻'),
    6: () => tr('Chapter II · find the root door beneath the cloister · E enter', '第二章 · 找到迴廊下方的根系之門 · E 進入'),
    7: () => `${tr('The Black Garden · charge the lantern relays', '黑色花園 · 點亮提燈中繼站')} &nbsp;·&nbsp; ${blackGarden.relayCount} / 3`,
    8: () => `${tr('Groundskeeper · interrupt the grief roots', '園丁 · 中斷悲傷根系')} &nbsp;·&nbsp; ${Math.ceil(blackGarden.bossHp)} / ${Math.ceil(blackGarden.bossMaxHp)}`,
    9: () => tr('the roots are listening · choose what the garden remembers', '根系正在傾聽 · 選擇花園將記住什麼'),
    10: () => tr('The Black Garden restored · Chapter II complete', '黑色花園已復甦 · 第二章完成')
  };
  const signatureStatus = () => {
    const entry = playableCharacter(avatar.characterId);
    const label = UI_LANG === 'zh-Hant' ? entry.signature.zh : entry.signature.en;
    const passive = UI_LANG === 'zh-Hant' ? entry.passive.zh : entry.passive.en;
    const charge = Math.round(GAME.roleState.signatureCharge * 100);
    return `<small>${tr('PASSIVE', '被動')} · ${passive} &nbsp;|&nbsp; Q · ${label} · ${GAME.roleState.signatureActive ? tr('ACTIVE', '啟動中') : `${charge}%`}</small>`;
  };
  const refreshObjective = () => {
    const main = OBJ[GAME.phase] ? OBJ[GAME.phase]() : '';
    objectiveEl.innerHTML = main + ((GAME.phase >= 1 && GAME.phase < 4) || GAME.phase === 8 ? signatureStatus() : '');
    objectiveEl.dataset.phase = String(GAME.phase);
    weaponEl.classList.toggle('visible', (GAME.phase >= 1 && GAME.phase < 4) || GAME.phase === 8);
    weaponEl.classList.toggle('combat-expanded', GAME.phase === 2 || GAME.phase === 8);
    if (!(siege && siege.active) && buildingEmergencyEl) {
      buildingEmergencyEl.classList.remove('on');
      buildingEmergencyEl.setAttribute('aria-hidden', 'true');
    }
    refreshStoryParty();
  };

  const fragmentCopy = index => [
    {
      label: tr('SIGHT', '所見'),
      line: tr('The Bell Warden was kneeling, not attacking.', '鐘樓守望者當時跪著，並非正在攻擊。')
    },
    {
      label: tr('VOICE', '聲音'),
      line: tr('A student whispered: “Stop the hour before it remembers us.”', '一名學生低語：「在那個時刻記起我們以前，先讓它停下。」')
    },
    {
      label: tr('ABSENCE', '缺失'),
      line: tr('One name was cut from every record: Mara Vale.', '所有紀錄都被刪去同一個名字：瑪拉・維爾。')
    },
    {
      label: tr('ECHO', '回聲'),
      line: tr('The hand that rang the bell wore a lantern like yours.', '敲響鐘聲的那隻手，帶著與你相同的提燈。')
    }
  ][Math.max(0, Math.min(3, Number(index) || 0))];

  function refreshStoryParty(snapshot = skyMultiplayer.storySnapshot) {
    if (!storyPartyEl) return;
    const visible = MODE === 'story' && storyStarted && skyMultiplayer.connected;
    storyPartyEl.classList.toggle('on', visible);
    storyPartyEl.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (!visible) return;
    const partySize = Math.max(1, Number(snapshot?.partySize) || 1);
    const found = Math.max(0, Number(snapshot?.relicCount) || 0);
    const relayCount = Math.max(0, Number(snapshot?.relayCount) || 0);
    const bossHp = Math.max(0, Number(snapshot?.bossHp) || 0);
    const bossMaxHp = Math.max(0, Number(snapshot?.bossMaxHp) || 0);
    storyPartyStatusEl.textContent = GAME.phase === 7
      ? tr(`${partySize} / 4 LANTERNS · ${relayCount} / 3 RELAYS`, `${partySize} / 4 位提燈者 · ${relayCount} / 3 座中繼站`)
      : GAME.phase === 8
        ? tr(`${partySize} / 4 LANTERNS · GROUNDSKEEPER ${Math.ceil(bossHp)} / ${Math.ceil(bossMaxHp)}`, `${partySize} / 4 位提燈者 · 園丁 ${Math.ceil(bossHp)} / ${Math.ceil(bossMaxHp)}`)
        : tr(`${partySize} / 4 LANTERNS · ${found} / 3 MEMORIES`, `${partySize} / 4 位提燈者 · ${found} / 3 段記憶`);
    const clueIndex = storyFragment === null ? null
      : partySize === 1 ? (storyFragment + Math.min(found, 3)) % 4 : storyFragment;
    const clue = clueIndex === null ? null : fragmentCopy(clueIndex);
    storyPartyClueEl.textContent = GAME.phase === 7
      ? tr('PING RELAYS · SPLIT GROUND AND CANOPY', '標記中繼站 · 分頭前往地面與樹冠')
      : GAME.phase === 8
        ? tr('ROOT RINGS STRIKE GROUND · FLY OR STEP BETWEEN', '根環襲擊地面 · 起飛或站到環帶之間')
        : clue && GAME.phase >= 1
          ? `${clue.label} · ${clue.line}`
      : tr('SHARED PROLOGUE · FRIENDLY FIRE OFF', '共享序章 · 隊友傷害關閉');
  }

  function showPersonalFragment() {
    if (storyFragment === null) return;
    const clue = fragmentCopy(storyFragment);
    storyCard(`“${clue.line}”`, tr(`MARA VALE MEMORY · YOUR ${clue.label} FRAGMENT · compare what your friends remember`, `瑪拉・維爾的記憶 · 你的${clue.label}碎片 · 與朋友比對彼此記得的內容`), 7600);
  }
  window.addEventListener('keydown', event => {
    if (event.repeat || UI_BLOCKS_STEERING || MODE !== 'story') return;
    if (event.code === 'KeyE') interactQueued = true;
    if (event.code === 'KeyQ') activateSignature();
  });

  function startStory() {
    if (storyStarted) return;
    storyStarted = true;
    GAME.phase = 0;
    GAME.flightUnlocked = false;
    GAME.roleState.passive = playableCharacter(avatar.characterId).abilityConfig?.passive || 'second-sight';
    GAME.missionStartedAt = performance.now() / 1000;
    hudEl.classList.add('on');
    crosshairEl.classList.remove('on');
    hintEl.classList.remove('gone');
    hintEl.textContent = tr('W A S D walk · follow the rising petals · E investigate', 'W A S D 步行 · 跟隨逆流花瓣 · E 調查');
    storyCard(tr('The petals are climbing against the wind.', '花瓣正逆著風向上飄行。'),
      tr('follow them to the memory waiting on the central path', '跟隨它們，前往中央步道上等待的記憶'), 5200);
    skyMultiplayer.joinStory();
    refreshObjective();
    if (skyMultiplayer.storySnapshot?.started) applySharedStory(skyMultiplayer.storySnapshot);
  }

  function promptFlightLocked() {
    storyCard(tr('The lantern cannot lift you yet.', '提燈尚未能帶你升空。'),
      tr('follow the petals and touch the grounded memory first', '先跟隨花瓣，觸碰地面的記憶'), 2600);
  }

  function recoverOpeningMemory() {
    if (GAME.phase !== 0 || !opening.playerNearMemory) return false;
    if (skyMultiplayer.storyAct('recover-opening')) {
      avatar.playAnimation('interact', 1.1);
      return true;
    }
    if (!opening.recoverMemory()) return false;
    GAME.phase = 1;
    GAME.flightUnlocked = true;
    avatar.playAnimation('interact', 1.1);
    SkyAudio.relic(1);
    hintEl.textContent = tr('press F or SPACE to take flight', '按 F 或 SPACE 起飛');
    storyCard(tr('“Mara Vale: Meet me beneath the jacaranda when the bell stops.”', '「瑪拉・維爾：鐘聲停止時，在藍花楹樹下等我。」'),
      tr('the memory restores your lantern wings · flight unlocked', '記憶恢復了提燈之翼 · 飛行已解鎖'), 6500);
    refreshObjective();
    return true;
  }

  function recoverNearbyDriftingMemory() {
    if (GAME.phase !== 1 || ctrl.state !== 'flying') return false;
    let nearest = null;
    let nearestDistance = 3.8;
    for (const item of floats.items) {
      if (item.def.collected) continue;
      const distance = item.group.position.distanceTo(ctrl.pos);
      if (distance < nearestDistance) { nearest = item; nearestDistance = distance; }
    }
    if (!nearest) return false;
    openPreview(nearest);
    onRelic(nearest);
    return true;
  }

  function activateSignature() {
    if (GAME.phase < 1 || (GAME.phase >= 4 && GAME.phase !== 8) || GAME.roleState.signatureCharge < 0.999 || dead) return false;
    const entry = playableCharacter(avatar.characterId);
    const config = entry.abilityConfig || {};
    GAME.roleState.signatureActive = true;
    GAME.roleState.signatureCharge = 0;
    GAME.roleState.effect = config.signature || 'memory-flare';
    signatureRemaining = Math.max(1, Number(config.durationMs || 5000) / 1000);
    avatar.flare();
    if (GAME.roleState.effect === 'restoration-pulse') {
      GAME.hp = Math.min(GAME.maxHp, GAME.hp + 35);
      ENV_RESTORE_PULSES.push({ position: ctrl.pos.clone().setY(0.08), radius: 18, age: 0, duration: 4.2 });
    }
    if (GAME.roleState.effect === 'closing-index') {
      // Closing the index: everything she can see is catalogued at once, so the
      // whole party's next shots land on marked targets.
      const sealed = wisps.sealAll(ctrl.pos, 40, SEAL_DURATION * 1.6);
      if (sealed) ctrl.shake(0.1);
    }
    if (GAME.roleState.effect === 'breach') {
      // A wider, harder ram through the breach lane in front of the Breacher.
      const breachDir = aimDir();
      breachDir.y = ctrl.state === 'flying' ? breachDir.y : 0;
      if (breachDir.lengthSq() > 1e-4) {
        breachDir.normalize();
        const target = ctrl.pos.clone().addScaledVector(breachDir, 10);
        const { kills } = wisps.breach(ctrl.pos, target, { radius: 3.4, damage: 26 });
        const cleanse = (siege && siege.active) ? siege.onCleanse : onCleanse;
        for (let i = 0; i < kills; i++) cleanse();
        wisps.impactAt(ctrl.pos.clone().addScaledVector(breachDir, 5), 1.9);
        ctrl.shake(0.2);
      }
    }
    const label = UI_LANG === 'zh-Hant' ? entry.signature.zh : entry.signature.en;
    const explanation = {
      'memory-flare': tr('threats, memories, and the route shine through darkness', '威脅、記憶與路線會穿透黑暗發光'),
      'ward-dome': tr('incoming damage is reduced while the dome burns', '穹頂燃燒期間承受傷害降低'),
      'violet-bloom': tr('nearby Unlight movement is disrupted', '附近夜蝕的移動受到干擾'),
      'restoration-pulse': tr('lantern health and nearby landscape recover', '提燈生命與附近環境得到恢復'),
      'eleventh-hour': tr('the hour is held: nearby Unlight moves slowly', '時刻被扣住：附近夜蝕行動減緩'),
      breach: tr('a single crushing blow tears through the lane ahead', '一記粉碎重擊貫穿前方路徑'),
      'closing-index': tr('every threat in sight is sealed and read aloud', '視野內所有威脅被緘印並唱名')
    }[GAME.roleState.effect] || '';
    storyCard(label, explanation, 2800);
    refreshObjective();
    return true;
  }
  if (enemyShowcase) setTimeout(() => {
    GAME.phase = 2;
    GAME.flightUnlocked = true;
    wisps.showcase();
    hudEl.classList.add('on');
    crosshairEl.classList.add('on');
    refreshObjective();
  }, 700);
  if (effectsShowcase) {
    setTimeout(() => {
      wisps.showcaseEffects();
      console.info('[Sky QA] combat effect pool', JSON.stringify(wisps.effectStats));
    }, 900);
    setInterval(() => wisps.showcaseEffects(), 2600);
  }

  function onAirborne() {
    hudEl.classList.add('on');
    crosshairEl.classList.add('on');
    hintEl.classList.add('gone');
    refreshObjective();
    if (siege && siege.active) return;   // a siege narrates its own nights
    if (GAME.phase !== 1 || firstFlightNarrated) return;
    firstFlightNarrated = true;
    setTimeout(() => storyCard(tr('At 11:47 the city fled the rising dark.', '11:47，城市逃離了不斷升起的黑暗。'),
      tr('look, move, and touch the three memories still drifting above the court', '觀察、移動，並觸碰仍飄在中庭上方的三段記憶')), 900);
  }
  function onGrounded() {
    crosshairEl.classList.remove('on');
    hintEl.classList.remove('gone');
    hintEl.textContent = tr('W A S D walk · F or SPACE take flight', 'W A S D 步行 · F 或 SPACE 起飛');
    refreshObjective();
  }
  function onRelic(item) {
    if (siege && siege.active) return;   // no drifting memories during a siege
    if (GAME.phase !== 1 || item.def.collected) return;
    if (skyMultiplayer.storyAct('recover-relic', { relic: item.def.name })) {
      avatar.playAnimation('interact', 1.1);
      return;
    }
    item.def.collected = true;
    avatar.playAnimation('interact', 1.1);
    GAME.relics++;
    SkyAudio.relic(GAME.relics);
    refreshObjective();
    if (GAME.relics >= GAME.relicsNeeded && GAME.phase === 1) {
      setTimeout(() => {
        if (GAME.phase !== 1) return;
        GAME.phase = 2;
        storyCard(tr('A Stray tears itself from the corrupted jacaranda.', '一名迷途者從腐化的藍花楹中撕裂而出。'),
          tr('watch the orange warning ring · dodge the rush · cast during recovery', '觀察橙色警示環 · 閃避衝刺 · 在恢復時施法'));
        wisps.activateFirstStray(opening.encounterPosition);
        strayActivated = true;
        refreshObjective();
      }, 1800);
    }
  }
  function onCleanse() {
    if (siege && siege.active) return;   // siege routes cleanses to its own reward
    if (skyMultiplayer.storyAct('cleanse-stray')) return;
    GAME.cleansed++;
    SkyAudio.cleanse();
    refreshObjective();
    if (GAME.cleansed >= GAME.cleanseNeeded && GAME.phase === 2) {
      GAME.phase = 3;
      wisps.calmAll();
      opening.completeEncounter();
      ENV_RESTORE_PULSES.push({ position: opening.restorePosition.clone(), radius: 24, age: 0, duration: 5.2 });
      cloisterThresholdNarrated = true;
      setTimeout(() => {
        if (GAME.phase !== 3) return;
        storyCard(tr('A sealed bell answers from beyond the cloister.', '一道被封印的鐘聲從迴廊深處回應。'),
          tr('the threshold is safe · recover the missing names before the true confrontation', '入口已安全 · 在真正的對決前，先尋回失落的名字'), 7200);
      }, 900);
      refreshObjective();
    }
  }

  const incidentCopy = id => ({
    'archive-slate': [tr('The erased archive slate remembers Mara Vale.', '被抹除的檔案石板記起了瑪拉・維爾。'), tr('her name vanished after the bell stopped', '她的名字是在鐘聲停止之後才消失')],
    'bell-rope': [tr('The bell rope remembers smaller hands.', '鐘繩記得一雙更小的手。'), tr('the Warden did not tie this knot', '這個結不是守望者打的')],
    'mara-satchel': [tr('Mara’s satchel carries the Warden’s key.', '瑪拉的書包裡裝著守望者的鑰匙。'), tr('a note reads: “Make them forget me first.”', '紙條上寫著：「先讓他們忘記我。」')]
  })[id] || ['', ''];

  function investigateChapterIncident() {
    if (dead || GAME.phase !== 4) return false;
    let nearest = null, distance = 4.8;
    for (const incident of opening.incidents || []) {
      if (chapterIncidents.has(incident.id)) continue;
      const nextDistance = ctrl.pos.distanceTo(incident.position);
      if (nextDistance < distance) { distance = nextDistance; nearest = incident; }
    }
    if (!nearest) return false;
    avatar.playAnimation('interact', 1.1);
    if (skyMultiplayer.storyAct('investigate-incident', { incident: nearest.id })) return true;
    chapterIncidents.add(nearest.id);
    opening.setIncidentComplete(nearest.id);
    const copy = incidentCopy(nearest.id);
    storyCard(copy[0], copy[1], 5200);
    if (chapterIncidents.size >= 3) {
      GAME.phase = 5;
      storyCoopUI?.openOfflineClueBoard();
    }
    refreshObjective();
    return true;
  }

  function enterBlackGarden() {
    if (dead || GAME.phase !== 6 || ctrl.pos.distanceTo(blackGarden.entryPosition) > 6.8) return false;
    avatar.playAnimation('interact', 1.1);
    if (skyMultiplayer.storyAct('enter-black-garden')) return true;
    GAME.phase = 7;
    blackGarden.beginOffline();
    ctrl.resetTo(blackGarden.spawnPosition.toArray());
    GAME.hp = GAME.maxHp;
    storyCard(tr('The lawn remembers what grew beneath it.', '草坪記得曾在它下方生長的一切。'),
      tr('Chapter II · charged relays stay lit through your lantern echoes', '第二章 · 已點亮的中繼站會由提燈回聲守住'), 7000);
    refreshObjective();
    return true;
  }

  function chargeGardenRelay() {
    if (dead || GAME.phase !== 7) return false;
    const relay = blackGarden.nearestRelay(ctrl.pos, 5.1);
    if (!relay) return false;
    avatar.playAnimation('interact', 1.1);
    if (skyMultiplayer.storyAct('charge-garden-relay', { relay: relay.id })) return true;
    blackGarden.activateOfflineRelay(relay.id);
    const labels = {
      root: tr('ROOT MEMORY', '根部記憶'), canopy: tr('CANOPY MEMORY', '樹冠記憶'), well: tr('WELL MEMORY', '井中記憶')
    };
    storyCard(`${labels[relay.id]} · ${tr('relay held', '中繼站已守住')}`,
      blackGarden.relayCount < 3
        ? tr('your lantern leaves an echo here while you carry the light onward', '你的提燈在此留下回聲，讓你能繼續傳遞光芒')
        : tr('the Groundskeeper rises from the grief he chose to carry', '園丁從他選擇背負的悲傷中甦醒'), 4600);
    GAME.phase = blackGarden.phase;
    if (GAME.phase === 8) { GAME.hp = GAME.maxHp; crosshairEl.classList.add('on'); }
    refreshObjective();
    return true;
  }

  function reviveNearbyFriend() {
    if (dead || !skyMultiplayer.connected || !skyMultiplayer.inStory) return false;
    const friend = skyMultiplayer.nearestDimmed(ctrl.pos, 5.1);
    if (!friend) return false;
    avatar.playAnimation('interact', 1.2);
    skyMultiplayer.storyAct('revive-player', { target: friend.id });
    storyCard(tr(`Rekindling ${friend.name}…`, `正在重新點亮 ${friend.name}……`), tr('hold the dangerous ground together', '一起守住這片危險之地'), 1500);
    return true;
  }
  const storyEnemyCombatActive = () => GAME.phase === 2 && (MODE === 'story' || enemyCombatProbeActive);
  const playerDamageAllowed = () => enemyCombatProbeActive
    || (!UI_BLOCKS_STEERING && (storyEnemyCombatActive() || GAME.phase === 8));
  // Heavy blows and a nearly spent lantern deserve a heavier reaction, and a
  // hero who shipped an evade reads as sidestepping every other light hit
  // instead of replaying one flinch all night.
  let lightHitCount = 0;
  function hurtReaction(appliedDamage) {
    if (GAME.hp <= 0) return { name: 'down', seconds: 1.3 };
    if ((appliedDamage >= 22 || GAME.hp < GAME.maxHp * 0.3) && avatar.supportsAnimation('hitHeavy')) {
      return { name: 'hitHeavy', seconds: 0.9 };
    }
    lightHitCount++;
    if (lightHitCount % 2 === 0 && avatar.supportsAnimation('dodge')) {
      return { name: 'dodge', seconds: 0.6 };
    }
    return { name: 'hit', seconds: 0.65 };
  }
  function hitPlayer(dir, damage = 16, source = 'enemy') {
    if (dead || !playerDamageAllowed() || nowT < playerInvulnerableUntil) return false;
    const guarded = GAME.roleState.signatureActive && GAME.roleState.effect === 'ward-dome';
    const steadfast = GAME.roleState.passive === 'steadfast-flame';
    const appliedDamage = damage * (guarded ? 0.45 : steadfast ? 0.85 : 1);
    GAME.hp = Math.max(0, GAME.hp - appliedDamage);
    GAME.lastHitAt = nowT;
    playerInvulnerableUntil = nowT + currentCombatTuning().postHitInvulnerability;
    vigPulse = 1;
    SkyAudio.hurt();
    ctrl.shake(0.8);
    ctrl.addImpulse(dir.x * 7, 2.2, dir.z * 7);
    const reaction = hurtReaction(appliedDamage);
    avatar.playAnimation(reaction.name, reaction.seconds);
    renderer.domElement.dataset.lastEnemyHit = JSON.stringify({
      source,
      damage: Number(appliedDamage.toFixed(1)),
      hp: Number(GAME.hp.toFixed(1)),
      at: Number(nowT.toFixed(2))
    });
    if (GAME.hp <= 0) die();
    return true;
  }
  function networkHit({ hp, fromName }) {
    if (dead || GAME.phase === 4) return;
    GAME.hp = Math.max(0, Math.min(GAME.maxHp, Number(hp)));
    GAME.lastHitAt = nowT;
    vigPulse = 1;
    SkyAudio.hurt();
    ctrl.shake(0.9);
    const reaction = hurtReaction(18);
    avatar.playAnimation(reaction.name, reaction.seconds);
    if (fromName && GAME.hp > 0) storyCard(
      tr(`${fromName} struck your lantern.`, `${fromName} 擊中了你的提燈。`),
      tr(`${GAME.hp} light remaining`, `剩餘 ${GAME.hp} 點光芒`), 1200);
  }
  function networkDown({ fromName }) {
    if (dead) return;
    dead = true;
    GAME.hp = 0;
    fadeEl.classList.add('on');
    SkyAudio.death();
    avatar.playAnimation('down', 1.3);
    storyCard(tr(`${fromName || 'A lantern bearer'} extinguished your light.`, `${fromName || '另一位提燈者'} 熄滅了你的光。`),
      tr('the circle is calling you home', '圓陣正召你回去'), 1700);
  }
  function networkRespawn() {
    ctrl.resetHome();
    GAME.hp = GAME.maxHp;
    playerInvulnerableUntil = nowT + 1;
    fadeEl.classList.remove('on');
    SkyAudio.respawn();
    dead = false;
  }
  function die() {
    dead = true;
    avatar.playAnimation('down', 1.3);
    SkyAudio.death();
    if (skyMultiplayer.connected && skyMultiplayer.inStory) {
      ctrl.setDimmed(true);
      ctrl.land();
      storyCoopUI?.setDimmed(true);
      skyMultiplayer.storyAct('become-dimmed');
      storyCard(tr('Your lantern is Dimmed—not lost.', '你的提燈只是黯淡，並未消失。'), tr('a friend can stand beside you and press E to rekindle it', '朋友可以站到你身旁按 E，重新點亮它'), 4200);
      return;
    }
    fadeEl.classList.add('on');
    setTimeout(() => {
      if (GAME.phase === 8) ctrl.resetTo(blackGarden.spawnPosition.toArray());
      else ctrl.resetHome();
      GAME.hp = GAME.maxHp;
      playerInvulnerableUntil = nowT + 1;
      wisps.calmAll();
      fadeEl.classList.remove('on');
      storyCard(GAME.phase === 8 ? tr('A lantern echo rekindles you at the garden door.', '提燈回聲在花園入口重新點亮你。')
        : tr('The wind carried you back to the circle.', '風將你帶回了圓陣。'), tr('the lantern remembers the way', '提燈記得回程'));
      SkyAudio.respawn();
      dead = false;
    }, 1400);
  }
  function aimDir() {
    return _o.set(
      -Math.sin(ctrl.yaw) * Math.cos(ctrl.pitch),
      Math.sin(ctrl.pitch),
      -Math.cos(ctrl.yaw) * Math.cos(ctrl.pitch));
  }
  function muzzle(dir) {
    const origin = new THREE.Vector3().copy(ctrl.pos).addScaledVector(dir, 1.15);
    origin.y -= 0.15;
    return origin;
  }
  const _dashFrom = new THREE.Vector3();
  const _dashProbe = new THREE.Vector3();
  const _dashTest = new THREE.Vector3();
  function cast() {
    if (GAME.phase < 1 || castCd > 0 || dead) return;
    // The Chancellor rings a Bell Toll instead of casting Ember Bolt: an
    // aim-free nova that works on the ground as well as in the air.
    const character = playableCharacter(avatar.characterId);
    if (GAME.weapon === 1 && character.abilityConfig?.primary === 'bell-toll') {
      const empowered = GAME.roleState.signatureActive && GAME.roleState.effect === 'eleventh-hour';
      const toll = chancellorTollStats(character.abilityConfig, empowered);
      const { kills } = wisps.toll(ctrl.pos, toll);
      hitSpellTargetsInRadius(ctrl.pos, toll.radius, toll.damage, 1);
      skyMultiplayer.shoot(ctrl.pos, CHANCELLOR_TOLL_DIRECTIONS, 4, empowered ? 1 : 0);
      skyMultiplayer.tryHitPeerArea(ctrl.pos, toll.radius, 4);
      ENV_RESTORE_PULSES.push({ position: ctrl.pos.clone().setY(0.08), radius: toll.radius, age: 0, duration: 1.5 });
      if (GAME.phase === 8 && !(siege && siege.active)) {
        const bossHit = blackGarden.tryHit(ctrl.pos, toll.radius, toll.bossDamage, 1);
        if (bossHit) onGroundskeeperHit(bossHit, { damage: toll.bossDamage });
      }
      const cleanse = (siege && siege.active) ? siege.onCleanse : onCleanse;
      for (let i = 0; i < kills; i++) cleanse();
      castCd = toll.cooldown; avatar.flare(); SkyAudio.roundBell(); ctrl.shake(empowered ? 0.18 : 0.12);
      return;
    }
    // The Breacher's Breach Dash: weapon 1 lunges 6 m along the aim line,
    // damaging and shoving everything in the lane. Works on the ground too.
    if (GAME.weapon === 1 && character.abilityConfig?.primary === 'breach-dash') {
      const dashDir = aimDir();
      if (ctrl.state !== 'flying') { dashDir.y = 0; }
      if (dashDir.lengthSq() < 1e-4) return;
      dashDir.normalize();
      const from = _dashFrom.copy(ctrl.pos);
      const probe = _dashProbe.copy(from);
      // Sample the lane in short steps so the dash stops at walls instead of
      // tunnelling through the campus architecture.
      for (let i = 0; i < 10; i++) {
        _dashTest.copy(probe).addScaledVector(dashDir, 0.6);
        resolveCollisions(_dashTest, PLAYER_R);
        if (_dashTest.distanceToSquared(probe) < 0.25 * 0.25) break;
        probe.copy(_dashTest);
      }
      if (ctrl.state !== 'flying') probe.y = from.y;
      const { kills } = wisps.breach(from, probe, { radius: 2.4, damage: 10 });
      hitSpellTargetsInRadius(probe, 2.2, 10, 1);
      const cleanse = (siege && siege.active) ? siege.onCleanse : onCleanse;
      for (let i = 0; i < kills; i++) cleanse();
      wisps.impactAt(from, 0.9);
      wisps.impactAt(probe, 1.35);
      ctrl.pos.copy(probe);
      castCd = 1.1; avatar.flare(); SkyAudio.dash(); ctrl.shake(0.14);
      return;
    }
    if (usesSealArrow()) return; // her weapon 1 is drawn and loosed, not tapped
    if (ctrl.state !== 'flying' && !combatTrainingRoomAt(ctrl.pos)) return;
    if (GAME.weapon === 3) return; // the moonbow only fires when drawn and loosed
    const dir = aimDir();
    const origin = muzzle(dir);
    if (GAME.weapon === 2) { // 星屑 — a fan of small embers
      const profile = WEAPON_PROFILES.scatter;
      let fired = false;
      const networkDirections = [];
      for (let i = 0; i < profile.pellets; i++) {
        _sc.copy(dir);
        _sc.x += (Math.random() - 0.5) * 0.24;
        _sc.y += (Math.random() - 0.5) * 0.24;
        _sc.z += (Math.random() - 0.5) * 0.24;
        _sc.normalize();
        if (bolts.fire(origin, _sc, {
          speed: profile.speed, ttl: profile.ttl, scale: profile.scale,
          r: profile.radius, damage: profile.damage, weapon: profile.id
        })) {
          fired = true;
          networkDirections.push([_sc.x, _sc.y, _sc.z]);
        }
      }
      if (fired) {
        skyMultiplayer.shoot(origin, networkDirections, 2);
        castCd = profile.cooldown; avatar.flare(); SkyAudio.scatter(); ctrl.shake(0.08);
      }
    } else {
      const profile = WEAPON_PROFILES.ember;
      if (bolts.fire(origin, dir, {
        speed: profile.speed, ttl: profile.ttl, scale: profile.scale,
        r: profile.radius, damage: profile.damage, weapon: profile.id
      })) {
        skyMultiplayer.shoot(origin, [dir], 1);
        castCd = profile.cooldown; avatar.flare(); SkyAudio.cast(); ctrl.shake(0.025);
      }
    }
  }
  const usesSealArrow = () => GAME.weapon === 1
    && playableCharacter(avatar.characterId).abilityConfig?.primary === 'seal-arrow';
  // 月弓 — press to draw, release to loose; power grows over 1.1s of draw.
  // The Archive Keeper draws on weapon 1 too: her seal arrow is a held shot.
  let drawT0 = -1;
  function drawStart(t) {
    if (GAME.phase < 1 || castCd > 0 || dead) return;
    const sealing = usesSealArrow();
    // The seal arrow is a guard's shot: she can hold the line on foot.
    if (!sealing && ctrl.state !== 'flying' && !combatTrainingRoomAt(ctrl.pos)) return;
    if (!sealing && GAME.weapon !== 3) return;
    drawT0 = t;
    SkyAudio.bowDraw();
  }
  function drawPower(t) {
    return drawT0 < 0 ? 0 : Math.min(1, (t - drawT0) / WEAPON_PROFILES.moonbow.drawTime);
  }
  function releaseBow(t) {
    if (drawT0 < 0) return false;
    const p = drawPower(t);
    drawT0 = -1;
    const sealing = usesSealArrow();
    // Grounded shots are the seal arrow's whole point, and drawStart already
    // lets her draw on foot — gating the release on flight left the Archive
    // Keeper drawing a bow that never loosed while she stood on the ground.
    const canLoose = sealing || ctrl.state === 'flying' || combatTrainingRoomAt(ctrl.pos);
    if (p < 0.12 || dead || !canLoose) {
      SkyAudio.bowRelease(0);
      return false;
    }
    const dir = aimDir();
    const origin = muzzle(dir);
    const profile = WEAPON_PROFILES.moonbow;
    // The seal arrow trades the moonbow's raw damage for a lasting mark:
    // whatever it pins takes more from every shot that follows, from anyone.
    const damage = sealing
      ? lerp(profile.damageMin, profile.damageMax, p) * 0.72
      : lerp(profile.damageMin, profile.damageMax, p);
    if (bolts.fire(origin, dir,
      { speed: lerp(profile.speedMin, profile.speedMax, p), ttl: profile.ttl,
        scale: lerp(profile.scaleMin, profile.scaleMax, p),
        r: lerp(profile.radiusMin, profile.radiusMax, p), stretch: profile.stretch,
        damage, weapon: profile.id,
        seal: sealing ? SEAL_DURATION * (0.6 + p * 0.4) : 0 })) {
      skyMultiplayer.shoot(origin, [dir], 3, p);
      castCd = sealing ? profile.cooldown * 0.8 : profile.cooldown;
      avatar.flare();
      ctrl.shake(0.08 + p * 0.12);
    }
    SkyAudio.bowRelease(p);
    return true;
  }
  const weaponInfo = w => {
    if (w === 1 && playableCharacter(avatar.characterId).abilityConfig?.primary === 'bell-toll') {
      return { name: tr('bell toll', '鐘鳴'), role: tr('SAGE NOVA · strikes all nearby foes · works on the ground', '賢者震波 · 命中周圍所有敵人 · 地面亦可施放') };
    }
    if (w === 1 && playableCharacter(avatar.characterId).abilityConfig?.primary === 'seal-arrow') {
      return { name: tr('seal arrow', '緘印箭'), role: tr('KEEPER MARK · hold to draw · sealed foes take more from everyone', '守書標記 · 按住蓄力 · 被緘印者受所有人傷害提升') };
    }
    if (w === 1 && playableCharacter(avatar.characterId).abilityConfig?.primary === 'breach-dash') {
      return { name: tr('breach dash', '破陣突刺'), role: tr('BREACHER LUNGE · dash 6 m and strike the lane · works on the ground', '攻堅突進 · 衝刺 6 公尺重擊路徑敵人 · 地面亦可施放') };
    }
    return ({
      1: { name: tr('ember', '晨焰'), role: tr('PRECISION · rapid mid-range pressure', '精準 · 中距離快速壓制') },
      2: { name: tr('scatter', '星屑'), role: tr('CLOSE CONTROL · wide burst', '近距控制 · 廣角爆發') },
      3: { name: tr('moonbow', '月弓'), role: tr('HEAVY RANGE · hold and release', '遠程重擊 · 蓄力放箭') }
    })[w];
  };
  const refreshWeapon = () => {
    weaponEl.innerHTML = [1, 2, 3].map(w => {
      const info = weaponInfo(w);
      const active = w === GAME.weapon;
      return `<span class="${active ? 'wactive' : ''}"${active ? ' aria-current="true"' : ''} title="${info.role}">${active ? '▶ ' : ''}${w} · ${info.name}</span>`;
    }).join('&nbsp;&nbsp;&nbsp;');
  };
  refreshWeapon();
  function setWeapon(w) {
    if (GAME.weapon === w) return;
    GAME.weapon = w;
    drawT0 = -1;
    SkyAudio.bowRelease(0); // silence a half-drawn string
    refreshWeapon();
    SkyAudio.weaponSelect();
    if (GAME.phase === 2) {
      const info = weaponInfo(w);
      storyCard(`${w} · ${info.name}`, info.role, 1800);
    }
  }
  function finale() {
    if (GAME.phase !== 3) return;
    if (skyMultiplayer.storyAct('enter-cloister')) return;
    completePrologue();
  }
  function completePrologue() {
    if (GAME.phase >= 4) return;
    GAME.phase = 4;
    // Chapter I is a safe investigation beat. Clear any delayed prologue
    // enemy so a reconnect or old timer cannot leave an inactive threat here.
    wisps.dissolveAll();
    SkyAudio.finale();
    GAME.hp = GAME.maxHp;
    opening.setChapterOneEnabled(true);
    storyCard(tr('The first memory breathes again.', '第一段記憶再次呼吸。'),
      tr('Chapter I · three places in the cloister still remember Mara’s name', '第一章 · 迴廊裡仍有三個地方記得瑪拉的名字'), 8200);
    refreshObjective();
  }

  function completeChapterOne(choice) {
    chapterChoice = choice || 'mara';
    GAME.phase = 6;
    if (!skyMultiplayer.connected || !skyMultiplayer.inStory) {
      blackGarden.setSnapshot({ phase: 6, partySize: 1, relays: [] });
    }
    storyCoopUI?.closeClueBoard();
    const believedMara = chapterChoice === 'mara';
    storyCard(
      believedMara ? tr('“I asked him to stop the hour.” — Mara Vale', '「是我請他讓時刻停止。」——瑪拉・維爾')
        : tr('The cloister corrects the memory: Mara asked the Warden.', '迴廊修正了記憶：是瑪拉向守望者提出要求。'),
      tr('her name returns to the campus · the Bell Warden was keeping a promise', '她的名字重回校園 · 鐘樓守望者一直在遵守承諾'), 9000);
    refreshObjective();
  }

  function submitStoryVote(choice) {
    if (GAME.phase !== 5) return false;
    if (skyMultiplayer.connected && skyMultiplayer.inStory) { skyMultiplayer.storyVote(choice); return true; }
    completeChapterOne(choice); return true;
  }

  function completeChapterTwo(choice) {
    gardenOutcome = choice === 'break' ? 'break' : 'restore';
    GAME.phase = 10;
    GAME.missionCompletedAt = performance.now() / 1000;
    blackGarden.chooseOffline(gardenOutcome);
    storyCoopUI?.closeGardenChoice();
    ctrl.resetTo([15, 1.6, -19]);
    GAME.hp = GAME.maxHp;
    ENV_RESTORE_PULSES.push({ position: new THREE.Vector3(15, 0.08, -19), radius: 58, age: 0, duration: 7.2 });
    storyCard(
      gardenOutcome === 'restore'
        ? tr('“My name was Elias. I kept every grief they left here.”', '「我的名字是伊萊亞斯。我守住了所有留在這裡的悲傷。」')
        : tr('The roots release their keeper, but forget his name.', '根系釋放了守護者，卻也忘記了他的名字。'),
      gardenOutcome === 'restore'
        ? tr('the Groundskeeper is remembered · jacarandas and campus lamps bloom again', '園丁被重新記起 · 藍花楹與校園燈火再次綻放')
        : tr('the corruption breaks · the campus heals with one story missing', '腐化被斬斷 · 校園復甦，卻少了一段故事'), 9600);
    refreshObjective();
  }

  function submitGardenVote(choice) {
    if (GAME.phase !== 9) return false;
    if (skyMultiplayer.connected && skyMultiplayer.inStory) { skyMultiplayer.storyGardenVote(choice); return true; }
    completeChapterTwo(choice); return true;
  }

  function onGroundskeeperHit(hit, bolt) {
    blackGarden.markHit();
    const power = hit.weapon === 3 ? Math.max(0, Math.min(1, (Number(bolt.damage) - 1.4) / 1.6)) : 0;
    if (skyMultiplayer.storyAct('groundskeeper-hit', { weapon: hit.weapon, power })) return;
    const nextPhase = blackGarden.damageOffline(hit.damage);
    if (nextPhase === 9) {
      GAME.phase = 9;
      storyCoopUI?.openOfflineGardenChoice();
      storyCard(tr('The Groundskeeper lowers his hands.', '園丁放下了雙手。'),
        tr('the roots will obey one final memory', '根系將服從最後一段記憶'), 4200);
    }
    refreshObjective();
  }

  function applySharedStory(snapshot) {
    if (!storyStarted || MODE !== 'story' || !snapshot || snapshot.version !== 3 || !snapshot.started) return;
    explorableBuildings.applySharedProgress(snapshot.roomProgress || {});
    const nextPhase = Math.max(0, Math.min(10, Number(snapshot.phase) || 0));
    // A reconnect may find a fresh server while an offline solo run is already
    // ahead. Never destroy local progress; a new page load can join that run.
    if (nextPhase < GAME.phase) {
      refreshStoryParty(snapshot);
      return;
    }
    const previousPhase = GAME.phase;
    const previousRelics = GAME.relics;
    const previousIncidents = new Set(chapterIncidents);
    const previousBossHp = lastBossHp;

    if (snapshot.memoryRecovered || nextPhase >= 1) {
      opening.recoverMemory();
      GAME.flightUnlocked = true;
    }

    const recoveredRelics = new Set(Array.isArray(snapshot.relics) ? snapshot.relics : []);
    for (const item of floats.items) item.def.collected = recoveredRelics.has(item.def.name);
    GAME.relics = recoveredRelics.size;
    GAME.cleansed = Math.max(0, Number(snapshot.cleansed) || 0);
    chapterIncidents.clear();
    for (const id of Array.isArray(snapshot.incidents) ? snapshot.incidents : []) {
      chapterIncidents.add(id); opening.setIncidentComplete(id);
    }
    GAME.phase = nextPhase;
    blackGarden.setSnapshot(snapshot);
    lastBossHp = Number(snapshot.bossHp) || 0;

    if (nextPhase >= 1 && previousPhase < 1) {
      avatar.playAnimation('interact', 1.1);
      SkyAudio.relic(1);
      hintEl.textContent = tr('press F or SPACE to take flight', '按 F 或 SPACE 起飛');
      showPersonalFragment();
    }

    if (Number(snapshot.partySize) === 1 && GAME.relics > previousRelics && GAME.relics < GAME.relicsNeeded) {
      const soloClue = fragmentCopy((Number(storyFragment) + GAME.relics) % 4);
      storyCard(`“${soloClue.line}”`, tr(`LANTERN ECHO · ${soloClue.label} · another perspective returns`, `提燈回聲 · ${soloClue.label} · 另一個視角回來了`), 5200);
    }

    if (nextPhase >= 2 && !strayActivated) {
      strayActivated = true;
      wisps.activateFirstStray(opening.encounterPosition);
      storyCard(tr('The fragments agree: the Warden was trying to protect someone.', '記憶碎片彼此吻合：守望者當時正試圖保護某個人。'),
        tr('the corrupted jacaranda speaks Mara’s name · a Stray answers', '腐化的藍花楹說出瑪拉的名字 · 一名迷途者回應了'), 6400);
    }

    if (nextPhase >= 3) {
      wisps.calmAll();
      const restoredNow = opening.completeEncounter();
      if (restoredNow) ENV_RESTORE_PULSES.push({ position: opening.restorePosition.clone(), radius: 24, age: 0, duration: 5.2 });
      if (nextPhase === 3 && !cloisterThresholdNarrated) {
        cloisterThresholdNarrated = true;
        setTimeout(() => {
          if (GAME.phase !== 3) return;
          storyCard(tr('A sealed bell answers from beyond the cloister.', '一道被封印的鐘聲從迴廊深處回應。'),
            tr('shared checkpoint · the threshold is safe · recover the missing names first', '共享檢查點 · 入口已安全 · 先尋回失落的名字'), 7200);
        }, previousPhase < 3 ? 900 : 120);
      }
    }

    if (nextPhase >= 4) {
      // Reconnects may jump directly from an older phase into Chapter I.
      // Clear every prologue enemy so the investigation chapter always begins
      // with a safe cloister, even after a reconnect or delayed transition.
      wisps.dissolveAll();
      opening.setChapterOneEnabled(true);
      if (previousPhase < 4) {
        storyCard(tr('The first memory breathes again.', '第一段記憶再次呼吸。'),
          tr('Chapter I · investigate the three memories inside the cloister', '第一章 · 調查迴廊裡的三段記憶'), 7600);
      }
      for (const id of chapterIncidents) {
        if (previousIncidents.has(id)) continue;
        const copy = incidentCopy(id); storyCard(copy[0], copy[1], 4600);
      }
    }
    if (nextPhase >= 6 && previousPhase < 6) {
      completeChapterOne(snapshot.choice);
      GAME.phase = nextPhase;
    }
    if (nextPhase >= 7 && previousPhase < 7) {
      const checkpoint = Array.isArray(snapshot.checkpointPosition) ? snapshot.checkpointPosition : blackGarden.spawnPosition.toArray();
      ctrl.resetTo(checkpoint);
      GAME.hp = GAME.maxHp;
      storyCard(tr('The lawn opens into its oldest memory.', '草坪開啟了最古老的記憶。'),
        tr('Chapter II · split up, ping relays, and carry light between the roots', '第二章 · 分頭行動、標記中繼站，在根系間傳遞光芒'), 7200);
    }
    if (nextPhase >= 8 && previousPhase < 8) {
      GAME.hp = GAME.maxHp;
      storyCard(tr('“I carried what the campus could not.” — the Groundskeeper', '「我背負了校園無法承受的一切。」——園丁'),
        tr('orange root rings strike the ground · take flight or move between them', '橙色根環會襲擊地面 · 起飛或移動到環帶之間'), 6600);
    }
    if (nextPhase === 8 && previousBossHp !== null && lastBossHp < previousBossHp) blackGarden.markHit();
    if (nextPhase >= 9 && previousPhase < 9) {
      storyCard(tr('The Groundskeeper lowers his hands.', '園丁放下了雙手。'),
        tr('choose together what the garden should remember', '一起選擇花園應該記住什麼'), 4400);
    }
    if (nextPhase >= 10 && previousPhase < 10) completeChapterTwo(snapshot.gardenOutcome);
    refreshObjective();
    renderer.domElement.dataset.storyState = JSON.stringify({
      runId: snapshot.runId,
      phase: GAME.phase,
      checkpoint: snapshot.checkpoint,
      relics: GAME.relics,
      partySize: snapshot.partySize,
      fragment: storyFragment,
      incidents: [...chapterIncidents],
      choice: snapshot.choice,
      relays: snapshot.relays,
      bossHp: snapshot.bossHp,
      bossMaxHp: snapshot.bossMaxHp,
      gardenOutcome: snapshot.gardenOutcome,
      friendlyFire: false
    });
  }
  function update(t, dt) {
    nowT = t;
    castCd = Math.max(0, castCd - dt);
    if (interactQueued) {
      const handled = reviveNearbyFriend() || recoverOpeningMemory() || recoverNearbyDriftingMemory()
        || investigateChapterIncident() || enterBlackGarden() || chargeGardenRelay()
        || explorableBuildings.interact(ctrl.pos);
      if (!handled && GAME.phase === 0) promptFlightLocked();
      interactQueued = false;
    }
    if (GAME.roleState.signatureActive) {
      signatureRemaining -= dt;
      if (signatureRemaining <= 0) {
        GAME.roleState.signatureActive = false;
        GAME.roleState.effect = null;
      }
    } else if (GAME.roleState.signatureCharge < 1) {
      const cooldown = Math.max(1, Number(playableCharacter(avatar.characterId).abilityConfig?.cooldownMs || 18000) / 1000);
      GAME.roleState.signatureCharge = Math.min(1, GAME.roleState.signatureCharge + dt / cooldown);
    }
    if (!skyMultiplayer.connected && !dead && GAME.hp > 0 && GAME.hp < GAME.maxHp && t - GAME.lastHitAt > 6) {
      const rekindleRate = GAME.roleState.passive === 'gentle-rekindling' ? 10 : 6;
      GAME.hp = Math.min(GAME.maxHp, GAME.hp + dt * rekindleRate); // the lantern rekindles itself
    }
    hpFillEl.style.width = (GAME.hp / GAME.maxHp * 100).toFixed(1) + '%';
    vigPulse = Math.max(0, vigPulse - dt * 2.2);
    vignetteEl.style.opacity = (vigPulse * 0.85 + (1 - GAME.hp / GAME.maxHp) * 0.3).toFixed(3);
    // Ground-first locomotion still represents an active player. Story
    // objectives, enemy awareness, and the restored-cloister trigger must not
    // disappear just because the lantern bearer has landed.
    const player = (ctrl.state === 'ground' || ctrl.state === 'flying') && !dead ? ctrl.pos : null;
    if (!player || MODE !== 'story' || UI_BLOCKS_STEERING || (siege && siege.active)) {
      setInteractionPrompt(null);
    } else {
      const dimmedFriend = skyMultiplayer.connected && skyMultiplayer.inStory ? skyMultiplayer.nearestDimmed(ctrl.pos, 5.1) : null;
      const roomPrompt = explorableBuildings.interactionPrompt(ctrl.pos);
      if (dimmedFriend) {
        setInteractionPrompt({ action: tr('Rekindle', '重新點亮'), target: dimmedFriend.name, detail: tr('Ready · stand together', '可救援 · 並肩站立') });
      } else if (roomPrompt) {
        setInteractionPrompt(roomPrompt);
      } else if (GAME.phase === 0) {
        setInteractionPrompt({
          action: tr('Investigate', '調查'),
          target: tr('Torn memory', '破碎的記憶'),
          detail: opening.playerNearMemory ? tr('Ready', '可互動') : tr('Follow the rising petals · too far', '跟隨逆流花瓣 · 距離太遠'),
          blocked: !opening.playerNearMemory
        });
      } else if (GAME.phase === 4) {
        let closestIncident = null, incidentDistance = Infinity;
        for (const incident of opening.incidents || []) {
          if (chapterIncidents.has(incident.id)) continue;
          const distance = ctrl.pos.distanceTo(incident.position);
          if (distance < incidentDistance) { closestIncident = incident; incidentDistance = distance; }
        }
        if (closestIncident && incidentDistance <= 8) setInteractionPrompt({
          action: tr('Investigate', '調查'), target: tr('Memory incident', '記憶事件'),
          detail: `${incidentDistance.toFixed(1)} m${incidentDistance > 5 ? tr(' · move closer', ' · 再靠近') : tr(' · ready', ' · 可互動')}`,
          blocked: incidentDistance > 5
        });
        else setInteractionPrompt(null);
      } else if (GAME.phase === 6) {
        const distance = ctrl.pos.distanceTo(blackGarden.entryPosition);
        setInteractionPrompt({
          action: tr('Enter', '進入'), target: tr('Black Garden root door', '黑色花園根系之門'),
          detail: `${distance.toFixed(1)} m${distance > 6.8 ? tr(' · move closer', ' · 再靠近') : tr(' · ready', ' · 可互動')}`,
          blocked: distance > 6.8
        });
      } else if (GAME.phase === 7) {
        const relay = blackGarden.nearestRelay(ctrl.pos, 5.1);
        if (relay) setInteractionPrompt({ action: tr('Charge relay', '點亮中繼站'), target: tr('Lantern relay', '提燈中繼站'), detail: tr(`${blackGarden.relayCount} / 3 lit · ready`, `${blackGarden.relayCount} / 3 已點亮 · 可互動`) });
        else setInteractionPrompt(null);
      } else setInteractionPrompt(null);
    }
    const wave = siege && siege.wave;   // during a siege wave, wisps dive the ward core
    const storyCombat = storyEnemyCombatActive();
    const tuning = currentCombatTuning();
    const combatActive = Boolean(wave || storyCombat)
      && (!UI_BLOCKS_STEERING || enemyCombatProbeActive);
    const combatTarget = combatActive ? player : null;
    blackGarden.update(t, dt, player, hitPlayer);
    if (QA_STORY_COOP_PROBE) {
      renderer.domElement.dataset.bossState = JSON.stringify(blackGarden.state);
    }
    wisps.update(t, dt, combatTarget, {
      active: combatActive,
      respawn: Boolean(wave || storyCombat),
      maxAttackers: wave ? Math.max(2, tuning.maxAttackers) : tuning.maxAttackers,
      buildingTarget: wave ? siege.coreTarget : null
    }, {
      hitPlayer,
      hitBuilding: wave ? siege.onCoreHit : null,
      heal: (a) => { GAME.hp = Math.min(GAME.maxHp, GAME.hp + a); }
    });
    if (QA_LOCOMOTION_PROBE || QA_ENEMY_COMBAT_PROBE) {
      renderer.domElement.dataset.gameState = JSON.stringify({
        phase: GAME.phase,
        relics: GAME.relics,
        cleansed: GAME.cleansed,
        hp: Number(GAME.hp.toFixed(1)),
        enemies: wisps.state,
        combat: wisps.combatStats,
        combatActive,
        difficulty: tuning.id,
        partySize: tuning.partySize
      });
    }
    bolts.update(dt, wisps, wave ? siege.onCleanse : onCleanse,
      GAME.phase === 8 && !(siege && siege.active) ? blackGarden : null, onGroundskeeperHit);
    if (GAME.phase === 3 && player && player.distanceTo(opening.exitPosition) < 8) finale();
    if (finaleK > 0 && finaleK < 1) { finaleK = Math.min(1, finaleK + dt / 5); env.finale(finaleK); }
    if ((GAME.roleState.signatureActive || GAME.roleState.signatureCharge < 1) && Math.floor(t * 5) !== Math.floor((t - dt) * 5)) refreshObjective();
  }
  // Siege hooks — let SiegeLoop drive the Unlight without duplicating combat.
  function beginWave() { GAME.phase = 2; wisps.activate(); }
  function endWave() { wisps.calmAll(); if (GAME.phase === 2) GAME.phase = 1; }
  function startEnemyCombatProbe({ type = 'stray', airborne = false, wall = false } = {}) {
    if (!QA_STORY_COOP_PROBE && !QA_ENEMY_COMBAT_PROBE) return false;
    enemyCombatProbeSnapshot = {
      phase: GAME.phase,
      hp: GAME.hp,
      flightUnlocked: GAME.flightUnlocked,
      position: ctrl.pos.toArray(),
      locomotion: ctrl.state
    };
    enemyCombatProbeActive = true;
    dead = false;
    GAME.phase = 2;
    GAME.flightUnlocked = true;
    GAME.hp = GAME.maxHp;
    GAME.lastHitAt = -999;
    playerInvulnerableUntil = 0;
    if (airborne) ctrl.setFlyingPositionForQA(0, 10, 19);
    else ctrl.setPositionForQA(0, GROUND_Y, 19);
    wisps.resetCombatStats();
    const enemyY = airborne && type !== 'groundskeeper' ? 10 : GROUND_Y + 0.7;
    wisps.activateForQA(type, new THREE.Vector3(0, enemyY, 11.5));
    if (wall) addEnemyCombatProbeWall();
    refreshObjective();
    return true;
  }
  function stopEnemyCombatProbe() {
    const result = { hp: Number(GAME.hp.toFixed(1)), combat: wisps.combatStats, enemies: wisps.state };
    enemyCombatProbeActive = false;
    wisps.calmAll();
    if (enemyCombatProbeWall) {
      const index = COLLIDERS.indexOf(enemyCombatProbeWall);
      if (index >= 0) COLLIDERS.splice(index, 1);
      enemyCombatProbeWall = null;
    }
    if (enemyCombatProbeSnapshot) {
      GAME.phase = enemyCombatProbeSnapshot.phase;
      GAME.hp = enemyCombatProbeSnapshot.hp;
      GAME.flightUnlocked = enemyCombatProbeSnapshot.flightUnlocked;
      if (enemyCombatProbeSnapshot.locomotion === 'flying') ctrl.setFlyingPositionForQA(...enemyCombatProbeSnapshot.position);
      else ctrl.setPositionForQA(...enemyCombatProbeSnapshot.position);
      enemyCombatProbeSnapshot = null;
      refreshObjective();
    }
    return result;
  }
  function moveEnemyCombatProbePlayer(x, y, z, airborne = false) {
    if (!enemyCombatProbeSnapshot) return false;
    return airborne ? ctrl.setFlyingPositionForQA(x, y, z) : ctrl.setPositionForQA(x, y, z);
  }
  function pauseEnemyCombatProbe(paused = true) {
    if (!enemyCombatProbeSnapshot) return false;
    enemyCombatProbeActive = !paused;
    return true;
  }
  function addEnemyCombatProbeWall() {
    if (!enemyCombatProbeSnapshot || enemyCombatProbeWall) return false;
    enemyCombatProbeWall = {
      kind: 'box', x: 0, z: 15.25, hw: 3.5, hd: 0.28,
      y0: 0, y1: 14, cos: 1, sin: 0, qaCombatWall: true
    };
    COLLIDERS.push(enemyCombatProbeWall);
    return true;
  }
  window.addEventListener('sky-language-change', () => { refreshObjective(); refreshWeapon(); });
  window.addEventListener('sky-difficulty-change', event => {
    wisps.retune();
    const id = event.detail?.difficulty || settings.prefs.difficulty;
    const labels = {
      story: tr('Story difficulty', '故事難度'),
      normal: tr('Normal difficulty', '標準難度'),
      warden: tr('Warden difficulty', '守望者難度')
    };
    storyCard(labels[id] || labels.normal, tr('enemy timing and pressure updated', '敵人節奏與壓力已更新'), 2200);
  });
  window.addEventListener('sky-story-fragment', event => {
    storyFragment = Math.max(0, Math.min(3, Number(event.detail?.fragment) || 0));
    refreshStoryParty();
  });
  window.addEventListener('sky-story-snapshot', event => applySharedStory(event.detail));
  window.addEventListener('sky-story-player', event => {
    if (event.detail?.id !== skyMultiplayer.selfId) return;
    if (event.detail.dimmed) {
      dead = true; GAME.hp = 0; ctrl.setDimmed(true); storyCoopUI?.setDimmed(true); avatar.playAnimation('down', 1.2);
    } else {
      dead = false; GAME.hp = Math.max(1, Number(event.detail.hp) || 55); playerInvulnerableUntil = nowT + 1; ctrl.setDimmed(false);
      storyCoopUI?.setDimmed(false); fadeEl.classList.remove('on'); SkyAudio.respawn(); avatar.playAnimation('interact', 0.8);
      storyCard(tr('Your lantern burns again.', '你的提燈再次燃起。'), tr('rekindled by a friend', '由朋友重新點亮'), 2600);
    }
  });
  window.addEventListener('sky-story-party-rekindle', event => {
    dead = false; GAME.hp = GAME.maxHp; playerInvulnerableUntil = nowT + 1; ctrl.setDimmed(false); storyCoopUI?.setDimmed(false);
    const p = event.detail?.position; if (Array.isArray(p)) ctrl.resetTo(p);
    wisps.calmAll(); fadeEl.classList.remove('on'); SkyAudio.respawn();
    storyCard(tr('The party’s lanterns remember the checkpoint.', '隊伍的提燈記得檢查點。'), tr('everyone rekindled together', '所有人一起重新點亮'), 3200);
  });
  return { update, cast, onRelic, onAirborne, onGrounded, drawStart, drawPower, releaseBow, setWeapon,
    usesDrawnShot: () => usesSealArrow()
      || (GAME.weapon === 3 && (ctrl.state === 'flying' || combatTrainingRoomAt(ctrl.pos))),
    startStory, promptFlightLocked, activateSignature, refreshObjective, refreshWeapon, submitStoryVote, submitGardenVote,
    queueInteract: () => { interactQueued = true; },
    beginWave, endWave, networkHit, networkDown, networkRespawn,
    startEnemyCombatProbe, stopEnemyCombatProbe, moveEnemyCombatProbePlayer, pauseEnemyCombatProbe,
    addEnemyCombatProbeWall,
    get state() { return { enemies: wisps.state, combat: wisps.combatStats, effects: wisps.effectStats, opening: {
      memoryRecovered: opening.memoryRecovered,
      encounterComplete: opening.encounterComplete,
      restoration: opening.restoration
    } }; }
  };
}

/* ================= Story B · Lantern Vanguard — P0 siege skeleton ================= */
// A solo-capable day/night siege layered on the existing flight and combat. LAN
// sessions mirror the server-authoritative, checkpointed ward state; offline play
// uses the same compressed local timeline. See STORY_LANTERN_VANGUARD.md.
function makeCoreBar() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 36;
  const tex = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.scale.set(5.2, 0.73, 1);
  sprite.userData = { canvas, tex };
  return sprite;
}
function drawCoreBar(sprite, frac, dark) {
  const { canvas, tex } = sprite.userData;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(10,8,14,0.72)';
  ctx.fillRect(2, 10, 252, 16);
  const w = Math.max(0, Math.min(1, frac)) * 248;
  ctx.fillStyle = dark ? '#3a2f55' : (frac < 0.3 ? '#e0684a' : '#ffc678');
  ctx.fillRect(4, 12, w, 12);
  ctx.strokeStyle = 'rgba(255,214,140,0.55)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(2, 10, 252, 16);
  tex.needsUpdate = true;
}

function makeWardLabel(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '300 30px "Cormorant Garamond", serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 8;
  ctx.fillStyle = 'rgba(240,230,214,0.9)';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(canvas); tex.anisotropy = 4;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, transparent: true, depthWrite: false, depthTest: false }));
  sprite.scale.set(3.4, 0.85, 1);
  return sprite;
}

// P1 — the five wards. Cores sit on the real explorable buildings, so each one
// finally has a defensive purpose, a gift while lit, and a loss when it falls.
const WARD_META = {
  archive:   { name: 'ARCHIVE',   zh: '檔案館', prose: 'the Moon Archive',    proseZh: '月之檔案館', res: 'The archivist',  resZh: '檔案守護者', gift: 'foresight' },
  alchemy:   { name: 'ALCHEMY',   zh: '鍊金坊', prose: "the Alchemist's Hall", proseZh: '鍊金工坊',  res: 'The alchemist',  resZh: '鍊金術士',   gift: 'mending' },
  infirmary: { name: 'INFIRMARY', zh: '療養所', prose: 'the Moon Infirmary',  proseZh: '月之療養所', res: 'The healer',     resZh: '療者',       gift: 'aura' },
  practice:  { name: 'PRACTICE',  zh: '演武堂', prose: 'the Practice Hall',   proseZh: '演武堂',    res: 'The warden',     resZh: '守夜人',     gift: 'vanguard' },
  owlpost:   { name: 'OWL POST',  zh: '郵所',   prose: 'the Owl Post',        proseZh: '貓頭鷹郵所', res: 'The postkeeper', resZh: '郵所看守',   gift: 'escort' }
};

function SiegeLoop(ctrl, game) {
  // compressed local timeline (seconds) — tunable; server clock coupling is P3
  const BRIEFING_S = 8, DEPLOYMENT_S = 12;
  const DUSK_S = 6, WAVE_S = 18, LULL_S = 8, DAWN_S = 8, WAVES = 3;
  const CORE_MAX = 100, WARD_Y = 10;
  const WAVE_DRAIN = 0.35;   // atmospheric strain; visible enemy impacts cause fire
  const HIT_DRAIN = 10;      // extra when a wisp reaches the focused ward
  const STOKE_RATE = 26;     // core restored per second while holding E in range
  const CLEANSE_HEAL = 5;    // focused ward restored per wisp cleansed
  const STOKE_RANGE = 16, OWL_GRACE = 3.5;

  const coreGeo = new THREE.IcosahedronGeometry(1.3, 1);
  const ringGeo = new THREE.TorusGeometry(2.3, 0.07, 8, 44);

  const wards = EXPLORABLES.map(def => {
    const meta = WARD_META[def.id] || { name: def.title, zh: def.title, prose: def.title, proseZh: def.title, res: 'A resident', resZh: '一位居民', gift: '' };
    const group = new THREE.Group();
    group.position.set(def.x, WARD_Y, def.z);
    const orbMat = new THREE.MeshStandardMaterial({
      color: 0xffd28c, emissive: 0xffb464, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0 });
    const orb = new THREE.Mesh(coreGeo, orbMat);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffc678, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2;
    const light = new THREE.PointLight(0xffb268, 0, 40, 2);
    const bar = makeCoreBar(); bar.position.y = 3.0;
    const label = makeWardLabel(tr(meta.name, meta.zh)); label.position.y = 3.9;
    group.add(orb, ring, light, bar, label);
    group.visible = false;
    scene.add(group);
    return {
      id: def.id, def, meta, group, orb, ring, light, bar, label, orbMat, ringMat,
      hp: CORE_MAX, dark: false, stage: 'safe', fireIntensity: 0,
      affectedSockets: [], rescueCount: 0, residentCount: 3, restoration: 0,
      seed: Math.random() * 9, previousStage: 'safe', fireAudioAt: -99
    };
  });
  const wardById = id => wards.find(w => w.id === id);
  const lit = id => { const w = wardById(id); return !!w && !w.dark; };
  const buildingFire = createBuildingFireSystem({
    scene,
    quality: settings.prefs.quality,
    getAccessibility: () => ({ reducedSmoke: settings.prefs.reducedSmoke, reducedFlash: settings.prefs.reducedFlash }),
    tr
  });
  wards.forEach(ward => buildingFire.register(ward));

  const coreTarget = new THREE.Vector3().copy(wards[0].group.position);
  const fireAudioPosition = new THREE.Vector3();
  let running = false, phase = 'idle', pt = 0, night = 0, waveIx = 0, shards = 0;
  let waveTargets = [], focus = wards[0], stokeHeld = false, rescueQueued = false, lostTonight = 0;
  let missionWardId = null, missionInteriorComplete = false, missionComplete = false;
  // dual-mode: 'local' runs the sim (offline); connected clients mirror the server.
  let prevPhase = '', stokeAcc = 0, buildingFireProbeActive = false, buildingFireProbeSnapshot = null;
  const prevDark = {};
  const isMirror = () => skyMultiplayer.connected && skyMultiplayer.inSiege && !buildingFireProbeActive;

  // P2 — day economy: spend shared shards on upgrades (server-tracked when co-op)
  let upgrades = { embers: 0, cores: 0, lantern: 0 };
  const MAX_TIER = 4;
  const upgradeCost = tier => 15 + tier * 15;
  const shopEl = document.getElementById('siegeShop');
  const shopShardEl = document.getElementById('shopShardCount');
  const BUY_KEYS = { KeyZ: 'embers', KeyX: 'cores', KeyC: 'lantern' };
  window.addEventListener('keydown', e => {
    if (!running || phase !== 'day' || !BUY_KEYS[e.code]) return;
    buy(BUY_KEYS[e.code]);
  });
  function buy(which) {
    if (isMirror()) { skyMultiplayer.siegeAct('upgrade', which); SkyAudio.weaponSelect(); return; }
    const tier = upgrades[which];
    if (tier < MAX_TIER && shards >= upgradeCost(tier)) { shards -= upgradeCost(tier); upgrades[which] = tier + 1; SkyAudio.weaponSelect(); }
  }
  function renderShop() {
    const open = running && phase === 'day';
    shopEl.classList.toggle('open', open);
    shopEl.setAttribute('aria-hidden', String(!open));
    if (!open) return;
    shopShardEl.textContent = Math.floor(shards);
    for (const li of shopEl.querySelectorAll('li[data-buy]')) {
      const tier = upgrades[li.dataset.buy] || 0;
      const maxed = tier >= MAX_TIER, cost = upgradeCost(tier);
      li.querySelector('.shop-lv').textContent = `LV ${tier}`;
      li.querySelector('.shop-cost').textContent = maxed ? tr('MAX', '滿') : `${cost}✦`;
      li.classList.toggle('maxed', maxed);
      li.classList.toggle('poor', !maxed && shards < cost);
    }
  }

  window.addEventListener('keydown', e => { if (e.code === 'KeyE') stokeHeld = true; });
  window.addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat) rescueQueued = true; });
  window.addEventListener('keyup', e => { if (e.code === 'KeyE') stokeHeld = false; });
  window.addEventListener('blur', () => { stokeHeld = false; });

  const targetCount = () => Math.min(wards.length, 1 + Math.floor(night / 2));
  function pickTargets() {
    const pool = wards.filter(w => !w.dark);
    const src = pool.length ? pool : wards;
    // Dusk previews the same building used by wave one. Later waves rotate.
    const start = (night * 3 + Math.max(0, waveIx - 1)) % src.length;
    const n = Math.min(targetCount(), src.length);
    const out = [];
    for (let i = 0; i < n; i++) out.push(src[(start + i) % src.length]);
    return out;
  }
  function nearestWard(max) {
    let best = null, bd = max;
    for (const w of wards) { const d = ctrl.pos.distanceTo(w.group.position); if (d < bd) { bd = d; best = w; } }
    return best;
  }
  function fallCard(w) {
    storyCard(
      tr(`${w.meta.res} flees ${w.meta.prose} into the dark.`, `${w.meta.resZh}逃入黑暗 — ${w.meta.proseZh}失守。`),
      tr('its gift is lost — relight the core in the day', '它的守護已失 — 於白晝重燃核心'), 6000);
  }
  function fall(w) {
    if (w.dark) return;
    w.dark = true; w.hp = 0; w.fireIntensity = 0; w.restoration = 0;
    w.stage = 'scorched'; w.affectedSockets = []; lostTonight++;
    window.dispatchEvent(new CustomEvent('sky-ward-fallen', { detail: { id: w.id } }));
    fallCard(w);
    SkyAudio.hurt();
  }

  function enter(next) {
    phase = next; pt = 0;
    if (next === 'briefing') {
      waveTargets = [];
      storyCard(
        tr('The campus wards are failing beyond the Great Hall.', '大禮堂外的校園防線正在失效。'),
        tr('briefing · walk through the doors when you are ready', '任務簡報 · 準備後步行穿過大門'), 7200);
    } else if (next === 'deployment') {
      storyCard(
        tr('The court is quiet for twelve more seconds.', '庭院還有十二秒的寧靜。'),
        tr('walk outside · find the first ward signal before combat begins', '步行到戶外 · 在戰鬥開始前尋找第一個防線信號'), 7200);
    } else if (next === 'dusk') {
      waveIx = 0; lostTonight = 0; waveTargets = pickTargets();
      if (!missionWardId) missionWardId = waveTargets[0]?.id || focus?.id || null;
      const names = waveTargets.map(w => tr(w.meta.name, w.meta.zh)).join(tr(', ', '、'));
      storyCard(
        tr(`Night ${night} — the tide is rising.`, `第 ${night} 夜 — 蝕潮升起。`),
        lit('archive') ? tr(`the archive foresees the first strike on ${names}`, `檔案館預見首波將襲：${names}`)
                       : tr('hold the ward cores · cleanse the Unlight · hold E to stoke', '守住防線核心 · 淨化夜蝕 · 長按 E 添薪'));
    } else if (next === 'wave') {
      waveIx++; waveTargets = pickTargets(); game.beginWave();
    } else if (next === 'lull') {
      game.endWave();
      storyCard(tr('The tide draws back.', '蝕潮暫退。'), tr('stoke and mend before it returns', '趁隙為核心添薪、修復'));
    } else if (next === 'dawn') {
      game.endWave();
      const allDark = wards.every(w => w.dark);
      storyCard(
        allDark ? tr('The city has gone dark.', '整座城市陷入黑暗。')
                : lostTonight === 0 ? tr('Every ward held the light.', '所有防線都守住了光。')
                                    : tr(`${lostTonight} ward(s) fell tonight.`, `今夜有 ${lostTonight} 道防線失守。`),
        lostTonight === 0 ? tr(`Night ${night} survived · ${shards} shards gathered`, `第 ${night} 夜守住 · ${shards} 餘燼`)
                          : tr('relight the dark cores before dusk', '在黃昏前重燃熄滅的核心'), 6500);
    } else if (next === 'complete') {
      game.endWave();
      const ward = wardById(missionWardId);
      storyCard(
        tr('The campus keeps its light.', '校園守住了光。'),
        tr(`${ward ? tr(ward.meta.name, ward.meta.zh) : tr('ward', '防線')} restored · ${ward?.rescueCount || 0}/${ward?.residentCount || 3} residents safe · room service online`,
          `${ward ? tr(ward.meta.name, ward.meta.zh) : '防線'}已復原 · ${ward?.rescueCount || 0}/${ward?.residentCount || 3} 名居民安全 · 房間服務恢復`), 9000);
    }
  }

  function tryCompleteLocalMission() {
    const ward = wardById(missionWardId);
    if (!missionWardId || !missionInteriorComplete || missionComplete || !ward
      || ward.dark || ward.fireIntensity > 0.02 || ward.restoration < 1) return false;
    missionComplete = true;
    enter('complete');
    return true;
  }

  function reportInteriorProgress(room, _item, complete) {
    if (!running || !complete || room !== missionWardId || waveIx < 1
      || !['dawn', 'day'].includes(phase)) return false;
    if (isMirror()) {
      skyMultiplayer.siegeAct('interior-complete', room);
      return true;
    }
    missionInteriorComplete = true;
    tryCompleteLocalMission();
    return true;
  }

  function start() {
    if (running) return;
    running = true; night = 1; shards = 0; lostTonight = 0;
    missionWardId = null; missionInteriorComplete = false; missionComplete = false;
    upgrades = { embers: 0, cores: 0, lantern: 0 };
    for (const w of wards) {
      Object.assign(w, {
        hp: CORE_MAX, dark: false, serverHp: CORE_MAX, stage: 'safe', fireIntensity: 0,
        affectedSockets: [], rescueCount: 0, residentCount: 3, restoration: 0,
        previousStage: 'safe', fireAudioAt: -99
      });
      w.group.visible = true;
    }
    for (const id of Object.keys(prevDark)) delete prevDark[id];
    prevPhase = ''; stokeAcc = 0;
    document.getElementById('worldStatus')?.classList.add('siege-hidden');
    // Own the HUD directly: GameFlow.onAirborne only shows it while phase === 0,
    // but the first wave flips phase to 2, so that path can lose the race.
    hudEl.classList.add('on');
    crosshairEl.classList.remove('on');
    if (GAME.phase === 0) GAME.phase = 1;   // enable casting immediately
    const hallEntry = roomRegistry.get('great-hall')?.anchors?.inside?.world;
    if (hallEntry) ctrl.resetTo([hallEntry.x, GROUND_Y, hallEntry.z]);
    hintEl.classList.remove('gone');
    hintEl.textContent = tr('W A S D walk · follow the briefing outside · F takes flight', 'W A S D 步行 · 依簡報前往戶外 · F 起飛');
    if (skyMultiplayer.connected) {
      phase = 'briefing'; pt = 0; waveTargets = [];
      skyMultiplayer.joinSiege();                              // server drives; snapshot arrives shortly
    } else enter('briefing');
  }

  function onCoreHit() {
    if (isMirror()) {
      if (focus && !focus.dark) skyMultiplayer.siegeAct('impact', focus.id);
      ctrl.shake(0.15);
      return;
    }
    if (focus && !focus.dark) {
      focus.hp = Math.max(0, focus.hp - HIT_DRAIN);
      focus.fireIntensity = Math.min(1, focus.fireIntensity + 0.12);
      ctrl.shake(0.2);
      refreshLocalWard(focus, true);
      if (focus.hp <= 0) fall(focus);
    }
  }
  function onCleanse() {
    SkyAudio.cleanse();
    if (isMirror()) { skyMultiplayer.siegeAct('cleanse'); return; }
    shards++;
    if (focus && !focus.dark) focus.hp = Math.min(CORE_MAX, focus.hp + CLEANSE_HEAL + upgrades.embers * 2);
  }

  // ---- local (offline) authoritative sim ----
  function refreshLocalWard(w, targeted = waveTargets.includes(w)) {
    w.fireIntensity = clamp(w.fireIntensity, 0, 1);
    if (targeted && phase === 'wave' && (w.fireIntensity > 0.01 || w.hp < 99)) w.restoration = 0;
    if (w.dark) { w.fireIntensity = 0; w.stage = 'scorched'; }
    else if (w.restoration >= 1) w.stage = 'restored';
    else if (w.fireIntensity >= 0.7 || w.hp < 22) w.stage = 'critical';
    else if (w.fireIntensity >= 0.34 || w.hp < 48) w.stage = 'burning';
    else if (w.fireIntensity >= 0.12 || w.hp < 72) w.stage = 'igniting';
    else if (targeted && (phase === 'dusk' || phase === 'wave')) w.stage = 'threatened';
    else w.stage = 'safe';
    const count = w.stage === 'critical' ? 4 : w.stage === 'burning' ? 3 : w.stage === 'igniting' ? 1 : 0;
    w.affectedSockets = ['roof', 'window', 'door', 'courtyard'].slice(0, count);
  }
  function runLocal(dt) {
    pt += dt;
    const drainMul = (lit('practice') ? 0.7 : 1) * ((lit('owlpost') && pt < OWL_GRACE) ? 0 : 1) * (1 - 0.1 * upgrades.cores);
    const trickle = lit('alchemy') ? 1.6 : 0;
    if (phase === 'wave') {
      const targeted = new Set(waveTargets);
      for (const w of wards) {
        if (w.dark) continue;
        if (targeted.has(w)) {
          w.hp = Math.max(0, w.hp - WAVE_DRAIN * drainMul * dt);
        }
        if (trickle) w.hp = Math.min(CORE_MAX, w.hp + trickle * dt);
        refreshLocalWard(w, targeted.has(w));
        if (w.hp <= 0) fall(w);
      }
      focus = waveTargets.filter(w => !w.dark).sort((a, b) => a.hp - b.hp)[0] || wards.find(w => !w.dark) || wards[0];
    } else {
      focus = nearestWard(1e9) || wards[0];
      const rate = phase === 'day' ? 6 : 3;
      for (const w of wards) {
        if (!w.dark && w.hp < CORE_MAX) w.hp = Math.min(CORE_MAX, w.hp + (rate + trickle) * dt);
        if (!w.dark) w.fireIntensity = Math.max(0, w.fireIntensity - 0.022 * dt);
        refreshLocalWard(w, phase === 'dusk' && waveTargets.includes(w));
      }
    }
    if (phase === 'briefing') { if (pt >= BRIEFING_S) enter('deployment'); }
    else if (phase === 'deployment') { if (pt >= DEPLOYMENT_S) enter('dusk'); }
    else if (phase === 'dusk') { if (pt >= DUSK_S) enter('wave'); }
    else if (phase === 'wave') { if (pt >= WAVE_S) enter(waveIx >= WAVES ? 'dawn' : 'lull'); }
    else if (phase === 'lull') { if (pt >= LULL_S) enter('wave'); }
    else if (phase === 'dawn') { if (pt >= DAWN_S) { night++; enter('day'); } }
    // Daylight remains until the integrated room objective and restoration are complete.
  }

  // ---- server-authoritative mirror (connected) ----
  function mirrorCard(snap) {
    if (snap.phase === 'briefing') {
      storyCard(tr('The campus wards are failing beyond the Great Hall.', '大禮堂外的校園防線正在失效。'),
        tr('briefing · walk through the doors when you are ready', '任務簡報 · 準備後步行穿過大門'), 7200);
    } else if (snap.phase === 'deployment') {
      storyCard(tr('The court is quiet for twelve more seconds.', '庭院還有十二秒的寧靜。'),
        tr('walk outside · find the first ward signal', '步行到戶外 · 尋找第一個防線信號'), 7200);
    } else if (snap.phase === 'dusk') {
      const names = snap.targets.map(id => { const w = wardById(id); return w ? tr(w.meta.name, w.meta.zh) : id; }).join(tr(', ', '、'));
      storyCard(
        tr(`Night ${snap.night} — the tide is rising.`, `第 ${snap.night} 夜 — 蝕潮升起。`),
        lit('archive') ? tr(`the archive foresees the first strike on ${names}`, `檔案館預見首波將襲：${names}`)
                       : tr('hold the ward cores · cleanse · hold E to stoke', '守住防線核心 · 淨化 · 長按 E 添薪'));
    } else if (snap.phase === 'lull') {
      storyCard(tr('The tide draws back.', '蝕潮暫退。'), tr('stoke and mend before it returns', '趁隙為核心添薪、修復'));
    } else if (snap.phase === 'dawn') {
      const dark = snap.wards.filter(w => w.dark).length;
      storyCard(
        dark ? tr(`${dark} ward(s) stand dark.`, `尚有 ${dark} 道防線熄滅。`) : tr('Every ward held the light.', '所有防線都守住了光。'),
        tr('dawn breaks over the city', '晨光灑落城市'), 6000);
    } else if (snap.phase === 'complete') {
      const ward = wardById(snap.mission?.ward);
      storyCard(
        tr('The campus keeps its light.', '校園守住了光。'),
        tr(`${ward ? tr(ward.meta.name, ward.meta.zh) : tr('ward', '防線')} restored · ${ward?.rescueCount || 0}/${ward?.residentCount || 3} residents safe · room service online`,
          `${ward ? tr(ward.meta.name, ward.meta.zh) : '防線'}已復原 · ${ward?.rescueCount || 0}/${ward?.residentCount || 3} 名居民安全 · 房間服務恢復`), 9000);
    }
  }
  function applyServer(snap, dt) {
    night = snap.night; waveIx = snap.waveIx;
    missionWardId = snap.mission?.ward || missionWardId;
    missionInteriorComplete = Boolean(snap.mission?.interiorComplete);
    missionComplete = Boolean(snap.mission?.complete);
    waveTargets = snap.targets.map(id => wardById(id)).filter(Boolean);
    for (const sw of snap.wards) {
      const w = wardById(sw.id); if (!w) continue;
      if (sw.dark && !w.dark) { fallCard(w); window.dispatchEvent(new CustomEvent('sky-ward-fallen', { detail: { id: w.id } })); SkyAudio.hurt(); }
      else if (!sw.dark && w.dark) storyCard(tr(`${w.meta.prose} is relit.`, `${w.meta.proseZh}重新點亮。`), '', 3200);
      w.dark = sw.dark; w.serverHp = sw.hp;
      w.stage = sw.stage || (sw.dark ? 'scorched' : 'safe');
      w.fireIntensity = Number(sw.fireIntensity) || 0;
      w.affectedSockets = Array.isArray(sw.affectedSockets) ? [...sw.affectedSockets] : [];
      w.rescueCount = Number(sw.rescueCount) || 0;
      w.residentCount = Number(sw.residentCount) || 3;
      w.restoration = Number(sw.restoration) || 0;
    }
    for (const w of wards) { if (w.serverHp === undefined) w.serverHp = w.hp; w.hp += (w.serverHp - w.hp) * Math.min(1, dt * 8); }
    focus = wardById(snap.focus) || focus || wards[0];
    shards = snap.shards;
    if (snap.upgrades) upgrades = snap.upgrades;
    if (snap.phase !== prevPhase) {
      if (snap.phase === 'wave') game.beginWave();
      else if (prevPhase === 'wave') game.endWave();
      mirrorCard(snap);
      prevPhase = snap.phase;
    }
    phase = snap.phase;
  }

  function presentWards(t, dt) {
    for (const w of wards) {
      const f = w.hp / CORE_MAX;
      w.group.rotation.y += dt * 0.4;
      w.orb.rotation.x += dt * 0.6;
      w.orbMat.color.setHex(w.dark ? 0x2a2440 : 0xffd28c);
      if (['igniting', 'burning', 'critical'].includes(w.stage)) w.orbMat.color.setHex(w.stage === 'critical' ? 0xff5d43 : 0xff9a52);
      w.orbMat.emissiveIntensity = w.dark ? 0.1 : 1.2 + Math.sin(t * 3 + w.seed) * 0.3 + f * 1.1;
      w.light.intensity = w.dark ? 0 : 3 + f * 7 + (w === focus && phase === 'wave' ? 2 : 0);
      w.ringMat.opacity = w.dark ? 0.06 : 0.16 + f * 0.4;
      w.ring.rotation.z += dt * 0.7;
      w.label.material.opacity = w.dark ? 0.4 : 0.85;
      drawCoreBar(w.bar, f, w.dark);
      if (w.stage !== w.previousStage) {
        if (['threatened', 'igniting', 'burning', 'critical'].includes(w.stage)) {
          SkyAudio.buildingAlarm(w.group.position, Math.max(0.25, w.fireIntensity));
        }
        w.previousStage = w.stage;
      }
      if (w.fireIntensity > 0.08 && t - w.fireAudioAt > 2.6) {
        w.fireAudioAt = t + w.seed * 0.08;
        SkyAudio.buildingFire(buildingFire.attackSocket(w, waveIx, fireAudioPosition), w.fireIntensity);
      }
    }
  }
  function renderHud() {
    const label = { briefing: 'BRIEFING', deployment: 'DEPLOY', dusk: 'DUSK', wave: `WAVE ${waveIx}/${WAVES}`, lull: 'LULL', dawn: 'DAWN', day: 'DAY', complete: 'MISSION COMPLETE' }[phase] || '';
    const labelZh = { briefing: '簡報', deployment: '部署', dusk: '黃昏', wave: `第 ${waveIx}/${WAVES} 波`, lull: '喘息', dawn: '破曉', day: '白晝', complete: '任務完成' }[phase] || '';
    const targeted = new Set(phase === 'wave' ? waveTargets : []);
    const dots = wards.map(w => {
      const color = w.dark ? '#6a5c8c' : (w.hp < 30 ? '#e0684a' : (targeted.has(w) ? '#ffe0b0' : '#ffc678'));
      const glyph = w.dark ? '✕' : (targeted.has(w) ? '◉' : '●');
      return `<span style="color:${color}">${glyph}</span>`;
    }).join(' ');
    const stageLabel = focus ? ({ threatened: tr('THREATENED', '受威脅'), igniting: tr('IGNITING', '起火'), burning: tr('BURNING', '燃燒'), critical: tr('CRITICAL', '危急'), scorched: tr('SCORCHED', '焦黑'), restored: tr('RESTORED', '已復原') }[focus.stage] || '') : '';
    const missionWard = wardById(missionWardId);
    const foc = phase === 'complete'
      ? tr(`${missionWard ? missionWard.meta.name : 'WARD'} RESTORED · ${missionWard?.rescueCount || 0}/${missionWard?.residentCount || 3} SAFE`, `${missionWard ? missionWard.meta.zh : '防線'}已復原 · ${missionWard?.rescueCount || 0}/${missionWard?.residentCount || 3} 安全`)
      : focus ? `${tr(focus.meta.name, focus.meta.zh)} ${Math.round(focus.hp)}% · ${stageLabel}` : '';
    const co = isMirror() ? tr(` · ${skyMultiplayer.peers.size + 1}▲`, ` · ${skyMultiplayer.peers.size + 1}▲`) : '';
    objectiveEl.innerHTML = tr(
      `NIGHT ${night} · ${label}${co} &nbsp; ${dots} &nbsp; ${foc}`,
      `第 ${night} 夜 · ${labelZh}${co} &nbsp; ${dots} &nbsp; ${foc}`);
    weaponEl.classList.toggle('visible', phase === 'wave');
    weaponEl.classList.toggle('combat-expanded', phase === 'wave');
    if (buildingEmergencyEl) {
      const dangerous = phase === 'wave' && focus && ['threatened', 'igniting', 'burning', 'critical'].includes(focus.stage);
      buildingEmergencyEl.classList.toggle('on', !!dangerous);
      buildingEmergencyEl.setAttribute('aria-hidden', dangerous ? 'false' : 'true');
      if (dangerous) {
        buildingEmergencyNameEl.textContent = tr(focus.meta.name, focus.meta.zh);
        buildingEmergencyStateEl.textContent = `${stageLabel} · ${Math.round(focus.hp)}%`;
        buildingEmergencyTrackEl.style.width = `${Math.max(0, Math.min(100, focus.hp))}%`;
        buildingEmergencyActionEl.textContent = ['burning', 'critical'].includes(focus.stage)
          ? tr(`R evacuate ${focus.rescueCount}/${focus.residentCount} · hold E to suppress`, `R 疏散 ${focus.rescueCount}/${focus.residentCount} · 長按 E 滅火`)
          : tr('Defeat attackers before the building ignites', '在建築起火前擊退攻擊者');
      }
    }
    vignetteEl.style.opacity = (phase === 'wave' && focus && !focus.dark ? (1 - focus.hp / CORE_MAX) * 0.5 : 0).toFixed(3);
  }
  window.addEventListener('sky-language-change', () => { if (running) renderHud(); });

  function update(t, dt) {
    if (!running) return;
    const snap = isMirror() ? skyMultiplayer.siegeSnapshot : null;
    if (snap) applyServer(snap, dt);
    else runLocal(dt);

    if (focus) buildingFire.attackSocket(focus, waveIx, coreTarget);
    buildingFire.update(t, dt, ctrl.pos, wards);

    // stoke / relight the nearest ward — apply locally offline, send an act when mirroring
    const near = nearestWard(STOKE_RANGE);
    const calmMission = ['dawn', 'day'].includes(phase);
    const missionNeedsInterior = calmMission && missionWardId && !missionInteriorComplete;
    const insideMissionRoom = missionWardId && roomRegistry.contains(missionWardId, ctrl.pos);
    const missionRoomPrompt = insideMissionRoom ? explorableBuildings.interactionPrompt(ctrl.pos) : null;
    if (!UI_BLOCKS_STEERING && missionRoomPrompt) {
      setInteractionPrompt(missionRoomPrompt);
    } else if (!UI_BLOCKS_STEERING && near) {
      const distance = ctrl.pos.distanceTo(near.group.position);
      const suppressingPrompt = !near.dark && near.fireIntensity > 0.01;
      const waitingForInterior = missionNeedsInterior && near.id === missionWardId;
      const restoringPrompt = near.dark && calmMission && !waitingForInterior;
      const repairingPrompt = calmMission && missionInteriorComplete && near.id === missionWardId
        && !near.dark && near.fireIntensity <= 0.01 && near.restoration < 1;
      setInteractionPrompt({
        action: waitingForInterior ? tr('Complete room objective', '完成房間目標')
          : suppressingPrompt ? tr('Suppress fire', '滅火')
            : restoringPrompt ? tr('Restore core', '修復核心')
              : repairingPrompt ? tr('Repair ward', '修復防線') : tr('Stoke core', '為核心添薪'),
        target: tr(near.meta.name, near.meta.zh),
        detail: waitingForInterior
          ? tr('exterior safe · enter the damaged room and finish its service objective', '外部安全 · 進入受損房間並完成服務目標')
          : `${distance.toFixed(1)} m · ${Math.round(near.hp)}%${suppressingPrompt ? tr(` · ${near.rescueCount}/${near.residentCount} evacuated`, ` · ${near.rescueCount}/${near.residentCount} 已疏散`) : ''}`,
        blocked: waitingForInterior
      });
    } else if (!UI_BLOCKS_STEERING) setInteractionPrompt(null);
    if (rescueQueued && near && ['burning', 'critical'].includes(near.stage) && near.rescueCount < near.residentCount) {
      if (snap) skyMultiplayer.siegeAct('rescue', near.id);
      else near.rescueCount++;
      storyCard(tr(`Resident guided from ${near.meta.prose}.`, `已引導居民離開${near.meta.proseZh}。`),
        tr(`${near.rescueCount}/${near.residentCount} residents safe · hold E to suppress fire`, `${near.rescueCount}/${near.residentCount} 名居民安全 · 長按 E 滅火`), 2200);
    }
    rescueQueued = false;
    if (stokeHeld && near && !(missionNeedsInterior && near.id === missionWardId)) {
      const socket = buildingFire.nearestSocket(ctrl.pos, near, STOKE_RANGE + 4);
      const suppressing = !near.dark && near.fireIntensity > 0.01;
      const restoring = near.dark && ['lull', 'dawn', 'day'].includes(phase);
      const repairing = calmMission && missionInteriorComplete && near.id === missionWardId
        && !near.dark && near.fireIntensity <= 0.01 && near.restoration < 1;
      if (snap) {
        stokeAcc += dt;
        if (stokeAcc >= 0.2) {
          stokeAcc = 0;
          skyMultiplayer.siegeAct((restoring || repairing) ? 'restore' : suppressing ? 'suppress' : 'stoke', near.id);
        }
      } else {
        const stokeMul = (lit('infirmary') ? 1.35 : 1) * (1 + upgrades.lantern * 0.2);
        if (restoring || repairing) {
          near.restoration = Math.min(1, near.restoration + dt * 0.48 * stokeMul);
          near.hp = Math.max(near.hp, CORE_MAX * 0.55 * near.restoration);
          if (near.restoration >= 1) {
            near.dark = false; near.hp = Math.max(60, near.hp); refreshLocalWard(near, false);
            storyCard(tr(`${near.meta.prose} is restored.`, `${near.meta.proseZh}已復原。`), tr('lights and residents return', '燈火與居民重新歸來'), 3200);
            tryCompleteLocalMission();
          }
        } else if (suppressing) {
          near.fireIntensity = Math.max(0, near.fireIntensity - dt * 0.42 * stokeMul);
          near.hp = Math.min(CORE_MAX, near.hp + dt * 4.2 * stokeMul);
          refreshLocalWard(near, true);
          tryCompleteLocalMission();
        } else near.hp = Math.min(CORE_MAX, near.hp + STOKE_RATE * stokeMul * dt);
      }
      if (socket && (suppressing || restoring || repairing)) buildingFire.setBeam(ctrl.pos, socket.position, restoring || repairing);
    }
    // the infirmary's aura mends the lantern itself, in either mode
    if (lit('infirmary') && GAME.hp < GAME.maxHp) GAME.hp = Math.min(GAME.maxHp, GAME.hp + dt * 4);

    presentWards(t, dt);
    renderHud();
    renderShop();
  }

  function startBuildingFireProbe() {
    if (!QA_BUILDING_FIRE_PROBE && !QA_STORY_COOP_PROBE) return false;
    buildingFireProbeSnapshot = {
      running, phase, pt, night, waveIx, shards, focusId: focus?.id,
      targets: waveTargets.map(ward => ward.id),
      position: ctrl.pos.toArray(),
      wards: wards.map(ward => ({
        id: ward.id, hp: ward.hp, dark: ward.dark, stage: ward.stage,
        fireIntensity: ward.fireIntensity, affectedSockets: [...ward.affectedSockets],
        rescueCount: ward.rescueCount, residentCount: ward.residentCount,
        restoration: ward.restoration, visible: ward.group.visible
      }))
    };
    buildingFireProbeActive = true;
    running = true; phase = 'wave'; pt = 7; night = 1; waveIx = 1;
    focus = wards[0]; waveTargets = [focus];
    for (const ward of wards) {
      Object.assign(ward, { hp: 100, dark: false, stage: 'safe', fireIntensity: 0,
        affectedSockets: [], rescueCount: 0, residentCount: 3, restoration: 0 });
      ward.group.visible = true;
    }
    ctrl.setPositionForQA(focus.def.x, GROUND_Y, focus.def.z + 10.5);
    refreshLocalWard(focus, true);
    return true;
  }
  function setBuildingFireProbeStage(stage) {
    if (!buildingFireProbeActive || !focus) return false;
    const presets = {
      threatened: { hp: 96, dark: false, fireIntensity: 0, restoration: 0 },
      igniting: { hp: 68, dark: false, fireIntensity: 0.18, restoration: 0 },
      burning: { hp: 43, dark: false, fireIntensity: 0.52, restoration: 0 },
      critical: { hp: 16, dark: false, fireIntensity: 0.84, restoration: 0 },
      scorched: { hp: 0, dark: true, fireIntensity: 0, restoration: 0 },
      restored: { hp: 70, dark: false, fireIntensity: 0, restoration: 1 }
    };
    const preset = presets[stage];
    if (!preset) return false;
    Object.assign(focus, preset);
    if (stage === 'scorched' || stage === 'restored') {
      phase = 'lull';
      pt = 0;
    } else {
      phase = 'wave';
      pt = 7;
    }
    refreshLocalWard(focus, phase === 'wave');
    return true;
  }
  function setBuildingFireProbeBeam(active) {
    if (!buildingFireProbeActive) return false;
    stokeHeld = Boolean(active);
    return true;
  }
  function rescueBuildingFireProbe() {
    if (!buildingFireProbeActive) return false;
    rescueQueued = true;
    return true;
  }
  function stopBuildingFireProbe() {
    if (!buildingFireProbeSnapshot) return false;
    stokeHeld = false; rescueQueued = false; buildingFireProbeActive = false;
    ({ running, phase, pt, night, waveIx, shards } = buildingFireProbeSnapshot);
    focus = wardById(buildingFireProbeSnapshot.focusId) || wards[0];
    waveTargets = buildingFireProbeSnapshot.targets.map(wardById).filter(Boolean);
    for (const saved of buildingFireProbeSnapshot.wards) {
      const ward = wardById(saved.id); if (!ward) continue;
      Object.assign(ward, saved); ward.group.visible = saved.visible;
    }
    ctrl.setPositionForQA(...buildingFireProbeSnapshot.position);
    buildingFireProbeSnapshot = null;
    if (!running) {
      setInteractionPrompt(null);
      objectiveEl.textContent = '';
      weaponEl.classList.remove('visible', 'combat-expanded');
      vignetteEl.style.opacity = '0';
      buildingEmergencyEl?.classList.remove('on');
      buildingEmergencyEl?.setAttribute('aria-hidden', 'true');
      shopEl.classList.remove('open');
      shopEl.setAttribute('aria-hidden', 'true');
    }
    return true;
  }

  return {
    start, update, onCoreHit, onCleanse, coreTarget,
    reportInteriorProgress,
    startBuildingFireProbe, setBuildingFireProbeStage, setBuildingFireProbeBeam,
    rescueBuildingFireProbe, stopBuildingFireProbe,
    roomThreat(id) {
      const ward = wardById(id);
      return ward ? { stage: ward.stage, fireIntensity: ward.fireIntensity, dark: ward.dark } : null;
    },
    canUseRoom(id) {
      return !running || id !== missionWardId || ['dawn', 'day', 'complete'].includes(phase);
    },
    get active() { return running; },
    get wave() { return running && phase === 'wave'; },
    get state() { return {
      running, phase, night, waveIx, shards, targets: waveTargets.map(w => w.id), focus: focus && focus.id,
      mission: { ward: missionWardId, interiorComplete: missionInteriorComplete, complete: missionComplete },
      fire: buildingFire.stats,
      wards: wards.map(w => ({
        id: w.id, hp: Math.round(w.hp), dark: w.dark, stage: w.stage,
        fireIntensity: Number(w.fireIntensity.toFixed(3)), affectedSockets: [...w.affectedSockets],
        rescueCount: w.rescueCount, residentCount: w.residentCount,
        restoration: Number(w.restoration.toFixed(3))
      })),
      enemyTargetOffset: focus ? Number(coreTarget.distanceTo(focus.group.position).toFixed(3)) : 0
    }; }
  };
}

/* ================= Duel — first-person hide & seek across the night city ================= */
// Warden's Trial (vs AI) fills the screen; Twin Lanterns splits it left/right.
// You fly where you look. Your lantern betrays you in the dark — hush it (dim)
// to vanish, but a hushed flame cannot cast. Casting relights you for all to see.
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const HUNT_R = 80, HUNT_Y0 = 1.3, HUNT_Y1 = 34;

function CameraController(avatar) {
  let state = 'ground';           // ground | lifting | flying; touching down returns to ground
  let liftStart = 0, liftE = 0;
  let firstFlightRitualComplete = false;
  let firstPerson = false;        // V toggles; third-person shows the traveler
  let shakeAmt = 0;               // impact shake, decays exponentially
  let shakePhase = 0;             // smooth trauma phase; avoids random frame jitter
  let yaw = STORY_START.yaw, pitch = 0.08;
  let tYaw = STORY_START.yaw, tPitch = 0.08;
  const pos = new THREE.Vector3(STORY_START.x, STORY_START.y, STORY_START.z);
  const liftOrigin = new THREE.Vector3();
  let liftYaw = STORY_START.yaw;
  const vel = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const fwd = new THREE.Vector3(), rightv = new THREE.Vector3();
  const camGoal = new THREE.Vector3();
  const cameraAnchor = new THREE.Vector3();
  const cameraSafe = new THREE.Vector3();
  const mouse = { x: 0, y: 0 };   // normalized -1..1
  let pointerSeen = false, lastPointerX = 0, lastPointerY = 0;
  let edgeLookEnabled = false, pointerWasLocked = false;
  const keys = Object.create(null);
  const keyReleaseTimers = Object.create(null);
  const bufferedMovementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);
  const heldLocomotionCodes = new Set([...bufferedMovementCodes, 'Space']);
  const clearPressedKeys = () => { for (const code in keys) keys[code] = false; };
  const el = renderer.domElement;
  const gamepadInput = createGamepadCameraInput();
  const cameraOcclusion = createCameraOcclusion({ THREE, scene, camera, ignoreRoot: avatar.group });
  let gamepadState = gamepadInput.sample();
  el.tabIndex = -1;
  el.dataset.locomotion = state;
  el.dataset.landing = 'false';
  el.dataset.cameraRecentering = 'false';
  let landingRequested = false;
  let dimmedMovement = false;
  const recenter = { active: false, started: 0, fromYaw: 0, toYaw: 0, fromPitch: 0, toPitch: 0 };

  const lookSensitivity = () => state === 'flying'
    ? PLAYER_PREFS.flightLookSensitivity
    : PLAYER_PREFS.groundLookSensitivity;
  const verticalLookDirection = () => PLAYER_PREFS.invertY ? 1 : -1;
  const currentCameraRoom = () => roomRegistry.cameraAt(pos);
  const groundYAt = value => GROUND_Y + roomRegistry.groundSurfaceAt(value);
  const cancelRecenter = () => {
    recenter.active = false;
    el.dataset.cameraRecentering = 'false';
  };
  const requestRecenter = (now = clock.elapsedTime) => {
    if (state !== 'ground' && state !== 'flying') return false;
    const plan = cameraRecenterPlan({
      yaw: tYaw, pitch: tPitch, velocityX: vel.x, velocityZ: vel.z, state
    });
    Object.assign(recenter, {
      active: true,
      started: Number(now) || 0,
      fromYaw: plan.fromYaw,
      toYaw: plan.toYaw,
      fromPitch: plan.fromPitch,
      toPitch: plan.toPitch,
      duration: plan.duration
    });
    el.dataset.cameraRecentering = 'true';
    return true;
  };

  const setLocomotionState = next => {
    state = next;
    el.dataset.locomotion = next;
  };

  const handleKeyDown = e => {
    if (QA_LOCOMOTION_PROBE) el.dataset.lastKeyDown = `${e.code}:${e.key}`;
    if (keyReleaseTimers[e.code]) {
      clearTimeout(keyReleaseTimers[e.code]);
      keyReleaseTimers[e.code] = 0;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && state === 'ground' && MODE === 'story' && !UI_BLOCKS_STEERING) {
        liftOff(clock.elapsedTime, true);
      }
    }
    if (e.code === 'Escape') edgeLookEnabled = false;
    // Interaction/action keys have their own one-shot handlers. Keeping only
    // locomotion controls here guarantees repeated E presses cannot create or
    // preserve movement velocity.
    if (!UI_BLOCKS_STEERING && heldLocomotionCodes.has(e.code)) keys[e.code] = true;
    if (e.code === 'KeyV' && !e.repeat) firstPerson = !firstPerson;
    if (e.code === 'KeyT' && !e.repeat && !UI_BLOCKS_STEERING) {
      e.preventDefault();
      requestRecenter();
    }
  };
  const handleKeyUp = e => {
    if (QA_LOCOMOTION_PROBE) el.dataset.lastKeyUp = `${e.code}:${e.key}`;
    if (e.code === 'Space') e.preventDefault();
    if (bufferedMovementCodes.has(e.code)) {
      // Preserve ultra-short taps long enough for one animation frame. This
      // keeps walking dependable for keyboard accessibility tools and under
      // occasional low-frame-rate input without changing normal held input.
      keyReleaseTimers[e.code] = setTimeout(() => {
        keys[e.code] = false;
        keyReleaseTimers[e.code] = 0;
      }, QA_LOCOMOTION_PROBE ? 420 : 72);
    } else if (heldLocomotionCodes.has(e.code)) keys[e.code] = false;
  };
  // Capture before focused controls or overlays can consume Space after macOS
  // returns focus from the screen-recording picker.
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  const key = (...codes) => codes.some(c => keys[c]) ? 1 : 0;

  const focusGameCanvas = () => {
    try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
  };
  const lockPointer = () => {
    if (document.pointerLockElement === el) return;
    // If the embedded browser rejects Pointer Lock, this same click enables
    // edge-turning so the player can still rotate beyond the screen bounds.
    edgeLookEnabled = true;
    el.dataset.lookControl = 'edge-pan';
    focusGameCanvas();
    if (!el.requestPointerLock) { syncPointerLockHint(); return; }
    try {
      const request = el.requestPointerLock();
      if (request && typeof request.catch === 'function') request.catch(() => {});
    } catch (_) { /* browser may require a fresh click; canvas click retries */ }
    setTimeout(() => syncPointerLockHint(), 250);
  };
  el.addEventListener('pointermove', e => {
    const locked = document.pointerLockElement === el;
    const dx = locked ? e.movementX : (pointerSeen ? e.clientX - lastPointerX : 0);
    const dy = locked ? e.movementY : (pointerSeen ? e.clientY - lastPointerY : 0);
    pointerSeen = true;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    const rect = el.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    mouse.y = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1;
    if ((state === 'ground' || state === 'flying') && !UI_BLOCKS_STEERING) {
      if (Math.abs(dx) + Math.abs(dy) > 0.01) cancelRecenter();
      const sensitivity = lookSensitivity();
      tYaw -= dx * 0.0032 * sensitivity;
      tPitch = clampCameraPitch(tPitch + dy * 0.0026 * sensitivity * verticalLookDirection(), state);
      // Direct response: no edge-driven rotation and no delayed camera catch-up.
      yaw = tYaw;
      pitch = tPitch;
    }
  });
  el.addEventListener('pointerleave', () => { pointerSeen = false; });
  window.addEventListener('sky-touch-look', e => {
    if ((state !== 'ground' && state !== 'flying') || UI_BLOCKS_STEERING) return;
    const dx = Number(e.detail?.dx) || 0;
    const dy = Number(e.detail?.dy) || 0;
    if (Math.abs(dx) + Math.abs(dy) > 0.01) cancelRecenter();
    const sensitivity = lookSensitivity();
    tYaw -= dx * 0.0042 * sensitivity;
    tPitch = clampCameraPitch(tPitch + dy * 0.0035 * sensitivity * verticalLookDirection(), state);
    yaw = tYaw;
    pitch = tPitch;
  });
  const syncPointerLockHint = () => {
    const shouldShow = (state === 'ground' || state === 'flying') && MODE === 'story' && !UI_BLOCKS_STEERING
      && !matchMedia('(pointer: coarse)').matches && document.pointerLockElement !== el && !edgeLookEnabled;
    mouseLockHintEl.classList.toggle('show', shouldShow);
  };
  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === el;
    if (locked) {
      edgeLookEnabled = false;
      el.dataset.lookControl = 'pointer-lock';
    } else if (pointerWasLocked) {
      edgeLookEnabled = false;
      el.dataset.lookControl = 'free';
    }
    pointerWasLocked = locked;
    pointerSeen = false;
    syncPointerLockHint();
  });
  const recoverInputFocus = () => {
    if (!QA_LOCOMOTION_PROBE) clearPressedKeys();
    // macOS may return focus in two stages (recording UI → browser chrome → page).
    // Refocus now and once more after the browser finishes that handoff.
    focusGameCanvas();
    requestAnimationFrame(focusGameCanvas);
    setTimeout(focusGameCanvas, 120);
    syncPointerLockHint();
  };
  // Recording controls and app switching can blur the browser. Only discard
  // held inputs; flight state, position, velocity and altitude stay untouched.
  window.addEventListener('blur', () => { if (!QA_LOCOMOTION_PROBE) clearPressedKeys(); });
  window.addEventListener('focus', recoverInputFocus);
  window.addEventListener('pageshow', recoverInputFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recoverInputFocus();
  });

  const quintic = t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  const liftOff = (now, allowEarly = false, capturePointer = true) => {
    if (state !== 'ground' || (!allowEarly && now < 1.2)) return;
    if (MODE === 'story' && !(siege && siege.active) && !GAME.flightUnlocked) {
      game?.promptFlightLocked();
      return;
    }
    const useStoryRitual = MODE === 'story' && !(siege && siege.active)
      && GAME.phase === 1 && !firstFlightRitualComplete;
    landingRequested = false;
    el.dataset.landing = 'false';
    hintEl.classList.add('gone');
    if (capturePointer) lockPointer();
    else focusGameCanvas();
    SkyAudio.init();
    SkyAudio.takeoff();
    if (!useStoryRitual) {
      // Once flight has been introduced, takeoff is a responsive hop into the
      // normal flight controller instead of replaying the 3.2 second ceremony.
      firstFlightRitualComplete = true;
      setLocomotionState('flying');
      el.dataset.takeoffMode = 'quick';
      pos.y = Math.max(pos.y, GROUND_Y + 0.16);
      vel.y = Math.max(vel.y, 6.8);
      liftE = 1;
      showFlightHint();
      syncPointerLockHint();
      game?.onAirborne();
      return;
    }
    setLocomotionState('lifting');
    el.dataset.takeoffMode = 'ritual';
    liftStart = now;
    liftOrigin.copy(pos);
    liftYaw = yaw;
  };

  const land = () => {
    if (state !== 'flying') return false;
    landingRequested = true;
    el.dataset.landing = 'true';
    vel.y = Math.min(vel.y, -2.2);
    hintEl.classList.remove('gone');
    hintEl.textContent = tr('descending to land · SPACE cancels', '正在下降著地 · SPACE 取消');
    return true;
  };

  const settleOnGround = () => {
    if (state !== 'flying') return;
    setLocomotionState('ground');
    landingRequested = false;
    el.dataset.landing = 'false';
    pos.y = groundYAt(pos);
    vel.y = 0;
    liftE = 0;
    firstPerson = false;
    tPitch = pitch = clampCameraPitch(pitch, 'ground');
    syncPointerLockHint();
    game?.onGrounded();
  };

  return {
    get state() { return state; },
    get pos() { return pos; },
    get speed() { return vel.length(); },
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get feedbackFov() { return PLAYER_PREFS.cameraShake ? shakeAmt * 2.4 : 0; },
    lockPointer,
    toggleView() { firstPerson = !firstPerson; },
    recenter: requestRecenter,
    addImpulse(ix, iy, iz) { vel.x += ix; vel.y += iy; vel.z += iz; },
    shake(a) {
      if (!PLAYER_PREFS.cameraShake || REDUCED_MOTION) return;
      shakeAmt = Math.min(1, shakeAmt + Math.max(0, Number(a) || 0));
      shakePhase += 0.73;
    },
    resetHome() { pos.set(0, FLY_Y, 0); vel.set(0, 0, 0); },
    resetTo(value) {
      if (!Array.isArray(value) || value.length !== 3) return false;
      pos.set(Number(value[0]) || 0, Math.max(GROUND_Y, Number(value[1]) || GROUND_Y), Number(value[2]) || 0);
      vel.set(0, 0, 0); return true;
    },
    setDimmed(value) { dimmedMovement = Boolean(value); },
    setPositionForQA(x, y, z) {
      if (!QA_STORY_COOP_PROBE && !QA_ENEMY_COMBAT_PROBE && !QA_BUILDING_FIRE_PROBE) return false;
      setLocomotionState('ground');
      landingRequested = false;
      el.dataset.landing = 'false';
      pos.set(Number(x) || 0, Number(y) || GROUND_Y, Number(z) || 0);
      vel.set(0, 0, 0);
      return true;
    },
    setFlyingPositionForQA(x, y, z) {
      if (!QA_STORY_COOP_PROBE && !QA_ENEMY_COMBAT_PROBE && !QA_BUILDING_FIRE_PROBE) return false;
      setLocomotionState('flying');
      landingRequested = false;
      pos.set(Number(x) || 0, Math.max(GROUND_Y, Number(y) || FLY_Y), Number(z) || 0);
      vel.set(0, 0, 0);
      return true;
    },
    setViewForQA(nextYaw, nextPitch) {
      if (!QA_STORY_COOP_PROBE && !QA_ENEMY_COMBAT_PROBE && !QA_BUILDING_FIRE_PROBE) return false;
      cancelRecenter();
      yaw = tYaw = Number(nextYaw) || 0;
      pitch = tPitch = clampCameraPitch(nextPitch, state);
      return true;
    },
    createOcclusionProbeForQA() {
      if (!QA_STORY_COOP_PROBE) return null;
      const material = new THREE.MeshBasicMaterial({ color: 0xff4fd8 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.4, 0.24), material);
      mesh.position.copy(camera.position).lerp(cameraAnchor, 0.5);
      mesh.lookAt(camera.position);
      scene.add(mesh);
      cameraOcclusion.refreshCandidates();
      return {
        mesh,
        material,
        remove() {
          scene.remove(mesh);
          cameraOcclusion.refreshCandidates();
        }
      };
    },
    liftOff,
    land,
    dispose() {
      cameraOcclusion.dispose();
      gamepadInput.reset();
    },
    update(t, dt) {
      gamepadState = gamepadInput.sample();
      el.dataset.gamepad = gamepadState.connected ? 'connected' : 'disconnected';
      if (gamepadState.connected && !UI_BLOCKS_STEERING && (state === 'ground' || state === 'flying')) {
        document.body.dataset.inputDevice = 'gamepad';
        const sensitivity = lookSensitivity();
        tYaw -= gamepadState.lookX * dt * 2.5 * sensitivity;
        tPitch = clampCameraPitch(tPitch + gamepadState.lookY * dt * 2.05 * sensitivity * verticalLookDirection(), state);
        yaw = tYaw;
        pitch = tPitch;
        if (Math.abs(gamepadState.lookX) + Math.abs(gamepadState.lookY) > 0.02) cancelRecenter();
        if (gamepadState.viewPressed) firstPerson = !firstPerson;
        if (gamepadState.recenterPressed) requestRecenter(t);
        if (gamepadState.interactPressed) game?.queueInteract?.();
        if (state === 'ground' && gamepadState.takeoffPressed) liftOff(t, true, false);
        else if (state === 'flying' && gamepadState.landPressed) land();
      }
      if (edgeLookEnabled && document.pointerLockElement !== el && !UI_BLOCKS_STEERING
        && (state === 'ground' || state === 'flying')) {
        const edgeStart = 0.7;
        const edgeX = Math.abs(mouse.x) > edgeStart
          ? Math.sign(mouse.x) * (Math.abs(mouse.x) - edgeStart) / (1 - edgeStart) : 0;
        const edgeY = Math.abs(mouse.y) > 0.82
          ? Math.sign(mouse.y) * (Math.abs(mouse.y) - 0.82) / 0.18 : 0;
        const sensitivity = lookSensitivity();
        if (Math.abs(edgeX) + Math.abs(edgeY) > 0.01) cancelRecenter();
        tYaw -= edgeX * dt * 2.35 * sensitivity;
        tPitch = clampCameraPitch(tPitch + edgeY * dt * 0.85 * sensitivity * verticalLookDirection(), state);
        yaw = tYaw;
        pitch = tPitch;
      }
      if (recenter.active) {
        const progress = clamp((t - recenter.started) / recenter.duration, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        yaw = tYaw = lerp(recenter.fromYaw, recenter.toYaw, eased);
        pitch = tPitch = lerp(recenter.fromPitch, recenter.toPitch, eased);
        if (progress >= 1) cancelRecenter();
      }
      if (state === 'ground') {
        const f = clamp(key('KeyW', 'ArrowUp') - key('KeyS', 'ArrowDown') + TOUCH_INPUT.moveY + gamepadState.moveY, -1, 1);
        const s = clamp(key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft') + TOUCH_INPUT.moveX + gamepadState.moveX, -1, 1);
        if (QA_LOCOMOTION_PROBE) el.dataset.inputState = JSON.stringify({
          forward: f, strafe: s, keyW: !!keys.KeyW,
          touchX: TOUCH_INPUT.moveX, touchY: TOUCH_INPUT.moveY,
          blocked: UI_BLOCKS_STEERING
        });
        fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        rightv.set(Math.cos(yaw), 0, -Math.sin(yaw));
        wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(rightv, s);
        if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(dimmedMovement ? 1.2 : 4.3);
        const response = Math.min(1, dt * 9);
        vel.x = lerp(vel.x, wish.x, response);
        vel.z = lerp(vel.z, wish.z, response);
        vel.y = 0;
        pos.addScaledVector(vel, dt);
        pos.y = groundYAt(pos);
        resolveCollisions(pos, PLAYER_R);
        // Static collision resolves walls and furniture. The authored walking
        // surface then owns vertical placement so stair height persists across
        // frames instead of being reset to the outdoor ground level.
        pos.y = groundYAt(pos);
      } else if (state === 'lifting') {
        const p = Math.min(1, (t - liftStart) / LIFT_SECS);
        const e = liftE = quintic(p);
        pos.y = liftOrigin.y + (FLY_Y - liftOrigin.y) * e;
        pos.z = liftOrigin.z;
        tPitch = 0.08 * (1 - e) + 0.02 * e;
        // organic sway, strongest mid-flight
        const swayEnv = Math.sin(p * Math.PI);
        tYaw = liftYaw + Math.sin(t * 0.65) * 0.05 * swayEnv;
        pos.x = liftOrigin.x + Math.sin(t * 0.5) * 0.22 * swayEnv;
        // atmosphere warms as you rise
        env.spot.intensity = 260 + 240 * e;
        env.rayMats[0].opacity = 0.012 + 0.008 * e;
        env.rayMats[1].opacity = 0.018 + 0.008 * e;
        particles.mat.opacity = 0.5 + 0.3 * e;
        particles.mat.size = 0.16 + 0.05 * e;
        if (p >= 1) {
          firstFlightRitualComplete = true;
          setLocomotionState('flying'); vel.set(0, 0, 0);
          showFlightHint(); syncPointerLockHint();
          if (game) game.onAirborne();
        }
      } else {
        // Assisted flight. The lantern holds a neutral hover; Space rises, while
        // Shift or an explicit landing request produces a deliberate descent.
        const f = clamp(key('KeyW', 'ArrowUp') - key('KeyS', 'ArrowDown') + TOUCH_INPUT.moveY + gamepadState.moveY, -1, 1);
        const s = clamp(key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft') + TOUCH_INPUT.moveX + gamepadState.moveX, -1, 1);
        const rise = clamp(key('Space') + TOUCH_INPUT.rise + gamepadState.rise, 0, 1);
        const descend = clamp(key('ShiftLeft', 'ShiftRight') + TOUCH_INPUT.descend + gamepadState.descend, 0, 1);
        if (rise > 0 && landingRequested) {
          landingRequested = false;
          el.dataset.landing = 'false';
          hintEl.classList.add('gone');
        }
        fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        rightv.set(Math.cos(yaw), 0, -Math.sin(yaw));
        wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(rightv, s);
        if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(FLY_SPEED * (dimmedMovement ? 0.22 : 1));
        const horizontalResponse = Math.min(1, dt * 2.4);
        vel.x = lerp(vel.x, wish.x, horizontalResponse);
        vel.z = lerp(vel.z, wish.z, horizontalResponse);
        const pitchAssist = f * Math.sin(pitch) * 3.2;
        const verticalAcceleration = -FLIGHT_GRAVITY + FLIGHT_BUOYANCY
          + rise * FLIGHT_LIFT - (descend + (landingRequested ? 1 : 0)) * FLIGHT_DESCENT + pitchAssist;
        vel.y += verticalAcceleration * dt;
        vel.y *= Math.exp(-FLIGHT_VERTICAL_DRAG * dt);
        vel.y = clamp(vel.y, -FLIGHT_MAX_FALL, FLIGHT_MAX_RISE);
        const moveStartX = pos.x, moveStartZ = pos.z;
        pos.addScaledVector(vel, dt);
        const intendedX = pos.x, intendedZ = pos.z;
        if (pos.y <= groundYAt(pos) && vel.y <= 0) settleOnGround();
        if (pos.y >= 80) { pos.y = 80; if (vel.y > 0) vel.y = 0; }
        const rr = Math.hypot(pos.x, pos.z);   // soft world boundary
        if (rr > 160) { pos.x *= 160 / rr; pos.z *= 160 / rr; }
        resolveCollisions(pos, PLAYER_R);      // no flying through stone
        const intendedTravel = Math.hypot(intendedX - moveStartX, intendedZ - moveStartZ);
        const actualTravel = Math.hypot(pos.x - moveStartX, pos.z - moveStartZ);
        if (wish.lengthSq() > 0.01 && intendedTravel > 0.01
          && actualTravel < intendedTravel * 0.12 && pos.y > GROUND_Y + 2) {
          // Multiple roof/ornament colliders can otherwise trap a flying player
          // after knockback. Blocked flight input gently clears the roof lip.
          pos.y = Math.min(80, pos.y + 0.42);
          vel.y = Math.max(vel.y, 3.4);
        }
      }
      // damped orientation
      yaw += (tYaw - yaw) * Math.min(1, dt * 3.2);
      pitch += (tPitch - pitch) * Math.min(1, dt * 3.2);

      // drive the traveler; hidden only in first-person flight
      avatar.update(t, dt, state, pos, yaw, vel, liftE);
      if (QA_CHARACTER_ANIMATION_PROBE) {
        el.dataset.characterAnimation = JSON.stringify({
          characterId: avatar.characterId,
          locomotion: state,
          currentAnimation: avatar.modelInfo.currentAnimation,
          currentClip: avatar.modelInfo.currentClip,
          source: avatar.modelInfo.source
        });
      }
      avatar.group.visible = !(firstPerson && state !== 'lifting');

      if (state === 'ground' && !firstPerson) {
        const indoorRoom = currentCameraRoom();
        const indoor = Boolean(indoorRoom);
        const cameraProfile = indoorRoom?.camera;
        el.dataset.cameraProfile = cameraProfile?.profile || 'ground-shoulder';
        el.dataset.roomId = indoorRoom?.id || '';
        const fx = -Math.sin(yaw) * Math.cos(pitch);
        const fz = -Math.cos(yaw) * Math.cos(pitch);
        const distance = cameraProfile?.distance || 5.2;
        const shoulder = cameraProfile?.shoulder || 0.68;
        cameraAnchor.set(pos.x, pos.y + 0.48, pos.z);
        camGoal.set(
          pos.x - fx * distance + Math.cos(yaw) * shoulder,
          pos.y + (cameraProfile?.height || 1.65) + Math.sin(pitch) * (cameraProfile?.pitchLift || 1.4),
          pos.z - fz * distance - Math.sin(yaw) * shoulder
        );
        sweepCameraPosition(cameraAnchor, camGoal, COLLIDER_INDEX || COLLIDERS, { radius: 0.32, out: cameraSafe });
        const k = Math.min(1, dt * 12);
        camera.position.lerp(cameraSafe, k);
        sweepCameraPosition(cameraAnchor, camera.position, COLLIDER_INDEX || COLLIDERS, { radius: 0.32, out: camera.position });
        camera.lookAt(pos.x + fx * 2.2, groundCameraLookTargetY(pos.y, pitch), pos.z + fz * 2.2);
      } else if (state === 'lifting' || (state === 'flying' && !firstPerson)) {
        el.dataset.cameraProfile = state === 'lifting' ? 'takeoff-chase' : 'flight-chase';
        // Keep the takeoff ritual in third person. Previously `lifting` fell
        // through to the first-person branch while the avatar stayed visible,
        // placing the camera inside the character on the first flight.
        // Third-person flight orbits behind the view direction, never inside a wall.
        const fx = -Math.sin(yaw) * Math.cos(pitch);
        const fy = Math.sin(pitch);
        const fz = -Math.cos(yaw) * Math.cos(pitch);
        cameraAnchor.set(pos.x, pos.y + 0.55, pos.z);
        camGoal.set(pos.x - fx * 5.35, pos.y - fy * 5.35 + 1.05, pos.z - fz * 5.35);
        sweepCameraPosition(cameraAnchor, camGoal, COLLIDER_INDEX || COLLIDERS, { radius: 0.34, out: cameraSafe });
        const k = Math.min(1, dt * 16);
        camera.position.lerp(cameraSafe, k);
        sweepCameraPosition(cameraAnchor, camera.position, COLLIDER_INDEX || COLLIDERS, { radius: 0.34, out: camera.position });
        camera.lookAt(pos.x + fx * 2.5, pos.y + 0.5 + fy * 2.5, pos.z + fz * 2.5);
      } else {
        el.dataset.cameraProfile = 'first-person';
        camera.rotation.set(pitch, yaw, 0);
        // idle bob when flying, fading out while you're moving
        const idle = state === 'flying' ? 1 - Math.min(1, vel.length() / 3) : 0;
        const bob = Math.sin(t * (Math.PI * 2 / BOB_PERIOD)) * BOB_AMP * idle;
        camera.position.set(pos.x, pos.y + bob, pos.z);
      }
      if (!PLAYER_PREFS.cameraShake || REDUCED_MOTION) shakeAmt = 0;
      if (shakeAmt > 0.002) {
        shakePhase += dt * (31 + shakeAmt * 13);
        const envelope = shakeAmt * shakeAmt;
        camera.position.x += Math.sin(shakePhase * 1.7) * envelope * 0.22;
        camera.position.y += Math.sin(shakePhase * 2.3 + 1.1) * envelope * 0.16;
        camera.position.z += Math.cos(shakePhase * 1.35) * envelope * 0.2;
        camera.rotation.z += Math.sin(shakePhase * 1.9) * envelope * 0.012;
        shakeAmt *= Math.exp(-dt * 6.2);
      }
      const thirdPersonCamera = state === 'lifting'
        || (!firstPerson && (state === 'ground' || state === 'flying'));
      if (thirdPersonCamera) {
        sweepCameraPosition(cameraAnchor, camera.position, COLLIDER_INDEX || COLLIDERS, {
          radius: state === 'ground' ? 0.32 : 0.34,
          out: camera.position
        });
      }
      cameraOcclusion.update(dt, cameraAnchor, thirdPersonCamera);
      el.dataset.cameraOccluders = String(cameraOcclusion.activeCount);
      if (QA_LOCOMOTION_PROBE) {
        el.dataset.playerPosition = `${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)}`;
        el.dataset.viewAngles = `${yaw.toFixed(3)},${pitch.toFixed(3)}`;
      }
    }
  };
}

/* ================= UIOverlay (hint + inline previews) ================= */
const hintEl = document.getElementById('hint');
const hint2El = document.getElementById('hint2');
const mouseLockHintEl = document.getElementById('mouseLockHint');
let hint2Timer = 0;
function showFlightHint() {
  hint2El.classList.add('show');
  clearTimeout(hint2Timer);
  hint2Timer = setTimeout(() => hint2El.classList.remove('show'), 8000);
}
const previewEl = document.getElementById('preview');
const previewBody = previewEl.querySelector('.body');
let previewItem = null;

function openPreview(item) {
  const { img, text } = item.def.preview;
  const localizedText = typeof text === 'string' ? text : (UI_LANG === 'zh-Hant' ? text.zh : text.en);
  previewBody.innerHTML = (img ? `<img src="${img}" alt="">` : '') + `<span class="line">${localizedText}</span>`;
  previewEl.classList.add('open');
  previewItem = item;
}
function closePreview() {
  previewEl.classList.remove('open');
  previewItem = null;
}
previewEl.querySelector('.close').addEventListener('click', e => { e.stopPropagation(); closePreview(); });
window.addEventListener('sky-language-change', () => { if (previewItem) openPreview(previewItem); });

const projected = new THREE.Vector3();
function positionPreview() {
  if (!previewItem) return;
  projected.copy(previewItem.group.position).project(camera);
  if (projected.z > 1) { closePreview(); return; } // behind camera
  const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;
  const w = previewEl.offsetWidth || 240, h = previewEl.offsetHeight || 90;
  previewEl.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, x + 36)) + 'px';
  previewEl.style.top  = Math.max(12, Math.min(window.innerHeight - h - 12, y - h / 2)) + 'px';
}

/* ================= interaction (raycast hover / click) ================= */
const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let hovered = null;
let downAt = null;

renderer.domElement.addEventListener('pointermove', e => {
  if (document.pointerLockElement === renderer.domElement) pointerNDC.set(0, 0);
  else {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.set(
      ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    );
  }
});
renderer.domElement.addEventListener('pointerdown', e => {
  if (typeof MODE !== 'undefined' && MODE && MODE !== 'story') return;
  if ((ctrl.state === 'ground' || ctrl.state === 'flying')
    && MODE === 'story' && !UI_BLOCKS_STEERING
    && document.pointerLockElement !== renderer.domElement) {
    downAt = null;
    ctrl.lockPointer();
    return; // first click enables unlimited 360° look; the next flying click casts
  }
  downAt = { x: e.clientX, y: e.clientY };
  // Drawn shots: the moonbow, and the Archive Keeper's seal arrow on weapon 1.
  // Pressing on empty air starts the draw; move the cursor while held to aim.
  if (game && !hovered && game.usesDrawnShot()) {
    game.drawStart(clock.elapsedTime);
  }
});
renderer.domElement.addEventListener('pointerup', e => {
  if (typeof MODE !== 'undefined' && MODE && MODE !== 'story') return; // duels are keyboard-driven
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  // a drawn shot looses on release even after moving the cursor to aim
  if (game && game.usesDrawnShot() && game.releaseBow(clock.elapsedTime)) return;
  if (moved > 6) return; // was a drag, not a click
  if (ctrl.state === 'ground') {
    raycaster.setFromCamera(pointerNDC, camera);
    if (raycaster.intersectObject(rune.mesh).length) ctrl.liftOff(clock.elapsedTime);
    else if (game) game.cast(); // training rooms also accept grounded casts
  } else if (ctrl.state === 'flying') {
    if (hovered) {
      openPreview(hovered);
      if (game) game.onRelic(hovered); // reading a memory recovers it
    } else {
      closePreview();
      if (game) game.cast();           // empty air: loose a bolt of morning
    }
  }
});
hintEl.addEventListener('click', () => { if (!MODE || MODE === 'story') ctrl.liftOff(clock.elapsedTime); });

function updateHover() {
  if (ctrl.state !== 'flying') { hovered = null; return; }
  raycaster.setFromCamera(pointerNDC, camera);
  hovered = null;
  for (const it of floats.items) {
    if (raycaster.intersectObject(it.obj, true).length) { hovered = it; break; }
  }
  renderer.domElement.style.cursor = hovered ? 'pointer' : 'default';
}

/* ================= post-processing ================= */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.35, 0.4, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* Settings owns persistence and DOM bindings; the game supplies runtime dependencies. */
const settings = createSettingsController({
  renderer, composer, bloom, audio: SkyAudio, multiplayer: skyMultiplayer,
  playerPrefs: PLAYER_PREFS, playerCharacterIds: PLAYER_CHARACTER_IDS,
  storageKey: SKY_SETTINGS_KEY,
  applyDocumentLanguage,
  setLanguage: language => { UI_LANG = language; },
  setSteeringBlocked: blocked => { UI_BLOCKS_STEERING = blocked; }
});
const worldStatusEl = document.getElementById('worldStatus');
const worldStatusCopy = worldStatusEl.querySelector('.world-status-copy');
function refreshWorldStatus() {
  const clock = livingWorld.world;
  worldStatusEl.classList.toggle('connected', livingWorld.connected);
  worldStatusEl.classList.toggle('offline', !livingWorld.connected);
  worldStatusEl.classList.toggle('alert', livingWorld.connected && clock?.alert >= 35);
  if (!livingWorld.connected || !clock) {
    worldStatusCopy.textContent = tr('LOCAL WORLD', '本機世界');
    return;
  }
  const time = `${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`;
  const alert = clock.alert >= 35 ? tr(` · ALERT ${Math.round(clock.alert)}`, ` · 警戒 ${Math.round(clock.alert)}`) : '';
  const lanterns = skyMultiplayer.connected && skyMultiplayer.peers.size > 0
    ? tr(` · ${skyMultiplayer.peers.size + 1} LANTERNS`, ` · ${skyMultiplayer.peers.size + 1} 盞提燈`)
    : '';
  worldStatusCopy.textContent = tr(`LIVE WORLD · DAY ${clock.day} · ${time}`, `永續世界 · 第 ${clock.day} 日 · ${time}`) + alert + lanterns;
}
livingWorld.addEventListener('sync', refreshWorldStatus);
livingWorld.addEventListener('offline', refreshWorldStatus);
window.addEventListener('sky-mp-roster', refreshWorldStatus);
window.addEventListener('sky-language-change', refreshWorldStatus);
livingWorld.connect();

/* ================= MobileControls ================= */
function MobileControls(ctrl, game) {
  const root = document.getElementById('touchControls');
  const move = document.getElementById('touchMove');
  const base = move?.querySelector('.touch-stick-base');
  const thumb = move?.querySelector('.touch-stick-thumb');
  const look = document.getElementById('touchLookPad');
  const cast = document.getElementById('touchCast');
  const touchDevice = matchMedia('(hover: none) and (pointer: coarse)').matches
    || navigator.maxTouchPoints > 0 || MOBILE_TEST;
  if (!root || !move || !base || !thumb || !look || !cast) return { setActive() {}, update() {} };
  const holdButtons = [...root.querySelectorAll('[data-touch-hold]')];
  const weaponButtons = [...root.querySelectorAll('[data-touch-weapon]')];

  let enabled = false;
  let movePointer = null;
  let lookPointer = null;
  let lookX = 0, lookY = 0;
  let castPointer = null;

  const stop = e => { e.preventDefault(); e.stopPropagation(); };
  const resetMove = () => {
    movePointer = null;
    TOUCH_INPUT.moveX = 0;
    TOUCH_INPUT.moveY = 0;
    thumb.style.transform = 'translate(0px, 0px)';
  };
  const steer = e => {
    const r = base.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const radius = r.width * 0.36;
    const length = Math.hypot(dx, dy);
    if (length > radius) { dx *= radius / length; dy *= radius / length; }
    TOUCH_INPUT.moveX = dx / radius;
    TOUCH_INPUT.moveY = -dy / radius;
    thumb.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  };
  move.addEventListener('pointerdown', e => {
    if (!enabled || movePointer !== null) return;
    stop(e); movePointer = e.pointerId; move.setPointerCapture(e.pointerId); steer(e);
  });
  move.addEventListener('pointermove', e => { if (e.pointerId === movePointer) { stop(e); steer(e); } });
  const moveEnd = e => {
    if (e.pointerId !== movePointer) return;
    stop(e);
    if (QA_LOCOMOTION_PROBE) {
      const releasedPointer = e.pointerId;
      setTimeout(() => { if (movePointer === releasedPointer) resetMove(); }, 420);
    } else resetMove();
  };
  move.addEventListener('pointerup', moveEnd);
  move.addEventListener('pointercancel', moveEnd);

  look.addEventListener('pointerdown', e => {
    if (!enabled || lookPointer !== null) return;
    stop(e); lookPointer = e.pointerId; lookX = e.clientX; lookY = e.clientY; look.setPointerCapture(e.pointerId);
  });
  look.addEventListener('pointermove', e => {
    if (e.pointerId !== lookPointer) return;
    stop(e);
    const dx = e.clientX - lookX, dy = e.clientY - lookY;
    lookX = e.clientX; lookY = e.clientY;
    window.dispatchEvent(new CustomEvent('sky-touch-look', { detail: { dx, dy } }));
  });
  const lookEnd = e => { if (e.pointerId === lookPointer) { stop(e); lookPointer = null; } };
  look.addEventListener('pointerup', lookEnd);
  look.addEventListener('pointercancel', lookEnd);

  for (const button of holdButtons) {
    const prop = button.dataset.touchHold;
    const set = (value, e) => {
      stop(e); TOUCH_INPUT[prop] = value; button.classList.toggle('pressed', !!value);
      if (value) button.setPointerCapture(e.pointerId);
    };
    button.addEventListener('pointerdown', e => set(1, e));
    button.addEventListener('pointerup', e => set(0, e));
    button.addEventListener('pointercancel', e => set(0, e));
  }
  for (const button of weaponButtons) {
    button.addEventListener('pointerdown', e => {
      stop(e); game.setWeapon(Number(button.dataset.touchWeapon));
    });
  }
  document.getElementById('touchView')?.addEventListener('pointerdown', e => { stop(e); ctrl.toggleView(); });
  document.getElementById('touchRecenter')?.addEventListener('pointerdown', e => { stop(e); ctrl.recenter(); });
  document.getElementById('touchSignature')?.addEventListener('pointerdown', e => { stop(e); game.activateSignature(); });
  document.getElementById('touchInteract')?.addEventListener('pointerdown', e => {
    stop(e); document.body.dataset.inputDevice = 'touch';
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }));
  });
  cast.addEventListener('pointerdown', e => {
    if (!enabled) return;
    stop(e); castPointer = e.pointerId; cast.setPointerCapture(e.pointerId); cast.classList.add('pressed');
    if (ctrl.state === 'ground' && !combatTrainingRoomAt(ctrl.pos)) ctrl.liftOff(clock.elapsedTime);
    else if (ctrl.state === 'ground' && GAME.weapon === 3) game.drawStart(clock.elapsedTime);
    else if (ctrl.state === 'ground') game.cast();
    else if (ctrl.state === 'flying' && GAME.weapon === 3) game.drawStart(clock.elapsedTime);
    else if (ctrl.state === 'flying') game.cast();
  });
  const castEnd = e => {
    if (e.pointerId !== castPointer) return;
    stop(e); castPointer = null; cast.classList.remove('pressed');
    if ((ctrl.state === 'flying' || combatTrainingRoomAt(ctrl.pos)) && GAME.weapon === 3) game.releaseBow(clock.elapsedTime);
  };
  cast.addEventListener('pointerup', castEnd);
  cast.addEventListener('pointercancel', castEnd);

  window.addEventListener('blur', () => {
    if (QA_LOCOMOTION_PROBE) return;
    resetMove(); lookPointer = null; castPointer = null;
    TOUCH_INPUT.rise = 0; TOUCH_INPUT.descend = 0;
  });
  return {
    setActive(active) {
      enabled = touchDevice && active;
      root.classList.toggle('on', enabled);
      root.setAttribute('aria-hidden', enabled ? 'false' : 'true');
      if (!enabled) { resetMove(); TOUCH_INPUT.rise = 0; TOUCH_INPUT.descend = 0; }
    },
    update() {
      if (!enabled) return;
      for (const button of weaponButtons) {
        button.classList.toggle('active', Number(button.dataset.touchWeapon) === GAME.weapon);
      }
      const lift = ctrl.state !== 'flying';
      cast.textContent = lift ? tr('FLY', '起飛') : (GAME.weapon === 3 ? tr('DRAW', '拉弓') : tr('CAST', '施法'));
    }
  };
}

/* ================= boot ================= */
const architecture = createArchitectureSystem({
  renderer, scene, HALL, EXPLORABLES, roomRegistry, COLLIDERS, SPELL_TARGETS,
  ENV_THREAT_SOURCES, ENV_RESTORE_PULSES, LIT_MATS,
  AMBER, COOL, FLY_Y, GAME, settings, CloakedFigure,
  tr, storyCard, lerp, clamp,
  getRoomThreat: id => siege?.active ? siege.roomThreat(id) : null,
  canInteractRoom: room => !siege?.active || siege.canUseRoom(room),
  reportRoomProgress: (room, item, complete) => {
    const storySent = item === 'service'
      ? false
      : skyMultiplayer.storyAct('room-progress', { room, item });
    const siegeSent = siege?.active ? siege.reportInteriorProgress(room, item, complete) : false;
    return storySent || siegeSent;
  },
  REDUCED_MOTION
});
const env = architecture.buildScene();
const architectureSceneBaseline = new Set(scene.children);
architecture.Buildings();
const hall = architecture.GreatHall();
const explorableBuildings = architecture.ExplorableBuildings();
if (QA_LOCOMOTION_PROBE) renderer.domElement.dataset.archiveEvidence = JSON.stringify(explorableBuildings.archiveState());
if (QA_LOCOMOTION_PROBE) renderer.domElement.dataset.alchemyState = JSON.stringify(explorableBuildings.alchemyState());
if (QA_LOCOMOTION_PROBE) renderer.domElement.dataset.infirmaryState = JSON.stringify(explorableBuildings.infirmaryState());
if (QA_LOCOMOTION_PROBE) renderer.domElement.dataset.practiceState = JSON.stringify(explorableBuildings.practiceState());
if (QA_LOCOMOTION_PROBE) renderer.domElement.dataset.owlPostState = JSON.stringify(explorableBuildings.owlPostState());
architecture.registerArchitectureDetails(scene.children.filter(node => !architectureSceneBaseline.has(node)));
const villagerFigure = createVillagerFigureFactory({ ResidentCharacter });
const outdoorResidents = createResidentSystem({
  scene, HALL, roomRegistry, SPELL_TARGETS, HUNT_R,
  characterProfile, ResidentCharacter: villagerFigure, livingWorld,
  storyCard, tr, resolveCollisions: (position, radius) => resolveCollisions(position, radius), lerp,
  getWeapon: () => GAME.weapon,
  isRuntimePerformance: () => Boolean(settings.prefs.runtimePerformance),
  getMode: () => MODE,
  isSiegeActive: () => Boolean(siege?.active),
  getGamePhase: () => GAME.phase,
  qaCanvas: QA_LOCOMOTION_PROBE ? renderer.domElement : null
});
const npcInteraction = createNpcInteraction({
  residentSystem: outdoorResidents, livingWorld, tr,
  getLanguage: () => UI_LANG,
  storyCard,
  isBlocked: () => UI_BLOCKS_STEERING,
  isPrimaryInteractionReady: () => Boolean(
    interactionPromptEl?.classList.contains('on')
    && !interactionPromptEl.classList.contains('blocked')
  ),
  isPerformanceMode: () => Boolean(settings.prefs.runtimePerformance)
});
const rune = RuneMarker();
const particles = Particles(settings.prefs.quality === 'high' ? 900 : settings.prefs.quality === 'balanced' ? 650 : 400);
const floats = createAmbientMemories({
  scene, camera, flyY: FLY_Y, amber: AMBER,
  getHovered: () => hovered,
  getSignatureActive: () => GAME.roleState.signatureActive,
  qaLocomotionProbe: QA_LOCOMOTION_PROBE,
  canvas: renderer.domElement
});
const storyOpening = createStoryOpening({ scene, colliders: COLLIDERS, reducedMotion: REDUCED_MOTION });
const blackGarden = createBlackGarden({ scene, reducedMotion: REDUCED_MOTION });
COLLIDER_INDEX = createColliderSpatialIndex(COLLIDERS);
const coopPings = createCoopPings({ scene, tr, storyCard });
const avatar = PlayerAvatar();
let characterSelectionActive = false;
storyCoopUI = createCoopStoryUI({
  multiplayer: skyMultiplayer,
  tr,
  isStoryActive: () => MODE === 'story' && !UI_BLOCKS_STEERING,
  onEnterStory: () => {
    UI_BLOCKS_STEERING = false;
    enterMode('story');
  },
  onBack: () => {
    UI_BLOCKS_STEERING = false;
    document.getElementById('menu')?.classList.remove('gone');
  },
  onOfflineVote: choice => game?.submitStoryVote(choice),
  onOfflineGardenVote: choice => game?.submitGardenVote(choice),
  onModalChange: open => {
    UI_BLOCKS_STEERING = open;
    if (open && document.pointerLockElement) document.exitPointerLock?.();
  }
});
const characterSelection = createCharacterSelection({
  initialId: settings.prefs.characterId,
  initialColor: settings.prefs.cloakColor,
  createFallback: (entry, color) => ResidentCharacter(characterProfile(entry.profileId), {
    player: true, cloakOverride: color
  }),
  onConfirm: ({ id, color }) => {
    settings.setCharacter(id, color);
    characterSelection.close();
    characterSelectionActive = false;
    UI_BLOCKS_STEERING = true;
    storyCoopUI.openLobby();
  },
  onCancel: () => {
    characterSelection.close();
    characterSelectionActive = false;
    UI_BLOCKS_STEERING = false;
    menuEl.classList.remove('gone');
  }
});
const duelRuntime = createDuelSystem({
  scene, camera, renderer, GAME, tr, clamp, lerp, PLAYER_PREFS, PLAYER_R,
  HUNT_R, HUNT_Y0, HUNT_Y1, ROMAN, COLLIDERS, COLLIDER_INDEX, SkyAudio, storyCard,
  CloakedFigure, quality: settings.prefs.quality, reducedMotion: REDUCED_MOTION
});
const resolveCollisions = duelRuntime.resolveCollisions;
const ctrl = CameraController(avatar);
game = GameFlow(ctrl, avatar, env, storyOpening, blackGarden);
siege = SiegeLoop(ctrl, game);
const touchUI = MobileControls(ctrl, game);

// mode select: story keeps the normal flow; duel modes hand the frame to DuelSystem
let MODE = null, duel = null;
const menuEl = document.getElementById('menu');
const skyveilCover = document.getElementById('skyveilCover');
const skyveilCoverVideo = document.getElementById('skyveilCoverVideo');
const skyveilEnter = document.getElementById('skyveilEnter');
const coverBackgroundState = new Map();
function setCoverBackgroundBlocked(blocked) {
  for (const element of document.body.children) {
    if (element === skyveilCover || element.tagName === 'SCRIPT') continue;
    if (blocked) {
      coverBackgroundState.set(element, {
        inert: element.inert,
        ariaHidden: element.getAttribute('aria-hidden')
      });
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
      continue;
    }
    const previous = coverBackgroundState.get(element);
    if (!previous) continue;
    element.inert = previous.inert;
    if (previous.ariaHidden == null) element.removeAttribute('aria-hidden');
    else element.setAttribute('aria-hidden', previous.ariaHidden);
  }
  if (!blocked) coverBackgroundState.clear();
}
function revealModeMenu() {
  if (!skyveilCover || skyveilCover.classList.contains('leaving')) return;
  skyveilCover.classList.add('leaving');
  skyveilEnter.disabled = true;
  menuEl.classList.remove('menu-awaiting-cover');
  window.setTimeout(() => {
    skyveilCover.setAttribute('aria-hidden', 'true');
    skyveilCover.inert = true;
    skyveilCoverVideo?.pause();
    setCoverBackgroundBlocked(false);
    menuEl.inert = false;
    menuEl.removeAttribute('aria-hidden');
    document.body.classList.remove('skyveil-cover-active');
    document.body.dataset.coverState = 'menu';
    menuEl.querySelector('.mopt')?.focus();
  }, REDUCED_MOTION ? 0 : 760);
}
if (skyveilCover && skyveilEnter) {
  document.body.dataset.coverState = 'cinematic';
  setCoverBackgroundBlocked(true);
  const showVideo = () => skyveilCover.classList.add('video-ready');
  if (skyveilCoverVideo) {
    if (skyveilCoverVideo.readyState >= 2) showVideo();
    else skyveilCoverVideo.addEventListener('loadeddata', showVideo, { once: true });
    skyveilCoverVideo.addEventListener('error', () => skyveilCover.classList.remove('video-ready'));
    if (REDUCED_MOTION || window.matchMedia('(max-width: 720px)').matches) {
      skyveilCoverVideo.pause();
      skyveilCoverVideo.removeAttribute('autoplay');
    } else {
      skyveilCoverVideo.play().catch(() => {
        // The poster remains a complete cover if a browser blocks autoplay.
      });
    }
  }
  skyveilEnter.addEventListener('click', revealModeMenu);
  window.requestAnimationFrame(() => skyveilEnter.focus({ preventScroll: true }));
}
function startAudio() {
  try {
    SkyAudio.init();
    SkyAudio.uiClick();
  } catch (error) {
    console.warn('Sky Room audio could not start; continuing silently.', error);
  }
}
function enterMode(m) {
  if (MODE) return;
  const siegeMode = m === 'siege';
  MODE = siegeMode ? 'story' : m;   // siege reuses story-mode flight + combat input
  skyMultiplayer.setPeerPresentationEnabled(MODE === 'story');
  storyOpening.setEnabled(m === 'story');
  menuEl.classList.add('gone');
  touchUI.setActive(MODE === 'story');
  startAudio();
  if (MODE !== 'story') {
    hintEl.classList.add('gone');
    avatar.group.visible = false;
    duel = duelRuntime.DuelSystem(m);
  } else if (siegeMode) {
    GAME.flightUnlocked = true;
    hintEl.classList.remove('gone');
    hintEl.textContent = tr('W A S D walk · F or SPACE take flight', 'W A S D 步行 · F 或 SPACE 起飛');
    siege.start();
  } else {
    game.startStory();
  }
}
function chooseMode(m) {
  if (MODE || characterSelectionActive) return;
  if (m === 'story') {
    menuEl.classList.add('gone');
    startAudio();
    characterSelectionActive = true;
    UI_BLOCKS_STEERING = true;
    characterSelection.open(settings.prefs.characterId, settings.prefs.cloakColor);
    return;
  }
  enterMode(m);
}
for (const option of menuEl.querySelectorAll('.mopt')) {
  option.addEventListener('click', () => chooseMode(option.dataset.mode));
}
// 1/2/3 pick a weapon (story mode only)
window.addEventListener('keydown', e => {
  if (MODE && MODE !== 'story') return;
  if (e.code === 'KeyF' && !e.repeat && MODE === 'story' && !UI_BLOCKS_STEERING) {
    if (ctrl.state === 'ground') ctrl.liftOff(clock.elapsedTime);
    else if (ctrl.state === 'flying') ctrl.land();
    return;
  }
  const w = { Digit1: 1, Digit2: 2, Digit3: 3 }[e.code];
  if (w && game) game.setWeapon(w);
});
// multiplayer presence: other lantern bearers appear in the same night city.
// Duel modes stay local — getState returns null there so nothing is broadcast.
skyMultiplayer.init({
  scene,
  getState: () => {
    // Do not publish a world avatar from the menu, character picker, Story
    // lobby, or local Duel/Versus. This prevents stale LAN ghosts from leaking
    // into another player's active campus.
    if (MODE !== 'story') return null;
    return {
      p: [ctrl.pos.x, ctrl.pos.y, ctrl.pos.z],
      r: [ctrl.yaw, ctrl.pitch],
      c: skyMultiplayer.isCasting ? 1 : 0,
      w: GAME.weapon || 1,
      f: ctrl.state === 'flying' ? 1 : 0,
      rs: {
        a: GAME.roleState.signatureActive ? 1 : 0,
        q: GAME.roleState.signatureCharge
      }
    };
  },
  onLocalHit: message => game.networkHit(message),
  onLocalDown: message => game.networkDown(message),
  onLocalRespawn: () => game.networkRespawn()
});

// QA-only orchestration is split from the production runtime and loaded on demand.
if (QA_STORY_COOP_PROBE || QA_ENEMY_COMBAT_PROBE || QA_BUILDING_FIRE_PROBE) {
  import('./sky-room/qa-controls.js?v=hall-entry-fix-1')
    .then(({ installSkyRoomQaControls }) => installSkyRoomQaControls({
      renderer, camera, ctrl, game, siege, GAME, skyMultiplayer, getMode: () => MODE,
      tr, storyCard, HALL, GROUND_Y, EXPLORABLES, STORY_START, avatar, settings
    }))
    .catch(error => console.error('[Sky QA] controls failed to load', error));
}
camera.position.set(STORY_START.x + 4.2, 3.25, STORY_START.z + 4.2);
window.__sky = { scene, camera, renderer, composer, ctrl, avatar, game, siege, GAME, skyMultiplayer, COLLIDERS, resolveCollisions,
  SPELL_TARGETS, ENV_THREAT_SOURCES, ENV_RESTORE_PULSES, explorableBuildings, outdoorResidents, storyOpening, floats,
  roomRegistry, blackGarden, characterSelection, chooseMode, getDuel: () => duel, SkyAudio }; // console debugging handle
if (URL_QUERY.has('promo-video')) {
  import('./sky-room/promo-recorder.js?v=linkedin-promo-1')
    .then(({ installPromoRecorder }) => installPromoRecorder({
      renderer, ctrl, game, GAME, HALL, GROUND_Y, getMode: () => MODE, settings
    }))
    .catch(error => console.error('[Sky Promo] recorder failed to load', error));
}
if (URL_QUERY.has('camera-showcase')) {
  setTimeout(() => {
    ctrl.shake(0.72);
    console.info('[Sky QA] camera feedback', JSON.stringify({ enabled: PLAYER_PREFS.cameraShake, reducedMotion: REDUCED_MOTION }));
  }, 900);
}
if (URL_QUERY.has('dawn-showcase')) {
  GAME.phase = 4;
  env.finale(1);
  console.info('[Sky QA] dawn palette', JSON.stringify({ background: `#${scene.background.getHexString()}`, fog: `#${scene.fog.color.getHexString()}` }));
}

const clock = new THREE.Clock();
const perfProbeEnabled = URL_QUERY.has('perf-probe');
const performanceGovernor = createPerformanceGovernor({
  renderer, composer, settings, architecture, collisionIndex: COLLIDER_INDEX, canvas: renderer.domElement,
  getEffects: () => game?.state?.effects || null,
  probeEnabled: perfProbeEnabled
});
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.info.autoReset = false;
let shadowElapsed = 0;
let overlayElapsed = 0;
let lastCrosshairTransform = '';
renderer.setAnimationLoop(() => {
  renderer.info.reset();
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;
  shadowElapsed += dt;
  const shadowInterval = settings.prefs.runtimePerformance ? 0.25 : 0.12;
  if (shadowElapsed >= shadowInterval) {
    renderer.shadowMap.needsUpdate = true;
    shadowElapsed = 0;
  }
  rune.update(t);
  const activePlayerPos = duel ? duel.P1.pos : ctrl.pos;
  storyOpening.update(t, dt, activePlayerPos);
  env.updateSky(t, dt, activePlayerPos);
  architecture.updateDetail(dt, activePlayerPos);
  hall.update(t, dt, activePlayerPos);
  explorableBuildings.update(t, dt, activePlayerPos);
  outdoorResidents.update(t, dt, activePlayerPos, !duel);
  npcInteraction.update(dt, activePlayerPos,
    !duel && (ctrl.state === 'ground' || ctrl.state === 'flying'));
  particles.update(t, dt);
  floats.update(t, dt);
  skyMultiplayer.update(t, dt);
  coopPings.update(t, dt);
  if (QA_PVP_PROJECTILE_PROBE) {
    renderer.domElement.dataset.multiplayerProjectiles = JSON.stringify({
      connected: skyMultiplayer.connected,
      peers: skyMultiplayer.peers.size,
      visiblePeers: [...skyMultiplayer.peers.values()].filter(peer => peer.group.visible).length,
      publishingWorldState: MODE === 'story',
      ...skyMultiplayer.projectileStats
    });
  }
  touchUI.update();
  if (duel) {
    // Settings is a safe local pause. In particular, the Duel AI must not keep
    // attacking while the player is reading or changing accessibility options.
    if (!UI_BLOCKS_STEERING) duel.update(t, dt);
    SkyAudio.update(dt, duel.P1.pos.y, duel.P1.vel.length(), true, duel.P1.pos);
    duel.render(); // first-person, split-screen when versus
  } else {
    ctrl.update(t, dt);
    if (game && !UI_BLOCKS_STEERING) game.update(t, dt);
    // Connected Siege authority may continue remotely; the newest snapshot is
    // applied on resume. Offline Siege pauses completely with the settings UI.
    if (siege && !UI_BLOCKS_STEERING) siege.update(t, dt);
    SkyAudio.update(dt, ctrl.pos.y, ctrl.speed, ctrl.state !== 'ground', ctrl.pos);
    // drawn moonbow narrows the view — the sniper's breath
    const bowP = game ? game.drawPower(t) : 0;
    const targetFov = 57 - 16 * bowP + ctrl.feedbackFov;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }
    const crosshairTransform = bowP > 0 ? `scale(${(1 + bowP * 1.6).toFixed(3)})` : '';
    if (crosshairTransform !== lastCrosshairTransform) {
      lastCrosshairTransform = crosshairTransform;
      crosshairEl.style.transform = crosshairTransform;
    }
    overlayElapsed += dt;
    if (overlayElapsed >= 1 / 30) {
      overlayElapsed = 0;
      updateHover();
      positionPreview();
    }
    if (bloom.enabled) composer.render();
    else renderer.render(scene, camera);
  }
  performanceGovernor.update(rawDt);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('beforeunload', () => {
  ctrl.dispose?.();
  livingWorld.destroy();
  skyMultiplayer.destroy();
  performanceGovernor.dispose();
  renderer.setAnimationLoop(null);
  renderer.dispose();
});
