import assert from 'node:assert/strict';
import {
  PRACTICE_ROUNDS,
  PRACTICE_START,
  PRACTICE_TARGET_LAYOUT,
  createPracticeRoomExperience
} from '../js/sky-room/practice-room.js';

const cards = [];
const game = {
  hp: 50,
  maxHp: 100,
  roleState: { signatureCharge: 0.25 }
};
const practice = createPracticeRoomExperience({
  tr: (en, _zh) => en,
  storyCard: (main, sub) => cards.push({ main, sub }),
  game
});

assert.equal(PRACTICE_TARGET_LAYOUT.length, 3);
assert.equal(PRACTICE_ROUNDS.length, 3);
assert.equal(practice.state().phase, 'idle');
assert.equal(practice.interactionPrompt({ x: 5, z: 4 }).blocked, true);
assert.equal(practice.interact(PRACTICE_START), true);
assert.equal(practice.state().dangerLane, 'left');

practice.tick(2, null, { x: -2.2, z: 0 });
assert.equal(practice.state().phase, 'telegraph', 'remaining in the marked lane repeats the tell');
assert.equal(practice.state().misses, 1);

practice.tick(2, null, { x: 2.2, z: 0 });
assert.equal(practice.state().phase, 'counter');
assert.equal(practice.state().activeTargetId, 'target-right');
assert.equal(practice.targetActive('target-left'), false);
assert.equal(practice.targetActive('target-right'), true);
assert.equal(practice.onTargetHit('target-left'), false, 'only the named counter target advances the drill');
assert.equal(practice.onTargetHit('target-right'), true);

practice.tick(2, null, { x: -2.2, z: 0 });
assert.equal(practice.state().activeTargetId, 'target-left');
assert.equal(practice.onTargetHit('target-left'), true);

practice.tick(2, null, { x: 2.2, z: 0 });
assert.equal(practice.state().activeTargetId, 'target-centre');
assert.equal(practice.onTargetHit('target-centre'), true);
assert.equal(practice.state().complete, true);
assert.equal(practice.state().clears, 3);
assert.equal(game.hp, 62);
assert.equal(Number(game.roleState.signatureCharge.toFixed(2)), 0.43);
assert.match(cards.at(-1).sub, /sparring replay unlocked/);

assert.equal(practice.interactionPrompt(PRACTICE_START).blocked, true, 'replay cooldown prevents reward spam');
practice.tick(18.1, null, null);
assert.equal(practice.interactionPrompt(PRACTICE_START).blocked, false);
assert.equal(practice.interact(PRACTICE_START), true);
assert.equal(practice.state().phase, 'telegraph');
assert.equal(practice.state().misses, 0);

for (const round of PRACTICE_ROUNDS) {
  const safePosition = round.dangerLane === 'right' ? { x: -2.2, z: 0 } : { x: 2.2, z: 0 };
  practice.tick(2, null, safePosition);
  assert.equal(practice.onTargetHit(round.targetId), true);
}
assert.equal(game.hp, 62, 'the completion reward is granted only once');
assert.equal(Number(game.roleState.signatureCharge.toFixed(2)), 0.43);

console.log('Practice Hall QA passed: telegraph retry, directional dodge, named counter targets, completion reward, and replay cooldown.');
