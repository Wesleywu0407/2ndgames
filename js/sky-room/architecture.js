import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  radialTexture, moonTexture, cloudTexture, ancientGroundTextures, addGroundDebris,
  causewayTexture, campusGrassTexture, campusBannerTexture, interiorStoneTexture,
  floorTileTexture, ceilingWoodTexture, carpetTexture, bannerTexture, doorWoodTexture,
  fireBackTexture, windowPaneTexture, canvasTex
} from './textures.js';
import { ARCHIVE_EVIDENCE_LAYOUT, createArchiveRoomExperience } from './archive-room.js';
import { INFIRMARY_PATIENT_LAYOUT, createInfirmaryRoomExperience } from './infirmary-room.js';
import { PRACTICE_TARGET_LAYOUT, createPracticeRoomExperience } from './practice-room.js';
import { ALCHEMY_VAT_LAYOUT, createAlchemyRoomExperience } from './alchemy-room.js';
import { OWLPOST_DESK, OWLPOST_ROUTE_LAYOUT, createOwlPostRoomExperience } from './owlpost-room.js';
import { createModularRoomKit } from './room-shell-kit.js';
import { GREAT_HALL_ENTRY_STEPS } from './room-registry.js?v=hall-entry-fix-1';
import { createSkyveilJacarandas } from './jacaranda.js?v=skyveil-jacaranda-1';

export function createArchitectureSystem(ctx) {
  const {
    renderer, scene, HALL, EXPLORABLES, roomRegistry, COLLIDERS, SPELL_TARGETS,
    ENV_THREAT_SOURCES, ENV_RESTORE_PULSES, LIT_MATS,
    AMBER, COOL, FLY_Y, GAME, settings, CloakedFigure,
    tr, storyCard, lerp, clamp, getRoomThreat = () => null,
    canInteractRoom = () => true,
    reportRoomProgress = () => false, REDUCED_MOTION = false
  } = ctx;
  let grassTufts = null;
  let academyFallbackGroup = null;
  let academyExteriorModel = null;
  let academyExteriorPromise = null;
  let academyExteriorStatus = 'fallback';

  // Quality settings may lower shadows, resolution and distant detail, but
  // they must not replace the academy's authored identity. The procedural
  // version is retained only as a load-failure fallback.
  const wantsAcademyExterior = () => academyExteriorStatus !== 'failed';

  function syncAcademyExteriorVisibility() {
    const useImported = Boolean(academyExteriorModel && wantsAcademyExterior());
    if (academyExteriorModel) academyExteriorModel.visible = useImported;
    if (academyFallbackGroup) academyFallbackGroup.visible = !useImported;
    renderer.domElement.dataset.academyExterior = useImported
      ? 'imported'
      : academyExteriorStatus === 'failed' ? 'fallback-error' : 'fallback';
  }

  function loadAcademyExterior() {
    if (academyExteriorModel || academyExteriorPromise || !wantsAcademyExterior()) {
      syncAcademyExteriorVisibility();
      return academyExteriorPromise;
    }
    academyExteriorStatus = 'loading';
    renderer.domElement.dataset.academyExterior = 'loading';
    const source = new URL(
      '../../assets/models/architecture/skyveil-academy/skyveil-academy.glb',
      import.meta.url
    ).href;
    academyExteriorPromise = new GLTFLoader().loadAsync(source).then(gltf => {
      const model = gltf.scene;
      const sourceBounds = new THREE.Box3().setFromObject(model);
      const sourceSize = sourceBounds.getSize(new THREE.Vector3());
      if (sourceSize.x <= 0 || sourceSize.y <= 0 || sourceSize.z <= 0) {
        throw new Error('SKYVEIL academy GLB has invalid bounds');
      }

      // The generated GLB is normalised to a near-square footprint. Refit it to
      // the authored Great Hall facade, its rear bell towers, and the entrance
      // line without changing gameplay/collision coordinates.
      const targetWidth = 80.4;
      const targetHeight = 52;
      const targetDepth = 31;
      model.scale.set(
        targetWidth / sourceSize.x,
        targetHeight / sourceSize.y,
        targetDepth / sourceSize.z
      );
      model.rotation.y = HALL.ry;
      model.updateMatrixWorld(true);

      const fittedBounds = new THREE.Box3().setFromObject(model);
      const fittedCentre = fittedBounds.getCenter(new THREE.Vector3());
      const hallFrontZ = HALL.z + HALL.d / 2;
      model.position.x += HALL.x - fittedCentre.x;
      model.position.y += 0.02 - fittedBounds.min.y;
      model.position.z += hallFrontZ - fittedBounds.max.z;
      model.name = 'SKYVEIL_Academy_Exterior';
      model.userData.skyveilAcademyExterior = true;
      let academyMeshes = 0;
      let academyTriangles = 0;
      model.traverse(node => {
        if (!node.isMesh) return;
        academyMeshes += 1;
        const geometryCount = node.geometry?.index?.count
          ?? node.geometry?.attributes?.position?.count
          ?? 0;
        academyTriangles += Math.floor(geometryCount / 3);
        node.castShadow = settings.prefs.quality === 'high';
        node.receiveShadow = true;
        node.frustumCulled = true;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
          if (!material) continue;
          material.roughness = Math.max(0.72, material.roughness ?? 0.72);
          material.metalness = Math.min(0.22, material.metalness ?? 0.05);
          for (const textureName of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
            const texture = material[textureName];
            if (texture) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          }
        }
      });
      model.updateMatrixWorld(true);
      const finalBounds = new THREE.Box3().setFromObject(model);
      const finalSize = finalBounds.getSize(new THREE.Vector3());
      renderer.domElement.dataset.academyExteriorBounds = finalSize
        .toArray()
        .map(value => value.toFixed(2))
        .join(',');
      renderer.domElement.dataset.academyExteriorMeshes = String(academyMeshes);
      renderer.domElement.dataset.academyExteriorTriangles = String(academyTriangles);
      scene.add(model);
      academyExteriorModel = model;
      academyExteriorStatus = 'ready';
      academyExteriorPromise = null;
      syncAcademyExteriorVisibility();
      return model;
    }).catch(error => {
      academyExteriorStatus = 'failed';
      academyExteriorPromise = null;
      syncAcademyExteriorVisibility();
      console.warn('[SKYVEIL] Academy exterior failed; procedural fallback retained.', error);
      return null;
    });
    return academyExteriorPromise;
  }

  function buildScene() {
    // Ancient flagstone terrain.  The original single colour map made the whole
    // courtyard read like polished plastic; these maps give the moonlight real
    // joints, chips and porous stone to catch.
    const groundMaps = ancientGroundTextures(renderer);
    const grassMap = campusGrassTexture();
    grassMap.wrapS = grassMap.wrapT = THREE.RepeatWrapping;
    grassMap.repeat.set(34, 34);
    grassMap.anisotropy = 4;
    const grassMat = new THREE.MeshStandardMaterial({
      map: grassMap, roughness: 1, metalness: 0.0, color: 0x718064
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(440, 440, 128, 128), grassMat);
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
      new THREE.CircleGeometry(11.5, 72),
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
      const startK = 10.8 / Math.hypot(doorX, doorZ); // begin at the smaller rune-court rim
      const sx = doorX * startK, sz = doorZ * startK;
      const len = Math.hypot(doorX - sx, doorZ - sz) + 3;
      const wayMap = causewayTexture(len);
      const wayBump = causewayTexture(len);
      wayBump.colorSpace = THREE.NoColorSpace;
      const way = new THREE.Mesh(
        new THREE.PlaneGeometry(5.2, len),
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
  
    // UQ-inspired landscape: lawns, jacarandas, eucalyptus, garden beds and
    // campus-scale props turn the exterior into a lived-in Great Court rather
    // than an exposed stone platform.
    const campus = CampusGrounds(grassMat);
  
    // Loose chips and small stones break the clean CG horizon at foot level.
    addGroundDebris(scene);
  
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
  
    // A restrained warm bounce keeps the Brisbane sandstone identity visible
    // against the cool night without turning the whole court into daylight.
    const sandstoneFill = new THREE.SpotLight(0xd5a86f, 155, 150, 0.66, 0.96, 1.15);
    sandstoneFill.position.set(0, 26, 18);
    sandstoneFill.target.position.set(HALL.x, 10, HALL.z);
    scene.add(sandstoneFill, sandstoneFill.target);
  
    const dawnSun = new THREE.DirectionalLight(0xffc886, 0);
    dawnSun.position.set(-70, 55, 90);
    dawnSun.target.position.set(HALL.x, 6, HALL.z);
    scene.add(dawnSun, dawnSun.target);
  
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
    const skyNight = scene.background.clone();
    const skyDawn = new THREE.Color(0x6f728c);
    const fogNight = scene.fog.color.clone();
    const fogDawn = new THREE.Color(0xb49b8a);
  
    return {
      rayMats: [rayMat, rayInner.material], spot,
      updateSky(t, dt, playerPos) {
        for (const c of clouds) {
          c.position.x += c.userData.v * dt;
          if (c.position.x > 260) c.position.x = -260;
        }
        campus.update(t, dt, playerPos);
      },
      finale(k) { // the waking city: every lamp and window swells with light
        scene.background.lerpColors(skyNight, skyDawn, k);
        scene.fog.color.lerpColors(fogNight, fogDawn, k);
        scene.fog.near = 14 + 18 * k;
        scene.fog.far = 230 + 55 * k;
        moonLight.intensity = 2.3 + 0.8 * k;
        dawnSun.intensity = 2.4 * k;
        sandstoneFill.intensity = 155 + 210 * k;
        villagesPts.material.opacity = 0.85 + 0.15 * k;
        villagesPts.material.size = 1.5 + 1.1 * k;
        for (const m of LIT_MATS) m.emissiveIntensity = 1.7 + 1.2 * k;
        campus.finale(k);
      }
    };
  }
  
  /* ================= Campus grounds (UQ-inspired Great Court) ================= */
  function CampusGrounds(grassMat) {
    const stoneMap = ancientGroundTextures(renderer).map;
    stoneMap.wrapS = stoneMap.wrapT = THREE.RepeatWrapping;
    stoneMap.repeat.set(1, 6);
  
    const pathMat = new THREE.MeshStandardMaterial({
      map: stoneMap, color: 0xb7aa91, roughness: 0.96, metalness: 0
    });
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x263126, roughness: 1, metalness: 0 });
    const borderMat = new THREE.MeshStandardMaterial({ color: 0x8d806d, roughness: 0.95, metalness: 0 });
    const timber = new THREE.MeshStandardMaterial({ color: 0x4b3324, roughness: 0.9, metalness: 0.02 });
    const timberEdge = new THREE.MeshStandardMaterial({ color: 0x241b18, roughness: 0.82, metalness: 0.08 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.52, metalness: 0.62 });
    const crownSystems = [];
    const lampPools = [];
    const pathMaterials = [];
  
    const addPath = (x1, z1, x2, z2, width = 3.4) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, len), pathMat.clone());
      mesh.material.map = stoneMap.clone();
      mesh.material.map.repeat.set(1, Math.max(2, len / 5.5));
      mesh.material.map.needsUpdate = true;
      pathMaterials.push(mesh.material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = Math.atan2(-(x2 - x1), -(z2 - z1));
      mesh.position.set((x1 + x2) / 2, 0.016, (z1 + z2) / 2);
      mesh.receiveShadow = true;
      scene.add(mesh);
    };
  
    // Secondary paths make the five explorable buildings feel like one campus.
    addPath(-7, -18, -32, -25, 3.1);
    addPath(7, -18, 32, -27, 3.1);
    addPath(-8, 3, -47, -7, 2.8);
    addPath(8, 3, 47, -9, 2.8);
    addPath(0, 10, 0, 42, 3.2);
  
    const gardenBeds = [
      [-16, -17, 5.8, 3.6, -0.12], [17, -20, 6.4, 3.8, 0.18],
      [-25, -43, 6.8, 4.2, 0.2], [25, -47, 6.5, 4.0, -0.2],
      [-30, 15, 5.8, 3.7, 0.42], [31, 17, 6.1, 3.8, -0.35]
    ];
    for (const [x, z, sx, sz, rz] of gardenBeds) {
      const bed = new THREE.Mesh(new THREE.CircleGeometry(1, 40), bedMat);
      bed.rotation.x = -Math.PI / 2;
      bed.rotation.z = rz;
      bed.scale.set(sx, sz, 1);
      bed.position.set(x, 0.02, z);
      bed.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.94, 1.04, 40), borderMat);
      rim.rotation.copy(bed.rotation);
      rim.scale.copy(bed.scale);
      rim.position.set(x, 0.028, z);
      scene.add(bed, rim);
    }
  
    const jacarandas = [
      [-14, -16, 1.05, 0.1], [15, -19, 1.12, 1.8],
      [-24, -40, 1.18, 0.7], [24, -44, 1.08, 2.4],
      [-35, -7, 0.92, 1.2], [36, -9, 0.96, 2.9],
      [-29, 15, 1.02, 0.4], [30, 17, 1.08, 2.1],
      [-13, 31, 0.94, 1.5], [14, 33, 0.98, 0.3],
      [-45, -34, 1.12, 2.6], [46, -38, 1.06, 0.9]
    ];
    const eucalyptus = [
      [-54, -58, 1.2, 0.4], [53, -61, 1.15, 2.2],
      [-59, -19, 1.05, 1.4], [60, -23, 1.12, 0.1],
      [-54, 24, 1.18, 2.6], [55, 29, 1.08, 0.8],
      [-36, 48, 1.12, 1.8], [38, 50, 1.2, 0.2],
      [-67, -78, 1.25, 2.8], [66, -81, 1.18, 1.1],
      [-44, -93, 1.05, 0.5], [47, -96, 1.15, 2.5]
    ];
  
    function plantTrees(data, kind) {
      const trunkGeo = kind === 'jacaranda'
        ? new THREE.CylinderGeometry(0.36, 0.58, 6.2, 8)
        : new THREE.CylinderGeometry(0.34, 0.72, 8.2, 8);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: kind === 'jacaranda' ? 0x574438 : 0x777266,
        roughness: 1, metalness: 0
      });
      const trunkBatch = new THREE.InstancedMesh(trunkGeo, trunkMat, data.length);
      const crownCount = kind === 'jacaranda' ? 5 : 4;
      const crownGeo = kind === 'jacaranda'
        ? new THREE.IcosahedronGeometry(2.35, 1)
        : new THREE.IcosahedronGeometry(1.9, 1);
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.96, metalness: 0, vertexColors: true,
        emissive: kind === 'jacaranda' ? 0x4b2b67 : 0x1b291d,
        emissiveIntensity: kind === 'jacaranda' ? 0.62 : 0.34
      });
      const crowns = new THREE.InstancedMesh(crownGeo, crownMat, data.length * crownCount);
      const matrix = new THREE.Matrix4();
      const quat = new THREE.Quaternion();
      const euler = new THREE.Euler();
      const pos = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const jacColors = [0x8d65ba, 0xa77aca, 0x7650a4, 0xb18bd0, 0x694692];
      const gumColors = [0x61745e, 0x74836c, 0x526753, 0x839078];
      const records = [];
      let crownIndex = 0;
      data.forEach(([x, z, size, phase], i) => {
        const trunkH = (kind === 'jacaranda' ? 6.2 : 8.2) * size;
        euler.set(0, phase, kind === 'jacaranda' ? Math.sin(phase) * 0.035 : Math.cos(phase) * 0.06);
        quat.setFromEuler(euler);
        pos.set(x, trunkH / 2, z);
        scale.set(size, size, size);
        matrix.compose(pos, quat, scale);
        trunkBatch.setMatrixAt(i, matrix);
        COLLIDERS.push({ kind: 'cyl', x, z, r: 0.62 * size, y0: 0, y1: trunkH + 1.2 });
  
        for (let c = 0; c < crownCount; c++) {
          const a = phase + (c / crownCount) * Math.PI * 2;
          const spread = kind === 'jacaranda' ? (c === 0 ? 0 : 2.0) : (c === 0 ? 0.3 : 1.65);
          const top = kind === 'jacaranda' ? trunkH + 1.1 : trunkH + 1.0;
          pos.set(x + Math.cos(a) * spread * size, top + (c % 2) * 0.7 * size, z + Math.sin(a) * spread * size);
          euler.set(phase * 0.2, a, (c - 2) * 0.08);
          quat.setFromEuler(euler);
          const wide = kind === 'jacaranda' ? 1.22 : 0.82;
          scale.set(size * wide * (0.88 + (c % 3) * 0.08), size * (kind === 'jacaranda' ? 0.72 : 1.05), size * wide);
          matrix.compose(pos, quat, scale);
          crowns.setMatrixAt(crownIndex, matrix);
          crowns.setColorAt(crownIndex, new THREE.Color(
            kind === 'jacaranda' ? jacColors[(i + c) % jacColors.length] : gumColors[(i + c) % gumColors.length]
          ));
          records.push({
            index: crownIndex, x: pos.x, y: pos.y, z: pos.z,
            rx: euler.x, ry: euler.y, rz: euler.z,
            sx: scale.x, sy: scale.y, sz: scale.z,
            phase: phase + c * 0.77
          });
          crownIndex++;
        }
      });
      trunkBatch.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
      if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
      trunkBatch.castShadow = trunkBatch.receiveShadow = true;
      crowns.castShadow = crowns.receiveShadow = true;
      crowns.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(trunkBatch, crowns);
      crownSystems.push({ crowns, crownMat, records, kind });
    }
    plantTrees(eucalyptus, 'eucalyptus');
    const skyveilJacarandas = createSkyveilJacarandas({
      scene,
      colliders: COLLIDERS,
      treeData: jacarandas,
      quality: settings.prefs.quality,
      reducedMotion: REDUCED_MOTION,
      envThreatSources: ENV_THREAT_SOURCES,
      envRestorePulses: ENV_RESTORE_PULSES
    });
  
    function addBench(x, z, ry) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = ry;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 0.72), timber);
      seat.position.y = 0.7;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.16, 0.7), timber);
      back.position.set(0, 1.08, 0.31);
      back.rotation.x = -0.18;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.1, 0.09), timberEdge);
      frame.position.set(0, 0.9, 0.43);
      group.add(seat, back, frame);
      for (const xLeg of [-0.9, 0.9]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.72, 0.62), iron);
        leg.position.set(xLeg, 0.35, 0);
        group.add(leg);
      }
      group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(group);
      COLLIDERS.push({ kind: 'box', x, z, hw: 1.4, hd: 0.52, y0: 0, y1: 1.45, cos: Math.cos(ry), sin: Math.sin(ry) });
    }
    [
      [-19, -10, -0.22], [20, -12, 0.18], [-29, -34, -0.1], [29, -37, 0.1],
      [-19, 20, 0.5], [20, 23, -0.45], [-8, 39, Math.PI / 2], [9, 39, -Math.PI / 2]
    ].forEach(b => addBench(...b));
  
    const lampSpots = [
      [-5.2, -18], [5.2, -18], [-5.2, -34], [5.2, -34],
      [-5.2, -50], [5.2, -50], [-5.2, -66], [5.2, -66],
      [-20, 4], [20, 4], [-27, -23], [28, -25]
    ];
    const lampGlow = radialTexture('rgba(255,218,150,1)', 'rgba(255,178,90,0)', 64);
    for (let i = 0; i < lampSpots.length; i++) {
      const [x, z] = lampSpots[i];
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 3.3, 8), iron);
      post.position.set(x, 1.65, z);
      const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.32, 8), iron);
      hood.position.set(x, 3.42, z);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: lampGlow, color: 0xffd08b, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.position.set(x, 3.18, z);
      glow.scale.setScalar(0.8);
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.8), new THREE.MeshBasicMaterial({
        map: radialTexture('rgba(255,191,104,0.52)', 'rgba(255,177,86,0)', 96),
        transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, 0.034, z);
      pool.userData.baseOpacity = 0.16;
      lampPools.push(pool);
      scene.add(post, hood, glow, pool);
      if (i % 3 === 0) {
        const light = new THREE.PointLight(0xffbd72, 5.5, 12, 1.9);
        light.position.set(x, 3.1, z);
        scene.add(light);
      }
      COLLIDERS.push({ kind: 'cyl', x, z, r: 0.22, y0: 0, y1: 3.7 });
    }
  
    // Purple UQ-inspired banners announce the Great Court from the central walk.
    const bannerTex = campusBannerTexture();
    for (const x of [-7.2, 7.2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 5.2, 8), iron);
      pole.position.set(x, 2.6, -59);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 2.7), new THREE.MeshStandardMaterial({
        map: bannerTex, transparent: true, side: THREE.DoubleSide, roughness: 0.9
      }));
      banner.position.set(x + Math.sign(x) * 0.68, 3.55, -59);
      banner.rotation.y = Math.PI / 2;
      scene.add(pole, banner);
    }
  
    function addBike(x, z, ry, color) {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = ry;
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.55, metalness: 0.55 });
      const frameMat = new THREE.MeshStandardMaterial({ color, roughness: 0.48, metalness: 0.62 });
      for (const wx of [-0.72, 0.72]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.035, 7, 24), wheelMat);
        wheel.position.set(wx, 0.5, 0);
        group.add(wheel);
      }
      const bars = [[0, 0.58, 0, 1.28, 0.055, 0.055, 0.1], [-0.28, 0.78, 0, 0.82, 0.05, 0.05, -0.62], [0.3, 0.82, 0, 0.78, 0.05, 0.05, 0.72]];
      for (const [bx, by, bz, bw, bh, bd, rz] of bars) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), frameMat);
        bar.position.set(bx, by, bz); bar.rotation.z = rz; group.add(bar);
      }
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.18), wheelMat);
      seat.position.set(-0.18, 1.18, 0); group.add(seat);
      group.traverse(o => { if (o.isMesh) o.castShadow = true; });
      scene.add(group);
    }
    addBike(-10.5, -60, 0.08, 0x6f4b88);
    addBike(11.5, -61.5, -0.16, 0x9b6b42);
    addBike(-34, 4, 1.18, 0x496d72);
  
    // Small personal objects keep the lawn from feeling dressed only at city scale.
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x6d3d35, roughness: 0.96 });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xd5c6a9, roughness: 0.92 });
    for (const [x, z, rot] of [[-18.1, -10.7, 0.3], [19.1, -12.6, -0.2], [-18.5, 19.2, 0.8]]) {
      const bag = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.5, 0.3), bagMat);
      bag.position.set(x, 0.26, z); bag.rotation.y = rot;
      const book = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.56), paperMat);
      book.position.set(x + 0.45, 0.07, z + 0.12); book.rotation.y = rot + 0.3;
      bag.castShadow = book.castShadow = true;
      scene.add(bag, book);
    }
  
    // Small grass silhouettes catch the low lamp light without adding a dense
    // high-poly lawn. The textured ground remains the performance baseline.
    {
      const tuftCount = settings.prefs.quality === 'high' ? 260 : settings.prefs.quality === 'balanced' ? 190 : 120;
      const tuftGeo = new THREE.BufferGeometry();
      tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute([
        -0.11, 0, 0, 0, 0.5, 0, 0.11, 0, 0,
        0, 0, -0.09, 0, 0.42, 0, 0, 0, 0.09
      ], 3));
      tuftGeo.computeVertexNormals();
      const tuftMat = new THREE.MeshBasicMaterial({ color: 0x3f5740, side: THREE.DoubleSide, transparent: true, opacity: 0.56 });
      const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
      grassTufts = tufts;
      const matrix = new THREE.Matrix4();
      const quat = new THREE.Quaternion();
      const euler = new THREE.Euler();
      const pos = new THREE.Vector3();
      const scale = new THREE.Vector3();
      let seed = 81283;
      const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
      for (let i = 0; i < tuftCount; i++) {
        let x = (rand() - 0.5) * 112, z = (rand() - 0.5) * 126 - 10;
        if (Math.abs(x) < 5.2 || Math.hypot(x, z) < 13) x += Math.sign(x || (rand() - 0.5)) * 7;
        pos.set(x, 0.035, z);
        euler.set(0, rand() * Math.PI * 2, 0);
        quat.setFromEuler(euler);
        const s = 0.65 + rand() * 0.8;
        scale.set(s, s, s);
        matrix.compose(pos, quat, scale);
        tufts.setMatrixAt(i, matrix);
      }
      tufts.instanceMatrix.needsUpdate = true;
      scene.add(tufts);
    }
  
    // Fireflies cluster around the warm pools; small bird silhouettes circle the
    // hall roofline so the court never feels frozen before enemies arrive.
    const insectCount = 48;
    const insectPositions = new Float32Array(insectCount * 3);
    const insectBase = [];
    for (let i = 0; i < insectCount; i++) {
      const lamp = lampSpots[i % lampSpots.length];
      const a = (i * 2.399) % (Math.PI * 2), r = 1.2 + (i % 5) * 0.38;
      insectBase.push({ x: lamp[0] + Math.cos(a) * r, z: lamp[1] + Math.sin(a) * r, y: 1.4 + (i % 7) * 0.22, ph: i * 0.83 });
    }
    const insectGeo = new THREE.BufferGeometry();
    const insectAttr = new THREE.BufferAttribute(insectPositions, 3);
    insectAttr.setUsage(THREE.DynamicDrawUsage);
    insectGeo.setAttribute('position', insectAttr);
    const insects = new THREE.Points(insectGeo, new THREE.PointsMaterial({
      map: radialTexture('rgba(255,232,151,1)', 'rgba(255,183,80,0)', 32),
      color: 0xffd483, size: 0.18, sizeAttenuation: true,
      transparent: true, opacity: 0.72, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    insects.frustumCulled = false;
    scene.add(insects);
  
    const birds = [];
    const birdMat = new THREE.LineBasicMaterial({ color: 0x8891aa, transparent: true, opacity: 0.42 });
    for (let i = 0; i < 7; i++) {
      const birdGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.38, 0, 0), new THREE.Vector3(0, 0.14, 0), new THREE.Vector3(0.38, 0, 0)
      ]);
      const bird = new THREE.Line(birdGeo, birdMat);
      bird.userData = { radius: 27 + i * 3.8, speed: 0.035 + i * 0.003, phase: i * 0.9, y: 18 + (i % 3) * 2.4 };
      scene.add(bird); birds.push(bird);
    }
  
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const grassNight = new THREE.Color(0x718064), grassDawn = new THREE.Color(0xb2bd7d);
    const pathNight = new THREE.Color(0xb7aa91), pathDawn = new THREE.Color(0xe0cba6);
    let campusFinaleK = 0;
  
    return {
      update(t, dt, playerPos) {
        const motionScale = REDUCED_MOTION ? 0.18 : 1;
        const px = playerPos?.x ?? 9999, py = playerPos?.y ?? 9999, pz = playerPos?.z ?? 9999;
        const campusDistance = Math.hypot(px, pz);
        const animateCanopies = campusDistance < 115 && py < 58;
        const showGroundDetail = campusDistance < 128 && py < 68;
        if (grassTufts) grassTufts.visible = showGroundDetail;
        insects.visible = campusDistance < 105 && py < 48;
        for (let i = ENV_RESTORE_PULSES.length - 1; i >= 0; i--) {
          ENV_RESTORE_PULSES[i].age += dt;
          if (ENV_RESTORE_PULSES[i].age >= ENV_RESTORE_PULSES[i].duration) ENV_RESTORE_PULSES.splice(i, 1);
        }
        const restoreGlow = ENV_RESTORE_PULSES.reduce((best, pulse) =>
          Math.max(best, 1 - pulse.age / pulse.duration), 0);
        skyveilJacarandas.update(t, dt, playerPos, showGroundDetail);
        // Canopy motion stays deliberately slow: this is weighty foliage, not seaweed.
        for (const system of crownSystems) {
          const amount = (system.kind === 'jacaranda' ? 0.07 : 0.105) * motionScale;
          if (animateCanopies) {
            for (const record of system.records) {
              const sway = Math.sin(t * 0.42 + record.phase) * amount;
              pos.set(record.x + sway * 0.7, record.y + Math.sin(t * 0.31 + record.phase) * 0.025 * motionScale, record.z + sway);
              euler.set(record.rx + sway * 0.08, record.ry, record.rz + sway * 0.16);
              quat.setFromEuler(euler);
              scale.set(record.sx, record.sy, record.sz);
              matrix.compose(pos, quat, scale);
              system.crowns.setMatrixAt(record.index, matrix);
            }
            system.crowns.instanceMatrix.needsUpdate = true;
          }
          system.crownMat.emissiveIntensity = (system.kind === 'jacaranda' ? 0.62 : 0.34)
            + campusFinaleK * 0.28 + restoreGlow * (system.kind === 'jacaranda' ? 0.72 : 0.28);
        }
  
        if (insects.visible) for (let i = 0; i < insectCount; i++) {
          const base = insectBase[i], ix = i * 3;
          insectPositions[ix] = base.x + Math.sin(t * 0.8 + base.ph) * 0.45;
          insectPositions[ix + 1] = base.y + Math.sin(t * 1.35 + base.ph * 1.7) * 0.32;
          insectPositions[ix + 2] = base.z + Math.cos(t * 0.72 + base.ph) * 0.45;
        }
        insectAttr.needsUpdate = insects.visible;
  
        for (const pool of lampPools) {
          let corruption = 0;
          for (const threat of ENV_THREAT_SOURCES) {
            if (!threat.active || !threat.position) continue;
            const distance = Math.hypot(pool.position.x - threat.position.x, pool.position.z - threat.position.z);
            const radius = (threat.radius || 8) * 1.8;
            if (distance < radius) corruption = Math.max(corruption, (1 - distance / radius) * (threat.intensity || 1));
          }
          pool.material.opacity = (0.16 + campusFinaleK * 0.11) * (1 - Math.min(0.86, corruption * 0.82));
        }
  
        for (const bird of birds) {
          const d = bird.userData;
          const a = t * d.speed + d.phase;
          bird.position.set(Math.cos(a) * d.radius, d.y + Math.sin(a * 2) * 0.8, -43 + Math.sin(a) * d.radius * 0.42);
          bird.rotation.y = -a;
          bird.rotation.z = Math.sin(t * 2.4 + d.phase) * 0.12;
        }
      },
      finale(k) {
        campusFinaleK = k;
        grassMat.color.lerpColors(grassNight, grassDawn, k);
        bedMat.color.setRGB(0.15 + 0.12 * k, 0.19 + 0.16 * k, 0.15 + 0.08 * k);
        for (const mat of pathMaterials) mat.color.lerpColors(pathNight, pathDawn, k);
        for (const system of crownSystems) {
          system.crownMat.emissiveIntensity = (system.kind === 'jacaranda' ? 0.62 : 0.34) + k * 0.28;
        }
        for (const pool of lampPools) pool.userData.baseOpacity = 0.16 + k * 0.11;
        skyveilJacarandas.finale(k);
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
    const tones = ['#756b5e', '#827463', '#6b6258', '#8c7964', '#655d55', '#7a6d5e', '#92745f'];
    for (let y = 0; y < ch; y += 14) {
      const off = (y / 14) % 2 ? 12 : 0;
      for (let x = -24; x < cw; x += 24) {
        b.fillStyle = tones[Math.floor(rand() * tones.length)];
        b.fillRect(x + off, y, 24, 14);
        if (rand() < 0.14) { // the occasional rose-tinged Brisbane sandstone block
          b.fillStyle = 'rgba(155,93,72,0.24)';
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
    function crenellate(px, pz, w, d, yTop, ry, parent = scene) {
      const cosr = Math.cos(ry), sinr = Math.sin(ry);
      const put = (lx, lz, along) => merlonSpots.push({
        x: px + lx * cosr + lz * sinr, y: yTop + 0.42, z: pz - lx * sinr + lz * cosr,
        ry: ry + (along ? 0 : Math.PI / 2), parent
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
    function tower(px, pz, r, h, parent = scene) {
      const body = solid(new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.82, r, h, 12), litStone(Math.PI * 2 * r, h)));
      body.position.set(px, h / 2, pz);
      const ph = Math.min(3, h * 0.12); // battered plinth grounds the tower
      const plinth = solid(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.3, ph, 12), darkStone));
      plinth.position.set(px, ph / 2, pz);
      const ring = solid(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 0.88, r * 0.55, 12), darkStone));
      ring.position.set(px, h + r * 0.22, pz); // corbelled parapet
      parent.add(body, plinth, ring);
      COLLIDERS.push({ kind: 'cyl', x: px, z: pz, r: r * 1.12, y0: 0, y1: h + r * 0.5 });
      if (rand() < 0.35) {
        // open battlemented crown — a landing deck instead of a spire
        const deck = solid(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.25, 12), capMat));
        deck.position.set(px, h + r * 0.45, pz);
        parent.add(deck);
        const n = Math.max(6, Math.round(r * 4));
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          merlonSpots.push({
            x: px + Math.cos(a) * r * 1.02, y: h + r * 0.45 + 0.42, z: pz + Math.sin(a) * r * 1.02,
            ry: -a - Math.PI / 2, parent
          });
        }
      } else {
        const sh = h * (0.3 + rand() * 0.25) + r * 2;
        const spire = solid(new THREE.Mesh(new THREE.ConeGeometry(r * 1.16, sh, 12), slateMat));
        spire.position.set(px, h + r * 0.45 + sh / 2, pz);
        const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, r * 1.2, 6), capMat);
        finial.position.set(px, h + r * 0.45 + sh + r * 0.6, pz);
        parent.add(spire, finial);
        COLLIDERS.push({ kind: 'cyl', x: px, z: pz, r: r * 0.75, y0: h + r * 0.5, y1: h + r * 0.45 + sh * 0.85 });
        if (rand() < 0.5) { // warm lantern on the finial tip
          const tip = new THREE.Sprite(new THREE.SpriteMaterial({
            map: tipTex, color: AMBER, transparent: true, opacity: 0.22,
            blending: THREE.AdditiveBlending, depthWrite: false }));
          tip.position.set(px, h + r * 0.45 + sh + r * 1.2 + 0.3, pz);
          tip.scale.setScalar(1.6);
          parent.add(tip);
        }
      }
      return h;
    }
  
    // square keep: plinth + cap. kind = 'grand' (stepped crown, buttresses, great-court
    // windows), 'wing' (flat parapet + ground cloister arcade), 'house' (roofs, doors)
    function keep(px, pz, w, d, h, ry, kind = 'house', parent = scene) {
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
      parent.add(box, cap, plinth);
      if (kind !== 'grand') { // the grand keep's walls are registered by GreatHall(), leaving the doorway open
        COLLIDERS.push({ kind: 'box', x: px, z: pz, hw: w * 0.55 + 0.2, hd: d * 0.55 + 0.2, y0: 0, y1: h + 2, cos: cosr, sin: sinr });
      }
      // string courses and corner quoins give the walls masonry relief
      if (h > 10) for (const fy of [0.4, 0.72]) {
        const band = solid(new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.32, d + 0.3), darkStone));
        band.position.set(px, h * fy, pz);
        band.rotation.y = ry;
        parent.add(band);
      }
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const lx = sx * w / 2, lz = sz * d / 2;
        const quoin = solid(new THREE.Mesh(new THREE.BoxGeometry(0.55, h * 0.94, 0.55), capMat));
        quoin.position.set(px + lx * cosr + lz * sinr, h * 0.47, pz - lx * sinr + lz * cosr);
        quoin.rotation.y = ry;
        parent.add(quoin);
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
        parent.add(doorG);
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
        parent.add(c1, c2);
        COLLIDERS.push({ kind: 'box', x: px, z: pz, hw: w * 0.42, hd: d * 0.42, y0: h + 1, y1: h + 6.4, cos: cosr, sin: sinr });
        // stepped buttresses give the long walls real relief
        const bh = h * 0.62;
        const nb = Math.max(2, Math.round(w / 7));
        for (let i = 0; i < nb; i++) {
          const lx = -w / 2 + (i + 0.5) * (w / nb);
          for (const sz of [1, -1]) {
            // The centre front bay is the Great Hall doorway. A generated
            // buttress here used to create the pillar blocking the entrance.
            if (sz > 0 && Math.abs(lx) < 0.01) continue;
            const lz = sz * (d / 2 + 0.45);
            const bt = solid(new THREE.Mesh(new THREE.BoxGeometry(1.3, bh, 1.1), darkStone));
            bt.position.set(px + lx * cosr + lz * sinr, bh / 2, pz - lx * sinr + lz * cosr);
            bt.rotation.y = ry;
            parent.add(bt);
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
        parent.add(aG);
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
        parent.add(roofG);
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
        parent.add(chimney);
      }
      if (kind === 'house' && !roofed) crenellate(px, pz, w * 1.1, d * 1.1, h + 1.1, ry, parent);
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
    academyFallbackGroup = new THREE.Group();
    academyFallbackGroup.name = 'SKYVEIL_Academy_Procedural_Fallback';
    scene.add(academyFallbackGroup);
    keep(HALL.x, HALL.z, HALL.w, HALL.d, HALL.h, HALL.ry, 'grand', academyFallbackGroup);
    const wingW = 24, wingD = 9, wingH = 11;
    for (const s of [-1, 1]) {
      const [wx, wz] = atHall(s * (HALL.w / 2 + wingW / 2 - 0.8), (HALL.d - wingD) / 2);
      keep(wx, wz, wingW, wingD, wingH, HALL.ry, 'wing', academyFallbackGroup);
    }
    for (const [lx, lz, r, th] of [[-20, -14.5, 3.1, 27], [20, -14.5, 3.1, 27], [0, -17, 3.6, 34]]) {
      const [tx, tz] = atHall(lx, lz);
      tower(tx, tz, r, th, academyFallbackGroup);
    }
    syncAcademyExteriorVisibility();
    loadAcademyExterior();
  
    // tower clusters ringing the court, some joined by bridges
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2 + rand() * 0.6;
      const cr = 46 + rand() * 110;
      const cx = Math.cos(ang) * cr, cz = Math.sin(ang) * cr;
      if (Math.hypot(cx + 10, cz + 80) < 42) continue; // don't crowd the castle
      if (Math.abs(cx) < 60 && cz > -72 && cz < 44) continue; // protect the Great Court landscape
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
  
    // Batch battlements by their visual parent so the academy fallback can be
    // hidden atomically when the imported GLB is ready.
    const merlonBatches = new Map();
    for (const spot of merlonSpots) {
      const parent = spot.parent || scene;
      if (!merlonBatches.has(parent)) merlonBatches.set(parent, []);
      merlonBatches.get(parent).push(spot);
    }
    for (const [parent, spots] of merlonBatches) {
      const inst = new THREE.InstancedMesh(
        new THREE.BoxGeometry(1.15, 0.85, 0.6), darkStone, spots.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      const e = new THREE.Euler(), pos = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      spots.forEach((mr, i) => {
        e.set(0, mr.ry, 0);
        q.setFromEuler(e);
        pos.set(mr.x, mr.y, mr.z);
        m4.compose(pos, q, one);
        inst.setMatrixAt(i, m4);
      });
      inst.castShadow = inst.receiveShadow = true;
      parent.add(inst);
    }
  }
  
  /* ================= GreatHall (inside the grand keep) ================= */
  // A candlelit gothic hall: enter through the arched door on the courtyard side.
  // Registers its own wall colliders so the doorway stays open.
  function GreatHall() {
    const { x: KX, z: KZ, w: KW, d: KD, h: KH, ry } = HALL;
    const room = roomRegistry.get('great-hall');
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
    for (const step of GREAT_HALL_ENTRY_STEPS) {
      const szz = KD / 2 + step.zOffset;
      const st = new THREE.Mesh(new THREE.BoxGeometry(step.width, step.height, step.depth), stepMat);
      st.castShadow = true;
      add(st, 0, step.height / 2, szz);
      addBox(0, szz, step.width / 2, step.depth / 2 + 0.02, 0, step.height);
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
    let visited = false;
  
    return {
      room,
      residents,
      update(t, dt, playerPos) {
        const nearInterior = !playerPos || Math.hypot(playerPos.x - KX, playerPos.z - KZ) < room.streamDistance;
        grp.visible = nearInterior;
        if (!nearInterior) return;
        const inside = playerPos && roomRegistry.contains(room, playerPos);
        if (inside) {
          GAME.hp = Math.min(GAME.maxHp, GAME.hp + dt * 6);
          if (!visited) {
            visited = true;
            GAME.hp = Math.min(GAME.maxHp, GAME.hp + 18);
            storyCard(
              tr('The Great Hall gathers every surviving lantern.', '大禮堂聚集了每一盞倖存的提燈。'),
              tr('refuge · party recovery · campus briefing', '避難所 · 隊伍恢復 · 校園戰況簡報')
            );
          }
        }
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
    const W = 11.5, D = 12.5, H = 8.4, DOOR = 3.5;
    const roomKit = createModularRoomKit();
    const shellLayout = roomKit.createSideRoomShell({
      width: W, depth: D, height: H, doorWidth: DOOR
    });
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
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x202432, roughness: 0.72, metalness: 0.18 });
    const glowTex = radialTexture('rgba(255,198,112,0.8)', 'rgba(232,150,70,0)', 96);
  
    const signTexture = title => canvasTex(512, 96, g => {
      g.clearRect(0, 0, 512, 96);
      g.fillStyle = 'rgba(9,7,12,0.92)'; g.fillRect(0, 0, 512, 96);
      g.strokeStyle = 'rgba(191,151,86,0.72)'; g.lineWidth = 4; g.strokeRect(5, 5, 502, 86);
      g.fillStyle = '#d7bc8a'; g.font = '30px serif'; g.textAlign = 'center';
      g.fillText(title, 256, 60);
    });
  
    for (const def of EXPLORABLES) {
      const room = roomRegistry.get(def.id);
      const grp = new THREE.Group();
      grp.position.set(def.x, 0, def.z);
      grp.rotation.y = def.ry;
      scene.add(grp);
      const cosr = Math.cos(def.ry), sinr = Math.sin(def.ry);
      const animated = [];
      const experience = def.id === 'archive'
        ? createArchiveRoomExperience({ tr, storyCard, game: GAME,
          reportProgress: (item, complete) => reportRoomProgress(def.id, item, complete) })
        : def.id === 'infirmary'
          ? createInfirmaryRoomExperience({ tr, storyCard, game: GAME,
            reportProgress: (item, complete) => reportRoomProgress(def.id, item, complete) })
          : def.id === 'practice'
            ? createPracticeRoomExperience({ tr, storyCard, game: GAME,
              reportProgress: (item, complete) => reportRoomProgress(def.id, item, complete) })
            : def.id === 'alchemy'
              ? createAlchemyRoomExperience({ tr, storyCard, game: GAME,
                reportProgress: (item, complete) => reportRoomProgress(def.id, item, complete) })
              : def.id === 'owlpost'
                ? createOwlPostRoomExperience({ tr, storyCard, game: GAME,
                  reportProgress: (item, complete) => reportRoomProgress(def.id, item, complete) })
                : null;
      let addParent = grp;
  
      const add = (mesh, x, y, z, ry = 0) => {
        mesh.position.set(x, y, z);
        mesh.rotation.y = ry;
        mesh.castShadow = mesh.receiveShadow = true;
        addParent.add(mesh);
        return mesh;
      };
      const navigationGuard = roomKit.createNavigationGuard({
        width: W, depth: D, doorwayWidth: DOOR
      });
      const addBoxCollider = (lx, lz, hw, hd, y0, y1, role = 'furniture', id = '') => {
        const local = navigationGuard.addCollider({ id, x: lx, z: lz, hw, hd, y0, y1 }, role);
        COLLIDERS.push({
          kind: 'box', x: def.x + lx * cosr + lz * sinr, z: def.z - lx * sinr + lz * cosr,
          hw: local.hw, hd: local.hd, y0: local.y0, y1: local.y1, cos: cosr, sin: sinr
        });
      };
  
      // A shared pure-data kit owns the floor, complete wall shell, doorway,
      // roof, trim columns, sign placement and matching structural colliders.
      // Decorative kit props are non-colliding by contract.
      for (const part of shellLayout.parts) {
        let geometry;
        if (part.shape === 'box') geometry = new THREE.BoxGeometry(part.width, part.height, part.depth);
        else if (part.shape === 'plane') geometry = new THREE.PlaneGeometry(part.width, part.height);
        else if (part.shape === 'prism') geometry = new THREE.CylinderGeometry(
          part.radius, part.radius, part.length, part.sides
        );
        else continue;
        const material = part.material === 'floor' ? floorMat
          : part.material === 'roof' ? roofMat
            : part.material === 'trim' ? trim
              : part.material === 'sign'
                ? new THREE.MeshBasicMaterial({ map: signTexture(def.title), transparent: true })
                : stone;
        const mesh = add(new THREE.Mesh(geometry, material), part.x, part.y, part.z, part.rotationY);
        mesh.rotation.x = part.rotationX;
        mesh.rotation.z = part.rotationZ;
      }
      for (const collider of shellLayout.colliders) addBoxCollider(
        collider.x, collider.z, collider.hw, collider.hd, collider.y0, collider.y1,
        'structure', collider.id
      );
  
      // Open arch, name plaque and a warm pool make entry readable from flight.
      add(new THREE.Mesh(new THREE.TorusGeometry(DOOR / 2, 0.25, 8, 30, Math.PI), trim), 0, 5.36, D / 2 + 0.29);
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
        for (let i = 0; i < ARCHIVE_EVIDENCE_LAYOUT.length; i++) {
          const evidence = experience.evidence[i];
          const folio = add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.62),
            new THREE.MeshStandardMaterial({
              color: 0x4b3044, emissive: 0x819ee8, emissiveIntensity: 0.35,
              roughness: 0.82
            })),
            evidence.home.x, evidence.home.y, evidence.home.z);
          animated.push({
            obj: folio, phase: i * 2.1, home: evidence.home,
            evidence, kind: 'archive-folio'
          });
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
        const reagentColors = { 1: 0xf0b06c, 2: 0xb77ce6, 3: 0x83b9ed };
        const vatSmokeTexture = cloudTexture();
        for (let i = 0; i < ALCHEMY_VAT_LAYOUT.length; i++) {
          const layout = ALCHEMY_VAT_LAYOUT[i];
          const vat = experience.vats[i];
          add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), iron), layout.x, 0.7, layout.z);
          const rim = add(new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.07, 8, 24), iron), layout.x, 1.08, layout.z);
          rim.rotation.x = Math.PI / 2;
          addBoxCollider(layout.x, layout.z, 0.9, 0.9, 0, 1.3);
          const liquidMaterial = new THREE.MeshStandardMaterial({
            color: reagentColors[layout.sequence[0]], emissive: reagentColors[layout.sequence[0]],
            emissiveIntensity: 1.2, transparent: true, opacity: 0.8, roughness: 0.28
          });
          const liquid = add(new THREE.Mesh(new THREE.CircleGeometry(0.67, 30), liquidMaterial), layout.x, 1.075, layout.z);
          liquid.rotation.x = -Math.PI / 2;
          const ring = add(new THREE.Mesh(new THREE.RingGeometry(0.92, 1.08, 32),
            new THREE.MeshBasicMaterial({
              color: reagentColors[layout.sequence[0]], transparent: true, opacity: 0.16,
              blending: THREE.AdditiveBlending, depthWrite: false
            })), layout.x, 0.055, layout.z);
          ring.rotation.x = -Math.PI / 2;
          const light = new THREE.PointLight(reagentColors[layout.sequence[0]], 6, 9, 1.8);
          light.position.set(layout.x, 1.55, layout.z); interiorGroup.add(light);
          const fumes = new THREE.Sprite(new THREE.SpriteMaterial({
            map: vatSmokeTexture, color: 0xa66f99, transparent: true, opacity: 0,
            depthWrite: false
          }));
          fumes.position.set(layout.x, 2.05, layout.z); fumes.scale.set(3.1, 2.8, 1); interiorGroup.add(fumes);
          animated.push({ obj: liquid, ring, light, fumes, vat, layout, reagentColors, color: new THREE.Color(),
            phase: i * 2.3, kind: 'alchemy-vat', experience });
          const world = new THREE.Vector3(
            def.x + layout.x * cosr + layout.z * sinr,
            layout.y,
            def.z - layout.x * sinr + layout.z * cosr
          );
          SPELL_TARGETS.push({
            position: world,
            radius: 1.05,
            active: () => experience.vatActive(layout.id),
            hit(_direction, _damage, weapon) {
              experience.onWeaponHit(layout.id, Number(weapon) || 1);
            }
          });
        }
        const reagentCircle = add(new THREE.Mesh(new THREE.RingGeometry(1.05, 1.34, 40),
          new THREE.MeshBasicMaterial({
            color: 0x75d49b, transparent: true, opacity: 0.34,
            blending: THREE.AdditiveBlending, depthWrite: false
          })), 0, 0.07, 4.25);
        reagentCircle.rotation.x = -Math.PI / 2;
        animated.push({ obj: reagentCircle, phase: 1.7, kind: 'alchemy-start', experience });
        const alchemist = CloakedFigure({ cloak: 0x34302a, lantern: true, plain: true, lanternColor: 0x80d69c });
        alchemist.group.position.set(1.3, 0.04, -3.3); alchemist.group.rotation.y = 0.9; interiorGroup.add(alchemist.group);
        animated.push({ fig: alchemist, phase: 2.4, kind: 'figure' });
      } else if (def.id === 'infirmary') {
        // Four usable-looking beds, three patients and a healer make this a
        // rescue room whose safe route changes with the shared Siege smoke.
        const linen = new THREE.MeshStandardMaterial({ color: 0xb9bdc5, roughness: 0.95 });
        const blanket = new THREE.MeshStandardMaterial({ color: 0x526b69, roughness: 0.98 });
        for (const x of [-3.25, 3.25]) for (const z of [-3.25, 1.5]) {
          add(new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.28, 3.35), wood), x, 0.48, z);
          add(new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.22, 2.95), linen), x, 0.72, z);
          add(new THREE.Mesh(new THREE.BoxGeometry(2.08, 0.09, 1.7), blanket), x, 0.86, z - 0.55);
          add(new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 0.55), linen), x, 0.92, z + 1.05);
          addBoxCollider(x, z, 1.2, 1.78, 0, 1.0);
        }
        const patientAuraTex = radialTexture('rgba(132,224,196,0.9)', 'rgba(80,130,120,0)', 64);
        for (let i = 0; i < INFIRMARY_PATIENT_LAYOUT.length; i++) {
          const patient = experience.patients[i];
          const patientGroup = new THREE.Group();
          patientGroup.position.set(patient.bed.x, patient.bed.y, patient.bed.z);
          const patientMat = new THREE.MeshStandardMaterial({
            color: 0x5c6670, emissive: 0x75c8ad, emissiveIntensity: 0.08, roughness: 0.95
          });
          const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.15, 5, 10), patientMat);
          body.rotation.x = Math.PI / 2;
          body.position.z = -0.15;
          const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 10), patientMat);
          head.position.z = 0.83;
          const aura = new THREE.Sprite(new THREE.SpriteMaterial({
            map: patientAuraTex, color: 0x83d8bc, transparent: true, opacity: 0.05,
            blending: THREE.AdditiveBlending, depthWrite: false
          }));
          aura.position.y = 0.18; aura.scale.set(1.9, 1.15, 1);
          patientGroup.add(body, head, aura);
          interiorGroup.add(patientGroup);
          animated.push({ obj: patientGroup, body, head, aura, patient, phase: i * 1.7, kind: 'infirmary-patient' });
        }

        const smokeTex = cloudTexture();
        for (let i = 0; i < 6; i++) {
          const smoke = new THREE.Sprite(new THREE.SpriteMaterial({
            map: smokeTex, color: 0x737b82, transparent: true, opacity: 0,
            depthWrite: false
          }));
          smoke.position.set((i % 2 ? 0.72 : -0.72), 1.2 + (i % 3) * 0.72, -0.8 + Math.floor(i / 2) * 1.45);
          smoke.scale.set(3.2 + (i % 3) * 0.5, 2.1, 1);
          interiorGroup.add(smoke);
          animated.push({ obj: smoke, x: smoke.position.x, y: smoke.position.y, phase: i * 1.37, kind: 'infirmary-smoke', experience });
        }
        for (const x of [-2.05, 2.05]) {
          const route = add(new THREE.Mesh(new THREE.PlaneGeometry(0.26, 9.2),
            new THREE.MeshBasicMaterial({
              color: 0x8ce1c4, transparent: true, opacity: 0,
              blending: THREE.AdditiveBlending, depthWrite: false
            })), x, 0.055, 0.15);
          route.rotation.x = -Math.PI / 2;
          animated.push({ obj: route, phase: x, kind: 'infirmary-route', experience });
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
        // A three-beat sparring drill teaches floor telegraphs, movement and
        // counter timing before the same language appears in live combat.
        const laneMaterial = new THREE.MeshBasicMaterial({
          color: 0xe87958, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
        for (const lane of [
          { id: 'left', x: -3.7, width: 3.35 },
          { id: 'centre', x: 0, width: 3.45 },
          { id: 'right', x: 3.7, width: 3.35 }
        ]) {
          const warning = add(new THREE.Mesh(new THREE.PlaneGeometry(lane.width, 7.5), laneMaterial.clone()), lane.x, 0.062, -0.15);
          warning.rotation.x = -Math.PI / 2;
          animated.push({ obj: warning, laneId: lane.id, phase: lane.x, kind: 'practice-lane', experience });
        }
        const startCircle = add(new THREE.Mesh(new THREE.RingGeometry(1.15, 1.42, 40),
          new THREE.MeshBasicMaterial({
            color: 0xf2bf6d, transparent: true, opacity: 0.34,
            blending: THREE.AdditiveBlending, depthWrite: false
          })), 0, 0.075, 3.55);
        startCircle.rotation.x = -Math.PI / 2;
        animated.push({ obj: startCircle, phase: 0.4, kind: 'practice-start', experience });

        const targetMat = new THREE.MeshStandardMaterial({ color: 0x6e2227, roughness: 0.82, emissive: 0xe8b06a, emissiveIntensity: 0 });
        for (let i = 0; i < PRACTICE_TARGET_LAYOUT.length; i++) {
          const target = PRACTICE_TARGET_LAYOUT[i];
          const { x, z } = target;
          const dummy = new THREE.Group(); dummy.position.set(x, 0, z); interiorGroup.add(dummy);
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 2.8, 8), wood); post.position.y = 1.4; dummy.add(post);
          const disc = new THREE.Mesh(new THREE.CircleGeometry(0.78, 28), targetMat.clone()); disc.position.set(0, 2.25, 0.08); dummy.add(disc);
          const rim = new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.08, 8, 28), iron); rim.position.set(0, 2.25, 0.1); dummy.add(rim);
          const cross = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.12, 0.12), wood); cross.position.y = 1.65; dummy.add(cross);
          const state = { obj: dummy, disc, phase: i * 1.4, kind: 'target', pulse: 0,
            targetId: target.id, experience };
          animated.push(state);
          const world = new THREE.Vector3(def.x + x * cosr + z * sinr, 2.25, def.z - x * sinr + z * cosr);
          SPELL_TARGETS.push({
            position: world, radius: 0.9,
            active: () => experience.targetActive(target.id),
            hit() {
              state.pulse = 1;
              experience.onTargetHit(target.id);
            }
          });
        }
        const sentinelAura = new THREE.Sprite(new THREE.SpriteMaterial({
          map: radialTexture('rgba(244,150,96,0.9)', 'rgba(118,45,34,0)', 64),
          color: 0xf09a62, transparent: true, opacity: 0,
          blending: THREE.AdditiveBlending, depthWrite: false
        }));
        sentinelAura.position.set(0, 2.1, -0.45); sentinelAura.scale.set(4.2, 4.2, 1); interiorGroup.add(sentinelAura);
        const sentinelLight = new THREE.PointLight(0xf08a55, 0, 10, 1.8);
        sentinelLight.position.set(0, 2.2, -0.45); interiorGroup.add(sentinelLight);
        const sentinel = CloakedFigure({ cloak: 0x5a2928, lantern: true, plain: true, lanternColor: 0xf0a267 });
        sentinel.group.position.set(0, 0.04, -0.45); sentinel.group.rotation.y = Math.PI; interiorGroup.add(sentinel.group);
        animated.push({ fig: sentinel, obj: sentinel.group, aura: sentinelAura, light: sentinelLight,
          phase: 1.2, kind: 'practice-sentinel', experience });
        const tutor = CloakedFigure({ cloak: 0x4a302c, lantern: false, plain: true });
        tutor.group.position.set(4.1, 0.04, 2.4); tutor.group.rotation.y = -2.4; interiorGroup.add(tutor.group);
        animated.push({ fig: tutor, phase: 2.9, kind: 'figure' });
      } else if (def.id === 'owlpost') {
        // Perches and small animated owl silhouettes surround the sorting desk;
        // three exterior roosts create a compact ground/flight delivery route.
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
        add(new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.18, 1.35), wood), OWLPOST_DESK.x, 0.92, OWLPOST_DESK.z);
        addBoxCollider(OWLPOST_DESK.x, OWLPOST_DESK.z, 1.52, 0.76, 0, 1.08);
        const deskRune = add(new THREE.Mesh(new THREE.RingGeometry(1.15, 1.55, 48),
          new THREE.MeshBasicMaterial({ color: 0x9f8bd2, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })), 0, 0.1, -3.8);
        deskRune.rotation.x = -Math.PI / 2;
        animated.push({ obj: deskRune, phase: 0, kind: 'owl-desk', experience });
        const deskLight = new THREE.PointLight(0xa894df, 10, 11, 1.6);
        deskLight.position.set(0, 1.8, -3.8); interiorGroup.add(deskLight);
        animated.push({ obj: deskLight, phase: 2.2, kind: 'light' });

        const routeGlow = radialTexture('rgba(185,150,246,0.95)', 'rgba(100,70,150,0)', 64);
        for (let i = 0; i < OWLPOST_ROUTE_LAYOUT.length; i++) {
          const route = OWLPOST_ROUTE_LAYOUT[i];
          const marker = new THREE.Group();
          marker.position.set(route.x, route.y, route.z);
          const ring = new THREE.Mesh(new THREE.RingGeometry(0.72, 0.98, 32),
            new THREE.MeshBasicMaterial({
              color: 0xb99af0, transparent: true, opacity: 0,
              blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
            }));
          ring.rotation.x = -Math.PI / 2;
          const beacon = new THREE.Sprite(new THREE.SpriteMaterial({
            map: routeGlow, color: 0xb99af0, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false
          }));
          beacon.position.y = 1.1; beacon.scale.set(3.4, 3.4, 1);
          marker.add(ring, beacon); grp.add(marker);
          animated.push({ obj: marker, ring, beacon, route, phase: i * 1.8,
            kind: 'owl-route', experience });
        }
        const postKeeper = CloakedFigure({ cloak: 0x383044, lantern: true, plain: true, lanternColor: 0xb3a1e0 });
        postKeeper.group.position.set(2.5, 0.04, -2.7); postKeeper.group.rotation.y = 2.4; interiorGroup.add(postKeeper.group);
        animated.push({ fig: postKeeper, phase: 4.1, kind: 'figure' });
      }
  
      const navigation = navigationGuard.validateWalkability([
        { id: 'inside-anchor', x: room.anchors.inside.local.x, z: room.anchors.inside.local.z },
        { id: 'centre-anchor', x: room.anchors.centre.local.x, z: room.anchors.centre.local.z }
      ]);
      if (!navigation.walkable) {
        throw new Error(`${def.id} room navigation blocked: ${navigation.unreachableTargets.join(', ')}`);
      }
      buildings.push({
        def, room, grp, interiorGroup, animated, experience, navigation,
        visited: false, cosr, sinr
      });
    }
  
    return {
      buildings,
      interactionPrompt(playerPos) {
        for (const building of buildings) {
          if (!building.experience) continue;
          const inside = roomRegistry.contains(building.room, playerPos);
          const nearbyOutside = building.experience.acceptsOutside
            && Math.hypot(playerPos.x - building.def.x, playerPos.z - building.def.z) < building.room.streamDistance;
          if (!inside && !nearbyOutside) continue;
          const prompt = building.experience.interactionPrompt(roomRegistry.worldToLocal(building.room, playerPos));
          if (prompt && !canInteractRoom(building.def.id)) return {
            ...prompt,
            action: tr('Secure exterior first', '先確保外部安全'),
            detail: tr('room objective unlocks after the attack', '房間目標會在攻擊結束後開放'),
            blocked: true
          };
          if (prompt) return prompt;
        }
        return null;
      },
      interact(playerPos) {
        for (const building of buildings) {
          if (!building.experience) continue;
          const inside = roomRegistry.contains(building.room, playerPos);
          const nearbyOutside = building.experience.acceptsOutside
            && Math.hypot(playerPos.x - building.def.x, playerPos.z - building.def.z) < building.room.streamDistance;
          if (!inside && !nearbyOutside) continue;
          if (!canInteractRoom(building.def.id)) return false;
          if (building.experience.interact(roomRegistry.worldToLocal(building.room, playerPos))) return true;
        }
        return false;
      },
      archiveState() {
        return buildings.find(building => building.def.id === 'archive')?.experience?.state() || null;
      },
      alchemyState() {
        return buildings.find(building => building.def.id === 'alchemy')?.experience?.state() || null;
      },
      infirmaryState() {
        return buildings.find(building => building.def.id === 'infirmary')?.experience?.state() || null;
      },
      practiceState() {
        return buildings.find(building => building.def.id === 'practice')?.experience?.state() || null;
      },
      owlPostState() {
        return buildings.find(building => building.def.id === 'owlpost')?.experience?.state() || null;
      },
      applySharedProgress(progress = {}) {
        for (const building of buildings) {
          building.experience?.applySharedProgress?.(progress[building.def.id] || []);
        }
      },
      update(t, dt, playerPos) {
        for (const b of buildings) {
          const dx = playerPos.x - b.def.x, dz = playerPos.z - b.def.z;
          const nearInterior = Math.hypot(dx, dz) < b.room.streamDistance;
          const lx = dx * b.cosr - dz * b.sinr;
          const lz = dx * b.sinr + dz * b.cosr;
          const inside = roomRegistry.contains(b.room, playerPos);
          b.interiorGroup.visible = nearInterior;
          b.experience?.tick(
            dt,
            b.def.id === 'infirmary' ? getRoomThreat(b.def.id) : null,
            (inside || (b.experience.acceptsOutside && nearInterior)) ? { x: lx, y: playerPos.y, z: lz } : null
          );
          if (nearInterior) for (const a of b.animated) {
            if (a.kind === 'figure') a.fig.update(t + a.phase, dt, 0);
            else if (a.kind === 'archive-folio') {
              const target = a.evidence.found ? a.evidence.preserved : a.home;
              const settle = Math.min(1, dt * (a.evidence.found ? 5.5 : 2.2));
              a.obj.position.x += (target.x - a.obj.position.x) * settle;
              a.obj.position.z += (target.z - a.obj.position.z) * settle;
              const targetY = a.evidence.found
                ? target.y
                : target.y + Math.sin(t * 1.1 + a.phase) * 0.18;
              a.obj.position.y += (targetY - a.obj.position.y) * settle;
              a.obj.rotation.y += (a.evidence.found ? 0 : dt * 0.32);
              const tilt = a.evidence.found ? 0 : Math.sin(t * 0.8 + a.phase) * 0.08;
              a.obj.rotation.z += (tilt - a.obj.rotation.z) * settle;
              a.obj.material.emissiveIntensity = a.evidence.found
                ? 0.72 + a.evidence.pulse * 1.8
                : 0.35 + Math.sin(t * 1.7 + a.phase) * 0.12;
            } else if (a.kind === 'infirmary-patient') {
              const stable = a.patient.stabilized;
              const breath = Math.sin(t * (stable ? 1.25 : 2.4) + a.phase);
              a.obj.position.y = a.patient.bed.y + breath * (stable ? 0.012 : 0.025);
              a.body.material.emissiveIntensity = stable ? 0.38 + a.patient.pulse * 1.4 : 0.08;
              a.aura.material.opacity = stable ? 0.16 + a.patient.pulse * 0.32 : 0.035;
              a.aura.scale.set(1.9 + a.patient.pulse * 0.45, 1.15 + a.patient.pulse * 0.25, 1);
            } else if (a.kind === 'infirmary-smoke') {
              const smoke = a.experience.smokeLevel;
              const visualSmoke = smoke * (settings.prefs.reducedSmoke ? 0.11 : 0.27);
              a.obj.material.opacity = visualSmoke * (0.82 + Math.sin(t * 0.7 + a.phase) * 0.18);
              a.obj.position.y = a.y + Math.sin(t * 0.42 + a.phase) * 0.18;
              a.obj.position.x = a.x + Math.sin(t * 0.25 + a.phase) * 0.16;
            } else if (a.kind === 'infirmary-route') {
              const routeBlocked = a.experience.routeBlocked;
              a.obj.material.opacity = routeBlocked ? 0.2 + Math.sin(t * 2.1 + a.phase) * 0.06 : 0;
            } else if (a.kind === 'practice-lane') {
              const active = a.experience.dangerLane === a.laneId;
              const power = a.experience.telegraphPower;
              a.obj.material.opacity = active ? 0.13 + power * 0.24 + Math.sin(t * 8 + a.phase) * 0.035 : 0;
            } else if (a.kind === 'practice-start') {
              const available = a.experience.phase === 'idle' || a.experience.phase === 'complete';
              a.obj.rotation.z = t * 0.22;
              a.obj.material.opacity = available ? 0.3 + Math.sin(t * 2.2 + a.phase) * 0.08 : 0.08;
            } else if (a.kind === 'practice-sentinel') {
              a.fig.update(t + a.phase, dt, 0);
              const power = a.experience.telegraphPower;
              a.obj.scale.setScalar(1 + power * 0.08);
              a.aura.material.opacity = power * (0.2 + Math.sin(t * 7) * 0.04);
              a.aura.scale.setScalar(4.2 + power * 1.1);
              a.light.intensity = power * 15;
            } else if (a.kind === 'alchemy-vat') {
              const active = a.experience.activeVatId === a.layout.id;
              const weapon = active ? a.experience.expectedWeapon : a.layout.sequence.at(-1);
              const color = a.color.setHex(a.reagentColors[weapon] || 0x75d49b);
              a.obj.material.color.lerp(color, Math.min(1, dt * 7));
              a.obj.material.emissive.lerp(color, Math.min(1, dt * 7));
              a.obj.material.emissiveIntensity = a.vat.stabilized ? 0.55 : 1.1 + a.vat.pulse * 2.4;
              a.obj.scale.setScalar(1 + Math.sin(t * 2.7 + a.phase) * 0.035 + a.vat.pulse * 0.09);
              a.ring.material.color.copy(color);
              a.ring.material.opacity = active ? 0.24 + Math.sin(t * 4.2 + a.phase) * 0.07 : (a.vat.stabilized ? 0.12 : 0.03);
              a.ring.rotation.z = t * (active ? 0.5 : 0.12) + a.phase;
              a.light.color.copy(color);
              a.light.intensity = active ? 8 + a.vat.pulse * 7 : (a.vat.stabilized ? 3 : 1);
              const smoke = active ? a.experience.volatility : 0;
              a.fumes.material.opacity = smoke * (settings.prefs.reducedSmoke ? 0.1 : 0.3);
              a.fumes.position.y = 2.05 + Math.sin(t * 0.7 + a.phase) * 0.18;
            } else if (a.kind === 'alchemy-start') {
              const available = a.experience.phase === 'idle' || a.experience.phase === 'complete';
              a.obj.rotation.z = -t * 0.24;
              a.obj.material.opacity = available ? 0.3 + Math.sin(t * 2.1 + a.phase) * 0.08 : 0.07;
            } else if (a.kind === 'float') {
              a.obj.position.y = a.y + Math.sin(t * 1.1 + a.phase) * 0.18;
              a.obj.rotation.y = t * 0.32 + a.phase;
            } else if (a.kind === 'potion') {
              a.obj.position.y = a.y + Math.sin(t * 1.7 + a.phase) * 0.025;
              a.obj.material.emissiveIntensity = 0.55 + Math.sin(t * 2.2 + a.phase) * 0.25;
            } else if (a.kind === 'target') {
              a.pulse *= Math.exp(-dt * 7);
              const active = a.experience?.activeTargetId === a.targetId;
              a.obj.rotation.z = Math.sin(t * 0.7 + a.phase) * 0.015 + a.pulse * 0.18;
              a.disc.material.emissiveIntensity = a.pulse * 2.8 + (active ? 1.45 + Math.sin(t * 5.5) * 0.25 : 0);
              a.obj.scale.setScalar(1 + a.pulse * 0.08 + (active ? 0.035 : 0));
            } else if (a.kind === 'owl') {
              a.obj.position.y = a.y + Math.sin(t * 1.4 + a.phase) * 0.035;
              a.obj.rotation.y = Math.sin(t * 0.55 + a.phase) * 0.28;
            } else if (a.kind === 'owl-desk') {
              a.obj.rotation.z = t * 0.35;
              a.obj.material.opacity = a.experience.phase === 'carrying'
                ? 0.16 : 0.44 + Math.sin(t * 2.1) * 0.12;
            } else if (a.kind === 'owl-route') {
              const active = a.experience.activeRouteId === a.route.id;
              a.obj.position.y = a.route.y + (active ? Math.sin(t * 1.4 + a.phase) * 0.12 : 0);
              a.ring.rotation.z = t * 0.5 + a.phase;
              a.ring.material.opacity = active ? 0.5 + Math.sin(t * 3.4 + a.phase) * 0.12 : 0;
              a.beacon.material.opacity = active ? 0.52 + Math.sin(t * 2.6 + a.phase) * 0.14 : 0;
              a.beacon.scale.setScalar(active ? 3.4 + Math.sin(t * 1.8 + a.phase) * 0.25 : 0.01);
            } else if (a.kind === 'healpool') {
              a.obj.scale.setScalar(1 + Math.sin(t * 1.8) * 0.04);
              a.obj.material.opacity = 0.2 + Math.sin(t * 2.4) * 0.06;
            } else if (a.kind === 'light') a.obj.intensity = 7 + Math.sin(t * 3 + a.phase) * 2;
          }
          if (inside && b.def.id === 'infirmary' && GAME.hp < GAME.maxHp) {
            GAME.hp = Math.min(GAME.maxHp, GAME.hp + dt * b.experience.healingRate({ x: lx, z: lz }));
          }
          if (!b.visited && inside) {
            b.visited = true;
            GAME.hp = Math.min(GAME.maxHp, GAME.hp + 18);
            const messages = {
              archive: [tr('The Moon Archive remembers your name.', '月之檔案館仍記得你的名字。'), tr('three floating folios · press E nearby to preserve them', '三份漂浮文獻 · 靠近後按 E 保存')],
              alchemy: [tr('The old workshop has two unstable recipes.', '古老工坊裡有兩組不穩定配方。'), tr('stand in the green circle · press E · follow weapon slots 1, 2, 3', '站上綠色圓環 · 按 E · 依照武器欄位 1、2、3 操作')],
              infirmary: [tr('The infirmary light steadies your flame.', '醫務室的光穩住了你的火焰。'), tr('stabilize three residents · smoke may close the centre route', '穩定三位居民 · 濃煙可能封鎖中央路線')],
              practice: [tr('The Practice Warden raises three attack tells.', '演武守衛展示三種攻擊提示。'), tr('stand in the gold circle · press E to begin the dodge-and-counter drill', '站上金色圓環 · 按 E 開始閃避與反擊訓練')],
              owlpost: [tr('Three letters are waiting before dawn.', '黎明前還有三封信等待投遞。'), tr('visit the violet sorting desk · rooftop routes require a short flight', '前往紫色分信桌 · 屋頂路線需要短程飛行')]
            };
            const msg = messages[b.def.id];
            if (msg) storyCard(msg[0], msg[1]);
          }
        }
      }
    };
  }

  const detailWorldPosition = new THREE.Vector3();
  const architectureDetailNodes = [];
  let detailElapsed = 0;
  let detailCursor = 0;

  function registerArchitectureDetails(roots) {
    for (const root of roots) root.traverse(node => {
      if ((!node.isMesh && !node.isSprite) || node.userData.skyDetailRegistered) return;
      node.userData.skyDetailRegistered = true;
      if (node.geometry && !node.geometry.boundingSphere) node.geometry.computeBoundingSphere();
      architectureDetailNodes.push({
        node,
        baseVisible: node.visible,
        baseCastShadow: Boolean(node.castShadow),
        radius: node.isInstancedMesh ? Infinity : (node.geometry?.boundingSphere?.radius || (node.isSprite ? 0.5 : Infinity))
      });
    });
  }

  function updateDetail(dt, playerPosition) {
    if (!academyExteriorModel && !academyExteriorPromise && wantsAcademyExterior()) loadAcademyExterior();
    syncAcademyExteriorVisibility();
    detailElapsed += dt;
    const adaptive = Boolean(settings.prefs.runtimePerformance);
    const interval = adaptive ? 0.06 : 0.45;
    if (detailElapsed < interval || !playerPosition || !architectureDetailNodes.length) return;
    detailElapsed = 0;
    const performance = settings.prefs.quality === 'performance' || adaptive;
    // Adaptive mode is entered only after sustained missed frames. At that
    // point keep the nearby room readable and remove distant facade trim,
    // windows, lamps and secondary building shells much more decisively.
    const shadowDistance = adaptive ? 28 : performance ? 45 : 88;
    const tinyDistance = adaptive ? 16 : performance ? 38 : 82;
    const smallDistance = adaptive ? 28 : performance ? 62 : 132;
    const mediumDistance = adaptive ? 44 : performance ? 92 : Infinity;
    const largeDistance = adaptive ? 82 : Infinity;
    // Checking all 725+ facade nodes in one frame created a visible hitch even
    // after distant nodes were hidden. Adaptive mode walks a small rolling
    // batch instead, completing a full visibility sweep in roughly 0.5 s.
    const checks = adaptive ? Math.min(48, architectureDetailNodes.length) : architectureDetailNodes.length;
    for (let step = 0; step < checks; step++) {
      const detail = architectureDetailNodes[detailCursor];
      detailCursor = (detailCursor + 1) % architectureDetailNodes.length;
      const { node, radius } = detail;
      node.getWorldPosition(detailWorldPosition);
      const distance = detailWorldPosition.distanceTo(playerPosition);
      const hiddenByDistance = radius < 0.9 ? distance > tinyDistance
        : radius < 2.2 ? distance > smallDistance
          : radius < 4.5 ? distance > mediumDistance
            : distance > largeDistance;
      node.visible = detail.baseVisible && !hiddenByDistance;
      if (detail.baseCastShadow) node.castShadow = distance <= shadowDistance;
    }
  }

  function detailStats() {
    let hidden = 0, shadowCulled = 0;
    for (const detail of architectureDetailNodes) {
      if (!detail.node.visible) hidden++;
      if (detail.baseCastShadow && !detail.node.castShadow) shadowCulled++;
    }
    return { registered: architectureDetailNodes.length, hidden, shadowCulled };
  }
  
  
  return { buildScene, Buildings, GreatHall, ExplorableBuildings, registerArchitectureDetails, updateDetail, detailStats };
}
