import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createStory } = require('../server/story.js');
const lanternNet = require('../server/lantern-net.js');

const positions = new Map([
  ['a', { p: [0, 1.6, 19] }],
  ['b', { p: [2, 1.6, 19] }],
  ['c', { p: [3, 1.6, 19] }]
]);
const messages = [];
const scheduled = [];
let now = 1000;
const story = createStory({
  sendTo: (id, message) => messages.push({ id, message }),
  getPlayerState: id => positions.get(id),
  getPlayerInfo: id => ({ name: `Player ${id.toUpperCase()}` }),
  now: () => now++,
  schedule: callback => scheduled.push(callback)
});

const send = (id, message) => story.handle(id, message);
send('a', { t: 'story-join' });
send('b', { t: 'story-join' });
send('a', { t: 'story-ready', ready: true });
send('b', { t: 'story-ready', ready: true });
send('a', { t: 'story-start' });
assert.equal(story.getSnapshot().started, true);
assert.equal(story.getSnapshot().partySize, 2);

positions.set('a', { p: [-35, 1.6, -25] });
send('a', { t: 'story-act', actionId: 'room-archive-ledger', action: 'room-progress', room: 'archive', item: 'bell-ledger' });
assert.deepEqual(story.getSnapshot().roomProgress.archive, ['bell-ledger']);
send('a', { t: 'story-act', actionId: 'room-invalid-item', action: 'room-progress', room: 'archive', item: 'not-a-record' });
assert.deepEqual(story.getSnapshot().roomProgress.archive, ['bell-ledger'], 'unknown room items are rejected');
positions.set('b', { p: [0, 1.6, 19] });
send('b', { t: 'story-act', actionId: 'room-patient-too-far', action: 'room-progress', room: 'infirmary', item: 'patient-west' });
assert.deepEqual(story.getSnapshot().roomProgress.infirmary, [], 'remote room progress is rejected');
positions.set('b', { p: [-52, 1.6, -8] });
send('b', { t: 'story-act', actionId: 'room-patient-valid', action: 'room-progress', room: 'infirmary', item: 'patient-west' });
assert.deepEqual(story.getSnapshot().roomProgress.infirmary, ['patient-west']);
positions.set('a', { p: [35, 1.6, -27] });
send('a', { t: 'story-act', actionId: 'room-alchemy-out-of-order', action: 'room-progress', room: 'alchemy', item: 'lunar-vat' });
assert.deepEqual(story.getSnapshot().roomProgress.alchemy, [], 'ordered recipes reject skipped vats');
send('a', { t: 'story-act', actionId: 'room-alchemy-solar', action: 'room-progress', room: 'alchemy', item: 'solar-vat' });
assert.deepEqual(story.getSnapshot().roomProgress.alchemy, ['solar-vat']);

positions.set('a', { p: [0, 1.6, 19] });
positions.set('b', { p: [2, 1.6, 19] });

send('a', { t: 'story-act', actionId: 'dim-a-1', action: 'become-dimmed' });
assert.equal(story.getSnapshot().party.find(player => player.id === 'a').dimmed, true);
send('b', { t: 'story-act', actionId: 'revive-a-1', action: 'revive-player', target: 'a' });
assert.equal(story.getSnapshot().party.find(player => player.id === 'a').dimmed, false);
assert.ok(messages.some(({ id, message }) => id === 'a' && message.t === 'story-player'
  && message.dimmed === false && message.hp === 55), 'revive must be authoritative and restore 55 HP');

positions.set('b', { p: [40, 1.6, 19] });
send('a', { t: 'story-act', actionId: 'dim-a-2', action: 'become-dimmed' });
send('b', { t: 'story-act', actionId: 'revive-too-far', action: 'revive-player', target: 'a' });
assert.equal(story.getSnapshot().party.find(player => player.id === 'a').dimmed, true,
  'remote revive must be rejected');

send('b', { t: 'story-act', actionId: 'dim-b-1', action: 'become-dimmed' });
assert.equal(scheduled.length, 1, 'full party Dimmed must schedule checkpoint recovery once');
scheduled.shift()();
assert.ok(story.getSnapshot().party.every(player => !player.dimmed));
assert.ok(messages.some(({ message }) => message.t === 'story-party-rekindle'
  && Array.isArray(message.position)), 'party wipe must publish checkpoint position');

send('c', { t: 'story-join' });
const lateJoin = story.getSnapshot();
assert.equal(lateJoin.partySize, 3);
assert.equal(lateJoin.started, true);
assert.ok(lateJoin.party.some(player => player.id === 'c'), 'late join must receive active party state');
assert.deepEqual(lateJoin.roomProgress.archive, ['bell-ledger'], 'late join receives shared room progress');
assert.deepEqual(lateJoin.roomProgress.infirmary, ['patient-west']);

send('a', { t: 'story-join', qa: true });
send('a', { t: 'story-act', actionId: 'qa-garden', action: 'qa-enter-black-garden' });
for (const [relay, position] of [
  ['root', [82, 1.6, 86]], ['canopy', [92, 10, 79]], ['well', [102, 1.6, 86]]
]) {
  positions.set('a', { p: position });
  send('a', { t: 'story-act', actionId: `relay-${relay}`, action: 'charge-garden-relay', relay });
}
assert.equal(story.getSnapshot().phase, 8);
assert.equal(story.getSnapshot().bossMaxHp, 22, 'boss health must use bounded party scaling');
positions.set('a', { p: [200, 1.6, 200] });
const hpBeforeRejectedHit = story.getSnapshot().bossHp;
send('a', { t: 'story-act', actionId: 'boss-hit-too-far', action: 'groundskeeper-hit', weapon: 3, power: 1 });
assert.equal(story.getSnapshot().bossHp, hpBeforeRejectedHit, 'server must reject out-of-range boss damage');
positions.set('a', { p: [92, 1.6, 86] });
now += 500;
send('a', { t: 'story-act', actionId: 'boss-hit-valid', action: 'groundskeeper-hit', weapon: 3, power: 1 });
assert.equal(story.getSnapshot().bossHp, hpBeforeRejectedHit - 3, 'server must own valid boss damage');
send('d', { t: 'story-join' });
assert.equal(story.getSnapshot().bossHp, hpBeforeRejectedHit - 3, 'late join must receive active boss health');

lanternNet.setStoryHandler(story);
assert.equal(lanternNet.storyFriendlyFireBlocked('a', 'b'), true);
assert.equal(lanternNet.storyFriendlyFireBlocked('outsider', 'a'), true);
assert.equal(lanternNet.storyFriendlyFireBlocked('outsider', 'other'), false);
lanternNet.setStoryHandler(null);

console.log('story combat server QA passed', {
  partySize: lateJoin.partySize,
  authoritativeRevive: true,
  checkpointRecovery: true,
  friendlyFireBlocked: true,
  authoritativeBossHealth: true,
  lateJoinBossState: true,
  authoritativeRoomProgress: true
});
