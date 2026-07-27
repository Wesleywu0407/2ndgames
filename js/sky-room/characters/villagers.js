import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { closeLoopingRootMotion } from './animation-utils.js?v=character-motion-1';

/* ================= Villager bodies ================= */
// Shared low-poly villager GLBs for the outdoor residents. Every resident
// starts as the procedural cloaked figure; when a body type finishes loading,
// figures upgrade in place. Missing or failed GLBs simply keep the fallback,
// so this module is safe to ship before the assets exist.

const VILLAGER_DIR = 'assets/models/characters/villagers/';
// Every commissioned villager and the Chancellor were authored facing +Z.
// Sky Room locomotion treats -Z as forward, so rotate the visual once inside
// its movement root instead of reversing every navigation heading.
const VILLAGER_GAMEPLAY_ROTATION_Y = Math.PI;

export const VILLAGER_BODIES = Object.freeze({
  'student-m': {
    model: `${VILLAGER_DIR}student-m/student-m.glb`,
    animations: [`${VILLAGER_DIR}student-m/anim-idle.glb`, `${VILLAGER_DIR}student-m/anim-walk.glb`]
  },
  'student-f': {
    model: `${VILLAGER_DIR}student-f/student-f.glb`,
    animations: [`${VILLAGER_DIR}student-f/anim-idle.glb`, `${VILLAGER_DIR}student-f/anim-walk.glb`]
  },
  elder: {
    model: `${VILLAGER_DIR}elder/elder.glb`,
    animations: [`${VILLAGER_DIR}elder/anim-idle.glb`, `${VILLAGER_DIR}elder/anim-walk.glb`]
  },
  matron: {
    model: `${VILLAGER_DIR}matron/matron.glb`,
    animations: [`${VILLAGER_DIR}matron/anim-idle.glb`, `${VILLAGER_DIR}matron/anim-walk.glb`]
  },
  warden: {
    model: `${VILLAGER_DIR}warden/warden.glb`,
    animations: [`${VILLAGER_DIR}warden/anim-idle.glb`, `${VILLAGER_DIR}warden/anim-walk.glb`]
  },
  // The Chancellor walks his own campus: reuse the playable hero's model.
  chancellor: {
    model: 'assets/models/characters/chancellor/chancellor.glb',
    animations: [
      'assets/models/characters/chancellor/anim-idle.glb',
      'assets/models/characters/chancellor/anim-walk.glb'
    ]
  }
});

const PROFILE_BODY_OVERRIDES = { 'resident-19': 'chancellor' };

const ARCHETYPE_BODIES = {
  student: ['student-m', 'student-f'],
  courier: ['student-m'],
  alchemist: ['student-f'],
  scholar: ['matron'],
  healer: ['matron'],
  dreamer: ['matron'],
  keeper: ['elder'],
  warden: ['warden'],
  duelist: ['warden']
};

function bodyKeyFor(profile) {
  const override = PROFILE_BODY_OVERRIDES[profile.id];
  if (override) return override;
  const options = ARCHETYPE_BODIES[profile.archetype];
  if (!options || !options.length) return null;
  const index = Number(String(profile.id).slice(-2)) || 0;
  return options[index % options.length];
}

const CLIP_HINTS = { idle: /idle/i, walk: /walk/i };

export function createVillagerFigureFactory({ ResidentCharacter }) {
  const loader = new GLTFLoader();
  const bodyCache = new Map();

  function loadBody(key) {
    if (bodyCache.has(key)) return bodyCache.get(key);
    const def = VILLAGER_BODIES[key];
    const promise = (async () => {
      const gltf = await loader.loadAsync(def.model);
      const clips = [...gltf.animations];
      for (const source of def.animations) {
        try {
          const library = await loader.loadAsync(source);
          clips.push(...library.animations);
        } catch (_) { /* a body with fewer clips still beats the fallback */ }
      }
      const idle = clips.find(clip => CLIP_HINTS.idle.test(clip.name));
      const authoredWalk = clips.find(clip => CLIP_HINTS.walk.test(clip.name)) || idle;
      if (!idle) throw new Error(`No idle clip for villager body ${key}`);
      const walk = authoredWalk === idle ? idle : closeLoopingRootMotion(authoredWalk);
      return { template: gltf.scene, idle, walk };
    })();
    promise.catch(() => { /* handled per-figure; keep cache entry to avoid retry storms */ });
    bodyCache.set(key, promise);
    return promise;
  }

  return function villagerFigure(profile) {
    const key = bodyKeyFor(profile);
    const fallback = ResidentCharacter(profile);
    if (!key || !VILLAGER_BODIES[key]) return fallback;

    const group = new THREE.Group();
    group.add(fallback.group);
    const state = {
      ready: false, mixer: null, idle: null, walk: null, current: null,
      bodyMat: null, hitFlash: 0, motion: 0, walking: false
    };

    loadBody(key).then(({ template, idle, walk }) => {
      const model = cloneSkeleton(template);
      model.rotation.y = VILLAGER_GAMEPLAY_ROTATION_Y;
      model.traverse(node => {
        if (node.isMesh || node.isSkinnedMesh) {
          node.frustumCulled = false;
          const material = Array.isArray(node.material) ? node.material[0] : node.material;
          if (material && !state.bodyMat) state.bodyMat = material;
        }
      });
      group.remove(fallback.group);
      group.add(model);
      state.mixer = new THREE.AnimationMixer(model);
      state.idle = state.mixer.clipAction(idle);
      state.walk = state.mixer.clipAction(walk);
      state.idle.play();
      state.current = state.idle;
      // Desynchronise identical bodies so crowds do not move in lockstep.
      state.idle.time = Math.random() * idle.duration;
      state.ready = true;
    }).catch(() => { /* fallback figure stays */ });

    return {
      group,
      get usesAuthoredAnimation() { return state.ready; },
      get weaponGroup() { return state.ready ? null : fallback.weaponGroup; },
      hit() {
        if (!state.ready) { fallback.hit?.(); return; }
        state.hitFlash = 1;
      },
      update(t, dt, motion = 0) {
        if (!state.ready) { fallback.update?.(t, dt, motion); return; }
        const requestedMotion = THREE.MathUtils.clamp(motion, 0, 1);
        const response = 1 - Math.exp(-Math.max(0, dt) * 10);
        state.motion += (requestedMotion - state.motion) * response;
        // Separate start/stop thresholds prevent rapid idle/walk flicker when
        // collision resolution leaves a resident barely moving.
        if (state.walking ? state.motion < 0.07 : state.motion > 0.14) {
          state.walking = !state.walking;
        }
        const desired = state.walking ? state.walk : state.idle;
        if (desired !== state.current) {
          desired.reset().fadeIn(0.24).play();
          state.current.fadeOut(0.24);
          state.current = desired;
        }
        if (desired === state.walk) {
          // Keep the long casual-walk clip close to a believable foot cadence.
          // The old 0.65 floor made slow residents visibly skate across paths.
          desired.setEffectiveTimeScale(0.86 + state.motion * 0.72);
        }
        state.mixer.update(dt);
        if (state.bodyMat) {
          state.hitFlash = Math.max(0, state.hitFlash - dt * 4);
          state.bodyMat.emissive?.setHex(state.hitFlash > 0 ? 0x8d5bb8 : 0x000000);
          state.bodyMat.emissiveIntensity = state.hitFlash * 1.6;
        }
      }
    };
  };
}
