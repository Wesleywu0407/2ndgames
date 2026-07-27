import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSiege, WARDS, WARD_POSITIONS } = require('../server/siege.js');

const legacyCheckpoint = {
  version: 1,
  night: 4,
  shards: 27,
  upgrades: { embers: 1, cores: 2, lantern: 1 },
  // Phase 3 saves did not yet contain missionWard/missionInteriorComplete/
  // missionComplete. Loading must add safe defaults without losing ward data.
  wards: {
    archive: { hp: 100, dark: false, fireIntensity: 0, rescueCount: 0, residentCount: 3, restoration: 0 },
    alchemy: { hp: 68, dark: false, fireIntensity: 0.18, rescueCount: 0, residentCount: 3, restoration: 0 },
    infirmary: { hp: 43, dark: false, fireIntensity: 0.52, rescueCount: 1, residentCount: 3, restoration: 0 },
    practice: { hp: 16, dark: false, fireIntensity: 0.84, rescueCount: 2, residentCount: 3, restoration: 0 },
    owlpost: { hp: 0, dark: true, fireIntensity: 0.9, rescueCount: 3, residentCount: 3, restoration: 0.35 }
  }
};

let checkpoint = structuredClone(legacyCheckpoint);
let time = 50_000;
const players = new Map(WARDS.map((ward, index) => [`p${index + 1}`, { p: WARD_POSITIONS[ward] }]));
players.set('late', { p: WARD_POSITIONS.archive });
const broadcasts = [];
const siege = createSiege({
  broadcast: message => broadcasts.push(structuredClone(message)),
  getPlayerState: id => players.get(id),
  now: () => time,
  loadCheckpoint: () => structuredClone(checkpoint),
  saveCheckpoint: state => { checkpoint = structuredClone(state); }
});

siege.handle('p1', { t: 'siege-join' });
let snapshot = siege.snapshot();
assert.equal(snapshot.night, 4);
assert.equal(snapshot.shards, 27);
assert.deepEqual(snapshot.wards.map(ward => ward.stage),
  ['safe', 'igniting', 'burning', 'critical', 'scorched']);
assert.equal(snapshot.wards.find(ward => ward.id === 'owlpost').fireIntensity, 0,
  'dark legacy wards must discard impossible hidden fire');
assert.deepEqual(snapshot.mission, { ward: null, interiorComplete: false, complete: false });
assert.ok(Object.hasOwn(checkpoint, 'missionWard')
  && Object.hasOwn(checkpoint, 'missionInteriorComplete')
  && Object.hasOwn(checkpoint, 'missionComplete'),
  'loading an older Phase 3 checkpoint must persist safe defaults for the new mission fields');

// A duplicate or sub-150ms retry from one player may update a ward only once.
players.set('p1', { p: WARD_POSITIONS.practice });
const practiceBefore = snapshot.wards.find(ward => ward.id === 'practice').hp;
const stokeGain = 2.8; // base 2.2 + one saved lantern upgrade at 0.6
siege.handle('p1', { t: 'siege-act', act: 'stoke', ward: 'practice' });
siege.handle('p1', { t: 'siege-act', act: 'stoke', ward: 'practice' });
time += 149;
siege.handle('p1', { t: 'siege-act', act: 'stoke', ward: 'practice' });
const afterRejectedDuplicates = siege.snapshot().wards.find(ward => ward.id === 'practice').hp;
assert.equal(afterRejectedDuplicates, Math.round((practiceBefore + stokeGain) * 10) / 10);
time += 1;
siege.handle('p1', { t: 'siege-act', act: 'stoke', ward: 'practice' });
assert.equal(siege.snapshot().wards.find(ward => ward.id === 'practice').hp,
  Math.round((practiceBefore + stokeGain * 2) * 10) / 10,
  'the same action becomes valid exactly at the 150ms server boundary');

siege.handle('late', { t: 'siege-join' });
assert.equal(siege.participants, 2);
assert.deepEqual(siege.snapshot().wards, broadcasts.at(-1).wards,
  'a late join receives the same authoritative ward matrix');

// There is no client host election: dropping the first player leaves the
// server-owned mission alive for the remaining lantern.
siege.dropPlayer('p1');
assert.equal(siege.running, true);
assert.equal(siege.participants, 1);
siege.dropPlayer('late');
assert.equal(siege.running, false);
assert.equal(siege.snapshot().phase, 'idle');

siege.handle('p2', { t: 'siege-join' });
snapshot = siege.snapshot();
assert.equal(snapshot.running, true);
assert.equal(snapshot.night, 4);
assert.deepEqual(snapshot.wards.map(ward => ward.stage),
  ['safe', 'igniting', 'burning', 'critical', 'scorched'],
  'the final disconnect and rejoin must restore every checkpointed damage state');

console.log('siege network/checkpoint QA passed', {
  states: snapshot.wards.map(ward => ward.stage),
  legacyMissionFieldsMigrated: true,
  duplicateActionsRejected: true,
  latencyBoundaryMs: 150,
  lateJoinSynchronized: true,
  hostDepartureIndependent: true
});
