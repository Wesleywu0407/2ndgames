// Interior dressing for the five side rooms.
//
// The rooms read as messy because they were the opposite of busy: a handful of
// saturated primitives sitting on the floor of an eight-metre-tall black box,
// lit by point lights with no visible source.  With nothing to anchor the eye
// and no light logic, everything competes and the room reads as noise.
//
// This kit fixes the three causes in order of impact:
//   1. Every light in a room comes from a fixture you can see - a hearth fire,
//      a candle ring, a wall sconce.  Light with a source reads as a place.
//   2. Props are built from real forms (legs under benches, necks on bottles)
//      in a palette held to night blue, sandstone, and candle amber, so only
//      the things that matter glow.
//   3. The upper two thirds of the room get used - beams, a gallery, hanging
//      stock - so the volume has a top instead of fading into black.
//
// Geometries and materials are created once per kit and shared by every prop,
// so dressing a room costs draw calls rather than memory.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function createRoomDressingKit({ canvasTex, radialTexture }) {
  // ---- shared palette -------------------------------------------------
  const mat = {
    oak: new THREE.MeshStandardMaterial({ color: 0x53402a, roughness: 0.88, metalness: 0.02 }),
    darkOak: new THREE.MeshStandardMaterial({ color: 0x2c1d12, roughness: 0.9, metalness: 0.02 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x17181d, roughness: 0.55, metalness: 0.65 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x8d6329, roughness: 0.38, metalness: 0.78 }),
    copper: new THREE.MeshStandardMaterial({ color: 0x94572c, roughness: 0.42, metalness: 0.7 }),
    wax: new THREE.MeshStandardMaterial({ color: 0xf0e2bf, roughness: 0.72, metalness: 0 }),
    linen: new THREE.MeshStandardMaterial({ color: 0x7d6d4f, roughness: 0.95, metalness: 0 }),
    clay: new THREE.MeshStandardMaterial({ color: 0x7a5334, roughness: 0.85, metalness: 0.03 }),
    parchment: new THREE.MeshStandardMaterial({ color: 0xcdb98d, roughness: 0.9, metalness: 0 }),
    herb: new THREE.MeshStandardMaterial({ color: 0x5c5f36, roughness: 0.95, metalness: 0 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x9b978d, roughness: 0.95, metalness: 0.02 })
  };

  // Amber glass is the only lit prop material - it marks what is worth looking
  // at, which is exactly what the old mint-and-mauve bottles could not do
  // because every one of them glowed equally.
  const glassAmber = new THREE.MeshStandardMaterial({
    color: 0xc98b34, emissive: 0xd9922f, emissiveIntensity: 0.55,
    roughness: 0.22, metalness: 0.05, transparent: true, opacity: 0.86
  });
  const glassPale = new THREE.MeshStandardMaterial({
    color: 0x9fa9b8, emissive: 0x4d5666, emissiveIntensity: 0.22,
    roughness: 0.18, metalness: 0.06, transparent: true, opacity: 0.7
  });

  const flameTex = radialTexture('rgba(255,214,150,0.95)', 'rgba(226,124,38,0)', 64);
  const flameMat = () => new THREE.SpriteMaterial({
    map: flameTex, color: 0xffc074, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false
  });

  // Night seen through leaded glass, with the jacaranda pressed against it.
  // Painted once and shared: the windows are meant to read as the same night.
  const nightPaneTex = canvasTex(128, 256, g => {
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#0b1030');
    sky.addColorStop(0.55, '#16204d');
    sky.addColorStop(1, '#25234f');
    g.fillStyle = sky; g.fillRect(0, 0, 128, 256);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 26; i++) {
      g.fillRect(Math.random() * 128, Math.random() * 120, 1.4, 1.4);
    }
    // jacaranda canopy crowding the lower half of every window
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * 128;
      const y = 118 + Math.random() * 138;
      const r = 4 + Math.random() * 9;
      g.fillStyle = `rgba(${120 + Math.random() * 50 | 0},${70 + Math.random() * 40 | 0},${170 + Math.random() * 60 | 0},0.6)`;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(20,16,34,0.85)'; g.lineWidth = 3;
    for (let y = 32; y < 256; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); }
    g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 256); g.stroke();
  });
  const nightPaneMat = new THREE.MeshBasicMaterial({ map: nightPaneTex, toneMapped: false });

  // ---- shared geometry ------------------------------------------------
  const geo = {
    beam: new THREE.BoxGeometry(1, 1, 1),
    plank: new THREE.BoxGeometry(1, 1, 1),
    post: new THREE.CylinderGeometry(0.07, 0.07, 1, 6),
    rail: new THREE.CylinderGeometry(0.05, 0.05, 1, 6),
    candle: new THREE.CylinderGeometry(0.045, 0.05, 0.3, 6),
    ring: new THREE.TorusGeometry(1, 0.05, 6, 24),
    chain: new THREE.CylinderGeometry(0.018, 0.018, 1, 4),
    // Glassware is deliberately small. At full arm's-length scale a 20 cm
    // sphere on a bench reads as a balloon, not a bottle; the silhouette only
    // becomes glassware once the neck is a clear third of the height.
    bottleBody: new THREE.SphereGeometry(0.065, 10, 8),
    bottleNeck: new THREE.CylinderGeometry(0.022, 0.032, 0.1, 6),
    flaskBody: new THREE.CylinderGeometry(0.038, 0.082, 0.15, 8),
    flaskNeck: new THREE.CylinderGeometry(0.024, 0.03, 0.1, 6),
    jar: new THREE.CylinderGeometry(0.085, 0.09, 0.19, 8),
    crate: new THREE.BoxGeometry(1, 1, 1),
    barrel: new THREE.CylinderGeometry(0.32, 0.28, 0.78, 10),
    sack: new THREE.SphereGeometry(0.3, 8, 6),
    scroll: new THREE.CylinderGeometry(0.045, 0.045, 0.5, 6),
    herbBundle: new THREE.ConeGeometry(0.11, 0.52, 5),
    pot: new THREE.SphereGeometry(0.2, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62),
    book: new THREE.BoxGeometry(1, 1, 1)
  };

  const box = (material, w, h, d) => {
    const mesh = new THREE.Mesh(geo.beam, material);
    mesh.scale.set(w, h, d);
    return mesh;
  };

  const place = (mesh, x, y, z, ry = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    return mesh;
  };

  // ---- fixtures -------------------------------------------------------

  // A candle: wax stub plus an additive flare that is registered for flicker.
  // The flare is what sells it; the stub is what makes the flare believable.
  function candle(flares, x, y, z, scale = 1) {
    const group = new THREE.Group();
    const stub = new THREE.Mesh(geo.candle, mat.wax);
    stub.scale.setScalar(scale);
    group.add(stub);
    const flare = new THREE.Sprite(flameMat());
    flare.position.y = 0.19 * scale;
    flare.scale.set(0.17 * scale, 0.26 * scale, 1);
    group.add(flare);
    flares.push({ flare, base: 0.26 * scale, phase: Math.random() * 6.283 });
    return place(group, x, y, z);
  }

  // The room's main light, hung on chains so the eye can follow it to the roof.
  function candleChandelier({ y = 5.3, radius = 1.15, candles = 8, hangFrom = 7.9,
    intensity = 16, distance = 15, color = 0xffc27a } = {}) {
    const group = new THREE.Group();
    const flares = [];
    const hoop = new THREE.Mesh(geo.ring, mat.iron);
    hoop.scale.set(radius, radius, 1);
    hoop.rotation.x = Math.PI / 2;
    group.add(hoop);
    const inner = new THREE.Mesh(geo.ring, mat.iron);
    inner.scale.set(radius * 0.55, radius * 0.55, 1);
    inner.rotation.x = Math.PI / 2;
    inner.position.y = 0.34;
    group.add(inner);
    for (let i = 0; i < candles; i++) {
      const a = (i / candles) * Math.PI * 2;
      group.add(candle(flares, Math.cos(a) * radius, 0.2, Math.sin(a) * radius));
      if (i % 2 === 0) {
        group.add(candle(flares, Math.cos(a) * radius * 0.55, 0.54, Math.sin(a) * radius * 0.55, 0.85));
      }
      // spokes from the hoop up to the suspension point
      const spoke = new THREE.Mesh(geo.chain, mat.iron);
      spoke.scale.y = 0.62;
      spoke.position.set(Math.cos(a) * radius * 0.8, 0.42, Math.sin(a) * radius * 0.8);
      spoke.rotation.z = Math.cos(a) * 0.5;
      spoke.rotation.x = -Math.sin(a) * 0.5;
      group.add(spoke);
    }
    const drop = Math.max(0.4, hangFrom - y);
    const chain = new THREE.Mesh(geo.chain, mat.iron);
    chain.scale.y = drop;
    chain.position.y = 0.7 + drop / 2;
    group.add(chain);
    const light = new THREE.PointLight(color, intensity, distance, 1.7);
    light.position.y = 0.1;
    group.add(light);
    group.position.y = y;
    return { group, flares, light, sway: true };
  }

  // Wall light. Small, warm, and repeated - repetition is what turns a wall
  // from a flat surface into architecture.
  //
  // `light: false` keeps the fixture and its flame but drops the point light.
  // A room wants many sconces and few lights: past two or three the extra
  // lights cost a forward-rendered frame far more than they add to the look,
  // and the flame sprite already reads as a source on its own.
  function wallSconce({ intensity = 5, distance = 7.5, light: withLight = true } = {}) {
    const group = new THREE.Group();
    const flares = [];
    const bracket = box(mat.iron, 0.06, 0.06, 0.34);
    bracket.position.z = 0.17;
    group.add(bracket);
    const cup = new THREE.Mesh(geo.pot, mat.iron);
    cup.scale.setScalar(0.42);
    cup.position.set(0, 0.03, 0.33);
    group.add(cup);
    group.add(candle(flares, 0, 0.12, 0.33, 0.9));
    let light = null;
    if (withLight) {
      light = new THREE.PointLight(0xffb972, intensity, distance, 1.9);
      light.position.set(0, 0.28, 0.5);
      group.add(light);
    }
    return { group, flares, light };
  }

  // The hearth beneath a cauldron: a stone kerb, three iron legs, and real fire.
  // The room's existing crucibles keep their gameplay colour on the surface of
  // the liquid; the fire underneath is always warm, so the light logic stays
  // readable no matter which reagent is loaded.
  // `fireY` lifts the burning part clear of whatever stands in front of the
  // hearth. A floor-level fire is the truthful thing to build and the wrong
  // thing to look at: from the doorway it disappears behind the first waist-
  // high prop in the room, and a light source you cannot see is the exact
  // problem this kit exists to fix.
  function hearthFire({ radius = 1.5, intensity = 13, distance = 11, fireY = 0.75 } = {}) {
    const group = new THREE.Group();
    const flares = [];
    const kerb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.06, 0.14, 18), mat.stone);
    kerb.position.y = 0.07;
    group.add(kerb);
    // raised firebox: a stone shelf the fire actually sits on
    const boxTop = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.82, radius * 0.9, 0.16, 14), mat.stone);
    boxTop.position.y = fireY - 0.08;
    group.add(boxTop);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      const pier = box(mat.stone, 0.22, fireY - 0.14, 0.22);
      pier.position.set(Math.cos(a) * radius * 0.58, (fireY - 0.14) / 2 + 0.07, Math.sin(a) * radius * 0.58);
      group.add(pier);
    }
    const coals = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.56, 0.09, 14),
      new THREE.MeshStandardMaterial({
        color: 0x2a1408, emissive: 0xc04a12, emissiveIntensity: 1.6, roughness: 0.85
      }));
    coals.position.y = fireY + 0.04;
    group.add(coals);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spread = i === 0 ? 0 : radius * 0.3;
      const flare = new THREE.Sprite(flameMat());
      flare.position.set(Math.cos(a) * spread, fireY + 0.3 + (i ? Math.random() * 0.14 : 0.18),
        Math.sin(a) * spread);
      const base = i === 0 ? 1.05 : 0.72;
      flare.scale.set(base * 0.72, base, 1);
      group.add(flare);
      flares.push({ flare, base, phase: i * 1.3 });
    }
    const light = new THREE.PointLight(0xff9c46, intensity, distance, 1.6);
    light.position.y = fireY + 0.45;
    group.add(light);
    return { group, flares, light };
  }

  // ---- structure ------------------------------------------------------

  // Roof beams. The ceiling prism already exists overhead; these give it a
  // reason to be up there and stop the top of the frame reading as void.
  function timberRoof({ width, depth, y, spacing = 2.1 }) {
    const group = new THREE.Group();
    const ridge = box(mat.darkOak, 0.3, 0.3, depth * 0.98);
    ridge.position.y = y + 0.5;
    group.add(ridge);
    for (let z = -depth / 2 + spacing * 0.6; z < depth / 2; z += spacing) {
      group.add(place(box(mat.darkOak, width * 0.98, 0.26, 0.3), 0, y, z));
      for (const side of [-1, 1]) {
        const brace = box(mat.darkOak, 0.2, 0.2, 1.5);
        brace.position.set(side * width * 0.34, y + 0.34, z);
        brace.rotation.x = Math.PI / 2;
        brace.rotation.z = side * 0.62;
        group.add(brace);
      }
    }
    return group;
  }

  // A gallery around the upper wall: the single cheapest way to make an eight
  // metre room feel inhabited rather than merely tall.
  function mezzanine({ width, depth, y = 4.5, ledge = 1.5, backOnly = false }) {
    const group = new THREE.Group();
    const railHeight = 0.95;

    // One run of gallery, built along its own local +X and rotated into place.
    // Keeping the maths in one axis is what stops the railing and the brackets
    // drifting apart on the side runs.
    const run = (span, x, z, ry) => {
      const bay = new THREE.Group();
      bay.add(place(box(mat.oak, span, 0.16, ledge), 0, 0, 0));

      const posts = Math.max(3, Math.round(span / 0.8));
      const railZ = ledge / 2 - 0.06;
      for (let i = 0; i <= posts; i++) {
        const post = new THREE.Mesh(geo.post, mat.darkOak);
        post.scale.y = railHeight;
        post.position.set(-span / 2 + (span / posts) * i, railHeight / 2 + 0.08, railZ);
        bay.add(post);
      }
      const rail = new THREE.Mesh(geo.rail, mat.darkOak);
      rail.scale.y = span;
      rail.rotation.z = Math.PI / 2;
      rail.position.set(0, railHeight + 0.08, railZ);
      bay.add(rail);

      // brackets under the deck so it does not float off the wall
      const brackets = Math.max(2, Math.round(span / 2.4));
      for (let i = 0; i < brackets; i++) {
        const bracket = box(mat.darkOak, 0.16, 0.72, 0.16);
        bracket.position.set(-span / 2 + (span / (brackets - 1)) * i, -0.44, -ledge / 2 + 0.2);
        bay.add(bracket);
      }

      place(bay, x, y, z, ry);
      group.add(bay);
    };

    // back wall, then the two returns down the side walls
    run(width * 0.94, 0, -depth / 2 + ledge / 2 + 0.3, 0);
    if (!backOnly) {
      const sideSpan = depth * 0.46;
      for (const side of [-1, 1]) {
        run(sideSpan, side * (width / 2 - ledge / 2 - 0.3),
          -depth / 2 + ledge + sideSpan / 2, side * Math.PI / 2);
      }
    }
    return group;
  }

  // A tall arched opening onto the night. The rooms have no real windows, so
  // this is a lit panel in a stone reveal - at night, indistinguishable.
  function archedWindow({ width = 1.5, height = 3.1 } = {}) {
    const group = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), nightPaneMat);
    group.add(pane);
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(width / 2, 0.12, 6, 14, Math.PI), mat.stone);
    arch.position.y = height / 2;
    group.add(arch);
    const archPane = new THREE.Mesh(
      new THREE.CircleGeometry(width / 2, 14, 0, Math.PI), nightPaneMat);
    archPane.position.y = height / 2;
    group.add(archPane);
    for (const side of [-1, 1]) {
      group.add(place(box(mat.stone, 0.16, height + 0.2, 0.22), side * (width / 2 + 0.06), 0, 0));
    }
    group.add(place(box(mat.stone, width + 0.34, 0.2, 0.26), 0, -height / 2 - 0.05, 0));
    // No spill light: the pane is unlit material and already reads as bright
    // against the stone, so a point light here would only cost a frame.
    return group;
  }

  // ---- furniture ------------------------------------------------------

  // A bench with legs and a stretcher. The old benches were floating planks;
  // legs are the difference between a prop and a piece of furniture.
  function workbench({ length = 7.6, width = 2.2, height = 1.0 }) {
    const group = new THREE.Group();
    group.add(place(box(mat.oak, width, 0.16, length), 0, height, 0));
    group.add(place(box(mat.darkOak, width + 0.1, 0.06, length + 0.1), 0, height - 0.11, 0));
    const legInset = 0.34;
    for (const lx of [-width / 2 + legInset, width / 2 - legInset]) {
      for (const lz of [-length / 2 + legInset, length / 2 - legInset]) {
        group.add(place(box(mat.darkOak, 0.16, height - 0.18, 0.16), lx, (height - 0.18) / 2, lz));
      }
      group.add(place(box(mat.darkOak, 0.1, 0.1, length - legInset * 2), lx, 0.28, 0));
    }
    return group;
  }

  // Glassware on a rack. Bodies and necks, amber contents, and a few pale
  // empties so the lit ones read as full rather than as decoration.
  function vialShelf({ count = 7, spacing = 0.42, tier = 2, lit = 0.55 } = {}) {
    const group = new THREE.Group();
    const width = count * spacing;
    for (let t = 0; t < tier; t++) {
      const y = t * 0.32;
      group.add(place(box(mat.darkOak, width, 0.05, 0.24), 0, y, 0));
      for (const side of [-1, 1]) {
        group.add(place(box(mat.darkOak, 0.055, 0.32, 0.22), side * width / 2, y + 0.16, 0));
      }
      for (let i = 0; i < count; i++) {
        const x = -width / 2 + spacing * (i + 0.5);
        const glass = Math.random() < lit ? glassAmber : glassPale;
        if ((i + t) % 3 === 0) {
          const body = new THREE.Mesh(geo.flaskBody, glass);
          body.position.set(x, y + 0.11, 0);
          group.add(body);
          const neck = new THREE.Mesh(geo.flaskNeck, glass);
          neck.position.set(x, y + 0.23, 0);
          group.add(neck);
        } else {
          const body = new THREE.Mesh(geo.bottleBody, glass);
          body.position.set(x, y + 0.1, 0);
          group.add(body);
          const neck = new THREE.Mesh(geo.bottleNeck, glass);
          neck.position.set(x, y + 0.2, 0);
          group.add(neck);
        }
      }
    }
    return group;
  }

  function jarRow({ count = 4, spacing = 0.34 } = {}) {
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const jar = new THREE.Mesh(geo.jar, mat.clay);
      jar.position.set(-((count - 1) * spacing) / 2 + i * spacing, 0.12, 0);
      jar.scale.y = 0.8 + Math.random() * 0.5;
      group.add(jar);
    }
    return group;
  }

  // Four spine materials, built once. Giving each book its own material was
  // costing a draw call and a shader lookup per book for a colour difference
  // nobody can read from the floor of an eight-metre room.
  const spineMats = [0x5a3524, 0x3d4a58, 0x5c4a2c, 0x46304a].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));

  function bookRow({ length = 1.6, height = 0.3 } = {}) {
    const group = new THREE.Group();
    let x = -length / 2;
    while (x < length / 2) {
      const w = 0.05 + Math.random() * 0.05;
      const book = new THREE.Mesh(geo.book, spineMats[(Math.random() * spineMats.length) | 0]);
      book.scale.set(w, height * (0.75 + Math.random() * 0.35), 0.2);
      book.position.set(x + w / 2, book.scale.y / 2, 0);
      book.rotation.z = Math.random() < 0.12 ? 0.22 : 0;
      group.add(book);
      x += w + 0.008;
    }
    return group;
  }

  function crateStack({ count = 3 } = {}) {
    const group = new THREE.Group();
    let y = 0;
    for (let i = 0; i < count; i++) {
      const s = 0.62 - i * 0.06;
      const crate = new THREE.Mesh(geo.crate, mat.oak);
      crate.scale.set(s, s * 0.82, s);
      crate.position.set((Math.random() - 0.5) * 0.12, y + s * 0.41, (Math.random() - 0.5) * 0.12);
      crate.rotation.y = (Math.random() - 0.5) * 0.5;
      group.add(crate);
      // slats so a crate is not just a cube
      for (const sy of [-0.26, 0.26]) {
        const slat = box(mat.darkOak, s * 1.02, s * 0.09, s * 1.02);
        slat.position.set(crate.position.x, y + s * 0.41 + sy * s, crate.position.z);
        slat.rotation.y = crate.rotation.y;
        group.add(slat);
      }
      y += s * 0.82;
    }
    return group;
  }

  function barrel() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(geo.barrel, mat.oak);
    body.position.y = 0.39;
    group.add(body);
    for (const y of [0.16, 0.62]) {
      const hoop = new THREE.Mesh(geo.ring, mat.iron);
      hoop.scale.set(0.31, 0.31, 1);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.y = y;
      group.add(hoop);
    }
    return group;
  }

  function sackPile({ count = 3 } = {}) {
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const sack = new THREE.Mesh(geo.sack, mat.linen);
      sack.scale.set(0.9, 1.25, 0.9);
      sack.position.set((Math.random() - 0.5) * 0.5, 0.32, (Math.random() - 0.5) * 0.4);
      group.add(sack);
    }
    return group;
  }

  function scrollPile({ count = 4 } = {}) {
    const group = new THREE.Group();
    for (let i = 0; i < count; i++) {
      const scroll = new THREE.Mesh(geo.scroll, mat.parchment);
      scroll.rotation.z = Math.PI / 2;
      scroll.rotation.y = Math.random() * Math.PI;
      scroll.position.set((Math.random() - 0.5) * 0.4, 0.05 + (i % 2) * 0.09, (Math.random() - 0.5) * 0.3);
      group.add(scroll);
    }
    return group;
  }

  // Stock hung from the beams. Herb bundles and copper pots at varying drops
  // break the empty band between the gallery and the roof.
  function hangingStock({ drops = [] } = {}) {
    const group = new THREE.Group();
    for (const drop of drops) {
      const item = new THREE.Group();
      const chain = new THREE.Mesh(geo.chain, mat.iron);
      chain.scale.y = drop.length;
      chain.position.y = -drop.length / 2;
      item.add(chain);
      if (drop.kind === 'pot') {
        const pot = new THREE.Mesh(geo.pot, mat.copper);
        pot.position.y = -drop.length - 0.14;
        pot.scale.setScalar(drop.scale || 1);
        item.add(pot);
      } else {
        for (let i = 0; i < 3; i++) {
          const bundle = new THREE.Mesh(geo.herbBundle, mat.herb);
          bundle.position.set((i - 1) * 0.09, -drop.length - 0.26, 0);
          bundle.rotation.z = (i - 1) * 0.16;
          bundle.scale.setScalar(drop.scale || 1);
          item.add(bundle);
        }
      }
      place(item, drop.x, drop.y, drop.z);
      group.add(item);
    }
    return group;
  }

  // ---- baking ---------------------------------------------------------

  // Dressing a room this densely costs draw calls, not triangles: the whole
  // alchemy set is under 36k triangles but arrives as hundreds of separate
  // meshes, and a room that adds 800 draw calls cannot be repeated five times.
  //
  // None of it moves, and it is drawn from a handful of shared materials, so
  // the meshes can be baked into one merged geometry per material.  Lights and
  // flame sprites are lifted out first and re-parented with their transforms
  // intact - they are the only parts that still need to be their own object.
  function freezeStatic(root) {
    root.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const local = new THREE.Matrix4();
    const byMaterial = new Map();
    const keep = [];

    root.traverse(node => {
      if (node === root) return;
      if (node.isMesh && node.geometry) {
        const geometry = node.geometry.clone();
        geometry.applyMatrix4(local.multiplyMatrices(inverse, node.matrixWorld));
        const bucket = byMaterial.get(node.material);
        if (bucket) bucket.push(geometry);
        else byMaterial.set(node.material, [geometry]);
      } else if (node.isLight || node.isSprite) {
        keep.push(node);
      }
    });

    // Detach survivors before clearing, restating their transform relative to
    // the root they are about to be re-attached to.
    for (const node of keep) {
      local.multiplyMatrices(inverse, node.matrixWorld);
      local.decompose(node.position, node.quaternion, node.scale);
    }
    root.clear();

    let merged = 0;
    for (const [material, geometries] of byMaterial) {
      const batch = geometries.length > 1 ? mergeGeometries(geometries, false) : geometries[0];
      if (!batch) {
        // Mismatched attributes: keep this material unbaked rather than lose it.
        for (const geometry of geometries) root.add(new THREE.Mesh(geometry, material));
        continue;
      }
      if (geometries.length > 1) for (const geometry of geometries) geometry.dispose();
      const mesh = new THREE.Mesh(batch, material);
      mesh.castShadow = mesh.receiveShadow = true;
      root.add(mesh);
      merged++;
    }
    for (const node of keep) root.add(node);
    return { batches: merged, lights: keep.filter(n => n.isLight).length };
  }

  // ---- animation ------------------------------------------------------

  // One updater drives every flame in a room. Candles flicker fast and shallow;
  // hearth fire breathes slower and deeper. Both drive their light so the walls
  // move with the flame instead of sitting under a constant lamp.
  function createFlameAnimator(entries, lights = []) {
    return (t) => {
      for (const entry of entries) {
        const f = Math.sin(t * 9.1 + entry.phase) * 0.5 + Math.sin(t * 3.7 + entry.phase * 1.7) * 0.5;
        const k = 1 + f * 0.13;
        entry.flare.scale.y = entry.base * k;
        entry.flare.scale.x = entry.base * 0.66 * (1 + f * 0.07);
        entry.flare.material.opacity = 0.78 + f * 0.16;
      }
      for (const light of lights) {
        if (!light.userData.baseIntensity) light.userData.baseIntensity = light.intensity;
        const f = Math.sin(t * 5.3 + (light.userData.seed ||= Math.random() * 6.283));
        light.intensity = light.userData.baseIntensity * (1 + f * 0.09);
      }
    };
  }

  return {
    mat, geo, box, place,
    candle, candleChandelier, wallSconce, hearthFire,
    timberRoof, mezzanine, archedWindow,
    workbench, vialShelf, jarRow, bookRow,
    crateStack, barrel, sackPile, scrollPile, hangingStock,
    freezeStatic, createFlameAnimator
  };
}
