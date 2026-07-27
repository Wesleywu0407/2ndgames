import assert from 'node:assert/strict';
import {
  ALCHEMY_START,
  ALCHEMY_VAT_LAYOUT,
  createAlchemyRoomExperience
} from '../js/sky-room/alchemy-room.js';

const cards = [];
const game = {
  hp: 70,
  maxHp: 100,
  roleState: { signatureCharge: 0.2 }
};
const alchemy = createAlchemyRoomExperience({
  tr: (en, _zh) => en,
  storyCard: (main, sub) => cards.push({ main, sub }),
  game
});

assert.equal(ALCHEMY_VAT_LAYOUT.length, 2);
assert.equal(alchemy.state().phase, 'idle');
assert.equal(alchemy.interactionPrompt({ x: 5, z: 5 }).blocked, true);
assert.equal(alchemy.interact(ALCHEMY_START), true);
assert.equal(alchemy.state().activeVatId, 'solar-vat');
assert.equal(alchemy.state().expectedWeapon, 1);
assert.equal(alchemy.vatActive('solar-vat'), true);
assert.equal(alchemy.vatActive('lunar-vat'), false);

for (const weapon of [1, 2, 3]) {
  assert.equal(alchemy.onWeaponHit('solar-vat', weapon), true);
  alchemy.tick(0.3, null, { x: 4, z: 4 });
}
assert.equal(alchemy.state().stabilized, 1);
assert.equal(alchemy.state().activeVatId, 'lunar-vat');
assert.equal(alchemy.state().expectedWeapon, 3);

assert.equal(alchemy.onWeaponHit('lunar-vat', 1), true);
alchemy.tick(0.3, null, { x: 4, z: 4 });
assert.equal(alchemy.onWeaponHit('lunar-vat', 1), true);
assert.equal(alchemy.state().hazardActive, true, 'repeated wrong reagents create dangerous fumes');
alchemy.tick(0.3, null, { x: 0, z: 1.8 });
assert.equal(alchemy.state().hazardHits, 1);
assert.equal(game.hp, 64, 'nearby volatile fumes deal bounded chip damage');

for (const weapon of [3, 2, 1]) {
  assert.equal(alchemy.onWeaponHit('lunar-vat', weapon), true);
  alchemy.tick(0.3, null, { x: 4, z: 4 });
}
assert.equal(alchemy.state().complete, true);
assert.equal(alchemy.state().stabilized, 2);
assert.equal(game.hp, 74);
assert.equal(Number(game.roleState.signatureCharge.toFixed(2)), 0.35);
assert.match(cards.at(-1).sub, /repeat recipe unlocked/);

assert.equal(alchemy.interactionPrompt(ALCHEMY_START).blocked, true, 'replay cooldown prevents reward spam');
alchemy.tick(20.1, null, null);
assert.equal(alchemy.interact(ALCHEMY_START), true);
for (const vat of ALCHEMY_VAT_LAYOUT) {
  for (const weapon of vat.sequence) {
    assert.equal(alchemy.onWeaponHit(vat.id, weapon), true);
    alchemy.tick(0.3, null, { x: 4, z: 4 });
  }
}
assert.equal(alchemy.state().complete, true);
assert.equal(game.hp, 74, 'first-completion health reward is not repeatable');
assert.equal(Number(game.roleState.signatureCharge.toFixed(2)), 0.35);

console.log('Alchemy Workshop QA passed: ordered weapon reactions, active-vat gating, hazardous fumes, rewards, and replay cooldown.');
