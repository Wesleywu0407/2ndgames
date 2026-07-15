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
import { SkyAudio } from './sky-audio.js?v=phase5-spatial-2';
import { livingWorld } from './sky-living-world.js';
import { skyMultiplayer } from './sky-multiplayer.js?v=story-black-garden-3';
import { loadCharacterProfiles, characterProfile, colorNumber } from './sky-characters.js';
import { createArchitectureSystem } from './sky-room/architecture.js?v=phase5-lod-1';
import { createDuelSystem } from './sky-room/duel.js?v=phase5-shared-feedback-2';
import { createCharacterSelection } from './sky-room/characters/selection.js';
import { playableCharacter } from './sky-room/characters/manifest.js';
import { loadPlayableCharacter, disposeCharacterFigure } from './sky-room/characters/loader.js';
import { CharacterAnimationController } from './sky-room/characters/animation-controller.js';
import { createStoryOpening, STORY_START } from './sky-room/story-opening.js?v=story-coop-1';
import { createCombatEffects } from './sky-room/combat-effects.js?v=phase5-motion-1';
import { createCoopStoryUI } from './sky-room/coop-story-ui.js?v=story-black-garden-3';
import { createCoopPings } from './sky-room/coop-pings.js?v=story-chapter1-1';
import { createBlackGarden } from './sky-room/black-garden.js?v=story-black-garden-1';
import {
  radialTexture, moonTexture, cloudTexture
} from './sky-room/textures.js';

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
const PLAYER_PREFS = { lookSensitivity: 1, cameraShake: true };
const TOUCH_INPUT = { moveX: 0, moveY: 0, rise: 0, descend: 0 };
const QA_STORY_COOP_PROBE = new URLSearchParams(window.location.search).has('story-coop-qa');
let UI_BLOCKS_STEERING = false;
const SKY_SETTINGS_KEY = 'sky-room-settings-v1';
const PLAYER_CHARACTER_IDS = Object.freeze([
  'resident-01', 'resident-05', 'resident-10', 'resident-06', 'resident-13',
  'resident-18', 'resident-03', 'mercury-xbot'
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

// the grand keep that hosts the great hall — Buildings() and GreatHall() share it
const HALL = { x: 0, z: -80, w: 34, d: 18, h: 24, ry: 0 };
const EXPLORABLES = [
  { id: 'archive', x: -35, z: -25, ry: 0.95, title: 'MOON ARCHIVE' },
  { id: 'alchemy', x: 35, z: -27, ry: -0.91, title: "ALCHEMIST'S WORKSHOP" },
  { id: 'infirmary', x: -52, z: -8, ry: 1.42, title: 'MOON INFIRMARY' },
  { id: 'practice', x: 52, z: -10, ry: -1.38, title: 'PRACTICE HALL' },
  { id: 'owlpost', x: 0, z: 45, ry: Math.PI, title: 'OWL POST' }
];

// solid-world colliders, filled while the city is built.
// { kind:'cyl', x, z, r, y0, y1 } or { kind:'box', x, z, hw, hd, y0, y1, cos, sin }
const COLLIDERS = [];
const SPELL_TARGETS = [];
const ENV_THREAT_SOURCES = []; // active Unlight corruption sampled by landscape and lamps
const ENV_RESTORE_PULSES = []; // cleansing waves relight foliage, petals, and nearby paths

const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
const QA_LOCOMOTION_PROBE = new URLSearchParams(window.location.search).has('locomotion-probe');
const QA_PVP_PROJECTILE_PROBE = new URLSearchParams(window.location.search).has('pvp-projectile-probe');

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
      // 30 Hz is visually continuous for slow dust and halves the CPU/upload work.
      accumulatedDt += dt;
      if (accumulatedDt < 1 / 30) return;
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

/* ================= procedural relic textures ================= */
function photoTexture() {
  const c = document.createElement('canvas');
  c.width = 220; c.height = 272;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 0, 272);
  bg.addColorStop(0, '#cdb28b'); bg.addColorStop(1, '#7d6544');
  g.fillStyle = bg; g.fillRect(0, 0, 220, 272);
  // pale moon
  g.fillStyle = 'rgba(240,230,205,0.85)';
  g.beginPath(); g.arc(158, 62, 22, 0, Math.PI * 2); g.fill();
  // distant hills
  g.fillStyle = '#5d4a30';
  g.beginPath(); g.moveTo(0, 190);
  g.quadraticCurveTo(60, 150, 120, 186); g.quadraticCurveTo(175, 214, 220, 178);
  g.lineTo(220, 272); g.lineTo(0, 272); g.fill();
  // lone tower silhouette
  g.fillStyle = '#3f3220';
  g.fillRect(52, 108, 22, 92);
  g.beginPath(); g.moveTo(48, 110); g.lineTo(63, 84); g.lineTo(78, 110); g.fill();
  // grain + vignette
  for (let i = 0; i < 700; i++) {
    g.fillStyle = `rgba(60,45,25,${Math.random() * 0.12})`;
    g.fillRect(Math.random() * 220, Math.random() * 272, 1.4, 1.4);
  }
  const v = g.createRadialGradient(110, 136, 60, 110, 136, 190);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(30,20,8,0.55)');
  g.fillStyle = v; g.fillRect(0, 0, 220, 272);
  return c;
}

function letterTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 176;
  const g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, 256, 176);
  bg.addColorStop(0, '#e9dfc6'); bg.addColorStop(1, '#cfc2a2');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 176);
  // fold creases
  g.strokeStyle = 'rgba(110,95,65,0.4)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 60); g.lineTo(256, 56); g.stroke();
  g.beginPath(); g.moveTo(0, 118); g.lineTo(256, 122); g.stroke();
  // handwriting squiggles
  g.strokeStyle = 'rgba(75,60,40,0.75)'; g.lineWidth = 1.4;
  for (let row = 0; row < 8; row++) {
    const y = 24 + row * 18;
    g.beginPath(); g.moveTo(22, y);
    for (let x = 22; x < 210 + Math.random() * 24; x += 7) {
      g.quadraticCurveTo(x + 3, y + (Math.random() - 0.5) * 7, x + 7, y + (Math.random() - 0.5) * 3);
    }
    g.stroke();
  }
  return c;
}

function dialTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  bg.addColorStop(0, '#f2e8d2'); bg.addColorStop(1, '#cbb890');
  g.fillStyle = bg;
  g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#5a4526';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.lineWidth = i % 3 === 0 ? 6 : 3;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96);
    g.lineTo(128 + Math.cos(a) * 114, 128 + Math.sin(a) * 114);
    g.stroke();
  }
  // hands stopped at 11:47
  g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(128, 128);
  g.lineTo(128 + Math.cos(-1.83) * 58, 128 + Math.sin(-1.83) * 58); g.stroke();
  g.lineWidth = 5;
  g.beginPath(); g.moveTo(128, 128);
  g.lineTo(128 + Math.cos(1.15) * 88, 128 + Math.sin(1.15) * 88); g.stroke();
  g.fillStyle = '#5a4526';
  g.beginPath(); g.arc(128, 128, 8, 0, Math.PI * 2); g.fill();
  return c;
}

/* ================= FloatingObjects ================= */
const photoCanvas = photoTexture();

const FLOAT_OBJECTS = [
  {
    name: 'photograph', radius: 4.2, height: FLY_Y - 0.5, period: 18, phase: 0.4,
    preview: { img: photoCanvas.toDataURL('image/jpeg', 0.8), text: { en: 'Someone loved this view, once.', zh: '曾經，有人深愛著這片風景。' } },
    build() {
      const grp = new THREE.Group();
      const tex = new THREE.CanvasTexture(photoCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      // emissive frame plane behind the photo
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(1.06, 1.28),
        new THREE.MeshBasicMaterial({ color: AMBER, side: THREE.DoubleSide,
          transparent: true, opacity: 0.35 })
      );
      frame.position.z = -0.012;
      const photo = new THREE.Mesh(
        new THREE.PlaneGeometry(0.94, 1.16),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
      );
      grp.add(frame, photo);
      return grp;
    }
  },
  {
    name: 'letter', radius: 5.8, height: FLY_Y + 0.7, period: 27, phase: 2.5,
    preview: { text: { en: '"We were never meant to stay down there." — the only line still legible.', zh: '「我們從來就不該留在下面。」——唯一仍可辨識的句子。' } },
    build() {
      const grp = new THREE.Group();
      const tex = new THREE.CanvasTexture(letterTexture());
      tex.colorSpace = THREE.SRGBColorSpace;
      // gently folded sheet
      const geo = new THREE.PlaneGeometry(1.15, 0.8, 12, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        p.setZ(i, Math.abs(p.getX(i)) * -0.22 + Math.sin(p.getX(i) * 5.5) * 0.02);
      }
      geo.computeVertexNormals();
      const paper = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map: tex, side: THREE.DoubleSide, roughness: 0.85, metalness: 0,
        emissive: 0xe8d8b0, emissiveIntensity: 0.07, emissiveMap: tex
      }));
      grp.add(paper);
      return grp;
    }
  },
  {
    name: 'watch', radius: 7.3, height: FLY_Y + 1.6, period: 34, phase: 4.6,
    preview: { text: { en: 'A brass pocket watch, stopped at the hour the room first rose.', zh: '一枚黃銅懷錶，停在房間首次升空的時刻。' } },
    build() {
      const grp = new THREE.Group();
      const brass = new THREE.MeshStandardMaterial({
        color: 0xc99f57, metalness: 1, roughness: 0.32,
        emissive: 0x2a1c08, emissiveIntensity: 0.8
      });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 40), brass);
      body.rotation.x = Math.PI / 2;
      const dTex = new THREE.CanvasTexture(dialTexture());
      dTex.colorSpace = THREE.SRGBColorSpace;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.295, 40),
        new THREE.MeshStandardMaterial({ map: dTex, roughness: 0.5,
          emissive: 0xf0e0c0, emissiveIntensity: 0.22, emissiveMap: dTex }));
      face.position.z = 0.062;
      const crownStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 16), brass);
      crownStem.position.y = 0.39;
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.065, 18, 14), brass);
      crown.position.y = 0.445;
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 10, 24), brass);
      loop.position.y = 0.53;
      grp.add(body, face, crownStem, crown, loop);
      grp.userData.spin = true;
      return grp;
    }
  }
];

function FloatingObjects() {
  const haloTex = radialTexture('rgba(232,186,120,0.9)', 'rgba(232,176,106,0)', 128);
  const items = FLOAT_OBJECTS.map(def => {
    const group = new THREE.Group();
    const obj = def.build();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, color: AMBER, transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.setScalar(2.6);
    group.add(halo, obj);
    scene.add(group);
    return { def, group, obj, halo, hover: 0 };
  });

  return {
    items,
    update(t, dt) {
      for (const it of items) {
        const { radius, height, period, phase } = it.def;
        const a = (t / period) * Math.PI * 2 + phase;
        it.group.position.set(
          Math.cos(a) * radius,
          height + Math.sin(t * 0.45 + phase * 2) * 0.3,
          Math.sin(a) * radius
        );
        // face the player wherever they are (lookAt points the +z front face at the target)
        it.obj.lookAt(camera.position);
        if (it.obj.userData.spin) it.obj.rotation.y = t * 0.35;
        it.obj.rotation.z = Math.sin(t * 0.4 + phase) * 0.06;
        // hover response
        const target = it === hovered ? 1 : 0;
        it.hover += (target - it.hover) * Math.min(1, dt * 6);
        const s = 1 + it.hover * 0.16;
        it.obj.scale.setScalar(s);
        const signatureReveal = GAME.roleState.signatureActive && !it.def.collected ? 0.32 : 0;
        it.halo.material.opacity = (it.def.collected ? 0.2 : 0.06) + it.hover * 0.16
          + signatureReveal + Math.sin(t * 1.3 + phase) * 0.015;
        it.halo.scale.setScalar(2.6 * (1 + it.hover * 0.2));
      }
      if (QA_LOCOMOTION_PROBE) {
        renderer.domElement.dataset.memoryPositions = JSON.stringify(items
          .filter(item => !item.def.collected)
          .map(item => ({
            name: item.def.name,
            position: item.group.position.toArray().map(value => Number(value.toFixed(2)))
          })));
      }
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

/* ================= Outdoor residents ================= */
// A small night population for the courtyard and the road to the academy.
// Walkers use wrappers so CloakedFigure can keep animating its own local scale.
function OutdoorResidents() {
  const residents = [];
  let knockdowns = 0;
  let residentNumber = 0;
  const doorX = HALL.x + (HALL.d / 2 + 3.2) * Math.sin(HALL.ry);
  const doorZ = HALL.z + (HALL.d / 2 + 3.2) * Math.cos(HALL.ry);
  const doorLen = Math.hypot(doorX, doorZ);
  // Begin inside the court so the population reads from the opening camera,
  // then naturally funnels onto the narrower causeway.
  const roadStart = new THREE.Vector3(doorX / doorLen * 13.5, 0.035, doorZ / doorLen * 13.5);
  const roadEnd = new THREE.Vector3(doorX, 0.035, doorZ);
  const roadDir = new THREE.Vector3().subVectors(roadEnd, roadStart).normalize();
  const roadSide = new THREE.Vector3(-roadDir.z, 0, roadDir.x);
  const navTarget = new THREE.Vector3();
  const navStep = new THREE.Vector3();
  const navProbe = new THREE.Vector3();
  const sideDepth = 12.5;
  const locationDefs = new Map(EXPLORABLES.map(def => [def.title.toLowerCase(), {
    x: def.x, z: def.z, ry: def.ry, depth: sideDepth
  }]));
  locationDefs.set('great hall', { x: HALL.x, z: HALL.z, ry: HALL.ry, depth: HALL.d });

  const makeResident = ({ scale = 1, phase = 0 }) => {
    const id = `resident-${String(++residentNumber).padStart(2, '0')}`;
    const profile = characterProfile(id);
    const fig = ResidentCharacter(profile);
    const root = new THREE.Group();
    const visualHeight = scale * (profile.appearance.height || 1);
    root.scale.set(scale, visualHeight, scale);
    root.add(fig.group);
    scene.add(root);
    const item = {
      id, profile, fig, root, phase, speed: 0, kind: 'idle', scale: visualHeight,
      hp: 3, alive: true, downT: 0,
      autonomous: false, navLocation: '', navStage: 'entry', navPos: new THREE.Vector3(),
      hitOffset: new THREE.Vector3(), knockVel: new THREE.Vector3(),
      targetPos: new THREE.Vector3()
    };
    SPELL_TARGETS.push({
      position: item.targetPos,
      radius: 0.72 * scale * (profile.appearance.width || 1),
      projectileScale: 0.35,
      active: () => item.alive && root.visible,
      hit(dir, damage = 1) {
        if (!item.alive) return;
        item.hp -= damage;
        item.fig.hit();
        item.knockVel.addScaledVector(dir, 2.4);
        livingWorld.recordAttack(item.id, damage,
          ({ 1: 'ember', 2: 'scatter', 3: 'moonbow' })[GAME.weapon] || 'spell');
        if (item.hp > 0) return;
        item.alive = false;
        item.downT = 0;
        item.hp = 0;
        knockdowns++;
        if (knockdowns === 1) {
          storyCard(tr('The spell knocks a resident down.', '法術將一名居民擊倒。'),
            tr('they will recover in a few moments', '對方會在片刻後恢復'));
        }
      }
    });
    residents.push(item);
    return item;
  };

  // Main causeway traffic: students and wardens travelling in both directions.
  for (let i = 0; i < 10; i++) {
    const n = makeResident({
      scale: 0.86 + (i % 4) * 0.045,
      phase: (i + 0.35) / 10
    });
    n.kind = 'road';
    n.speed = 0.028 + (i % 3) * 0.004;
    n.lateral = (i % 2 ? 1 : -1) * (0.72 + (i % 3) * 0.22);
  }

  // A few residents circulate around the rune court instead of crossing it.
  for (let i = 0; i < 4; i++) {
    const n = makeResident({
      scale: 0.84 + i * 0.035, phase: i / 4
    });
    n.kind = 'court';
    n.speed = 0.055 + i * 0.006;
    n.radius = 25.2 + (i % 2) * 1.7;
  }

  // Two quiet conversations beside the road make the population feel purposeful.
  const chats = [
    { k: 0.32, side: -1, gap: 1.05 },
    { k: 0.69, side: 1, gap: 1.12 }
  ];
  chats.forEach((chat, groupIndex) => {
    const centre = roadStart.clone().lerp(roadEnd, chat.k)
      .addScaledVector(roadSide, chat.side * 3.25);
    for (let j = 0; j < 2; j++) {
      const n = makeResident({
        scale: 0.88 + j * 0.05,
        phase: groupIndex * 1.7 + j
      });
      n.kind = 'chat';
      n.root.position.copy(centre).addScaledVector(roadDir, (j ? 1 : -1) * chat.gap);
      n.home = n.root.position.clone();
      const look = centre.clone().sub(n.root.position);
      n.root.rotation.y = Math.atan2(-look.x, -look.z);
    }
  });

  // Authored campus activity zones remain legible even when the persistent
  // living-world service is offline: readers by benches, groundskeepers on the
  // lawn edges, and cloister traffic under the Great Hall arches.
  const readers = [
    { x: -18.8, z: -10.15, ry: 2.92 },
    { x: 19.75, z: -11.75, ry: -2.96 },
    { x: -18.7, z: 20.25, ry: 2.35 }
  ];
  readers.forEach((spot, i) => {
    const n = makeResident({ scale: 0.78 + i * 0.025, phase: 3.2 + i * 0.9 });
    n.kind = 'reader';
    n.home = new THREE.Vector3(spot.x, 0.48, spot.z);
    n.root.rotation.y = spot.ry;
    n.root.scale.y *= 0.72;
  });

  for (let i = 0; i < 2; i++) {
    const n = makeResident({ scale: 0.92 + i * 0.04, phase: 5.1 + i * 1.7 });
    n.kind = 'grounds';
    n.speed = 0.022 + i * 0.004;
    n.groundA = new THREE.Vector3(i ? 32 : -33, 0.035, -8);
    n.groundB = new THREE.Vector3(i ? 24 : -25, 0.035, -48);
  }

  for (let i = 0; i < 5; i++) {
    const n = makeResident({ scale: 0.83 + (i % 3) * 0.045, phase: 6.4 + i * 0.31 });
    n.kind = 'cloister';
    n.speed = 0.024 + (i % 2) * 0.004;
    n.cloisterZ = -68.7 - (i % 2) * 1.1;
    n.cloisterLane = (i % 2 ? -1 : 1) * 0.45;
  }

  const roadPoint = new THREE.Vector3();
  function scheduledTarget(n, persistent, t) {
    const location = String(persistent.location || 'rune court').toLowerCase();
    const building = locationDefs.get(location);
    if (!building) {
      const angle = (residentNumber + Number(n.id.slice(-2))) * 1.7;
      navTarget.set(Math.cos(angle) * 20, 0.035, Math.sin(angle) * 20);
      return navTarget;
    }
    if (n.navLocation !== location) {
      n.navLocation = location;
      n.navStage = 'entry';
    }
    const sin = Math.sin(building.ry), cos = Math.cos(building.ry);
    const lane = ((Number(n.id.slice(-2)) % 5) - 2) * 0.52;
    const entryZ = building.depth / 2 + 2.6;
    const insideZ = building.depth / 2 - 2.1;
    const entryX = building.x + lane * cos + entryZ * sin;
    const entryWorldZ = building.z - lane * sin + entryZ * cos;
    if (n.navStage === 'entry' && Math.hypot(n.navPos.x - entryX, n.navPos.z - entryWorldZ) < 1.4) {
      n.navStage = 'inside';
    }
    const localZ = n.navStage === 'entry' ? entryZ : insideZ;
    const idleSway = n.navStage === 'inside' ? Math.sin(t * 0.18 + n.phase * 8) * 0.35 : 0;
    navTarget.set(
      building.x + (lane + idleSway) * cos + localZ * sin,
      0.035,
      building.z - (lane + idleSway) * sin + localZ * cos
    );
    return navTarget;
  }

  function updateAutonomous(n, persistent, t, dt, playerPos) {
    let target = scheduledTarget(n, persistent, t);
    let speed = (1.15 + Math.min(0.55, Math.max(0, 55 - persistent.energy) * 0.01)) * n.profile.movement.speed;
    const distanceToPlayer = playerPos ? n.navPos.distanceTo(playerPos) : Infinity;
    const frightened = persistent.fearPlayer >= 38 && distanceToPlayer < 22;
    const searching = persistent.activity === 'searching for the player' && playerPos;
    if (frightened) {
      navStep.copy(n.navPos).sub(playerPos).setY(0);
      if (navStep.lengthSq() < 0.01) navStep.set(Math.sin(n.phase * 13), 0, Math.cos(n.phase * 13));
      target = navTarget.copy(n.navPos).addScaledVector(navStep.normalize(), 18);
      speed = 2.55;
    } else if (searching) {
      target = navTarget.copy(playerPos);
      target.y = 0.035;
      speed = 2.15;
    }

    navStep.copy(target).sub(n.navPos).setY(0);
    const distance = navStep.length();
    if (distance > (searching ? 3.2 : 0.35)) {
      navStep.multiplyScalar(Math.min(distance, speed * dt) / Math.max(distance, 1e-5));
      const intendedX = n.navPos.x + navStep.x;
      const intendedZ = n.navPos.z + navStep.z;
      navProbe.set(intendedX, 0.92, intendedZ);
      resolveCollisions(navProbe, 0.38);
      n.navPos.x = navProbe.x;
      n.navPos.z = navProbe.z;
      const targetYaw = Math.atan2(-navStep.x, -navStep.z);
      const yawDelta = ((targetYaw - n.root.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      n.root.rotation.y += yawDelta * Math.min(1, dt * n.profile.movement.turn);
    }
    const rr = Math.hypot(n.navPos.x, n.navPos.z);
    if (rr > HUNT_R) { n.navPos.x *= HUNT_R / rr; n.navPos.z *= HUNT_R / rr; }
    n.navPos.y = 0.035;
    return distance > 0.4 ? Math.min(0.72, speed / 3) : 0.04;
  }

  function animateMovementStyle(n, t, motion) {
    const movement = n.profile.movement;
    const wave = Math.sin(t * movement.cadence + n.phase * 11);
    let lift = Math.abs(wave) * movement.bob * motion;
    let sway = wave * movement.sway * motion;
    if (movement.style === 'float' || movement.style === 'glide') lift = wave * movement.bob * (0.35 + motion);
    if (movement.style === 'limp') { lift *= wave > 0 ? 1.45 : 0.45; sway += Math.abs(wave) * 0.045 * motion; }
    if (movement.style === 'march' || movement.style.includes('march')) sway *= 0.35;
    n.fig.group.position.y = lift;
    n.fig.group.rotation.z = sway;
    if (n.fig.weaponGroup) n.fig.weaponGroup.rotation.x = -wave * 0.08 * motion;
  }

  return {
    residents,
    nearest(playerPos, maxDistance = 5) {
      if (!playerPos) return null;
      let best = null, bestDistance = maxDistance;
      for (const resident of residents) {
        if (!resident.alive || !resident.root.visible) continue;
        const distance = resident.targetPos.distanceTo(playerPos);
        if (distance < bestDistance) { best = resident; bestDistance = distance; }
      }
      return best ? { resident: best, distance: bestDistance } : null;
    },
    update(t, dt, playerPos, worldActive = true) {
      for (const n of residents) {
        const cloisterDormant = n.kind === 'cloister' && MODE === 'story'
          && !(siege && siege.active) && GAME.phase < 3;
        if (cloisterDormant) {
          n.root.visible = false;
          continue;
        }
        if (n.alive) n.root.visible = true;
        if (!n.alive) {
          n.downT += dt;
          n.root.position.addScaledVector(n.knockVel, dt);
          n.knockVel.multiplyScalar(Math.exp(-dt * 5));
          n.root.rotation.z = Math.min(Math.PI * 0.48, n.downT * 3.8);
          n.root.position.y -= dt * 0.08;
          if (n.downT > 1) n.root.visible = false;
          if (n.downT > 6) {
            n.alive = true;
            n.hp = 3;
            n.downT = 0;
            n.hitOffset.set(0, 0, 0);
            n.knockVel.set(0, 0, 0);
            n.root.rotation.z = 0;
            n.root.visible = true;
          }
          n.fig.update(t + n.phase * 2.3, dt, 0);
          animateMovementStyle(n, t, 0);
          continue;
        }
        const persistent = livingWorld.getNPC(n.id);
        if (persistent && worldActive && !n.autonomous) {
          n.autonomous = true;
          n.navPos.copy(n.root.position);
        }
        if (n.autonomous && persistent && worldActive) {
          const motion = updateAutonomous(n, persistent, t, dt, playerPos);
          n.hitOffset.addScaledVector(n.knockVel, dt);
          n.knockVel.multiplyScalar(Math.exp(-dt * 7));
          n.hitOffset.multiplyScalar(Math.exp(-dt * 3.5));
          n.root.position.copy(n.navPos).add(n.hitOffset);
          n.targetPos.set(n.root.position.x, n.root.position.y + 0.9 * n.scale, n.root.position.z);
          n.fig.update(t + n.phase * 2.3, dt, motion);
          animateMovementStyle(n, t, motion);
          continue;
        }
        const urgency = persistent ? 1 + Math.max(0, persistent.fearPlayer) / 180 : 1;
        let motion = 0;
        if (n.kind === 'road') {
          // Ping-pong keeps both directions populated without visible teleporting.
          const cycle = (n.phase + t * n.speed * urgency * n.profile.movement.speed) % 2;
          const k = cycle <= 1 ? cycle : 2 - cycle;
          const direction = cycle <= 1 ? 1 : -1;
          roadPoint.copy(roadStart).lerp(roadEnd, k).addScaledVector(roadSide, n.lateral);
          n.root.position.copy(roadPoint);
          n.root.rotation.y = Math.atan2(-roadDir.x * direction, -roadDir.z * direction);
          n.root.position.y += Math.abs(Math.sin(t * 5.2 + n.phase * 12)) * 0.018;
          motion = 0.42;
        } else if (n.kind === 'court') {
          const angle = n.phase * Math.PI * 2 + t * n.speed * urgency * n.profile.movement.speed;
          n.root.position.set(Math.cos(angle) * n.radius, 0.035, Math.sin(angle) * n.radius);
          n.root.rotation.y = Math.PI - angle;
          motion = 0.32;
        } else if (n.kind === 'grounds') {
          const cycle = (n.phase * 0.17 + t * n.speed * urgency) % 2;
          const k = cycle <= 1 ? cycle : 2 - cycle;
          const direction = cycle <= 1 ? 1 : -1;
          n.root.position.copy(n.groundA).lerp(n.groundB, k);
          const dir = navStep.copy(n.groundB).sub(n.groundA).multiplyScalar(direction);
          n.root.rotation.y = Math.atan2(-dir.x, -dir.z);
          motion = 0.26;
        } else if (n.kind === 'cloister') {
          const cycle = (n.phase * 0.19 + t * n.speed * urgency) % 2;
          const k = cycle <= 1 ? cycle : 2 - cycle;
          const direction = cycle <= 1 ? 1 : -1;
          n.root.position.set(lerp(-25, 25, k), 0.035, n.cloisterZ + n.cloisterLane);
          n.root.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
          motion = 0.34;
        } else {
          n.root.position.copy(n.home);
          n.root.rotation.z = Math.sin(t * 0.42 + n.phase) * (n.kind === 'reader' ? 0.018 : 0.012);
          motion = n.kind === 'reader' ? 0.03 : 0;
        }
        n.hitOffset.addScaledVector(n.knockVel, dt);
        n.knockVel.multiplyScalar(Math.exp(-dt * 7));
        n.hitOffset.multiplyScalar(Math.exp(-dt * 3.5));
        n.root.position.add(n.hitOffset);
        n.targetPos.set(n.root.position.x, n.root.position.y + 0.9 * n.scale, n.root.position.z);
        n.fig.update(t + n.phase * 2.3, dt, motion);
        animateMovementStyle(n, t, motion);
      }
    }
  };
}

function NPCInteraction(residentSystem) {
  const card = document.getElementById('npcCard');
  const kicker = card.querySelector('.npc-card-kicker');
  const nameEl = card.querySelector('.npc-card-name');
  const moodEl = card.querySelector('.npc-card-mood');
  const roleEl = card.querySelector('.npc-card-role');
  const activityEl = card.querySelector('.npc-card-activity');
  const movementEl = card.querySelector('.npc-card-movement');
  const weaponEl = card.querySelector('.npc-card-weapon');
  const memoryEl = card.querySelector('.npc-card-memory');
  const actionEl = card.querySelector('.npc-card-action span');
  let current = null;
  let interactPressed = false;
  let refreshT = 0;

  window.addEventListener('keydown', event => {
    if (event.code === 'KeyE' && !event.repeat && !UI_BLOCKS_STEERING) interactPressed = true;
  });

  const roleZh = role => {
    const pairs = [
      ['warden', '守夜人'], ['student', '學生'], ['alchemist', '鍊金術學徒'],
      ['healer', '療癒師'], ['librarian', '圖書管理員'], ['archivist', '記憶檔案師'],
      ['researcher', '研究員'], ['courier', '夜間信使'], ['owl keeper', '貓頭鷹飼養員'],
      ['tutor', '決鬥導師'], ['groundskeeper', '庭園管理員']
    ];
    return pairs.find(([key]) => role.includes(key))?.[1] || '居民';
  };
  const activityZh = activity => ({
    'sleeping': '正在睡覺', 'eating breakfast': '正在用早餐', 'studying': '正在學習',
    'patrolling': '正在巡邏', 'treating residents': '正在照顧居民', 'sorting messages': '正在整理信件',
    'cataloguing memories': '正在編目記憶', 'brewing': '正在調製藥劑', 'working': '正在工作',
    'socialising': '正在與朋友交談', 'walking alone': '正在獨自散步', 'returning home': '正在回家',
    'recovering': '正在醫務室恢復', 'fleeing': '正在逃離你',
    'seeking protection': '正在尋求守夜人保護', 'searching for the player': '正在搜尋提燈者',
    'resting': '正在休息'
  })[activity] || '正在城中生活';
  const moodZh = mood => ({
    quiet: '寧靜', calm: '平靜', focused: '專注', hopeful: '充滿希望', warm: '親切',
    thoughtful: '沉思', tired: '疲憊', afraid: '害怕', shaken: '驚魂未定',
    concerned: '擔心', wary: '戒備', alert: '警覺', alarmed: '高度警戒'
  })[mood] || '平靜';
  const movementZh = style => {
    if (style.includes('march')) return '行進步伐';
    if (style.includes('float')) return '漂浮';
    if (style.includes('glide')) return '滑行';
    if (style.includes('skip') || style.includes('bouncy')) return '輕快跳步';
    if (style.includes('limp')) return '跛行';
    if (style.includes('skitter')) return '快速碎步';
    if (style.includes('stride')) return '大步行走';
    if (style.includes('quiet') || style.includes('measured')) return '沉穩步伐';
    return '自然行走';
  };
  const weaponZh = type => ({ wand: '魔杖', staff: '法杖', flask: '鍊金藥瓶', moonbow: '月弓' })[type] || '法器';

  function render(resident) {
    const npc = livingWorld.getNPC(resident.id);
    const fallbackNumber = Number(resident.id.slice(-2));
    kicker.textContent = tr('LIVING RESIDENT', '永續世界居民');
    nameEl.textContent = npc?.name || tr(`Resident ${fallbackNumber}`, `居民 ${fallbackNumber}`);
    roleEl.textContent = npc ? (UI_LANG === 'zh-Hant' ? roleZh(npc.role) : npc.role) : tr('resident', '居民');
    moodEl.textContent = npc ? (UI_LANG === 'zh-Hant' ? moodZh(npc.mood) : npc.mood) : tr('calm', '平靜');
    activityEl.textContent = npc
      ? (UI_LANG === 'zh-Hant' ? activityZh(npc.activity) : npc.activity)
      : tr('walking through the city', '正在城中行走');
    movementEl.textContent = tr(
      `MOVE · ${resident.profile.movement.style} · ${resident.profile.movement.speed.toFixed(2)}x`,
      `移動 · ${movementZh(resident.profile.movement.style)} · ${resident.profile.movement.speed.toFixed(2)}x`
    );
    weaponEl.textContent = tr(
      `WEAPON · ${resident.profile.weapon.name} · ${resident.profile.weapon.damage} DMG`,
      `武器 · ${weaponZh(resident.profile.weapon.type)} · 傷害 ${resident.profile.weapon.damage}`
    );
    const memory = npc?.memories?.[0];
    memoryEl.textContent = memory
      ? tr(`Remembers: ${memory.summary_en}`, `記得：${memory.summary_zh}`)
      : tr('No strong memory of you yet.', '對你還沒有鮮明的記憶。');
    actionEl.textContent = npc?.fearPlayer >= 65 ? tr('APPROACH CAREFULLY', '謹慎靠近') : tr('GREET', '打招呼');
  }

  return {
    update(dt, playerPos, enabled) {
      refreshT -= dt;
      const nearest = enabled ? residentSystem.nearest(playerPos, 4.8) : null;
      current = nearest?.resident || null;
      card.classList.toggle('open', !!current);
      card.setAttribute('aria-hidden', String(!current));
      if (current && refreshT <= 0) { render(current); refreshT = 0.25; }
      if (interactPressed && current) {
        const npc = livingWorld.getNPC(current.id);
        livingWorld.act('greet', current.id);
        if (npc?.fearPlayer >= 65) {
          storyCard(npc.name, tr('steps back and watches your lantern', '後退一步，警戒地看著你的提燈'));
        } else {
          storyCard(npc?.name || tr('The resident', '這名居民'),
            tr('remembers that you stopped to speak', '記住了你曾停下來交談'));
        }
      }
      interactPressed = false;
    }
  };
}

// Rigged Three.js Xbot supplied in mercury-xbot-game-package.zip. The model is
// loaded only when selected, so the normal Sky Room startup stays lightweight.
async function MercuryXbotFigure() {
  const gltf = await new GLTFLoader().loadAsync(
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
        // KayKit's authored forward axis is opposite Sky Room's travel axis.
        // Apply the correction only to the playable avatar; the selection
        // preview intentionally keeps the character facing the viewer.
        loaded.group.rotation.y = entry.gameplayRotationY || 0;
        const animation = new CharacterAnimationController(loaded);
        animation.play('idle');
        let override = null, overrideRemaining = 0;
        const animated = {
          group: loaded.group,
          get modelInfo() { return {
            source: loaded.source,
            animations: loaded.animations.map(clip => clip.name),
            currentAnimation: animation.current
          }; },
          flare() { override = 'cast'; overrideRemaining = 0.72; },
          playAnimation(name, seconds = 0.7) { override = name; overrideRemaining = seconds; },
          update(t, dt, speed, pose) {
            let state = pose.state === 'flying' || pose.state === 'lifting'
              ? 'fly' : speed > 0.58 ? 'run' : speed > 0.04 ? 'walk' : 'idle';
            if (override && overrideRemaining > 0) {
              state = override;
              overrideRemaining -= dt;
            } else {
              override = null;
              overrideRemaining = 0;
            }
            animation.update(t, dt, state);
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
    get modelInfo() { return fig?.modelInfo || { source: 'procedural', animations: [], currentAnimation: null }; },
    setCharacter,
    flare() { fig?.flare(); },
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
        g.position.set(pos.x, 0.04, pos.z);
        g.rotation.set(0, heading, 0);
      } else if (state === 'lifting') {
        g.position.set(pos.x, lerp(0.04, FLY_Y - 0.85, liftE), pos.z);
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
const storyPartyEl = document.getElementById('storyParty');
const storyPartyStatusEl = storyPartyEl?.querySelector('.story-party-status');
const storyPartyClueEl = storyPartyEl?.querySelector('.story-party-clue');
const weaponEl = document.getElementById('weapon');
const crosshairEl = document.getElementById('crosshair');
const storyEl = document.getElementById('storycard');
const vignetteEl = document.getElementById('vignette');
const fadeEl = document.getElementById('fade');
let storyTimer = 0;

function storyCard(main, sub, holdMs = 5600) {
  storyEl.innerHTML = main + (sub ? `<small>${sub}</small>` : '');
  storyEl.classList.add('show');
  clearTimeout(storyTimer);
  storyTimer = setTimeout(() => storyEl.classList.remove('show'), holdMs);
}

// The Unlight is now a cast of readable corrupted memories rather than loose
// sprites. The public interface stays compatible with Story and Siege.
function Wisps(count = 14) {
  const coreTex = radialTexture('rgba(190,120,255,1)', 'rgba(70,20,120,0)', 64);
  const moteTex = radialTexture('rgba(255,225,160,1)', 'rgba(255,170,80,0)', 64);
  const darkTex = radialTexture('rgba(9,3,15,0.82)', 'rgba(45,12,70,0)', 128);
  const CONFIG = {
    stray: { hp: 2.2, detect: 40, seek: 7.8, dive: 18, turn: 1.25, windup: 0.72, hitRadius: 1.35, damage: 14, corruption: 8 },
    groundskeeper: { hp: 5.2, detect: 55, seek: 4.8, dive: 10.5, turn: 0.72, windup: 1.12, hitRadius: 2.05, damage: 22, corruption: 13 },
    bellwarden: { hp: 10, detect: 85, seek: 5.4, dive: 13, turn: 0.48, windup: 1.55, hitRadius: 2.5, damage: 28, corruption: 19 }
  };
  let s = 777123;
  const wr = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const _v = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const list = [];
  const effects = createCombatEffects({
    scene, camera, coreTexture: coreTex, moteTexture: moteTex,
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
      stage: 1, stageAnnounced: false, hitFlash: 0
    });
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
    if (state === 'seek') SkyAudio.enemyNotice(w.type, w.g.position);
    if (state === 'windup') SkyAudio.enemyWindup(w.type, w.stage, w.g.position);
  }

  function spawn(w) {
    rehome(w);
    w.g.position.copy(w.home);
    w.hp = w.maxHp; w.stage = 1; w.stageAnnounced = false;
    w.cool = w.type === 'bellwarden' ? 1.8 : 1;
    w.hitFlash = 0;
    w.lastWeapon = 0;
    setState(w, 'drift');
    w.g.visible = w.ring.visible = w.corruption.visible = true;
    w.threat.active = true;
    if (w.type === 'bellwarden') SkyAudio.enemyNotice('bellwarden', w.g.position);
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
    revealBellWarden(position) {
      const boss = list.find(enemy => enemy.type === 'bellwarden');
      if (!boss) return;
      spawn(boss);
      boss.home.copy(position);
      boss.g.position.copy(position);
      boss.cool = 99;
      setState(boss, 'drift');
    },
    calmAll() {
      for (const w of list) if (w.state !== 'off') { setState(w, 'retreat'); w.cool = 3; }
    },
    dissolveAll() {
      for (const w of list) if (w.state !== 'off') removeEnemy(w, 1e9, true);
    },
    tryHit(p, radius, damage = 1, weapon = GAME.weapon || 1) {
      let best = null, bestD = Infinity;
      for (const w of list) {
        if (w.state === 'off') continue;
        const distance = w.g.position.distanceTo(p);
        if (distance < w.cfg.hitRadius + radius && distance < bestD) { best = w; bestD = distance; }
      }
      if (!best) return false;
      if (GAME.roleState.passive === 'catalyst-chain' && best.lastWeapon && best.lastWeapon !== weapon) {
        damage *= 1.35;
        setState(best, 'stagger', 0.45);
      }
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
      setState(best, 'stagger', best.type === 'bellwarden' ? 0.38 : 0.28);
      return 'hit';
    },
    update(t, dt, player, phase, cbs) {
      for (const w of list) {
        if (w.state === 'off') {
          if (phase === 2 && w.tState < 1e8) { w.tState -= dt; if (w.tState <= 0) spawn(w); }
          continue;
        }
        const p = w.g.position;
        const dP = player ? p.distanceTo(player) : 1e9;
        const roleSlow = GAME.roleState.signatureActive && GAME.roleState.effect === 'violet-bloom' ? 0.55 : 1;
        const stageMul = (w.stage === 2 ? 1.24 : 1) * roleSlow;
        w.cool = Math.max(0, w.cool - dt);
        w.hitFlash = Math.max(0, w.hitFlash - dt * 4.5);
        w.art.clothMat.emissive.setHex(w.hitFlash > 0 ? 0x8d5bb8 : 0x180b24);
        w.art.clothMat.emissiveIntensity = 0.34 + w.hitFlash * 1.7;
        w.art.maskMat.emissiveIntensity = 0.22 + (w.state === 'windup' ? 0.85 : 0) + (w.stage - 1) * 0.45;
        w.art.eye.material.opacity = 0.48 + (w.state === 'seek' ? 0.35 : 0) + (w.state === 'windup' ? 0.17 : 0);
        w.art.eye.material.color.setHex(w.state === 'windup' ? 0xff845e : (w.stage === 2 ? 0xffb067 : 0xaf70ff));
        w.art.blackPetals.rotation.y += dt * (w.state === 'windup' ? 3.8 : 0.55);
        w.art.blackPetals.rotation.x = Math.sin(t * 0.5 + w.ph) * 0.18;
        w.art.visual.position.y = Math.sin(t * 1.1 + w.ph) * (w.type === 'groundskeeper' ? 0.05 : 0.14);
        w.art.visual.rotation.z = Math.sin(t * 0.75 + w.ph) * (w.state === 'stagger' ? 0.22 : 0.035);
        w.threat.intensity = Math.min(1.45, 0.35 + (w.state === 'seek' ? 0.28 : 0) + (w.state === 'windup' || w.state === 'dive' ? 0.52 : 0) + (w.stage - 1) * 0.28);
        w.corruption.position.set(p.x, 0.04, p.z);
        w.corruption.scale.setScalar(w.cfg.corruption * (0.78 + Math.sin(t * 1.7 + w.ph) * 0.04));
        w.corruption.material.opacity = 0.11 + w.threat.intensity * 0.11;
        w.ring.position.set(p.x, 0.065, p.z);
        w.ring.scale.setScalar(w.cfg.hitRadius * (w.state === 'windup' ? 1.8 + Math.sin(t * 9) * 0.22 : 1.08));
        w.ring.material.opacity = w.state === 'windup' ? 0.78 : w.state === 'seek' ? 0.24 : 0.08;
        const passiveReveal = GAME.roleState.passive === 'second-sight' && dP < 18;
        if (GAME.roleState.signatureActive || passiveReveal) {
          w.ring.material.opacity = Math.max(w.ring.material.opacity, GAME.roleState.signatureActive ? 0.62 : 0.22);
          w.ring.material.depthTest = false;
          w.art.eye.material.depthTest = false;
        } else {
          w.ring.material.depthTest = true;
          w.art.eye.material.depthTest = true;
        }
        if (player) w.g.lookAt(_look.copy(player).setY(p.y));

        if (w.type === 'bellwarden' && w.stage === 2 && !w.stageAnnounced) {
          w.stageAnnounced = true;
          storyCard(tr('The Bell Warden breaks the hour.', '鐘樓守望者擊碎了時刻。'),
            tr('its second toll hunts through the dark', '第二聲鐘鳴正在黑暗中追獵'), 4200);
          SkyAudio.enemyWindup('bellwarden', 2, w.g.position);
        }

        if (w.state === 'drift') {
          const amp = w.type === 'bellwarden' ? 2.2 : w.type === 'groundskeeper' ? 1.4 : 3.2;
          p.x = w.home.x + Math.sin(t * (w.type === 'bellwarden' ? 0.16 : 0.36) + w.ph) * amp;
          p.y = w.home.y + Math.sin(t * 0.48 + w.ph * 2) * (w.type === 'groundskeeper' ? 0.22 : 1.1);
          p.z = w.home.z + Math.cos(t * 0.29 + w.ph) * amp;
          if (phase === 2 && w.cool <= 0 && dP < w.cfg.detect) setState(w, 'seek');
        } else if (w.state === 'seek') {
          _v.copy(player).sub(p);
          if (w.type === 'groundskeeper') _v.y = clamp(_v.y, -0.5, 0.5); // altitude cleanly counters its root rush
          w.dir.copy(_v.normalize());
          p.addScaledVector(w.dir, dt * w.cfg.seek * stageMul);
          const trigger = w.type === 'bellwarden' ? 14 : w.type === 'groundskeeper' ? 10.5 : 8.5;
          if (dP < trigger) setState(w, 'windup', w.cfg.windup / stageMul);
          else if (dP > w.cfg.detect * 1.45) setState(w, 'retreat');
        } else if (w.state === 'windup') {
          w.tState -= dt;
          const progress = 1 - Math.max(0, w.tState) / (w.cfg.windup / stageMul);
          const crouch = 1 - Math.sin(progress * Math.PI) * (w.type === 'bellwarden' ? 0.18 : 0.3);
          w.art.visual.scale.setScalar(w.art.silhouetteScale * crouch);
          if (w.tState <= 0) {
            _v.copy(player).sub(p);
            if (w.type === 'groundskeeper') _v.y = clamp(_v.y, -0.35, 0.35);
            w.dir.copy(_v.normalize());
            setState(w, 'dive', w.type === 'bellwarden' ? 1.85 : 1.35);
            SkyAudio.enemyAttack(w.type, w.stage, w.g.position);
          }
        } else if (w.state === 'dive') {
          w.tState -= dt;
          _v.copy(player).sub(p);
          if (w.type === 'groundskeeper') _v.y = clamp(_v.y, -0.2, 0.2);
          w.dir.lerp(_v.normalize(), dt * w.cfg.turn).normalize();
          p.addScaledVector(w.dir, dt * w.cfg.dive * stageMul);
          w.art.visual.rotation.x = 0.42;
          if (dP < w.cfg.hitRadius + 0.35) {
            cbs.hitPlayer(w.dir, w.cfg.damage);
            setState(w, 'recover', w.type === 'bellwarden' ? 1.4 : 0.85);
          } else if (w.tState <= 0) setState(w, 'recover', 0.7);
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
      }

      effects.update(dt, player, cbs.heal, REDUCED_MOTION ? 0.16 : 1);
    },
    spellImpact(position, weapon, size = 0.7) {
      effects.impact(position, { weapon, size });
    },
    get effectStats() { return effects.stats; },
    get state() {
      return list.filter(enemy => enemy.state !== 'off').map(enemy => ({
        type: enemy.type, state: enemy.state, hp: enemy.hp, position: enemy.g.position.toArray()
      }));
    }
  };
}

const _spellHitDir = new THREE.Vector3();
function hitSpellTarget(position, radius, velocity, damage) {
  for (const target of SPELL_TARGETS) {
    if (target.active && !target.active()) continue;
    const hitRadius = target.radius + radius * (target.projectileScale ?? 1);
    if (target.position.distanceTo(position) <= hitRadius) {
      _spellHitDir.copy(velocity).normalize();
      target.hit(_spellHitDir, damage);
      return true;
    }
  }
  return false;
}

// bolts of morning light, cast from the lantern
function Bolts(max = 4) {
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
    fire(origin, dir, { speed = 42, ttl = 1.6, scale = 1, r = 1.9, stretch = 1, damage = 1, weapon = GAME.weapon || 1 } = {}) {
      const b = pool.find(bb => bb.ttl <= 0);
      if (!b) return false;
      b.g.position.copy(origin);
      b.vel.copy(dir).multiplyScalar(speed);
      b.ttl = ttl;
      b.r = r;
      b.damage = damage;
      b.weapon = weapon;
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
        if (!dead && hitSpellTarget(P, b.r, b.vel, b.damage)) { dead = true; showImpact = true; }
        if (!dead && specialTarget) {
          const specialHit = specialTarget.tryHit(P, b.r, b.damage, b.weapon);
          if (specialHit) {
            onSpecialHit?.(specialHit, b);
            dead = true;
            showImpact = true;
          }
        }
        if (!dead) {
          const enemyHit = wisps.tryHit(P, b.r, b.damage, b.weapon);
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
  const wisps = Wisps(14);
  const bolts = Bolts(12); // scatter needs five live embers per shot
  const _o = new THREE.Vector3();
  const _sc = new THREE.Vector3();
  let castCd = 0, vigPulse = 0, finaleK = 0, dead = false, nowT = 0;
  let interactQueued = false, signatureRemaining = 0, storyStarted = false;
  let storyFragment = null, strayActivated = false, wardenRevealed = false, firstFlightNarrated = false;
  const chapterIncidents = new Set();
  let chapterChoice = null;
  let gardenOutcome = null;
  let lastBossHp = null;
  const enemyShowcase = new URLSearchParams(window.location.search).has('enemy-showcase');
  const effectsShowcase = new URLSearchParams(window.location.search).has('effects-showcase');

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
    const label = UI_LANG === 'zh-Hant' ? entry.signature.zh : entry.signature.en;
    const explanation = {
      'memory-flare': tr('threats, memories, and the route shine through darkness', '威脅、記憶與路線會穿透黑暗發光'),
      'ward-dome': tr('incoming damage is reduced while the dome burns', '穹頂燃燒期間承受傷害降低'),
      'violet-bloom': tr('nearby Unlight movement is disrupted', '附近夜蝕的移動受到干擾'),
      'restoration-pulse': tr('lantern health and nearby landscape recover', '提燈生命與附近環境得到恢復')
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
      setTimeout(() => {
        wisps.revealBellWarden(opening.bossPosition);
        wardenRevealed = true;
        storyCard(tr('“You came back for me.”', '「你回來找我了。」'),
          tr('the jacaranda remembers · the cloister opens · something rings beyond it', '藍花楹重新記起 · 迴廊開啟 · 深處傳來鐘聲'), 7200);
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
  function hitPlayer(dir, damage = 16) {
    if (dead || (GAME.phase >= 4 && GAME.phase !== 8)) return;
    const guarded = GAME.roleState.signatureActive && GAME.roleState.effect === 'ward-dome';
    const steadfast = GAME.roleState.passive === 'steadfast-flame';
    GAME.hp = Math.max(0, GAME.hp - damage * (guarded ? 0.45 : steadfast ? 0.85 : 1));
    GAME.lastHitAt = nowT;
    vigPulse = 1;
    SkyAudio.hurt();
    ctrl.shake(0.8);
    ctrl.addImpulse(dir.x * 7, 2.2, dir.z * 7);
    avatar.playAnimation(GAME.hp <= 0 ? 'down' : 'hit', GAME.hp <= 0 ? 1.3 : 0.65);
    if (GAME.hp <= 0) die();
  }
  function networkHit({ hp, fromName }) {
    if (dead || GAME.phase === 4) return;
    GAME.hp = Math.max(0, Math.min(GAME.maxHp, Number(hp)));
    GAME.lastHitAt = nowT;
    vigPulse = 1;
    SkyAudio.hurt();
    ctrl.shake(0.9);
    avatar.playAnimation(GAME.hp <= 0 ? 'down' : 'hit', GAME.hp <= 0 ? 1.3 : 0.65);
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
  function cast() {
    if (GAME.phase < 1 || castCd > 0 || dead || ctrl.state !== 'flying') return;
    if (GAME.weapon === 3) return; // the moonbow only fires when drawn and loosed
    const dir = aimDir();
    const origin = muzzle(dir);
    if (GAME.weapon === 2) { // 星屑 — a fan of small embers
      let fired = false;
      const networkDirections = [];
      for (let i = 0; i < 5; i++) {
        _sc.copy(dir);
        _sc.x += (Math.random() - 0.5) * 0.24;
        _sc.y += (Math.random() - 0.5) * 0.24;
        _sc.z += (Math.random() - 0.5) * 0.24;
        _sc.normalize();
        if (bolts.fire(origin, _sc, { speed: 34, ttl: 0.8, scale: 0.6, r: 1.5, damage: 0.65 })) {
          fired = true;
          networkDirections.push([_sc.x, _sc.y, _sc.z]);
        }
      }
      if (fired) {
        skyMultiplayer.shoot(origin, networkDirections, 2);
        castCd = 0.9; avatar.flare(); SkyAudio.scatter(); ctrl.shake(0.08);
      }
    } else {
      if (bolts.fire(origin, dir)) {
        skyMultiplayer.shoot(origin, [dir], 1);
        castCd = 0.3; avatar.flare(); SkyAudio.cast(); ctrl.shake(0.025);
      }
    }
  }
  // 月弓 — press to draw, release to loose; power grows over 1.1s of draw
  let drawT0 = -1;
  function drawStart(t) {
    if (GAME.phase < 1 || castCd > 0 || dead || ctrl.state !== 'flying' || GAME.weapon !== 3) return;
    drawT0 = t;
    SkyAudio.bowDraw();
  }
  function drawPower(t) { return drawT0 < 0 ? 0 : Math.min(1, (t - drawT0) / 1.1); }
  function releaseBow(t) {
    if (drawT0 < 0) return false;
    const p = drawPower(t);
    drawT0 = -1;
    if (p < 0.12 || dead || ctrl.state !== 'flying') { SkyAudio.bowRelease(0); return false; }
    const dir = aimDir();
    const origin = muzzle(dir);
    if (bolts.fire(origin, dir,
      { speed: 55 + 75 * p, ttl: 2.4, scale: 0.55 + 0.5 * p, r: 1.6 + p,
        stretch: 5, damage: 1.4 + 1.6 * p })) {
      skyMultiplayer.shoot(origin, [dir], 3, p);
      castCd = 0.8;
      avatar.flare();
      ctrl.shake(0.08 + p * 0.12);
    }
    SkyAudio.bowRelease(p);
    return true;
  }
  const weaponInfo = w => ({
    1: { name: tr('ember', '晨焰'), role: tr('PRECISION · rapid mid-range pressure', '精準 · 中距離快速壓制') },
    2: { name: tr('scatter', '星屑'), role: tr('CLOSE CONTROL · wide burst', '近距控制 · 廣角爆發') },
    3: { name: tr('moonbow', '月弓'), role: tr('HEAVY RANGE · hold and release', '遠程重擊 · 蓄力放箭') }
  })[w];
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
      if (!wardenRevealed) {
        wardenRevealed = true;
        setTimeout(() => {
          wisps.revealBellWarden(opening.bossPosition);
          storyCard(tr('“You came back for me.”', '「你回來找我了。」'),
            tr('shared checkpoint · the cloister opens · the Bell Warden is waiting', '共享檢查點 · 迴廊開啟 · 鐘樓守望者正在等待'), 7200);
        }, previousPhase < 3 ? 900 : 120);
      }
    }

    if (nextPhase >= 4) {
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
        || investigateChapterIncident() || enterBlackGarden() || chargeGardenRelay();
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
    const wave = siege && siege.wave;   // during a siege wave, wisps dive the ward core
    blackGarden.update(t, dt, player, hitPlayer);
    wisps.update(t, dt, wave ? siege.coreTarget : player, GAME.phase, {
      hitPlayer: wave ? (dir) => siege.onCoreHit(dir) : hitPlayer,
      heal: (a) => { GAME.hp = Math.min(GAME.maxHp, GAME.hp + a); }
    });
    if (QA_LOCOMOTION_PROBE) {
      renderer.domElement.dataset.gameState = JSON.stringify({
        phase: GAME.phase,
        relics: GAME.relics,
        cleansed: GAME.cleansed,
        hp: Number(GAME.hp.toFixed(1)),
        enemies: wisps.state
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
  window.addEventListener('sky-language-change', () => { refreshObjective(); refreshWeapon(); });
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
      dead = false; GAME.hp = Math.max(1, Number(event.detail.hp) || 55); ctrl.setDimmed(false);
      storyCoopUI?.setDimmed(false); fadeEl.classList.remove('on'); SkyAudio.respawn(); avatar.playAnimation('interact', 0.8);
      storyCard(tr('Your lantern burns again.', '你的提燈再次燃起。'), tr('rekindled by a friend', '由朋友重新點亮'), 2600);
    }
  });
  window.addEventListener('sky-story-party-rekindle', event => {
    dead = false; GAME.hp = GAME.maxHp; ctrl.setDimmed(false); storyCoopUI?.setDimmed(false);
    const p = event.detail?.position; if (Array.isArray(p)) ctrl.resetTo(p);
    wisps.calmAll(); fadeEl.classList.remove('on'); SkyAudio.respawn();
    storyCard(tr('The party’s lanterns remember the checkpoint.', '隊伍的提燈記得檢查點。'), tr('everyone rekindled together', '所有人一起重新點亮'), 3200);
  });
  return { update, cast, onRelic, onAirborne, onGrounded, drawStart, drawPower, releaseBow, setWeapon,
    startStory, promptFlightLocked, activateSignature, refreshObjective, submitStoryVote, submitGardenVote,
    beginWave, endWave, networkHit, networkDown, networkRespawn,
    get state() { return { enemies: wisps.state, effects: wisps.effectStats, opening: {
      memoryRecovered: opening.memoryRecovered,
      encounterComplete: opening.encounterComplete,
      restoration: opening.restoration
    } }; }
  };
}

/* ================= Story B · Lantern Vanguard — P0 siege skeleton ================= */
// A single-player, client-only day/night siege layered on the existing flight and
// combat. No server persistence yet; the timeline is a compressed local loop so it
// is playable solo. See STORY_LANTERN_VANGUARD.md for the full design and roadmap.
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
  const DUSK_S = 6, WAVE_S = 18, LULL_S = 8, DAWN_S = 8, DAY_S = 14, WAVES = 3;
  const CORE_MAX = 100, WARD_Y = 10;
  const WAVE_DRAIN = 3.4;    // core drained per second per targeted ward
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
    return { id: def.id, meta, group, orb, ring, light, bar, label, orbMat, ringMat, hp: CORE_MAX, dark: false, seed: Math.random() * 9 };
  });
  const wardById = id => wards.find(w => w.id === id);
  const lit = id => { const w = wardById(id); return !!w && !w.dark; };

  const coreTarget = new THREE.Vector3().copy(wards[0].group.position);
  let running = false, phase = 'idle', pt = 0, night = 0, waveIx = 0, shards = 0;
  let waveTargets = [], focus = wards[0], stokeHeld = false, lostTonight = 0;
  // dual-mode: 'local' runs the sim (offline); connected clients mirror the server.
  let prevPhase = '', stokeAcc = 0;
  const prevDark = {};
  const isMirror = () => skyMultiplayer.connected && skyMultiplayer.inSiege;

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
  window.addEventListener('keyup', e => { if (e.code === 'KeyE') stokeHeld = false; });
  window.addEventListener('blur', () => { stokeHeld = false; });

  const targetCount = () => Math.min(wards.length, 1 + Math.floor(night / 2));
  function pickTargets() {
    const pool = wards.filter(w => !w.dark);
    const src = pool.length ? pool : wards;
    const start = (night * 3 + waveIx) % src.length;
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
    w.dark = true; w.hp = 0; lostTonight++;
    window.dispatchEvent(new CustomEvent('sky-ward-fallen', { detail: { id: w.id } }));
    fallCard(w);
    SkyAudio.hurt();
  }

  function enter(next) {
    phase = next; pt = 0;
    if (next === 'dusk') {
      waveIx = 0; lostTonight = 0; waveTargets = pickTargets();
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
    }
  }

  function start() {
    if (running) return;
    running = true; night = 1; shards = 0; lostTonight = 0;
    upgrades = { embers: 0, cores: 0, lantern: 0 };
    for (const w of wards) { w.hp = CORE_MAX; w.dark = false; w.serverHp = CORE_MAX; w.group.visible = true; }
    for (const id of Object.keys(prevDark)) delete prevDark[id];
    prevPhase = ''; stokeAcc = 0;
    document.getElementById('worldStatus')?.classList.add('siege-hidden');
    // Own the HUD directly: GameFlow.onAirborne only shows it while phase === 0,
    // but the first wave flips phase to 2, so that path can lose the race.
    hudEl.classList.add('on');
    crosshairEl.classList.remove('on');
    if (GAME.phase === 0) GAME.phase = 1;   // enable casting immediately
    hintEl.classList.remove('gone');
    hintEl.textContent = tr('W A S D walk · F or SPACE take flight', 'W A S D 步行 · F 或 SPACE 起飛');
    if (skyMultiplayer.connected) skyMultiplayer.joinSiege();  // server drives; snapshot arrives shortly
    else enter('dusk');                                         // offline: run the local sim
  }

  function onCoreHit() {
    if (isMirror()) { ctrl.shake(0.15); return; }   // server owns ward drain
    if (focus && !focus.dark) { focus.hp = Math.max(0, focus.hp - HIT_DRAIN); ctrl.shake(0.2); if (focus.hp <= 0) fall(focus); }
  }
  function onCleanse() {
    SkyAudio.cleanse();
    if (isMirror()) { skyMultiplayer.siegeAct('cleanse'); return; }
    shards++;
    if (focus && !focus.dark) focus.hp = Math.min(CORE_MAX, focus.hp + CLEANSE_HEAL + upgrades.embers * 2);
  }

  // ---- local (offline) authoritative sim ----
  function runLocal(dt) {
    pt += dt;
    const drainMul = (lit('practice') ? 0.7 : 1) * ((lit('owlpost') && pt < OWL_GRACE) ? 0 : 1) * (1 - 0.1 * upgrades.cores);
    const trickle = lit('alchemy') ? 1.6 : 0;
    if (phase === 'wave') {
      const targeted = new Set(waveTargets);
      for (const w of wards) {
        if (w.dark) continue;
        if (targeted.has(w)) w.hp = Math.max(0, w.hp - WAVE_DRAIN * drainMul * dt);
        if (trickle) w.hp = Math.min(CORE_MAX, w.hp + trickle * dt);
        if (w.hp <= 0) fall(w);
      }
      focus = waveTargets.filter(w => !w.dark).sort((a, b) => a.hp - b.hp)[0] || wards.find(w => !w.dark) || wards[0];
    } else {
      focus = nearestWard(1e9) || wards[0];
      const rate = phase === 'day' ? 6 : 3;
      for (const w of wards) if (!w.dark && w.hp < CORE_MAX) w.hp = Math.min(CORE_MAX, w.hp + (rate + trickle) * dt);
    }
    if (phase === 'dusk') { if (pt >= DUSK_S) enter('wave'); }
    else if (phase === 'wave') { if (pt >= WAVE_S) enter(waveIx >= WAVES ? 'dawn' : 'lull'); }
    else if (phase === 'lull') { if (pt >= LULL_S) enter('wave'); }
    else if (phase === 'dawn') { if (pt >= DAWN_S) { night++; enter('day'); } }
    else if (phase === 'day') { if (pt >= DAY_S) enter('dusk'); }
  }

  // ---- server-authoritative mirror (connected) ----
  function mirrorCard(snap) {
    if (snap.phase === 'dusk') {
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
    }
  }
  function applyServer(snap, dt) {
    night = snap.night; waveIx = snap.waveIx;
    waveTargets = snap.targets.map(id => wardById(id)).filter(Boolean);
    for (const sw of snap.wards) {
      const w = wardById(sw.id); if (!w) continue;
      if (sw.dark && !w.dark) { fallCard(w); window.dispatchEvent(new CustomEvent('sky-ward-fallen', { detail: { id: w.id } })); SkyAudio.hurt(); }
      else if (!sw.dark && w.dark) storyCard(tr(`${w.meta.prose} is relit.`, `${w.meta.proseZh}重新點亮。`), '', 3200);
      w.dark = sw.dark; w.serverHp = sw.hp;
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
      w.orbMat.emissiveIntensity = w.dark ? 0.1 : 1.2 + Math.sin(t * 3 + w.seed) * 0.3 + f * 1.1;
      w.light.intensity = w.dark ? 0 : 3 + f * 7 + (w === focus && phase === 'wave' ? 2 : 0);
      w.ringMat.opacity = w.dark ? 0.06 : 0.16 + f * 0.4;
      w.ring.rotation.z += dt * 0.7;
      w.label.material.opacity = w.dark ? 0.4 : 0.85;
      drawCoreBar(w.bar, f, w.dark);
    }
  }
  function renderHud() {
    const label = { dusk: 'DUSK', wave: `WAVE ${waveIx}/${WAVES}`, lull: 'LULL', dawn: 'DAWN', day: 'DAY' }[phase] || '';
    const labelZh = { dusk: '黃昏', wave: `第 ${waveIx}/${WAVES} 波`, lull: '喘息', dawn: '破曉', day: '白晝' }[phase] || '';
    const targeted = new Set(phase === 'wave' ? waveTargets : []);
    const dots = wards.map(w => {
      const color = w.dark ? '#6a5c8c' : (w.hp < 30 ? '#e0684a' : (targeted.has(w) ? '#ffe0b0' : '#ffc678'));
      const glyph = w.dark ? '✕' : (targeted.has(w) ? '◉' : '●');
      return `<span style="color:${color}">${glyph}</span>`;
    }).join(' ');
    const foc = focus ? `${tr(focus.meta.name, focus.meta.zh)} ${Math.round(focus.hp)}%` : '';
    const co = isMirror() ? tr(` · ${skyMultiplayer.peers.size + 1}▲`, ` · ${skyMultiplayer.peers.size + 1}▲`) : '';
    objectiveEl.innerHTML = tr(
      `NIGHT ${night} · ${label}${co} &nbsp; ${dots} &nbsp; ${foc}`,
      `第 ${night} 夜 · ${labelZh}${co} &nbsp; ${dots} &nbsp; ${foc}`);
    vignetteEl.style.opacity = (phase === 'wave' && focus && !focus.dark ? (1 - focus.hp / CORE_MAX) * 0.5 : 0).toFixed(3);
  }

  function update(t, dt) {
    if (!running) return;
    const snap = isMirror() ? skyMultiplayer.siegeSnapshot : null;
    if (snap) applyServer(snap, dt);
    else runLocal(dt);

    if (focus) coreTarget.copy(focus.group.position);

    // stoke / relight the nearest ward — apply locally offline, send an act when mirroring
    const near = nearestWard(STOKE_RANGE);
    if (stokeHeld && near) {
      if (snap) {
        stokeAcc += dt;
        if (stokeAcc >= 0.2) { stokeAcc = 0; skyMultiplayer.siegeAct(near.dark ? 'relight' : 'stoke', near.id); }
      } else {
        const stokeMul = (lit('infirmary') ? 1.35 : 1) * (1 + upgrades.lantern * 0.2);
        if (near.dark) {
          near.hp = Math.min(CORE_MAX, near.hp + STOKE_RATE * 0.55 * stokeMul * dt);
          if (near.hp >= CORE_MAX * 0.5) { near.dark = false; storyCard(tr(`${near.meta.prose} is relit.`, `${near.meta.proseZh}重新點亮。`), '', 3200); }
        } else near.hp = Math.min(CORE_MAX, near.hp + STOKE_RATE * stokeMul * dt);
      }
    }
    // the infirmary's aura mends the lantern itself, in either mode
    if (lit('infirmary') && GAME.hp < GAME.maxHp) GAME.hp = Math.min(GAME.maxHp, GAME.hp + dt * 4);

    presentWards(t, dt);
    renderHud();
    renderShop();
  }

  return {
    start, update, onCoreHit, onCleanse, coreTarget,
    get active() { return running; },
    get wave() { return running && phase === 'wave'; },
    get state() { return { running, phase, night, waveIx, shards, targets: waveTargets.map(w => w.id), focus: focus && focus.id, wards: wards.map(w => ({ id: w.id, hp: Math.round(w.hp), dark: w.dark })) }; }
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
  const camGoal = { x: 0, y: 0, z: 0 };
  const mouse = { x: 0, y: 0 };   // normalized -1..1
  let pointerSeen = false, lastPointerX = 0, lastPointerY = 0;
  let edgeLookEnabled = false, pointerWasLocked = false;
  const keys = Object.create(null);
  const keyReleaseTimers = Object.create(null);
  const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);
  const clearPressedKeys = () => { for (const code in keys) keys[code] = false; };
  const el = renderer.domElement;
  el.tabIndex = -1;
  el.dataset.locomotion = state;
  el.dataset.landing = 'false';
  let landingRequested = false;
  let dimmedMovement = false;

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
    if (!UI_BLOCKS_STEERING) keys[e.code] = true;
    if (e.code === 'KeyV' && !e.repeat) firstPerson = !firstPerson;
  };
  const handleKeyUp = e => {
    if (QA_LOCOMOTION_PROBE) el.dataset.lastKeyUp = `${e.code}:${e.key}`;
    if (e.code === 'Space') e.preventDefault();
    if (movementCodes.has(e.code)) {
      // Preserve ultra-short taps long enough for one animation frame. This
      // keeps walking dependable for keyboard accessibility tools and under
      // occasional low-frame-rate input without changing normal held input.
      keyReleaseTimers[e.code] = setTimeout(() => {
        keys[e.code] = false;
        keyReleaseTimers[e.code] = 0;
      }, QA_LOCOMOTION_PROBE ? 420 : 72);
    } else keys[e.code] = false;
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
      tYaw -= dx * 0.0032 * PLAYER_PREFS.lookSensitivity;
      tPitch = clamp(tPitch - dy * 0.0026 * PLAYER_PREFS.lookSensitivity,
        state === 'ground' ? -0.32 : -1.1, state === 'ground' ? 0.58 : 1.1);
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
    tYaw -= dx * 0.0042 * PLAYER_PREFS.lookSensitivity;
    tPitch = clamp(tPitch - dy * 0.0035 * PLAYER_PREFS.lookSensitivity,
      state === 'ground' ? -0.32 : -1.1, state === 'ground' ? 0.58 : 1.1);
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
  const liftOff = (now, allowEarly = false) => {
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
    lockPointer();
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
    pos.y = GROUND_Y;
    vel.y = 0;
    liftE = 0;
    firstPerson = false;
    tPitch = pitch = clamp(pitch, -0.32, 0.58);
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
      if (!QA_STORY_COOP_PROBE) return false;
      pos.set(Number(x) || 0, Number(y) || GROUND_Y, Number(z) || 0);
      vel.set(0, 0, 0);
      return true;
    },
    setFlyingPositionForQA(x, y, z) {
      if (!QA_STORY_COOP_PROBE) return false;
      setLocomotionState('flying');
      landingRequested = false;
      pos.set(Number(x) || 0, Math.max(GROUND_Y, Number(y) || FLY_Y), Number(z) || 0);
      vel.set(0, 0, 0);
      return true;
    },
    liftOff,
    land,
    update(t, dt) {
      if (edgeLookEnabled && document.pointerLockElement !== el && !UI_BLOCKS_STEERING
        && (state === 'ground' || state === 'flying')) {
        const edgeStart = 0.7;
        const edgeX = Math.abs(mouse.x) > edgeStart
          ? Math.sign(mouse.x) * (Math.abs(mouse.x) - edgeStart) / (1 - edgeStart) : 0;
        const edgeY = Math.abs(mouse.y) > 0.82
          ? Math.sign(mouse.y) * (Math.abs(mouse.y) - 0.82) / 0.18 : 0;
        tYaw -= edgeX * dt * 2.35 * PLAYER_PREFS.lookSensitivity;
        tPitch = clamp(tPitch - edgeY * dt * 0.85 * PLAYER_PREFS.lookSensitivity,
          state === 'ground' ? -0.32 : -1.1, state === 'ground' ? 0.58 : 1.1);
        yaw = tYaw;
        pitch = tPitch;
      }
      if (state === 'ground') {
        const f = clamp(key('KeyW', 'ArrowUp') - key('KeyS', 'ArrowDown') + TOUCH_INPUT.moveY, -1, 1);
        const s = clamp(key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft') + TOUCH_INPUT.moveX, -1, 1);
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
        pos.y = GROUND_Y;
        resolveCollisions(pos, PLAYER_R);
      } else if (state === 'lifting') {
        const p = Math.min(1, (t - liftStart) / LIFT_SECS);
        const e = liftE = quintic(p);
        pos.y = GROUND_Y + (FLY_Y - GROUND_Y) * e;
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
        const f = clamp(key('KeyW', 'ArrowUp') - key('KeyS', 'ArrowDown') + TOUCH_INPUT.moveY, -1, 1);
        const s = clamp(key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft') + TOUCH_INPUT.moveX, -1, 1);
        const rise = clamp(key('Space') + TOUCH_INPUT.rise, 0, 1);
        const descend = clamp(key('ShiftLeft', 'ShiftRight') + TOUCH_INPUT.descend, 0, 1);
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
        if (pos.y <= GROUND_Y && vel.y <= 0) settleOnGround();
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
      avatar.group.visible = !(firstPerson && state !== 'lifting');

      if (state === 'ground' && !firstPerson) {
        const fx = -Math.sin(yaw) * Math.cos(pitch);
        const fz = -Math.cos(yaw) * Math.cos(pitch);
        camGoal.x = pos.x - fx * 5.2;
        camGoal.y = 3.25 + Math.sin(pitch) * 1.4;
        camGoal.z = pos.z - fz * 5.2;
        resolveCollisions(camGoal, 0.35);
        const k = Math.min(1, dt * 12);
        camera.position.x = lerp(camera.position.x, camGoal.x, k);
        camera.position.y = lerp(camera.position.y, camGoal.y, k);
        camera.position.z = lerp(camera.position.z, camGoal.z, k);
        camera.lookAt(pos.x + fx * 2.2, 1.15 + Math.sin(pitch) * 2.2, pos.z + fz * 2.2);
      } else if (state === 'flying' && !firstPerson) {
        // third-person: orbit behind the view direction, never inside a wall
        const fx = -Math.sin(yaw) * Math.cos(pitch);
        const fy = Math.sin(pitch);
        const fz = -Math.cos(yaw) * Math.cos(pitch);
        camGoal.x = pos.x - fx * 4.4;
        camGoal.y = pos.y - fy * 4.4 + 1.0;
        camGoal.z = pos.z - fz * 4.4;
        resolveCollisions(camGoal, 0.35);
        const k = Math.min(1, dt * 16);
        camera.position.x = lerp(camera.position.x, camGoal.x, k);
        camera.position.y = lerp(camera.position.y, camGoal.y, k);
        camera.position.z = lerp(camera.position.z, camGoal.z, k);
        camera.lookAt(pos.x + fx * 2.5, pos.y + 0.5 + fy * 2.5, pos.z + fz * 2.5);
      } else {
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
  // moonbow: pressing on empty air starts the draw (move the cursor while held to aim)
  if (game && ctrl.state === 'flying' && GAME.weapon === 3 && !hovered) {
    game.drawStart(clock.elapsedTime);
  }
});
renderer.domElement.addEventListener('pointerup', e => {
  if (typeof MODE !== 'undefined' && MODE && MODE !== 'story') return; // duels are keyboard-driven
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  // a drawn moonbow looses on release even after moving the cursor to aim
  if (ctrl.state === 'flying' && game && GAME.weapon === 3 && game.releaseBow(clock.elapsedTime)) return;
  if (moved > 6) return; // was a drag, not a click
  if (ctrl.state === 'ground') {
    raycaster.setFromCamera(pointerNDC, camera);
    if (raycaster.intersectObject(rune.mesh).length) ctrl.liftOff(clock.elapsedTime);
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

/* ================= Settings ================= */
function SettingsController() {
  const defaults = { language: 'en', volume: 90, muted: false, quality: 'balanced', brightness: 100, sensitivity: 100, cameraShake: true, playerName: '', characterId: 'resident-01', cloakColor: '#e8b06a' };
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SKY_SETTINGS_KEY) || '{}'); } catch (_) { saved = {}; }
  const prefs = { ...defaults, ...saved };
  prefs.language = prefs.language === 'zh-Hant' ? 'zh-Hant' : 'en';

  const button = document.getElementById('settingsBtn');
  const panel = document.getElementById('settingsPanel');
  const language = document.getElementById('settingLanguage');
  const volume = document.getElementById('settingVolume');
  const volumeOut = panel.querySelector('output[for="settingVolume"]');
  const muted = document.getElementById('settingMuted');
  const quality = document.getElementById('settingQuality');
  const brightness = document.getElementById('settingBrightness');
  const brightnessOut = panel.querySelector('output[for="settingBrightness"]');
  const sensitivity = document.getElementById('settingSensitivity');
  const sensitivityOut = panel.querySelector('output[for="settingSensitivity"]');
  const shake = document.getElementById('settingShake');
  const playerName = document.getElementById('settingPlayerName');
  const character = document.getElementById('settingCharacter');
  const cloak = document.getElementById('settingCloak');
  const mainMenu = document.getElementById('settingsMainMenu');

  const ensureCloakOption = value => {
    if ([...cloak.options].some(option => option.value.toLowerCase() === value.toLowerCase())) return;
    const option = document.createElement('option');
    option.value = value;
    option.textContent = UI_LANG === 'zh-Hant' ? `自訂 ${value}` : `Custom ${value}`;
    cloak.appendChild(option);
  };

  const persist = () => {
    try { localStorage.setItem(SKY_SETTINGS_KEY, JSON.stringify(prefs)); } catch (_) { /* private mode */ }
  };
  const applyQuality = value => {
    const allowed = ['high', 'balanced', 'performance'];
    prefs.quality = allowed.includes(value) ? value : defaults.quality;
    const cap = prefs.quality === 'high' ? 2 : prefs.quality === 'balanced' ? 1.5 : 1;
    const ratio = Math.min(window.devicePixelRatio || 1, cap);
    renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (typeof composer.setPixelRatio === 'function') composer.setPixelRatio(ratio);
    composer.setSize(window.innerWidth, window.innerHeight);
    // Bloom is the largest full-screen GPU cost; reserve it for explicit high quality.
    bloom.enabled = prefs.quality === 'high';
  };
  const sync = () => {
    // Preserve the stored pair while the audio module emits its sync events.
    const storedVolume = prefs.volume;
    const storedMuted = prefs.muted;
    language.value = prefs.language;
    volume.value = storedVolume;
    volumeOut.value = `${storedVolume}%`;
    muted.checked = storedMuted;
    quality.value = prefs.quality;
    brightness.value = prefs.brightness;
    brightnessOut.value = `${prefs.brightness}%`;
    sensitivity.value = prefs.sensitivity;
    sensitivityOut.value = `${prefs.sensitivity}%`;
    shake.checked = prefs.cameraShake;
    playerName.value = prefs.playerName;
    character.value = prefs.characterId;
    prefs.cloakColor = /^#[0-9a-fA-F]{6}$/.test(prefs.cloakColor) ? prefs.cloakColor : defaults.cloakColor;
    ensureCloakOption(prefs.cloakColor);
    cloak.value = prefs.cloakColor;
    PLAYER_PREFS.lookSensitivity = prefs.sensitivity / 100;
    PLAYER_PREFS.cameraShake = prefs.cameraShake;
    SkyAudio.setMuted(storedMuted);
    SkyAudio.setVolume(storedVolume / 100);
    applyQuality(prefs.quality);
    renderer.toneMappingExposure = 1.24 * (prefs.brightness / 100);
  };
  const setOpen = open => {
    UI_BLOCKS_STEERING = open;
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    button.setAttribute('aria-expanded', String(open));
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock();
      panel.querySelector('.settings-close').focus();
    } else {
      button.focus();
      const storyCtrl = window.__sky && window.__sky.ctrl;
      if (storyCtrl && (storyCtrl.state === 'ground' || storyCtrl.state === 'flying')) storyCtrl.lockPointer();
    }
  };

  button.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  panel.addEventListener('click', e => { if (e.target.closest('[data-close-settings]')) setOpen(false); });
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && panel.classList.contains('open')) { e.preventDefault(); setOpen(false); }
  });
  language.addEventListener('change', () => {
    prefs.language = language.value === 'zh-Hant' ? 'zh-Hant' : 'en';
    UI_LANG = prefs.language;
    persist();
    applyDocumentLanguage();
    window.dispatchEvent(new CustomEvent('sky-language-change'));
  });
  volume.addEventListener('input', () => {
    prefs.volume = Number(volume.value); volumeOut.value = `${prefs.volume}%`;
    SkyAudio.setVolume(prefs.volume / 100); persist();
  });
  muted.addEventListener('change', () => { prefs.muted = muted.checked; SkyAudio.setMuted(prefs.muted); persist(); });
  quality.addEventListener('change', () => { applyQuality(quality.value); persist(); });
  brightness.addEventListener('input', () => {
    prefs.brightness = Number(brightness.value);
    brightnessOut.value = `${prefs.brightness}%`;
    renderer.toneMappingExposure = 1.24 * (prefs.brightness / 100);
    persist();
  });
  sensitivity.addEventListener('input', () => {
    prefs.sensitivity = Number(sensitivity.value);
    sensitivityOut.value = `${prefs.sensitivity}%`;
    PLAYER_PREFS.lookSensitivity = prefs.sensitivity / 100;
    persist();
  });
  shake.addEventListener('change', () => {
    prefs.cameraShake = shake.checked; PLAYER_PREFS.cameraShake = prefs.cameraShake; persist();
  });
  playerName.addEventListener('change', () => {
    prefs.playerName = playerName.value.trim().slice(0, 24); persist();
    skyMultiplayer.refreshIdentity(); // reconnect so other lanterns see the new name
  });
  character.addEventListener('change', () => {
    prefs.characterId = character.value; persist();
    window.__sky?.avatar?.setCharacter(prefs.characterId, prefs.cloakColor);
    skyMultiplayer.refreshIdentity();
  });
  cloak.addEventListener('change', () => {
    prefs.cloakColor = cloak.value; persist();
    window.__sky?.avatar?.setCharacter(prefs.characterId, prefs.cloakColor);
    skyMultiplayer.refreshIdentity();
  });
  window.addEventListener('sky-audio-change', e => {
    prefs.muted = e.detail.muted;
    prefs.volume = Math.round(e.detail.volume * 100);
    muted.checked = prefs.muted;
    volume.value = prefs.volume;
    volumeOut.value = `${prefs.volume}%`;
    persist();
  });
  mainMenu.addEventListener('click', () => window.location.reload());

  sync();
  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    prefs,
    setCharacter(id, color = prefs.cloakColor) {
      prefs.characterId = PLAYER_CHARACTER_IDS.includes(id) ? id : PLAYER_CHARACTER_IDS[0];
      prefs.cloakColor = /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : defaults.cloakColor;
      character.value = prefs.characterId;
      ensureCloakOption(prefs.cloakColor);
      cloak.value = prefs.cloakColor;
      persist();
      window.__sky?.avatar?.setCharacter(prefs.characterId, prefs.cloakColor);
      skyMultiplayer.refreshIdentity();
    }
  };
}

const settings = SettingsController();
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
  const touchDevice = matchMedia('(hover: none) and (pointer: coarse)').matches || navigator.maxTouchPoints > 0
    || new URLSearchParams(location.search).has('mobile-test');
  if (!root || !move || !base || !thumb || !look || !cast) return { setActive() {}, update() {} };

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

  for (const button of root.querySelectorAll('[data-touch-hold]')) {
    const prop = button.dataset.touchHold;
    const set = (value, e) => {
      stop(e); TOUCH_INPUT[prop] = value; button.classList.toggle('pressed', !!value);
      if (value) button.setPointerCapture(e.pointerId);
    };
    button.addEventListener('pointerdown', e => set(1, e));
    button.addEventListener('pointerup', e => set(0, e));
    button.addEventListener('pointercancel', e => set(0, e));
  }
  for (const button of root.querySelectorAll('[data-touch-weapon]')) {
    button.addEventListener('pointerdown', e => {
      stop(e); game.setWeapon(Number(button.dataset.touchWeapon));
    });
  }
  document.getElementById('touchView')?.addEventListener('pointerdown', e => { stop(e); ctrl.toggleView(); });
  document.getElementById('touchSignature')?.addEventListener('pointerdown', e => { stop(e); game.activateSignature(); });
  document.getElementById('touchInteract')?.addEventListener('pointerdown', e => {
    stop(e);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', key: 'e', bubbles: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', key: 'e', bubbles: true }));
  });
  cast.addEventListener('pointerdown', e => {
    if (!enabled) return;
    stop(e); castPointer = e.pointerId; cast.setPointerCapture(e.pointerId); cast.classList.add('pressed');
    if (ctrl.state === 'ground') ctrl.liftOff(clock.elapsedTime);
    else if (ctrl.state === 'flying' && GAME.weapon === 3) game.drawStart(clock.elapsedTime);
    else if (ctrl.state === 'flying') game.cast();
  });
  const castEnd = e => {
    if (e.pointerId !== castPointer) return;
    stop(e); castPointer = null; cast.classList.remove('pressed');
    if (ctrl.state === 'flying' && GAME.weapon === 3) game.releaseBow(clock.elapsedTime);
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
      for (const button of root.querySelectorAll('[data-touch-weapon]')) {
        button.classList.toggle('active', Number(button.dataset.touchWeapon) === GAME.weapon);
      }
      const lift = ctrl.state !== 'flying';
      cast.textContent = lift ? tr('FLY', '起飛') : (GAME.weapon === 3 ? tr('DRAW', '拉弓') : tr('CAST', '施法'));
    }
  };
}

/* ================= boot ================= */
const architecture = createArchitectureSystem({
  renderer, scene, HALL, EXPLORABLES, COLLIDERS, SPELL_TARGETS,
  ENV_THREAT_SOURCES, ENV_RESTORE_PULSES, LIT_MATS,
  AMBER, COOL, FLY_Y, GAME, settings, CloakedFigure,
  tr, storyCard, lerp, clamp, REDUCED_MOTION
});
const env = architecture.buildScene();
const architectureSceneBaseline = new Set(scene.children);
architecture.Buildings();
const hall = architecture.GreatHall();
const explorableBuildings = architecture.ExplorableBuildings();
architecture.registerArchitectureDetails(scene.children.filter(node => !architectureSceneBaseline.has(node)));
const outdoorResidents = OutdoorResidents();
const npcInteraction = NPCInteraction(outdoorResidents);
const rune = RuneMarker();
const particles = Particles(settings.prefs.quality === 'high' ? 900 : settings.prefs.quality === 'balanced' ? 650 : 400);
const floats = FloatingObjects();
const storyOpening = createStoryOpening({ scene, colliders: COLLIDERS, reducedMotion: REDUCED_MOTION });
const blackGarden = createBlackGarden({ scene, reducedMotion: REDUCED_MOTION });
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
  HUNT_R, HUNT_Y0, HUNT_Y1, ROMAN, COLLIDERS, SkyAudio, storyCard,
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
    if (MODE && MODE !== 'story') return null;
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

// Deterministic, query-gated multiplayer QA controls. These are deliberately
// unavailable in normal play and let two real browser clients verify the full
// authoritative prologue without frame-dependent manual traversal.
if (QA_STORY_COOP_PROBE) {
  const qaDelay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const qaEnterBlackGarden = async () => {
    if (MODE !== 'story') {
      storyCard(tr('Start STORY first.', '請先進入故事模式。'), tr('choose a character, ready, and start the session', '選擇角色、準備，然後開始故事'), 3000);
      return;
    }
    if (skyMultiplayer.connected && skyMultiplayer.inStory) {
      skyMultiplayer.storyAct('qa-enter-black-garden');
      await qaDelay(700);
      return;
    }
    if (GAME.phase === 0) {
      ctrl.setPositionForQA(0, 1.6, 19);
      await qaDelay(180); skyMultiplayer.storyAct('recover-opening'); await qaDelay(380);
    }
    if (GAME.phase === 1) {
      for (const relic of ['photograph', 'letter', 'watch']) {
        skyMultiplayer.storyAct('recover-relic', { relic }); await qaDelay(140);
      }
      await qaDelay(320);
    }
    if (GAME.phase === 2) { skyMultiplayer.storyAct('cleanse-stray'); await qaDelay(420); }
    if (GAME.phase === 3) {
      ctrl.setPositionForQA(0, 8, -54);
      await qaDelay(180); skyMultiplayer.storyAct('enter-cloister'); await qaDelay(420);
    }
    if (GAME.phase === 4) {
      for (const [incident, x, y, z] of [
        ['archive-slate', -12, 1.6, -68], ['bell-rope', 0, 1.6, -73], ['mara-satchel', 12, 1.6, -68]
      ]) {
        ctrl.setPositionForQA(x, y, z);
        await qaDelay(190); skyMultiplayer.storyAct('investigate-incident', { incident }); await qaDelay(360);
      }
      await qaDelay(320);
    }
    if (GAME.phase === 5) {
      skyMultiplayer.storyVote('mara');
      await qaDelay(520);
      if (GAME.phase === 5) {
        storyCard(tr('Every connected lantern must choose first.', '每一位已連線的提燈者都必須先投票。'),
          tr('ask each player to press this button once', '請每位玩家都按一次這個按鈕'), 4200);
        return;
      }
    }
    if (GAME.phase === 6) {
      ctrl.setPositionForQA(0, 1.6, -76);
      await qaDelay(200); skyMultiplayer.storyAct('enter-black-garden'); await qaDelay(520);
    }
  };
  const qaChargeGarden = async () => {
    if (GAME.phase !== 7) return qaEnterBlackGarden();
    for (const [relay, x, y, z, flying] of [
      ['canopy', 92, 10, 79, true], ['root', 82, 1.6, 86, false], ['well', 102, 1.6, 86, false]
    ]) {
      if (flying) ctrl.setFlyingPositionForQA(x, y, z);
      else ctrl.setPositionForQA(x, y, z);
      await qaDelay(210); skyMultiplayer.storyAct('charge-garden-relay', { relay }); await qaDelay(420);
    }
  };
  const qaDefeatGroundskeeper = async () => {
    if (GAME.phase !== 8) return;
    ctrl.setFlyingPositionForQA(92, 3.2, 99);
    for (let index = 0; index < 8 && GAME.phase === 8; index++) {
      skyMultiplayer.storyAct('groundskeeper-hit', { weapon: 3, power: 1 });
      await qaDelay(470);
    }
  };

  const qaPanel = document.createElement('aside');
  qaPanel.id = 'storyQaPanel';
  qaPanel.innerHTML = `
    <strong>${tr('CHAPTER II TEST', '第二章測試')}</strong>
    <button type="button" data-qa-story="enter">${tr('ENTER BLACK GARDEN', '直接進入黑色花園')}</button>
    <button type="button" data-qa-story="relays">${tr('CHARGE 3 RELAYS', '點亮三座中繼站')}</button>
    <button type="button" data-qa-story="boss">${tr('OPEN BOSS CHOICE', '進入 BOSS 選擇')}</button>
    <button type="button" data-qa-story="restore">${tr('RESTORE OUTCOME', '選擇恢復結局')}</button>`;
  document.body.appendChild(qaPanel);
  qaPanel.addEventListener('click', event => {
    const action = event.target.closest('[data-qa-story]')?.dataset.qaStory;
    if (action === 'enter') qaEnterBlackGarden();
    else if (action === 'relays') qaChargeGarden();
    else if (action === 'boss') qaDefeatGroundskeeper();
    else if (action === 'restore') skyMultiplayer.storyGardenVote('restore');
  });

  window.addEventListener('keydown', event => {
    if (event.repeat || MODE !== 'story') return;
    if (event.shiftKey && event.code === 'F6') {
      ctrl.setPositionForQA(0, 1.6, -76);
      setTimeout(() => skyMultiplayer.storyAct('enter-black-garden'), 180);
    } else if (event.shiftKey && event.code === 'F7') {
      [
        ['canopy', 92, 10, 79],
        ['root', 82, 1.6, 86],
        ['well', 102, 1.6, 86]
      ].forEach(([relay, x, y, z], index) => {
        setTimeout(() => {
          ctrl.setPositionForQA(x, y, z);
          setTimeout(() => skyMultiplayer.storyAct('charge-garden-relay', { relay }), 190);
        }, index * 520);
      });
    } else if (event.shiftKey && event.code === 'F8') {
      ctrl.setPositionForQA(92, 3.2, 99);
      for (let index = 0; index < 6; index++) {
        setTimeout(() => skyMultiplayer.storyAct('groundskeeper-hit', { weapon: 3, power: 1 }), index * 470 + 180);
      }
    } else if (event.shiftKey && event.code === 'F9') {
      skyMultiplayer.storyGardenVote('restore');
    } else if (event.code === 'F6') {
      ctrl.setPositionForQA(0, 1.6, 19);
      setTimeout(() => skyMultiplayer.storyAct('recover-opening'), 180);
    } else if (event.code === 'F7') {
      ['photograph', 'letter', 'watch'].forEach((relic, index) => {
        setTimeout(() => skyMultiplayer.storyAct('recover-relic', { relic }), index * 90);
      });
    } else if (event.code === 'F8') {
      skyMultiplayer.storyAct('cleanse-stray');
    } else if (event.code === 'F9') {
      ctrl.setPositionForQA(0, 8, -54);
      setTimeout(() => skyMultiplayer.storyAct('enter-cloister'), 180);
    } else if (event.code === 'F10') {
      [
        ['archive-slate', -12, 1.6, -68],
        ['bell-rope', 0, 1.6, -73],
        ['mara-satchel', 12, 1.6, -68]
      ].forEach(([incident, x, y, z], index) => {
        setTimeout(() => {
          ctrl.setPositionForQA(x, y, z);
          setTimeout(() => skyMultiplayer.storyAct('investigate-incident', { incident }), 190);
        }, index * 520);
      });
    } else if (event.code === 'F11') {
      skyMultiplayer.storyVote('mara');
    } else if (event.code === 'F12') {
      GAME.hp = 0;
      skyMultiplayer.storyAct('become-dimmed');
    }
  });
}

camera.position.set(STORY_START.x + 4.2, 3.25, STORY_START.z + 4.2);
window.__sky = { scene, camera, renderer, composer, ctrl, avatar, game, siege, GAME, skyMultiplayer, COLLIDERS, resolveCollisions,
  SPELL_TARGETS, ENV_THREAT_SOURCES, ENV_RESTORE_PULSES, explorableBuildings, outdoorResidents, storyOpening, floats,
  blackGarden, characterSelection, chooseMode, getDuel: () => duel, SkyAudio }; // console debugging handle
if (new URLSearchParams(window.location.search).has('camera-showcase')) {
  setTimeout(() => {
    ctrl.shake(0.72);
    console.info('[Sky QA] camera feedback', JSON.stringify({ enabled: PLAYER_PREFS.cameraShake, reducedMotion: REDUCED_MOTION }));
  }, 900);
}
if (new URLSearchParams(window.location.search).has('dawn-showcase')) {
  GAME.phase = 4;
  env.finale(1);
  console.info('[Sky QA] dawn palette', JSON.stringify({ background: `#${scene.background.getHexString()}`, fog: `#${scene.fog.color.getHexString()}` }));
}

const clock = new THREE.Clock();
const perfProbeEnabled = new URLSearchParams(window.location.search).has('perf-probe');
const perfProbe = { elapsed: 0, measured: 0, frames: 0, samples: [], reported: false };
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
renderer.info.autoReset = false;
let shadowElapsed = 0;
renderer.setAnimationLoop(() => {
  renderer.info.reset();
  const rawDt = clock.getDelta();
  const dt = Math.min(rawDt, 0.05);
  const t = clock.elapsedTime;
  shadowElapsed += dt;
  if (shadowElapsed >= 0.12) {
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
      ...skyMultiplayer.projectileStats
    });
  }
  touchUI.update();
  if (duel) {
    duel.update(t, dt);
    SkyAudio.update(dt, duel.P1.pos.y, duel.P1.vel.length(), true, duel.P1.pos);
    duel.render(); // first-person, split-screen when versus
  } else {
    ctrl.update(t, dt);
    if (game) game.update(t, dt);
    if (siege) siege.update(t, dt);
    SkyAudio.update(dt, ctrl.pos.y, ctrl.speed, ctrl.state !== 'ground', ctrl.pos);
    // drawn moonbow narrows the view — the sniper's breath
    const bowP = game ? game.drawPower(t) : 0;
    const targetFov = 57 - 16 * bowP + ctrl.feedbackFov;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }
    crosshairEl.style.transform = bowP > 0 ? `scale(${(1 + bowP * 1.6).toFixed(3)})` : '';
    updateHover();
    positionPreview();
    composer.render();
  }
  if (perfProbeEnabled && !perfProbe.reported) {
    perfProbe.elapsed += rawDt;
    if (perfProbe.elapsed >= 1.5) {
      perfProbe.measured += rawDt;
      perfProbe.frames++;
      perfProbe.samples.push(rawDt);
    }
    if (perfProbe.measured >= 8) {
      perfProbe.reported = true;
      perfProbe.samples.sort((a, b) => a - b);
      const p95 = perfProbe.samples[Math.min(perfProbe.samples.length - 1, Math.floor(perfProbe.samples.length * 0.95))] || 0;
      console.info('[Sky QA] performance probe', JSON.stringify({
        quality: settings.prefs.quality,
        seconds: Number(perfProbe.measured.toFixed(2)),
        frames: perfProbe.frames,
        averageFps: Number((perfProbe.frames / perfProbe.measured).toFixed(1)),
        p95FrameMs: Number((p95 * 1000).toFixed(1)),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        architectureDetail: architecture.detailStats(),
        effects: game?.state?.effects || null
      }));
    }
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('beforeunload', () => {
  livingWorld.destroy();
  skyMultiplayer.destroy();
  renderer.setAnimationLoop(null);
  renderer.dispose();
});
