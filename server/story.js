/* The Twelfth Bell — server-authoritative Story party and chapter state. */

const STORY_VERSION = 3;
const RELIC_IDS = new Set(['photograph', 'letter', 'watch']);
const INCIDENTS = Object.freeze({
  'archive-slate': [-12, 1.6, -68],
  'bell-rope': [0, 1.6, -73],
  'mara-satchel': [12, 1.6, -68]
});
const VOTE_CHOICES = new Set(['mara', 'warden', 'campus']);
const GARDEN_CHOICES = new Set(['restore', 'break']);
const BLACK_GARDEN_ENTRY = [0, 1.6, -76];
const BLACK_GARDEN_CENTER = [92, 1.6, 86];
const BLACK_GARDEN_RELAYS = Object.freeze({
  root: [82, 1.6, 86],
  canopy: [92, 10, 79],
  well: [102, 1.6, 86]
});
const PING_KINDS = new Set(['look', 'danger', 'help', 'wait', 'ready']);
const OPENING_MEMORY = [0, 1.05, 19];
const CLOISTER_EXIT = [0, 8, -54];
const ACTION_CACHE_MS = 2 * 60 * 1000;
const CHECKPOINTS = Object.freeze({
  'petal-trail': [-8, 1.6, 31],
  'flight-unlocked': [0, 1.6, 19],
  'memory-reconstructed': [0, 13.6, 0],
  'cloister-restored': [15, 1.6, -19],
  'bell-warden-revealed': [0, 1.6, -54],
  'clue-board': [0, 1.6, -70],
  'names-restored': [0, 1.6, -70],
  'black-garden-entry': [92, 1.6, 99],
  'lantern-relays': [92, 1.6, 99],
  'groundskeeper': [92, 1.6, 99],
  'garden-choice': [92, 1.6, 99],
  'campus-restored': [15, 1.6, -19]
});

function createStory({ sendTo, getPlayerState, getPlayerInfo = () => null, now = () => Date.now(), schedule = setTimeout }) {
  const participants = new Map();
  const seenActions = new Map();
  let hostId = null;
  let runNumber = 1;
  let rekindlePending = false;
  let state = freshState();

  function freshState() {
    return {
      version: STORY_VERSION, runId: `twelfth-bell-${runNumber}`, started: false,
      phase: 0, chapter: 'prologue', checkpoint: 'petal-trail', memoryRecovered: false,
      relics: new Set(), cleansed: 0, encounterComplete: false, prologueComplete: false,
      incidents: new Set(), votes: new Map(), choice: null, chapterOneComplete: false,
      relays: new Set(), bossHp: 0, bossMaxHp: 0, bossStage: 0,
      gardenVotes: new Map(), gardenOutcome: null, chapterTwoComplete: false,
      completed: false, updatedAt: now()
    };
  }

  function partyList() {
    return [...participants].map(([id, player]) => {
      const info = getPlayerInfo(id) || {};
      return { id, name: info.name || `Lantern ${id}`, character: info.character || 'resident-01',
        color: info.color || '#e8b06a', ready: player.ready, dimmed: player.dimmed, host: id === hostId,
        voted: state.phase === 5 ? state.votes.has(id) : state.phase === 9 ? state.gardenVotes.has(id) : false };
    });
  }

  function snapshot(cause = 'sync', actor = null) {
    return { t: 'story-state', version: state.version, runId: state.runId, started: state.started,
      phase: state.phase, chapter: state.chapter, checkpoint: state.checkpoint,
      memoryRecovered: state.memoryRecovered, relics: [...state.relics], relicCount: state.relics.size,
      relicNeeded: RELIC_IDS.size, cleansed: state.cleansed, encounterComplete: state.encounterComplete,
      prologueComplete: state.prologueComplete, incidents: [...state.incidents], incidentCount: state.incidents.size,
      incidentNeeded: Object.keys(INCIDENTS).length, voteOpen: state.phase === 5 && !state.choice,
      votesCast: state.votes.size, choice: state.choice, chapterOneComplete: state.chapterOneComplete,
      relays: [...state.relays], relayCount: state.relays.size, relayNeeded: Object.keys(BLACK_GARDEN_RELAYS).length,
      echoHeld: participants.size === 1 && state.relays.size > 0 && state.phase === 7,
      bossHp: state.bossHp, bossMaxHp: state.bossMaxHp, bossStage: state.bossStage,
      gardenVoteOpen: state.phase === 9 && !state.gardenOutcome, gardenVotesCast: state.gardenVotes.size,
      gardenOutcome: state.gardenOutcome, chapterTwoComplete: state.chapterTwoComplete,
      checkpointPosition: checkpointPosition(),
      completed: state.completed, hostId, party: partyList(), partySize: participants.size,
      cause, actor, updatedAt: state.updatedAt };
  }

  const sendStory = message => { for (const id of participants.keys()) sendTo(id, message); };
  function broadcastState(cause, actor) { state.updatedAt = now(); sendStory(snapshot(cause, actor)); }

  function cleanActions() {
    const cutoff = now() - ACTION_CACHE_MS;
    for (const [actionId, createdAt] of seenActions) if (createdAt < cutoff) seenActions.delete(actionId);
  }
  function acceptAction(id, message) {
    const actionId = String(message.actionId || '').slice(0, 80);
    if (!actionId || seenActions.has(actionId) || !participants.has(id)) return false;
    cleanActions(); seenActions.set(actionId, now()); return true;
  }
  function near(id, target, radius) {
    const p = getPlayerState(id)?.p;
    return Array.isArray(p) && p.length === 3
      && Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]) <= radius;
  }
  function playersNear(a, b, radius) {
    const ap = getPlayerState(a)?.p, bp = getPlayerState(b)?.p;
    return Array.isArray(ap) && Array.isArray(bp)
      && Math.hypot(ap[0] - bp[0], ap[1] - bp[1], ap[2] - bp[2]) <= radius;
  }
  function chooseFragment() {
    const counts = [0, 0, 0, 0];
    for (const p of participants.values()) counts[p.fragment]++;
    return counts.indexOf(Math.min(...counts));
  }

  function join(id, message = {}) {
    if (!participants.has(id)) participants.set(id, {
      fragment: chooseFragment(), joinedAt: now(), ready: state.started, dimmed: false,
      lastPingAt: 0, lastBossHitAt: 0, qa: Boolean(message.qa)
    });
    else if (message.qa) participants.get(id).qa = true;
    if (!hostId || !participants.has(hostId)) hostId = id;
    const p = participants.get(id);
    sendTo(id, { t: 'story-fragment', runId: state.runId, fragment: p.fragment });
    broadcastState('party-change', id);
  }
  function leave(id) {
    if (!participants.delete(id)) return;
    state.votes.delete(id);
    state.gardenVotes.delete(id);
    if (hostId === id) hostId = participants.keys().next().value || null;
    maybeResolveVote();
    maybeResolveGardenVote();
    broadcastState('party-change', id);
  }
  function ready(id, message) {
    const p = participants.get(id); if (!p || state.started) return;
    p.ready = Boolean(message.ready); broadcastState('party-ready', id);
  }
  function start(id) {
    if (id !== hostId || state.started || !participants.size) return;
    if ([...participants.values()].some(p => !p.ready)) return;
    state.started = true; broadcastState('party-start', id);
  }

  function checkpointPosition() { return CHECKPOINTS[state.checkpoint] || CHECKPOINTS['petal-trail']; }
  function maybePartyWipe() {
    if (rekindlePending || !participants.size || [...participants.values()].some(p => !p.dimmed)) return;
    rekindlePending = true;
    schedule(() => {
      rekindlePending = false;
      for (const p of participants.values()) p.dimmed = false;
      sendStory({ t: 'story-party-rekindle', checkpoint: state.checkpoint, position: checkpointPosition() });
      broadcastState('party-rekindle');
    }, 1400);
  }
  function setDimmed(id) {
    const p = participants.get(id); if (!p || p.dimmed || !state.started) return;
    p.dimmed = true;
    sendStory({ t: 'story-player', id, dimmed: true });
    broadcastState('player-dimmed', id);
    maybeResolveVote();
    maybeResolveGardenVote();
    maybePartyWipe();
  }
  function revive(id, targetId) {
    const actor = participants.get(id), target = participants.get(targetId);
    if (!actor || actor.dimmed || !target?.dimmed || !playersNear(id, targetId, 5.2)) return;
    target.dimmed = false;
    sendStory({ t: 'story-player', id: targetId, dimmed: false, revivedBy: id, hp: 55 });
    broadcastState('player-revived', id);
  }

  function maybeResolveVote() {
    if (state.phase !== 5 || state.choice || !participants.size) return;
    const active = [...participants].filter(([, p]) => !p.dimmed).map(([id]) => id);
    if (!active.length || active.some(id => !state.votes.has(id))) return;
    const counts = { mara: 0, warden: 0, campus: 0 };
    for (const id of active) counts[state.votes.get(id)]++;
    const best = Math.max(...Object.values(counts));
    const tied = Object.keys(counts).filter(choice => counts[choice] === best);
    state.choice = tied.includes(state.votes.get(hostId)) ? state.votes.get(hostId) : tied[0];
    state.phase = 6; state.checkpoint = 'names-restored'; state.chapterOneComplete = true;
    broadcastState('vote-resolved', hostId);
  }
  function vote(id, message) {
    const choice = String(message.choice || '');
    if (state.phase !== 5 || !VOTE_CHOICES.has(choice) || participants.get(id)?.dimmed) return;
    state.votes.set(id, choice); broadcastState('story-vote', id); maybeResolveVote();
  }

  function maybeResolveGardenVote() {
    if (state.phase !== 9 || state.gardenOutcome || !participants.size) return;
    const active = [...participants].filter(([, p]) => !p.dimmed).map(([id]) => id);
    if (!active.length || active.some(id => !state.gardenVotes.has(id))) return;
    const counts = { restore: 0, break: 0 };
    for (const id of active) counts[state.gardenVotes.get(id)]++;
    const best = Math.max(counts.restore, counts.break);
    const tied = Object.keys(counts).filter(choice => counts[choice] === best);
    const hostChoice = state.gardenVotes.get(hostId);
    state.gardenOutcome = tied.includes(hostChoice) ? hostChoice : tied[0];
    state.phase = 10; state.checkpoint = 'campus-restored'; state.chapterTwoComplete = true;
    broadcastState('garden-vote-resolved', hostId);
  }
  function gardenVote(id, message) {
    const choice = String(message.choice || '');
    if (state.phase !== 9 || !GARDEN_CHOICES.has(choice) || participants.get(id)?.dimmed) return;
    state.gardenVotes.set(id, choice); broadcastState('garden-vote', id); maybeResolveGardenVote();
  }
  function ping(id, message) {
    const p = participants.get(id), kind = String(message.kind || '');
    if (!p || !state.started || p.dimmed || !PING_KINDS.has(kind) || now() - p.lastPingAt < 900) return;
    const position = getPlayerState(id)?.p;
    if (!Array.isArray(position)) return;
    p.lastPingAt = now();
    sendStory({ t: 'story-ping', id, name: getPlayerInfo(id)?.name || `Lantern ${id}`, kind,
      p: position.slice(0, 3).map(v => Math.max(-500, Math.min(500, Number(v) || 0))), at: now() });
  }

  function act(id, message) {
    if (!acceptAction(id, message)) return;
    const action = String(message.action || '');
    if (action === 'become-dimmed') { setDimmed(id); return; }
    if (action === 'revive-player') { revive(id, String(message.target || '')); return; }
    if (!state.started || participants.get(id)?.dimmed) return;

    // Query-gated local QA clients can enter Chapter II with one authoritative
    // transition. This avoids browser/Mac function-key conflicts and cannot be
    // invoked by a normal Story client because `qa` is recorded at join time.
    if (action === 'qa-enter-black-garden' && participants.get(id)?.qa) {
      state.memoryRecovered = true;
      state.relics = new Set(RELIC_IDS);
      state.cleansed = 1;
      state.encounterComplete = true;
      state.prologueComplete = true;
      state.incidents = new Set(Object.keys(INCIDENTS));
      state.choice = 'mara';
      state.chapterOneComplete = true;
      state.relays.clear();
      state.bossHp = 0; state.bossMaxHp = 0; state.bossStage = 0;
      state.gardenVotes.clear(); state.gardenOutcome = null; state.chapterTwoComplete = false;
      state.phase = 7; state.chapter = 'the-black-garden'; state.checkpoint = 'black-garden-entry';
      broadcastState(action, id); return;
    }

    if (action === 'recover-opening' && state.phase === 0 && near(id, OPENING_MEMORY, 5.25)) {
      state.phase = 1; state.checkpoint = 'flight-unlocked'; state.memoryRecovered = true;
      broadcastState(action, id); return;
    }
    if (action === 'recover-relic' && state.phase === 1) {
      const relic = String(message.relic || '');
      if (!RELIC_IDS.has(relic) || state.relics.has(relic)) return;
      state.relics.add(relic);
      if (state.relics.size === RELIC_IDS.size) { state.phase = 2; state.checkpoint = 'memory-reconstructed'; }
      broadcastState(action, id); return;
    }
    if (action === 'cleanse-stray' && state.phase === 2) {
      state.cleansed = 1; state.phase = 3; state.checkpoint = 'cloister-restored'; state.encounterComplete = true;
      broadcastState(action, id); return;
    }
    if (action === 'enter-cloister' && state.phase === 3 && near(id, CLOISTER_EXIT, 12)) {
      state.phase = 4; state.chapter = 'names-in-the-cloister'; state.checkpoint = 'bell-warden-revealed';
      state.prologueComplete = true; broadcastState(action, id); return;
    }
    if (action === 'investigate-incident' && state.phase === 4) {
      const incident = String(message.incident || ''), position = INCIDENTS[incident];
      if (!position || state.incidents.has(incident) || !near(id, position, 5.5)) return;
      state.incidents.add(incident);
      if (state.incidents.size === Object.keys(INCIDENTS).length) { state.phase = 5; state.checkpoint = 'clue-board'; }
      broadcastState(action, id); return;
    }
    if (action === 'enter-black-garden' && state.phase === 6 && near(id, BLACK_GARDEN_ENTRY, 8)) {
      state.phase = 7; state.chapter = 'the-black-garden'; state.checkpoint = 'black-garden-entry';
      broadcastState(action, id); return;
    }
    if (action === 'charge-garden-relay' && state.phase === 7) {
      const relay = String(message.relay || ''), position = BLACK_GARDEN_RELAYS[relay];
      if (!position || state.relays.has(relay) || !near(id, position, 5.4)) return;
      state.relays.add(relay);
      if (state.relays.size === Object.keys(BLACK_GARDEN_RELAYS).length) {
        state.phase = 8; state.checkpoint = 'groundskeeper';
        state.bossMaxHp = 12 + Math.max(0, participants.size - 1) * 5;
        state.bossHp = state.bossMaxHp; state.bossStage = 1;
      } else state.checkpoint = 'lantern-relays';
      broadcastState(action, id); return;
    }
    if (action === 'groundskeeper-hit' && state.phase === 8) {
      const participant = participants.get(id);
      if (!participant || !near(id, BLACK_GARDEN_CENTER, 38)) return;
      const weapon = Math.max(1, Math.min(3, Number(message.weapon) || 1));
      const cooldown = weapon === 2 ? 55 : weapon === 3 ? 420 : 150;
      if (now() - participant.lastBossHitAt < cooldown) return;
      participant.lastBossHitAt = now();
      const power = Math.max(0, Math.min(1, Number(message.power) || 0));
      const damage = weapon === 3 ? 1.5 + power * 1.5 : weapon === 2 ? 0.55 : 1;
      state.bossHp = Math.max(0, state.bossHp - damage);
      state.bossStage = state.bossHp <= state.bossMaxHp * 0.55 ? 2 : 1;
      if (state.bossHp <= state.bossMaxHp * 0.2) {
        state.phase = 9; state.checkpoint = 'garden-choice';
      }
      broadcastState(action, id); return;
    }
    if (action === 'restart-prologue' && state.chapterOneComplete) {
      runNumber++; state = freshState(); let index = 0;
      for (const p of participants.values()) { p.fragment = index++ % 4; p.ready = false; p.dimmed = false; }
      for (const [playerId, p] of participants) sendTo(playerId, { t: 'story-fragment', runId: state.runId, fragment: p.fragment });
      broadcastState(action, id);
    }
  }

  function handle(id, message) {
    if (message.t === 'story-join') return join(id, message);
    if (message.t === 'story-leave') return leave(id);
    if (message.t === 'story-ready') return ready(id, message);
    if (message.t === 'story-start') return start(id);
    if (message.t === 'story-ping') return ping(id, message);
    if (message.t === 'story-vote') return vote(id, message);
    if (message.t === 'story-garden-vote') return gardenVote(id, message);
    if (message.t === 'story-act') act(id, message);
  }

  return { handle, leave, hasParticipant: id => participants.has(id), getSnapshot: () => snapshot('inspect') };
}

module.exports = { createStory };
