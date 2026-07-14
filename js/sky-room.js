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
import { SkyAudio } from './sky-audio.js?v=phase3';
import { livingWorld } from './sky-living-world.js';
import { skyMultiplayer } from './sky-multiplayer.js?v=phase4b-role-state';
import { loadCharacterProfiles, characterProfile, colorNumber } from './sky-characters.js';
import { createArchitectureSystem } from './sky-room/architecture.js';
import { createDuelSystem } from './sky-room/duel.js';
import { createCharacterSelection } from './sky-room/characters/selection.js';
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
const FLIGHT_BUOYANCY = 8.25;  // lantern magic offsets most, but not all, weight
const FLIGHT_LIFT = 15.5;      // Space: controlled upward thrust
const FLIGHT_DESCENT = 10.5;   // Shift: deliberate fast descent
const FLIGHT_VERTICAL_DRAG = 1.15;
const FLIGHT_MAX_RISE = 9.5;
const FLIGHT_MAX_FALL = 7.5;
const PLAYER_R  = 0.7;    // collision radius while flying
const PLAYER_PREFS = { lookSensitivity: 1, cameraShake: true };
const TOUCH_INPUT = { moveX: 0, moveY: 0, rise: 0, descend: 0 };
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
        it.halo.material.opacity = (it.def.collected ? 0.2 : 0.06) + it.hover * 0.16 + Math.sin(t * 1.3 + phase) * 0.015;
        it.halo.scale.setScalar(2.6 * (1 + it.hover * 0.2));
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
  g.position.set(0, 0.04, 0); // standing on the rune
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
  let heading = 0, lean = 0, roll = 0;
  return {
    group: g,
    get characterId() { return characterId; },
    setCharacter,
    flare() { fig?.flare(); },
    update(t, dt, state, pos, yaw, vel, liftE) {
      const horizontalSpeed = Math.hypot(vel.x, vel.z);
      const speed = state === 'flying' ? Math.min(1, horizontalSpeed / FLY_SPEED) : (state === 'lifting' ? 0.45 : 0);
      if (state === 'ground') {
        g.position.set(0, 0.04, 0);
        g.rotation.set(0, Math.sin(t * 0.3) * 0.06, 0);
      } else if (state === 'lifting') {
        g.position.set(0, 0.04 + (FLY_Y - 0.89) * liftE, 0);
        g.rotation.set(0, liftE * 0.5, 0);
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
  hp: 100, maxHp: 100,
  relics: 0, relicsNeeded: 3,
  cleansed: 0, cleanseNeeded: 12,
  lastHitAt: -99,
  weapon: 1,           // 1 ember bolt · 2 scatter fan · 3 moonbow (drawn shot)
  // Compact multiplayer-safe foundation for future signature abilities.
  roleState: { signatureActive: false, signatureCharge: 1 }
};
let game = null;       // assigned at boot
let siege = null;      // Lantern Vanguard director; null unless a siege is chosen

const hudEl = document.getElementById('hud');
const hpFillEl = document.getElementById('hpfill');
const objectiveEl = document.getElementById('objective');
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
  const flashes = [], motes = [], restoreWaves = [];

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
    const f = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTex, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    f.position.copy(p); f.scale.setScalar(size);
    scene.add(f); flashes.push({ f, t: 0, size });
    if (dropMote) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: moteTex, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      m.position.copy(p); m.position.x += (wr() - 0.5) * size;
      m.position.z += (wr() - 0.5) * size;
      m.scale.setScalar(0.55 + size * 0.08);
      scene.add(m); motes.push({ m, t: 0 });
    }
  }

  function setState(w, state, duration = 0) {
    if (w.state === state) return;
    w.state = state; w.tState = duration;
    if (state === 'seek') SkyAudio.enemyNotice(w.type);
    if (state === 'windup') SkyAudio.enemyWindup(w.type, w.stage);
  }

  function spawn(w) {
    rehome(w);
    w.g.position.copy(w.home);
    w.hp = w.maxHp; w.stage = 1; w.stageAnnounced = false;
    w.cool = w.type === 'bellwarden' ? 1.8 : 1;
    w.hitFlash = 0;
    setState(w, 'drift');
    w.g.visible = w.ring.visible = w.corruption.visible = true;
    w.threat.active = true;
    if (w.type === 'bellwarden') SkyAudio.enemyNotice('bellwarden');
  }

  function removeEnemy(w, respawn = 6, reward = true) {
    if (reward) {
      const count = w.type === 'bellwarden' ? 4 : w.type === 'groundskeeper' ? 2 : 1;
      for (let i = 0; i < count; i++) sparkAt(w.g.position, true, 1 + i * 0.18);
      SkyAudio.enemyDefeat(w.type);
      if (w.type !== 'stray') {
        const position = w.g.position.clone(); position.y = 0.08;
        const radius = w.type === 'bellwarden' ? 32 : 22;
        ENV_RESTORE_PULSES.push({ position: position.clone(), radius, age: 0, duration: 4.2 });
        const wave = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 64), new THREE.MeshBasicMaterial({
          color: w.type === 'bellwarden' ? 0xffd79a : 0xb995e8,
          transparent: true, opacity: 0.72, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        wave.rotation.x = -Math.PI / 2; wave.position.copy(position);
        scene.add(wave); restoreWaves.push({ wave, age: 0, radius });
      }
    }
    w.state = 'off'; w.tState = respawn;
    w.g.visible = w.ring.visible = w.corruption.visible = false;
    w.threat.active = false; w.threat.intensity = 0;
  }

  return {
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
    calmAll() {
      for (const w of list) if (w.state !== 'off') { setState(w, 'retreat'); w.cool = 3; }
    },
    dissolveAll() {
      for (const w of list) if (w.state !== 'off') removeEnemy(w, 1e9, true);
    },
    tryHit(p, radius, damage = 1) {
      let best = null, bestD = Infinity;
      for (const w of list) {
        if (w.state === 'off') continue;
        const distance = w.g.position.distanceTo(p);
        if (distance < w.cfg.hitRadius + radius && distance < bestD) { best = w; bestD = distance; }
      }
      if (!best) return false;
      best.hp -= damage;
      best.hitFlash = 1;
      sparkAt(best.g.position, false, best.type === 'bellwarden' ? 1.5 : 0.9);
      SkyAudio.enemyHurt(best.type, best.hp / best.maxHp);
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
        const stageMul = w.stage === 2 ? 1.24 : 1;
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
        if (player) w.g.lookAt(_look.copy(player).setY(p.y));

        const dP = player ? p.distanceTo(player) : 1e9;
        if (w.type === 'bellwarden' && w.stage === 2 && !w.stageAnnounced) {
          w.stageAnnounced = true;
          storyCard(tr('The Bell Warden breaks the hour.', '鐘樓守望者擊碎了時刻。'),
            tr('its second toll hunts through the dark', '第二聲鐘鳴正在黑暗中追獵'), 4200);
          SkyAudio.enemyWindup('bellwarden', 2);
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
            SkyAudio.enemyAttack(w.type, w.stage);
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

      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i];
        fl.t += dt;
        fl.f.scale.setScalar(fl.size * (1 + fl.t * 7));
        fl.f.material.opacity = Math.max(0, 1 - fl.t * 2.2);
        if (fl.t > 0.5) { scene.remove(fl.f); flashes.splice(i, 1); }
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const mo = motes[i];
        mo.t += dt; mo.m.position.y += dt * 0.4;
        if (player) {
          const d = mo.m.position.distanceTo(player);
          if (d < 7) mo.m.position.addScaledVector(_v.copy(player).sub(mo.m.position).normalize(), dt * 11);
          if (d < 1.1) { cbs.heal(12); sparkAt(mo.m.position, false); scene.remove(mo.m); motes.splice(i, 1); continue; }
        }
        if (mo.t > 12) { scene.remove(mo.m); motes.splice(i, 1); }
      }
      for (let i = restoreWaves.length - 1; i >= 0; i--) {
        const restore = restoreWaves[i];
        restore.age += dt;
        const k = Math.min(1, restore.age / 1.45);
        restore.wave.scale.setScalar(0.4 + restore.radius * k);
        restore.wave.material.opacity = Math.max(0, 0.72 * (1 - restore.age / 2.2));
        if (restore.age >= 2.2) { scene.remove(restore.wave); restoreWaves.splice(i, 1); }
      }
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
    update(dt, wisps, onCleanse) {
      for (const b of pool) {
        if (b.ttl <= 0) continue;
        b.ttl -= dt;
        const P = b.g.position;
        P.addScaledVector(b.vel, dt);
        let dead = b.ttl <= 0 || P.y < 0.2 || Math.hypot(P.x, P.z) > 210;
        if (!dead && MODE === 'story' && !(siege && siege.active)
          && skyMultiplayer.tryHitPeer(P, b.r, b.weapon)) dead = true;
        if (!dead && hitSpellTarget(P, b.r, b.vel, b.damage)) dead = true;
        if (!dead) {
          const enemyHit = wisps.tryHit(P, b.r, b.damage);
          if (enemyHit) {
            if (enemyHit === 'kill') onCleanse();
            dead = true;
          }
        }
        if (!dead) { // stone stops light
          _p.x = P.x; _p.y = P.y; _p.z = P.z;
          resolveCollisions(_p, 0.15);
          if (Math.abs(_p.x - P.x) + Math.abs(_p.y - P.y) + Math.abs(_p.z - P.z) > 1e-4) dead = true;
        }
        if (dead) { b.ttl = 0; b.g.visible = false; }
      }
    }
  };
}

function GameFlow(ctrl, avatar, env) {
  const wisps = Wisps(14);
  const bolts = Bolts(12); // scatter needs five live embers per shot
  const _o = new THREE.Vector3();
  const _sc = new THREE.Vector3();
  // the hearth, in world space (hall local 0, -6.5)
  const hearth = new THREE.Vector3(
    HALL.x - 6.5 * Math.sin(HALL.ry), 3.2, HALL.z - 6.5 * Math.cos(HALL.ry));
  let castCd = 0, vigPulse = 0, finaleK = 0, dead = false, nowT = 0;
  const enemyShowcase = new URLSearchParams(window.location.search).has('enemy-showcase');

  const OBJ = {
    1: () => `${tr('recover the drifting memories', '尋回飄流的記憶')} &nbsp;·&nbsp; ${GAME.relics} / ${GAME.relicsNeeded}`,
    2: () => `${tr('cleanse the Unlight', '淨化夜蝕')} &nbsp;·&nbsp; ${GAME.cleansed} / ${GAME.cleanseNeeded}`,
    3: () => tr('return the morning to the hearth', '將晨光帶回爐火'),
    4: () => tr('wander the waking city', '漫步於醒來的城市')
  };
  const refreshObjective = () => { objectiveEl.innerHTML = OBJ[GAME.phase] ? OBJ[GAME.phase]() : ''; };
  if (enemyShowcase) setTimeout(() => {
    GAME.phase = 2;
    wisps.showcase();
    hudEl.classList.add('on');
    crosshairEl.classList.add('on');
    refreshObjective();
  }, 700);

  function onAirborne() {
    if (GAME.phase !== 0) return;
    GAME.phase = 1;
    hudEl.classList.add('on');
    crosshairEl.classList.add('on');
    if (siege && siege.active) return;   // a siege narrates its own nights
    setTimeout(() => storyCard(tr('At 11:47 the city fled the rising dark.', '11:47，城市逃離了不斷升起的黑暗。'),
      tr('three memories still drift where it left them', '三段記憶仍在原地飄流')), 900);
    refreshObjective();
  }
  function onRelic(item) {
    if (siege && siege.active) return;   // no drifting memories during a siege
    if (GAME.phase < 1 || item.def.collected) return;
    item.def.collected = true;
    GAME.relics++;
    SkyAudio.relic(GAME.relics);
    refreshObjective();
    if (GAME.relics >= GAME.relicsNeeded && GAME.phase === 1) {
      setTimeout(() => {
        if (GAME.phase !== 1) return;
        GAME.phase = 2;
        storyCard(tr('The Unlight has crept up the spires.', '夜蝕已爬上塔尖。'), tr('spend the morning — burn it clean', '獻出晨光——將它燃燒淨化'));
        wisps.activate();
        refreshObjective();
      }, 1800);
    }
  }
  function onCleanse() {
    if (siege && siege.active) return;   // siege routes cleanses to its own reward
    GAME.cleansed++;
    SkyAudio.cleanse();
    refreshObjective();
    if (GAME.cleansed >= GAME.cleanseNeeded && GAME.phase === 2) {
      GAME.phase = 3;
      wisps.calmAll();
      setTimeout(() => storyCard(tr('The last of the morning is yours to give.', '最後的晨光由你獻上。'),
        tr('carry it home — the hearth is waiting', '將它帶回家——爐火正在等待')), 1200);
      refreshObjective();
    }
  }
  function hitPlayer(dir, damage = 16) {
    if (dead || GAME.phase === 4) return;
    GAME.hp = Math.max(0, GAME.hp - damage);
    GAME.lastHitAt = nowT;
    vigPulse = 1;
    SkyAudio.hurt();
    ctrl.shake(0.8);
    ctrl.addImpulse(dir.x * 7, 2.2, dir.z * 7);
    if (GAME.hp <= 0) die();
  }
  function networkHit({ hp, fromName }) {
    if (dead || GAME.phase === 4) return;
    GAME.hp = Math.max(0, Math.min(GAME.maxHp, Number(hp)));
    GAME.lastHitAt = nowT;
    vigPulse = 1;
    SkyAudio.hurt();
    ctrl.shake(0.9);
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
    fadeEl.classList.add('on');
    SkyAudio.death();
    setTimeout(() => {
      ctrl.resetHome();
      GAME.hp = GAME.maxHp;
      wisps.calmAll();
      fadeEl.classList.remove('on');
      storyCard(tr('The wind carried you back to the circle.', '風將你帶回了圓陣。'), tr('the lantern remembers the way', '提燈記得回程'));
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
      for (let i = 0; i < 5; i++) {
        _sc.copy(dir);
        _sc.x += (Math.random() - 0.5) * 0.24;
        _sc.y += (Math.random() - 0.5) * 0.24;
        _sc.z += (Math.random() - 0.5) * 0.24;
        _sc.normalize();
        if (bolts.fire(origin, _sc, { speed: 34, ttl: 0.8, scale: 0.6, r: 1.5, damage: 0.65 })) fired = true;
      }
      if (fired) { castCd = 0.9; avatar.flare(); SkyAudio.scatter(); }
    } else {
      if (bolts.fire(origin, dir)) { castCd = 0.3; avatar.flare(); SkyAudio.cast(); }
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
    if (bolts.fire(muzzle(dir), dir,
      { speed: 55 + 75 * p, ttl: 2.4, scale: 0.55 + 0.5 * p, r: 1.6 + p,
        stretch: 5, damage: 1.4 + 1.6 * p })) {
      castCd = 0.8;
      avatar.flare();
    }
    SkyAudio.bowRelease(p);
    return true;
  }
  const weaponName = w => ({
    1: tr('ember', '晨焰'),
    2: tr('scatter', '星屑'),
    3: tr('moonbow', '月弓')
  })[w];
  const refreshWeapon = () => {
    weaponEl.innerHTML = [1, 2, 3].map(w =>
      `<span class="${w === GAME.weapon ? 'wactive' : ''}">${w} · ${weaponName(w)}</span>`).join('&nbsp;&nbsp;&nbsp;');
  };
  refreshWeapon();
  function setWeapon(w) {
    if (GAME.weapon === w) return;
    GAME.weapon = w;
    drawT0 = -1;
    SkyAudio.bowRelease(0); // silence a half-drawn string
    refreshWeapon();
    SkyAudio.weaponSelect();
  }
  function finale() {
    if (GAME.phase !== 3) return;
    GAME.phase = 4;
    finaleK = 0.001;
    wisps.dissolveAll();
    SkyAudio.finale();
    GAME.hp = GAME.maxHp;
    storyCard(tr('The city breathes again.', '城市再次呼吸。'), tr('the night is yours, lantern bearer', '這片夜晚屬於你，提燈者'), 8200);
    refreshObjective();
  }
  function update(t, dt) {
    nowT = t;
    castCd = Math.max(0, castCd - dt);
    if (!skyMultiplayer.connected && !dead && GAME.hp > 0 && GAME.hp < GAME.maxHp && t - GAME.lastHitAt > 6) {
      GAME.hp = Math.min(GAME.maxHp, GAME.hp + dt * 6); // the lantern rekindles itself
    }
    hpFillEl.style.width = (GAME.hp / GAME.maxHp * 100).toFixed(1) + '%';
    vigPulse = Math.max(0, vigPulse - dt * 2.2);
    vignetteEl.style.opacity = (vigPulse * 0.85 + (1 - GAME.hp / GAME.maxHp) * 0.3).toFixed(3);
    const player = ctrl.state === 'flying' && !dead ? ctrl.pos : null;
    const wave = siege && siege.wave;   // during a siege wave, wisps dive the ward core
    wisps.update(t, dt, wave ? siege.coreTarget : player, GAME.phase, {
      hitPlayer: wave ? (dir) => siege.onCoreHit(dir) : hitPlayer,
      heal: (a) => { GAME.hp = Math.min(GAME.maxHp, GAME.hp + a); }
    });
    bolts.update(dt, wisps, wave ? siege.onCleanse : onCleanse);
    if (GAME.phase === 3 && player && player.distanceTo(hearth) < 3.8) finale();
    if (finaleK > 0 && finaleK < 1) { finaleK = Math.min(1, finaleK + dt / 5); env.finale(finaleK); }
  }
  // Siege hooks — let SiegeLoop drive the Unlight without duplicating combat.
  function beginWave() { GAME.phase = 2; wisps.activate(); }
  function endWave() { wisps.calmAll(); if (GAME.phase === 2) GAME.phase = 1; }
  window.addEventListener('sky-language-change', () => { refreshObjective(); refreshWeapon(); });
  return { update, cast, onRelic, onAirborne, drawStart, drawPower, releaseBow, setWeapon,
    beginWave, endWave, networkHit, networkDown, networkRespawn };
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
    crosshairEl.classList.add('on');
    if (GAME.phase === 0) GAME.phase = 1;   // enable casting immediately
    ctrl.liftOff(clock.elapsedTime);
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
const duelKeys = Object.create(null);
window.addEventListener('keydown', e => { duelKeys[e.code] = true; });
window.addEventListener('keyup', e => { duelKeys[e.code] = false; });
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const HUNT_R = 80, HUNT_Y0 = 1.3, HUNT_Y1 = 34;
const _cv = new THREE.Vector3(), _cv2 = new THREE.Vector3(), _cvS = new THREE.Vector3();

function CameraController(avatar) {
  let state = 'ground';           // ground | lifting | flying
  let liftStart = 0, liftE = 0;
  let firstPerson = false;        // V toggles; third-person shows the traveler
  let shakeAmt = 0;               // impact shake, decays exponentially
  let yaw = 0, pitch = 0.17;
  let tYaw = 0, tPitch = 0.17;
  const pos = new THREE.Vector3(0, GROUND_Y, 4.4);
  const vel = new THREE.Vector3();
  const wish = new THREE.Vector3();
  const fwd = new THREE.Vector3(), rightv = new THREE.Vector3();
  const camGoal = { x: 0, y: 0, z: 0 };
  const mouse = { x: 0, y: 0 };   // normalized -1..1
  let pointerSeen = false, lastPointerX = 0, lastPointerY = 0;
  const keys = Object.create(null);
  const clearPressedKeys = () => { for (const code in keys) keys[code] = false; };
  const el = renderer.domElement;
  el.tabIndex = -1;

  const handleKeyDown = e => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && state === 'ground' && MODE === 'story' && !UI_BLOCKS_STEERING) {
        liftOff(clock.elapsedTime, true);
      }
    }
    if (!UI_BLOCKS_STEERING) keys[e.code] = true;
    if (e.code === 'KeyV' && !e.repeat) firstPerson = !firstPerson;
  };
  const handleKeyUp = e => {
    if (e.code === 'Space') e.preventDefault();
    keys[e.code] = false;
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
    if (!el.requestPointerLock || document.pointerLockElement === el) return;
    focusGameCanvas();
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
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
    if (state === 'flying' && !UI_BLOCKS_STEERING) {
      tYaw -= dx * 0.0032 * PLAYER_PREFS.lookSensitivity;
      tPitch = clamp(tPitch - dy * 0.0026 * PLAYER_PREFS.lookSensitivity, -1.1, 1.1);
      // Direct response: no edge-driven rotation and no delayed camera catch-up.
      yaw = tYaw;
      pitch = tPitch;
    }
  });
  el.addEventListener('pointerleave', () => { pointerSeen = false; });
  window.addEventListener('sky-touch-look', e => {
    if (state !== 'flying' || UI_BLOCKS_STEERING) return;
    const dx = Number(e.detail?.dx) || 0;
    const dy = Number(e.detail?.dy) || 0;
    tYaw -= dx * 0.0042 * PLAYER_PREFS.lookSensitivity;
    tPitch = clamp(tPitch - dy * 0.0035 * PLAYER_PREFS.lookSensitivity, -1.1, 1.1);
    yaw = tYaw;
    pitch = tPitch;
  });
  const syncPointerLockHint = () => {
    const shouldShow = state === 'flying' && MODE === 'story' && !UI_BLOCKS_STEERING
      && !matchMedia('(pointer: coarse)').matches && document.pointerLockElement !== el;
    mouseLockHintEl.classList.toggle('show', shouldShow);
  };
  document.addEventListener('pointerlockchange', () => {
    pointerSeen = false;
    syncPointerLockHint();
  });
  const recoverInputFocus = () => {
    clearPressedKeys();
    // macOS may return focus in two stages (recording UI → browser chrome → page).
    // Refocus now and once more after the browser finishes that handoff.
    focusGameCanvas();
    requestAnimationFrame(focusGameCanvas);
    setTimeout(focusGameCanvas, 120);
    syncPointerLockHint();
  };
  // Recording controls and app switching can blur the browser. Only discard
  // held inputs; flight state, position, velocity and altitude stay untouched.
  window.addEventListener('blur', clearPressedKeys);
  window.addEventListener('focus', recoverInputFocus);
  window.addEventListener('pageshow', recoverInputFocus);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') recoverInputFocus();
  });

  const quintic = t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  const liftOff = (now, allowEarly = false) => {
    if (state !== 'ground' || (!allowEarly && now < 1.2)) return;
    state = 'lifting';
    liftStart = now;
    hintEl.classList.add('gone');
    lockPointer(); // user gesture from the rune/hint enables unlimited 360° turning
    SkyAudio.init(); // the input that lifts you also unlocks audio when allowed
    SkyAudio.takeoff();
  };

  return {
    get state() { return state; },
    get pos() { return pos; },
    get speed() { return vel.length(); },
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    lockPointer,
    toggleView() { firstPerson = !firstPerson; },
    addImpulse(ix, iy, iz) { vel.x += ix; vel.y += iy; vel.z += iz; },
    shake(a) { if (PLAYER_PREFS.cameraShake) shakeAmt = Math.min(1, shakeAmt + a); },
    resetHome() { pos.set(0, FLY_Y, 0); vel.set(0, 0, 0); },
    liftOff,
    update(t, dt) {
      if (state === 'ground') {
        // subtle parallax while standing
        tYaw = -mouse.x * 0.045;
        tPitch = 0.17 - mouse.y * 0.03;
      } else if (state === 'lifting') {
        const p = Math.min(1, (t - liftStart) / LIFT_SECS);
        const e = liftE = quintic(p);
        pos.y = GROUND_Y + (FLY_Y - GROUND_Y) * e;
        pos.z = 4.4 * (1 - e);
        tPitch = 0.17 * (1 - e) + 0.02 * e;
        // organic sway, strongest mid-flight
        const swayEnv = Math.sin(p * Math.PI);
        tYaw = Math.sin(t * 0.65) * 0.05 * swayEnv;
        pos.x = Math.sin(t * 0.5) * 0.22 * swayEnv;
        // atmosphere warms as you rise
        env.spot.intensity = 260 + 240 * e;
        env.rayMats[0].opacity = 0.012 + 0.008 * e;
        env.rayMats[1].opacity = 0.018 + 0.008 * e;
        particles.mat.opacity = 0.5 + 0.3 * e;
        particles.mat.size = 0.16 + 0.05 * e;
        if (p >= 1) {
          state = 'flying'; vel.set(0, 0, 0);
          showFlightHint(); syncPointerLockHint();
          if (game) game.onAirborne();
        }
      } else {
        // Assisted-gravity flight. The lantern cancels most of gravity, Space
        // supplies lift, and releasing it produces a gentle, readable descent.
        const f = clamp(key('KeyW', 'ArrowUp') - key('KeyS', 'ArrowDown') + TOUCH_INPUT.moveY, -1, 1);
        const s = clamp(key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft') + TOUCH_INPUT.moveX, -1, 1);
        const rise = clamp(key('Space') + TOUCH_INPUT.rise, 0, 1);
        const descend = clamp(key('ShiftLeft', 'ShiftRight') + TOUCH_INPUT.descend, 0, 1);
        fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        rightv.set(Math.cos(yaw), 0, -Math.sin(yaw));
        wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(rightv, s);
        if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(FLY_SPEED);
        const horizontalResponse = Math.min(1, dt * 2.4);
        vel.x = lerp(vel.x, wish.x, horizontalResponse);
        vel.z = lerp(vel.z, wish.z, horizontalResponse);
        const pitchAssist = f * Math.sin(pitch) * 3.2;
        const verticalAcceleration = -FLIGHT_GRAVITY + FLIGHT_BUOYANCY
          + rise * FLIGHT_LIFT - descend * FLIGHT_DESCENT + pitchAssist;
        vel.y += verticalAcceleration * dt;
        vel.y *= Math.exp(-FLIGHT_VERTICAL_DRAG * dt);
        vel.y = clamp(vel.y, -FLIGHT_MAX_FALL, FLIGHT_MAX_RISE);
        pos.addScaledVector(vel, dt);
        if (pos.y <= 1.3) { pos.y = 1.3; if (vel.y < 0) vel.y = 0; }
        if (pos.y >= 80) { pos.y = 80; if (vel.y > 0) vel.y = 0; }
        const rr = Math.hypot(pos.x, pos.z);   // soft world boundary
        if (rr > 160) { pos.x *= 160 / rr; pos.z *= 160 / rr; }
        resolveCollisions(pos, PLAYER_R);      // no flying through stone
      }
      // damped orientation
      yaw += (tYaw - yaw) * Math.min(1, dt * 3.2);
      pitch += (tPitch - pitch) * Math.min(1, dt * 3.2);

      // drive the traveler; hidden only in first-person flight
      avatar.update(t, dt, state, pos, yaw, vel, liftE);
      avatar.group.visible = !(firstPerson && state === 'flying');

      if (state === 'flying' && !firstPerson) {
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
      if (PLAYER_PREFS.cameraShake && shakeAmt > 0.002) {
        camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.5;
        camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.4;
        camera.position.z += (Math.random() - 0.5) * shakeAmt * 0.5;
        shakeAmt *= Math.exp(-dt * 4.5);
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
  else pointerNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
});
renderer.domElement.addEventListener('pointerdown', e => {
  if (typeof MODE !== 'undefined' && MODE && MODE !== 'story') return;
  if (ctrl.state === 'flying' && document.pointerLockElement !== renderer.domElement) {
    downAt = null;
    ctrl.lockPointer();
    return; // first click restores mouselook; the next click casts
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
      if (storyCtrl && storyCtrl.state === 'flying') storyCtrl.lockPointer();
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
  const moveEnd = e => { if (e.pointerId === movePointer) { stop(e); resetMove(); } };
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
  tr, storyCard, lerp, clamp
});
const env = architecture.buildScene();
architecture.Buildings();
const hall = architecture.GreatHall();
const explorableBuildings = architecture.ExplorableBuildings();
const outdoorResidents = OutdoorResidents();
const npcInteraction = NPCInteraction(outdoorResidents);
const rune = RuneMarker();
const particles = Particles(settings.prefs.quality === 'high' ? 900 : settings.prefs.quality === 'balanced' ? 650 : 400);
const floats = FloatingObjects();
const avatar = PlayerAvatar();
let characterSelectionActive = false;
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
    UI_BLOCKS_STEERING = false;
    enterMode('story');
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
  CloakedFigure
});
const resolveCollisions = duelRuntime.resolveCollisions;
const ctrl = CameraController(avatar);
game = GameFlow(ctrl, avatar, env);
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
  menuEl.classList.add('gone');
  touchUI.setActive(MODE === 'story');
  startAudio();
  if (MODE !== 'story') {
    hintEl.classList.add('gone');
    avatar.group.visible = false;
    duel = duelRuntime.DuelSystem(m);
  } else if (siegeMode) {
    hintEl.classList.add('gone');
    siege.start();
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
  if (e.code === 'KeyF' && !e.repeat && MODE === 'story' &&
      ctrl.state === 'ground' && !UI_BLOCKS_STEERING) {
    ctrl.liftOff(clock.elapsedTime);
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
      c: 0,
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

camera.position.set(0, GROUND_Y, 4.4);
window.__sky = { scene, camera, renderer, composer, ctrl, avatar, game, siege, GAME, skyMultiplayer, COLLIDERS, resolveCollisions,
  SPELL_TARGETS, ENV_THREAT_SOURCES, ENV_RESTORE_PULSES, explorableBuildings, chooseMode, getDuel: () => duel, SkyAudio }; // console debugging handle

const clock = new THREE.Clock();
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
let shadowElapsed = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  shadowElapsed += dt;
  if (shadowElapsed >= 0.12) {
    renderer.shadowMap.needsUpdate = true;
    shadowElapsed = 0;
  }
  rune.update(t);
  const activePlayerPos = duel ? duel.P1.pos : ctrl.pos;
  env.updateSky(t, dt, activePlayerPos);
  hall.update(t, dt, activePlayerPos);
  explorableBuildings.update(t, dt, activePlayerPos);
  outdoorResidents.update(t, dt, activePlayerPos, !duel);
  npcInteraction.update(dt, activePlayerPos, !duel && ctrl.state === 'flying');
  particles.update(t, dt);
  floats.update(t, dt);
  skyMultiplayer.update(t, dt);
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
    const targetFov = 57 - 16 * bowP;
    if (Math.abs(camera.fov - targetFov) > 0.01) {
      camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
      camera.updateProjectionMatrix();
    }
    crosshairEl.style.transform = bowP > 0 ? `scale(${(1 + bowP * 1.6).toFixed(3)})` : '';
    updateHover();
    positionPreview();
    composer.render();
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
