import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('js/sky-room.js', 'utf8');
const gardenSource = readFileSync('js/sky-room/black-garden.js', 'utf8');

assert.match(source,
  /function completePrologue\(\)[\s\S]*?GAME\.phase = 4;[\s\S]*?wisps\.dissolveAll\(\);/,
  'offline Chapter I entry must clear the prologue enemy cast');
assert.doesNotMatch(source,
  /revealBellWarden\s*\(/,
  'Story must not create a passive Bell Warden apparition');
assert.match(source,
  /if \(nextPhase === 3 && !cloisterThresholdNarrated\)/,
  'shared Phase 3 snapshots should narrate the safe cloister threshold once');
assert.match(source,
  /setTimeout\(\(\) => \{\s*if \(GAME\.phase !== 3\) return;\s*storyCard/,
  'a delayed threshold narration must be cancelled after the story advances');
assert.match(source,
  /if \(nextPhase >= 4\) \{[\s\S]*?wisps\.dissolveAll\(\);[\s\S]*?opening\.setChapterOneEnabled\(true\);/,
  'shared Chapter I entry must clear every prologue enemy');
assert.match(gardenSource,
  /boss\.visible = phase === 8 && bossHp > 0;/,
  'the Groundskeeper must only be visible during its active combat phase');
assert.match(gardenSource,
  /function beginBossEncounter\(\) \{[\s\S]*?bossEncounterElapsed = 0;[\s\S]*?lastHazardCycle = -1;/,
  'entering the boss phase must reset its entrance and attack clock');
assert.match(gardenSource,
  /const combatReady = bossActive && bossEncounterElapsed >= BOSS_ENTRANCE_SECONDS;/,
  'boss attacks must wait for the entrance telegraph');

console.info('story enemy lifecycle QA passed', {
  phase3: 'safe narrated threshold with no physical boss',
  phase4: 'prologue enemies dissolved',
  phase8: 'visible, reset, and combat-active Groundskeeper'
});
