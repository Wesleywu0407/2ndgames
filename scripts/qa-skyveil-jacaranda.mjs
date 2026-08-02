import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const assetPath = 'assets/models/architecture/skyveil-jacaranda/skyveil-purple-jacaranda.glb';
const buffer = readFileSync(assetPath);
assert.equal(buffer.toString('ascii', 0, 4), 'glTF', 'jacaranda asset must be a GLB');
assert.equal(buffer.readUInt32LE(4), 2, 'jacaranda asset must use glTF 2.0');
assert.equal(buffer.readUInt32LE(8), buffer.length, 'jacaranda GLB length header drifted');

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
assert.ok(document, 'jacaranda GLB needs a JSON chunk');

let triangles = 0;
for (const mesh of document.meshes || []) for (const primitive of mesh.primitives || []) {
  const accessorIndex = Number.isInteger(primitive.indices)
    ? primitive.indices
    : primitive.attributes?.POSITION;
  triangles += Math.floor((document.accessors?.[accessorIndex]?.count || 0) / 3);
}
assert.ok(triangles >= 7_000 && triangles <= 12_000,
  `jacaranda source triangle count drifted: ${triangles}`);
assert.ok(buffer.length < 20 * 1024 * 1024, `jacaranda GLB is too large: ${buffer.length} bytes`);

const architecture = readFileSync('js/sky-room/architecture.js', 'utf8');
const jacaranda = readFileSync('js/sky-room/jacaranda.js', 'utf8');
const room = readFileSync('js/sky-room.js', 'utf8');
const page = readFileSync('sky-room.html', 'utf8');
const licence = readFileSync('assets/models/architecture/skyveil-jacaranda/LICENSES.md', 'utf8');

assert.match(architecture, /createSkyveilJacarandas\(\{/,
  'campus architecture must create the authored jacaranda system');
assert.doesNotMatch(architecture, /new THREE\.Points\(petalGeo, petalMat\)/,
  'the old point-sprite flower system must stay removed');
assert.match(jacaranda, /new THREE\.InstancedMesh\(object\.geometry, object\.material, treeData\.length\)/,
  'tree copies must remain GPU-instanced');
assert.match(jacaranda, /removeAndDisposeFallback\(root, fallback\)/,
  'the loading fallback must be removed after the authored tree loads');
assert.match(jacaranda, /dataset\.jacarandaFallback = 'removed'/,
  'runtime diagnostics must confirm that the fallback no longer overlaps the authored tree');
assert.match(jacaranda, /makeBellBlossomGeometry\(\)/,
  'falling flowers must include full 3D bell blossoms');
assert.match(jacaranda, /state\.rx = wholeBlossom \? Math\.PI \* 0\.5 : -Math\.PI \* 0\.5/,
  'landed petals must settle flat');
assert.match(jacaranda, /state\.spinX = state\.spinY = state\.spinZ = 0/,
  'landed flowers must stop rotating');
assert.match(jacaranda, /verticalDrag \* state\.vy \* Math\.abs\(state\.vy\)/,
  'airborne flowers must use aerodynamic drag');
assert.match(jacaranda, /skyveilCanopyMask = smoothstep/,
  'canopy wind must be masked away from the trunk');
assert.match(room, /architecture\.js\?v=performance-pass-1/,
  'the room entry must carry the jacaranda cache key');
assert.match(page, /js\/sky-room\.js\?v=performance-pass-1/,
  'the page entry must carry the jacaranda cache key');
assert.match(licence, /Higgsfield/i, 'the generated asset needs a Higgsfield provenance record');
assert.equal(statSync(assetPath).size, buffer.length);

console.info('SKYVEIL jacaranda QA passed', {
  bytes: buffer.length,
  megabytes: Number((buffer.length / 1024 / 1024).toFixed(2)),
  triangles,
  instancedTrees: true,
  bellFlowers: true,
  flatLanding: true,
  canopyWind: true
});
