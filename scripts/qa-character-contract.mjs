import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PLAYABLE_CHARACTERS } from '../js/sky-room/characters/manifest.js';
import {
  CHARACTER_CATALOG, CHARACTER_CATALOG_SNAPSHOT
} from '../js/sky-room/characters/catalog.js';
import serverCatalogModule from '../server/character-catalog.js';
import lanternNet from '../server/lantern-net.js';

const root = process.cwd();
const REQUIRED_RUNTIME_STATES = Object.freeze([
  'idle', 'walk', 'run', 'fly', 'cast', 'hit', 'down', 'interact'
]);
const OPTIONAL_DELIVERY_STATES = Object.freeze(['lift', 'land', 'revive', 'celebration']);

function glbJson(relativePath) {
  const file = path.join(root, relativePath);
  const buffer = readFileSync(file);
  assert.equal(buffer.toString('ascii', 0, 4), 'glTF', `${relativePath} is not a GLB`);
  assert.equal(buffer.readUInt32LE(4), 2, `${relativePath} must use glTF 2`);
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${relativePath} length header drifted`);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) {
      const json = buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').replace(/[\0 ]+$/, '');
      return { json: JSON.parse(json), bytes: buffer.length };
    }
    offset += 8 + length;
  }
  throw new Error(`${relativePath} has no JSON chunk`);
}

function glbMetrics(relativePath) {
  const { json, bytes } = glbJson(relativePath);
  const accessors = json.accessors || [];
  let primitives = 0;
  let triangles = 0;
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives || []) {
    primitives++;
    if ((primitive.mode ?? 4) !== 4) continue;
    const accessorIndex = Number.isInteger(primitive.indices)
      ? primitive.indices
      : primitive.attributes?.POSITION;
    const count = accessors[accessorIndex]?.count || 0;
    triangles += Math.floor(count / 3);
  }
  return Object.freeze({
    bytes,
    meshes: json.meshes?.length || 0,
    primitives,
    triangles,
    materials: json.materials?.length || 0,
    textures: json.textures?.length || 0,
    images: json.images?.length || 0,
    nodes: json.nodes?.length || 0,
    skins: json.skins?.length || 0,
    animations: Object.freeze((json.animations || []).map(animation => animation.name || '(unnamed)'))
  });
}

const ids = PLAYABLE_CHARACTERS.map(entry => entry.id);
const removedPlayableIds = ['resident-05', 'resident-06', 'resident-10'];
const removedPlayableSlugs = ['corin-ash', 'nessa-vale', 'iris-flint'];
assert.equal(new Set(ids).size, ids.length, 'playable character IDs must be unique');
assert.deepEqual(ids, ['resident-01', 'resident-19', 'resident-20', 'resident-21'],
  'the approved SKYVEIL playable roster must contain exactly four heroes');
assert.ok(removedPlayableIds.every(id => !ids.includes(id)),
  'Corin Ash, Nessa Vale and Iris Flint must remain outside the playable roster');
assert.ok(removedPlayableSlugs.every(slug =>
  !existsSync(path.join(root, `assets/images/characters/${slug}.svg`))),
  'retired playable thumbnails must not ship in the active character asset set');
assert.ok(PLAYABLE_CHARACTERS.every(entry => entry.name && entry.role?.en && entry.role?.zh),
  'every playable character needs a stable bilingual identity');
assert.ok(PLAYABLE_CHARACTERS.every(entry => entry.passive?.en && entry.signature?.en && entry.abilityConfig),
  'every playable character needs a passive, signature and ability config');
assert.equal(new Set(PLAYABLE_CHARACTERS.map(entry => entry.collider?.radius)).size, 1,
  'visual character scale must not change collision fairness');

const importedCharacters = [];
for (const entry of PLAYABLE_CHARACTERS.filter(character => character.model)) {
  for (const asset of [entry.model, ...(entry.animationSources || []), entry.thumbnail, entry.licence?.record]) {
    assert.ok(asset && existsSync(path.join(root, asset)), `${entry.name} asset is missing: ${asset}`);
  }
  assert.ok(REQUIRED_RUNTIME_STATES.every(state => entry.animationMap?.[state]),
    `${entry.name} must map every runtime animation state`);
  const model = glbMetrics(entry.model);
  const modelDocument = glbJson(entry.model).json;
  const libraries = (entry.animationSources || []).map(source => ({ source, ...glbMetrics(source) }));
  const availableAnimations = new Set([
    ...model.animations,
    ...libraries.flatMap(library => library.animations)
  ]);
  for (const [state, clip] of Object.entries(entry.animationMap || {})) {
    assert.ok(availableAnimations.has(clip), `${entry.name} ${state} mapping is missing clip ${clip}`);
  }
  if (entry.attachments) {
    const nodeNames = new Set((modelDocument.nodes || []).map(node => node.name).filter(Boolean));
    for (const [semantic, attachment] of Object.entries(entry.attachments)) {
      assert.ok(nodeNames.has(attachment.node), `${entry.name} ${semantic} attachment node is missing: ${attachment.node}`);
      assert.ok(Array.isArray(attachment.offset) && attachment.offset.length === 3
        && attachment.offset.every(Number.isFinite), `${entry.name} ${semantic} offset must be a finite vec3`);
    }
  }
  if (entry.materialRules) {
    const materialNames = new Set((modelDocument.materials || []).map(material => material.name).filter(Boolean));
    for (const material of entry.materialRules.importedMaterials || []) {
      assert.ok(materialNames.has(material), `${entry.name} material contract references missing ${material}`);
    }
  }
  if (entry.modelBudget) {
    assert.ok(model.triangles <= entry.modelBudget.maxTriangles, `${entry.name} exceeds triangle budget`);
    assert.ok(model.bytes <= entry.modelBudget.maxModelBytes, `${entry.name} exceeds GLB byte budget`);
    assert.ok(model.materials <= entry.modelBudget.maxMaterials, `${entry.name} exceeds material budget`);
    assert.ok(model.images <= entry.modelBudget.maxUniqueImages, `${entry.name} exceeds unique-image budget`);
    assert.equal(entry.modelBudget.measuredTriangles, model.triangles, `${entry.name} measured triangles drifted`);
    assert.equal(entry.modelBudget.measuredModelBytes, model.bytes, `${entry.name} measured model bytes drifted`);
    assert.equal(entry.modelBudget.measuredAnimationBytes,
      libraries.reduce((sum, library) => sum + library.bytes, 0),
      `${entry.name} measured animation bytes drifted`);
  }
  if (entry.modelContract) {
    assert.equal(entry.modelContract.format, 'glb-2.0');
    assert.equal(entry.modelContract.groundAxis, 'Y');
    assert.ok(Math.abs(entry.modelContract.groundOrigin) < 1e-6, `${entry.name} ground origin must remain at Y=0`);
  }
  importedCharacters.push(Object.freeze({
    id: entry.id,
    name: entry.name,
    model,
    animationLibraryBytes: libraries.reduce((sum, library) => sum + library.bytes, 0),
    animationClips: Object.freeze([...availableAnimations]),
    optionalDeliveryStatesMissing: Object.freeze(OPTIONAL_DELIVERY_STATES.filter(state => !entry.animationMap?.[state])),
    contractMetadataMissing: Object.freeze([
      !entry.attachments && 'attachments',
      !entry.materialRules && 'materialRules',
      !entry.modelBudget && 'modelBudget'
    ].filter(Boolean))
  }));
}

const chancellor = PLAYABLE_CHARACTERS.find(entry => entry.id === 'resident-19');
const lanternStudent = PLAYABLE_CHARACTERS.find(entry => entry.id === 'resident-01');
assert.ok(lanternStudent, 'Elian Voss must remain in the playable roster');
assert.ok(OPTIONAL_DELIVERY_STATES.every(state => lanternStudent.animationMap?.[state]),
  'Elian must explicitly map lift, land, revive and celebration states');
assert.equal(lanternStudent.animationMap.lift, 'Jump_Start',
  'Elian takeoff must use the authored jump-start clip');
assert.equal(lanternStudent.animationMap.land, 'Jump_Land',
  'Elian landing must use the authored jump-land clip');
assert.equal(lanternStudent.animationMap.fly, 'Jump_Idle',
  'Elian sustained flight must retain the authored airborne loop');
assert.ok(chancellor, 'Aldous Crane must remain in the playable roster');
assert.ok(OPTIONAL_DELIVERY_STATES.every(state => chancellor.animationMap?.[state]),
  'Aldous must explicitly map lift, land, revive and celebration fallbacks');
assert.ok(chancellor.attachments && chancellor.materialRules && chancellor.modelBudget,
  'Aldous must retain the complete imported-model contract');
assert.ok(chancellor.accessibilityDescription?.en && chancellor.accessibilityDescription?.zh,
  'Aldous needs a bilingual 3D accessibility description');
assert.equal(chancellor.animationMap.lift, chancellor.animationMap.cast,
  'Aldous takeoff must read as magic rather than swimming');
assert.equal(chancellor.modelContract?.authoredForwardAxis, '+Z',
  'Aldous authored front must remain explicit');
assert.equal(chancellor.modelContract?.gameplayForwardAxis, '-Z',
  'Aldous gameplay front must remain explicit');
assert.equal(chancellor.gameplayRotationY, Math.PI,
  'Aldous must rotate his authored +Z front toward Sky Room -Z travel');
const correctedForward = [Math.sin(chancellor.gameplayRotationY), 0, Math.cos(chancellor.gameplayRotationY)];
assert.ok(correctedForward[2] < -0.999 && Math.abs(correctedForward[0]) < 1e-6,
  'Aldous corrected visual front must align with forward ground velocity');
assert.ok(chancellor.animationConfig?.run?.timeScale > 0,
  'Aldous run-state playback needs an explicit positive time scale');
assert.ok(chancellor.animationConfig?.cast?.duration >= 0.8,
  'Aldous cast must have enough time to complete its readable gesture');

const sourcePaths = [
  'js/sky-room.js', 'js/sky-multiplayer.js', 'server/lantern-net.js',
  'js/sky-room/characters/loader.js', 'js/sky-room/characters/animation-controller.js',
  'js/sky-room/characters/villagers.js', 'sky-room.html'
];
const sources = Object.fromEntries(sourcePaths.map(file => [file, readFileSync(path.join(root, file), 'utf8')]));
assert.deepEqual(ids, CHARACTER_CATALOG_SNAPSHOT.playableIds,
  'selector presentation contracts must match the catalog-derived playable roster');
assert.deepEqual(
  serverCatalogModule.catalogSnapshot(serverCatalogModule.CHARACTER_CATALOG),
  CHARACTER_CATALOG_SNAPSHOT,
  'browser and Node must resolve the same character catalog snapshot'
);
assert.deepEqual(lanternNet.allowedCharacterIds, [...ids, 'mercury-xbot'],
  'LAN authority must derive its playable roster from the catalog');
assert.match(sources['js/sky-room.js'], /PLAYABLE_CHARACTERS\.map\(character => character\.id\)/,
  'local activation must derive playable IDs from the resolved catalog');
assert.match(sources['js/sky-multiplayer.js'], /ACTIVE_PLAYABLE_IDS/,
  'remote presence must derive playable IDs from the resolved catalog');
assert.doesNotMatch(sources['sky-room.html'], /option value="resident-(?:0[2-9]|[1-9][0-9])/,
  'settings character choices must not be a hand-authored resident roster');
// Derived from the registry rather than hard-coded so adding a character does
// not require editing this expectation by hand.
const registryDocument = JSON.parse(
  readFileSync(path.join(root, 'data/characters/registry.json'), 'utf8')
);
const registeredResidentCount = registryDocument.characters.length;
assert.ok(removedPlayableIds.every(id =>
  registryDocument.characters.find(character => character.id === id)?.capabilities?.playable === false),
  'retired heroes must remain non-playable in the canonical registry');
assert.equal(CHARACTER_CATALOG.allCharacters.length, registeredResidentCount,
  'every registered resident package must resolve');
assert.equal(CHARACTER_CATALOG.activeResidents.length, registeredResidentCount,
  'Living World must discover every active resident, including the newest heroes');
assert.match(sources['js/sky-room/characters/animation-controller.js'],
  /this\.actions\.get\(mapped\.toLowerCase\(\)\) \|\| this\.actions\.get\(idle\.toLowerCase\(\)\) \|\|/,
  'missing animation clips must fall back to idle or the first available action');
assert.match(sources['js/sky-room/characters/loader.js'], /using the procedural fallback/,
  'failed model loading must retain the procedural character');
assert.match(sources['js/sky-room/characters/loader.js'],
  /attachments:\s*resolveSemanticAttachments\(gltf\.scene, entry\.attachments\)/,
  'the character loader must resolve manifest attachment contracts against the loaded model');
assert.match(sources['js/sky-room/characters/loader.js'],
  /animationConfig:\s*entry\.animationConfig \|\| \{\}/,
  'the character loader must pass authored playback rules to the animation controller');
assert.match(sources['js/sky-room/characters/animation-controller.js'], /THREE\.LoopOnce/,
  'one-shot character actions must not loop like locomotion');
assert.match(sources['js/sky-room/characters/animation-controller.js'], /restartToken/,
  'repeated casts must be able to restart the same mapped clip cleanly');
assert.match(sources['js/sky-room/characters/animation-controller.js'], /restart \|\| resumeSharedLoop/,
  'a locomotion loop must restart after a one-shot state reused the same clip');
assert.match(sources['js/sky-room/characters/animation-controller.js'],
  /state === 'fly' \|\| state === 'lift' \? 'flying' : 'ground'/,
  'procedural fallback characters must remain airborne during both lift and flight states');
assert.match(sources['js/sky-room.js'], /attachments:\s*loaded\.attachments/,
  'the active player figure must expose its resolved semantic attachments');
assert.match(sources['js/sky-room.js'], /resolved:\s*Boolean\(attachment\.node\)/,
  'model diagnostics must report whether every semantic attachment resolved');
assert.match(sources['js/sky-room.js'], /dataset\.characterAnimation = JSON\.stringify/,
  'the query-gated animation probe must expose the active runtime state');
assert.match(sources['js/sky-room.js'], /pose\.state === 'lifting' \? 'lift'/,
  'takeoff must reach the authored lift animation state instead of reusing flight');
assert.match(sources['js/sky-room.js'],
  /previousPoseState === 'flying' \|\| previousPoseState === 'lifting'/,
  'returning to ground must trigger the authored landing state');
assert.match(sources['js/sky-room.js'], /animation\.preferredDuration\('land', 0\.45\)/,
  'landing must respect each character animation contract duration');
assert.match(sources['js/sky-room.js'], /overridePersistent = name === 'down'/,
  'a fallback Dimmed pose must remain down until another authored action clears it');
assert.match(sources['js/sky-room.js'], /Math\.atan2\(-vel\.x, -vel\.z\)/,
  'the player visual heading must follow travel velocity rather than face backward');
assert.match(sources['js/sky-room.js'],
  /heldLocomotionCodes = new Set\(\[\.\.\.bufferedMovementCodes, 'Space'\]\)/,
  'only held locomotion controls should enter the continuous input state');
assert.doesNotMatch(sources['js/sky-room.js'], /key\([^)]*['"]KeyE['"]/,
  'E interaction input must never contribute to player movement or run state');
assert.match(sources['js/sky-room/characters/villagers.js'],
  /model\.rotation\.y = VILLAGER_GAMEPLAY_ROTATION_Y/,
  'rigged residents must rotate their authored front toward their navigation heading');
assert.match(sources['js/sky-room/characters/villagers.js'], /if \(profile\.body\) return profile\.body/,
  'villager model overrides must come from the character presentation component');

const boneAgnosticPaths = [
  'js/sky-multiplayer.js', 'server/lantern-net.js',
  'js/sky-room/characters/loader.js', 'js/sky-room/characters/animation-controller.js',
  'js/sky-room/architecture.js', 'js/sky-room/building-fire.js',
  'js/sky-room/camera-collision.js', 'js/sky-room/camera-heading.js', 'js/sky-room/camera-occlusion.js',
  'js/sky-room/combat-balance.js', 'js/sky-room/combat-difficulty.js', 'js/sky-room/combat-effects.js',
  'js/sky-room/coop-story-ui.js', 'js/sky-room/room-registry.js'
];
const sharedSource = boneAgnosticPaths.map(file => readFileSync(path.join(root, file), 'utf8')).join('\n');
assert.doesNotMatch(sharedSource, /Armature\|/,
  'shared camera, combat, network and loader systems must not depend on character bone names');

console.info('Character integration contract QA passed', JSON.stringify({
  playableCharacters: PLAYABLE_CHARACTERS.length,
  colliderRadius: PLAYABLE_CHARACTERS[0].collider.radius,
  importedCharacters
}, null, 2));
