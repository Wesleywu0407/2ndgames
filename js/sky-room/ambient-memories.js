import * as THREE from 'three';
import { radialTexture } from './textures.js';

function photoTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 272;
  const context = canvas.getContext('2d');
  const background = context.createLinearGradient(0, 0, 0, 272);
  background.addColorStop(0, '#cdb28b');
  background.addColorStop(1, '#7d6544');
  context.fillStyle = background;
  context.fillRect(0, 0, 220, 272);

  context.fillStyle = 'rgba(240,230,205,0.85)';
  context.beginPath();
  context.arc(158, 62, 22, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = '#5d4a30';
  context.beginPath();
  context.moveTo(0, 190);
  context.quadraticCurveTo(60, 150, 120, 186);
  context.quadraticCurveTo(175, 214, 220, 178);
  context.lineTo(220, 272);
  context.lineTo(0, 272);
  context.fill();

  context.fillStyle = '#3f3220';
  context.fillRect(52, 108, 22, 92);
  context.beginPath();
  context.moveTo(48, 110);
  context.lineTo(63, 84);
  context.lineTo(78, 110);
  context.fill();

  for (let index = 0; index < 700; index++) {
    context.fillStyle = `rgba(60,45,25,${Math.random() * 0.12})`;
    context.fillRect(Math.random() * 220, Math.random() * 272, 1.4, 1.4);
  }
  const vignette = context.createRadialGradient(110, 136, 60, 110, 136, 190);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(30,20,8,0.55)');
  context.fillStyle = vignette;
  context.fillRect(0, 0, 220, 272);
  return canvas;
}

function letterTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 176;
  const context = canvas.getContext('2d');
  const background = context.createLinearGradient(0, 0, 256, 176);
  background.addColorStop(0, '#e9dfc6');
  background.addColorStop(1, '#cfc2a2');
  context.fillStyle = background;
  context.fillRect(0, 0, 256, 176);

  context.strokeStyle = 'rgba(110,95,65,0.4)';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, 60);
  context.lineTo(256, 56);
  context.stroke();
  context.beginPath();
  context.moveTo(0, 118);
  context.lineTo(256, 122);
  context.stroke();

  context.strokeStyle = 'rgba(75,60,40,0.75)';
  context.lineWidth = 1.4;
  for (let row = 0; row < 8; row++) {
    const y = 24 + row * 18;
    context.beginPath();
    context.moveTo(22, y);
    for (let x = 22; x < 210 + Math.random() * 24; x += 7) {
      context.quadraticCurveTo(
        x + 3,
        y + (Math.random() - 0.5) * 7,
        x + 7,
        y + (Math.random() - 0.5) * 3
      );
    }
    context.stroke();
  }
  return canvas;
}

function dialTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const background = context.createRadialGradient(128, 128, 20, 128, 128, 128);
  background.addColorStop(0, '#f2e8d2');
  background.addColorStop(1, '#cbb890');
  context.fillStyle = background;
  context.beginPath();
  context.arc(128, 128, 126, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = '#5a4526';

  for (let index = 0; index < 12; index++) {
    const angle = (index / 12) * Math.PI * 2;
    context.lineWidth = index % 3 === 0 ? 6 : 3;
    context.beginPath();
    context.moveTo(128 + Math.cos(angle) * 96, 128 + Math.sin(angle) * 96);
    context.lineTo(128 + Math.cos(angle) * 114, 128 + Math.sin(angle) * 114);
    context.stroke();
  }

  context.lineWidth = 7;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(128, 128);
  context.lineTo(128 + Math.cos(-1.83) * 58, 128 + Math.sin(-1.83) * 58);
  context.stroke();
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(128, 128);
  context.lineTo(128 + Math.cos(1.15) * 88, 128 + Math.sin(1.15) * 88);
  context.stroke();
  context.fillStyle = '#5a4526';
  context.beginPath();
  context.arc(128, 128, 8, 0, Math.PI * 2);
  context.fill();
  return canvas;
}

function createMemoryDefinitions({ photoCanvas, flyY, amber }) {
  return [
    {
      name: 'photograph', radius: 4.2, height: flyY - 0.5, period: 18, phase: 0.4,
      preview: {
        img: photoCanvas.toDataURL('image/jpeg', 0.8),
        text: { en: 'Someone loved this view, once.', zh: '曾經，有人深愛著這片風景。' }
      },
      build() {
        const group = new THREE.Group();
        const texture = new THREE.CanvasTexture(photoCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const frame = new THREE.Mesh(
          new THREE.PlaneGeometry(1.06, 1.28),
          new THREE.MeshBasicMaterial({
            color: amber, side: THREE.DoubleSide, transparent: true, opacity: 0.35
          })
        );
        frame.position.z = -0.012;
        const photo = new THREE.Mesh(
          new THREE.PlaneGeometry(0.94, 1.16),
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
        );
        group.add(frame, photo);
        return group;
      }
    },
    {
      name: 'letter', radius: 5.8, height: flyY + 0.7, period: 27, phase: 2.5,
      preview: {
        text: {
          en: '"We were never meant to stay down there." — the only line still legible.',
          zh: '「我們從來就不該留在下面。」——唯一仍可辨識的句子。'
        }
      },
      build() {
        const group = new THREE.Group();
        const texture = new THREE.CanvasTexture(letterTexture());
        texture.colorSpace = THREE.SRGBColorSpace;
        const geometry = new THREE.PlaneGeometry(1.15, 0.8, 12, 1);
        const positions = geometry.attributes.position;
        for (let index = 0; index < positions.count; index++) {
          positions.setZ(index,
            Math.abs(positions.getX(index)) * -0.22 + Math.sin(positions.getX(index) * 5.5) * 0.02);
        }
        geometry.computeVertexNormals();
        const paper = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
          map: texture, side: THREE.DoubleSide, roughness: 0.85, metalness: 0,
          emissive: 0xe8d8b0, emissiveIntensity: 0.07, emissiveMap: texture
        }));
        group.add(paper);
        return group;
      }
    },
    {
      name: 'watch', radius: 7.3, height: flyY + 1.6, period: 34, phase: 4.6,
      preview: {
        text: {
          en: 'A brass pocket watch, stopped at the hour the room first rose.',
          zh: '一枚黃銅懷錶，停在房間首次升空的時刻。'
        }
      },
      build() {
        const group = new THREE.Group();
        const brass = new THREE.MeshStandardMaterial({
          color: 0xc99f57, metalness: 1, roughness: 0.32,
          emissive: 0x2a1c08, emissiveIntensity: 0.8
        });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 40), brass);
        body.rotation.x = Math.PI / 2;
        const dial = new THREE.CanvasTexture(dialTexture());
        dial.colorSpace = THREE.SRGBColorSpace;
        const face = new THREE.Mesh(
          new THREE.CircleGeometry(0.295, 40),
          new THREE.MeshStandardMaterial({
            map: dial, roughness: 0.5, emissive: 0xf0e0c0,
            emissiveIntensity: 0.22, emissiveMap: dial
          })
        );
        face.position.z = 0.062;
        const crownStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.09, 16), brass);
        crownStem.position.y = 0.39;
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.065, 18, 14), brass);
        crown.position.y = 0.445;
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 10, 24), brass);
        loop.position.y = 0.53;
        group.add(body, face, crownStem, crown, loop);
        group.userData.spin = true;
        return group;
      }
    }
  ];
}

export function createAmbientMemories({
  scene, camera, flyY, amber, getHovered, getSignatureActive,
  qaLocomotionProbe = false, canvas
}) {
  const definitions = createMemoryDefinitions({
    photoCanvas: photoTexture(), flyY, amber
  });
  const haloTexture = radialTexture(
    'rgba(232,186,120,0.9)', 'rgba(232,176,106,0)', 128
  );
  const items = definitions.map(definition => {
    const group = new THREE.Group();
    const object = definition.build();
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTexture, color: amber, transparent: true, opacity: 0.07,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    halo.scale.setScalar(2.6);
    group.add(halo, object);
    scene.add(group);
    return { def: definition, group, obj: object, halo, hover: 0 };
  });

  return {
    items,
    update(time, delta) {
      const hovered = getHovered();
      const signatureActive = getSignatureActive();
      for (const item of items) {
        const { radius, height, period, phase } = item.def;
        const angle = (time / period) * Math.PI * 2 + phase;
        item.group.position.set(
          Math.cos(angle) * radius,
          height + Math.sin(time * 0.45 + phase * 2) * 0.3,
          Math.sin(angle) * radius
        );
        item.obj.lookAt(camera.position);
        if (item.obj.userData.spin) item.obj.rotation.y = time * 0.35;
        item.obj.rotation.z = Math.sin(time * 0.4 + phase) * 0.06;

        const hoverTarget = item === hovered ? 1 : 0;
        item.hover += (hoverTarget - item.hover) * Math.min(1, delta * 6);
        item.obj.scale.setScalar(1 + item.hover * 0.16);
        const signatureReveal = signatureActive && !item.def.collected ? 0.32 : 0;
        item.halo.material.opacity = (item.def.collected ? 0.2 : 0.06)
          + item.hover * 0.16 + signatureReveal
          + Math.sin(time * 1.3 + phase) * 0.015;
        item.halo.scale.setScalar(2.6 * (1 + item.hover * 0.2));
      }

      if (qaLocomotionProbe) {
        canvas.dataset.memoryPositions = JSON.stringify(items
          .filter(item => !item.def.collected)
          .map(item => ({
            name: item.def.name,
            position: item.group.position.toArray().map(value => Number(value.toFixed(2)))
          })));
      }
    }
  };
}
