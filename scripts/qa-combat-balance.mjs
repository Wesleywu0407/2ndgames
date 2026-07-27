import assert from 'node:assert/strict';
import { ENEMY_ARCHETYPES, WEAPON_PROFILES, idealTimeToKill } from '../js/sky-room/combat-balance.js';

const matrix = Object.fromEntries(Object.keys(ENEMY_ARCHETYPES).map(enemy => [
  enemy,
  Object.fromEntries(Object.keys(WEAPON_PROFILES).map(weapon => {
    const result = idealTimeToKill(enemy, weapon, 1);
    assert(result && Number.isFinite(result.seconds) && result.seconds >= 0,
      `${enemy}/${weapon} should have a finite ideal TTK`);
    assert(result.volleys >= 1, `${enemy}/${weapon} should require at least one volley`);
    return [weapon, Number(result.seconds.toFixed(1))];
  }))
]));

assert.equal(matrix.stray.ember, 3, 'Stray/Ember baseline should remain stable');
assert.equal(matrix.groundskeeper.ember, 9.3, 'Groundskeeper/Ember baseline should remain stable');
assert.equal(matrix.bellwarden.ember, 47.7, 'Bell Warden/Ember baseline should remain stable');
assert.equal(idealTimeToKill('missing', 'ember'), null, 'unknown enemies should not invent balance data');
assert.equal(idealTimeToKill('stray', 'missing'), null, 'unknown weapons should not invent balance data');
assert(Object.isFrozen(ENEMY_ARCHETYPES.stray) && Object.isFrozen(WEAPON_PROFILES.ember),
  'combat balance records should be immutable');

console.info('combat balance QA passed — ideal all-hit TTK seconds', matrix);
