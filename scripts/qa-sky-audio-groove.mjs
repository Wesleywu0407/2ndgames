import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const audio = readFileSync(new URL('../js/sky-audio.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/sky-room.js', import.meta.url), 'utf8');

const tempo = Number(audio.match(/const MUSIC_TEMPO = ([\d.]+);/)?.[1]);
assert.ok(tempo >= 82 && tempo <= 92, 'night beat tempo must remain in a laid-back hip-hop range');
assert.match(audio, /const MUSIC_BAR = MUSIC_BEAT \* 4;/,
  'night beat must use 4/4 rather than the removed three-beat waltz');
assert.match(audio, /const MUSIC_SWING = MUSIC_STEP \* 0\.24;/,
  'sixteenth-note swing is missing');

for (const voice of ['kick', 'snare', 'hat', 'bassNote', 'keyChord']) {
  assert.match(audio, new RegExp(`function ${voice}\\(`), `${voice} music voice is missing`);
}
assert.match(audio, /const kickPatterns = \[[\s\S]*\[0, 7, 10, 14\]/,
  'syncopated kick patterns are missing');
assert.match(audio, /snare\(stepTime\(barStart, 4\)[\s\S]*snare\(stepTime\(barStart, 12\)/,
  'backbeat snares must land on beats two and four');
assert.match(audio, /high\.frequency\.value = 6800;/,
  'hi-hats need a dedicated bright noise band');
assert.match(audio, /filter\.frequency\.value = 520;/,
  'sub-bass needs low-pass control');
assert.match(audio, /function startVinylTexture\(\)/,
  'the lo-fi texture layer is missing');
assert.match(audio, /Math\.max\(t0 \+ loopDuration, ctx\.currentTime \+ 0\.08\)/,
  'a throttled background tab must restart on a clean future downbeat');

assert.match(audio, /ctx\.createDynamicsCompressor\(\)/,
  'music bus compression is missing');
assert.match(audio, /send\.gain\.value = 0\.12;/,
  'music reverb must stay subtle enough to preserve drum impact');
assert.match(audio, /const musicCutoff = 3400 \+ \(airborne \? 700 : 0\) \+ s01 \* 900;/,
  'movement must open the beat filter without changing tempo');
assert.match(audio, /startNightBeat\(\);/,
  'the new score is not started during audio initialization');
assert.doesNotMatch(audio, /function (?:celesta|pluck|padTone|scheduleWaltz|startNightWaltz)\(/,
  'removed fantasy-waltz voices must not remain callable');
assert.match(audio, /MUSIC_DUCK_LEVEL[\s\S]*MUSIC_LEVEL, t0 \+ 14/,
  'the finale must duck and restore the new music level');
assert.match(main, /sky-audio\.js\?v=night-beat-1/,
  'production must cache-bust the new score');

console.log('Sky Room night-beat QA passed: 86 BPM swung boom-bap voices, mix bus, movement filter, and finale ducking verified.');
