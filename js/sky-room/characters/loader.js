import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

export function disposeCharacterFigure(figure) {
  if (!figure) return;
  if (figure.dispose) { figure.dispose(); return; }
  const group = figure.group || figure;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  group?.traverse?.(node => {
    if (node.geometry) geometries.add(node.geometry);
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    nodeMaterials.filter(Boolean).forEach(material => {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    });
  });
  geometries.forEach(geometry => geometry.dispose?.());
  materials.forEach(material => material.dispose?.());
  textures.forEach(texture => texture.dispose?.());
}

export async function loadPlayableCharacter(entry, { createFallback, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Character load cancelled', 'AbortError');
  if (!entry.model) return createFallback(entry);

  try {
    const gltf = await gltfLoader.loadAsync(entry.model);
    if (signal?.aborted) {
      disposeCharacterFigure(gltf.scene);
      throw new DOMException('Character load cancelled', 'AbortError');
    }
    const animations = [...gltf.animations];
    for (const source of entry.animationSources || []) {
      if (signal?.aborted) {
        disposeCharacterFigure(gltf.scene);
        throw new DOMException('Character load cancelled', 'AbortError');
      }
      try {
        const library = await gltfLoader.loadAsync(source);
        animations.push(...library.animations);
        disposeCharacterFigure(library.scene);
      } catch (error) {
        if (signal?.aborted) throw new DOMException('Character load cancelled', 'AbortError');
        console.warn(`Could not load animation library ${source}.`, error);
      }
    }
    return { group: gltf.scene, animations, animationMap: entry.animationMap || {}, source: 'gltf' };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    console.warn(`Could not load ${entry.name}; using the procedural fallback.`, error);
    return createFallback(entry);
  }
}
