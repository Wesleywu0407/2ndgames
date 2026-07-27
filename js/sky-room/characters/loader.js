import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
export const characterDisposalDiagnostics = {
  calls: 0, geometries: 0, materials: 0, textures: 0, skeletons: 0
};

function resolveSemanticAttachments(group, contract = {}) {
  const nodes = new Map();
  group?.traverse?.(node => { if (node.name) nodes.set(node.name, node); });
  return Object.freeze(Object.fromEntries(Object.entries(contract).map(([semantic, definition]) => [semantic,
    Object.freeze({
      node: nodes.get(definition.node) || null,
      nodeName: definition.node,
      offset: Object.freeze([...(definition.offset || [0, 0, 0])])
    })
  ])));
}

export function disposeCharacterFigure(figure) {
  if (!figure) return;
  if (figure.dispose) { figure.dispose(); return; }
  const group = figure.group || figure;
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const skeletons = new Set();
  group?.traverse?.(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.isSkinnedMesh && node.skeleton) skeletons.add(node.skeleton);
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    nodeMaterials.filter(Boolean).forEach(material => {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    });
  });
  for (const texture of figure.disposableTextures || []) textures.add(texture);
  characterDisposalDiagnostics.calls++;
  characterDisposalDiagnostics.geometries += geometries.size;
  characterDisposalDiagnostics.materials += materials.size;
  characterDisposalDiagnostics.textures += textures.size;
  characterDisposalDiagnostics.skeletons += skeletons.size;
  skeletons.forEach(skeleton => skeleton.dispose?.());
  geometries.forEach(geometry => geometry.dispose?.());
  materials.forEach(material => material.dispose?.());
  textures.forEach(texture => texture.dispose?.());
}

export async function loadPlayableCharacter(entry, { createFallback, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Character load cancelled', 'AbortError');
  if (!entry.model) return createFallback(entry);

  try {
    const gltf = await gltfLoader.loadAsync(entry.model);
    const disposableTextures = await gltf.parser.getDependencies('texture');
    if (signal?.aborted) {
      disposeCharacterFigure({ group: gltf.scene, disposableTextures });
      throw new DOMException('Character load cancelled', 'AbortError');
    }
    const animations = [...gltf.animations];
    for (const source of entry.animationSources || []) {
      if (signal?.aborted) {
        disposeCharacterFigure({ group: gltf.scene, disposableTextures });
        throw new DOMException('Character load cancelled', 'AbortError');
      }
      try {
        const library = await gltfLoader.loadAsync(source);
        const libraryTextures = await library.parser.getDependencies('texture');
        animations.push(...library.animations);
        disposeCharacterFigure({ group: library.scene, disposableTextures: libraryTextures });
      } catch (error) {
        if (signal?.aborted) throw new DOMException('Character load cancelled', 'AbortError');
        console.warn(`Could not load animation library ${source}.`, error);
      }
    }
    return {
      group: gltf.scene,
      animations,
      animationMap: entry.animationMap || {},
      animationConfig: entry.animationConfig || {},
      idleBreaks: entry.idleBreaks || [],
      idleBreakWindow: entry.idleBreakWindow || null,
      attachments: resolveSemanticAttachments(gltf.scene, entry.attachments),
      source: 'gltf',
      disposableTextures
    };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    console.warn(`Could not load ${entry.name}; using the procedural fallback.`, error);
    return createFallback(entry);
  }
}
