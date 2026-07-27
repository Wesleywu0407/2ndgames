import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, css, js, settingsJs] = await Promise.all([
  readFile(new URL('../sky-room.html', import.meta.url), 'utf8'),
  readFile(new URL('../css/sky-room.css', import.meta.url), 'utf8'),
  readFile(new URL('../js/sky-room.js', import.meta.url), 'utf8'),
  readFile(new URL('../js/sky-room/settings-controller.js', import.meta.url), 'utf8')
]);

const requiredControls = [
  'settingUiScale', 'settingHighContrast', 'settingSubtitleSize',
  'settingSpeakerLabels', 'settingSubtitleBackground', 'settingReducedSmoke',
  'settingReducedFlash', 'settingReducedBloom'
];
for (const id of requiredControls) assert.match(html, new RegExp(`id="${id}"`), `${id} is missing`);

for (const scale of ['1', '1.15', '1.3', '1.5']) {
  assert.match(html, new RegExp(`option value="${scale.replace('.', '\\.')}"`), `UI scale ${scale} is missing`);
}

assert.match(html, /id="buildingEmergency"[\s\S]*aria-live="assertive"/, 'building emergency live region is missing');
assert.match(html, /id="interactionPrompt"[\s\S]*aria-live="polite"/, 'consistent interaction prompt is missing');
assert.match(html, /id="touchRecenter"[\s\S]*aria-label="Recenter camera"/, 'touch recenter action is missing');
assert.match(css, /--sky-ui-scale:\s*1\.15/, 'readable UI scale default is missing');
assert.match(css, /#objective[\s\S]*font-size:\s*max\(16px/, 'objective must never render below 16px');
assert.match(css, /#storycard[\s\S]*bottom:/, 'subtitles must use a lower safe area');
assert.match(css, /html\[lang="zh-Hant"\]/, 'Traditional Chinese typography tuning is missing');
assert.match(css, /body\.high-contrast-hud/, 'high-contrast HUD rules are missing');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/, 'OS reduced-motion rules are missing');
assert.match(css, /transition-duration:\s*\.01ms !important/, 'reduced-motion transitions are not bounded');
assert.match(css, /#weapon:not\(\.combat-expanded\)/, 'weapon details must collapse outside combat');
assert.match(css, /#interactionPrompt[\s\S]*font-size:\s*max\(16px/, 'interaction action must never render below 16px');
assert.match(css, /#touchRecenter\s*{[^}]*right:\s*0;[^}]*bottom:\s*5px;/, 'touch recenter needs a non-overlapping action position');
assert.match(css, /\/\* ---------- final mobile composition ---------- \*\//,
  'the consolidated portrait mobile composition is missing');
assert.match(css, /body\[data-input-device="touch"\] #interactionPrompt[\s\S]*bottom:\s*max\(176px/,
  'touch interaction prompts must remain above the thumb controls');
assert.match(css, /@media \(orientation: landscape\) and \(max-height: 500px\)/,
  'short phone landscape needs a layout that also covers sub-721px devices');
assert.match(css, /#characterRoster[\s\S]*scroll-snap-type:\s*x proximity/,
  'the mobile character roster must scroll horizontally instead of growing over the footer');
assert.match(settingsJs, /bloom\.enabled = prefs\.quality === 'high' && !prefs\.reducedBloom/, 'reduced bloom is not wired');
assert.match(js, /prefers-reduced-motion: reduce/, 'reduced-motion runtime preference is not wired');
assert.match(js, /reducedSmoke: settings\.prefs\.reducedSmoke/, 'reduced smoke is not wired to building fire');
assert.match(js, /reducedFlash: settings\.prefs\.reducedFlash/, 'reduced flash is not wired to building fire');
assert.match(js, /buildingEmergencyEl\.classList\.toggle\('on'/, 'building emergency state is not wired');
assert.match(js, /X \/ □[\s\S]*TAP/, 'interaction glyph variants are not wired');
assert.match(js, /const MOBILE_TEST = URL_QUERY\.has\('mobile-test'\)/,
  'deterministic mobile viewport QA mode is missing');

console.log('Phase 4 UI readability QA passed: controls, mobile compositions, safe areas, language fit, and emergency HUD are wired.');
