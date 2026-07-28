import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const room = readFileSync('js/sky-room.js', 'utf8');
const multiplayer = readFileSync('js/sky-multiplayer.js', 'utf8');
const settings = readFileSync('js/sky-room/settings-controller.js', 'utf8');

assert.match(room,
  /skyMultiplayer\.setPeerPresentationEnabled\(MODE === 'story'\)/,
  'entering a local Duel or Versus must hide LAN world avatars');
assert.match(room,
  /if \(MODE !== 'story'\) return null;/,
  'menu, character selection, Story lobby, Duel, and Versus must not publish world positions');
assert.match(room,
  /visiblePeers: \[\.\.\.skyMultiplayer\.peers\.values\(\)\]\.filter\(peer => peer\.group\.visible\)\.length/,
  'the multiplayer QA probe must expose cross-mode avatar leakage');
assert.match(multiplayer,
  /this\.peerPresentationEnabled = false;/,
  'remote world presentation must stay hidden until a world mode starts');
assert.match(multiplayer,
  /return Boolean\(this\.peerPresentationEnabled && peer\.hasState && \(!peer\.down \|\| peer\.dimmed\)\);/,
  'a remote avatar must have a real state and an eligible mode before becoming visible');
assert.match(multiplayer,
  /peer\.hasState = true;[\s\S]*?peer\.group\.visible = this\.peerShouldBeVisible\(peer\);/,
  'receiving a remote state must respect the active mode visibility boundary');

assert.match(room,
  /if \(!UI_BLOCKS_STEERING\) duel\.update\(t, dt\);/,
  'Duel AI and damage must pause behind modal settings');
assert.match(room,
  /if \(game && !UI_BLOCKS_STEERING\) game\.update\(t, dt\);/,
  'Story simulation must pause behind modal settings');
assert.match(room,
  /if \(siege && !UI_BLOCKS_STEERING\) siege\.update\(t, dt\);/,
  'local Siege simulation must pause behind modal settings');
assert.match(settings,
  /controls\.mainMenu\.addEventListener\('click', \(\) => window\.location\.reload\(\)\);/,
  'every active mode needs a safe reload-based return to the mode menu');

console.info('Game mode boundary QA passed', {
  inactivePresenceHidden: true,
  localModesIsolatedFromLanAvatars: true,
  modalSimulationPause: ['story', 'duel', 'versus', 'siege'],
  safeMenuReturn: true
});
