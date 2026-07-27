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
const WARD_POSITIONS = Object.freeze({
  archive: [-35, 10, -25], alchemy: [35, 10, -27], infirmary: [-52, 10, -8],
  practice: [52, 10, -10], owlpost: [0, 10, 45]
});
const FIRE_SOCKETS = ['roof', 'window', 'door', 'courtyard'];
const CORE_MAX = 100;
const BRIEFING_S = 8, DEPLOYMENT_S = 12;
const DUSK_S = 6, WAVE_S = 18, LULL_S = 8, DAWN_S = 8, WAVES = 3;
// Server-authoritative balance: with no wisp-hit damage (wisps are client-side
// and cosmetic), the passive tide has to be the real threat. Waves must be able
// to down an undefended ward, while active cleansing + stoking holds the line.
const WAVE_DRAIN = 0.35;     // atmospheric strain; fire requires a visible enemy impact
const CLEANSE_HEAL = 5;      // focus ward per wisp a client cleanses
const STOKE_PER_ACT = 2.2;   // per stoke act (clients send ~5/sec while holding E → ~11/s)
const RELIGHT_PER_ACT = 1.3;
const MEND_TRICKLE = 1.0;    // Alchemy's passive repair while lit
const LULL_RECOVER = 2.0;    // cores recover slowly between waves…
const DAY_RECOVER = 4.0;     // …and faster in the safe daylight
const OWL_GRACE = 3.5;
const MAX_TIER = 4;          // upgrade tiers per track
const FIRE_DECAY = 0.022;
const upgradeCost = tier => 15 + tier * 15;   // 15, 30, 45, 60

function createSiege({
  broadcast,
  getPlayerState = () => null,
  now = () => Date.now(),
  loadCheckpoint = () => null,
  saveCheckpoint = () => {}
}) {
  const participants = new Set();
  const actTimes = new Map();
  let running = false, phase = 'idle', pt = 0, night = 0, waveIx = 0, shards = 0;
  let upgrades = { embers: 0, cores: 0, lantern: 0 };   // shared, bought in the day phase
  let wards = freshWards(), targets = [], focus = WARDS[0];
  let missionWard = null, missionInteriorComplete = false, missionComplete = false;

  function freshWards() {
    const w = {};
    for (const id of WARDS) w[id] = {
      hp: CORE_MAX, dark: false, stage: 'safe', fireIntensity: 0,
      affectedSockets: [], rescueCount: 0, residentCount: 3, restoration: 0,
      lastImpactAt: -1e9
    };
    return w;
  }
  function checkpointState() {
    return {
      version: 1, night, shards, upgrades: { ...upgrades },
      missionWard, missionInteriorComplete, missionComplete,
      wards: Object.fromEntries(WARDS.map(id => [id, {
        hp: wards[id].hp, dark: wards[id].dark, fireIntensity: wards[id].fireIntensity,
        rescueCount: wards[id].rescueCount, residentCount: wards[id].residentCount,
        restoration: wards[id].restoration
      }]))
    };
  }
  function saveWardCheckpoint() {
    try { saveCheckpoint(checkpointState()); } catch (error) {
      console.warn('Unable to save siege checkpoint:', error?.message || error);
    }
  }
  function restoreWardCheckpoint() {
    let saved = null;
    try { saved = loadCheckpoint(); } catch (error) {
      console.warn('Unable to load siege checkpoint:', error?.message || error);
    }
    if (!saved || saved.version !== 1 || !saved.wards) return false;
    wards = freshWards();
    night = Math.max(1, Math.floor(Number(saved.night) || 1));
    shards = Math.max(0, Math.floor(Number(saved.shards) || 0));
    missionWard = WARDS.includes(saved.missionWard) ? saved.missionWard : null;
    missionInteriorComplete = Boolean(saved.missionInteriorComplete);
    missionComplete = Boolean(saved.missionComplete);
    for (const key of Object.keys(upgrades)) {
      upgrades[key] = Math.max(0, Math.min(MAX_TIER, Math.floor(Number(saved.upgrades?.[key]) || 0)));
    }
    for (const id of WARDS) {
      const source = saved.wards[id];
      if (!source) continue;
      const ward = wards[id];
      ward.hp = Math.max(0, Math.min(CORE_MAX, Number(source.hp) || 0));
      ward.dark = Boolean(source.dark);
      ward.fireIntensity = ward.dark ? 0 : Math.max(0, Math.min(1, Number(source.fireIntensity) || 0));
      ward.residentCount = Math.max(1, Math.min(8, Math.floor(Number(source.residentCount) || 3)));
      ward.rescueCount = Math.max(0, Math.min(ward.residentCount, Math.floor(Number(source.rescueCount) || 0)));
      ward.restoration = Math.max(0, Math.min(1, Number(source.restoration) || 0));
      refreshWard(id, false);
    }
    return true;
  }
  const lit = id => !wards[id].dark;
  const targetCount = () => Math.min(WARDS.length, 1 + Math.floor(night / 2));

  function pickTargets() {
    const pool = WARDS.filter(id => !wards[id].dark);
    const src = pool.length ? pool : WARDS;
    // Dusk previews the same building used by wave one. Later waves rotate.
    const start = (night * 3 + Math.max(0, waveIx - 1)) % src.length;
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
    if (next === 'dusk' && !missionWard) missionWard = targets[0] || focus;
    if (next !== 'wave') saveWardCheckpoint();
  }
  function start() {
    upgrades = { embers: 0, cores: 0, lantern: 0 };
    running = true;
    missionWard = null; missionInteriorComplete = false; missionComplete = false;
    if (!restoreWardCheckpoint()) { wards = freshWards(); night = 1; shards = 0; }
    waveIx = 0;
    enter(missionComplete ? 'complete' : 'briefing'); computeFocus();
  }
  function stop() { running = false; phase = 'idle'; pt = 0; }

  function nearWard(id, wardId, radius = 19) {
    const player = getPlayerState(id)?.p;
    const target = WARD_POSITIONS[wardId];
    return Array.isArray(player) && target
      && Math.hypot(player[0] - target[0], player[1] - target[1], player[2] - target[2]) <= radius;
  }
  function allowAct(id, kind, cooldown) {
    const key = `${id}:${kind}`;
    const time = now();
    if (time - (actTimes.get(key) || -1e9) < cooldown) return false;
    actTimes.set(key, time);
    return true;
  }
  function maybeCompleteMission() {
    if (!missionWard || !missionInteriorComplete || missionComplete) return false;
    const ward = wards[missionWard];
    if (!ward || ward.dark || ward.fireIntensity > 0.02 || ward.restoration < 1) return false;
    missionComplete = true;
    enter('complete');
    return true;
  }
  function refreshWard(id, targeted = targets.includes(id)) {
    const ward = wards[id];
    ward.fireIntensity = Math.max(0, Math.min(1, ward.fireIntensity));
    if (targeted && phase === 'wave' && (ward.fireIntensity > 0.01 || ward.hp < 99)) ward.restoration = 0;
    if (ward.dark) {
      ward.fireIntensity = 0;
      ward.stage = 'scorched';
    } else if (ward.restoration >= 1) ward.stage = 'restored';
    else if (ward.fireIntensity >= 0.7 || ward.hp < 22) ward.stage = 'critical';
    else if (ward.fireIntensity >= 0.34 || ward.hp < 48) ward.stage = 'burning';
    else if (ward.fireIntensity >= 0.12 || ward.hp < 72) ward.stage = 'igniting';
    else if (targeted && (phase === 'dusk' || phase === 'wave')) ward.stage = 'threatened';
    else ward.stage = 'safe';
    const count = ward.stage === 'critical' ? 4 : ward.stage === 'burning' ? 3 : ward.stage === 'igniting' ? 1 : 0;
    ward.affectedSockets = FIRE_SOCKETS.slice(0, count);
  }

  function handle(id, msg) {
    if (!msg || typeof msg.t !== 'string') return;
    if (msg.t === 'siege-join') {
      participants.add(id);
      if (!running) start();
      sendSnapshot();
    } else if (msg.t === 'siege-leave') {
      participants.delete(id);
      if (!participants.size) stop();
    } else if (msg.t === 'siege-act' && running && participants.has(id)) {
      applyAct(id, msg);
    }
  }

  function applyAct(id, msg) {
    if (msg.act === 'cleanse') {
      shards++;
      if (!wards[focus].dark) wards[focus].hp = Math.min(CORE_MAX, wards[focus].hp + CLEANSE_HEAL + upgrades.embers * 2);
    } else if (msg.act === 'stoke' && wards[msg.ward] && !wards[msg.ward].dark) {
      if (!nearWard(id, msg.ward) || !allowAct(id, 'stoke', 150)) return;
      wards[msg.ward].hp = Math.min(CORE_MAX, wards[msg.ward].hp + STOKE_PER_ACT + upgrades.lantern * 0.6);
    } else if (msg.act === 'impact' && wards[msg.ward] && phase === 'wave' && targets.includes(msg.ward)) {
      const ward = wards[msg.ward];
      if (now() - ward.lastImpactAt < 900) return;
      ward.lastImpactAt = now();
      ward.hp = Math.max(0, ward.hp - 7);
      ward.fireIntensity = Math.min(1, ward.fireIntensity + 0.085);
      if (ward.hp <= 0) { ward.dark = true; ward.restoration = 0; }
      refreshWard(msg.ward);
    } else if (msg.act === 'suppress' && wards[msg.ward] && !wards[msg.ward].dark) {
      if (!nearWard(id, msg.ward) || !allowAct(id, 'suppress', 150)) return;
      const ward = wards[msg.ward];
      ward.fireIntensity = Math.max(0, ward.fireIntensity - 0.065 - upgrades.lantern * 0.008);
      ward.hp = Math.min(CORE_MAX, ward.hp + 0.8 + upgrades.lantern * 0.2);
      refreshWard(msg.ward);
      maybeCompleteMission();
    } else if (msg.act === 'rescue' && wards[msg.ward]) {
      const ward = wards[msg.ward];
      if (!nearWard(id, msg.ward) || !allowAct(id, 'rescue', 900)
        || !['burning', 'critical'].includes(ward.stage) || ward.rescueCount >= ward.residentCount) return;
      ward.rescueCount++;
      saveWardCheckpoint();
    } else if (msg.act === 'restore' && wards[msg.ward]) {
      const ward = wards[msg.ward];
      const missionRepair = msg.ward === missionWard && missionInteriorComplete
        && !ward.dark && ward.fireIntensity <= 0.02 && ward.restoration < 1;
      if (!ward.dark && !missionRepair) return;
      if (msg.ward === missionWard && !missionInteriorComplete) return;
      if (!nearWard(id, msg.ward) || !allowAct(id, 'restore', 150) || !['lull', 'dawn', 'day'].includes(phase)) return;
      ward.restoration = Math.min(1, ward.restoration + 0.055 + upgrades.lantern * 0.008);
      ward.hp = Math.max(ward.hp, CORE_MAX * 0.55 * ward.restoration);
      if (ward.restoration >= 1) { ward.dark = false; ward.hp = Math.max(60, ward.hp); }
      refreshWard(msg.ward, false);
      if (!ward.dark) saveWardCheckpoint();
      maybeCompleteMission();
    } else if (msg.act === 'relight' && wards[msg.ward] && wards[msg.ward].dark) {
      if (msg.ward === missionWard && !missionInteriorComplete) return;
      if (!nearWard(id, msg.ward) || !allowAct(id, 'restore', 150) || !['lull', 'dawn', 'day'].includes(phase)) return;
      const w = wards[msg.ward];
      w.restoration = Math.min(1, w.restoration + (RELIGHT_PER_ACT + upgrades.lantern * 0.3) / 50);
      w.hp = Math.min(CORE_MAX, w.hp + RELIGHT_PER_ACT + upgrades.lantern * 0.3);
      if (w.restoration >= 1) { w.dark = false; w.hp = Math.max(60, w.hp); }
      refreshWard(msg.ward, false);
      if (!w.dark) saveWardCheckpoint();
      maybeCompleteMission();
    } else if (msg.act === 'interior-complete' && WARDS.includes(msg.ward)) {
      if (msg.ward !== missionWard || waveIx < 1 || !['dawn', 'day'].includes(phase)
        || !nearWard(id, msg.ward, 20)) return;
      missionInteriorComplete = true;
      saveWardCheckpoint();
      maybeCompleteMission();
    } else if (msg.act === 'upgrade' && upgrades[msg.ward] !== undefined) {
      const tier = upgrades[msg.ward];
      if (tier < MAX_TIER && shards >= upgradeCost(tier)) {
        shards -= upgradeCost(tier); upgrades[msg.ward] = tier + 1; saveWardCheckpoint();
      }
    }
  }

  function tick(dt) {
    if (!running) return;
    pt += dt;
    if (phase === 'complete') { sendSnapshot(); return; }
    const trickle = lit('alchemy') ? MEND_TRICKLE : 0;

    if (phase === 'wave') {
      const drainMul = (lit('practice') ? 0.7 : 1) * ((lit('owlpost') && pt < OWL_GRACE) ? 0 : 1) * (1 - 0.1 * upgrades.cores);
      for (const id of WARDS) {
        const w = wards[id];
        if (w.dark) continue;
        // targeted wards take the tide; others get only the Alchemy mend
        if (targets.includes(id)) w.hp = Math.max(0, w.hp - WAVE_DRAIN * drainMul * dt);
        else if (trickle) w.hp = Math.min(CORE_MAX, w.hp + trickle * dt);
        if (w.hp <= 0) { w.dark = true; w.restoration = 0; }
        refreshWard(id);
      }
    } else {
      const rate = (phase === 'day' ? DAY_RECOVER : LULL_RECOVER) + trickle;
      for (const id of WARDS) {
        const w = wards[id];
        if (!w.dark && w.hp < CORE_MAX) w.hp = Math.min(CORE_MAX, w.hp + rate * dt);
        if (!w.dark) w.fireIntensity = Math.max(0, w.fireIntensity - FIRE_DECAY * dt);
        refreshWard(id, phase === 'dusk' && targets.includes(id));
      }
    }
    computeFocus();

    if (phase === 'briefing' && pt >= BRIEFING_S) enter('deployment');
    else if (phase === 'deployment' && pt >= DEPLOYMENT_S) enter('dusk');
    else if (phase === 'dusk' && pt >= DUSK_S) enter('wave');
    else if (phase === 'wave' && pt >= WAVE_S) enter(waveIx >= WAVES ? 'dawn' : 'lull');
    else if (phase === 'lull' && pt >= LULL_S) enter('wave');
    else if (phase === 'dawn' && pt >= DAWN_S) { night++; enter('day'); }
    // The first integrated mission holds at daylight until the party completes
    // the damaged room objective and restoration instead of looping forever.

    sendSnapshot();
  }

  function snapshot() {
    return {
      t: 'siege', running, night, phase, waveIx, waves: WAVES,
      targets, focus, shards, upgrades: { ...upgrades }, players: participants.size,
      mission: { ward: missionWard, interiorComplete: missionInteriorComplete, complete: missionComplete },
      wards: WARDS.map(id => ({
        id, hp: Math.round(wards[id].hp * 10) / 10, dark: wards[id].dark,
        stage: wards[id].stage,
        fireIntensity: Math.round(wards[id].fireIntensity * 1000) / 1000,
        affectedSockets: [...wards[id].affectedSockets],
        rescueCount: wards[id].rescueCount,
        residentCount: wards[id].residentCount,
        restoration: Math.round(wards[id].restoration * 1000) / 1000
      }))
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

module.exports = { createSiege, WARDS, WARD_POSITIONS, FIRE_SOCKETS };
