import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const assetPath = 'assets/models/architecture/skyveil-academy/skyveil-academy.glb';
const buffer = readFileSync(assetPath);
assert.equal(buffer.toString('ascii', 0, 4), 'glTF', 'academy exterior must be a GLB');
assert.equal(buffer.readUInt32LE(4), 2, 'academy exterior must use glTF 2.0');
assert.equal(buffer.readUInt32LE(8), buffer.length, 'academy GLB length header drifted');

let document = null;
for (let offset = 12; offset + 8 <= buffer.length;) {
  const length = buffer.readUInt32LE(offset);
  const type = buffer.readUInt32LE(offset + 4);
  if (type === 0x4e4f534a) {
    document = JSON.parse(
      buffer.subarray(offset + 8, offset + 8 + length)
        .toString('utf8')
        .replace(/[\0 ]+$/, '')
    );
    break;
  }
  offset += 8 + length;
}
assert.ok(document, 'academy GLB needs a JSON chunk');

let triangles = 0;
for (const mesh of document.meshes || []) for (const primitive of mesh.primitives || []) {
  const accessorIndex = Number.isInteger(primitive.indices)
    ? primitive.indices
    : primitive.attributes?.POSITION;
  triangles += Math.floor((document.accessors?.[accessorIndex]?.count || 0) / 3);
}
assert.ok(triangles >= 250_000 && triangles <= 320_000,
  `academy high-detail triangle count drifted: ${triangles}`);
assert.ok((document.images?.length || 0) >= 4, 'academy needs its embedded PBR image set');
assert.ok((document.textures?.length || 0) >= 4, 'academy needs its embedded PBR textures');
assert.ok(buffer.length < 35 * 1024 * 1024, `academy GLB is too large: ${buffer.length} bytes`);

const architecture = readFileSync('js/sky-room/architecture.js', 'utf8');
const room = readFileSync('js/sky-room.js', 'utf8');
const licence = readFileSync(
  'assets/models/architecture/skyveil-academy/LICENSES.md',
  'utf8'
);

assert.match(architecture, /new GLTFLoader\(\)\.loadAsync\(source\)/,
  'academy exterior must load asynchronously');
assert.match(architecture, /SKYVEIL_Academy_Procedural_Fallback/,
  'procedural academy must remain available as a fallback');
assert.match(architecture, /settings\.prefs\.quality !== 'performance'/,
  'performance quality must retain the lightweight fallback');
assert.doesNotMatch(
  architecture.match(/const wantsAcademyExterior[\s\S]*?;/)?.[0] || '',
  /runtimePerformance/,
  'temporary adaptive frame drops must not replace the formal academy exterior'
);
assert.match(architecture, /academy-model-probe/,
  'browser integration QA must be able to force the formal academy model');
assert.match(architecture, /targetWidth = 80\.4[\s\S]*?targetHeight = 52[\s\S]*?targetDepth = 31/,
  'imported model must be refitted to the authored campus proportions');
assert.match(architecture, /hallFrontZ - fittedBounds\.max\.z/,
  'the imported entrance line must align with the authored Great Hall front');
assert.match(architecture, /fallback-error/,
  'failed loads need an observable fallback state');
assert.match(room, /architecture\.js\?v=skyveil-academy-2/,
  'the architecture module cache key must ship the academy integration');
assert.match(licence, /project-commissioned AI-generated asset/,
  'the generated architecture needs a provenance record');
assert.equal(statSync(assetPath).size, buffer.length);

console.info('SKYVEIL academy QA passed', {
  bytes: buffer.length,
  megabytes: Number((buffer.length / 1024 / 1024).toFixed(2)),
  triangles,
  images: document.images?.length || 0,
  textures: document.textures?.length || 0,
  fallback: true,
  performanceFallback: true
});
