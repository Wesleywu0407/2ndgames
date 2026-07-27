import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSiege, WARD_POSITIONS } = require('../server/siege.js');

let time = 10_000;
const states = new Map([
  ['p1', { p: [0, 10, 0] }], ['p2', { p: [0, 10, 0] }],
  ['p3', { p: [0, 10, 0] }], ['p4', { p: [0, 10, 0] }],
  ['late', { p: [0, 10, 0] }]
]);
const broadcasts = [];
let checkpoint = null;
const siege = createSiege({
  broadcast: message => broadcasts.push(message),
  getPlayerState: id => states.get(id),
  now: () => time,
  loadCheckpoint: () => checkpoint,
  saveCheckpoint: state => { checkpoint = structuredClone(state); }
});

siege.handle('p1', { t: 'siege-join' });
assert.equal(siege.snapshot().phase, 'briefing');
siege.tick(8.1);  // briefing -> deployment
assert.equal(siege.snapshot().phase, 'deployment');
siege.tick(12.1); // deployment -> dusk
siege.tick(6.1);  // dusk -> wave
let snapshot = siege.snapshot();
assert.equal(snapshot.phase, 'wave');
const targetId = snapshot.targets[0];
states.set('p1', { p: WARD_POSITIONS[targetId] });
siege.tick(8);
snapshot = siege.snapshot();
let target = snapshot.wards.find(ward => ward.id === targetId);
assert.equal(target.stage, 'threatened');
assert.equal(target.fireIntensity, 0,
  'the passive tide may strain integrity but must not ignite a building without a visible attack');

// Visible enemy impacts advance localized fire into a rescue state.
for (let hit = 0; hit < 5; hit++) {
  time += 1000;
  siege.handle('p1', { t: 'siege-act', act: 'impact', ward: targetId });
}
snapshot = siege.snapshot();
target = snapshot.wards.find(ward => ward.id === targetId);
assert.ok(['burning', 'critical'].includes(target.stage));
assert.ok(target.fireIntensity > 0);
assert.ok(target.affectedSockets.length >= 1);
if (!target.dark) {
  for (const id of ['p2', 'p3', 'p4']) {
    states.set(id, { p: WARD_POSITIONS[targetId] });
    siege.handle(id, { t: 'siege-join' });
  }
  time += 1000;
  for (const id of ['p1', 'p2', 'p3']) siege.handle(id, { t: 'siege-act', act: 'rescue', ward: targetId });
  assert.equal(siege.snapshot().wards.find(ward => ward.id === targetId).rescueCount, 3,
    'three players must be able to rescue simultaneously without a shared cooldown');
  const fireBefore = siege.snapshot().wards.find(ward => ward.id === targetId).fireIntensity;
  time += 200;
  for (const id of ['p1', 'p2', 'p3', 'p4']) siege.handle(id, { t: 'siege-act', act: 'suppress', ward: targetId });
  assert.ok(siege.snapshot().wards.find(ward => ward.id === targetId).fireIntensity <= fireBefore - 0.2,
    'four players must be able to suppress together without waiting on each other');
}

// Further completed attacks can scorch the same building; no object is deleted.
for (let hit = 0; hit < 20 && !siege.snapshot().wards.some(ward => ward.dark); hit++) {
  time += 1000;
  siege.handle('p1', { t: 'siege-act', act: 'impact', ward: targetId });
}
snapshot = siege.snapshot();
const scorched = snapshot.wards.find(ward => ward.dark);
assert.ok(scorched, 'an undefended building must eventually become scorched');
assert.equal(snapshot.mission.ward, targetId, 'the dusk warning and first combat target must name the same mission ward');
assert.equal(scorched.id, snapshot.mission.ward, 'the integrated room objective must belong to the attacked building');
assert.equal(scorched.stage, 'scorched');
assert.equal(scorched.fireIntensity, 0, 'scorched state must not keep invisible fire damage');
assert.equal(snapshot.wards.length, 5, 'buildings are stateful and never deleted');

siege.handle('late', { t: 'siege-join' });
const lateSnapshot = siege.snapshot();
assert.deepEqual(lateSnapshot.wards.find(ward => ward.id === scorched.id), scorched,
  'late join must receive identical fire, rescue, and restoration state');

// The exterior must be calm, then its matching interior service must be
// completed before restoration can progress.
while (!['dawn', 'day'].includes(siege.snapshot().phase)) siege.tick(20);
states.set('p1', { p: WARD_POSITIONS[scorched.id] });
time += 200;
siege.handle('p1', { t: 'siege-act', act: 'restore', ward: scorched.id });
assert.equal(siege.snapshot().wards.find(ward => ward.id === scorched.id).restoration, 0,
  'mission restoration must stay locked until the damaged interior objective is complete');

const wrongWard = Object.keys(WARD_POSITIONS).find(id => id !== scorched.id);
siege.handle('p1', { t: 'siege-act', act: 'interior-complete', ward: wrongWard });
assert.equal(siege.snapshot().mission.interiorComplete, false,
  'a different room cannot satisfy the mission objective');
siege.handle('p1', { t: 'siege-act', act: 'interior-complete', ward: scorched.id });
assert.equal(siege.snapshot().mission.interiorComplete, true,
  'the nearby attacked room must unlock restoration');

for (let act = 0; act < 24 && siege.snapshot().wards.find(ward => ward.id === scorched.id).dark; act++) {
  time += 200;
  siege.handle('p1', { t: 'siege-act', act: 'restore', ward: scorched.id });
}
const restored = siege.snapshot().wards.find(ward => ward.id === scorched.id);
assert.equal(restored.dark, false);
assert.equal(restored.stage, 'restored');
assert.equal(restored.restoration, 1);
assert.ok(restored.hp >= 60);
assert.equal(siege.snapshot().phase, 'complete');
assert.equal(siege.snapshot().mission.complete, true,
  'room completion plus exterior restoration must end with a mission summary state');
assert.equal(checkpoint.wards[scorched.id].restoration, 1,
  'completed restoration must be written to the checkpoint');

const reloaded = createSiege({
  broadcast: () => {},
  getPlayerState: id => states.get(id),
  now: () => time,
  loadCheckpoint: () => structuredClone(checkpoint),
  saveCheckpoint: state => { checkpoint = structuredClone(state); }
});
reloaded.handle('late', { t: 'siege-join' });
const afterRestart = reloaded.snapshot().wards.find(ward => ward.id === scorched.id);
assert.equal(reloaded.snapshot().phase, 'complete');
assert.deepEqual(reloaded.snapshot().mission, siege.snapshot().mission,
  'the completed mission outcome must survive checkpoint reload');
assert.equal(afterRestart.dark, restored.dark);
assert.equal(afterRestart.stage, restored.stage);
assert.equal(afterRestart.restoration, restored.restoration);
assert.equal(afterRestart.rescueCount, restored.rescueCount);

console.log('building fire server QA passed', {
  threatenedWard: targetId,
  fourPlayerSplitActions: true,
  scorchedWard: scorched.id,
  lateJoinSynchronized: true,
  interiorGateVerified: true,
  missionSummaryPersisted: true,
  restartCheckpointRestored: true,
  restored: restored.stage
});
