import assert from 'node:assert/strict';
import { COMBAT_DIFFICULTIES, combatTuning } from '../js/sky-room/combat-difficulty.js';

const story = combatTuning('story', 1);
const normal = combatTuning('normal', 1);
const warden = combatTuning('warden', 1);
assert.ok(story.damage < normal.damage);
assert.ok(story.windup > normal.windup);
assert.ok(warden.damage > normal.damage);
assert.ok(warden.windup < normal.windup);
assert.ok(warden.maxAttackers > normal.maxAttackers);

const four = combatTuning('normal', 4);
assert.equal(four.maxAttackers, 3);
assert.ok(four.health < normal.health * 1.5, 'party scaling must not become a health sponge');
assert.equal(combatTuning('unknown', 1).id, COMBAT_DIFFICULTIES.normal.id);

console.log('combat difficulty QA passed', { story, normal, warden, four });
