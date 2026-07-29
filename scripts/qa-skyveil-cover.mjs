import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const html = readFileSync('sky-room.html', 'utf8');
const css = readFileSync('css/sky-room.css', 'utf8');
const room = readFileSync('js/sky-room.js', 'utf8');
const assets = {
  video: statSync('assets/video/skyveil/skyveil-intro-1080p.mp4').size,
  desktopPoster: statSync('assets/video/skyveil/skyveil-poster-desktop.jpg').size,
  mobilePoster: statSync('assets/video/skyveil/skyveil-poster-mobile.jpg').size
};

assert.match(html, /<title>SKYVEIL — The Twelfth Bell<\/title>/,
  'the browser title must use the SKYVEIL brand');
assert.match(html, /id="skyveilCover"[\s\S]*?id="skyveilEnter"/,
  'the cinematic cover needs an accessible entry action');
assert.match(html,
  /media="\(min-width: 721px\) and \(prefers-reduced-motion: no-preference\)"/,
  'the cinematic video must not load for mobile or reduced-motion visitors');
assert.match(html, /id="menu" class="menu-awaiting-cover" aria-hidden="true" inert/,
  'the mode menu must remain inaccessible behind the cover');

assert.match(room, /function setCoverBackgroundBlocked\(blocked\)/,
  'background interfaces must be inert while the cover is active');
assert.match(room, /function revealModeMenu\(\)[\s\S]*?menuEl\.inert = false;/,
  'entering the night must release the mode menu');
assert.match(room, /skyveilCoverVideo\?\.pause\(\);/,
  'the cinematic must stop consuming resources after entry');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?#skyveilCoverVideo \{ display: none !important; \}/,
  'reduced-motion mode must use the static poster');

assert.ok(assets.video < 5 * 1024 * 1024,
  `web video is too large (${assets.video} bytes)`);
assert.ok(assets.desktopPoster < 700 * 1024,
  `desktop poster is too large (${assets.desktopPoster} bytes)`);
assert.ok(assets.mobilePoster < 500 * 1024,
  `mobile poster is too large (${assets.mobilePoster} bytes)`);

console.info('SKYVEIL cover QA passed', {
  brand: 'SKYVEIL',
  videoMegabytes: Number((assets.video / 1024 / 1024).toFixed(2)),
  desktopPosterKilobytes: Math.round(assets.desktopPoster / 1024),
  mobilePosterKilobytes: Math.round(assets.mobilePoster / 1024),
  motionFallback: true,
  modeMenuGated: true
});
