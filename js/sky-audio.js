/**
 * Sky Room audio — every sound synthesized live with the Web Audio API.
 * Same no-asset approach as js/audio.js (rain room), tuned for a moonlit
 * open sky: wind beds that follow altitude and speed, a low night drone,
 * distant bells, and the lantern's fire for casting and cleansing.
 *
 * Continuous beds are driven per-frame by SkyAudio.update(); one-shots are
 * fired from gameplay hooks in sky-room.js. Everything is safe to call
 * before init() — each entry point bails until the context exists.
 */

import { MAX_AUDIO_SFX_VOICES } from './sky-room/effect-budgets.js';

let ctx = null;
let master = null;         // final gain — mute toggles this
let reverbIn = null;       // convolver input shared by all "open air" sounds
let muted = false;
let volume = 0.9;

let noiseBuf = null;       // 2s white-noise loop shared by the wind beds
let musicBus = null;       // lo-fi campus beat — finale ducks it, B mutes with the rest
let musicFilter = null;    // opens slightly during flight and faster movement
let bowDrawNodes = null;   // live nodes of a drawn moonbow, stopped on loose/cancel
let altWind = null;        // { src, filter, gain } — high-altitude wind
let spdWind = null;        // { src, filter, gain } — wind on your face at speed
let campusBed = null;      // soft lawn leaves and insects at ground level
let cloisterBed = null;    // low stone-air resonance near the Great Hall arcades
let droneGain = null;      // night drone level (finale warms its chord)
let droneOscs = [];
let bellTimer = 0;
const activeSfxVoiceEnds = [];

const clamp01 = v => Math.max(0, Math.min(1, v));

function reserveSfxVoice(t0, duration) {
  if (!ctx) return false;
  const now = ctx.currentTime;
  for (let index = activeSfxVoiceEnds.length - 1; index >= 0; index--) {
    if (activeSfxVoiceEnds[index] <= now) activeSfxVoiceEnds.splice(index, 1);
  }
  if (activeSfxVoiceEnds.length >= MAX_AUDIO_SFX_VOICES) return false;
  activeSfxVoiceEnds.push(Math.max(now, Number(t0) || now) + Math.max(0.05, Number(duration) || 0.05));
  return true;
}

/* ================= bootstrap ================= */

function makeNoiseBuffer() {
  const sr = ctx.sampleRate;
  const buf = ctx.createBuffer(1, sr * 2, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function makeReverbBuffer(seconds) {
  const sr = ctx.sampleRate;
  const len = sr * seconds;
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4);
    }
  }
  return buf;
}

function windBed(filterType, freq, q) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(filter); filter.connect(gain); gain.connect(master);
  src.start();
  return { src, filter, gain };
}

function startDrone() {
  droneGain = ctx.createGain();
  droneGain.gain.value = 0.009;
  droneGain.connect(master);
  // A very quiet E/B bed supports the beat without becoming a fantasy pad.
  for (const f of [82.41, 123.47]) {
    for (const [type, ratio, vol] of [['sine', 1, 1], ['triangle', 1.003, 0.35]]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f * ratio;
      const g = ctx.createGain();
      g.gain.value = vol;
      osc.connect(g); g.connect(droneGain);
      osc.start();
      droneOscs.push(osc);
    }
  }
  // slow breathing on the whole drone
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoAmt = ctx.createGain();
  lfoAmt.gain.value = 0.006;
  lfo.connect(lfoAmt); lfoAmt.connect(droneGain.gain);
  lfo.start();
  droneOscs.push(lfo);
}

/* ================= shared voices ================= */

// one partial of a struck bell: sine with a fast attack and a long exponential tail
function bellPartial(freq, t0, dur, vol, destination = master) {
  if (!reserveSfxVoice(t0, dur + 0.05)) return;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(destination); g.connect(reverbIn);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

// a full bell strike: hum, prime, tierce, nominal — minor-third flavor
function bell(base, t0, vol = 0.05, dur = 5, destination = master) {
  for (const [ratio, v, d] of [[0.5, 0.7, 1.3], [1, 1, 1], [1.19, 0.55, 0.7], [2.0, 0.3, 0.45]]) {
    bellPartial(base * ratio, t0, dur * d, vol * v, destination);
  }
}

// warm music-box chime for the memories
function chime(freq, t0, vol = 0.14) {
  for (const [ratio, v] of [[1, 1], [2, 0.35], [3, 0.12]]) {
    if (!reserveSfxVoice(t0, 2.3)) continue;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol * v, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.2);
    osc.connect(g); g.connect(master); g.connect(reverbIn);
    osc.start(t0); osc.stop(t0 + 2.3);
  }
}

// filtered noise burst — the workhorse for whooshes, puffs, and impacts
function noiseBurst({ t0, dur, type = 'bandpass', from = 800, to = null, q = 1, vol = 0.2, attack = 0.005, destination = master }) {
  if (!reserveSfxVoice(t0, dur + 0.05)) return null;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(from, t0);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f); f.connect(g); g.connect(destination);
  src.start(t0); src.stop(t0 + dur + 0.05);
  return g;
}

// pitched sweep — fire chirps, falls, thumps
function sweep({ t0, dur, from, to, type = 'sine', vol = 0.15, revSend = 0, destination = master }) {
  if (!reserveSfxVoice(t0, dur + 0.05)) return null;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(destination);
  if (revSend > 0) { const s = ctx.createGain(); s.gain.value = revSend; g.connect(s); s.connect(reverbIn); }
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

function spatialDestination(position, lifetime = 6) {
  if (!ctx || !position || typeof ctx.createPanner !== 'function') return master;
  const panner = ctx.createPanner();
  panner.panningModel = 'HRTF';
  panner.distanceModel = 'inverse';
  panner.refDistance = 6;
  panner.maxDistance = 90;
  panner.rolloffFactor = 0.85;
  const now = ctx.currentTime;
  if (panner.positionX) {
    panner.positionX.setValueAtTime(Number(position.x) || 0, now);
    panner.positionY.setValueAtTime(Number(position.y) || 0, now);
    panner.positionZ.setValueAtTime(Number(position.z) || 0, now);
  } else {
    panner.setPosition(Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0);
  }
  panner.connect(master);
  setTimeout(() => { try { panner.disconnect(); } catch (_) { /* already released */ } }, lifetime * 1000);
  return panner;
}

/* ================= night beat — the room's score ================= */
// Dark lo-fi boom-bap for a strange campus after midnight: swung 4/4 drums,
// warm sub-bass, dusty electric-key stabs, and no celesta/harp lead.

const MUSIC_TEMPO = 86;
const MUSIC_BEAT = 60 / MUSIC_TEMPO;
const MUSIC_STEP = MUSIC_BEAT / 4;
const MUSIC_BAR = MUSIC_BEAT * 4;
const MUSIC_LOOP_BARS = 8;
const MUSIC_LEVEL = 0.68;
const MUSIC_DUCK_LEVEL = 0.18;
const MUSIC_SWING = MUSIC_STEP * 0.24;

function stepTime(barStart, step) {
  return barStart + step * MUSIC_STEP + (step % 2 ? MUSIC_SWING : 0);
}

function kick(t0, vol = 0.22) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(148, t0);
  osc.frequency.exponentialRampToValueAtTime(46, t0 + 0.12);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
  osc.connect(g); g.connect(musicBus);
  osc.start(t0); osc.stop(t0 + 0.4);
}

function snare(t0, vol = 0.105) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 1450;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.19);
  src.connect(high); high.connect(g); g.connect(musicBus);
  src.start(t0); src.stop(t0 + 0.21);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.setValueAtTime(188, t0);
  body.frequency.exponentialRampToValueAtTime(128, t0 + 0.11);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, t0);
  bodyGain.gain.exponentialRampToValueAtTime(vol * 0.42, t0 + 0.003);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
  body.connect(bodyGain); bodyGain.connect(musicBus);
  body.start(t0); body.stop(t0 + 0.16);
}

function hat(t0, open = false, vol = 0.032) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 6800;
  const g = ctx.createGain();
  const tail = open ? 0.18 : 0.055;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + tail);
  src.connect(high); high.connect(g); g.connect(musicBus);
  src.start(t0); src.stop(t0 + tail + 0.02);
}

function bassNote(freq, t0, dur, vol = 0.105) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  filter.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.018);
  g.gain.setValueAtTime(vol * 0.74, t0 + Math.min(0.12, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  filter.connect(g); g.connect(musicBus);
  for (const [type, level, detune] of [['sine', 1, 0], ['triangle', 0.18, -5]]) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const voice = ctx.createGain();
    voice.gain.value = level;
    osc.connect(voice); voice.connect(filter);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
}

function keyChord(freqs, t0, dur, vol = 0.017) {
  freqs.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = index % 2 ? 'triangle' : 'sine';
    osc.frequency.value = freq;
    osc.detune.value = -5 + index * 3;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2250 + index * 110;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.022);
    g.gain.setValueAtTime(vol * 0.58, t0 + Math.min(0.18, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(filter); filter.connect(g); g.connect(musicBus);
    osc.start(t0); osc.stop(t0 + dur + 0.04);
  });
}

function startVinylTexture() {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 4100;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 8800;
  const g = ctx.createGain();
  g.gain.value = 0.0045;
  src.connect(high); high.connect(low); low.connect(g); g.connect(musicBus);
  src.start();
}

function scheduleNightBeat(t0) {
  const chords = [
    { root: 82.41, fifth: 123.47, passing: 98.00, notes: [196.00, 246.94, 293.66, 369.99] }, // Em9
    { root: 82.41, fifth: 123.47, passing: 73.42, notes: [196.00, 246.94, 293.66, 369.99] },
    { root: 65.41, fifth: 98.00, passing: 73.42, notes: [164.81, 196.00, 246.94, 293.66] },  // Cmaj9
    { root: 65.41, fifth: 98.00, passing: 73.42, notes: [164.81, 196.00, 246.94, 293.66] },
    { root: 55.00, fifth: 82.41, passing: 61.74, notes: [130.81, 164.81, 196.00, 246.94] },  // Am9
    { root: 55.00, fifth: 82.41, passing: 61.74, notes: [130.81, 164.81, 196.00, 246.94] },
    { root: 61.74, fifth: 92.50, passing: 77.78, notes: [155.56, 185.00, 220.00, 277.18] }, // B7
    { root: 61.74, fifth: 92.50, passing: 73.42, notes: [155.56, 185.00, 220.00, 277.18] }
  ];
  const kickPatterns = [
    [0, 6, 10], [0, 7, 10, 14], [0, 3, 10], [0, 6, 11, 14]
  ];
  const hatSteps = [0, 2, 4, 6, 8, 10, 12, 14];

  chords.forEach((chord, barIndex) => {
    const barStart = t0 + barIndex * MUSIC_BAR;
    const kicks = kickPatterns[barIndex % kickPatterns.length];
    kicks.forEach((step, index) => kick(stepTime(barStart, step), index ? 0.18 : 0.225));
    snare(stepTime(barStart, 4), 0.1);
    snare(stepTime(barStart, 12), 0.11);
    if (barIndex % 2) snare(stepTime(barStart, 15), 0.028);

    hatSteps.forEach((step, index) => {
      const open = step === 14 && barIndex % 2 === 0;
      hat(stepTime(barStart, step), open, (index % 2 ? 0.025 : 0.034));
    });
    for (const step of barIndex % 2 ? [3, 11] : [7]) {
      hat(stepTime(barStart, step), false, 0.018);
    }

    bassNote(chord.root, stepTime(barStart, 0), MUSIC_BEAT * 1.35);
    bassNote(chord.fifth, stepTime(barStart, 7), MUSIC_BEAT * 0.58, 0.085);
    bassNote(chord.root * 2, stepTime(barStart, 10), MUSIC_BEAT * 0.7, 0.09);
    bassNote(chord.passing, stepTime(barStart, 14), MUSIC_BEAT * 0.42, 0.07);

    keyChord(chord.notes, stepTime(barStart, 0), MUSIC_BEAT * 1.15, 0.016);
    keyChord(chord.notes.slice(1), stepTime(barStart, 9), MUSIC_BEAT * 0.72, 0.011);
  });

  const loopDuration = MUSIC_BAR * MUSIC_LOOP_BARS;
  setTimeout(() => {
    if (!ctx || ctx.state === 'closed') return;
    // Background-tab timer throttling must not dump an entire late loop on one
    // frame. Resume at the next clean downbeat if the planned start has passed.
    scheduleNightBeat(Math.max(t0 + loopDuration, ctx.currentTime + 0.08));
  }, (loopDuration - 0.8) * 1000);
}

function startNightBeat() {
  musicBus = ctx.createGain();
  musicBus.gain.value = MUSIC_LEVEL;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -22;
  compressor.knee.value = 16;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.008;
  compressor.release.value = 0.18;
  musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = 3900;
  musicFilter.Q.value = 0.45;
  musicBus.connect(compressor); compressor.connect(musicFilter); musicFilter.connect(master);
  const send = ctx.createGain();
  send.gain.value = 0.12;
  musicBus.connect(send); send.connect(reverbIn);
  startVinylTexture();
  scheduleNightBeat(ctx.currentTime + 0.3);
}

/* ================= distant city — occasional far bells ================= */

function scheduleDistantBell() {
  bellTimer = setTimeout(() => {
    if (!ctx || ctx.state === 'closed') return;
    const t0 = ctx.currentTime + 0.05;
    const base = [174.61, 146.83, 220.0][Math.floor(Math.random() * 3)];
    const strikes = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < strikes; i++) bell(base, t0 + i * 2.4, 0.006, 6);
    scheduleDistantBell();
  }, 26000 + Math.random() * 40000);
}

/* ================= public API ================= */

export const SkyAudio = {
  get stats() {
    const now = ctx?.currentTime || 0;
    return {
      activeSfxVoices: activeSfxVoiceEnds.filter(end => end > now).length,
      sfxVoiceCapacity: MAX_AUDIO_SFX_VOICES
    };
  },
  init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeReverbBuffer(3.4);
    const revOut = ctx.createGain();
    revOut.gain.value = 0.35;
    reverbIn = reverb;
    reverb.connect(revOut); revOut.connect(master);

    noiseBuf = makeNoiseBuffer();
    altWind = windBed('lowpass', 420, 0.4);
    spdWind = windBed('bandpass', 900, 0.7);
    campusBed = windBed('bandpass', 2600, 1.15);
    cloisterBed = windBed('lowpass', 560, 0.55);
    startDrone();
    startNightBeat();
    scheduleDistantBell();

    window.addEventListener('keydown', e => { if (e.code === 'KeyB') SkyAudio.toggleMute(); });
  },

  // per-frame: wind follows altitude, face-wind follows speed
  update(dt, height, speed, airborne, position = null) {
    if (!ctx) return;
    if (position && ctx.listener) {
      const listener = ctx.listener;
      const now = ctx.currentTime;
      if (listener.positionX) {
        listener.positionX.setValueAtTime(Number(position.x) || 0, now);
        listener.positionY.setValueAtTime(Number(position.y) || 0, now);
        listener.positionZ.setValueAtTime(Number(position.z) || 0, now);
      } else if (listener.setPosition) {
        listener.setPosition(Number(position.x) || 0, Number(position.y) || 0, Number(position.z) || 0);
      }
    }
    const k = Math.min(1, dt * 1.6);
    const h01 = clamp01((height - 2) / 42);
    const s01 = clamp01(speed / 15);
    const altTarget = airborne ? 0.13 + h01 * 0.27 : 0;
    const spdTarget = 0; // 滑行風聲已關閉 — 要找回來把 0 改成 Math.pow(s01, 1.5) * 0.36
    const cloister01 = position ? clamp01((-position.z - 46) / 34) * clamp01(1 - Math.abs(position.x) / 62) : 0;
    const campusTarget = airborne ? 0.008 : 0.026 * (1 - cloister01 * 0.45);
    const cloisterTarget = 0.006 + cloister01 * (airborne ? 0.015 : 0.034);
    altWind.gain.gain.value += (altTarget - altWind.gain.gain.value) * k;
    spdWind.gain.gain.value += (spdTarget - spdWind.gain.gain.value) * k;
    campusBed.gain.gain.value += (campusTarget - campusBed.gain.gain.value) * k;
    cloisterBed.gain.gain.value += (cloisterTarget - cloisterBed.gain.gain.value) * k;
    altWind.filter.frequency.value += (380 + h01 * 340 - altWind.filter.frequency.value) * k;
    spdWind.filter.frequency.value += (800 + s01 * 1700 - spdWind.filter.frequency.value) * k;
    campusBed.filter.frequency.value += (2300 + Math.sin(ctx.currentTime * 0.14) * 420 - campusBed.filter.frequency.value) * k;
    cloisterBed.filter.frequency.value += (480 + cloister01 * 260 - cloisterBed.filter.frequency.value) * k;
    if (musicFilter) {
      const musicCutoff = 3400 + (airborne ? 700 : 0) + s01 * 900;
      musicFilter.frequency.value += (musicCutoff - musicFilter.frequency.value) * Math.min(1, dt * 2.4);
    }
  },

  // rising gust that carries the whole 6-second lift
  takeoff() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(260, t0);
    f.frequency.exponentialRampToValueAtTime(1600, t0 + 4.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.3, t0 + 2.2);
    g.gain.linearRampToValueAtTime(0, t0 + 6.0);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + 6.2);
  },

  // lantern bolt: a breath of fire leaving the flame
  cast(vol = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    noiseBurst({ t0, dur: 0.16, from: 650, to: 1700, q: 0.8, vol: 0.08 * vol });
    sweep({ t0, dur: 0.13, from: 240, to: 620, type: 'sine', vol: 0.07 * vol });
  },

  // memory recovered — C5, E5, G5 in order, so the third completes the chord
  relic(n) {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.02;
    const freq = [523.25, 659.25, 783.99][Math.min(2, Math.max(0, n - 1))];
    chime(freq, t0);
    chime(freq * 2, t0 + 0.14, 0.05);
    if (n >= 3) { chime(523.25, t0 + 0.3, 0.07); chime(659.25, t0 + 0.34, 0.06); } // full chord flourish
  },

  // a wisp bursts into morning: soft thump, then light scattering upward
  cleanse() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    sweep({ t0, dur: 0.2, from: 130, to: 48, type: 'sine', vol: 0.18 });
    for (let i = 0; i < 4; i++) {
      sweep({ t0: t0 + 0.05 + i * 0.045, dur: 0.3, from: 1100 + i * 380, to: 2100 + i * 520,
        type: 'sine', vol: 0.045, revSend: 0.6 });
    }
  },

  // the Unlight strikes — dark whumph, no brightness in it
  hurt(vol = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    sweep({ t0, dur: 0.28, from: 82, to: 28, type: 'sine', vol: 0.3 * vol });
    noiseBurst({ t0, dur: 0.2, type: 'lowpass', from: 420, q: 0.5, vol: 0.14 * vol });
  },

  // the wind takes you: a swell that outlives the fade to black
  death() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const g = noiseBurst({ t0, dur: 1.6, type: 'lowpass', from: 340, to: 900, q: 0.5, vol: 0.26, attack: 0.35 });
    if (g) g.gain.setValueAtTime(0.26, t0 + 0.9); // hold the gust before it dies
    sweep({ t0, dur: 1.4, from: 110, to: 40, type: 'triangle', vol: 0.06 });
  },

  // back at the circle — one soft bell, like being remembered
  respawn() {
    if (!ctx) return;
    bell(220, ctx.currentTime + 0.05, 0.022, 4);
  },

  // the city wakes: warm major chord blooming under a peal of bells
  finale() {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    // D major bloom, voices entering low to high across the five-second sunrise
    const chord = [[146.83, 0], [220.0, 0.5], [293.66, 1.1], [369.99, 1.8], [440.0, 2.6]];
    for (const [f, dt] of chord) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t0 + dt);
      g.gain.linearRampToValueAtTime(0.045, t0 + dt + 2.2);
      g.gain.linearRampToValueAtTime(0, t0 + 11);
      osc.connect(g); g.connect(master); g.connect(reverbIn);
      osc.start(t0 + dt); osc.stop(t0 + 11.2);
    }
    for (let i = 0; i < 3; i++) bell(293.66, t0 + 1.2 + i * 2.2, 0.025, 6);
    // The beat steps back while the city takes the foreground.
    if (musicBus) {
      musicBus.gain.linearRampToValueAtTime(MUSIC_DUCK_LEVEL, t0 + 2);
      musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, t0 + 14);
    }
    // the night drone eases back while the chord holds
    droneGain.gain.linearRampToValueAtTime(0.006, t0 + 4);
    droneGain.gain.linearRampToValueAtTime(0.009, t0 + 14);
  },

  // hush: breath over the flame; relight: the flame catches again
  hush(dimmed) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    if (dimmed) {
      noiseBurst({ t0, dur: 0.24, type: 'highpass', from: 1200, q: 0.4, vol: 0.09, attack: 0.04 });
    } else {
      noiseBurst({ t0, dur: 0.12, from: 900, to: 2400, q: 1.4, vol: 0.07 });
      sweep({ t0, dur: 0.1, from: 240, to: 620, type: 'sine', vol: 0.05 });
    }
  },

  // 星屑 — the lantern coughs a fan of embers: low kick + crackling spray
  scatter(vol = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    sweep({ t0, dur: 0.16, from: 150, to: 60, type: 'sine', vol: 0.14 * vol });
    for (let i = 0; i < 3; i++) {
      noiseBurst({ t0: t0 + i * 0.018, dur: 0.14, from: 500 + i * 220, to: 1400 + i * 300, q: 0.7, vol: 0.055 * vol });
    }
  },

  // 月弓 — tension rises while the string is drawn. Returns a handle so two
  // drawn bows (versus mode) can sound and stop independently.
  bowDraw(vol = 1) {
    if (!ctx) return null;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, t0);
    osc.frequency.linearRampToValueAtTime(300, t0 + 1.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.04 * vol, t0 + 0.25);
    osc.connect(g); g.connect(master);
    osc.start(t0);
    const src = ctx.createBufferSource(); // faint creak of the drawn string
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    f.frequency.setValueAtTime(400, t0);
    f.frequency.linearRampToValueAtTime(900, t0 + 1.1);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0, t0);
    ng.gain.linearRampToValueAtTime(0.018 * vol, t0 + 0.3);
    src.connect(f); f.connect(ng); ng.connect(master);
    src.start(t0);
    bowDrawNodes = { osc, g, src, ng };
    return bowDrawNodes;
  },

  // …and stops cleanly if the draw is cancelled (handle optional — falls
  // back to the most recent draw, which is all story mode ever has)
  bowStop(handle) {
    if (!ctx) return;
    const h = handle || bowDrawNodes;
    if (!h) return;
    const t = ctx.currentTime;
    for (const n of [h.g, h.ng]) {
      n.gain.cancelScheduledValues(t);
      n.gain.setValueAtTime(n.gain.value, t);
      n.gain.linearRampToValueAtTime(0, t + 0.04);
    }
    h.osc.stop(t + 0.06);
    h.src.stop(t + 0.06);
    if (h === bowDrawNodes) bowDrawNodes = null;
  },

  // loose: string twang, then the arrow whistling off into the night
  bowRelease(power, handle) {
    if (!ctx) return;
    this.bowStop(handle);
    if (power <= 0) return;
    const t0 = ctx.currentTime;
    sweep({ t0, dur: 0.25, from: 220, to: 140, type: 'triangle', vol: 0.1 + 0.08 * power });
    noiseBurst({ t0, dur: 0.4 + 0.3 * power, from: 2600, to: 800, q: 2.5, vol: 0.045 + 0.06 * power });
  },

  enemyNotice(type = 'stray', position = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    const destination = spatialDestination(position, 8);
    if (type === 'bellwarden') {
      bell(92.5, t0, 0.035, 5.5, destination);
      sweep({ t0, dur: 1.1, from: 72, to: 118, type: 'triangle', vol: 0.055, revSend: 0.7, destination });
    } else if (type === 'groundskeeper') {
      noiseBurst({ t0, dur: 0.55, type: 'lowpass', from: 360, to: 110, q: 0.6, vol: 0.08, attack: 0.08, destination });
    } else {
      sweep({ t0, dur: 0.34, from: 310, to: 510, type: 'sine', vol: 0.045, revSend: 0.5, destination });
    }
  },

  enemyWindup(type = 'stray', stage = 1, position = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const destination = spatialDestination(position, 8);
    if (type === 'bellwarden') {
      bell(stage > 1 ? 116.54 : 103.83, t0 + 0.02, 0.048, 4.8, destination);
      bell(stage > 1 ? 138.59 : 123.47, t0 + 0.34, 0.022, 3.4, destination);
    } else if (type === 'groundskeeper') {
      noiseBurst({ t0, dur: 0.9, type: 'lowpass', from: 120, to: 520, q: 0.8, vol: 0.13, attack: 0.18, destination });
      sweep({ t0, dur: 0.85, from: 54, to: 92, type: 'triangle', vol: 0.08, destination });
    } else {
      sweep({ t0, dur: 0.62, from: 240, to: 980, type: 'sine', vol: 0.085, revSend: 0.45, destination });
      chime(1174.66, t0 + 0.46, 0.035);
    }
  },

  enemyAttack(type = 'stray', stage = 1, position = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const destination = spatialDestination(position, 8);
    const heavy = type === 'bellwarden' ? 1.5 : type === 'groundskeeper' ? 1.2 : 1;
    noiseBurst({ t0, dur: 0.34 * heavy, from: 1500, to: 210, q: 1.1, vol: 0.12 * heavy, attack: 0.015, destination });
    sweep({ t0, dur: 0.28 * heavy, from: 180 * heavy, to: 42, type: 'sawtooth', vol: 0.07 * heavy, destination });
    if (type === 'bellwarden') bell(stage > 1 ? 77.78 : 69.3, t0, 0.038, 4, destination);
  },

  enemyHurt(type = 'stray', healthFraction = 1, position = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const destination = spatialDestination(position, 2);
    const base = type === 'bellwarden' ? 180 : type === 'groundskeeper' ? 240 : 360;
    sweep({ t0, dur: 0.18, from: base, to: base * (0.45 + healthFraction * 0.2), type: 'square', vol: 0.045, destination });
    noiseBurst({ t0, dur: 0.13, from: 1800, to: 700, q: 1.5, vol: 0.045, destination });
  },

  enemyDefeat(type = 'stray', position = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const destination = spatialDestination(position, 7);
    const size = type === 'bellwarden' ? 1.5 : type === 'groundskeeper' ? 1.2 : 1;
    sweep({ t0, dur: 0.46 * size, from: 170, to: 42, type: 'sine', vol: 0.12 * size, destination });
    for (let i = 0; i < (type === 'bellwarden' ? 6 : 3); i++) {
      chime(660 + i * 95, t0 + 0.05 + i * 0.07, 0.035 * size);
    }
  },

  buildingAlarm(position = null, intensity = 0.5) {
    if (!ctx) return;
    const amount = Math.max(0.15, Math.min(1, Number(intensity) || 0.5));
    const t0 = ctx.currentTime + 0.01;
    const destination = spatialDestination(position, 8);
    bell(174.61, t0, 0.018 + amount * 0.025, 3.4, destination);
    bell(146.83, t0 + 0.22, 0.012 + amount * 0.018, 2.8, destination);
  },

  buildingFire(position = null, intensity = 0.5) {
    if (!ctx) return;
    const amount = Math.max(0.08, Math.min(1, Number(intensity) || 0.5));
    const destination = spatialDestination(position, 4);
    noiseBurst({
      t0: ctx.currentTime, dur: 0.65, type: 'bandpass', from: 1250, to: 420,
      q: 0.7, vol: 0.018 + amount * 0.038, attack: 0.08, destination
    });
  },

  weaponSelect() {
    if (!ctx) return;
    chime(1318.5, ctx.currentTime + 0.01, 0.04);
  },

  // dash — a hard beat of wings
  dash() {
    if (!ctx) return;
    noiseBurst({ t0: ctx.currentTime, dur: 0.28, from: 380, to: 1500, q: 0.9, vol: 0.16, attack: 0.03 });
  },

  roundBell() {
    if (!ctx) return;
    bell(174.61, ctx.currentTime + 0.02, 0.028, 4);
  },

  victory() {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.05;
    chime(523.25, t0, 0.12);
    chime(659.25, t0 + 0.22, 0.12);
    chime(783.99, t0 + 0.44, 0.14);
    bell(261.63, t0 + 0.44, 0.025, 5);
  },

  uiClick() {
    if (!ctx) return;
    chime(1046.5, ctx.currentTime + 0.01, 0.05);
  },

  setVolume(value) {
    volume = clamp01(Number(value));
    if (ctx && master && !muted) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.08);
    }
    window.dispatchEvent(new CustomEvent('sky-audio-change', { detail: { muted, volume } }));
  },

  setMuted(value) {
    muted = Boolean(value);
    if (ctx && master) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : volume, ctx.currentTime + 0.15);
    }
    window.dispatchEvent(new CustomEvent('sky-audio-change', { detail: { muted, volume } }));
    return muted;
  },

  getVolume() { return volume; },
  isMuted() { return muted; },

  toggleMute() {
    return SkyAudio.setMuted(!muted);
  }
};
