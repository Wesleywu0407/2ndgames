import * as THREE from 'three';
import { PLAYABLE_CHARACTERS, playableCharacter, localised } from './manifest.js';
import { loadPlayableCharacter, disposeCharacterFigure } from './loader.js';
import { CharacterAnimationController } from './animation-controller.js';

export function createCharacterSelection({ createFallback, initialId, initialColor, onConfirm, onCancel }) {
  const root = document.getElementById('characterSelect');
  const previewHost = document.getElementById('characterPreview');
  const roster = document.getElementById('characterRoster');
  const nameEl = document.getElementById('characterName');
  const roleEl = document.getElementById('characterRole');
  const bioEl = document.getElementById('characterBio');
  const ratingsEl = document.getElementById('characterRatings');
  const passiveEl = document.getElementById('characterPassive');
  const signatureEl = document.getElementById('characterSignature');
  const colorEl = document.getElementById('characterAccent');
  const loadingEl = document.getElementById('characterLoading');
  const confirmEl = document.getElementById('characterConfirm');
  const backEl = document.getElementById('characterBack');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  previewHost.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);
  camera.position.set(0, 1.25, 4.1);
  camera.lookAt(0, 1.05, 0);
  scene.add(new THREE.HemisphereLight(0xbacaff, 0x160f20, 2.2));
  const key = new THREE.DirectionalLight(0xffd39a, 3.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8f8cff, 2.1);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05, 1.22, 0.12, 48),
    new THREE.MeshStandardMaterial({ color: 0x211a26, roughness: 0.75, metalness: 0.15 })
  );
  pedestal.position.y = -0.08;
  scene.add(pedestal);

  const mount = new THREE.Group();
  scene.add(mount);
  let selected = playableCharacter(initialId);
  let selectedColor = /^#[0-9a-f]{6}$/i.test(initialColor || '') ? initialColor : selected.colors.accent;
  let figure = null;
  let animation = null;
  let loadController = null;
  let loadVersion = 0;
  let raf = 0;
  let active = false;
  let yaw = 0.2;
  let dragPointer = null;
  let dragX = 0;
  let lastTime = 0;

  function language() { return document.documentElement.lang === 'zh-Hant' ? 'zh-Hant' : 'en'; }
  function copy(value) { return localised(value, language()); }

  function updateCopy() {
    nameEl.textContent = selected.name;
    roleEl.textContent = `${copy(selected.role)} · ${copy(selected.tagline)}`;
    bioEl.textContent = copy(selected.bio);
    passiveEl.innerHTML = `<b>${copy(selected.passive)}</b><span>${copy(selected.passiveText)}</span>`;
    signatureEl.innerHTML = `<b>${copy(selected.signature)}</b><span>${copy(selected.signatureText)}</span>`;
    const labels = language() === 'zh-Hant'
      ? { mobility: '機動', defence: '防禦', control: '控制', support: '支援' }
      : { mobility: 'MOBILITY', defence: 'DEFENCE', control: 'CONTROL', support: 'SUPPORT' };
    ratingsEl.innerHTML = Object.entries(selected.ratings).map(([key, value]) =>
      `<div><span>${labels[key]}</span><i>${'<em></em>'.repeat(value)}${'<u></u>'.repeat(5 - value)}</i></div>`
    ).join('');
    confirmEl.textContent = language() === 'zh-Hant' ? '確認角色' : 'CONFIRM CHARACTER';
    backEl.textContent = language() === 'zh-Hant' ? '返回模式選單' : 'BACK TO MODES';
    loadingEl.textContent = language() === 'zh-Hant' ? '正在召喚角色…' : 'SUMMONING CHARACTER…';
    for (const card of roster.querySelectorAll('[data-character-id]')) {
      const entry = playableCharacter(card.dataset.characterId);
      card.querySelector('b').textContent = entry.name;
      card.querySelector('span').textContent = copy(entry.role);
    }
  }

  function buildRoster() {
    roster.innerHTML = PLAYABLE_CHARACTERS.map(entry => `
      <button type="button" class="character-card" data-character-id="${entry.id}" style="--character-color:${entry.colors.light}">
        <i></i><b>${entry.name}</b><span>${copy(entry.role)}</span><small>${'◆'.repeat(entry.difficulty)}${'◇'.repeat(5 - entry.difficulty)}</small>
      </button>`).join('');
    for (const card of roster.querySelectorAll('[data-character-id]')) {
      card.addEventListener('click', () => select(card.dataset.characterId));
    }
  }

  function disposeCurrent() {
    loadController?.abort();
    loadController = null;
    animation?.dispose();
    animation = null;
    if (figure) {
      mount.remove(figure.group || figure);
      disposeCharacterFigure(figure);
      figure = null;
    }
  }

  async function loadPreview() {
    const version = ++loadVersion;
    disposeCurrent();
    loadController = new AbortController();
    loadingEl.hidden = false;
    confirmEl.disabled = true;
    try {
      const next = await loadPlayableCharacter(selected, {
        signal: loadController.signal,
        createFallback: entry => createFallback(entry, selectedColor)
      });
      if (version !== loadVersion || loadController.signal.aborted) {
        disposeCharacterFigure(next);
        return;
      }
      figure = next;
      const group = figure.group || figure;
      group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const scale = 2.25 / Math.max(0.01, size.y);
      group.scale.multiplyScalar(scale);
      group.updateMatrixWorld(true);
      const fitted = new THREE.Box3().setFromObject(group);
      const center = fitted.getCenter(new THREE.Vector3());
      group.position.x -= center.x;
      group.position.y -= fitted.min.y;
      group.position.z -= center.z;
      mount.add(group);
      animation = new CharacterAnimationController(figure);
    } catch (error) {
      if (error?.name !== 'AbortError') console.error('Character preview failed.', error);
    } finally {
      if (version === loadVersion) {
        loadingEl.hidden = true;
        confirmEl.disabled = !figure;
      }
    }
  }

  function select(id, color = null) {
    selected = playableCharacter(id);
    selectedColor = /^#[0-9a-f]{6}$/i.test(color || '') ? color : selected.colors.accent;
    colorEl.value = selectedColor;
    for (const card of roster.querySelectorAll('[data-character-id]')) {
      card.classList.toggle('selected', card.dataset.characterId === selected.id);
      card.setAttribute('aria-pressed', String(card.dataset.characterId === selected.id));
    }
    updateCopy();
    loadPreview();
  }

  function resize() {
    const width = Math.max(240, previewHost.clientWidth);
    const height = Math.max(300, previewHost.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    if (!active) return;
    const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0);
    lastTime = now;
    mount.rotation.y += (yaw - mount.rotation.y) * Math.min(1, dt * 8);
    animation?.update(now / 1000, dt, 'idle');
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  renderer.domElement.addEventListener('pointerdown', event => {
    dragPointer = event.pointerId; dragX = event.clientX;
    renderer.domElement.setPointerCapture(event.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (event.pointerId !== dragPointer) return;
    yaw += (event.clientX - dragX) * 0.012;
    dragX = event.clientX;
  });
  const stopDrag = event => { if (event.pointerId === dragPointer) dragPointer = null; };
  renderer.domElement.addEventListener('pointerup', stopDrag);
  renderer.domElement.addEventListener('pointercancel', stopDrag);

  colorEl.addEventListener('input', () => { selectedColor = colorEl.value; loadPreview(); });
  confirmEl.addEventListener('click', () => onConfirm?.({ id: selected.id, color: selectedColor }));
  backEl.addEventListener('click', () => onCancel?.());
  window.addEventListener('resize', resize);
  window.addEventListener('sky-language-change', updateCopy);
  buildRoster();

  return {
    open(id = initialId, color = initialColor) {
      active = true;
      root.classList.add('on');
      root.setAttribute('aria-hidden', 'false');
      selectedColor = /^#[0-9a-f]{6}$/i.test(color || '') ? color : playableCharacter(id).colors.accent;
      colorEl.value = selectedColor;
      resize();
      select(id, selectedColor);
      cancelAnimationFrame(raf);
      lastTime = 0;
      raf = requestAnimationFrame(frame);
      roster.querySelector(`[data-character-id="${selected.id}"]`)?.focus({ preventScroll: true });
      root.scrollTop = 0;
    },
    close() {
      active = false;
      cancelAnimationFrame(raf);
      root.classList.remove('on');
      root.setAttribute('aria-hidden', 'true');
      disposeCurrent();
    },
    get selected() { return { id: selected.id, color: selectedColor }; }
  };
}
