export const PRACTICE_START = Object.freeze({ x: 0, z: 3.55 });

export const PRACTICE_TARGET_LAYOUT = Object.freeze([
  { id: 'target-left', x: -3.1, y: 2.25, z: -2.95 },
  { id: 'target-centre', x: 0, y: 2.25, z: -3.65 },
  { id: 'target-right', x: 3.1, y: 2.25, z: -2.95 }
]);

export const PRACTICE_ROUNDS = Object.freeze([
  { dangerLane: 'left', targetId: 'target-right' },
  { dangerLane: 'right', targetId: 'target-left' },
  { dangerLane: 'centre', targetId: 'target-centre' }
]);

const TELEGRAPH_SECONDS = 1.6;
const RETRY_SECONDS = 1.9;
const COUNTER_SECONDS = 5;
const REPLAY_COOLDOWN = 18;

const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createPracticeRoomExperience({ tr, storyCard, game, reportProgress = () => false }) {
  let phase = 'idle';
  let round = 0;
  let timer = 0;
  let clears = 0;
  let misses = 0;
  let replayCooldown = 0;
  let firstCompletionRewarded = false;

  const currentRound = () => PRACTICE_ROUNDS[Math.min(round, PRACTICE_ROUNDS.length - 1)];
  const complete = () => clears >= PRACTICE_ROUNDS.length;
  const laneName = lane => ({
    left: tr('left lane', '左側路線'),
    right: tr('right lane', '右側路線'),
    centre: tr('centre lane', '中央路線')
  })[lane];
  const targetName = id => ({
    'target-left': tr('left counter target', '左側反擊靶'),
    'target-centre': tr('centre counter target', '中央反擊靶'),
    'target-right': tr('right counter target', '右側反擊靶')
  })[id];

  function safeFromDanger(position, lane) {
    if (!position) return false;
    if (lane === 'left') return position.x > 0.65;
    if (lane === 'right') return position.x < -0.65;
    return Math.abs(position.x) > 1.8;
  }

  function begin() {
    phase = 'telegraph';
    round = 0;
    clears = 0;
    misses = 0;
    timer = TELEGRAPH_SECONDS;
    storyCard(
      tr('Read the floor before you cast.', '施法前先讀懂地面提示。'),
      tr('leave the glowing attack lane · then strike the named target', '離開發光攻擊路線 · 再命中指定反擊靶')
    );
  }

  function interactionPrompt(localPosition) {
    const distance = distance2D(localPosition, PRACTICE_START);
    const nearby = distance <= 2.15;
    if (phase === 'telegraph') return {
      action: tr('Dodge', '閃避'),
      target: laneName(currentRound().dangerLane),
      detail: tr(`${timer.toFixed(1)} s · leave the glowing lane`, `${timer.toFixed(1)} 秒 · 離開發光路線`),
      blocked: true
    };
    if (phase === 'counter') return {
      action: tr('Counter', '反擊'),
      target: targetName(currentRound().targetId),
      detail: tr(`${timer.toFixed(1)} s · cast now`, `${timer.toFixed(1)} 秒 · 現在施法`),
      blocked: true
    };
    const cooling = complete() && replayCooldown > 0;
    return {
      action: complete() ? tr('Replay drill', '重玩訓練') : tr('Start drill', '開始訓練'),
      target: tr('Practice Warden', '演武守衛'),
      detail: !nearby
        ? tr(`${distance.toFixed(1)} m · move to the gold circle`, `${distance.toFixed(1)} 公尺 · 前往金色圓環`)
        : cooling
          ? tr(`drill resetting · ${Math.ceil(replayCooldown)} s`, `訓練重置中 · ${Math.ceil(replayCooldown)} 秒`)
          : tr(`${clears} / ${PRACTICE_ROUNDS.length} rounds · ready`, `${clears} / ${PRACTICE_ROUNDS.length} 回合 · 可開始`),
      blocked: !nearby || cooling
    };
  }

  function interact(localPosition) {
    const prompt = interactionPrompt(localPosition);
    if (prompt.blocked) return false;
    begin();
    return true;
  }

  function finish() {
    phase = 'complete';
    timer = 0;
    replayCooldown = REPLAY_COOLDOWN;
    reportProgress('complete', true);
    if (!firstCompletionRewarded) {
      firstCompletionRewarded = true;
      game.hp = Math.min(game.maxHp, game.hp + 12);
      game.roleState.signatureCharge = Math.min(1, game.roleState.signatureCharge + 0.18);
    }
    storyCard(
      tr('Three tells read. Three counters answered.', '三次讀招，三次反擊。'),
      tr('Practice Hall complete · sparring replay unlocked', '演武堂完成 · 已解鎖重玩訓練')
    );
  }

  function onTargetHit(targetId) {
    if (phase !== 'counter' || targetId !== currentRound().targetId) return false;
    clears++;
    round++;
    if (complete()) finish();
    else {
      phase = 'telegraph';
      timer = TELEGRAPH_SECONDS;
      storyCard(
        tr(`Counter ${clears} / ${PRACTICE_ROUNDS.length}`, `反擊 ${clears} / ${PRACTICE_ROUNDS.length}`),
        tr(`next tell · ${laneName(currentRound().dangerLane)}`, `下一次出招 · ${laneName(currentRound().dangerLane)}`)
      );
    }
    return true;
  }

  function tick(dt, _threat = null, localPosition = null) {
    replayCooldown = Math.max(0, replayCooldown - dt);
    if (!localPosition || (phase !== 'telegraph' && phase !== 'counter')) return;
    timer = Math.max(0, timer - dt);
    if (timer > 0) return;
    if (phase === 'telegraph') {
      if (safeFromDanger(localPosition, currentRound().dangerLane)) {
        phase = 'counter';
        timer = COUNTER_SECONDS;
        storyCard(
          tr('Clean dodge. Counter now.', '成功閃避，現在反擊。'),
          targetName(currentRound().targetId)
        );
      } else {
        misses++;
        timer = RETRY_SECONDS;
        storyCard(
          tr('The marked lane was struck.', '標記路線遭到攻擊。'),
          tr('read the glow and move before the ring closes', '讀取光芒並在圓環閉合前移動')
        );
      }
    } else {
      misses++;
      phase = 'telegraph';
      timer = RETRY_SECONDS;
      storyCard(
        tr('Counter window closed.', '反擊時機已結束。'),
        tr('the same tell will repeat', '相同招式將再次出現')
      );
    }
  }

  return {
    tick,
    interact,
    interactionPrompt,
    onTargetHit,
    applySharedProgress(items = []) {
      if (!new Set(items).has('complete')) return;
      clears = PRACTICE_ROUNDS.length;
      round = PRACTICE_ROUNDS.length;
      phase = 'complete';
      firstCompletionRewarded = true;
    },
    targetActive: targetId => phase === 'counter' && currentRound().targetId === targetId,
    get phase() { return phase; },
    get dangerLane() { return phase === 'telegraph' ? currentRound().dangerLane : null; },
    get activeTargetId() { return phase === 'counter' ? currentRound().targetId : null; },
    get timer() { return timer; },
    get telegraphPower() {
      return phase === 'telegraph' ? 1 - Math.min(1, timer / TELEGRAPH_SECONDS) : 0;
    },
    state: () => ({
      phase,
      round,
      clears,
      misses,
      total: PRACTICE_ROUNDS.length,
      complete: complete(),
      dangerLane: phase === 'telegraph' ? currentRound().dangerLane : null,
      activeTargetId: phase === 'counter' ? currentRound().targetId : null,
      timer: Number(timer.toFixed(2)),
      replayCooldown: Number(replayCooldown.toFixed(2))
    })
  };
}
