import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  effectBudgets, MAX_ACTIVE_ENEMIES, MAX_LOCAL_PROJECTILES, MAX_AUDIO_SFX_VOICES
} from '../js/sky-room/effect-budgets.js';

const high = effectBudgets('high');
const balanced = effectBudgets('balanced');
const performance = effectBudgets('performance');

assert.equal(MAX_ACTIVE_ENEMIES, 14);
assert.equal(MAX_LOCAL_PROJECTILES, 4);
assert.equal(MAX_AUDIO_SFX_VOICES, 32);
assert.equal(high.buildingFire.socketsPerWard, 4);
assert.equal(balanced.buildingFire.socketsPerWard, 3);
assert.equal(performance.buildingFire.socketsPerWard, 2);
assert.equal(balanced.buildingFire.smokeSpritesPerSocket, 2);
assert.equal(balanced.buildingFire.residentsPerWard, 3);

for (const key of ['impacts', 'motes', 'restorations']) {
  assert.ok(performance.combat[key] <= balanced.combat[key]);
  assert.ok(balanced.combat[key] <= high.combat[key]);
}
assert.ok(performance.chancellor.tolls <= balanced.chancellor.tolls);
assert.ok(performance.chancellor.impacts <= balanced.chancellor.impacts);
assert.ok(balanced.chancellor.impacts <= high.chancellor.impacts);

assert.equal(effectBudgets('unknown').quality, 'balanced', 'unknown presets must fall back safely');
assert.throws(() => { balanced.combat.impacts = 999; }, TypeError, 'budgets must be immutable');

const qaControlsSource = await readFile(new URL('../js/sky-room/qa-controls.js', import.meta.url), 'utf8');
assert.ok(
  qaControlsSource.includes('const criticalSocketTarget = byLabel.critical.fire.capacity.socketsPerWard;'),
  'building-fire QA must derive its critical socket target from the active quality budget'
);
assert.ok(
  qaControlsSource.includes('const criticalSocketTarget = state.fire.capacity.socketsPerWard;'),
  'combined-load QA must derive its critical socket target from the active quality budget'
);
assert.ok(
  !qaControlsSource.includes('state.fire.activeFires >= 3'),
  'combined-load QA must not hard-code the Balanced fire-socket count'
);

console.log('effect budget QA passed', {
  enemies: MAX_ACTIVE_ENEMIES,
  projectiles: MAX_LOCAL_PROJECTILES,
  audioSfxVoices: MAX_AUDIO_SFX_VOICES,
  high,
  balanced,
  performance
});
