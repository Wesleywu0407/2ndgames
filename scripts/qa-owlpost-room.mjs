import assert from 'node:assert/strict';
import {
  OWLPOST_DESK,
  OWLPOST_ROUTE_LAYOUT,
  createOwlPostRoomExperience
} from '../js/sky-room/owlpost-room.js';

const cards = [];
const game = {
  hp: 60,
  maxHp: 100,
  roleState: { signatureCharge: 0.4 }
};
const owlPost = createOwlPostRoomExperience({
  tr: (en, _zh) => en,
  storyCard: (main, sub) => cards.push({ main, sub }),
  game
});

assert.equal(OWLPOST_ROUTE_LAYOUT.length, 3);
assert.equal(owlPost.acceptsOutside, true);
assert.equal(owlPost.state().phase, 'idle');
assert.equal(owlPost.interact(OWLPOST_DESK), true);
assert.equal(owlPost.state().activeRouteId, 'west-belfry');
assert.equal(owlPost.routeActive('west-belfry'), true);

const west = OWLPOST_ROUTE_LAYOUT[0];
assert.equal(owlPost.interactionPrompt({ ...west, y: 1.6 }).blocked, true, 'roof delivery checks vertical distance');
assert.equal(owlPost.interact(west), true);
assert.equal(owlPost.state().delivered, 1);
assert.equal(owlPost.state().phase, 'returning');

for (let index = 1; index < OWLPOST_ROUTE_LAYOUT.length; index++) {
  assert.equal(owlPost.interact(OWLPOST_DESK), true, `letter ${index + 1} can be collected at the desk`);
  assert.equal(owlPost.state().activeRouteId, OWLPOST_ROUTE_LAYOUT[index].id);
  assert.equal(owlPost.interact(OWLPOST_ROUTE_LAYOUT[index]), true);
}

assert.equal(owlPost.state().complete, true);
assert.equal(owlPost.state().delivered, 3);
assert.equal(game.hp, 68);
assert.equal(Number(game.roleState.signatureCharge.toFixed(2)), 0.52);
assert.match(cards.at(-1).sub, /mail run replay unlocked/);
assert.equal(owlPost.interactionPrompt(OWLPOST_DESK).blocked, true);

owlPost.tick(20.1);
assert.equal(owlPost.interact(OWLPOST_DESK), true);
for (let index = 0; index < OWLPOST_ROUTE_LAYOUT.length; index++) {
  assert.equal(owlPost.interact(OWLPOST_ROUTE_LAYOUT[index]), true);
  if (index < OWLPOST_ROUTE_LAYOUT.length - 1) assert.equal(owlPost.interact(OWLPOST_DESK), true);
}
assert.equal(owlPost.state().complete, true);
assert.equal(game.hp, 68, 'mail-run reward is granted only once');
assert.equal(Number(game.roleState.signatureCharge.toFixed(2)), 0.52);

console.log('Owl Post QA passed: desk collection, vertical roof checks, three deliveries, one-time rewards, and replay cooldown.');
