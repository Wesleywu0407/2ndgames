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
import { SkyAudio } from './sky-audio.js';
import { livingWorld } from './sky-living-world.js';
import { skyMultiplayer } from './sky-multiplayer.js';
import { loadCharacterProfiles, characterProfile, colorNumber } from './sky-characters.js';

await loadCharacterProfiles();

/* ================= palette / tuning ================= */
const BG     = 0x0a0a0f;
const AMBER  = 0xe8b06a;
const COOL   = 0x3a4a6a;
const IVORY  = 0xf0e6d2;

const GROUND_Y  = 1.6;
const FLY_Y     = 13.6;
const LIFT_SECS = 6.0;
const BOB_AMP   = 0.12;   // <= 0.15
const BOB_PERIOD = 4.0;
const FLY_SPEED = 15;     // units/sec at full tilt
const PLAYER_R  = 0.7;    // collision radius while flying
const PLAYER_PREFS = { lookSensitivity: 1, cameraShake: true };
let UI_BLOCKS_STEERING = false;
const SKY_SETTINGS_KEY = 'sky-room-settings-v1';
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
const HALL = { x: -10, z: -80, w: 26, d: 18, h: 34, ry: 0.15 };
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
function buildScene() {
  // Ancient flagstone terrain.  The original single colour map made the whole
  // courtyard read like polished plastic; these maps give the moonlight real
  // joints, chips and porous stone to catch.
  const groundMaps = ancientGroundTextures();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(440, 440, 128, 128),
    new THREE.MeshStandardMaterial({
      map: groundMaps.map,
      bumpMap: groundMaps.bumpMap,
      bumpScale: 0.42,
      roughnessMap: groundMaps.roughnessMap,
      roughness: 0.96,
      metalness: 0.0,
      color: 0xc3c7d0
    })
  );
  // A barely perceptible uneven silhouette prevents grazing light from tracing
  // one mathematically perfect plane.
  const floorPos = floor.geometry.attributes.position;
  for (let i = 0; i < floorPos.count; i++) {
    const x = floorPos.getX(i), y = floorPos.getY(i);
    const undulation = Math.sin(x * 0.071) * Math.cos(y * 0.063) * 0.055
      + Math.sin((x + y) * 0.19) * 0.018;
    floorPos.setZ(i, undulation);
  }
  floorPos.needsUpdate = true;
  floor.geometry.computeVertexNormals();
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.045;
  floor.receiveShadow = true;
  scene.add(floor);

  // flagstone courtyard around the rune court — reads under the lift-off and anchors the space
  const courtMap = groundMaps.map.clone();
  const courtBump = groundMaps.bumpMap.clone();
  const courtRough = groundMaps.roughnessMap.clone();
  for (const tex of [courtMap, courtBump, courtRough]) {
    tex.repeat.set(2.65, 2.65);
    tex.needsUpdate = true;
  }
  const courtyard = new THREE.Mesh(
    new THREE.CircleGeometry(30, 96),
    new THREE.MeshStandardMaterial({
      map: courtMap, bumpMap: courtBump, bumpScale: 0.5,
      roughnessMap: courtRough, roughness: 0.98, metalness: 0.0,
      color: 0xb9bdc6
    })
  );
  courtyard.rotation.x = -Math.PI / 2;
  courtyard.position.y = 0.006;
  courtyard.receiveShadow = true;
  scene.add(courtyard);

  // paved causeway from the courtyard to the great hall door
  {
    const doorX = HALL.x + (HALL.d / 2 + 1) * Math.sin(HALL.ry);
    const doorZ = HALL.z + (HALL.d / 2 + 1) * Math.cos(HALL.ry);
    const startK = 28.5 / Math.hypot(doorX, doorZ); // begin at the courtyard rim
    const sx = doorX * startK, sz = doorZ * startK;
    const len = Math.hypot(doorX - sx, doorZ - sz) + 3;
    const wayMap = causewayTexture(len);
    const wayBump = causewayTexture(len);
    wayBump.colorSpace = THREE.NoColorSpace;
    const way = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, len),
      new THREE.MeshStandardMaterial({
        map: wayMap, bumpMap: wayBump, bumpScale: 0.3,
        roughness: 0.94, metalness: 0.0
      })
    );
    way.rotation.x = -Math.PI / 2;
    way.rotation.z = Math.atan2(-(doorX - sx), -(doorZ - sz));
    way.position.set((sx + doorX) / 2, 0.011, (sz + doorZ) / 2);
    way.receiveShadow = true;
    scene.add(way);
  }

  // Loose chips and small stones break the clean CG horizon at foot level.
  addGroundDebris();

  // faint warm pool on floor = fake reflection of the rune glow
  const poolTex = radialTexture('rgba(232,176,106,0.55)', 'rgba(232,176,106,0)');
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(11, 11),
    new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.012;
  scene.add(pool);

  // ring of slender pillars, barely visible, to sell verticality
  const pillarGeo = new THREE.BoxGeometry(0.9, 46, 0.9);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x14141d, roughness: 0.7, metalness: 0.2 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.31;
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(Math.cos(a) * 21, 23, Math.sin(a) * 21);
    p.castShadow = p.receiveShadow = true;
    scene.add(p);
    COLLIDERS.push({ kind: 'cyl', x: p.position.x, z: p.position.z, r: 0.8, y0: 0, y1: 46 });
  }

  // one warm godray from high above the rune
  // BackSide + narrow base keeps the ground camera outside the shaft,
  // so it reads as a column of light over the rune instead of washing the frame
  const rayMat = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0.012,
    blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false });
  const ray = new THREE.Mesh(new THREE.ConeGeometry(3.4, 42, 32, 1, true), rayMat);
  ray.position.y = 21;
  scene.add(ray);
  const rayInner = new THREE.Mesh(new THREE.ConeGeometry(1.8, 42, 32, 1, true), rayMat.clone());
  rayInner.material.opacity = 0.018;
  rayInner.position.y = 21;
  scene.add(rayInner);

  // lights: warm key from above, cool rim from the side, faint ambient
  const spot = new THREE.SpotLight(AMBER, 260, 90, 0.42, 0.65, 1);
  spot.position.set(0, 34, 0);
  spot.target.position.set(0, 0, 0);
  scene.add(spot, spot.target);

  const rim = new THREE.DirectionalLight(COOL, 0.7); // soft counter-rim only; the moon is the key
  rim.position.set(-14, 18, -10);
  scene.add(rim);

  scene.add(new THREE.AmbientLight(0x3d4b69, 0.58));
  scene.add(new THREE.HemisphereLight(0x61759b, 0x0b0a0e, 1.22)); // cool sky reveals stone without flattening shadows

  // Broad, shadowless moon bounce aimed at the academy facade.  It raises only
  // the architectural midtones; the night sky and deep recesses stay dark.
  const architectureFill = new THREE.SpotLight(0x7890bd, 230, 190, 0.72, 0.92, 1);
  architectureFill.position.set(18, 42, 38);
  architectureFill.target.position.set(HALL.x, 15, HALL.z);
  scene.add(architectureFill, architectureFill.target);

  // the moon — cratered disc hanging above the castle, orientation landmark for flight
  const moonPos = new THREE.Vector3(58, 82, -150);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: moonTexture(), transparent: true, depthWrite: false, fog: false
  }));
  moon.position.copy(moonPos);
  moon.scale.setScalar(26);
  scene.add(moon);

  // layered halo: a tight bright ring and a wide atmospheric glow
  const haloIn = new THREE.Sprite(new THREE.SpriteMaterial({
    map: radialTexture('rgba(225,232,255,0.55)', 'rgba(225,232,255,0)', 128),
    transparent: true, opacity: 0.3,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  haloIn.position.copy(moonPos).multiplyScalar(1.02);
  haloIn.scale.setScalar(56);
  const haloOut = new THREE.Sprite(haloIn.material.clone());
  haloOut.material.opacity = 0.1;
  haloOut.position.copy(moonPos).multiplyScalar(1.05);
  haloOut.scale.setScalar(140);
  scene.add(haloIn, haloOut);

  // moonlight: cool shadow-casting key so towers throw long shadows across the plain
  const moonLight = new THREE.DirectionalLight(0xa8b9e2, 3.05);
  moonLight.position.copy(moonPos);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.near = 30;
  moonLight.shadow.camera.far = 420;
  moonLight.shadow.camera.left = -150;
  moonLight.shadow.camera.right = 150;
  moonLight.shadow.camera.top = 150;
  moonLight.shadow.camera.bottom = -150;
  moonLight.shadow.bias = -0.0006;
  moonLight.shadow.normalBias = 0.8;
  scene.add(moonLight, moonLight.target);

  // long cool sheen the moon lays across the stone plain
  const moonPool = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 90),
    new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(150,170,220,0.4)', 'rgba(150,170,220,0)'),
      transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false
    })
  );
  moonPool.rotation.x = -Math.PI / 2;
  moonPool.rotation.z = Math.atan2(-moonPos.z, moonPos.x);
  moonPool.position.set(moonPos.x * 0.35, 0.02, moonPos.z * 0.35);
  scene.add(moonPool);

  // night-sky dome with a faint horizon band (fog-exempt so the sky is never pure void)
  const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 512;
  const skyG = skyC.getContext('2d');
  const skyGrad = skyG.createLinearGradient(0, 0, 0, 512);
  skyGrad.addColorStop(0.0, '#05060c');
  skyGrad.addColorStop(0.42, '#0c0e1a');
  skyGrad.addColorStop(0.5, '#1b1826');   // horizon glow
  skyGrad.addColorStop(0.56, '#0b0b12');
  skyGrad.addColorStop(1.0, '#08080c');
  skyG.fillStyle = skyGrad; skyG.fillRect(0, 0, 4, 512);
  const skyTex = new THREE.CanvasTexture(skyC);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(330, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  scene.add(dome);

  // starfield — two brightness tiers scattered over the upper dome
  {
    let s = 777;
    const sr = () => (s = (s * 48271) % 2147483647) / 2147483647;
    const starBatch = (n, size, opacity, tint) => {
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const az = sr() * Math.PI * 2;
        const el = Math.asin(0.06 + sr() * 0.93); // keep clear of the horizon band
        p[i * 3]     = Math.cos(el) * Math.cos(az) * 315;
        p[i * 3 + 1] = Math.sin(el) * 315;
        p[i * 3 + 2] = Math.cos(el) * Math.sin(az) * 315;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({
        color: tint, size, sizeAttenuation: false,
        transparent: true, opacity, fog: false, depthWrite: false
      }));
      pts.frustumCulled = false;
      scene.add(pts);
    };
    starBatch(520, 1.4, 0.5, 0xcdd4e8);
    starBatch(130, 2.4, 0.85, 0xf0ecdf);
  }

  // thin night clouds drifting past the moon
  const clouds = [];
  {
    const cTex = cloudTexture();
    let s = 909;
    const cr = () => (s = (s * 48271) % 2147483647) / 2147483647;
    for (let i = 0; i < 6; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cTex, color: 0xaab6d4, transparent: true,
        opacity: 0.05 + cr() * 0.05, depthWrite: false, fog: false
      }));
      sp.position.set(-120 + cr() * 260, 55 + cr() * 55, -230 + cr() * 60);
      sp.scale.set(90 + cr() * 90, 26 + cr() * 22, 1);
      sp.userData.v = 1.2 + cr() * 1.6;
      scene.add(sp);
      clouds.push(sp);
    }
  }

  // scattered village lanterns across the dark plain — one Points batch
  let villagesPts;
  {
    let s = 424242;
    const vr = () => (s = (s * 48271) % 2147483647) / 2147483647;
    const n = 170;
    const vpos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = vr() * Math.PI * 2;
      const r = 34 + Math.sqrt(vr()) * 180;
      vpos[i * 3] = Math.cos(a) * r;
      vpos[i * 3 + 1] = 0.6 + vr() * 1.6;
      vpos[i * 3 + 2] = Math.sin(a) * r;
    }
    const vgeo = new THREE.BufferGeometry();
    vgeo.setAttribute('position', new THREE.BufferAttribute(vpos, 3));
    villagesPts = new THREE.Points(vgeo, new THREE.PointsMaterial({
      map: radialTexture('rgba(232,186,120,1)', 'rgba(232,176,106,0)', 64),
      color: AMBER, size: 1.5, sizeAttenuation: true,
      transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    villagesPts.frustumCulled = false;
    scene.add(villagesPts);
  }

  // warm fill living at flight height so relics read once you're up there
  const flyFill = new THREE.PointLight(AMBER, 26, 30, 1.4);
  flyFill.position.set(0, FLY_Y + 2.5, 0);
  scene.add(flyFill);

  return {
    rayMats: [rayMat, rayInner.material], spot,
    updateSky(dt) {
      for (const c of clouds) {
        c.position.x += c.userData.v * dt;
        if (c.position.x > 260) c.position.x = -260;
      }
    },
    finale(k) { // the waking city: every lamp and window swells with light
      moonLight.intensity = 2.3 + 0.8 * k;
      villagesPts.material.opacity = 0.85 + 0.15 * k;
      villagesPts.material.size = 1.5 + 1.1 * k;
      for (const m of LIT_MATS) m.emissiveIntensity = 1.7 + 1.2 * k;
    }
  };
}

/* ================= Buildings (gothic castle skyline) ================= */
function lancetPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + h * 0.38);
  ctx.quadraticCurveTo(x, y, x + w / 2, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + h * 0.38);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

// round-headed arch, Great Court style
function archPath(ctx, x, y, w, h) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}

function stoneTextures(worldW, worldH, rand, arched = false) {
  const cw = 256, ch = 512;
  const base = document.createElement('canvas'); base.width = cw; base.height = ch;
  const glow = document.createElement('canvas'); glow.width = cw; glow.height = ch;
  const b = base.getContext('2d'), g = glow.getContext('2d');

  // sandstone patchwork — every block carries its own tone (UQ Great Court style)
  const tones = ['#4c4742', '#554e46', '#48423c', '#5a534a', '#423e39', '#514943', '#5d4c43'];
  for (let y = 0; y < ch; y += 14) {
    const off = (y / 14) % 2 ? 12 : 0;
    for (let x = -24; x < cw; x += 24) {
      b.fillStyle = tones[Math.floor(rand() * tones.length)];
      b.fillRect(x + off, y, 24, 14);
      if (rand() < 0.1) { // the occasional rose-tinged block
        b.fillStyle = 'rgba(125,82,70,0.22)';
        b.fillRect(x + off, y, 24, 14);
      }
      b.fillStyle = 'rgba(0,0,0,0.3)'; // vertical joint
      b.fillRect(x + off, y, 1.2, 14);
    }
    b.fillStyle = 'rgba(0,0,0,0.32)';  // mortar course
    b.fillRect(0, y, cw, 1.4);
  }
  const vgrad = b.createLinearGradient(0, 0, 0, ch);
  vgrad.addColorStop(0, 'rgba(150,166,210,0.22)'); // moon-kissed top
  vgrad.addColorStop(0.55, 'rgba(0,0,0,0)');
  vgrad.addColorStop(1, 'rgba(0,0,0,0.28)');       // grounded, shadowed base
  b.fillStyle = vgrad; b.fillRect(0, 0, cw, ch);
  for (let i = 0; i < 26; i++) {                   // rain-streak weathering
    b.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.09})`;
    b.fillRect(rand() * cw, rand() * ch * 0.5, 1 + rand() * 2, 30 + rand() * 90);
  }

  g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
  // window rows: round-headed arches on the great court, lancets in the town
  const winPath = arched ? archPath : lancetPath;
  const cols = Math.max(2, Math.min(8, Math.round(worldW / 3)));
  const rows = Math.max(3, Math.min(12, Math.round(worldH / 4.5)));
  const gw = cw / cols, gh = ch / rows;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!arched && rand() < 0.14) continue;        // blank bays break the town grid
    const ww = gw * (arched ? 0.4 : 0.3), wh = gh * 0.6;
    const x = c * gw + (gw - ww) / 2, y = r * gh + gh * 0.16;
    b.fillStyle = 'rgba(0,0,0,0.68)';              // recessed jamb shadow
    winPath(b, x - ww * 0.14, y - wh * 0.06, ww * 1.28, wh * 1.12); b.fill();
    b.fillStyle = '#05050a';                       // dark glass
    winPath(b, x, y, ww, wh); b.fill();
    b.fillStyle = 'rgba(190,200,235,0.13)';        // moonlit stone sill
    b.fillRect(x - ww * 0.22, y + wh * 1.06, ww * 1.44, 2.5);
    b.fillStyle = 'rgba(190,200,235,0.1)';         // moon catching the right jamb
    b.fillRect(x + ww * 1.16, y + wh * 0.1, 1.8, wh * 0.9);
    if (rand() < 0.44) {
      const candle = rand() < 0.85;
      g.fillStyle = candle
        ? `rgba(232,176,106,${0.45 + rand() * 0.55})`
        : `rgba(240,230,214,${0.3 + rand() * 0.3})`;
      winPath(g, x + ww * 0.12, y + wh * 0.08, ww * 0.76, wh * 0.84); g.fill();
      // light spilling onto the stone beneath the window
      const spill = g.createRadialGradient(x + ww / 2, y + wh, 0, x + ww / 2, y + wh, wh * 0.9);
      spill.addColorStop(0, `rgba(232,176,106,${candle ? 0.12 : 0.07})`);
      spill.addColorStop(1, 'rgba(232,176,106,0)');
      g.fillStyle = spill;
      g.fillRect(x - ww, y + wh * 0.6, ww * 3, wh * 1.6);
    }
  }
  const mapTex = new THREE.CanvasTexture(base); mapTex.colorSpace = THREE.SRGBColorSpace;
  const glowTex = new THREE.CanvasTexture(glow); glowTex.colorSpace = THREE.SRGBColorSpace;
  return { mapTex, glowTex };
}

function Buildings() {
  let s = 20260709; // fixed seed: same castle skyline every visit
  const rand = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const slateMat  = new THREE.MeshStandardMaterial({ color: 0x303543, roughness: 0.62, metalness: 0.18 }); // catches a moon glint
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x292c39, roughness: 0.92, metalness: 0.03 });
  const capMat    = new THREE.MeshStandardMaterial({ color: 0x252936, roughness: 0.88, metalness: 0.06 });
  const tipTex = radialTexture('rgba(232,186,120,0.9)', 'rgba(232,176,106,0)', 64);
  const merlonSpots = []; // gathered per keep, built as one InstancedMesh at the end

  const litStone = (w, h, arched = false) => {
    const { mapTex, glowTex } = stoneTextures(w, h, rand, arched);
    const mat = new THREE.MeshStandardMaterial({
      map: mapTex, roughness: 0.9, metalness: 0.05,
      emissive: 0xffffff, emissiveIntensity: 1.7, emissiveMap: glowTex
    });
    LIT_MATS.push(mat);
    return mat;
  };

  const solid = (mesh) => { mesh.castShadow = mesh.receiveShadow = true; return mesh; };

  // merlon-gap battlement rhythm around a parapet edge
  function crenellate(px, pz, w, d, yTop, ry) {
    const cosr = Math.cos(ry), sinr = Math.sin(ry);
    const put = (lx, lz, along) => merlonSpots.push({
      x: px + lx * cosr + lz * sinr, y: yTop + 0.42, z: pz - lx * sinr + lz * cosr,
      ry: ry + (along ? 0 : Math.PI / 2)
    });
    const nx = Math.max(2, Math.round(w / 2.1));
    for (let i = 0; i < nx; i += 2) {
      const lx = -w / 2 + (i + 0.5) * (w / nx);
      put(lx, d / 2, true); put(lx, -d / 2, true);
    }
    const nz = Math.max(2, Math.round(d / 2.1));
    for (let i = 0; i < nz; i += 2) {
      const lz = -d / 2 + (i + 0.5) * (d / nz);
      put(w / 2, lz, false); put(-w / 2, lz, false);
    }
  }

  // round stone tower: plinth, banded body, corbelled parapet, slate spire, finial
  function tower(px, pz, r, h) {
    const body = solid(new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.82, r, h, 12), litStone(Math.PI * 2 * r, h)));
    body.position.set(px, h / 2, pz);
    const ph = Math.min(3, h * 0.12); // battered plinth grounds the tower
    const plinth = solid(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.3, ph, 12), darkStone));
    plinth.position.set(px, ph / 2, pz);
    const ring = solid(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 0.88, r * 0.55, 12), darkStone));
    ring.position.set(px, h + r * 0.22, pz); // corbelled parapet
    scene.add(body, plinth, ring);
    COLLIDERS.push({ kind: 'cyl', x: px, z: pz, r: r * 1.12, y0: 0, y1: h + r * 0.5 });
    if (rand() < 0.35) {
      // open battlemented crown — a landing deck instead of a spire
      const deck = solid(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.25, 12), capMat));
      deck.position.set(px, h + r * 0.45, pz);
      scene.add(deck);
      const n = Math.max(6, Math.round(r * 4));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        merlonSpots.push({
          x: px + Math.cos(a) * r * 1.02, y: h + r * 0.45 + 0.42, z: pz + Math.sin(a) * r * 1.02,
          ry: -a - Math.PI / 2
        });
      }
    } else {
      const sh = h * (0.3 + rand() * 0.25) + r * 2;
      const spire = solid(new THREE.Mesh(new THREE.ConeGeometry(r * 1.16, sh, 12), slateMat));
      spire.position.set(px, h + r * 0.45 + sh / 2, pz);
      const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, r * 1.2, 6), capMat);
      finial.position.set(px, h + r * 0.45 + sh + r * 0.6, pz);
      scene.add(spire, finial);
      COLLIDERS.push({ kind: 'cyl', x: px, z: pz, r: r * 0.75, y0: h + r * 0.5, y1: h + r * 0.45 + sh * 0.85 });
      if (rand() < 0.5) { // warm lantern on the finial tip
        const tip = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tipTex, color: AMBER, transparent: true, opacity: 0.22,
          blending: THREE.AdditiveBlending, depthWrite: false }));
        tip.position.set(px, h + r * 0.45 + sh + r * 1.2 + 0.3, pz);
        tip.scale.setScalar(1.6);
        scene.add(tip);
      }
    }
    return h;
  }

  // square keep: plinth + cap. kind = 'grand' (stepped crown, buttresses, great-court
  // windows), 'wing' (flat parapet + ground cloister arcade), 'house' (roofs, doors)
  function keep(px, pz, w, d, h, ry, kind = 'house') {
    const cosr = Math.cos(ry), sinr = Math.sin(ry);
    const side = litStone(Math.max(w, d), h, kind !== 'house');
    const box = solid(new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d), [side, side, capMat, capMat, side, side]));
    box.position.set(px, h / 2, pz);
    box.rotation.y = ry;
    const cap = solid(new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, 1.1, d * 1.1), darkStone));
    cap.position.set(px, h + 0.55, pz);
    cap.rotation.y = ry;
    const plinth = solid(new THREE.Mesh(new THREE.BoxGeometry(w * 1.14, 1.4, d * 1.14), darkStone));
    plinth.position.set(px, 0.7, pz);
    plinth.rotation.y = ry;
    scene.add(box, cap, plinth);
    if (kind !== 'grand') { // the grand keep's walls are registered by GreatHall(), leaving the doorway open
      COLLIDERS.push({ kind: 'box', x: px, z: pz, hw: w * 0.55 + 0.2, hd: d * 0.55 + 0.2, y0: 0, y1: h + 2, cos: cosr, sin: sinr });
    }
    // string courses and corner quoins give the walls masonry relief
    if (h > 10) for (const fy of [0.4, 0.72]) {
      const band = solid(new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.32, d + 0.3), darkStone));
      band.position.set(px, h * fy, pz);
      band.rotation.y = ry;
      scene.add(band);
    }
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const lx = sx * w / 2, lz = sz * d / 2;
      const quoin = solid(new THREE.Mesh(new THREE.BoxGeometry(0.55, h * 0.94, 0.55), capMat));
      quoin.position.set(px + lx * cosr + lz * sinr, h * 0.47, pz - lx * sinr + lz * cosr);
      quoin.rotation.y = ry;
      scene.add(quoin);
    }
    // a street-level door so the houses read inhabited
    if (kind === 'house' && rand() < 0.55) {
      const dlx = (rand() - 0.5) * w * 0.4;
      const doorG = new THREE.Group();
      doorG.position.set(px + dlx * cosr + (d / 2) * sinr, 0, pz - dlx * sinr + (d / 2) * cosr);
      doorG.rotation.y = ry;
      const recess = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.5),
        new THREE.MeshBasicMaterial({ color: 0x05050a }));
      recess.position.set(0, 2.65, 0.06);
      doorG.add(recess);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.35, 0.35), capMat);
      lintel.position.set(0, 4.05, 0.1);
      doorG.add(lintel);
      for (const jx of [-0.95, 0.95]) {
        const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.7, 0.3), capMat);
        jamb.position.set(jx, 2.75, 0.08);
        doorG.add(jamb);
      }
      if (rand() < 0.5) { // door lantern
        const lam = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tipTex, color: AMBER, transparent: true, opacity: 0.3,
          blending: THREE.AdditiveBlending, depthWrite: false }));
        lam.position.set(1.45, 3.5, 0.4);
        lam.scale.setScalar(1.4);
        doorG.add(lam);
      }
      scene.add(doorG);
    }
    let roofed = false;
    if (kind === 'grand') {
      // stepped flat crown — the Forgan Smith tower silhouette
      const c1 = solid(new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, 2.6, d * 0.8), darkStone));
      c1.position.set(px, h + 1.1 + 1.3, pz);
      c1.rotation.y = ry;
      const c2 = solid(new THREE.Mesh(new THREE.BoxGeometry(w * 0.56, 2.4, d * 0.54), capMat));
      c2.position.set(px, h + 1.1 + 2.6 + 1.2, pz);
      c2.rotation.y = ry;
      scene.add(c1, c2);
      COLLIDERS.push({ kind: 'box', x: px, z: pz, hw: w * 0.42, hd: d * 0.42, y0: h + 1, y1: h + 6.4, cos: cosr, sin: sinr });
      // stepped buttresses give the long walls real relief
      const bh = h * 0.62;
      const nb = Math.max(2, Math.round(w / 7));
      for (let i = 0; i < nb; i++) {
        const lx = -w / 2 + (i + 0.5) * (w / nb);
        for (const sz of [1, -1]) {
          const lz = sz * (d / 2 + 0.45);
          const bt = solid(new THREE.Mesh(new THREE.BoxGeometry(1.3, bh, 1.1), darkStone));
          bt.position.set(px + lx * cosr + lz * sinr, bh / 2, pz - lx * sinr + lz * cosr);
          bt.rotation.y = ry;
          scene.add(bt);
          COLLIDERS.push({ kind: 'box', x: bt.position.x, z: bt.position.z, hw: 0.75, hd: 0.65, y0: 0, y1: bh, cos: cosr, sin: sinr });
        }
      }
    } else if (kind === 'wing') {
      // ground-floor cloister arcade along the court face
      const aG = new THREE.Group();
      aG.position.set(px + (d / 2) * sinr, 0, pz + (d / 2) * cosr);
      aG.rotation.y = ry;
      const aw = w - 2;
      const recess = new THREE.Mesh(new THREE.PlaneGeometry(aw, 4.2),
        new THREE.MeshBasicMaterial({ color: 0x060509 }));
      recess.position.set(0, 1.4 + 2.1, 0.03);
      aG.add(recess);
      const nA = Math.max(3, Math.floor(aw / 2.6));
      for (let i = 0; i <= nA; i++) {
        const cx = -aw / 2 + i * (aw / nA);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 3.5, 8), capMat);
        col.castShadow = true;
        col.position.set(cx, 1.4 + 1.75, 0.55);
        aG.add(col);
      }
      for (let i = 0; i < nA; i++) {
        const cx = -aw / 2 + (i + 0.5) * (aw / nA);
        const arch = new THREE.Mesh(new THREE.TorusGeometry(aw / nA / 2, 0.13, 8, 20, Math.PI), capMat);
        arch.position.set(cx, 1.4 + 3.5, 0.55);
        aG.add(arch);
      }
      const architrave = solid(new THREE.Mesh(new THREE.BoxGeometry(aw + 0.8, 0.5, 1.0), darkStone));
      architrave.position.set(0, 1.4 + 4.75, 0.3);
      aG.add(architrave);
      for (let i = 0; i < 3; i++) { // cloister lamps silhouette the columns at night
        const lam = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tipTex, color: AMBER, transparent: true, opacity: 0.32,
          blending: THREE.AdditiveBlending, depthWrite: false }));
        lam.position.set(-aw / 2 + (i + 0.5) * (aw / 3), 1.4 + 2.3, 0.22);
        lam.scale.setScalar(1.6);
        aG.add(lam);
      }
      scene.add(aG);
    } else if (rand() < 0.6) {
      roofed = true;
      // gabled slate roof with eaves overhang and a ridge cap, in place of the old tent cone
      const along = w >= d;                 // ridge runs down the longer axis
      const span = along ? d : w;
      const len = (along ? w : d) * 1.08;
      const R = span * 0.66;                // triangle circumradius: ~14% eaves, steep pitch
      const roofG = new THREE.Group();
      roofG.position.set(px, h + 1.1 + R * 0.5, pz);
      roofG.rotation.y = ry + (along ? Math.PI / 2 : 0);
      const prism = solid(new THREE.Mesh(new THREE.CylinderGeometry(R, R, len, 3, 1), slateMat));
      prism.rotation.x = -Math.PI / 2;      // lay the prism down, apex up
      roofG.add(prism);
      const ridge = solid(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, len * 1.02), capMat));
      ridge.position.y = R + 0.05;
      roofG.add(ridge);
      scene.add(roofG);
      COLLIDERS.push({
        kind: 'box', x: px, z: pz,
        hw: along ? len / 2 : span * 0.62, hd: along ? span * 0.62 : len / 2,
        y0: h + 1.1, y1: h + 1.1 + R * 1.1, cos: cosr, sin: sinr
      });
      const chH = R * 0.9 + 1.7;
      const lx = w * 0.26, lz = d * 0.2;
      const chimney = solid(new THREE.Mesh(new THREE.BoxGeometry(0.9, chH, 0.9), darkStone));
      chimney.position.set(px + lx * cosr + lz * sinr, h + 1.1 + chH / 2, pz - lx * sinr + lz * cosr);
      chimney.rotation.y = ry;
      scene.add(chimney);
    }
    if (kind === 'house' && !roofed) crenellate(px, pz, w * 1.1, d * 1.1, h + 1.1, ry);
    return h;
  }

  // covered stone bridge between two towers
  function bridge(x1, z1, x2, z2, y) {
    const len = Math.hypot(x2 - x1, z2 - z1);
    const b = solid(new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 1.7), darkStone));
    b.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
    const bry = -Math.atan2(z2 - z1, x2 - x1);
    b.rotation.y = bry;
    scene.add(b);
    for (const s of [-0.75, 0.75]) { // parapet rails
      const rail = solid(new THREE.Mesh(new THREE.BoxGeometry(len, 0.35, 0.12), darkStone));
      rail.position.copy(b.position);
      rail.position.y = y + 0.62;
      rail.rotation.y = bry;
      rail.translateZ(s);
      scene.add(rail);
    }
    COLLIDERS.push({
      kind: 'box', x: b.position.x, z: b.position.z, hw: len / 2, hd: 1.1,
      y0: y - 0.65, y1: y + 0.65, cos: Math.cos(bry), sin: Math.sin(bry)
    });
  }

  // the grand academy straight ahead of spawn — a central stepped tower flanked by
  // symmetric cloistered wings, Great Court fashion; spires only on the back skyline
  const cosH = Math.cos(HALL.ry), sinH = Math.sin(HALL.ry);
  const atHall = (lx, lz) => [HALL.x + lx * cosH + lz * sinH, HALL.z - lx * sinH + lz * cosH];
  keep(HALL.x, HALL.z, HALL.w, HALL.d, HALL.h, HALL.ry, 'grand');
  const wingW = 20, wingD = 9, wingH = 13;
  for (const s of [-1, 1]) {
    const [wx, wz] = atHall(s * (HALL.w / 2 + wingW / 2 - 0.8), (HALL.d - wingD) / 2);
    keep(wx, wz, wingW, wingD, wingH, HALL.ry, 'wing');
  }
  for (const [lx, lz, r, th] of [[-15, -13.5, 3.4, 46], [15, -13.5, 3.4, 46], [0, -16, 4.2, 56]]) {
    const [tx, tz] = atHall(lx, lz);
    tower(tx, tz, r, th);
  }

  // tower clusters ringing the court, some joined by bridges
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2 + rand() * 0.6;
    const cr = 46 + rand() * 110;
    const cx = Math.cos(ang) * cr, cz = Math.sin(ang) * cr;
    if (Math.hypot(cx + 10, cz + 80) < 42) continue; // don't crowd the castle
    const n = 2 + Math.floor(rand() * 3);
    let prev = null;
    for (let k = 0; k < n; k++) {
      const px = cx + (rand() - 0.5) * 15, pz = cz + (rand() - 0.5) * 15;
      if (Math.hypot(px, pz) < 38) continue;        // keep the rune court clear
      if (EXPLORABLES.some(b => Math.hypot(px - b.x, pz - b.z) < 20)) continue;
      if (rand() < 0.28) {
        // houses front the court instead of facing random directions
        const face = Math.atan2(-px, -pz) + (rand() - 0.5) * 0.3;
        keep(px, pz, 6.5 + rand() * 6, 5.5 + rand() * 5, 10 + rand() * 13, face);
        prev = null;
      } else {
        const r = 1.8 + rand() * 2.1;
        const h = tower(px, pz, r, 18 + Math.pow(rand(), 1.5) * 46);
        if (prev) {
          const dd = Math.hypot(px - prev.x, pz - prev.z);
          if (dd > 5 && dd < 16 && rand() < 0.75)
            bridge(prev.x, prev.z, px, pz, Math.min(prev.h, h) * (0.45 + rand() * 0.2));
        }
        prev = { x: px, z: pz, h };
      }
    }
  }

  // all battlement merlons in one instanced draw call
  if (merlonSpots.length) {
    const inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.15, 0.85, 0.6), darkStone, merlonSpots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    const e = new THREE.Euler(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    merlonSpots.forEach((mr, i) => {
      e.set(0, mr.ry, 0);
      q.setFromEuler(e);
      pos.set(mr.x, mr.y, mr.z);
      m4.compose(pos, q, one);
      inst.setMatrixAt(i, m4);
    });
    inst.castShadow = inst.receiveShadow = true;
    scene.add(inst);
  }
}

/* ================= GreatHall (inside the grand keep) ================= */
// A candlelit gothic hall: enter through the arched door on the courtyard side.
// Registers its own wall colliders so the doorway stays open.
function GreatHall() {
  const { x: KX, z: KZ, w: KW, d: KD, h: KH, ry } = HALL;
  const cosr = Math.cos(ry), sinr = Math.sin(ry);
  const FLOOR = 1.4;                 // plinth top
  const W = KW - 2, D = KD - 2, H = 14;
  const CEIL = FLOOR + H;

  const grp = new THREE.Group();
  grp.position.set(KX, 0, KZ);
  grp.rotation.y = ry;
  scene.add(grp);

  // colliders take local hall coords and store world space
  const addBox = (lx, lz, hw, hd, y0, y1) => COLLIDERS.push({
    kind: 'box', x: KX + lx * cosr + lz * sinr, z: KZ - lx * sinr + lz * cosr,
    hw, hd, y0, y1, cos: cosr, sin: sinr
  });
  const addCyl = (lx, lz, r, y0, y1) => COLLIDERS.push({
    kind: 'cyl', x: KX + lx * cosr + lz * sinr, z: KZ - lx * sinr + lz * cosr, r, y0, y1
  });

  /* --- materials --- */
  const wood     = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.8, metalness: 0.05 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x2b1d12, roughness: 0.85, metalness: 0.05 });
  const colStone = new THREE.MeshStandardMaterial({ color: 0x37344a, roughness: 0.85, metalness: 0.06 });
  const iron     = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.5, metalness: 0.6 });
  const wallMat = (repX, repY) => {
    const tex = interiorStoneTexture();
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repX, repY);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.04 });
  };
  const add = (mesh, lx, ly, lz, rotY = 0) => {
    mesh.position.set(lx, ly, lz);
    if (rotY) mesh.rotation.y = rotY;
    mesh.receiveShadow = true;
    grp.add(mesh);
    return mesh;
  };

  /* --- shell: floor, ceiling, walls (inward faces) --- */
  const floorTex = floorTileTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(5, 3.4);
  const hallFloor = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, metalness: 0.15 }));
  hallFloor.rotation.x = -Math.PI / 2;
  add(hallFloor, 0, FLOOR + 0.012, 0);

  const ceilTex = ceilingWoodTexture();
  ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.repeat.set(6, 4);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.9, metalness: 0.03 }));
  ceil.rotation.x = Math.PI / 2;
  add(ceil, 0, CEIL, 0);
  for (const bx of [-6, 0, 6]) add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, D), darkWood), bx, CEIL - 0.28, 0);

  add(new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat(6, 3)), 0, FLOOR + H / 2, -D / 2);            // back
  add(new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat(4, 3)), -W / 2, FLOOR + H / 2, 0, Math.PI / 2); // west
  add(new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat(4, 3)), W / 2, FLOOR + H / 2, 0, -Math.PI / 2); // east
  const segW = (W - 4.6) / 2; // front wall, split around the doorway
  add(new THREE.Mesh(new THREE.PlaneGeometry(segW, H), wallMat(2.5, 3)), -(4.6 + segW) / 2, FLOOR + H / 2, D / 2, Math.PI);
  add(new THREE.Mesh(new THREE.PlaneGeometry(segW, H), wallMat(2.5, 3)), (4.6 + segW) / 2, FLOOR + H / 2, D / 2, Math.PI);
  add(new THREE.Mesh(new THREE.PlaneGeometry(5, H - 7), wallMat(1.4, 1.4)), 0, FLOOR + 7 + (H - 7) / 2, D / 2, Math.PI);

  // wall colliders — the front leaves a 4.6-wide doorway under the lintel
  addBox(0, -(D / 2 + 0.5), KW / 2 + 0.2, 0.55, 0, CEIL);
  addBox(-(W / 2 + 0.5), 0, 0.55, KD / 2 + 0.2, 0, CEIL);
  addBox(W / 2 + 0.5, 0, 0.55, KD / 2 + 0.2, 0, CEIL);
  addBox(-(4.6 + segW) / 2, D / 2 + 0.5, segW / 2, 0.55, 0, CEIL);
  addBox((4.6 + segW) / 2, D / 2 + 0.5, segW / 2, 0.55, 0, CEIL);
  addBox(0, D / 2 + 0.5, 2.5, 0.55, FLOOR + 6.7, CEIL);   // lintel
  addBox(0, 0, KW / 2 + 1.4, KD / 2 + 0.6, CEIL, KH + 2.2); // solid keep above the hall

  /* --- columns with bases and capitals --- */
  const flames = [];
  const flameTex = radialTexture('rgba(255,214,140,1)', 'rgba(255,140,40,0)', 64);
  const haloTex = radialTexture('rgba(232,176,106,0.65)', 'rgba(232,176,106,0)', 128);
  const flame = (lx, ly, lz, s = 1) => {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flameTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    f.position.set(lx, ly, lz);
    f.scale.set(0.16 * s, 0.26 * s, 1);
    f.userData = { ph: Math.random() * Math.PI * 2, s };
    grp.add(f); flames.push(f);
    return f;
  };

  for (const cx of [-5.5, 5.5]) for (const cz of [-4.5, 0, 4.5]) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.56, H - 1.2, 10), colStone);
    shaft.castShadow = true;
    add(shaft, cx, FLOOR + (H - 1.2) / 2 + 0.3, cz);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.6, 1.35), colStone), cx, FLOOR + 0.3, cz);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 1.2), colStone), cx, CEIL - 0.6, cz);
    addCyl(cx, cz, 0.85, 0, CEIL);
    // sconce on the aisle side
    const sx = cx - Math.sign(cx) * 0.62;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.3, 0.16), iron), sx, FLOOR + 3.1, cz);
    flame(sx, FLOOR + 3.42, cz, 1.15);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.set(sx, FLOOR + 3.5, cz);
    halo.scale.setScalar(2.2);
    grp.add(halo);
  }

  /* --- long tables, benches, candelabra --- */
  for (const tx of [-3.1, 3.1]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 11), wood);
    top.castShadow = true;
    add(top, tx, FLOOR + 0.82, 0);
    for (const tz of [-4.6, 4.6]) add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.76, 0.16), darkWood), tx, FLOOR + 0.38, tz);
    addBox(tx, 0, 0.9, 5.6, FLOOR, FLOOR + 0.95);
    for (const bs of [-1.25, 1.25]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.07, 10.4), darkWood), tx + bs, FLOOR + 0.5, 0);
      addBox(tx + bs, 0, 0.26, 5.3, FLOOR, FLOOR + 0.56);
    }
    for (const cz of [-3.6, 0, 3.6]) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.4, 8), iron), tx, FLOOR + 1.08, cz);
      for (const off of [-0.13, 0, 0.13]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.2, 6),
          new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.6, emissive: 0xf0e0c0, emissiveIntensity: 0.35 })),
          tx + off, FLOOR + 1.36, cz);
        flame(tx + off, FLOOR + 1.5, cz, 0.7);
      }
    }
  }

  /* --- chandeliers --- */
  const hallLights = [];
  for (const cz of [-4, 4]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.07, 10, 40), iron);
    ring.rotation.x = -Math.PI / 2;
    add(ring, 0, FLOOR + 9.3, cz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, CEIL - (FLOOR + 9.3), 6), iron),
      0, (CEIL + FLOOR + 9.3) / 2, cz);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const cxk = Math.cos(a) * 1.15, czk = cz + Math.sin(a) * 1.15;
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6),
        new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.6, emissive: 0xf0e0c0, emissiveIntensity: 0.35 })),
        cxk, FLOOR + 9.45, czk);
      flame(cxk, FLOOR + 9.6, czk, 0.8);
    }
    const li = new THREE.PointLight(0xe8b06a, 22, 15, 1.6);
    li.position.set(0, FLOOR + 9.1, cz);
    grp.add(li);
    hallLights.push(li);
    addCyl(0, cz, 1.5, FLOOR + 8.6, FLOOR + 10);
  }

  /* --- fireplace on the back wall --- */
  for (const jx of [-1.85, 1.85]) add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.6, 0.8), colStone), jx, FLOOR + 1.8, -D / 2 + 0.4);
  add(new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 1.0), colStone), 0, FLOOR + 3.8, -D / 2 + 0.5);
  const fireBack = new THREE.Mesh(new THREE.PlaneGeometry(3.3, 3.4),
    new THREE.MeshBasicMaterial({ map: fireBackTexture() }));
  add(fireBack, 0, FLOOR + 1.7, -D / 2 + 0.06);
  flame(0, FLOOR + 1.15, -D / 2 + 0.5, 4.2);
  flame(0.5, FLOOR + 1.0, -D / 2 + 0.55, 2.8);
  flame(-0.45, FLOOR + 0.95, -D / 2 + 0.6, 2.4);
  const emberGlow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.4),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(255,150,60,0.5)', 'rgba(255,120,40,0)'),
      transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }));
  emberGlow.rotation.x = -Math.PI / 2;
  add(emberGlow, 0, FLOOR + 0.04, -D / 2 + 1.5);
  const fireLight = new THREE.PointLight(0xff9a3d, 24, 15, 1.7);
  fireLight.position.set(0, FLOOR + 2, -D / 2 + 1.2);
  grp.add(fireLight);
  addBox(0, -(D / 2) + 0.5, 2.5, 0.85, 0, FLOOR + 4.1);

  /* --- banners and moonlit windows on the side walls --- */
  let bi = 0;
  const bannerAt = (lx, lz, rotY) => {
    const tex = bannerTexture(bi++ % 2 ? '#5a1420' : '#1a2440');
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, side: THREE.DoubleSide }));
    add(b, lx, FLOOR + 8.2, lz, rotY);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.9, 6), iron);
    rod.rotation.z = Math.PI / 2;
    add(rod, lx, FLOOR + 10.25, lz, rotY);
  };
  for (const zb of [-3.5, 0, 3.5]) {
    bannerAt(-W / 2 + 0.1, zb, Math.PI / 2);
    bannerAt(W / 2 - 0.1, zb, -Math.PI / 2);
  }
  bannerAt(-4.5, -D / 2 + 0.1, 0);
  bannerAt(4.5, -D / 2 + 0.1, 0);

  const paneTex = windowPaneTexture();
  for (const zw of [-5.6, -1.8, 1.8, 5.6]) {
    for (const sideX of [-1, 1]) {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 4.6),
        new THREE.MeshBasicMaterial({ map: paneTex, transparent: true,
          opacity: sideX > 0 ? 0.95 : 0.55, depthWrite: false }));
      add(pane, sideX * (W / 2 - 0.08), FLOOR + 9.6, zw, sideX > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    // moonlight falls in from the east (moon side) windows
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 8.2),
      new THREE.MeshBasicMaterial({ color: 0x9db1e0, transparent: true, opacity: 0.05,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
    shaft.rotation.set(0, -Math.PI / 2, 0.62);
    add(shaft, W / 2 - 2.1, FLOOR + 6.4, zw);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 4.4),
      new THREE.MeshBasicMaterial({ map: radialTexture('rgba(157,177,224,0.5)', 'rgba(157,177,224,0)'),
        transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2;
    add(pool, W / 2 - 4.4, FLOOR + 0.03, zw);
  }

  /* --- carpet down the aisle --- */
  const carpTex = carpetTexture();
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 13),
    new THREE.MeshStandardMaterial({ map: carpTex, roughness: 0.95, metalness: 0 }));
  carpet.rotation.x = -Math.PI / 2;
  add(carpet, 0, FLOOR + 0.025, 0.4);

  /* --- doorway: stone arch, open oak doors, steps, spilling light --- */
  add(new THREE.Mesh(new THREE.PlaneGeometry(8, 10.6),
    new THREE.MeshStandardMaterial({ color: 0x14141d, roughness: 0.9 })), 0, 5.3, KD / 2 + 0.02);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.45, 10, 28, Math.PI), colStone);
  add(arch, 0, FLOOR + 7, KD / 2 + 0.14);
  for (const jx of [-2.55, 2.55]) add(new THREE.Mesh(new THREE.BoxGeometry(0.55, FLOOR + 7, 0.7), colStone), jx, (FLOOR + 7) / 2, KD / 2 + 0.08);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.5), colStone), 0, FLOOR + 9.6, KD / 2 + 0.14);
  const doorTex = doorWoodTexture();
  for (const sd of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(sd * 2.3, FLOOR + 3.3, KD / 2 + 0.25);
    hinge.rotation.y = sd * 2.35; // swung open against the facade
    const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 6.6, 0.14),
      new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.8, metalness: 0.1 }));
    panel.position.x = -sd * 1.1;
    panel.castShadow = true;
    hinge.add(panel);
    grp.add(hinge);
  }
  const stepMat = wallMat(3, 0.4);
  const stepDims = [[6.4, 1.15, 9.7], [6.9, 0.8, 10.85], [7.4, 0.45, 12.0]];
  for (const [sw, shh, szz] of stepDims) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(sw, shh, 1.2), stepMat);
    st.castShadow = true;
    add(st, 0, shh / 2, szz);
    addBox(0, szz, sw / 2, 0.62, 0, shh);
  }
  const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(8, 5),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(232,176,106,0.5)', 'rgba(232,176,106,0)'),
      transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }));
  doorGlow.rotation.x = -Math.PI / 2;
  add(doorGlow, 0, 0.03, KD / 2 + 3.4);
  const doorway = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 6.6),
    new THREE.MeshBasicMaterial({ color: 0xe8b06a, transparent: true, opacity: 0.05,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }));
  add(doorway, 0, FLOOR + 3.4, D / 2 + 0.6);
  const doorLight = new THREE.PointLight(0xe8b06a, 10, 13, 1.8);
  doorLight.position.set(0, 4, KD / 2 + 1.6);
  grp.add(doorLight);

  // low warm base light so the hall never goes black between candles
  const fill = new THREE.PointLight(0xe8b06a, 7, 24, 1.6);
  fill.position.set(0, FLOOR + 8, 0);
  grp.add(fill);

  /* --- residents: cloaked figures living in the hall --- */
  const residents = [];
  const resident = (lx, ly, lz, heading, color, scale = 1) => {
    const fig = CloakedFigure({ cloak: color, plain: true }); // grey-robed brethren
    fig.group.position.set(lx, ly, lz);
    fig.group.rotation.y = heading;
    fig.group.scale.setScalar(scale);
    grp.add(fig.group);
    residents.push(fig);
    addCyl(lx, lz, 0.5, FLOOR, FLOOR + 2.4);
  };
  resident(3.1, FLOOR + 0.01, 5.7, 0, 0x38342d);                   // standing at the head of the east table
  resident(0.8, FLOOR + 0.01, -5.6, 0, 0x332f28);                  // warming by the fire
  resident(9.0, FLOOR + 0.01, 1.8, -Math.PI / 2, 0x2f2b25);        // gazing out a moonlit window

  return {
    update(t, dt, playerPos) {
      const nearInterior = !playerPos || Math.hypot(playerPos.x - KX, playerPos.z - KZ) < 46;
      grp.visible = nearInterior;
      if (!nearInterior) return;
      for (const rzd of residents) rzd.update(t, dt, 0);
      for (const f of flames) {
        const { ph, s } = f.userData;
        f.material.opacity = 0.72 + Math.sin(t * 9 + ph) * 0.14 + Math.sin(t * 23 + ph * 2) * 0.08;
        f.scale.y = 0.26 * s * (1 + Math.sin(t * 11 + ph) * 0.12);
      }
      fireLight.intensity = 22 + Math.sin(t * 7) * 5 + Math.sin(t * 13.7) * 3;
      emberGlow.material.opacity = 0.26 + Math.sin(t * 5.3) * 0.05;
      for (let i = 0; i < hallLights.length; i++) {
        hallLights[i].intensity = 21 + Math.sin(t * 6.1 + i * 2.4) * 1.6;
      }
    }
  };
}

/* ================= Explorable side buildings ================= */
// Two authored interiors turn the castle from scenery into a place.  Their
// walls are assembled in sections so the arched front doors are real openings.
function ExplorableBuildings() {
  const buildings = [];
  let usePressed = false;
  let practiceHits = 0;
  window.addEventListener('keydown', e => { if (e.code === 'KeyE' && !e.repeat) usePressed = true; });
  const W = 11.5, D = 12.5, H = 8.4, DOOR = 3.5;
  const stone = new THREE.MeshStandardMaterial({
    map: interiorStoneTexture(), color: 0xc3c5cd, roughness: 0.94, metalness: 0.02,
    emissive: 0x151923, emissiveIntensity: 0.42
  });
  stone.map.wrapS = stone.map.wrapT = THREE.RepeatWrapping;
  stone.map.repeat.set(2.5, 2.5);
  const trim = new THREE.MeshStandardMaterial({ color: 0x494b5a, roughness: 0.92, metalness: 0.03 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x342116, roughness: 0.9, metalness: 0.02 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.58, metalness: 0.62 });
  const floorMap = floorTileTexture();
  floorMap.wrapS = floorMap.wrapT = THREE.RepeatWrapping;
  floorMap.repeat.set(3.2, 3.5);
  const floorMat = new THREE.MeshStandardMaterial({ map: floorMap, roughness: 0.96, metalness: 0.01 });
  const glowTex = radialTexture('rgba(255,198,112,0.8)', 'rgba(232,150,70,0)', 96);

  const signTexture = title => canvasTex(512, 96, g => {
    g.clearRect(0, 0, 512, 96);
    g.fillStyle = 'rgba(9,7,12,0.92)'; g.fillRect(0, 0, 512, 96);
    g.strokeStyle = 'rgba(191,151,86,0.72)'; g.lineWidth = 4; g.strokeRect(5, 5, 502, 86);
    g.fillStyle = '#d7bc8a'; g.font = '30px serif'; g.textAlign = 'center';
    g.fillText(title, 256, 60);
  });

  for (const def of EXPLORABLES) {
    const grp = new THREE.Group();
    grp.position.set(def.x, 0, def.z);
    grp.rotation.y = def.ry;
    scene.add(grp);
    const cosr = Math.cos(def.ry), sinr = Math.sin(def.ry);
    const animated = [];
    let addParent = grp;

    const add = (mesh, x, y, z, ry = 0) => {
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      mesh.castShadow = mesh.receiveShadow = true;
      addParent.add(mesh);
      return mesh;
    };
    const addBoxCollider = (lx, lz, hw, hd, y0, y1) => COLLIDERS.push({
      kind: 'box', x: def.x + lx * cosr + lz * sinr, z: def.z - lx * sinr + lz * cosr,
      hw, hd, y0, y1, cos: cosr, sin: sinr
    });

    // Floor, back/side walls, and a front wall split around the open doorway.
    const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat), 0, 0.035, 0);
    floor.rotation.x = -Math.PI / 2;
    add(new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.48), stone), 0, H / 2, -D / 2);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.48, H, D), stone), -W / 2, H / 2, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.48, H, D), stone), W / 2, H / 2, 0);
    const frontW = (W - DOOR) / 2;
    add(new THREE.Mesh(new THREE.BoxGeometry(frontW, H, 0.48), stone), -(DOOR + frontW) / 2, H / 2, D / 2);
    add(new THREE.Mesh(new THREE.BoxGeometry(frontW, H, 0.48), stone), (DOOR + frontW) / 2, H / 2, D / 2);
    add(new THREE.Mesh(new THREE.BoxGeometry(DOOR, H - 5.4, 0.48), stone), 0, 5.4 + (H - 5.4) / 2, D / 2);

    addBoxCollider(0, -D / 2, W / 2, 0.3, 0, H);
    addBoxCollider(-W / 2, 0, 0.3, D / 2, 0, H);
    addBoxCollider(W / 2, 0, 0.3, D / 2, 0, H);
    addBoxCollider(-(DOOR + frontW) / 2, D / 2, frontW / 2, 0.3, 0, H);
    addBoxCollider((DOOR + frontW) / 2, D / 2, frontW / 2, 0.3, 0, H);
    addBoxCollider(0, D / 2, DOOR / 2, 0.3, 5.4, H);

    // Steep slate prism roof; its collider prevents flying through the shell.
    const roofR = 4.4;
    const roof = add(new THREE.Mesh(new THREE.CylinderGeometry(roofR, roofR, W * 1.08, 3),
      new THREE.MeshStandardMaterial({ color: 0x202432, roughness: 0.72, metalness: 0.18 })),
      0, H + roofR * 0.43, 0);
    roof.rotation.z = Math.PI / 2;
    addBoxCollider(0, 0, W / 2 + 0.4, D / 2 + 0.4, H, H + roofR * 1.1);

    // Open arch, name plaque and a warm pool make entry readable from flight.
    add(new THREE.Mesh(new THREE.TorusGeometry(DOOR / 2, 0.25, 8, 30, Math.PI), trim), 0, 5.36, D / 2 + 0.29);
    for (const x of [-DOOR / 2, DOOR / 2])
      add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 3.65, 0.38), trim), x, 1.83, D / 2 + 0.28);
    const sign = add(new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.98),
      new THREE.MeshBasicMaterial({ map: signTexture(def.title), transparent: true })), 0, 7.15, D / 2 + 0.3);
    sign.rotation.y = 0;
    const entryColors = { archive: 0x91a8e8, alchemy: 0xe6a05e, infirmary: 0x9ed7c4, practice: 0xd79a67, owlpost: 0xb6a1df };
    const doorGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: entryColors[def.id] || 0xe6a05e, transparent: true, opacity: 0.32,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    doorGlow.position.set(0, 2.5, D / 2 + 0.9); doorGlow.scale.set(5.2, 5.2, 1); grp.add(doorGlow);

    // A short branch of paving visually connects each doorway to the court.
    const centre = new THREE.Vector3(def.x, 0, def.z);
    const len = Math.max(5, centre.length() - 27);
    const path = new THREE.Mesh(new THREE.PlaneGeometry(3.8, len),
      new THREE.MeshStandardMaterial({ map: causewayTexture(len), roughness: 0.98, metalness: 0 }));
    path.rotation.x = -Math.PI / 2;
    path.rotation.z = Math.atan2(-def.x, -def.z);
    path.position.set(def.x * 0.5 + def.x / centre.length() * 13.5, 0.014,
      def.z * 0.5 + def.z / centre.length() * 13.5);
    path.receiveShadow = true; scene.add(path);

    // Furniture, characters and room lights are activated only near the player.
    const interiorGroup = new THREE.Group();
    grp.add(interiorGroup);
    addParent = interiorGroup;

    if (def.id === 'archive') {
      // Tall shelves, reading desk, floating folios and cool memory light.
      const bookTransforms = [];
      for (const sx of [-1, 1]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.65, 5.4, 8.4), wood), sx * 4.7, 2.72, -0.6);
        addBoxCollider(sx * 4.7, -0.6, 0.42, 4.3, 0, 5.5);
        for (let z = -4; z <= 3; z += 1.05) for (let y = 0.75; y < 4.9; y += 0.82) {
          bookTransforms.push({
            x: sx * 4.32, y, z,
            rz: ((z * 13 + y * 7) % 3) * 0.025,
            color: (Math.floor((z + y) * 10) % 2) ? 0x4a2430 : 0x24344a
          });
        }
      }
      const books = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.18, 0.5, 0.62),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 }),
        bookTransforms.length
      );
      const bookDummy = new THREE.Object3D();
      bookTransforms.forEach((book, i) => {
        bookDummy.position.set(book.x, book.y, book.z);
        bookDummy.rotation.set(0, 0, book.rz);
        bookDummy.updateMatrix();
        books.setMatrixAt(i, bookDummy.matrix);
        books.setColorAt(i, new THREE.Color(book.color));
      });
      books.instanceMatrix.needsUpdate = true;
      if (books.instanceColor) books.instanceColor.needsUpdate = true;
      books.castShadow = false;
      interiorGroup.add(books);
      add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.18, 1.7), wood), 0, 1.0, -2.4);
      addBoxCollider(0, -2.4, 1.7, 0.95, 0, 1.2);
      for (let i = 0; i < 3; i++) {
        const folio = add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.62),
          new THREE.MeshStandardMaterial({ color: 0x4b3044, roughness: 0.82 })),
          -1.2 + i * 1.2, 2.3 + i * 0.42, -3.8 + i * 0.3);
        animated.push({ obj: folio, phase: i * 2.1, y: folio.position.y, kind: 'float' });
      }
      const orb = new THREE.PointLight(0x819ee8, 13, 12, 1.6); orb.position.set(0, 4.6, -4.5); interiorGroup.add(orb);
      const keeper = CloakedFigure({ cloak: 0x2c3044, lantern: false, plain: true });
      keeper.group.position.set(2.4, 0.04, -3.5); keeper.group.rotation.y = -0.7; interiorGroup.add(keeper.group);
      animated.push({ fig: keeper, phase: 0.8, kind: 'figure' });
    } else if (def.id === 'alchemy') {
      // Work benches, copper cauldrons and softly pulsing potion bottles.
      for (const x of [-3.25, 3.25]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, 7.6), wood), x, 1.0, -0.45);
        addBoxCollider(x, -0.45, 1.25, 3.9, 0, 1.2);
        for (let i = 0; i < 6; i++) {
          const hue = i % 2 ? 0x6fa67d : 0x8b6fac;
          const bottle = add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 0.5, 8),
            new THREE.MeshStandardMaterial({ color: hue, emissive: hue, emissiveIntensity: 0.8, roughness: 0.35 })),
            x + (i % 2 ? 0.45 : -0.45), 1.35, -3 + i * 1.05);
          animated.push({ obj: bottle, phase: i + x, y: bottle.position.y, kind: 'potion' });
        }
      }
      for (const z of [-3.6, 1.8]) {
        add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), iron), 0, 0.7, z);
        add(new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.07, 8, 24), iron), 0, 1.08, z).rotation.x = Math.PI / 2;
        addBoxCollider(0, z, 0.9, 0.9, 0, 1.3);
        const brew = new THREE.PointLight(0x76d29a, 8, 8, 1.8); brew.position.set(0, 1.3, z); interiorGroup.add(brew);
        animated.push({ obj: brew, phase: z, kind: 'light' });
      }
      const alchemist = CloakedFigure({ cloak: 0x34302a, lantern: true, plain: true, lanternColor: 0x80d69c });
      alchemist.group.position.set(1.3, 0.04, -3.3); alchemist.group.rotation.y = 0.9; interiorGroup.add(alchemist.group);
      animated.push({ fig: alchemist, phase: 2.4, kind: 'figure' });
    } else if (def.id === 'infirmary') {
      // Four usable-looking beds and a healer make this the safe recovery room.
      const linen = new THREE.MeshStandardMaterial({ color: 0xb9bdc5, roughness: 0.95 });
      const blanket = new THREE.MeshStandardMaterial({ color: 0x526b69, roughness: 0.98 });
      for (const x of [-3.25, 3.25]) for (const z of [-3.25, 1.5]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.28, 3.35), wood), x, 0.48, z);
        add(new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.22, 2.95), linen), x, 0.72, z);
        add(new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.09, 1.7), blanket), x, 0.86, z - 0.55);
        add(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 0.55), linen), x, 0.92, z + 1.05);
        addBoxCollider(x, z, 1.2, 1.78, 0, 1.0);
      }
      const healPool = add(new THREE.Mesh(new THREE.CircleGeometry(1.65, 40),
        new THREE.MeshBasicMaterial({ color: 0x79cbb1, transparent: true, opacity: 0.24,
          blending: THREE.AdditiveBlending, depthWrite: false })), 0, 0.08, -4.35);
      healPool.rotation.x = -Math.PI / 2;
      animated.push({ obj: healPool, phase: 0, kind: 'healpool' });
      const healingLight = new THREE.PointLight(0x83d8bc, 11, 11, 1.6);
      healingLight.position.set(0, 2.1, -4.2); interiorGroup.add(healingLight);
      animated.push({ obj: healingLight, phase: 0.6, kind: 'light' });
      const healer = CloakedFigure({ cloak: 0x465b58, lantern: true, plain: true, lanternColor: 0x8be0c1 });
      healer.group.position.set(0, 0.04, -2.7); healer.group.rotation.y = Math.PI; interiorGroup.add(healer.group);
      animated.push({ fig: healer, phase: 1.5, kind: 'figure' });
    } else if (def.id === 'practice') {
      // Weapon-reactive targets: bolts are checked against SPELL_TARGETS below.
      const targetMat = new THREE.MeshStandardMaterial({ color: 0x6e2227, roughness: 0.82, emissive: 0xe8b06a, emissiveIntensity: 0 });
      for (let i = 0; i < 3; i++) {
        const x = (i - 1) * 3.1, z = -3.65 + Math.abs(i - 1) * 0.7;
        const dummy = new THREE.Group(); dummy.position.set(x, 0, z); interiorGroup.add(dummy);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 2.8, 8), wood); post.position.y = 1.4; dummy.add(post);
        const disc = new THREE.Mesh(new THREE.CircleGeometry(0.78, 28), targetMat.clone()); disc.position.set(0, 2.25, 0.08); dummy.add(disc);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.08, 8, 28), iron); rim.position.set(0, 2.25, 0.1); dummy.add(rim);
        const cross = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 0.12), wood); cross.position.y = 1.65; dummy.add(cross);
        const state = { obj: dummy, disc, phase: i * 1.4, kind: 'target', pulse: 0 };
        animated.push(state);
        const world = new THREE.Vector3(def.x + x * cosr + z * sinr, 2.25, def.z - x * sinr + z * cosr);
        SPELL_TARGETS.push({
          position: world, radius: 0.9,
          hit() {
            state.pulse = 1;
            practiceHits++;
            if (practiceHits === 1) storyCard(tr('A clean strike.', '一次俐落的命中。'), tr('practice target hit · keep casting', '已命中練習靶 · 繼續施法'));
            else if (practiceHits % 5 === 0) {
              GAME.hp = Math.min(GAME.maxHp, GAME.hp + 8);
              storyCard(tr(`${practiceHits} practice hits`, `練習命中 ${practiceHits} 次`), tr('spell control improved · lantern restored', '法術操控提升 · 提燈已恢復'));
            }
          }
        });
      }
      const tutor = CloakedFigure({ cloak: 0x4a302c, lantern: false, plain: true });
      tutor.group.position.set(4.1, 0.04, 2.4); tutor.group.rotation.y = -2.4; interiorGroup.add(tutor.group);
      animated.push({ fig: tutor, phase: 2.9, kind: 'figure' });
    } else if (def.id === 'owlpost') {
      // Perches and small animated owl silhouettes surround a return portal.
      for (const x of [-4.2, 4.2]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.18, 5.6, 0.18), wood), x, 2.8, -0.8);
        for (const y of [1.4, 3.0, 4.6]) add(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), wood), x, y, -0.8);
      }
      for (let i = 0; i < 6; i++) {
        const owl = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 9),
          new THREE.MeshStandardMaterial({ color: i % 2 ? 0x756b61 : 0x504a46, roughness: 0.92 }));
        body.scale.set(0.8, 1.25, 0.72); owl.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), body.material); head.position.y = 0.28; owl.add(head);
        const side = i % 2 ? 1 : -1;
        owl.position.set(side * 4.2, 1.7 + (i % 3) * 1.6, -0.9);
        interiorGroup.add(owl); animated.push({ obj: owl, phase: i * 1.1, y: owl.position.y, kind: 'owl' });
      }
      const portal = add(new THREE.Mesh(new THREE.RingGeometry(1.15, 1.55, 48),
        new THREE.MeshBasicMaterial({ color: 0x9f8bd2, transparent: true, opacity: 0.6,
          blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })), 0, 0.1, -3.8);
      portal.rotation.x = -Math.PI / 2;
      animated.push({ obj: portal, phase: 0, kind: 'portal' });
      const portalLight = new THREE.PointLight(0xa894df, 12, 12, 1.6); portalLight.position.set(0, 1.8, -3.8); interiorGroup.add(portalLight);
      animated.push({ obj: portalLight, phase: 2.2, kind: 'light' });
      const postKeeper = CloakedFigure({ cloak: 0x383044, lantern: true, plain: true, lanternColor: 0xb3a1e0 });
      postKeeper.group.position.set(2.5, 0.04, -2.7); postKeeper.group.rotation.y = 2.4; interiorGroup.add(postKeeper.group);
      animated.push({ fig: postKeeper, phase: 4.1, kind: 'figure' });
    }

    buildings.push({ def, grp, interiorGroup, animated, visited: false, cosr, sinr });
  }

  return {
    buildings,
    update(t, dt, playerPos) {
      for (const b of buildings) {
        const dx = playerPos.x - b.def.x, dz = playerPos.z - b.def.z;
        const nearInterior = Math.hypot(dx, dz) < 38;
        b.interiorGroup.visible = nearInterior;
        if (nearInterior) for (const a of b.animated) {
          if (a.kind === 'figure') a.fig.update(t + a.phase, dt, 0);
          else if (a.kind === 'float') {
            a.obj.position.y = a.y + Math.sin(t * 1.1 + a.phase) * 0.18;
            a.obj.rotation.y = t * 0.32 + a.phase;
          } else if (a.kind === 'potion') {
            a.obj.position.y = a.y + Math.sin(t * 1.7 + a.phase) * 0.025;
            a.obj.material.emissiveIntensity = 0.55 + Math.sin(t * 2.2 + a.phase) * 0.25;
          } else if (a.kind === 'target') {
            a.pulse *= Math.exp(-dt * 7);
            a.obj.rotation.z = Math.sin(t * 0.7 + a.phase) * 0.015 + a.pulse * 0.18;
            a.disc.material.emissiveIntensity = a.pulse * 2.8;
            a.obj.scale.setScalar(1 + a.pulse * 0.08);
          } else if (a.kind === 'owl') {
            a.obj.position.y = a.y + Math.sin(t * 1.4 + a.phase) * 0.035;
            a.obj.rotation.y = Math.sin(t * 0.55 + a.phase) * 0.28;
          } else if (a.kind === 'portal') {
            a.obj.rotation.z = t * 0.35;
            a.obj.material.opacity = 0.48 + Math.sin(t * 2.1) * 0.14;
          } else if (a.kind === 'healpool') {
            a.obj.scale.setScalar(1 + Math.sin(t * 1.8) * 0.04);
            a.obj.material.opacity = 0.2 + Math.sin(t * 2.4) * 0.06;
          } else if (a.kind === 'light') a.obj.intensity = 7 + Math.sin(t * 3 + a.phase) * 2;
        }
        const lx = dx * b.cosr - dz * b.sinr;
        const lz = dx * b.sinr + dz * b.cosr;
        const inside = Math.abs(lx) < W / 2 - 0.5 && Math.abs(lz) < D / 2 - 0.5 && playerPos.y < H;
        if (inside && b.def.id === 'infirmary' && GAME.hp < GAME.maxHp) {
          GAME.hp = Math.min(GAME.maxHp, GAME.hp + dt * 14);
        }
        const atPortal = inside && Math.hypot(lx, lz + 3.8) < 2.1;
        if (atPortal && b.def.id === 'owlpost' && usePressed) {
          playerPos.set(0, FLY_Y, 4.4);
          storyCard(tr('The owls carried you home.', '貓頭鷹將你帶回了家。'), tr('returned to the rune court', '已返回符文庭院'));
        }
        if (!b.visited && inside) {
          b.visited = true;
          GAME.hp = Math.min(GAME.maxHp, GAME.hp + 18);
          const messages = {
            archive: [tr('The Moon Archive remembers your name.', '月之檔案館仍記得你的名字。'), tr('secret room discovered · lantern restored', '發現秘密房間 · 提燈已恢復')],
            alchemy: [tr('The old workshop is still brewing.', '古老工坊仍在調製藥劑。'), tr('secret room discovered · lantern restored', '發現秘密房間 · 提燈已恢復')],
            infirmary: [tr('The infirmary light steadies your flame.', '醫務室的光穩住了你的火焰。'), tr('remain inside to restore lantern health', '留在室內可恢復提燈能量')],
            practice: [tr('The practice hall is listening.', '練習廳正在傾聽。'), tr('cast at the three targets to train', '對三個靶施法進行訓練')],
            owlpost: [tr('A return route opens beneath the owls.', '貓頭鷹下方開啟了返程。'), tr('press E inside the portal to return to the rune', '在傳送門內按 E 返回符文庭院')]
          };
          const msg = messages[b.def.id];
          if (msg) storyCard(msg[0], msg[1]);
        }
      }
      usePressed = false;
    }
  };
}

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
function ResidentCharacter(profile) {
  const appearance = profile.appearance;
  const carriesLantern = appearance.lantern ??
    ['warden', 'courier', 'healer', 'keeper', 'dreamer'].includes(profile.archetype);
  const lanternColor = colorNumber(appearance.lanternColor, 0xffb464);
  const fig = CloakedFigure({
    cloak: colorNumber(appearance.cloak, 0x302b3d),
    accent: colorNumber(appearance.accent, 0xb08a46),
    cloakWidth: appearance.width || 1,
    hoodStyle: appearance.hood || 'soft',
    lantern: carriesLantern,
    plain: true,
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
        } else {
          n.root.position.copy(n.home);
          n.root.rotation.z = Math.sin(t * 0.42 + n.phase) * 0.012;
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

// the traveler you play: rises off the rune, banks and leans in flight
function PlayerAvatar() {
  const fig = CloakedFigure({ lantern: true, cloak: 0x2c1f42 }); // dusk-violet traveler
  const g = fig.group;
  g.position.set(0, 0.04, 0); // standing on the rune
  scene.add(g);
  let heading = 0, lean = 0, roll = 0;
  return {
    group: g,
    flare() { fig.flare(); },
    update(t, dt, state, pos, yaw, vel, liftE) {
      const speed = state === 'flying' ? Math.min(1, vel.length() / FLY_SPEED) : (state === 'lifting' ? 0.45 : 0);
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
      fig.update(t, dt, speed);
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
  weapon: 1            // 1 ember bolt · 2 scatter fan · 3 moonbow (drawn shot)
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

// the Unlight: shadow wisps that orbit the spires and dive at the lantern
function Wisps(count = 14) {
  const shroudTex = radialTexture('rgba(10,5,20,0.95)', 'rgba(10,5,20,0)', 128);
  const coreTex = radialTexture('rgba(168,110,255,0.95)', 'rgba(80,30,140,0)', 64);
  const moteTex = radialTexture('rgba(255,214,140,1)', 'rgba(255,170,80,0)', 64);
  let s = 777123;
  const wr = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const _v = new THREE.Vector3();
  const list = [];
  for (let i = 0; i < count; i++) {
    const g = new THREE.Group();
    const shroud = new THREE.Sprite(new THREE.SpriteMaterial({
      map: shroudTex, transparent: true, opacity: 0.78, depthWrite: false }));
    shroud.scale.setScalar(2.6);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    core.scale.setScalar(1.1);
    g.add(shroud, core);
    g.visible = false;
    scene.add(g);
    list.push({
      g, shroud, core, ph: wr() * Math.PI * 2,
      home: new THREE.Vector3(), state: 'off', tState: 0, cool: 0,
      dir: new THREE.Vector3()
    });
  }
  const flashes = [], motes = [];
  function rehome(w) {
    const a = wr() * Math.PI * 2, r = 36 + wr() * 100;
    w.home.set(Math.cos(a) * r, 9 + wr() * 30, Math.sin(a) * r);
  }
  function sparkAt(p, dropMote) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTex, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    f.position.copy(p);
    scene.add(f);
    flashes.push({ f, t: 0 });
    if (dropMote) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({
        map: moteTex, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false }));
      m.position.copy(p);
      m.scale.setScalar(0.55);
      scene.add(m);
      motes.push({ m, t: 0 });
    }
  }
  function spawn(w) {
    rehome(w);
    w.g.position.copy(w.home);
    w.state = 'drift';
    w.cool = 1;
    w.g.visible = true;
  }
  return {
    activate() {
      list.forEach((w, i) => {
        if (i < 8) spawn(w);
        else { w.state = 'off'; w.tState = 2 + wr() * 8; }
      });
    },
    calmAll() { for (const w of list) if (w.state !== 'off') { w.state = 'retreat'; w.cool = 3; } },
    dissolveAll() {
      for (const w of list) if (w.state !== 'off') {
        sparkAt(w.g.position, true);
        w.state = 'off'; w.tState = 1e9; w.g.visible = false;
      }
    },
    tryHit(p, r) {
      for (const w of list) {
        if (w.state === 'off') continue;
        if (w.g.position.distanceTo(p) < r) {
          sparkAt(w.g.position, true);
          w.state = 'off'; w.tState = 6; w.g.visible = false;
          return true;
        }
      }
      return false;
    },
    update(t, dt, player, phase, cbs) {
      for (const w of list) {
        if (w.state === 'off') {
          if (phase === 2 && w.tState < 1e8) { w.tState -= dt; if (w.tState <= 0) spawn(w); }
          continue;
        }
        const p = w.g.position;
        w.core.material.opacity = 0.72 + Math.sin(t * 5 + w.ph) * 0.2;
        w.shroud.scale.setScalar(2.6 + Math.sin(t * 3.1 + w.ph) * 0.3);
        w.cool = Math.max(0, w.cool - dt);
        const dP = player ? p.distanceTo(player) : 1e9;
        if (w.state === 'drift') {
          p.x = w.home.x + Math.sin(t * 0.4 + w.ph) * 3.2;
          p.y = w.home.y + Math.sin(t * 0.55 + w.ph * 2) * 1.6;
          p.z = w.home.z + Math.cos(t * 0.34 + w.ph) * 3.2;
          if (phase === 2 && w.cool <= 0 && dP < 30) w.state = 'seek';
        } else if (w.state === 'seek') {
          w.dir.copy(player).sub(p).normalize();
          p.addScaledVector(w.dir, dt * 7.5);
          if (dP < 9) { w.state = 'windup'; w.tState = 0.45; }
          else if (dP > 42) w.state = 'retreat';
        } else if (w.state === 'windup') {
          w.tState -= dt;
          w.core.scale.setScalar(1.1 + (0.45 - w.tState) * 1.5); // coiling to strike
          if (w.tState <= 0) {
            w.dir.copy(player).sub(p).normalize();
            w.state = 'dive'; w.tState = 1.4;
            w.core.scale.setScalar(1.1);
          }
        } else if (w.state === 'dive') {
          w.tState -= dt;
          _v.copy(player).sub(p).normalize();
          w.dir.lerp(_v, dt * 2.4).normalize();
          p.addScaledVector(w.dir, dt * 17);
          if (dP < 1.4) { cbs.hitPlayer(w.dir); w.state = 'retreat'; w.cool = 2.4; }
          else if (w.tState <= 0) { w.state = 'retreat'; w.cool = 1.4; }
        } else if (w.state === 'retreat') {
          _v.copy(w.home).sub(p);
          if (_v.length() < 2) w.state = 'drift';
          else p.addScaledVector(_v.normalize(), dt * 6);
        }
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const fl = flashes[i];
        fl.t += dt;
        fl.f.scale.setScalar(1 + fl.t * 7);
        fl.f.material.opacity = Math.max(0, 1 - fl.t * 2.2);
        if (fl.t > 0.5) { scene.remove(fl.f); flashes.splice(i, 1); }
      }
      for (let i = motes.length - 1; i >= 0; i--) {
        const mo = motes[i];
        mo.t += dt;
        mo.m.position.y += dt * 0.4;
        if (player) {
          const d = mo.m.position.distanceTo(player);
          if (d < 7) mo.m.position.addScaledVector(_v.copy(player).sub(mo.m.position).normalize(), dt * 11);
          if (d < 1.1) { cbs.heal(12); sparkAt(mo.m.position, false); scene.remove(mo.m); motes.splice(i, 1); continue; }
        }
        if (mo.t > 12) { scene.remove(mo.m); motes.splice(i, 1); }
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
    pool.push({ g, core, glow, vel: new THREE.Vector3(), ttl: 0, r: 1.9 });
  }
  const _p = { x: 0, y: 0, z: 0 };
  const _aim = new THREE.Vector3();
  return {
    // opts let each weapon shape its shot: scatter fires small short-lived
    // embers, the moonbow a fast stretched dart with a wider strike radius
    fire(origin, dir, { speed = 42, ttl = 1.6, scale = 1, r = 1.9, stretch = 1, damage = 1 } = {}) {
      const b = pool.find(bb => bb.ttl <= 0);
      if (!b) return false;
      b.g.position.copy(origin);
      b.vel.copy(dir).multiplyScalar(speed);
      b.ttl = ttl;
      b.r = r;
      b.damage = damage;
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
        if (!dead && hitSpellTarget(P, b.r, b.vel, b.damage)) dead = true;
        if (!dead && wisps.tryHit(P, b.r)) { onCleanse(); dead = true; }
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

  const OBJ = {
    1: () => `${tr('recover the drifting memories', '尋回飄流的記憶')} &nbsp;·&nbsp; ${GAME.relics} / ${GAME.relicsNeeded}`,
    2: () => `${tr('cleanse the Unlight', '淨化夜蝕')} &nbsp;·&nbsp; ${GAME.cleansed} / ${GAME.cleanseNeeded}`,
    3: () => tr('return the morning to the hearth', '將晨光帶回爐火'),
    4: () => tr('wander the waking city', '漫步於醒來的城市')
  };
  const refreshObjective = () => { objectiveEl.innerHTML = OBJ[GAME.phase] ? OBJ[GAME.phase]() : ''; };

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
  function hitPlayer(dir) {
    if (dead || GAME.phase === 4) return;
    GAME.hp = Math.max(0, GAME.hp - 16);
    GAME.lastHitAt = nowT;
    vigPulse = 1;
    SkyAudio.hurt();
    ctrl.shake(0.8);
    ctrl.addImpulse(dir.x * 7, 2.2, dir.z * 7);
    if (GAME.hp <= 0) die();
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
    if (!dead && GAME.hp > 0 && GAME.hp < GAME.maxHp && t - GAME.lastHitAt > 6) {
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
  return { update, cast, onRelic, onAirborne, drawStart, drawPower, releaseBow, setWeapon, beginWave, endWave };
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

function SiegeLoop(ctrl, game) {
  // compressed local timeline (seconds) — tunable; server clock coupling is P3
  const DUSK_S = 6, WAVE_S = 18, LULL_S = 8, DAWN_S = 7, DAY_S = 12, WAVES = 3;
  const CORE_MAX = 100;
  const WAVE_DRAIN = 3.2;    // core drained per second while a wave presses
  const HIT_DRAIN = 12;      // extra when a wisp reaches the core
  const STOKE_RATE = 24;     // core restored per second while holding E in range
  const CLEANSE_HEAL = 4;    // core restored per wisp cleansed
  const STOKE_RANGE = 15;

  const coreTarget = new THREE.Vector3(0, 11, -22);
  let running = false, phase = 'idle', pt = 0, night = 0, waveIx = 0;
  let coreHp = CORE_MAX, dark = false, shards = 0;
  let stokeHeld = false;

  const group = new THREE.Group();
  group.position.copy(coreTarget);
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xffd28c, emissive: 0xffb464, emissiveIntensity: 2.4, roughness: 0.3, metalness: 0 });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 1), orbMat);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffc678, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.07, 8, 44), ringMat);
  ring.rotation.x = Math.PI / 2;
  const light = new THREE.PointLight(0xffb268, 0, 44, 2);
  const bar = makeCoreBar();
  bar.position.y = 3.4;
  group.add(orb, ring, light, bar);
  group.visible = false;
  scene.add(group);

  window.addEventListener('keydown', e => { if (e.code === 'KeyE') stokeHeld = true; });
  window.addEventListener('keyup', e => { if (e.code === 'KeyE') stokeHeld = false; });
  window.addEventListener('blur', () => { stokeHeld = false; });

  const inStokeRange = () => ctrl.pos.distanceTo(coreTarget) < STOKE_RANGE;
  const stoke = (dt, rate = STOKE_RATE) => { coreHp = Math.min(CORE_MAX, coreHp + rate * dt); };

  function enter(next) {
    phase = next; pt = 0;
    if (next === 'dusk') {
      waveIx = 0;
      storyCard(
        tr(`Night ${night} — the tide is rising.`, `第 ${night} 夜 — 蝕潮正在升起。`),
        tr('hold the ward core · cleanse the Unlight · hold E to stoke it',
           '守住防線核心 · 淨化夜蝕 · 長按 E 為核心添薪'));
    } else if (next === 'wave') {
      waveIx++;
      game.beginWave();
    } else if (next === 'lull') {
      game.endWave();
      storyCard(tr('The tide draws back.', '蝕潮暫退。'),
        tr('stoke the core before it returns', '趁隙為核心添薪'));
    } else if (next === 'dawn') {
      game.endWave();
      const held = !dark && coreHp > 0;
      storyCard(
        held ? tr('The light held.', '光挺住了。') : tr('The ward fell dark.', '防線陷入黑暗。'),
        held ? tr(`Night ${night} survived · ${shards} shards gathered`, `第 ${night} 夜守住 · 拾得 ${shards} 餘燼`)
             : tr('stoke it back to life before dusk', '在黃昏前將它重新點燃'), 6500);
    }
  }

  function start() {
    if (running) return;
    running = true; night = 1; coreHp = CORE_MAX; dark = false; shards = 0;
    group.visible = true;
    // the siege owns its own night counter — hide the ambient world clock pill
    document.getElementById('worldStatus')?.classList.add('siege-hidden');
    ctrl.liftOff(clock.elapsedTime);   // rise into the defense at once
    enter('dusk');
  }

  function onCoreHit() { if (!dark) { coreHp = Math.max(0, coreHp - HIT_DRAIN); ctrl.shake(0.25); } }
  function onCleanse() { shards++; coreHp = Math.min(CORE_MAX, coreHp + CLEANSE_HEAL); SkyAudio.cleanse(); }

  function update(t, dt) {
    if (!running) return;
    pt += dt;

    // core presentation
    group.rotation.y += dt * 0.5;
    orb.rotation.x += dt * 0.7;
    const lit = coreHp / CORE_MAX;
    orbMat.color.setHex(dark ? 0x2a2440 : 0xffd28c);
    orbMat.emissiveIntensity = dark ? 0.12 : 1.4 + Math.sin(t * 3) * 0.35 + lit * 1.2;
    light.intensity = dark ? 0 : 4 + lit * 8;
    ringMat.opacity = 0.18 + lit * 0.42;
    ring.rotation.z += dt * 0.8;

    // phase machine
    if (phase === 'dusk') {
      if (pt >= DUSK_S) enter('wave');
    } else if (phase === 'wave') {
      if (!dark) coreHp = Math.max(0, coreHp - WAVE_DRAIN * dt);
      if (stokeHeld && !dark && inStokeRange()) stoke(dt);
      if (coreHp <= 0 && !dark) { dark = true; game.endWave(); enter('dawn'); }
      else if (pt >= WAVE_S) enter(waveIx >= WAVES ? 'dawn' : 'lull');
    } else if (phase === 'lull') {
      if (stokeHeld && !dark && inStokeRange()) stoke(dt);
      if (pt >= LULL_S) enter('wave');
    } else if (phase === 'dawn') {
      if (pt >= DAWN_S) { night++; enter('day'); }
    } else if (phase === 'day') {
      if (dark) {
        if (stokeHeld && inStokeRange()) { stoke(dt, STOKE_RATE * 0.6); if (coreHp >= CORE_MAX * 0.5) dark = false; }
      } else if (coreHp < CORE_MAX) stoke(dt, 5);
      if (pt >= DAY_S) enter('dusk');
    }

    drawCoreBar(bar, lit, dark);

    // objective + danger vignette are driven from the core, not the lantern HP
    const label = { dusk: 'DUSK', wave: `WAVE ${waveIx}/${WAVES}`, lull: 'LULL', dawn: 'DAWN', day: 'DAY' }[phase] || '';
    const labelZh = { dusk: '黃昏', wave: `第 ${waveIx}/${WAVES} 波`, lull: '喘息', dawn: '破曉', day: '白晝' }[phase] || '';
    const bars = Math.round(lit * 10);
    const meter = '█'.repeat(bars) + '░'.repeat(10 - bars);
    objectiveEl.innerHTML = tr(
      `NIGHT ${night} · ${label} &nbsp;·&nbsp; WARD CORE ${meter} ${Math.round(coreHp)}%`,
      `第 ${night} 夜 · ${labelZh} &nbsp;·&nbsp; 防線核心 ${meter} ${Math.round(coreHp)}%`);
    vignetteEl.style.opacity = (phase === 'wave' && !dark ? (1 - lit) * 0.5 : 0).toFixed(3);
  }

  return {
    start, update, onCoreHit, onCleanse, coreTarget,
    get active() { return running; },
    get wave() { return running && phase === 'wave'; },
    get state() { return { running, phase, night, waveIx, coreHp: Math.round(coreHp), dark, shards }; }
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

function DuelBolts(coreColor, glowIn, glowOut) {
  const glowTex = radialTexture(glowIn, glowOut, 64);
  const pool = [];
  for (let i = 0; i < 8; i++) { // scatter fires five at once
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8),
      new THREE.MeshBasicMaterial({ color: coreColor }));
    g.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.4);
    g.add(glow);
    g.visible = false;
    scene.add(g);
    pool.push({ g, core, glow, vel: new THREE.Vector3(), ttl: 0, dmg: 14 });
  }
  const _p = { x: 0, y: 0, z: 0 };
  const _aim = new THREE.Vector3();
  return {
    pool,
    fire(origin, dir, { speed = 30, ttl = 3, scale = 1, stretch = 1, dmg = 14 } = {}) {
      const b = pool.find(bb => bb.ttl <= 0);
      if (!b) return false;
      b.g.position.copy(origin);
      b.vel.copy(dir).multiplyScalar(speed);
      b.ttl = ttl;
      b.dmg = dmg;
      b.core.scale.set(scale, scale, scale * stretch);
      b.glow.scale.setScalar(1.4 * scale);
      b.g.lookAt(_aim.copy(origin).add(dir));
      b.g.visible = true;
      return true;
    },
    clear() { for (const b of pool) { b.ttl = 0; b.g.visible = false; } },
    update(dt, target, onHit) {
      for (const b of pool) {
        if (b.ttl <= 0) continue;
        b.ttl -= dt;
        const P = b.g.position;
        P.addScaledVector(b.vel, dt);
        let dead = b.ttl <= 0 || P.y < 0.15;
        if (!dead && target.invulT <= 0) {
          const dx = P.x - target.pos.x, dy = P.y - (target.pos.y + 0.9), dz = P.z - target.pos.z;
          if (dx * dx + dy * dy + dz * dz < 1.2 * 1.2) { onHit(b.vel.clone().normalize(), b.dmg); dead = true; }
        }
        if (!dead) { // towers and walls give cover
          _p.x = P.x; _p.y = P.y; _p.z = P.z;
          resolveCollisions(_p, 0.15);
          if (Math.abs(_p.x - P.x) + Math.abs(_p.y - P.y) + Math.abs(_p.z - P.z) > 1e-4) dead = true;
        }
        if (dead) { b.ttl = 0; b.g.visible = false; }
      }
    }
  };
}

function DuelFighter(opts) {
  const fig = CloakedFigure({
    cloak: opts.cloak, lantern: true, plain: opts.plain,
    lanternColor: opts.lanternColor, glowIn: opts.glowIn, glowOut: opts.glowOut });
  fig.group.position.set(opts.x, 2.2, opts.z);
  // hide this body from its own first-person camera; keep its lantern light global
  const hitMeshes = [];
  fig.group.traverse(o => {
    if (!o.isLight) o.layers.set(opts.layer);
    if (o.isMesh) hitMeshes.push(o);
  });
  scene.add(fig.group);
  const self = {
    fig, hitMeshes, name: opts.name,
    pos: fig.group.position,
    vel: new THREE.Vector3(),
    yaw: opts.yaw, pitch: 0,
    hp: 100, wins: 0,
    castCd: 0, dashCd: 0, dashT: 0, invulT: 0,
    dim: false, lastCastAt: -99, shake: 0,
    weapon: 1, drawT0: -1, bowHandle: null, human: !!opts.human,
    dashDir: new THREE.Vector3(),
    bolts: DuelBolts(opts.boltColor, opts.glowIn, opts.glowOut),
    spawn: { x: opts.x, z: opts.z, yaw: opts.yaw },
    viewDir(out) {
      return out.set(
        -Math.sin(self.yaw) * Math.cos(self.pitch),
        Math.sin(self.pitch),
        -Math.cos(self.yaw) * Math.cos(self.pitch));
    },
    resetRound() {
      self.pos.set(self.spawn.x, 2.2, self.spawn.z);
      self.vel.set(0, 0, 0);
      self.yaw = self.spawn.yaw;
      self.pitch = 0;
      self.hp = 100;
      self.castCd = self.dashCd = self.dashT = self.invulT = 0;
      self.cancelDraw();
      self.dim = false;
      fig.setDim(0);
      self.bolts.clear();
    },
    toggleDim() { self.dim = !self.dim; fig.setDim(self.dim ? 1 : 0); SkyAudio.hush(self.dim); },
    // aim assist: if you are pointing at the rival you SEE (small cone), the bolt
    // is released toward where they WILL be — leading the shot is done for you,
    // finding and framing them is still your job. Fills _cv, returns the muzzle.
    aim(opp, cone, speed) {
      self.viewDir(_cv);
      const ex = self.pos.x, ey = self.pos.y + 1.45, ez = self.pos.z;
      _cv2.set(opp.pos.x - ex, opp.pos.y + 0.9 - ey, opp.pos.z - ez);
      const dd = _cv2.length();
      _cv2.normalize();
      if (_cv.angleTo(_cv2) < cone) {
        const lead = Math.min(dd / speed, 1.2);
        _cv2.set(
          opp.pos.x + opp.vel.x * lead - ex,
          opp.pos.y + 0.9 + opp.vel.y * lead - ey,
          opp.pos.z + opp.vel.z * lead - ez).normalize();
        _cv.lerp(_cv2, 0.85).normalize();
      }
      return new THREE.Vector3(ex, ey, ez).addScaledVector(_cv, 0.8);
    },
    // rivals' shots fade with distance — your ears help you hunt
    earshot(opp) { return clamp(1 - self.pos.distanceTo(opp.pos) / 90, 0.3, 1); },
    cast(opp, tNow) {
      if (self.castCd > 0) return;
      if (self.weapon === 3) return; // the moonbow fires on draw + loose
      if (self.dim) { self.dim = false; } // the flame must burn to cast
      if (self.weapon === 2) { // 星屑 — close-range fan of embers
        const origin = self.aim(opp, 0.22, 26);
        let fired = false;
        for (let i = 0; i < 5; i++) {
          _cvS.copy(_cv);
          _cvS.x += (Math.random() - 0.5) * 0.22;
          _cvS.y += (Math.random() - 0.5) * 0.22;
          _cvS.z += (Math.random() - 0.5) * 0.22;
          _cvS.normalize();
          if (self.bolts.fire(origin, _cvS, { speed: 26, ttl: 0.6, scale: 0.6, dmg: 6 })) fired = true;
        }
        if (fired) {
          self.castCd = 1.1; self.lastCastAt = tNow; fig.flare();
          SkyAudio.scatter(self.earshot(opp));
        }
      } else { // 晨焰 — the classic bolt
        const origin = self.aim(opp, 0.18, 30);
        if (self.bolts.fire(origin, _cv, { dmg: 14 })) {
          self.castCd = 0.5; self.lastCastAt = tNow; fig.flare();
          SkyAudio.cast(self.earshot(opp));
        }
      }
    },
    // 月弓 — hold to draw, loose for a fast heavy dart; power grows over 1s
    startDraw(tNow, opp) {
      if (self.castCd > 0 || self.weapon !== 3 || self.drawT0 >= 0) return;
      self.drawT0 = tNow;
      self.bowHandle = SkyAudio.bowDraw(self.human ? 1 : 0.55 * self.earshot(opp));
    },
    drawPower(tNow) { return self.drawT0 < 0 ? 0 : Math.min(1, (tNow - self.drawT0) / 1.0); },
    looseBow(opp, tNow) {
      if (self.drawT0 < 0) return;
      const p = self.drawPower(tNow);
      const h = self.bowHandle;
      self.drawT0 = -1;
      self.bowHandle = null;
      if (p < 0.15) { SkyAudio.bowRelease(0, h); return; } // a fumbled tap, not a shot
      if (self.dim) { self.dim = false; } // loosing light betrays you, like casting
      const origin = self.aim(opp, 0.15, 55 + 55 * p);
      if (self.bolts.fire(origin, _cv,
        { speed: 55 + 55 * p, ttl: 2.6, scale: 0.6 + 0.5 * p, stretch: 5, dmg: Math.round(12 + 22 * p) })) {
        self.castCd = 1.0; self.lastCastAt = tNow; fig.flare();
      }
      SkyAudio.bowRelease(p, h);
    },
    cancelDraw() {
      if (self.drawT0 < 0) return;
      self.drawT0 = -1;
      SkyAudio.bowRelease(0, self.bowHandle);
      self.bowHandle = null;
    },
    setWeapon(w) {
      if (self.weapon === w) return;
      self.weapon = w;
      self.cancelDraw();
      if (self.human) SkyAudio.weaponSelect();
    },
    dash(moveVec) {
      if (self.dashCd > 0) return;
      if (moveVec.lengthSq() > 0.01) self.dashDir.copy(moveVec).normalize();
      else self.viewDir(self.dashDir);
      self.dashT = 0.18;
      self.invulT = 0.32;
      self.dashCd = 1.2;
      SkyAudio.dash();
    },
    applyHit(dir, amt) {
      self.hp = Math.max(0, self.hp - amt);
      fig.hit();
      SkyAudio.hurt(0.8);
      self.vel.addScaledVector(dir, 7);
      self.shake = Math.min(1, self.shake + 0.8);
    },
    update(t, dt, moveVec, locked) {
      self.castCd = Math.max(0, self.castCd - dt);
      self.dashCd = Math.max(0, self.dashCd - dt);
      self.invulT = Math.max(0, self.invulT - dt);
      if (self.dashT > 0) {
        self.dashT -= dt;
        self.vel.copy(self.dashDir).multiplyScalar(22);
      } else if (!locked) {
        const k = 1 - Math.exp(-dt * 5);
        self.vel.x = lerp(self.vel.x, moveVec.x * 12, k);
        self.vel.y = lerp(self.vel.y, moveVec.y * 12, k);
        self.vel.z = lerp(self.vel.z, moveVec.z * 12, k);
      } else {
        self.vel.multiplyScalar(Math.exp(-dt * 5));
      }
      self.pos.addScaledVector(self.vel, dt);
      resolveCollisions(self.pos, 0.65);
      const rr = Math.hypot(self.pos.x, self.pos.z);
      if (rr > HUNT_R) { self.pos.x *= HUNT_R / rr; self.pos.z *= HUNT_R / rr; }
      self.pos.y = clamp(self.pos.y, HUNT_Y0, HUNT_Y1);
      const spd = self.vel.length();
      fig.group.rotation.set(0, self.yaw, 0);
      fig.group.rotateX(Math.min(0.35, spd * 0.02));
      fig.setDim(self.dim ? 1 : 0);
      fig.update(t, dt, Math.min(1, spd / 14));
    }
  };
  return self;
}

// P1: mouse look (pointer lock), WASD flies along the view, SPACE rises / SHIFT sinks
// (same as story flight), F/click cast, Q dash, C hush
function fpControllerP1() {
  let dashHeld = false, dimHeld = false;
  return {
    mouseCast: false,
    look() {}, // mouse events drive yaw/pitch directly
    move(out, self) {
      const f = (duelKeys.KeyW ? 1 : 0) - (duelKeys.KeyS ? 1 : 0);
      const s = (duelKeys.KeyD ? 1 : 0) - (duelKeys.KeyA ? 1 : 0);
      self.viewDir(out).multiplyScalar(f);
      out.x += Math.cos(self.yaw) * s;
      out.z += -Math.sin(self.yaw) * s;
      out.y += (duelKeys.Space ? 1 : 0) - ((duelKeys.ShiftLeft || duelKeys.ShiftRight) ? 1 : 0);
      if (out.lengthSq() > 0) out.normalize();
    },
    wantCast() { return !!duelKeys.KeyF || this.mouseCast; },
    wantDash() { const h = !!duelKeys.KeyQ, f = h && !dashHeld; dashHeld = h; return f; },
    wantDim() { const h = !!duelKeys.KeyC, f = h && !dimHeld; dimHeld = h; return f; }
  };
}

// P2: arrow keys look, IJKL flies along the view, U rises / O sinks, H cast, N dash, M hush
function fpControllerP2() {
  let dashHeld = false, dimHeld = false;
  return {
    look(self, dt) {
      self.yaw -= (((duelKeys.ArrowRight ? 1 : 0) - (duelKeys.ArrowLeft ? 1 : 0)) * 2.3) * dt;
      self.pitch = clamp(
        self.pitch + (((duelKeys.ArrowUp ? 1 : 0) - (duelKeys.ArrowDown ? 1 : 0)) * 1.9) * dt,
        -1.25, 1.25);
    },
    move(out, self) {
      const f = (duelKeys.KeyI ? 1 : 0) - (duelKeys.KeyK ? 1 : 0);
      const s = (duelKeys.KeyL ? 1 : 0) - (duelKeys.KeyJ ? 1 : 0);
      self.viewDir(out).multiplyScalar(f);
      out.x += Math.cos(self.yaw) * s;
      out.z += -Math.sin(self.yaw) * s;
      out.y += (duelKeys.KeyU ? 1 : 0) - (duelKeys.KeyO ? 1 : 0);
      if (out.lengthSq() > 0) out.normalize();
    },
    wantCast() { return !!duelKeys.KeyH; },
    wantDash() { const h = !!duelKeys.KeyN, f = h && !dashHeld; dashHeld = h; return f; },
    wantDim() { const h = !!duelKeys.KeyM, f = h && !dimHeld; dimHeld = h; return f; }
  };
}

// the grey warden: hunts your light, loses you when you hush it, stalks with his own lantern doused
function fpControllerAI() {
  const lastSeen = new THREE.Vector3(0, 6, 0);
  const wander = new THREE.Vector3(0, 6, 0);
  let wanderT = 0, thinkT = 0, strafe = 1, knows = false;
  const pickWander = () => {
    const a = Math.random() * Math.PI * 2, r = 15 + Math.random() * 50;
    wander.set(Math.cos(a) * r, 2 + Math.random() * 16, Math.sin(a) * r);
    wanderT = 8;
  };
  return {
    look(self, dt, opp, tNow) {
      knows = !opp.dim || self.pos.distanceTo(opp.pos) < 18 || (tNow - opp.lastCastAt) < 2.5;
      if (knows) lastSeen.copy(opp.pos);
      const aim = knows ? opp.pos : lastSeen;
      const dx = aim.x - self.pos.x, dz = aim.z - self.pos.z;
      const dy = aim.y + 0.9 - (self.pos.y + 1.45);
      self.yaw = Math.atan2(-dx, -dz);
      self.pitch = clamp(Math.atan2(dy, Math.hypot(dx, dz) || 1e-4), -1.2, 1.2);
    },
    move(out, self, dt, opp) {
      thinkT -= dt;
      if (thinkT <= 0) { thinkT = 0.3 + Math.random() * 0.4; if (Math.random() < 0.3) strafe = -strafe; }
      const goal = knows ? opp.pos : (self.pos.distanceTo(lastSeen) > 4 ? lastSeen : wander);
      if (!knows) { wanderT -= dt; if (wanderT <= 0 || self.pos.distanceTo(wander) < 4) pickWander(); }
      const dx = goal.x - self.pos.x, dy = goal.y - self.pos.y, dz = goal.z - self.pos.z;
      const d = Math.hypot(dx, dz) || 1e-4;
      let radial = 1;
      if (knows) { const want = 14; radial = clamp((d - want) / 4, -1, 1); }
      out.set(
        (dx / d) * radial + (-dz / d) * strafe * (knows ? 0.8 : 0.15),
        clamp(dy * 0.25, -0.6, 0.6),
        (dz / d) * radial + (dx / d) * strafe * (knows ? 0.8 : 0.15));
      if (out.lengthSq() > 0) out.normalize();
    },
    wantCast(self, opp) { return knows && self.castCd <= 0 && self.pos.distanceTo(opp.pos) < 34 && Math.random() < 0.7; },
    wantDash(self, opp) {
      if (self.dashCd > 0) return false;
      for (const b of opp.bolts.pool) {
        if (b.ttl > 0 && b.g.position.distanceTo(self.pos) < 8) return true;
      }
      return false;
    },
    wantDim(self, opp) { // stalks in the dark once he has your scent
      const should = knows && self.pos.distanceTo(opp.pos) < 26;
      return should !== self.dim;
    }
  };
}

function DuelSystem(mode) {
  const twoP = mode === 'versus';
  const P1 = DuelFighter({
    x: -38, z: 6, yaw: -Math.PI / 2, layer: 1, human: true,
    cloak: 0x2c1f42, name: tr('the lantern bearer', '提燈者'),
    lanternColor: 0xffb464, glowIn: 'rgba(255,190,110,0.7)', glowOut: 'rgba(255,170,80,0)', boltColor: 0xffe0b0 });
  const P2 = DuelFighter({
    x: 38, z: -6, yaw: Math.PI / 2, layer: 2, human: twoP,
    cloak: 0x34302a, plain: true, name: twoP ? tr('the second lantern', '第二位提燈者') : tr('the grey warden', '灰袍守夜人'),
    lanternColor: 0xbfd0ff, glowIn: 'rgba(190,210,255,0.7)', glowOut: 'rgba(150,180,255,0)', boltColor: 0xdce8ff });
  const c1 = fpControllerP1();
  const c2 = twoP ? fpControllerP2() : fpControllerAI();
  const aiCastCd = 1.05;

  // first-person cameras: each sees the world, the rival, but not its own body
  const mkCam = (seesLayer) => {
    const c = new THREE.PerspectiveCamera(68, 1, 0.1, 400);
    c.rotation.order = 'YXZ';
    c.layers.enable(seesLayer);
    return c;
  };
  const cam1 = mkCam(2);
  const cam2 = twoP ? mkCam(1) : null;

  // pointer lock gives P1 true mouselook; a click also casts once locked
  const cvs = renderer.domElement;
  cvs.addEventListener('mousedown', () => {
    if (!document.pointerLockElement) { cvs.requestPointerLock(); return; }
    c1.mouseCast = true;
  });
  window.addEventListener('mouseup', () => { c1.mouseCast = false; });
  window.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== cvs) return;
    P1.yaw -= e.movementX * 0.0024 * PLAYER_PREFS.lookSensitivity;
    P1.pitch = clamp(P1.pitch - e.movementY * 0.0021 * PLAYER_PREFS.lookSensitivity, -1.25, 1.25);
  });

  const dname1 = document.getElementById('dname1'), dname2 = document.getElementById('dname2');
  const dkeys = document.getElementById('dkeys');
  document.getElementById('duelhud').classList.add('on');
  const xh1 = document.getElementById('xh1'), xh2 = document.getElementById('xh2');
  xh1.style.left = twoP ? '25%' : '50%';
  xh1.style.display = 'block';
  if (twoP) { xh2.style.left = '75%'; xh2.style.display = 'block'; }
  document.getElementById('splitline').style.display = twoP ? 'block' : 'none';

  const fill1 = document.getElementById('dfill1'), fill2 = document.getElementById('dfill2');
  const pips1 = document.getElementById('dpips1'), pips2 = document.getElementById('dpips2');
  const _m1 = new THREE.Vector3(), _m2 = new THREE.Vector3();
  const _size = new THREE.Vector2();
  const _reticleOrigin = new THREE.Vector3(), _reticleDir = new THREE.Vector3();
  const _reticleRay = new THREE.Raycaster();
  const _reticleHits = [];
  _reticleRay.layers.enableAll();
  let state = 'intro', stateT = 2.6, round = 1, over = false;
  storyCard(tr('the hunt begins', '獵殺開始'), tr('douse your lantern to vanish — but a hushed flame cannot cast', '熄灭提燈即可隱身——但熄燈時無法施法'), 4200);

  // Raycast the rival's actual cloak, hood, arm and lantern meshes. This is
  // intentionally separate from aim assist: red means the centre dot is truly
  // touching the visible player model, not merely pointing somewhere near it.
  function reticleHitDistance(self, opp) {
    _reticleOrigin.set(self.pos.x, self.pos.y + 1.45, self.pos.z);
    self.viewDir(_reticleDir).normalize();
    _reticleRay.set(_reticleOrigin, _reticleDir);
    _reticleHits.length = 0;
    _reticleRay.intersectObjects(opp.hitMeshes, false, _reticleHits);
    return _reticleHits.length ? _reticleHits[0].distance : Infinity;
  }

  function reticleSeesEnemy(self, opp, tNow) {
    const distance = self.pos.distanceTo(opp.pos);
    const concealed = opp.dim && distance >= 18 && (tNow - opp.lastCastAt) >= 2.5;
    if (concealed || opp.hp <= 0) return false;
    const hitDistance = reticleHitDistance(self, opp);
    if (!Number.isFinite(hitDistance)) return false;
    return !duelRayBlocked(_reticleOrigin, _reticleDir, Math.max(0.01, hitDistance - 0.02));
  }

  const pipStr = (w) => '● '.repeat(w) + '○ '.repeat(Math.max(0, 2 - w));
  const refreshPips = () => { pips1.textContent = pipStr(P1.wins); pips2.textContent = pipStr(P2.wins); };
  refreshPips();

  // weapon readout — the warden's shows too: he telegraphs his snipes
  const dweap1 = document.getElementById('dweap1'), dweap2 = document.getElementById('dweap2');
  const weaponName = w => ({ 1: tr('EMBER', '晨焰'), 2: tr('SCATTER', '星屑'), 3: tr('MOONBOW', '月弓') })[w];
  function refreshWeapons() {
    const t1 = weaponName(P1.weapon), t2 = weaponName(P2.weapon);
    if (dweap1.textContent !== t1) dweap1.textContent = t1;
    if (dweap2.textContent !== t2) dweap2.textContent = t2;
  }
  function refreshDuelLanguage() {
    P1.name = tr('the lantern bearer', '提燈者');
    P2.name = twoP ? tr('the second lantern', '第二位提燈者') : tr('the grey warden', '灰袍守夜人');
    dname1.textContent = P1.name;
    dname2.textContent = P2.name;
    dkeys.innerHTML = twoP
      ? tr('RETICLE RED = ENEMY HIT &nbsp;|&nbsp; P1 — Mouse look · WASD fly · Space rise / Shift descend · Click/F cast · 1/2/3 weapons · Q dash · C douse &nbsp;|&nbsp; P2 — Arrow keys look · IJKL fly · U rise / O descend · H cast · 8/9/0 weapons · N dash · M douse &nbsp;|&nbsp; Hold moonbow to charge · B mute', '準星碰到敵對玩家 = 變紅 &nbsp;|&nbsp; P1 — 滑鼠視角 · WASD 飛行 · Space 升 / Shift 降 · 左鍵/F 施法 · 1/2/3 武器 · Q 衝刺 · C 熄燈 &nbsp;|&nbsp; P2 — 方向鍵視角 · IJKL 飛行 · U 升 / O 降 · H 施法 · 8/9/0 武器 · N 衝刺 · M 熄燈 &nbsp;|&nbsp; 月弓按住蓄力 · B 靜音')
      : tr('Mouse look · WASD fly · Space rise / Shift descend · Click/F cast · 1/2/3 weapons (hold moonbow to charge) · Q dash · C douse to hide · B mute', '滑鼠視角 · WASD 飛行 · Space 升 / Shift 降 · 左鍵/F 施法 · 1/2/3 武器（月弓按住蓄力） · Q 衝刺 · C 熄燈潛行 · B 靜音');
    refreshWeapons();
  }
  refreshDuelLanguage();
  window.addEventListener('sky-language-change', refreshDuelLanguage);
  // switch keys: P1 1/2/3 · P2 8/9/0 (versus only — the warden chooses his own)
  window.addEventListener('keydown', e => {
    if (over) return;
    const w1 = { Digit1: 1, Digit2: 2, Digit3: 3 }[e.code];
    if (w1) P1.setWeapon(w1);
    if (twoP) {
      const w2 = { Digit8: 1, Digit9: 2, Digit0: 3 }[e.code];
      if (w2) P2.setWeapon(w2);
    }
  });

  function roundOver(winner) {
    winner.wins++;
    refreshPips();
    P1.cancelDraw();
    P2.cancelDraw();
    state = 'roundEnd';
    stateT = 2.8;
    if (winner.wins >= 2) {
      over = true;
      SkyAudio.victory();
      storyCard(tr(`${winner.name} prevails`, `${winner.name}獲勝`), tr('press R to hunt again', '按 R 再次獵殺'), 60000);
      window.addEventListener('keydown', function again(e) {
        if (e.code === 'KeyR') { window.removeEventListener('keydown', again); window.location.reload(); }
      });
    } else {
      SkyAudio.roundBell();
      storyCard(tr(`round to ${winner.name}`, `本局由 ${winner.name} 獲勝`), '', 2400);
    }
  }

  const lockNote = document.getElementById('locknote');
  return {
    P1, P2,
    update(t, dt) {
      const locked = state !== 'fight';
      // nudge P1 to grab mouselook until the pointer is captured
      lockNote.style.opacity = document.pointerLockElement === cvs ? 0 : 1;
      // look
      c1.look(P1, dt, P2, t);
      c2.look(P2, dt, P1, t);
      // move + actions
      c1.move(_m1, P1, dt, P2);
      c2.move(_m2, P2, dt, P1);
      if (!locked) {
        // moonbow: the cast key held draws, releasing it looses
        if (P1.weapon === 3) {
          if (c1.wantCast(P1, P2)) P1.startDraw(t, P2);
          else P1.looseBow(P2, t);
        } else if (c1.wantCast(P1, P2)) P1.cast(P2, t);
        if (c1.wantDash(P1, P2)) P1.dash(_m1);
        if (c1.wantDim(P1, P2)) P1.toggleDim();
        if (twoP) {
          if (P2.weapon === 3) {
            if (c2.wantCast(P2, P1)) P2.startDraw(t, P1);
            else P2.looseBow(P1, t);
          } else if (c2.wantCast(P2, P1)) P2.cast(P1, t);
        } else {
          // the warden picks his tool: scatter up close, moonbow at long
          // sight, the plain bolt in between — never mid-draw
          const d12 = P2.pos.distanceTo(P1.pos);
          const sees = !P1.dim || d12 < 18 || (t - P1.lastCastAt) < 2.5;
          if (P2.drawT0 < 0 && P2.castCd <= 0) {
            P2.setWeapon(d12 < 11 ? 2 : d12 > 30 ? 3 : 1);
          }
          if (P2.weapon === 3) {
            if (P2.drawT0 < 0) {
              if (sees && P2.castCd <= 0 && d12 > 24) P2.startDraw(t, P1);
            } else if (P2.drawPower(t) >= 0.85) {
              if (sees) { P2.looseBow(P1, t); P2.castCd = aiCastCd; }
              else P2.cancelDraw(); // lost you — he saves the arrow
            }
          } else if (c2.wantCast(P2, P1)) {
            P2.cast(P1, t);
            P2.castCd = Math.max(P2.castCd, aiCastCd);
          }
        }
        if (c2.wantDash(P2, P1)) P2.dash(_m2);
        if (c2.wantDim(P2, P1)) P2.toggleDim();
      }
      P1.update(t, dt, _m1, locked);
      P2.update(t, dt, _m2, locked);
      P1.bolts.update(dt, P2, (dir, dmg) => {
        P2.applyHit(dir, dmg);
        if (P2.hp <= 0 && state === 'fight') roundOver(P1);
      });
      P2.bolts.update(dt, P1, (dir, dmg) => {
        P1.applyHit(dir, dmg);
        if (P1.hp <= 0 && state === 'fight') roundOver(P2);
      });
      refreshWeapons();
      fill1.style.width = P1.hp + '%';
      fill2.style.width = P2.hp + '%';
      // round flow
      stateT -= dt;
      if (state === 'intro' && stateT <= 0) { state = 'fight'; storyCard(tr('begin', '開始'), '', 1200); SkyAudio.roundBell(); }
      else if (state === 'roundEnd' && stateT <= 0 && !over) {
        round++;
        P1.resetRound();
        P2.resetRound();
        state = 'intro';
        stateT = 2.0;
        storyCard(tr(`round ${ROMAN[Math.min(round - 1, 4)]}`, `第 ${ROMAN[Math.min(round - 1, 4)]} 局`), '', 2200);
      }
      // first-person cameras with per-player impact shake (+ moonbow zoom)
      for (const [f, c] of twoP ? [[P1, cam1], [P2, cam2]] : [[P1, cam1]]) {
        const fv = 68 - 15 * f.drawPower(t);
        c.fov += (fv - c.fov) * Math.min(1, dt * 8);
        c.position.set(f.pos.x, f.pos.y + 1.45, f.pos.z);
        c.rotation.set(f.pitch, f.yaw, 0);
        if (PLAYER_PREFS.cameraShake && f.shake > 0.002) {
          c.position.x += (Math.random() - 0.5) * f.shake * 0.35;
          c.position.y += (Math.random() - 0.5) * f.shake * 0.28;
          f.shake *= Math.exp(-dt * 4.5);
        }
      }
      // Split-screen hit confirmation: each half owns its own reticle state.
      // Red means the exact centre ray touches the visible rival, not merely
      // that the rival is somewhere inside the weapon's aim-assist cone.
      const canLock = twoP && state === 'fight';
      xh1.classList.toggle('enemy-lock', canLock && reticleSeesEnemy(P1, P2, t));
      if (twoP) xh2.classList.toggle('enemy-lock', canLock && reticleSeesEnemy(P2, P1, t));
    },
    render() {
      renderer.getSize(_size);
      renderer.setScissorTest(true);
      if (twoP) {
        const hw = Math.floor(_size.x / 2);
        cam1.aspect = hw / _size.y;
        cam1.updateProjectionMatrix();
        cam2.aspect = (_size.x - hw) / _size.y;
        cam2.updateProjectionMatrix();
        renderer.setViewport(0, 0, hw, _size.y);
        renderer.setScissor(0, 0, hw, _size.y);
        renderer.render(scene, cam1);
        renderer.setViewport(hw, 0, _size.x - hw, _size.y);
        renderer.setScissor(hw, 0, _size.x - hw, _size.y);
        renderer.render(scene, cam2);
      } else {
        cam1.aspect = _size.x / _size.y;
        cam1.updateProjectionMatrix();
        renderer.setViewport(0, 0, _size.x, _size.y);
        renderer.setScissor(0, 0, _size.x, _size.y);
        renderer.render(scene, cam1);
      }
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, _size.x, _size.y);
    }
  };
}

// Fast line-of-sight checks against the same simplified colliders used by
// movement. This keeps the red duel reticle from revealing rivals through walls.
function rayHitsLocalBox(ox, oy, oz, dx, dy, dz, hw, y0, y1, hd, maxDist) {
  let near = 0, far = maxDist;
  const EPS = 1e-7;
  if (Math.abs(dx) < EPS) { if (ox < -hw || ox > hw) return false; }
  else {
    let a = (-hw - ox) / dx, b = (hw - ox) / dx;
    if (a > b) { const swap = a; a = b; b = swap; }
    near = Math.max(near, a); far = Math.min(far, b);
    if (near > far) return false;
  }
  if (Math.abs(dy) < EPS) { if (oy < y0 || oy > y1) return false; }
  else {
    let a = (y0 - oy) / dy, b = (y1 - oy) / dy;
    if (a > b) { const swap = a; a = b; b = swap; }
    near = Math.max(near, a); far = Math.min(far, b);
    if (near > far) return false;
  }
  if (Math.abs(dz) < EPS) { if (oz < -hd || oz > hd) return false; }
  else {
    let a = (-hd - oz) / dz, b = (hd - oz) / dz;
    if (a > b) { const swap = a; a = b; b = swap; }
    near = Math.max(near, a); far = Math.min(far, b);
  }
  return near <= far && far > 0 && near < maxDist;
}

function duelRayBlocked(origin, dir, maxDist) {
  const EPS = 1e-7;
  for (const c of COLLIDERS) {
    const rx = origin.x - c.x, rz = origin.z - c.z;
    if (c.kind === 'box') {
      const ox = rx * c.cos - rz * c.sin;
      const oz = rx * c.sin + rz * c.cos;
      const dx = dir.x * c.cos - dir.z * c.sin;
      const dz = dir.x * c.sin + dir.z * c.cos;
      if (rayHitsLocalBox(ox, origin.y, oz, dx, dir.y, dz,
        c.hw + 0.08, c.y0 - 0.08, c.y1 + 0.08, c.hd + 0.08, maxDist)) return true;
      continue;
    }

    const radius = c.r + 0.08;
    const qa = dir.x * dir.x + dir.z * dir.z;
    let near = 0, far = maxDist;
    if (qa < EPS) {
      if (rx * rx + rz * rz > radius * radius) continue;
    } else {
      const qb = 2 * (rx * dir.x + rz * dir.z);
      const qc = rx * rx + rz * rz - radius * radius;
      const disc = qb * qb - 4 * qa * qc;
      if (disc < 0) continue;
      const root = Math.sqrt(disc);
      let a = (-qb - root) / (2 * qa), b = (-qb + root) / (2 * qa);
      if (a > b) { const swap = a; a = b; b = swap; }
      near = Math.max(near, a); far = Math.min(far, b);
      if (near > far) continue;
    }
    if (Math.abs(dir.y) < EPS) {
      if (origin.y < c.y0 || origin.y > c.y1) continue;
    } else {
      let a = (c.y0 - origin.y) / dir.y, b = (c.y1 - origin.y) / dir.y;
      if (a > b) { const swap = a; a = b; b = swap; }
      near = Math.max(near, a); far = Math.min(far, b);
    }
    if (near <= far && far > 0 && near < maxDist) return true;
  }
  return false;
}

/* ================= collision ================= */
// sphere-vs-collider, resolved along the axis of least penetration:
// walls push you sideways, tops let you hover/land, undersides push you down
function resolveCollisions(p, pr) {
  for (const c of COLLIDERS) {
    if (p.y - pr > c.y1 || p.y + pr < c.y0) continue;
    if (c.kind === 'cyl') {
      const dx = p.x - c.x, dz = p.z - c.z;
      const dist = Math.hypot(dx, dz) || 1e-4;
      if (dist > c.r + pr) continue;
      const penH = c.r + pr - dist;
      const penUp = c.y1 + pr - p.y;
      const penDown = p.y + pr - c.y0;
      const m = Math.min(penH, penUp, penDown);
      if (m === penUp) p.y = c.y1 + pr;
      else if (m === penDown) p.y = c.y0 - pr;
      else { p.x = c.x + (dx / dist) * (c.r + pr); p.z = c.z + (dz / dist) * (c.r + pr); }
    } else {
      const dx = p.x - c.x, dz = p.z - c.z;
      const lx = dx * c.cos - dz * c.sin;
      const lz = dx * c.sin + dz * c.cos;
      const penX = c.hw + pr - Math.abs(lx);
      const penZ = c.hd + pr - Math.abs(lz);
      if (penX <= 0 || penZ <= 0) continue;
      const penUp = c.y1 + pr - p.y;
      const penDown = p.y + pr - c.y0;
      const m = Math.min(penX, penZ, penUp, penDown);
      if (m === penUp) { p.y = c.y1 + pr; continue; }
      if (m === penDown) { p.y = c.y0 - pr; continue; }
      let nlx = lx, nlz = lz;
      if (m === penX) nlx = Math.sign(lx || 1) * (c.hw + pr);
      else nlz = Math.sign(lz || 1) * (c.hd + pr);
      p.x = c.x + nlx * c.cos + nlz * c.sin;
      p.z = c.z - nlx * c.sin + nlz * c.cos;
    }
  }
}

/* ================= CameraController ================= */
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

  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyV') firstPerson = !firstPerson;
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  const key = (...codes) => codes.some(c => keys[c]) ? 1 : 0;

  const el = renderer.domElement;
  const lockPointer = () => {
    if (!el.requestPointerLock || document.pointerLockElement === el) return;
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
  const syncPointerLockHint = () => {
    const shouldShow = state === 'flying' && MODE === 'story' && !UI_BLOCKS_STEERING
      && document.pointerLockElement !== el;
    mouseLockHintEl.classList.toggle('show', shouldShow);
  };
  document.addEventListener('pointerlockchange', () => {
    pointerSeen = false;
    syncPointerLockHint();
  });

  const quintic = t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;

  return {
    get state() { return state; },
    get pos() { return pos; },
    get speed() { return vel.length(); },
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    lockPointer,
    addImpulse(ix, iy, iz) { vel.x += ix; vel.y += iy; vel.z += iz; },
    shake(a) { if (PLAYER_PREFS.cameraShake) shakeAmt = Math.min(1, shakeAmt + a); },
    resetHome() { pos.set(0, FLY_Y, 0); vel.set(0, 0, 0); },
    liftOff(now) {
      if (state !== 'ground' || now < 1.2) return; // ignore stray clicks before the hint fades in
      state = 'lifting';
      liftStart = now;
      hintEl.classList.add('gone');
      lockPointer(); // user gesture from the rune/hint enables unlimited 360° turning
      SkyAudio.init(); // the click that lifts you is the gesture that unlocks audio
      SkyAudio.takeoff();
    },
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
        // free flight: WASD along the view direction, space/shift for altitude
        const f = key('KeyW', 'ArrowUp') - key('KeyS', 'ArrowDown');
        const s = key('KeyD', 'ArrowRight') - key('KeyA', 'ArrowLeft');
        const u = key('Space') - key('ShiftLeft', 'ShiftRight');
        fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
        rightv.set(Math.cos(yaw), 0, -Math.sin(yaw));
        wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(rightv, s);
        wish.y += u;
        if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(FLY_SPEED);
        vel.lerp(wish, Math.min(1, dt * 2.4)); // eased acceleration / deceleration
        pos.addScaledVector(vel, dt);
        pos.y = Math.max(1.3, Math.min(80, pos.y));
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
  const defaults = { language: 'en', volume: 90, muted: false, quality: 'balanced', brightness: 100, sensitivity: 100, cameraShake: true, playerName: '', cloakColor: '#e8b06a' };
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
  const cloak = document.getElementById('settingCloak');
  const mainMenu = document.getElementById('settingsMainMenu');

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
    cloak.value = /^#[0-9a-fA-F]{6}$/.test(prefs.cloakColor) ? prefs.cloakColor : defaults.cloakColor;
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
  cloak.addEventListener('change', () => {
    prefs.cloakColor = cloak.value; persist();
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
  return { open: () => setOpen(true), close: () => setOpen(false), prefs };
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

/* ================= helpers ================= */
function radialTexture(inner, outer, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// a real moon: sunlit disc with limb shading, dark maria, rim-lit craters
function moonTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  let s = 20260709;
  const r = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const cx = S / 2, cy = S / 2, R = 108;

  const disc = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
  disc.addColorStop(0, '#fdfaf0');
  disc.addColorStop(0.72, '#e8e4d6');
  disc.addColorStop(1, '#b9b7ae');
  g.fillStyle = disc;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();

  const mare = (x, y, rx, ry, rot, a) => {
    g.save(); g.translate(cx + x, cy + y); g.rotate(rot);
    g.fillStyle = `rgba(126,128,138,${a})`;
    g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  mare(-26, -30, 40, 26, 0.5, 0.16);
  mare(22, -8, 30, 34, -0.3, 0.13);
  mare(-8, 34, 34, 20, 0.2, 0.12);
  mare(38, 30, 16, 12, 0, 0.1);

  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.82;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
    const cr = 2 + r() * 7;
    g.fillStyle = `rgba(110,112,124,${0.08 + r() * 0.12})`;
    g.beginPath(); g.arc(x, y, cr, 0, Math.PI * 2); g.fill();
    g.strokeStyle = `rgba(255,252,240,${0.1 + r() * 0.14})`; // sun-catching rim
    g.lineWidth = 1.2;
    g.beginPath(); g.arc(x, y, cr, -2.4, -0.6); g.stroke();
  }

  // soft edge falloff so the disc melts into the night sky
  const edge = g.createRadialGradient(cx, cy, R * 0.86, cx, cy, R);
  edge.addColorStop(0, 'rgba(10,10,16,0)');
  edge.addColorStop(1, 'rgba(10,10,16,0.32)');
  g.fillStyle = edge;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// wispy horizontal cloud streak from overlapping soft blobs
function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  let s = 1337;
  const r = () => (s = (s * 48271) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const x = 30 + r() * 196, y = 40 + r() * 48, rad = 14 + r() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(255,255,255,${0.05 + r() * 0.09})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Coordinated albedo / height / roughness maps for old, damp castle flagstones.
// Keeping the maps in sync is what makes joints recess instead of looking drawn on.
function ancientGroundTextures() {
  const S = 768;
  const albedo = document.createElement('canvas');
  const height = document.createElement('canvas');
  const rough = document.createElement('canvas');
  albedo.width = albedo.height = height.width = height.height = rough.width = rough.height = S;
  const a = albedo.getContext('2d'), h = height.getContext('2d'), q = rough.getContext('2d');
  let seed = 91357;
  const r = () => (seed = (seed * 48271) % 2147483647) / 2147483647;

  a.fillStyle = '#0d1017'; a.fillRect(0, 0, S, S);
  h.fillStyle = '#282828'; h.fillRect(0, 0, S, S);
  q.fillStyle = '#f0f0f0'; q.fillRect(0, 0, S, S);

  const rowH = 82;
  for (let row = -1; row < 11; row++) {
    const y = row * rowH;
    const offset = row % 2 ? -70 : -5;
    for (let col = -1; col < 8; col++) {
      const x = offset + col * 118;
      const inset = 4 + r() * 3;
      const pts = [
        [x + inset + r() * 5, y + inset + r() * 5],
        [x + 112 - inset - r() * 6, y + inset + r() * 4],
        [x + 112 - inset - r() * 5, y + rowH - inset - r() * 5],
        [x + inset + r() * 6, y + rowH - inset - r() * 4]
      ];
      const path = g => {
        g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
        for (let p = 1; p < pts.length; p++) g.lineTo(pts[p][0], pts[p][1]);
        g.closePath();
      };
      const tone = 25 + Math.floor(r() * 17);
      path(a); a.fillStyle = `rgb(${tone},${tone + 3},${tone + 10})`; a.fill();
      path(h); h.fillStyle = `rgb(${142 + r() * 34},${142 + r() * 34},${142 + r() * 34})`; h.fill();
      path(q); q.fillStyle = `rgb(${205 + r() * 42},${205 + r() * 42},${205 + r() * 42})`; q.fill();

      // Worn edges catch a thin line of moonlight; the interior stays porous and matte.
      path(a); a.strokeStyle = 'rgba(132,145,174,0.13)'; a.lineWidth = 1.4; a.stroke();
      if (r() < 0.35) {
        const cx = x + 22 + r() * 68, cy = y + 18 + r() * 42;
        a.strokeStyle = 'rgba(3,4,7,0.62)'; a.lineWidth = 1 + r() * 1.5;
        h.strokeStyle = '#343434'; h.lineWidth = 2.5;
        a.beginPath(); h.beginPath();
        a.moveTo(cx, cy); h.moveTo(cx, cy);
        for (let k = 1; k < 4; k++) {
          const px = cx + k * (8 + r() * 6), py = cy + (r() - 0.5) * 18;
          a.lineTo(px, py); h.lineTo(px, py);
        }
        a.stroke(); h.stroke();
      }
    }
  }

  // Mineral blooms, soot and moss live mostly in the mortar and low spots.
  for (let i = 0; i < 90; i++) {
    const x = r() * S, y = r() * S, rad = 8 + r() * 38;
    const stain = a.createRadialGradient(x, y, 0, x, y, rad);
    stain.addColorStop(0, r() < 0.55 ? 'rgba(18,32,27,0.22)' : 'rgba(5,5,8,0.26)');
    stain.addColorStop(1, 'rgba(0,0,0,0)');
    a.fillStyle = stain; a.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 7200; i++) {
    const x = r() * S, y = r() * S, v = r();
    a.fillStyle = v < 0.5 ? 'rgba(175,184,205,0.035)' : 'rgba(0,0,0,0.09)';
    a.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5);
    h.fillStyle = v < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
    h.fillRect(x, y, 1.2, 1.2);
  }

  const make = (canvas, color = false) => {
    const tex = new THREE.CanvasTexture(canvas);
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(19, 19);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  };
  return { map: make(albedo, true), bumpMap: make(height), roughnessMap: make(rough) };
}

function addGroundDebris() {
  const geo = new THREE.DodecahedronGeometry(0.13, 0);
  const mat = new THREE.MeshStandardMaterial({ color: 0x252a34, roughness: 1, metalness: 0 });
  const count = 360;
  const chips = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  let seed = 27182;
  const r = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    const radius = 16 + Math.sqrt(r()) * 150;
    const angle = r() * Math.PI * 2;
    dummy.position.set(Math.cos(angle) * radius, 0.02 + r() * 0.06, Math.sin(angle) * radius);
    dummy.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
    const scale = 0.35 + r() * 1.9;
    dummy.scale.set(scale * (0.8 + r()), scale * (0.25 + r() * 0.45), scale);
    dummy.updateMatrix();
    chips.setMatrixAt(i, dummy.matrix);
  }
  chips.receiveShadow = true;
  chips.castShadow = false;
  scene.add(chips);
}

// slab rows for the causeway; v-axis repeats along its length
function causewayTexture(len) {
  const tex = canvasTex(128, 256, (g, r) => {
    g.fillStyle = '#20232f'; g.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 256; y += 32) {
      const off = (y / 32) % 2 ? 32 : 0;
      for (let x = -32; x < 128; x += 64) {
        const tone = 30 + r() * 16;
        g.fillStyle = `rgb(${tone + 4},${tone + 6},${tone + 18})`;
        g.fillRect(x + off + 2, y + 2, 60, 28);
      }
    }
    for (let i = 0; i < 240; i++) {
      g.fillStyle = `rgba(${r() < 0.5 ? '190,200,235' : '0,0,0'},${0.02 + r() * 0.05})`;
      g.fillRect(r() * 128, r() * 256, 1.6, 1.6);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, Math.max(2, len / 5.5));
  return tex;
}

/* ---------- great-hall interior textures ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  let s = 4242;
  draw(c.getContext('2d'), () => (s = (s * 48271) % 2147483647) / 2147483647);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// warm-grey ashlar courses for the hall walls
function interiorStoneTexture() {
  return canvasTex(256, 256, (g, r) => {
    g.fillStyle = '#2a2636'; g.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) {
      g.fillStyle = 'rgba(0,0,0,0.32)';
      g.fillRect(0, y, 256, 1.6);
      const off = (y / 16) % 2 ? 16 : 0;
      for (let x = -off; x < 256; x += 32) {
        g.fillStyle = 'rgba(0,0,0,0.22)';
        g.fillRect(x + off, y, 1.4, 16);
        g.fillStyle = r() < 0.4 ? `rgba(214,182,140,${r() * 0.05})` : `rgba(150,160,210,${r() * 0.05})`;
        g.fillRect(x + off + 1, y + 1.6, 30, 14);
      }
    }
  });
}

// big two-tone stone slabs for the hall floor
function floorTileTexture() {
  return canvasTex(256, 256, (g, r) => {
    for (let ty = 0; ty < 4; ty++) for (let tx = 0; tx < 4; tx++) {
      g.fillStyle = (tx + ty) % 2 ? '#2c2836' : '#232030';
      g.fillRect(tx * 64, ty * 64, 64, 64);
      g.fillStyle = `rgba(${r() < 0.5 ? '190,180,220' : '0,0,0'},${0.02 + r() * 0.05})`;
      g.fillRect(tx * 64 + 3, ty * 64 + 3, 58, 58);
      g.strokeStyle = 'rgba(0,0,0,0.4)';
      g.lineWidth = 2;
      g.strokeRect(tx * 64 + 1, ty * 64 + 1, 62, 62);
    }
  });
}

// dark oak planks for the ceiling
function ceilingWoodTexture() {
  return canvasTex(256, 128, (g, r) => {
    g.fillStyle = '#20150d'; g.fillRect(0, 0, 256, 128);
    for (let y = 0; y < 128; y += 16) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, y, 256, 1.5);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `rgba(120,80,40,${r() * 0.08})`;
        g.fillRect(r() * 256, y + 2, 20 + r() * 60, 12);
      }
    }
  });
}

// deep red aisle runner with gold borders and diamond motifs
function carpetTexture() {
  return canvasTex(128, 512, (g, r) => {
    g.fillStyle = '#471016'; g.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(20,4,6,${r() * 0.25})`;
      g.fillRect(r() * 128, r() * 512, 2.5, 2.5);
    }
    g.strokeStyle = '#b08a46';
    g.lineWidth = 3; g.strokeRect(7, 7, 114, 498);
    g.lineWidth = 1.5; g.strokeRect(14, 14, 100, 484);
    g.save();
    g.strokeStyle = 'rgba(176,138,70,0.75)';
    g.lineWidth = 2;
    for (let y = 44; y < 490; y += 78) {
      g.beginPath();
      g.moveTo(64, y - 20); g.lineTo(84, y); g.lineTo(64, y + 20); g.lineTo(44, y);
      g.closePath(); g.stroke();
      g.beginPath(); g.arc(64, y, 5, 0, Math.PI * 2); g.stroke();
    }
    g.restore();
  });
}

// hanging banner with gold trim, emblem, and swallowtail bottom (transparent)
function bannerTexture(fieldColor) {
  return canvasTex(128, 320, (g, r) => {
    g.clearRect(0, 0, 128, 320);
    g.beginPath();
    g.moveTo(6, 0); g.lineTo(122, 0); g.lineTo(122, 268);
    g.lineTo(64, 236); g.lineTo(6, 268);
    g.closePath();
    g.fillStyle = fieldColor; g.fill();
    g.strokeStyle = '#b08a46'; g.lineWidth = 4; g.stroke();
    g.strokeStyle = 'rgba(176,138,70,0.9)';
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(64, 96, 34, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(64, 96, 22, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(64, 62); g.lineTo(64, 130); g.stroke();
    g.beginPath(); g.moveTo(42, 82); g.lineTo(86, 110); g.stroke();
    g.beginPath(); g.moveTo(86, 82); g.lineTo(42, 110); g.stroke();
    for (let i = 0; i < 260; i++) { // cloth weave
      g.fillStyle = `rgba(0,0,0,${r() * 0.12})`;
      g.fillRect(8 + r() * 112, r() * 262, 2, 2);
    }
  });
}

// oak door panel with iron straps and studs
function doorWoodTexture() {
  return canvasTex(128, 256, (g, r) => {
    g.fillStyle = '#3a2817'; g.fillRect(0, 0, 128, 256);
    for (let x = 0; x < 128; x += 22) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(x, 0, 1.6, 256);
      for (let i = 0; i < 6; i++) {
        g.fillStyle = `rgba(140,95,50,${r() * 0.1})`;
        g.fillRect(x + 2, r() * 256, 18, 12 + r() * 30);
      }
    }
    for (const y of [42, 128, 214]) { // iron straps
      g.fillStyle = '#15151c';
      g.fillRect(0, y - 7, 128, 14);
      for (let x = 10; x < 128; x += 24) {
        g.fillStyle = '#2c2c38';
        g.beginPath(); g.arc(x, y, 3.4, 0, Math.PI * 2); g.fill();
      }
    }
  });
}

// firebox interior: sooty bricks over a bed of glowing coals
function fireBackTexture() {
  return canvasTex(128, 128, (g, r) => {
    g.fillStyle = '#0a0708'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 14) {
      const off = (y / 14) % 2 ? 12 : 0;
      for (let x = -12; x < 128; x += 24) {
        g.fillStyle = `rgba(60,40,36,${0.25 + r() * 0.2})`;
        g.fillRect(x + off + 1, y + 1, 22, 12);
      }
    }
    const glow = g.createRadialGradient(64, 118, 4, 64, 118, 84);
    glow.addColorStop(0, 'rgba(255,170,70,0.95)');
    glow.addColorStop(0.4, 'rgba(220,90,30,0.5)');
    glow.addColorStop(1, 'rgba(120,30,10,0)');
    g.fillStyle = glow; g.fillRect(0, 0, 128, 128);
  });
}

// moonlit lancet pane with stone tracery (transparent around the arch)
function windowPaneTexture() {
  return canvasTex(64, 224, (g) => {
    g.clearRect(0, 0, 64, 224);
    const grad = g.createLinearGradient(0, 0, 0, 224);
    grad.addColorStop(0, 'rgba(200,214,248,0.95)');
    grad.addColorStop(1, 'rgba(120,140,190,0.75)');
    g.fillStyle = grad;
    lancetPath(g, 6, 6, 52, 212);
    g.fill();
    g.strokeStyle = 'rgba(10,10,18,0.85)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(32, 10); g.lineTo(32, 218); g.stroke();
    for (const y of [64, 118, 172]) {
      g.beginPath(); g.moveTo(8, y); g.lineTo(56, y); g.stroke();
    }
    g.lineWidth = 4;
    lancetPath(g, 6, 6, 52, 212);
    g.stroke();
  });
}

/* ================= boot ================= */
const env = buildScene();
Buildings();
const hall = GreatHall();
const explorableBuildings = ExplorableBuildings();
const outdoorResidents = OutdoorResidents();
const npcInteraction = NPCInteraction(outdoorResidents);
const rune = RuneMarker();
const particles = Particles(settings.prefs.quality === 'high' ? 900 : settings.prefs.quality === 'balanced' ? 650 : 400);
const floats = FloatingObjects();
const avatar = PlayerAvatar();
const ctrl = CameraController(avatar);
game = GameFlow(ctrl, avatar, env);
siege = SiegeLoop(ctrl, game);

// mode select: story keeps the normal flow; duel modes hand the frame to DuelSystem
let MODE = null, duel = null;
const menuEl = document.getElementById('menu');
function chooseMode(m) {
  if (MODE) return;
  const siegeMode = m === 'siege';
  MODE = siegeMode ? 'story' : m;   // siege reuses story-mode flight + combat input
  SkyAudio.init(); // menu click is a user gesture — audio may start
  SkyAudio.uiClick();
  menuEl.classList.add('gone');
  if (MODE !== 'story') {
    hintEl.classList.add('gone');
    avatar.group.visible = false;
    duel = DuelSystem(m);
  } else if (siegeMode) {
    hintEl.classList.add('gone');
    siege.start();
  }
}
menuEl.addEventListener('click', e => {
  const opt = e.target.closest('.mopt');
  if (opt) chooseMode(opt.dataset.mode);
});
// 1/2/3 pick a weapon (story mode only)
window.addEventListener('keydown', e => {
  if (MODE && MODE !== 'story') return;
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
      f: ctrl.state === 'flying' ? 1 : 0
    };
  }
});

camera.position.set(0, GROUND_Y, 4.4);
window.__sky = { scene, camera, renderer, composer, ctrl, avatar, game, siege, GAME, skyMultiplayer, COLLIDERS, resolveCollisions,
  SPELL_TARGETS, explorableBuildings, chooseMode, getDuel: () => duel, SkyAudio }; // console debugging handle

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
  env.updateSky(dt);
  const activePlayerPos = duel ? duel.P1.pos : ctrl.pos;
  hall.update(t, dt, activePlayerPos);
  explorableBuildings.update(t, dt, activePlayerPos);
  outdoorResidents.update(t, dt, activePlayerPos, !duel);
  npcInteraction.update(dt, activePlayerPos, !duel && ctrl.state === 'flying');
  particles.update(t, dt);
  floats.update(t, dt);
  skyMultiplayer.update(t, dt);
  if (duel) {
    duel.update(t, dt);
    SkyAudio.update(dt, duel.P1.pos.y, duel.P1.vel.length(), true);
    duel.render(); // first-person, split-screen when versus
  } else {
    ctrl.update(t, dt);
    if (game) game.update(t, dt);
    if (siege) siege.update(t, dt);
    SkyAudio.update(dt, ctrl.pos.y, ctrl.speed, ctrl.state !== 'ground');
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
