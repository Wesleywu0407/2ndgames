import * as THREE from 'three';
import { effectBudgets } from './effect-budgets.js';

const PALETTES = Object.freeze({
  1: { core: 0xfff0c8, edge: 0xff9f52 },
  2: { core: 0xffd8a1, edge: 0xb879ff },
  3: { core: 0xeaf2ff, edge: 0x82aaff },
  cleanse: { core: 0xffedbd, edge: 0xb995e8 },
  boss: { core: 0xfff3c9, edge: 0xffb25f }
});

function burstGeometry(count = 18) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const angle = index * 2.399963229728653;
    const y = 1 - (index + 0.5) * 2 / count;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

function restorationGeometry(count = 32) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const angle = index / count * Math.PI * 2;
    const radius = 0.72 + (index % 5) * 0.065;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = (index % 4) * 0.025;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export function createCombatEffects({ scene, camera, coreTexture, moteTexture, quality = 'balanced', reducedMotion = false }) {
  const performance = quality === 'performance';
  const budget = effectBudgets(quality).combat;
  const impactCount = budget.impacts;
  const moteCount = budget.motes;
  const restorationCount = budget.restorations;
  const impactRingGeometry = new THREE.RingGeometry(0.58, 0.82, 32);
  const impactBurstGeometry = burstGeometry(performance ? 12 : 18);
  const restorationRingGeometry = new THREE.RingGeometry(0.82, 1, 64);
  const restorationPetalGeometry = restorationGeometry(performance ? 20 : 32);
  const impacts = [];
  const motes = [];
  const restorations = [];
  const pull = new THREE.Vector3();
  let serial = 0;

  for (let index = 0; index < impactCount; index++) {
    const group = new THREE.Group();
    const glowMaterial = new THREE.SpriteMaterial({
      map: coreTexture, color: 0xffffff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const glow = new THREE.Sprite(glowMaterial);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ring = new THREE.Mesh(impactRingGeometry, ringMaterial);
    const burstMaterial = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.12, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const burst = new THREE.Points(impactBurstGeometry, burstMaterial);
    group.add(glow, ring, burst);
    group.visible = false;
    scene.add(group);
    impacts.push({ group, glow, ring, burst, age: 0, duration: 0.48, size: 1, serial: 0 });
  }

  for (let index = 0; index < moteCount; index++) {
    const material = new THREE.SpriteMaterial({
      map: moteTexture, color: 0xffe4a8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    motes.push({ sprite, age: 0, phase: index * 1.618, active: false });
  }

  for (let index = 0; index < restorationCount; index++) {
    const group = new THREE.Group();
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xb995e8, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const ring = new THREE.Mesh(restorationRingGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    const petalsMaterial = new THREE.PointsMaterial({
      color: 0xd7afff, size: 0.09, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const petals = new THREE.Points(restorationPetalGeometry, petalsMaterial);
    const glowMaterial = new THREE.SpriteMaterial({
      map: coreTexture, color: 0xffe7b0, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const glow = new THREE.Sprite(glowMaterial);
    glow.material.rotation = Math.PI * 0.25;
    group.add(ring, petals, glow);
    group.visible = false;
    scene.add(group);
    restorations.push({ group, ring, petals, glow, age: 0, duration: 3.1, radius: 1, active: false, serial: 0 });
  }

  const oldest = pool => pool.reduce((choice, item) => !choice || item.serial < choice.serial ? item : choice, null);

  function impact(position, { weapon = 1, size = 1, cleanse = false } = {}) {
    const effect = impacts.find(item => !item.group.visible) || oldest(impacts);
    const palette = PALETTES[cleanse ? 'cleanse' : weapon] || PALETTES[1];
    effect.age = 0;
    effect.duration = cleanse ? 0.72 : weapon === 3 ? 0.62 : 0.48;
    effect.size = size * (cleanse ? 1.45 : 1);
    effect.serial = ++serial;
    effect.group.position.copy(position);
    effect.group.scale.setScalar(0.01);
    effect.glow.material.color.setHex(palette.core);
    effect.ring.material.color.setHex(palette.edge);
    effect.burst.material.color.setHex(palette.core);
    effect.group.visible = true;
    return effect;
  }

  function mote(position, size = 1) {
    const effect = motes.find(item => !item.active) || motes.reduce((choice, item) => item.age > choice.age ? item : choice, motes[0]);
    effect.age = 0;
    effect.active = true;
    effect.sprite.position.copy(position);
    effect.sprite.position.x += Math.sin(effect.phase + serial) * size * 0.45;
    effect.sprite.position.z += Math.cos(effect.phase * 1.3 + serial) * size * 0.45;
    effect.sprite.scale.setScalar(0.46 + size * 0.13);
    effect.sprite.material.opacity = 0.96;
    effect.sprite.visible = true;
  }

  function restoration(position, radius, type = 'stray') {
    const effect = restorations.find(item => !item.active) || oldest(restorations);
    const palette = PALETTES[type === 'bellwarden' ? 'boss' : 'cleanse'];
    effect.age = 0;
    effect.duration = reducedMotion ? 1.45 : type === 'bellwarden' ? 4.2 : 3.1;
    effect.radius = reducedMotion ? Math.min(radius, 8) : radius;
    effect.active = true;
    effect.serial = ++serial;
    effect.group.position.copy(position);
    effect.group.scale.setScalar(0.01);
    effect.ring.material.color.setHex(palette.edge);
    effect.petals.material.color.setHex(type === 'bellwarden' ? 0xffd493 : 0xcda8ed);
    effect.glow.material.color.setHex(palette.core);
    effect.group.visible = true;
  }

  function defeat(position, type = 'stray') {
    const size = type === 'bellwarden' ? 1.75 : type === 'groundskeeper' ? 1.35 : 1;
    impact(position, { size: size * 1.4, cleanse: true });
    const count = type === 'bellwarden' ? 5 : type === 'groundskeeper' ? 2 : 1;
    for (let index = 0; index < count; index++) mote(position, size + index * 0.12);
  }

  function update(dt, player, heal, motionScale = 1) {
    for (const effect of impacts) {
      if (!effect.group.visible) continue;
      effect.age += dt;
      const progress = Math.min(1, effect.age / effect.duration);
      const expand = (0.12 + progress * (reducedMotion ? 1.25 : 2.1)) * effect.size;
      effect.group.scale.setScalar(expand);
      effect.ring.lookAt(camera.position);
      effect.ring.material.opacity = Math.max(0, (1 - progress) * 0.82);
      effect.glow.material.opacity = Math.max(0, (1 - progress) * (1 - progress) * 0.95);
      effect.glow.scale.setScalar(1.2 + progress * 1.8);
      effect.burst.material.opacity = Math.max(0, (1 - progress) * 0.9);
      effect.burst.rotation.y += dt * 3.2 * motionScale;
      if (progress >= 1) effect.group.visible = false;
    }

    for (const effect of motes) {
      if (!effect.active) continue;
      effect.age += dt;
      effect.sprite.position.y += dt * (0.34 + motionScale * 0.12);
      if (player) {
        const distance = effect.sprite.position.distanceTo(player);
        if (distance < 7) {
          pull.copy(player).sub(effect.sprite.position).normalize();
          effect.sprite.position.addScaledVector(pull, dt * 11);
        }
        if (distance < 1.1) {
          heal?.(12);
          impact(effect.sprite.position, { size: 0.55, cleanse: true });
          effect.active = false;
          effect.sprite.visible = false;
          continue;
        }
      }
      effect.sprite.material.opacity = Math.max(0, Math.min(0.96, (12 - effect.age) * 0.22));
      if (effect.age >= 12) {
        effect.active = false;
        effect.sprite.visible = false;
      }
    }

    for (const effect of restorations) {
      if (!effect.active) continue;
      effect.age += dt;
      const progress = Math.min(1, effect.age / effect.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      effect.group.scale.setScalar(0.3 + effect.radius * eased);
      effect.ring.material.opacity = Math.max(0, 0.74 * (1 - progress));
      effect.petals.material.opacity = Math.max(0, 0.82 * (1 - progress));
      effect.petals.rotation.y += dt * 0.7 * motionScale;
      effect.petals.position.y = Math.sin(progress * Math.PI) * 0.08;
      effect.glow.material.opacity = Math.max(0, Math.sin(progress * Math.PI) * 0.24);
      effect.glow.scale.setScalar(0.35 + progress * 0.65);
      if (progress >= 1) {
        effect.active = false;
        effect.group.visible = false;
      }
    }
  }

  return {
    impact,
    mote,
    defeat,
    restoration,
    update,
    get stats() {
      return {
        triggered: serial,
        impacts: impacts.filter(effect => effect.group.visible).length,
        motes: motes.filter(effect => effect.active).length,
        restorations: restorations.filter(effect => effect.active).length,
        capacity: { impacts: impactCount, motes: moteCount, restorations: restorationCount }
      };
    }
  };
}
