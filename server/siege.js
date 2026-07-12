/*
 * Shared, server-authoritative Lantern Vanguard siege.
 *
 * The server everyone connects to is the single source of truth, so co-op needs
 * no host election: whoever runs living-world.js hosts the siege and every
 * connected lantern defends the same five wards. The server owns ward integrity,
 * the night/phase clock and wave targeting; clients render the broadcast state
 * and send small acts (cleanse / stoke / relight). The wisp swarm itself stays
 * client-local and cosmetic, so nothing streams per-frame.
 *
 * Timings mirror the client's local (offline) sim so both feel identical.
 */

const WARDS = ['archive', 'alchemy', 'infirmary', 'practice', 'owlpost'];
const CORE_MAX = 100;
const DUSK_S = 6, WAVE_S = 18, LULL_S = 8, DAWN_S = 8, DAY_S = 14, WAVES = 3;
// Server-authoritative balance: with no wisp-hit damage (wisps are client-side
// and cosmetic), the passive tide has to be the real threat. Waves must be able
// to down an undefended ward, while active cleansing + stoking holds the line.
const WAVE_DRAIN = 6.5;      // per second per targeted ward, after the grace window
const CLEANSE_HEAL = 5;      // focus ward per wisp a client cleanses
const STOKE_PER_ACT = 2.2;   // per stoke act (clients send ~5/sec while holding E → ~11/s)
const RELIGHT_PER_ACT = 1.3;
const MEND_TRICKLE = 1.0;    // Alchemy's passive repair while lit
const LULL_RECOVER = 2.0;    // cores recover slowly between waves…
const DAY_RECOVER = 4.0;     // …and faster in the safe daylight
const OWL_GRACE = 3.5;

function createSiege({ broadcast }) {
  const participants = new Set();
  let running = false, phase = 'idle', pt = 0, night = 0, waveIx = 0, shards = 0;
  let wards = freshWards(), targets = [], focus = WARDS[0];

  function freshWards() {
    const w = {};
    for (const id of WARDS) w[id] = { hp: CORE_MAX, dark: false };
    return w;
  }
  const lit = id => !wards[id].dark;
  const targetCount = () => Math.min(WARDS.length, 1 + Math.floor(night / 2));

  function pickTargets() {
    const pool = WARDS.filter(id => !wards[id].dark);
    const src = pool.length ? pool : WARDS;
    const start = (night * 3 + waveIx) % src.length;
    const n = Math.min(targetCount(), src.length);
    const out = [];
    for (let i = 0; i < n; i++) out.push(src[(start + i) % src.length]);
    return out;
  }
  function computeFocus() {
    const litTargets = targets.filter(id => !wards[id].dark);
    focus = litTargets.length
      ? litTargets.slice().sort((a, b) => wards[a].hp - wards[b].hp)[0]
      : (WARDS.find(id => !wards[id].dark) || WARDS[0]);
  }
  function enter(next) {
    phase = next; pt = 0;
    if (next === 'dusk') { waveIx = 0; targets = pickTargets(); }
    else if (next === 'wave') { waveIx++; targets = pickTargets(); }
  }
  function start() {
    running = true; wards = freshWards(); night = 1; waveIx = 0; shards = 0;
    enter('dusk'); computeFocus();
  }
  function stop() { running = false; phase = 'idle'; pt = 0; }

  function handle(id, msg) {
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'siege-join') {
      participants.add(id);
      if (!running) start();
      sendSnapshot();
    } else if (msg.t === 'siege-leave') {
      participants.delete(id);
      if (!participants.size) stop();
    } else if (msg.t === 'siege-act' && running) {
      applyAct(msg);
    }
  }

  function applyAct(msg) {
    if (msg.act === 'cleanse') {
      shards++;
      if (!wards[focus].dark) wards[focus].hp = Math.min(CORE_MAX, wards[focus].hp + CLEANSE_HEAL);
    } else if (msg.act === 'stoke' && wards[msg.ward] && !wards[msg.ward].dark) {
      wards[msg.ward].hp = Math.min(CORE_MAX, wards[msg.ward].hp + STOKE_PER_ACT);
    } else if (msg.act === 'relight' && wards[msg.ward] && wards[msg.ward].dark) {
      const w = wards[msg.ward];
      w.hp = Math.min(CORE_MAX, w.hp + RELIGHT_PER_ACT);
      if (w.hp >= CORE_MAX * 0.5) w.dark = false;
    }
  }

  function tick(dt) {
    if (!running) return;
    pt += dt;
    const trickle = lit('alchemy') ? MEND_TRICKLE : 0;

    if (phase === 'wave') {
      const drainMul = (lit('practice') ? 0.7 : 1) * ((lit('owlpost') && pt < OWL_GRACE) ? 0 : 1);
      for (const id of WARDS) {
        const w = wards[id];
        if (w.dark) continue;
        // targeted wards take the tide; others get only the Alchemy mend
        if (targets.includes(id)) w.hp = Math.max(0, w.hp - WAVE_DRAIN * drainMul * dt);
        else if (trickle) w.hp = Math.min(CORE_MAX, w.hp + trickle * dt);
        if (w.hp <= 0) w.dark = true;
      }
    } else {
      const rate = (phase === 'day' ? DAY_RECOVER : LULL_RECOVER) + trickle;
      for (const id of WARDS) {
        const w = wards[id];
        if (!w.dark && w.hp < CORE_MAX) w.hp = Math.min(CORE_MAX, w.hp + rate * dt);
      }
    }
    computeFocus();

    if (phase === 'dusk' && pt >= DUSK_S) enter('wave');
    else if (phase === 'wave' && pt >= WAVE_S) enter(waveIx >= WAVES ? 'dawn' : 'lull');
    else if (phase === 'lull' && pt >= LULL_S) enter('wave');
    else if (phase === 'dawn' && pt >= DAWN_S) { night++; enter('day'); }
    else if (phase === 'day' && pt >= DAY_S) enter('dusk');

    sendSnapshot();
  }

  function snapshot() {
    return {
      t: 'siege', running, night, phase, waveIx, waves: WAVES,
      targets, focus, shards, players: participants.size,
      wards: WARDS.map(id => ({ id, hp: Math.round(wards[id].hp * 10) / 10, dark: wards[id].dark }))
    };
  }
  function sendSnapshot() { broadcast(snapshot()); }

  return {
    handle,
    tick,
    dropPlayer: id => handle(id, { t: 'siege-leave' }),
    snapshot,
    get running() { return running; },
    get participants() { return participants.size; }
  };
}

module.exports = { createSiege, WARDS };
