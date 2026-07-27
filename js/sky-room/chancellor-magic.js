import * as THREE from 'three';
import { effectBudgets } from './effect-budgets.js';

export const CHANCELLOR_TOLL_DEFAULTS = Object.freeze({
  radius: 11.5,
  damage: 12,
  cooldownMs: 1250,
  empoweredRadius: 15,
  empoweredDamage: 22,
  empoweredCooldownMs: 900,
  bossDamage: 1,
  empoweredBossDamage: 2
});

export const CHANCELLOR_TOLL_DIRECTIONS = Object.freeze(Array.from({ length: 8 }, (_, index) => {
  const angle = index / 8 * Math.PI * 2;
  return Object.freeze([Math.cos(angle), 0, Math.sin(angle)]);
}));

export function chancellorTollStats(abilityConfig = {}, empowered = false) {
  const config = { ...CHANCELLOR_TOLL_DEFAULTS, ...(abilityConfig.primaryConfig || {}) };
  return Object.freeze({
    radius: Math.max(1, Number(empowered ? config.empoweredRadius : config.radius) || 1),
    damage: Math.max(0, Number(empowered ? config.empoweredDamage : config.damage) || 0),
    cooldown: Math.max(0.1, Number(empowered ? config.empoweredCooldownMs : config.cooldownMs) / 1000 || 0.1),
    bossDamage: Math.max(0, Number(empowered ? config.empoweredBossDamage : config.bossDamage) || 0),
    empowered
  });
}

function runeGeometry(count) {
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const angle = index / count * Math.PI * 2;
    const radius = index % 3 === 0 ? 0.58 : 0.82;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = 0;
    positions[index * 3 + 2] = Math.sin(angle) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

// A bounded, allocation-free effect pool for Aldous Crane. Bell Toll is kept
// separate from the shared amber weapon effects so it always reads as his
// personal violet magic without adding meshes during combat.
export function createChancellorMagic({ scene, camera, coreTexture, quality = 'balanced', reducedMotion = false }) {
  const performance = quality === 'performance';
  const budget = effectBudgets(quality).chancellor;
  const tollCapacity = budget.tolls;
  const impactCapacity = budget.impacts;
  const ringGeometry = new THREE.RingGeometry(0.76, 1, performance ? 40 : 64);
  const runePointsGeometry = runeGeometry(performance ? 18 : 30);
  const impactGeometry = new THREE.RingGeometry(0.5, 0.82, performance ? 24 : 40);
  const tolls = [];
  const impacts = [];
  let serial = 0;

  for (let index = 0; index < tollCapacity; index++) {
    const group = new THREE.Group();
    const rings = [0x7c38ff, 0xb05cff, 0xe5c4ff].map((color, ringIndex) => {
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
      }));
      ring.rotation.x = -Math.PI / 2;
      ring.scale.setScalar(0.1 + ringIndex * 0.04);
      group.add(ring);
      return ring;
    });
    const runes = new THREE.Points(runePointsGeometry, new THREE.PointsMaterial({
      color: 0xd8a6ff, size: performance ? 0.08 : 0.11, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTexture, color: 0x9b43ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    glow.material.rotation = Math.PI / 4;
    group.add(runes, glow);
    group.visible = false;
    scene.add(group);
    tolls.push({ group, rings, runes, glow, age: 0, duration: 0.82, radius: 1, serial: 0, empowered: false });
  }

  for (let index = 0; index < impactCapacity; index++) {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(impactGeometry, new THREE.MeshBasicMaterial({
      color: 0xc277ff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coreTexture, color: 0x8e35ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false
    }));
    group.add(ring, glow);
    group.visible = false;
    scene.add(group);
    impacts.push({ group, ring, glow, age: 0, duration: 0.42, size: 1, serial: 0 });
  }

  const oldest = pool => pool.reduce((choice, item) => !choice || item.serial < choice.serial ? item : choice, null);

  function toll(position, radius, empowered = false) {
    const effect = tolls.find(item => !item.group.visible) || oldest(tolls);
    effect.age = 0;
    effect.duration = reducedMotion ? 0.5 : empowered ? 1.05 : 0.82;
    effect.radius = reducedMotion ? Math.min(radius, 10) : radius;
    effect.empowered = empowered;
    effect.serial = ++serial;
    effect.group.position.set(position.x, 0.1, position.z);
    effect.group.scale.setScalar(0.01);
    effect.glow.material.color.setHex(empowered ? 0xe0a6ff : 0x9b43ff);
    effect.runes.material.color.setHex(empowered ? 0xf2d8ff : 0xd8a6ff);
    effect.group.visible = true;
  }

  function impact(position, size = 1, empowered = false) {
    const effect = impacts.find(item => !item.group.visible) || oldest(impacts);
    effect.age = 0;
    effect.size = size * (empowered ? 1.35 : 1);
    effect.serial = ++serial;
    effect.group.position.copy(position);
    effect.group.scale.setScalar(0.01);
    effect.ring.material.color.setHex(empowered ? 0xedc8ff : 0xc277ff);
    effect.glow.material.color.setHex(empowered ? 0xca75ff : 0x8e35ff);
    effect.group.visible = true;
  }

  function update(dt, motionScale = 1) {
    for (const effect of tolls) {
      if (!effect.group.visible) continue;
      effect.age += dt;
      const progress = Math.min(1, effect.age / effect.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      effect.group.scale.setScalar(0.15 + effect.radius * eased);
      for (let index = 0; index < effect.rings.length; index++) {
        const localProgress = Math.max(0, Math.min(1, progress * 1.28 - index * 0.13));
        effect.rings[index].scale.setScalar(0.74 + localProgress * (0.26 + index * 0.035));
        effect.rings[index].material.opacity = Math.sin(localProgress * Math.PI) * (effect.empowered ? 0.92 : 0.72);
      }
      effect.runes.material.opacity = Math.sin(progress * Math.PI) * (effect.empowered ? 0.9 : 0.68);
      effect.runes.rotation.y += dt * (effect.empowered ? 2.4 : 1.65) * motionScale;
      effect.glow.material.opacity = Math.sin(progress * Math.PI) * (effect.empowered ? 0.7 : 0.42);
      effect.glow.scale.setScalar(0.2 + progress * 0.75);
      if (progress >= 1) effect.group.visible = false;
    }

    for (const effect of impacts) {
      if (!effect.group.visible) continue;
      effect.age += dt;
      const progress = Math.min(1, effect.age / effect.duration);
      effect.group.scale.setScalar((0.18 + progress * 2.3) * effect.size);
      effect.ring.lookAt(camera.position);
      effect.ring.material.opacity = (1 - progress) * 0.88;
      effect.glow.material.opacity = (1 - progress) * (1 - progress) * 0.92;
      effect.glow.scale.setScalar(1.05 + progress * 1.8);
      if (progress >= 1) effect.group.visible = false;
    }
  }

  return {
    toll,
    impact,
    update,
    get stats() {
      return {
        triggered: serial,
        tolls: tolls.filter(effect => effect.group.visible).length,
        impacts: impacts.filter(effect => effect.group.visible).length,
        capacity: { tolls: tollCapacity, impacts: impactCapacity }
      };
    }
  };
}
