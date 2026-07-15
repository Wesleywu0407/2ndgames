import * as THREE from 'three';

const CONFIG = {
  look: { color: 0x8fc7ff, en: 'LOOK HERE', zh: '看這裡' },
  danger: { color: 0xff6f68, en: 'DANGER', zh: '危險' },
  help: { color: 0xd59aff, en: 'HELP', zh: '幫忙' },
  wait: { color: 0xffcb7d, en: 'WAIT', zh: '等等' },
  ready: { color: 0x86e0ad, en: 'READY', zh: '準備好了' }
};

export function createCoopPings({ scene, tr, storyCard }) {
  const root = new THREE.Group();
  root.name = 'StoryPingMarkers';
  scene.add(root);
  const pool = [];
  for (let index = 0; index < 10; index++) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.06, 8, 36), material);
    ring.rotation.x = Math.PI / 2;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.16, 5.5, 10, 1, true), material);
    beam.position.y = 2.75;
    group.add(ring, beam);
    group.visible = false;
    root.add(group);
    pool.push({ group, ring, beam, material, ttl: 0, age: 0, name: '', kind: 'look' });
  }
  let cursor = 0;

  function add(message) {
    const config = CONFIG[message?.kind];
    if (!config || !Array.isArray(message.p)) return;
    const marker = pool.find(item => item.ttl <= 0) || pool[cursor++ % pool.length];
    marker.group.position.set(Number(message.p[0]) || 0, 0.1, Number(message.p[2]) || 0);
    marker.material.color.setHex(config.color);
    marker.material.opacity = 0.9;
    marker.ttl = 6; marker.age = 0; marker.name = message.name || 'Lantern'; marker.kind = message.kind;
    marker.group.scale.setScalar(0.4);
    marker.group.visible = true;
    storyCard(tr(`${marker.name}: ${config.en}`, `${marker.name}：${config.zh}`), tr('story ping · G opens your ping wheel', '故事標記 · 按 G 開啟標記選單'), 1800);
  }

  function update(t, dt) {
    for (const marker of pool) {
      if (marker.ttl <= 0) continue;
      marker.ttl -= dt; marker.age += dt;
      const appear = Math.min(1, marker.age * 5);
      marker.group.scale.setScalar(0.4 + appear * 0.6 + Math.sin(t * 4 + marker.age) * 0.035);
      marker.ring.rotation.z += dt * 0.8;
      marker.beam.scale.y = 0.85 + Math.sin(t * 3.2) * 0.15;
      marker.material.opacity = Math.min(0.9, marker.ttl * 0.55);
      if (marker.ttl <= 0) marker.group.visible = false;
    }
  }

  window.addEventListener('sky-story-ping', event => add(event.detail));
  return { update, add };
}
