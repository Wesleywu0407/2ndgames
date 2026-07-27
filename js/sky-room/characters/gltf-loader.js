import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* ================= Shared character GLTF loader ================= */
// Character meshes ship with Draco-compressed geometry (roughly 9 MB of vertex
// data across the cast becomes 1.5 MB) and WebP textures. WebP needs no help —
// GLTFLoader decodes it through the browser — but Draco needs a decoder, and
// every loader that touches a character GLB must share one so the worker pool
// is created once rather than per figure.

const DECODER_PATH = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/';

let dracoLoader = null;

function sharedDracoLoader() {
  if (!dracoLoader) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DECODER_PATH);
    // WASM is smaller and faster than the JS fallback; the loader picks the JS
    // build by itself when a browser cannot run the WASM module.
    dracoLoader.setDecoderConfig({ type: 'wasm' });
  }
  return dracoLoader;
}

// A fresh GLTFLoader per caller keeps their per-loader settings independent
// while the expensive Draco decoder stays shared.
export function characterGLTFLoader() {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(sharedDracoLoader());
  return loader;
}

// Release the decoder's worker pool. Only used when tearing the room down.
export function disposeCharacterGLTFLoader() {
  dracoLoader?.dispose();
  dracoLoader = null;
}
