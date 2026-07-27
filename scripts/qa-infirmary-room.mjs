import assert from 'node:assert/strict';
import { INFIRMARY_PATIENT_LAYOUT, createInfirmaryRoomExperience } from '../js/sky-room/infirmary-room.js';

const cards = [];
const game = {
  hp: 40,
  maxHp: 100,
  roleState: { signatureCharge: 0.3 }
};
const infirmary = createInfirmaryRoomExperience({
  tr: (en, _zh) => en,
  storyCard: (main, sub) => cards.push({ main, sub }),
  game
});

assert.equal(INFIRMARY_PATIENT_LAYOUT.length, 3);
assert.equal(infirmary.state().stabilized, 0);
assert.equal(infirmary.healingRate({ x: 0, z: 0 }), 5);

for (let step = 0; step < 30; step++) {
  infirmary.tick(0.1, { stage: 'burning', fireIntensity: 0.82 });
}
assert.equal(infirmary.state().routeBlocked, true, 'shared building fire closes the smoky centre route');
assert.equal(infirmary.healingRate({ x: 0, z: 0 }), 0, 'heavy smoke disables passive healing away from the pool');
assert.equal(infirmary.healingRate({ x: 0, z: -4.35 }), 6, 'low treatment pool remains a recovery point');
const blockedPrompt = infirmary.interactionPrompt({ x: 0, z: 0 });
assert.equal(blockedPrompt.blocked, true);
assert.match(blockedPrompt.detail, /centre smoke blocked/);

for (let index = 0; index < INFIRMARY_PATIENT_LAYOUT.length; index++) {
  const position = INFIRMARY_PATIENT_LAYOUT[index].bed;
  const prompt = infirmary.interactionPrompt(position);
  assert.equal(prompt.blocked, false, `patient ${index + 1} is reachable through a side aisle`);
  assert.equal(infirmary.interact(position), true);
  assert.equal(infirmary.state().stabilized, index + 1);
}

assert.equal(infirmary.state().complete, true);
assert.equal(game.hp, 65);
assert.equal(game.roleState.signatureCharge, 0.5);
assert.match(cards.at(-1).sub, /treatment service restored/);

const pool = { x: 0, z: -4.35 };
assert.equal(infirmary.interactionPrompt(pool).action, 'Receive treatment');
assert.equal(infirmary.interact(pool), true);
assert.equal(game.hp, 80);
assert.equal(Number(game.roleState.signatureCharge.toFixed(2)), 0.58);
assert.equal(infirmary.interactionPrompt(pool).blocked, true, 'treatment cooldown prevents reward spam');

for (let step = 0; step < 170; step++) infirmary.tick(0.1, { stage: 'restored', fireIntensity: 0 });
assert.equal(infirmary.state().routeBlocked, false, 'restoration clears the route again');
assert.equal(infirmary.healingRate({ x: 0, z: 0 }), 14, 'completed clear infirmary restores its full healing rate');
assert.equal(infirmary.interactionPrompt(pool).blocked, false);

console.log('Moon Infirmary QA passed: patient stabilization, fire-driven smoke route, healing rules, treatment service, and cooldown.');
