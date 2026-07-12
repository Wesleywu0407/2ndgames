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

let ctx = null;
let master = null;         // final gain — mute toggles this
let reverbIn = null;       // convolver input shared by all "open air" sounds
let muted = false;
let volume = 0.9;

let noiseBuf = null;       // 2s white-noise loop shared by the wind beds
let musicBus = null;       // the night waltz — finale ducks it, B mutes with the rest
let bowDrawNodes = null;   // live nodes of a drawn moonbow, stopped on loose/cancel
let altWind = null;        // { src, filter, gain } — high-altitude wind
let spdWind = null;        // { src, filter, gain } — wind on your face at speed
let campusBed = null;      // soft lawn leaves and insects at ground level
let cloisterBed = null;    // low stone-air resonance near the Great Hall arcades
let droneGain = null;      // night drone level (finale warms its chord)
let droneOscs = [];
let bellTimer = 0;

const clamp01 = v => Math.max(0, Math.min(1, v));

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
  droneGain.gain.value = 0.016;
  droneGain.connect(master);
  // D2 + A2, each doubled by a detuned triangle so the pair slowly beats
  for (const f of [73.42, 110.0]) {
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
function bellPartial(freq, t0, dur, vol) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master); g.connect(reverbIn);
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

// a full bell strike: hum, prime, tierce, nominal — minor-third flavor
function bell(base, t0, vol = 0.05, dur = 5) {
  for (const [ratio, v, d] of [[0.5, 0.7, 1.3], [1, 1, 1], [1.19, 0.55, 0.7], [2.0, 0.3, 0.45]]) {
    bellPartial(base * ratio, t0, dur * d, vol * v);
  }
}

// warm music-box chime for the memories
function chime(freq, t0, vol = 0.14) {
  for (const [ratio, v] of [[1, 1], [2, 0.35], [3, 0.12]]) {
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
function noiseBurst({ t0, dur, type = 'bandpass', from = 800, to = null, q = 1, vol = 0.2, attack = 0.005 }) {
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
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + dur + 0.05);
  return g;
}

// pitched sweep — fire chirps, falls, thumps
function sweep({ t0, dur, from, to, type = 'sine', vol = 0.15, revSend = 0 }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master);
  if (revSend > 0) { const s = ctx.createGain(); s.gain.value = revSend; g.connect(s); s.connect(reverbIn); }
  osc.start(t0); osc.stop(t0 + dur + 0.05);
}

/* ================= night waltz — the room's score ================= */
// A wizarding-night waltz, composed for this room: 3/4 lilt in E minor,
// celesta melody, harp-like broken chords, and a faint string pad. The
// ingredients of that style — not a borrowed theme; the tune is original.

const WBEAT = 0.66;         // ~91 bpm
const WBAR = WBEAT * 3;

// celesta: pure fundamental plus a glassy double-octave partial
function celesta(freq, t0, dur, vol) {
  for (const [ratio, v, d] of [[1, 1, 1], [4, 0.16, 0.35]]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    const g = ctx.createGain();
    const tail = Math.max(dur, 1.4) * d;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol * v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + tail);
    osc.connect(g); g.connect(musicBus);
    osc.start(t0); osc.stop(t0 + tail + 0.1);
  }
}

// harp-ish pluck for the broken chords
function pluck(freq, t0, vol) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
  osc.connect(g); g.connect(musicBus);
  osc.start(t0); osc.stop(t0 + 1.2);
}

// soft string tone swelling under each bar
function padTone(freq, t0, dur, vol) {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + dur * 0.4);
  g.gain.linearRampToValueAtTime(0, t0 + dur * 1.15);
  osc.connect(g); g.connect(musicBus);
  osc.start(t0); osc.stop(t0 + dur * 1.2 + 0.05);
}

function scheduleWaltz(t0) {
  const CH = { // bass root + triad for the harp
    Em: { bass: 82.41,  arp: [164.81, 196.00, 246.94] },
    Am: { bass: 110.00, arp: [220.00, 261.63, 329.63] },
    B:  { bass: 123.47, arp: [246.94, 311.13, 369.99] },
    C:  { bass: 130.81, arp: [261.63, 329.63, 392.00] }
  };
  const bars = ['Em', 'Em', 'Am', 'B', 'Em', 'C', 'Am', 'Em',
                'Em', 'C', 'Am', 'B', 'C', 'Am', 'B', 'Em'];
  bars.forEach((name, i) => {
    const c = CH[name], bt = t0 + i * WBAR;
    padTone(c.bass * 2, bt, WBAR, 0.014);
    padTone(c.bass * 3, bt, WBAR, 0.010);
    pluck(c.bass, bt, 0.05);                                  // downbeat: the bass step
    c.arp.forEach((f, k) => pluck(f, bt + k * WBEAT, 0.026)); // then the chord unfolds
  });
  // melody: [beat offset, freq, beats] — wistful, rising in the second phrase
  const MEL = [
    [0, 329.63, 2],  [2, 392.00, 1],
    [3, 493.88, 2],  [5, 440.00, 1],
    [6, 392.00, 1],  [7, 440.00, 1],  [8, 493.88, 1],
    [9, 369.99, 3],
    [12, 329.63, 2], [14, 392.00, 1],
    [15, 493.88, 2], [17, 523.25, 1],
    [18, 440.00, 1.5], [19.5, 369.99, 1.5],
    [21, 329.63, 3],
    [24, 493.88, 2], [26, 659.25, 1],
    [27, 587.33, 2], [29, 523.25, 1],
    [30, 493.88, 1], [31, 440.00, 1], [32, 493.88, 1],
    [33, 369.99, 3],
    [36, 392.00, 2], [38, 659.25, 1],
    [39, 523.25, 1.5], [40.5, 493.88, 1.5],
    [42, 440.00, 1], [43, 369.99, 1], [44, 311.13, 1],
    [45, 329.63, 3]
  ];
  for (const [b, f, beats] of MEL) celesta(f, t0 + b * WBEAT, beats * WBEAT + 0.6, 0.05);
  const loopDur = WBAR * 16;
  setTimeout(() => {
    if (ctx && ctx.state !== 'closed') scheduleWaltz(t0 + loopDur);
  }, (loopDur - 0.6) * 1000);
}

function startNightWaltz() {
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.8;
  const warm = ctx.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = 5200;
  warm.Q.value = 0.4;
  musicBus.connect(warm); warm.connect(master);
  const send = ctx.createGain();
  send.gain.value = 0.4;
  musicBus.connect(send); send.connect(reverbIn);
  scheduleWaltz(ctx.currentTime + 0.4);
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
    startNightWaltz();
    scheduleDistantBell();

    window.addEventListener('keydown', e => { if (e.code === 'KeyB') SkyAudio.toggleMute(); });
  },

  // per-frame: wind follows altitude, face-wind follows speed
  update(dt, height, speed, airborne, position = null) {
    if (!ctx) return;
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
    g.gain.setValueAtTime(0.26, t0 + 0.9); // hold the gust before it dies
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
    // the waltz steps back while the city takes the melody
    if (musicBus) {
      musicBus.gain.linearRampToValueAtTime(0.25, t0 + 2);
      musicBus.gain.linearRampToValueAtTime(0.8, t0 + 14);
    }
    // the night drone eases back while the chord holds
    droneGain.gain.linearRampToValueAtTime(0.006, t0 + 4);
    droneGain.gain.linearRampToValueAtTime(0.016, t0 + 14);
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

  enemyNotice(type = 'stray') {
    if (!ctx) return;
    const t0 = ctx.currentTime + 0.01;
    if (type === 'bellwarden') {
      bell(92.5, t0, 0.035, 5.5);
      sweep({ t0, dur: 1.1, from: 72, to: 118, type: 'triangle', vol: 0.055, revSend: 0.7 });
    } else if (type === 'groundskeeper') {
      noiseBurst({ t0, dur: 0.55, type: 'lowpass', from: 360, to: 110, q: 0.6, vol: 0.08, attack: 0.08 });
    } else {
      sweep({ t0, dur: 0.34, from: 310, to: 510, type: 'sine', vol: 0.045, revSend: 0.5 });
    }
  },

  enemyWindup(type = 'stray', stage = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    if (type === 'bellwarden') {
      bell(stage > 1 ? 116.54 : 103.83, t0 + 0.02, 0.048, 4.8);
      bell(stage > 1 ? 138.59 : 123.47, t0 + 0.34, 0.022, 3.4);
    } else if (type === 'groundskeeper') {
      noiseBurst({ t0, dur: 0.9, type: 'lowpass', from: 120, to: 520, q: 0.8, vol: 0.13, attack: 0.18 });
      sweep({ t0, dur: 0.85, from: 54, to: 92, type: 'triangle', vol: 0.08 });
    } else {
      sweep({ t0, dur: 0.62, from: 240, to: 980, type: 'sine', vol: 0.075, revSend: 0.45 });
    }
  },

  enemyAttack(type = 'stray', stage = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const heavy = type === 'bellwarden' ? 1.5 : type === 'groundskeeper' ? 1.2 : 1;
    noiseBurst({ t0, dur: 0.34 * heavy, from: 1500, to: 210, q: 1.1, vol: 0.12 * heavy, attack: 0.015 });
    sweep({ t0, dur: 0.28 * heavy, from: 180 * heavy, to: 42, type: 'sawtooth', vol: 0.07 * heavy });
    if (type === 'bellwarden') bell(stage > 1 ? 77.78 : 69.3, t0, 0.038, 4);
  },

  enemyHurt(type = 'stray', healthFraction = 1) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const base = type === 'bellwarden' ? 180 : type === 'groundskeeper' ? 240 : 360;
    sweep({ t0, dur: 0.18, from: base, to: base * (0.45 + healthFraction * 0.2), type: 'square', vol: 0.045 });
    noiseBurst({ t0, dur: 0.13, from: 1800, to: 700, q: 1.5, vol: 0.045 });
  },

  enemyDefeat(type = 'stray') {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const size = type === 'bellwarden' ? 1.5 : type === 'groundskeeper' ? 1.2 : 1;
    sweep({ t0, dur: 0.46 * size, from: 170, to: 42, type: 'sine', vol: 0.12 * size });
    for (let i = 0; i < (type === 'bellwarden' ? 6 : 3); i++) {
      chime(660 + i * 95, t0 + 0.05 + i * 0.07, 0.035 * size);
    }
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
