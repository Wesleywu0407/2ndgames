export const ALCHEMY_START = Object.freeze({ x: 0, z: 4.25 });

export const ALCHEMY_VAT_LAYOUT = Object.freeze([
  { id: 'solar-vat', x: 0, y: 1.08, z: -3.6, sequence: [1, 2, 3] },
  { id: 'lunar-vat', x: 0, y: 1.08, z: 1.8, sequence: [3, 2, 1] }
]);

const REPLAY_COOLDOWN = 20;
const INPUT_COOLDOWN = 0.24;
const HAZARD_THRESHOLD = 0.65;
const HAZARD_RANGE = 1.9;

const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createAlchemyRoomExperience({ tr, storyCard, game, reportProgress = () => false }) {
  const vats = ALCHEMY_VAT_LAYOUT.map(layout => ({
    ...layout,
    sequence: [...layout.sequence],
    progress: 0,
    stabilized: false,
    pulse: 0
  }));
  let phase = 'idle';
  let activeVatIndex = 0;
  let volatility = 0;
  let replayCooldown = 0;
  let inputCooldown = 0;
  let hazardCooldown = 0;
  let hazardHits = 0;
  let firstCompletionRewarded = false;

  const complete = () => vats.every(vat => vat.stabilized);
  const activeVat = () => vats[Math.min(activeVatIndex, vats.length - 1)];
  const vatName = id => id === 'solar-vat'
    ? tr('Solar crucible', '日耀坩堝')
    : tr('Lunar crucible', '月華坩堝');
  const weaponName = weapon => ({
    1: tr('1 · precision / bell', '1 · 精準／鐘鳴'),
    2: tr('2 · scatter', '2 · 星屑'),
    3: tr('3 · moonbow', '3 · 月弓')
  })[weapon];
  const expectedWeapon = () => {
    const vat = activeVat();
    return vat?.sequence[vat.progress] || null;
  };

  function begin() {
    for (const vat of vats) {
      vat.progress = 0;
      vat.stabilized = false;
      vat.pulse = 0;
    }
    phase = 'reacting';
    activeVatIndex = 0;
    volatility = 0;
    inputCooldown = 0;
    hazardCooldown = 0;
    hazardHits = 0;
    storyCard(
      tr('The recipe is a weapon sequence.', '配方是一組武器順序。'),
      tr('strike only the glowing crucible · follow the numbered reagent light', '只攻擊發光坩堝 · 依照藥劑燈的數字順序')
    );
  }

  function interactionPrompt(localPosition) {
    if (phase === 'reacting') {
      const vat = activeVat();
      return {
        action: tr('Stabilize', '穩定反應'),
        target: vatName(vat.id),
        detail: tr(
          `${vat.progress} / ${vat.sequence.length} · use ${weaponName(expectedWeapon())}${volatility >= HAZARD_THRESHOLD ? ' · fumes dangerous' : ''}`,
          `${vat.progress} / ${vat.sequence.length} · 使用 ${weaponName(expectedWeapon())}${volatility >= HAZARD_THRESHOLD ? ' · 煙霧危險' : ''}`
        ),
        blocked: true
      };
    }
    const distance = distance2D(localPosition, ALCHEMY_START);
    const nearby = distance <= 2.1;
    const cooling = complete() && replayCooldown > 0;
    return {
      action: complete() ? tr('Repeat recipe', '重做配方') : tr('Begin recipe', '開始配方'),
      target: tr("Alchemist's reagent circle", '煉金師藥劑圓環'),
      detail: !nearby
        ? tr(`${distance.toFixed(1)} m · move to the green circle`, `${distance.toFixed(1)} 公尺 · 前往綠色圓環`)
        : cooling
          ? tr(`reagents recovering · ${Math.ceil(replayCooldown)} s`, `藥劑恢復中 · ${Math.ceil(replayCooldown)} 秒`)
          : tr('ready · switch weapons with 1, 2, 3', '可開始 · 使用 1、2、3 切換武器'),
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
    replayCooldown = REPLAY_COOLDOWN;
    volatility = 0;
    if (!firstCompletionRewarded) {
      firstCompletionRewarded = true;
      game.hp = Math.min(game.maxHp, game.hp + 10);
      game.roleState.signatureCharge = Math.min(1, game.roleState.signatureCharge + 0.15);
    }
    storyCard(
      tr('The two crucibles breathe in balance.', '兩座坩堝恢復平衡。'),
      tr('Workshop complete · repeat recipe unlocked', '煉金工坊完成 · 已解鎖重做配方')
    );
  }

  function onWeaponHit(vatId, weapon) {
    if (phase !== 'reacting' || activeVat().id !== vatId) return false;
    if (inputCooldown > 0) return true;
    inputCooldown = INPUT_COOLDOWN;
    const vat = activeVat();
    const expected = expectedWeapon();
    vat.pulse = 1;
    if (weapon !== expected) {
      vat.progress = Math.max(0, vat.progress - 1);
      volatility = Math.min(1, volatility + 0.34);
      storyCard(
        tr('The reagent rejects that spell.', '藥劑排斥了這道法術。'),
        tr(`volatility rising · next use ${weaponName(vat.sequence[vat.progress])}`, `揮發度上升 · 下一步使用 ${weaponName(vat.sequence[vat.progress])}`)
      );
      return true;
    }

    vat.progress++;
    volatility = Math.max(0, volatility - 0.18);
    if (vat.progress >= vat.sequence.length) {
      vat.stabilized = true;
      activeVatIndex++;
      reportProgress(vat.id, complete());
      if (complete()) finish();
      else storyCard(
        tr(`${vatName(vat.id)} stabilized.`, `${vatName(vat.id)}已穩定。`),
        tr(`continue at ${vatName(activeVat().id)} · begin with ${weaponName(expectedWeapon())}`, `前往${vatName(activeVat().id)} · 先使用 ${weaponName(expectedWeapon())}`)
      );
    } else {
      storyCard(
        tr('Reaction held.', '反應已穩住。'),
        tr(`next reagent · ${weaponName(expectedWeapon())}`, `下一種藥劑 · ${weaponName(expectedWeapon())}`)
      );
    }
    return true;
  }

  function tick(dt, _threat = null, localPosition = null) {
    replayCooldown = Math.max(0, replayCooldown - dt);
    inputCooldown = Math.max(0, inputCooldown - dt);
    hazardCooldown = Math.max(0, hazardCooldown - dt);
    for (const vat of vats) vat.pulse = Math.max(0, vat.pulse - dt * 2.4);
    if (phase !== 'reacting') return;
    volatility = Math.max(0, volatility - dt * 0.018);
    if (!localPosition || volatility < HAZARD_THRESHOLD || hazardCooldown > 0) return;
    if (distance2D(localPosition, activeVat()) > HAZARD_RANGE) return;
    hazardCooldown = 2.5;
    hazardHits++;
    game.hp = Math.max(1, game.hp - 6);
    storyCard(
      tr('Volatile fumes scorch your lantern.', '揮發煙霧灼傷了你的提燈。'),
      tr('step away from the crucible and correct the sequence', '離開坩堝並修正武器順序')
    );
  }

  return {
    vats,
    tick,
    interact,
    interactionPrompt,
    onWeaponHit,
    applySharedProgress(items = []) {
      const shared = new Set(items);
      for (const vat of vats) {
        if (!shared.has(vat.id)) continue;
        vat.stabilized = true;
        vat.progress = vat.sequence.length;
      }
      activeVatIndex = vats.findIndex(vat => !vat.stabilized);
      if (activeVatIndex < 0) {
        activeVatIndex = vats.length;
        phase = 'complete';
        volatility = 0;
        firstCompletionRewarded = true;
      } else if (phase === 'idle') phase = 'reacting';
    },
    vatActive: id => phase === 'reacting' && activeVat().id === id,
    get phase() { return phase; },
    get volatility() { return volatility; },
    get activeVatId() { return phase === 'reacting' ? activeVat().id : null; },
    get expectedWeapon() { return phase === 'reacting' ? expectedWeapon() : null; },
    state: () => ({
      phase,
      activeVatId: phase === 'reacting' ? activeVat().id : null,
      expectedWeapon: phase === 'reacting' ? expectedWeapon() : null,
      stabilized: vats.filter(vat => vat.stabilized).length,
      total: vats.length,
      progress: vats.map(vat => vat.progress),
      complete: complete(),
      volatility: Number(volatility.toFixed(3)),
      hazardActive: volatility >= HAZARD_THRESHOLD,
      hazardHits,
      replayCooldown: Number(replayCooldown.toFixed(2))
    })
  };
}
