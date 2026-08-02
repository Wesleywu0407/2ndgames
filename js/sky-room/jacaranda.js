import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = new URL(
  '../../assets/models/architecture/skyveil-jacaranda/skyveil-purple-jacaranda.glb',
  import.meta.url
).href;
const PETAL_TINTS = [0xffffff, 0xf2e7ff, 0xe6d3ff, 0xdac1fa, 0xf7e8ff];
const FLOOR_Y = 0.045;

function makePetalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const fill = ctx.createLinearGradient(50, 28, 205, 230);
  fill.addColorStop(0, '#eadcff');
  fill.addColorStop(0.38, '#b88ae8');
  fill.addColorStop(0.72, '#7540ae');
  fill.addColorStop(1, '#4a286f');
  ctx.beginPath();
  ctx.moveTo(128, 238);
  ctx.bezierCurveTo(94, 211, 49, 151, 60, 94);
  ctx.bezierCurveTo(68, 50, 104, 24, 128, 16);
  ctx.bezierCurveTo(153, 26, 189, 50, 197, 95);
  ctx.bezierCurveTo(207, 151, 162, 212, 128, 238);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(54, 25, 84, .72)';
  ctx.stroke();
  const highlight = ctx.createRadialGradient(103, 73, 4, 111, 92, 92);
  highlight.addColorStop(0, 'rgba(255,255,255,.7)');
  highlight.addColorStop(0.46, 'rgba(226,204,255,.22)');
  highlight.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = highlight;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(128, 229);
  ctx.bezierCurveTo(124, 174, 129, 112, 128, 38);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(217, 238, 255, .62)';
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(224, 203, 255, .38)';
  for (const side of [-1, 1]) for (let branch = 0; branch < 3; branch++) {
    const y = 92 + branch * 37;
    ctx.beginPath();
    ctx.moveTo(128, y + 18);
    ctx.quadraticCurveTo(128 + side * 26, y, 128 + side * (43 - branch * 5), y - 15);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeCurvedPetalGeometry() {
  const geometry = new THREE.PlaneGeometry(0.38, 0.58, 3, 5);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / 0.19;
    const y = (position.getY(i) + 0.29) / 0.58;
    position.setZ(i, Math.sin(y * Math.PI) * Math.max(0, 1 - Math.abs(x)) * 0.075 + x * x * 0.024);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function makeBellBlossomGeometry() {
  const radialSegments = 24;
  const lengthSegments = 7;
  const length = 0.58;
  const positions = [], colors = [], uvs = [], indices = [];
  const throat = new THREE.Color(0x54257d);
  const middle = new THREE.Color(0x9b61d0);
  const rim = new THREE.Color(0xe0c9ff);
  const color = new THREE.Color();
  for (let ring = 0; ring <= lengthSegments; ring++) {
    const t = ring / lengthSegments;
    const flare = t * t * (3 - 2 * t);
    for (let segment = 0; segment <= radialSegments; segment++) {
      const angle = segment / radialSegments * Math.PI * 2;
      const rimWeight = Math.max(0, (t - 0.48) / 0.52);
      const lobe = Math.cos(angle * 5) * 0.035 * rimWeight * rimWeight;
      const radius = 0.052 + flare * 0.17 + lobe;
      const y = (t - 0.5) * length + Math.max(0, t - 0.72) * Math.cos(angle * 5) * 0.055;
      positions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      if (t < 0.56) color.lerpColors(throat, middle, t / 0.56);
      else color.lerpColors(middle, rim, (t - 0.56) / 0.44);
      const edgeLight = 0.9 + Math.max(0, Math.cos(angle * 5)) * 0.1 * rimWeight;
      colors.push(color.r * edgeLight, color.g * edgeLight, color.b * edgeLight);
      uvs.push(segment / radialSegments, t);
    }
  }
  const stride = radialSegments + 1;
  for (let ring = 0; ring < lengthSegments; ring++) for (let segment = 0; segment < radialSegments; segment++) {
    const a = ring * stride + segment;
    const b = a + stride;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const base = positions.length / 3;
  positions.push(0, -length * 0.5, 0);
  colors.push(throat.r, throat.g, throat.b);
  uvs.push(0.5, 0);
  for (let segment = 0; segment < radialSegments; segment++) indices.push(base, segment + 1, segment);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function patchCanopyWind(root, controllers, materials) {
  root.traverse(object => {
    if (!object.isMesh || !object.geometry) return;
    // Twelve textured copies would otherwise be rendered again into the shadow
    // map. Moonlit contact comes from the ground receiver and ambient occlusion;
    // keeping these static trees out of the shadow pass avoids a large frame spike.
    object.castShadow = false;
    object.receiveShadow = true;
    object.geometry.computeBoundingBox();
    const box = object.geometry.boundingBox;
    const height = Math.max(box.max.y - box.min.y, 0.001);
    const canopyStart = box.min.y + height * 0.48;
    const source = Array.isArray(object.material) ? object.material : [object.material];
    const patched = source.map(original => {
      if (!original) return original;
      const material = original.clone();
      material.side = THREE.DoubleSide;
      const controller = { uniforms: null, height, material, baseEmissive: material.emissiveIntensity || 0 };
      material.onBeforeCompile = shader => {
        shader.uniforms.skyveilTime = { value: 0 };
        shader.uniforms.skyveilCanopyStart = { value: canopyStart };
        shader.uniforms.skyveilCanopyEnd = { value: box.max.y };
        shader.uniforms.skyveilSwayStrength = { value: height * 0.004 };
        shader.vertexShader = `uniform float skyveilTime;
          uniform float skyveilCanopyStart;
          uniform float skyveilCanopyEnd;
          uniform float skyveilSwayStrength;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float skyveilCanopyMask = smoothstep(skyveilCanopyStart, skyveilCanopyEnd, position.y);
           float skyveilLayeredWind = sin(skyveilTime * 0.72 + position.y * 1.37 + position.z * 0.41)
             + sin(skyveilTime * 1.11 + position.x * 0.83) * 0.42;
           transformed.x += skyveilLayeredWind * skyveilSwayStrength * skyveilCanopyMask;
           transformed.z += cos(skyveilTime * 0.63 + position.y * 1.09 + position.x * 0.35)
             * skyveilSwayStrength * 0.42 * skyveilCanopyMask;`
        );
        controller.uniforms = shader.uniforms;
      };
      material.customProgramCacheKey = () => 'skyveil-game-canopy-wind-v1';
      material.needsUpdate = true;
      controllers.push(controller);
      materials.push(material);
      return material;
    });
    object.material = Array.isArray(object.material) ? patched : patched[0];
  });
}

function makeFallbackTrees(treeData) {
  const root = new THREE.Group();
  root.name = 'SkyveilJacarandaFallback';
  const trunkGeometry = new THREE.CylinderGeometry(0.4, 0.64, 6.8, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x574438, roughness: 1 });
  const crownGeometry = new THREE.IcosahedronGeometry(2.35, 1);
  const crownMaterial = new THREE.MeshStandardMaterial({ color: 0x8d65ba, roughness: 0.96, emissive: 0x4b2b67, emissiveIntensity: 0.58 });
  for (const [x, z, size, phase] of treeData) {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    tree.rotation.y = phase;
    tree.scale.setScalar(size);
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 3.4;
    tree.add(trunk);
    for (let c = 0; c < 5; c++) {
      const angle = c / 5 * Math.PI * 2;
      const crown = new THREE.Mesh(crownGeometry, crownMaterial);
      crown.position.set(Math.cos(angle) * (c ? 1.8 : 0), 7 + (c % 2) * 0.65, Math.sin(angle) * (c ? 1.8 : 0));
      crown.scale.set(1.12, 0.72, 1.12);
      tree.add(crown);
    }
    root.add(tree);
  }
  return root;
}

export function createSkyveilJacarandas({
  scene, colliders, treeData, quality = 'balanced', reducedMotion = false,
  envThreatSources = [], envRestorePulses = []
}) {
  const root = new THREE.Group();
  root.name = 'SkyveilJacarandas';
  scene.add(root);
  const fallback = makeFallbackTrees(treeData);
  root.add(fallback);
  document.body.dataset.jacarandaState = 'loading';
  document.body.dataset.jacarandaTrees = String(treeData.length);

  for (const [x, z, size] of treeData) {
    colliders.push({ kind: 'cyl', x, z, r: 0.78 * size, y0: 0, y1: 10.2 * size });
  }

  const swayControllers = [];
  const treeMaterials = [];
  let loaded = false;
  let finaleAmount = 0;
  new GLTFLoader().loadAsync(MODEL_URL).then(gltf => {
    const template = gltf.scene;
    const initialBox = new THREE.Box3().setFromObject(template);
    const initialSize = initialBox.getSize(new THREE.Vector3());
    template.scale.setScalar(9 / Math.max(initialSize.y, 0.001));
    template.updateMatrixWorld(true);
    const normalizedBox = new THREE.Box3().setFromObject(template);
    const center = normalizedBox.getCenter(new THREE.Vector3());
    template.position.set(-center.x, -normalizedBox.min.y, -center.z);
    template.updateMatrixWorld(true);
    patchCanopyWind(template, swayControllers, treeMaterials);
    template.updateMatrixWorld(true);
    const treeMatrix = new THREE.Matrix4();
    const finalMatrix = new THREE.Matrix4();
    const treePosition = new THREE.Vector3();
    const treeRotation = new THREE.Quaternion();
    const treeEuler = new THREE.Euler();
    const treeScale = new THREE.Vector3();
    let batchIndex = 0;
    template.traverse(object => {
      if (!object.isMesh || !object.geometry || !object.material) return;
      const batch = new THREE.InstancedMesh(object.geometry, object.material, treeData.length);
      batch.name = `SkyveilJacarandaBatch${batchIndex++}`;
      batch.castShadow = false;
      batch.receiveShadow = true;
      batch.renderOrder = object.renderOrder;
      treeData.forEach(([x, z, size, phase], index) => {
        treePosition.set(x, 0, z);
        treeEuler.set(0, phase, 0);
        treeRotation.setFromEuler(treeEuler);
        treeScale.setScalar(size);
        treeMatrix.compose(treePosition, treeRotation, treeScale);
        finalMatrix.multiplyMatrices(treeMatrix, object.matrixWorld);
        batch.setMatrixAt(index, finalMatrix);
      });
      batch.instanceMatrix.needsUpdate = true;
      batch.computeBoundingSphere();
      root.add(batch);
    });
    fallback.visible = false;
    loaded = true;
    document.body.dataset.jacarandaState = 'ready';
  }).catch(error => {
    console.warn('SKYVEIL jacaranda GLB could not be loaded; keeping the lightweight fallback.', error);
    document.body.dataset.jacarandaState = 'fallback';
  });

  const total = quality === 'high' ? 160 : quality === 'performance' ? 64 : 104;
  const blossomCount = Math.max(4, Math.round(total * 0.13));
  const petalCount = total - blossomCount;
  document.body.dataset.jacarandaPetals = String(petalCount);
  document.body.dataset.jacarandaBellFlowers = String(blossomCount);
  const petalMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: makePetalTexture(), roughness: 0.74, metalness: 0,
    side: THREE.DoubleSide, transparent: true, opacity: 0.96, alphaTest: 0.08, depthWrite: false
  });
  const blossomMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.68, metalness: 0, side: THREE.DoubleSide,
    emissive: 0x160922, emissiveIntensity: 0.16
  });
  const petals = new THREE.InstancedMesh(makeCurvedPetalGeometry(), petalMaterial, petalCount);
  const blossoms = new THREE.InstancedMesh(makeBellBlossomGeometry(), blossomMaterial, blossomCount);
  petals.name = 'SkyveilFallingPetals';
  blossoms.name = 'SkyveilFallingBellFlowers';
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  blossoms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  petals.frustumCulled = blossoms.frustumCulled = false;
  root.add(petals, blossoms);

  let randomState = 0x53a91c7;
  const rand = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 4294967296;
  };
  const makeState = () => ({
    home: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
    age: 0, phase: 0, terminal: 0.32, sway: 0.2, swaySpeed: 1, airDrag: 1.5,
    rx: 0, ry: 0, rz: 0, spinX: 0, spinY: 0, spinZ: 0,
    scale: 1, landed: false, landAge: 0, landDuration: 4
  });
  const petalStates = Array.from({ length: petalCount }, makeState);
  const blossomStates = Array.from({ length: blossomCount }, makeState);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  function reset(state, index, mesh, wholeBlossom, spreadVertically) {
    state.home = index % treeData.length;
    const home = treeData[state.home];
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * 4.4 * home[2];
    state.x = home[0] + Math.cos(angle) * radius;
    state.z = home[1] + Math.sin(angle) * radius;
    state.y = spreadVertically ? FLOOR_Y + rand() * 9 * home[2] : 6.6 * home[2] + rand() * 2.2 * home[2];
    state.vx = (rand() - 0.5) * 0.05;
    state.vy = -(0.025 + rand() * 0.065);
    state.vz = (rand() - 0.5) * 0.05;
    state.age = rand() * 7;
    state.phase = rand() * Math.PI * 2;
    state.terminal = (0.22 + rand() * 0.27) * (wholeBlossom ? 0.82 : 1);
    state.sway = 0.12 + rand() * 0.34;
    state.swaySpeed = 0.58 + rand() * 0.9;
    state.airDrag = (wholeBlossom ? 1.15 : 1.45) + rand() * 0.55;
    state.rx = rand() * Math.PI;
    state.ry = rand() * Math.PI * 2;
    state.rz = rand() * Math.PI;
    state.spinX = (rand() - 0.5) * (wholeBlossom ? 0.9 : 1.35);
    state.spinY = (rand() - 0.5) * (wholeBlossom ? 1.15 : 1.8);
    state.spinZ = (rand() - 0.5) * (wholeBlossom ? 0.85 : 1.25);
    state.scale = wholeBlossom ? 0.58 + rand() * 0.42 : 0.55 + rand() * 0.68;
    state.landed = false;
    state.landAge = 0;
    state.landDuration = 3.2 + rand() * 2.8;
    tint.setHex(PETAL_TINTS[Math.floor(rand() * PETAL_TINTS.length)]);
    mesh.setColorAt(index, tint);
  }

  for (let i = 0; i < petalCount; i++) reset(petalStates[i], i, petals, false, true);
  for (let i = 0; i < blossomCount; i++) reset(blossomStates[i], i, blossoms, true, true);
  if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
  if (blossoms.instanceColor) blossoms.instanceColor.needsUpdate = true;

  function updateInstances(states, mesh, wholeBlossom, t, dt, playerPos) {
    const gravity = wholeBlossom ? 0.46 : 0.34;
    const friction = wholeBlossom ? 6.4 : 8.2;
    const motion = reducedMotion ? 0.24 : 1;
    const px = playerPos?.x ?? 9999, py = playerPos?.y ?? 9999, pz = playerPos?.z ?? 9999;
    for (let i = 0; i < states.length; i++) {
      const state = states[i];
      state.age += dt;
      let displayScale = state.scale;
      if (!state.landed) {
        const verticalDrag = gravity / Math.max(state.terminal * state.terminal, 0.01);
        state.vy += (-gravity - verticalDrag * state.vy * Math.abs(state.vy)) * dt;
        const breezeX = Math.sin(t * 0.34 + state.phase) * state.sway * 0.12 * motion;
        const breezeZ = Math.cos(t * 0.27 + state.phase) * state.sway * 0.075 * motion;
        state.vx += (-state.vx * state.airDrag + breezeX) * dt;
        state.vz += (-state.vz * state.airDrag + breezeZ) * dt;
        const dx = state.x - px, dy = state.y - py, dz = state.z - pz;
        const distance2 = dx * dx + dy * dy + dz * dz;
        if (distance2 < 30 && distance2 > 0.02) {
          const kick = (1 - Math.sqrt(distance2 / 30)) * (py > 3 ? 3.8 : 2.2);
          state.vx += dx * kick * dt * motion;
          state.vz += dz * kick * dt * motion;
        }
        for (const threat of envThreatSources) {
          if (!threat.active || !threat.position) continue;
          const tx = threat.position.x - state.x, tz = threat.position.z - state.z;
          const radius = threat.radius || 8;
          const distance = Math.hypot(tx, tz);
          if (distance >= radius || distance < 0.01) continue;
          const pull = (1 - distance / radius) * (threat.intensity || 1);
          state.vx += tx * pull * dt * 0.18 * motion;
          state.vz += tz * pull * dt * 0.18 * motion;
        }
        for (const pulse of envRestorePulses) {
          const rx = state.x - pulse.position.x, rz = state.z - pulse.position.z;
          const distance = Math.hypot(rx, rz) || 0.001;
          const waveRadius = pulse.radius * Math.min(1, pulse.age / 1.2);
          if (Math.abs(distance - waveRadius) > 3.5) continue;
          const lift = (1 - Math.abs(distance - waveRadius) / 3.5) * (1 - pulse.age / pulse.duration);
          state.vx += rx / distance * lift * dt * 4.2 * motion;
          state.vz += rz / distance * lift * dt * 4.2 * motion;
        }
        state.x += state.vx * dt;
        state.y += state.vy * dt;
        state.z += state.vz * dt;
        state.rx += state.spinX * dt * motion;
        state.ry += state.spinY * dt * motion;
        state.rz += state.spinZ * dt * motion;
        if (state.y <= FLOOR_Y) {
          state.landed = true;
          state.landAge = 0;
          state.y = FLOOR_Y + (wholeBlossom ? 0.08 : 0.025);
          state.vy = 0;
          state.vx *= wholeBlossom ? 0.38 : 0.28;
          state.vz *= wholeBlossom ? 0.38 : 0.28;
          state.rx = wholeBlossom ? Math.PI * 0.5 : -Math.PI * 0.5;
          state.ry = rand() * Math.PI * 2;
          state.rz = 0;
          state.spinX = state.spinY = state.spinZ = 0;
        }
        const home = treeData[state.home];
        if (Math.hypot(state.x - home[0], state.z - home[1]) > 9 * home[2]) reset(state, i, mesh, wholeBlossom, false);
      } else {
        state.landAge += dt;
        const groundDamping = Math.exp(-dt * friction);
        state.x += state.vx * dt;
        state.z += state.vz * dt;
        state.vx *= groundDamping;
        state.vz *= groundDamping;
        const fadeStart = state.landDuration * 0.76;
        if (state.landAge > fadeStart) {
          displayScale *= Math.max(0.015, 1 - (state.landAge - fadeStart) / (state.landDuration - fadeStart));
        }
        if (state.landAge >= state.landDuration) {
          reset(state, i, mesh, wholeBlossom, false);
          displayScale = state.scale;
        }
      }
      dummy.position.set(state.x, state.y, state.z);
      dummy.rotation.set(state.rx, state.ry, state.rz);
      const flutter = state.landed ? 1 : 0.92 + Math.abs(Math.sin(state.age * 2.6 + state.phase)) * 0.08;
      dummy.scale.set(displayScale * flutter, displayScale, displayScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return {
    get loaded() { return loaded; },
    update(t, dt, playerPos, visible = true) {
      petals.visible = blossoms.visible = visible;
      const motion = reducedMotion ? 0.24 : 1;
      for (const controller of swayControllers) {
        if (!controller.uniforms) continue;
        controller.uniforms.skyveilTime.value = t;
        controller.uniforms.skyveilSwayStrength.value = controller.height * (0.003 + motion * 0.0032);
      }
      if (!visible) return;
      updateInstances(petalStates, petals, false, t, dt, playerPos);
      updateInstances(blossomStates, blossoms, true, t, dt, playerPos);
    },
    finale(value) {
      finaleAmount = value;
      petalMaterial.opacity = 0.92 + finaleAmount * 0.08;
      for (const entry of swayControllers) {
        if (entry.material.emissive) entry.material.emissiveIntensity = entry.baseEmissive + finaleAmount * 0.26;
      }
    }
  };
}
