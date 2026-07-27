import assert from 'node:assert/strict';
import { ARCHIVE_EVIDENCE_LAYOUT, createArchiveRoomExperience } from '../js/sky-room/archive-room.js';

const cards = [];
const game = {
  phase: 1,
  hp: 50,
  maxHp: 100,
  relics: 1,
  relicsNeeded: 3,
  roleState: { signatureCharge: 0.4 }
};
const archive = createArchiveRoomExperience({
  tr: (en, _zh) => en,
  storyCard: (main, sub) => cards.push({ main, sub }),
  game
});

assert.equal(ARCHIVE_EVIDENCE_LAYOUT.length, 3);
assert.deepEqual(archive.state(), {
  found: 0,
  total: 3,
  reconstructed: false,
  reviewCooldown: 0,
  ids: ['bell-ledger', 'rope-record', 'satchel-note']
});

for (let index = 0; index < ARCHIVE_EVIDENCE_LAYOUT.length; index++) {
  const position = ARCHIVE_EVIDENCE_LAYOUT[index].home;
  const prompt = archive.interactionPrompt(position);
  assert.equal(prompt.blocked, false, `folio ${index + 1} is interactable at its authored position`);
  assert.equal(archive.interact(position), true);
  assert.equal(archive.state().found, index + 1);
}

assert.equal(archive.state().reconstructed, true);
assert.equal(game.hp, 70, 'evidence reconstruction restores the lantern');
assert.equal(game.roleState.signatureCharge, 0.65, 'evidence reconstruction restores signature charge');
assert.match(cards.at(-1).sub, /accusation against the Warden is false/);

const desk = { x: 0, y: 1, z: -2.4 };
assert.equal(archive.interactionPrompt(desk).action, 'Consult records');
assert.equal(archive.interact(desk), true);
assert.equal(game.hp, 78, 'archive revisit has a bounded recovery reward');
assert.equal(Number(game.roleState.signatureCharge.toFixed(2)), 0.77);
assert.equal(archive.interactionPrompt(desk).blocked, true, 'consultation cooldown prevents reward spam');
archive.tick(20);
assert.equal(archive.interactionPrompt(desk).blocked, false, 'consultation becomes available again');

console.log('Moon Archive QA passed: three evidence folios, reconstruction, visual state, prompt range, and revisit cooldown.');
