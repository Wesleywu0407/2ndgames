import assert from 'node:assert/strict';
import { createArchiveRoomExperience } from '../js/sky-room/archive-room.js';
import { createInfirmaryRoomExperience } from '../js/sky-room/infirmary-room.js';
import { createPracticeRoomExperience } from '../js/sky-room/practice-room.js';
import { createAlchemyRoomExperience } from '../js/sky-room/alchemy-room.js';
import { createOwlPostRoomExperience } from '../js/sky-room/owlpost-room.js';

const makeGame = () => ({
  hp: 50,
  maxHp: 100,
  phase: 1,
  relics: 0,
  relicsNeeded: 3,
  roleState: { signatureCharge: 0.25 }
});
const options = game => ({ tr: (en, _zh) => en, storyCard: () => {}, game });

const archiveGame = makeGame();
const archive = createArchiveRoomExperience(options(archiveGame));
archive.applySharedProgress(['bell-ledger', 'rope-record', 'satchel-note']);
assert.equal(archive.state().reconstructed, true);
assert.equal(archiveGame.hp, 50, 'remote completion never grants a local reward');

const infirmaryGame = makeGame();
const infirmary = createInfirmaryRoomExperience(options(infirmaryGame));
infirmary.applySharedProgress(['patient-west', 'patient-east', 'patient-entry']);
assert.equal(infirmary.state().complete, true);
assert.equal(infirmary.healingRate({ x: 0, z: 0 }), 14);
assert.equal(infirmaryGame.hp, 50);

const practiceGame = makeGame();
const practice = createPracticeRoomExperience(options(practiceGame));
practice.applySharedProgress(['complete']);
assert.equal(practice.state().complete, true);
assert.equal(practiceGame.roleState.signatureCharge, 0.25);

const alchemyGame = makeGame();
const alchemy = createAlchemyRoomExperience(options(alchemyGame));
alchemy.applySharedProgress(['solar-vat']);
assert.equal(alchemy.state().stabilized, 1);
assert.equal(alchemy.state().activeVatId, 'lunar-vat');
assert.equal(alchemy.state().expectedWeapon, 3);
alchemy.applySharedProgress(['solar-vat', 'lunar-vat']);
assert.equal(alchemy.state().complete, true);
assert.equal(alchemyGame.hp, 50);

const owlGame = makeGame();
const owlPost = createOwlPostRoomExperience(options(owlGame));
owlPost.applySharedProgress(['west-belfry', 'east-roost']);
assert.equal(owlPost.state().delivered, 2);
assert.equal(owlPost.state().phase, 'returning');
owlPost.applySharedProgress(['west-belfry', 'east-roost', 'court-post']);
assert.equal(owlPost.state().complete, true);
assert.equal(owlGame.hp, 50);

console.log('Room progress sync QA passed: late-join completion state applies across all five side rooms without duplicate rewards.');
