// ─── Audio Engine ─────────────────────────────────────────────────────────────

import { S, BAR } from "./state.js";

export function initAudio() {
  if (S.audioCtx) return;
  S.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  buildVinylMusic();
}

// ── Vinyl Music Engine ────────────────────────────────────────────────────────

function buildVinylMusic() {
  const sr = S.audioCtx.sampleRate;

  const warmth = S.audioCtx.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.frequency.value = 6800;
  warmth.Q.value = 0.5;

  S.vinylGainNode = S.audioCtx.createGain();
  S.vinylGainNode.gain.setValueAtTime(0, S.audioCtx.currentTime);
  S.vinylGainNode.gain.linearRampToValueAtTime(0.72, S.audioCtx.currentTime + 4);

  warmth.connect(S.vinylGainNode);
  S.vinylGainNode.connect(S.audioCtx.destination);

  const revBuf = makeReverbBuffer(sr, 2.0);
  const reverb = S.audioCtx.createConvolver();
  reverb.buffer = revBuf;
  const revGain = S.audioCtx.createGain();
  revGain.gain.value = 0.22;
  reverb.connect(revGain);
  revGain.connect(S.vinylGainNode);

  startVinylCrackle(S.vinylGainNode);
  scheduleMusicLoop(S.audioCtx.currentTime + 0.3, warmth, reverb);
}

function makeReverbBuffer(sr, duration) {
  const len = sr * duration;
  const buf = S.audioCtx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.8);
    }
  }
  return buf;
}

function makeNote(freq, dest, revDest, t0, dur, vol = 0.11) {
  [1, 1.002].forEach((ratio, idx) => {
    const osc = S.audioCtx.createOscillator();
    osc.type = idx === 0 ? "sine" : "triangle";
    osc.frequency.value = freq * ratio;

    const env = S.audioCtx.createGain();
    const att = Math.min(0.35, dur * 0.12);
    const rel = Math.min(1.0, dur * 0.35);
    env.gain.setValueAtTime(0, t0);
    env.gain.linearRampToValueAtTime(vol * (idx === 0 ? 1 : 0.4), t0 + att);
    env.gain.setValueAtTime(vol * (idx === 0 ? 1 : 0.4), t0 + dur - rel);
    env.gain.linearRampToValueAtTime(0, t0 + dur);

    osc.connect(env);
    env.connect(dest);
    env.connect(revDest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  });
}

function scheduleMusicLoop(t0, dest, revDest) {
  // ── 4-bar loop, A minor feel ──────────────────────────────────────────────
  makeNote(110.00, dest, revDest, t0,            BAR * 0.98, 0.13);
  makeNote(220.00, dest, revDest, t0,            BAR * 0.95, 0.09);
  makeNote(261.63, dest, revDest, t0 + 0.04,     BAR * 0.92, 0.07);
  makeNote(329.63, dest, revDest, t0 + 0.08,     BAR * 0.88, 0.06);
  makeNote(392.00, dest, revDest, t0 + 0.55,     BAR * 0.6,  0.065);
  makeNote(349.23, dest, revDest, t0 + 1.15,     BAR * 0.55, 0.060);
  makeNote(329.63, dest, revDest, t0 + 1.85,     BAR * 0.48, 0.055);

  // Bar 2: F maj (F A C)
  makeNote(87.31,  dest, revDest, t0 + BAR,      BAR * 0.98, 0.12);
  makeNote(174.61, dest, revDest, t0 + BAR,      BAR * 0.94, 0.09);
  makeNote(220.00, dest, revDest, t0 + BAR + 0.04, BAR * 0.90, 0.07);
  makeNote(261.63, dest, revDest, t0 + BAR + 0.08, BAR * 0.86, 0.06);

  // Bar 3: G maj (G B D)
  makeNote(98.00,  dest, revDest, t0 + BAR * 2,  BAR * 0.98, 0.11);
  makeNote(174.61, dest, revDest, t0 + BAR * 2,  BAR * 0.94, 0.09);
  makeNote(220.00, dest, revDest, t0 + BAR * 2 + 0.04, BAR * 0.9, 0.07);
  makeNote(261.63, dest, revDest, t0 + BAR * 2 + 0.08, BAR * 0.88, 0.06);

  // Bar 4: Em  (E G B)
  makeNote(82.41,  dest, revDest, t0 + BAR * 3,  BAR * 0.98, 0.12);
  makeNote(164.81, dest, revDest, t0 + BAR * 3,  BAR * 0.94, 0.09);
  makeNote(196.00, dest, revDest, t0 + BAR * 3 + 0.04, BAR * 0.9, 0.07);
  makeNote(246.94, dest, revDest, t0 + BAR * 3 + 0.08, BAR * 0.88, 0.06);

  // ── Melody (higher register, sparser) ────────────────────────────────────
  const mel = [
    [0.0,          440.00, 0.7,  0.075],
    [1.0,          392.00, 0.55, 0.065],
    [1.9,          349.23, 0.9,  0.072],
    [BAR + 0.3,    392.00, 0.65, 0.065],
    [BAR + 1.4,    369.99, 0.85, 0.058],
    [BAR * 2 + 0.1, 349.23, 0.75, 0.070],
    [BAR * 2 + 1.1, 329.63, 0.6,  0.062],
    [BAR * 2 + 2.0, 261.63, 1.1,  0.070],
    [BAR * 3 + 0.3, 329.63, 0.7,  0.062],
    [BAR * 3 + 1.3, 246.94, 0.85, 0.058],
    [BAR * 3 + 2.2, 220.00, 1.6,  0.072],
  ];

  for (const [dt, freq, dur, vol] of mel) {
    makeNote(freq, dest, revDest, t0 + dt, dur, vol);
  }

  const loopDur = BAR * 4;
  setTimeout(() => {
    if (S.audioCtx && S.audioCtx.state !== "closed") {
      scheduleMusicLoop(t0 + loopDur, dest, revDest);
    }
  }, (loopDur - 0.5) * 1000);
}

function startVinylCrackle(dest) {
  const sr = S.audioCtx.sampleRate;

  function pop() {
    if (!S.audioCtx || S.audioCtx.state === "closed") return;
    const buf = S.audioCtx.createBuffer(1, Math.floor(sr * 0.012), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 60);
    const src = S.audioCtx.createBufferSource();
    src.buffer = buf;
    const g = S.audioCtx.createGain();
    g.gain.value = 0.03 + Math.random() * 0.05;
    src.connect(g); g.connect(dest); src.start();
    setTimeout(pop, 600 + Math.random() * 2800);
  }

  function scratch() {
    if (!S.audioCtx || S.audioCtx.state === "closed") return;
    const len = Math.floor(sr * (0.04 + Math.random() * 0.06));
    const buf = S.audioCtx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(i / len * Math.PI);
    const src = S.audioCtx.createBufferSource();
    src.buffer = buf;
    const f = S.audioCtx.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 4000;
    const g = S.audioCtx.createGain();
    g.gain.value = 0.04 + Math.random() * 0.03;
    src.connect(f); f.connect(g); g.connect(dest); src.start();
    setTimeout(scratch, 7000 + Math.random() * 14000);
  }

  setTimeout(pop, 1200);
  setTimeout(scratch, 5000);
}

export function playFootstep() {
  if (!S.audioCtx) return;
  const now = S.audioCtx.currentTime;

  const osc = S.audioCtx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(95, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);

  const nBuf = S.audioCtx.createBuffer(1, S.audioCtx.sampleRate * 0.06, S.audioCtx.sampleRate);
  const nd = nBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / 400);

  const nSrc = S.audioCtx.createBufferSource();
  nSrc.buffer = nBuf;

  const nFilter = S.audioCtx.createBiquadFilter();
  nFilter.type = "bandpass";
  nFilter.frequency.value = 800;
  nFilter.Q.value = 1.5;

  const gain = S.audioCtx.createGain();
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

  const nGain = S.audioCtx.createGain();
  nGain.gain.value = 0.15;

  osc.connect(gain);
  nSrc.connect(nFilter);
  nFilter.connect(nGain);
  nGain.connect(gain);
  gain.connect(S.audioCtx.destination);

  osc.start(now); osc.stop(now + 0.14);
  nSrc.start(now);
}

export function playPhotoInteract() {
  if (!S.audioCtx) return;
  const now = S.audioCtx.currentTime;

  const len = S.audioCtx.sampleRate * 0.09;
  const buf = S.audioCtx.createBuffer(1, len, S.audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.exp(-i / (len * 0.3));
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = S.audioCtx.createBufferSource();
  src.buffer = buf;

  const filter = S.audioCtx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 4500;
  filter.Q.value = 1.8;

  const gain = S.audioCtx.createGain();
  gain.gain.value = 0.35;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(S.audioCtx.destination);
  src.start(now);
}

export function playLightSwitch() {
  if (!S.audioCtx) return;
  const now = S.audioCtx.currentTime;

  const buf = S.audioCtx.createBuffer(1, S.audioCtx.sampleRate * 0.04, S.audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 180);
  }
  const src = S.audioCtx.createBufferSource();
  src.buffer = buf;

  const gain = S.audioCtx.createGain();
  gain.gain.value = 0.55;

  src.connect(gain);
  gain.connect(S.audioCtx.destination);
  src.start(now);

  if (S.vinylGainNode) {
    const target = S.lightsOn ? 0.5 : 0.72;
    S.vinylGainNode.gain.linearRampToValueAtTime(target, now + 1.8);
  }
}
