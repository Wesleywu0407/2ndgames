import { playableCharacter } from './characters/manifest.js';

/**
 * Installs the deterministic Sky Room QA panel and keyboard shortcuts.
 *
 * This module is loaded only when a QA query flag is present, keeping test
 * orchestration out of the normal game bundle and the main runtime file.
 */
export function installSkyRoomQaControls({
  renderer, camera, ctrl, game, siege, GAME, skyMultiplayer, getMode,
  tr, storyCard, HALL, GROUND_Y, EXPLORABLES, STORY_START, avatar, settings
}) {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  const enterBlackGarden = async () => {
    if (getMode() !== 'story') {
      storyCard(tr('Start STORY first.', '請先進入故事模式。'),
        tr('choose a character, ready, and start the session', '選擇角色、準備，然後開始故事'), 3000);
      return;
    }
    if (skyMultiplayer.connected && skyMultiplayer.inStory) {
      skyMultiplayer.storyAct('qa-enter-black-garden');
      await delay(700);
      return;
    }
    if (GAME.phase === 0) {
      ctrl.setPositionForQA(0, 1.6, 19);
      await delay(180); skyMultiplayer.storyAct('recover-opening'); await delay(380);
    }
    if (GAME.phase === 1) {
      for (const relic of ['photograph', 'letter', 'watch']) {
        skyMultiplayer.storyAct('recover-relic', { relic });
        await delay(140);
      }
      await delay(320);
    }
    if (GAME.phase === 2) {
      skyMultiplayer.storyAct('cleanse-stray');
      await delay(420);
    }
    if (GAME.phase === 3) {
      ctrl.setPositionForQA(0, 8, -54);
      await delay(180); skyMultiplayer.storyAct('enter-cloister'); await delay(420);
    }
    if (GAME.phase === 4) {
      for (const [incident, x, y, z] of [
        ['archive-slate', -12, 1.6, -68],
        ['bell-rope', 0, 1.6, -73],
        ['mara-satchel', 12, 1.6, -68]
      ]) {
        ctrl.setPositionForQA(x, y, z);
        await delay(190);
        skyMultiplayer.storyAct('investigate-incident', { incident });
        await delay(360);
      }
      await delay(320);
    }
    if (GAME.phase === 5) {
      skyMultiplayer.storyVote('mara');
      await delay(520);
      if (GAME.phase === 5) {
        storyCard(tr('Every connected lantern must choose first.', '每一位已連線的提燈者都必須先投票。'),
          tr('ask each player to press this button once', '請每位玩家都按一次這個按鈕'), 4200);
        return;
      }
    }
    if (GAME.phase === 6) {
      ctrl.setPositionForQA(0, 1.6, -76);
      await delay(200); skyMultiplayer.storyAct('enter-black-garden'); await delay(520);
    }
  };

  const chargeGarden = async () => {
    if (GAME.phase !== 7) return enterBlackGarden();
    for (const [relay, x, y, z, flying] of [
      ['canopy', 92, 10, 79, true],
      ['root', 82, 1.6, 86, false],
      ['well', 102, 1.6, 86, false]
    ]) {
      if (flying) ctrl.setFlyingPositionForQA(x, y, z);
      else ctrl.setPositionForQA(x, y, z);
      await delay(210);
      skyMultiplayer.storyAct('charge-garden-relay', { relay });
      await delay(420);
    }
  };

  const defeatGroundskeeper = async () => {
    if (GAME.phase !== 8) return;
    ctrl.setFlyingPositionForQA(92, 3.2, 99);
    for (let index = 0; index < 8 && GAME.phase === 8; index++) {
      skyMultiplayer.storyAct('groundskeeper-hit', { weapon: 3, power: 1 });
      await delay(470);
    }
  };

  const cameraEntrances = async () => {
    const sample = label => ({
      label,
      profile: renderer.domElement.dataset.cameraProfile || '',
      cameraDistance: Number(camera.position.distanceTo(ctrl.pos).toFixed(2)),
      locomotion: ctrl.state
    });
    const results = [];
    const visit = async (label, outside, inside) => {
      ctrl.setPositionForQA(...outside);
      await delay(220);
      results.push(sample(`${label}:outside`));
      ctrl.setPositionForQA(...inside);
      await delay(220);
      results.push(sample(`${label}:inside`));
    };
    await visit('great-hall',
      [HALL.x, GROUND_Y, HALL.z + HALL.d * 0.5 + 2.2],
      [HALL.x, GROUND_Y, HALL.z + HALL.d * 0.5 - 2.2]);
    for (const def of EXPLORABLES) {
      const worldAt = localZ => {
        const sin = Math.sin(def.ry);
        const cos = Math.cos(def.ry);
        return [def.x + localZ * sin, GROUND_Y, def.z + localZ * cos];
      };
      await visit(def.id, worldAt(8.2), worldAt(4.7));
    }
    console.info('[Sky QA] entrance cameras', JSON.stringify(results));
    storyCard(tr('Entrance camera sweep complete.', '入口鏡頭巡檢完成。'),
      tr('Great Hall and five campus rooms checked', '已檢查大廳與五座校園房間'), 3600);
  };

  const greatHallEntry = async () => {
    const front = HALL.z + HALL.d * 0.5;
    const route = [
      ['terrain', front + 4.5, GROUND_Y],
      ['low-step', front + 3, GROUND_Y + 0.45],
      ['middle-step', front + 1.85, GROUND_Y + 0.8],
      ['high-step', front + 0.7, GROUND_Y + 1.15],
      ['threshold', front - 0.4, GROUND_Y + 1.4],
      ['interior', front - 2, GROUND_Y + 1.4]
    ];
    const samples = [];
    for (const [label, z, expectedY] of route) {
      ctrl.setPositionForQA(HALL.x, GROUND_Y, z);
      await delay(260);
      samples.push({
        label,
        z: Number(ctrl.pos.z.toFixed(2)),
        y: Number(ctrl.pos.y.toFixed(2)),
        expectedY,
        locomotion: ctrl.state
      });
    }
    ctrl.setPositionForQA(HALL.x, GROUND_Y, front + 4.5);
    ctrl.setViewForQA?.(0, 0.08);
    await delay(320);
    const report = {
      passed: samples.every(sample => Math.abs(sample.y - sample.expectedY) < 0.08),
      samples
    };
    renderer.domElement.dataset.hallEntryProbe = JSON.stringify(report);
    console.info('[Sky QA] Great Hall entry', JSON.stringify(report));
    storyCard(
      report.passed
        ? tr('Great Hall entry route passed.', '大廳入口路線測試通過。')
        : tr('Great Hall entry route needs attention.', '大廳入口路線仍需檢查。'),
      tr('terrain · three steps · threshold · interior', '地面 · 三階樓梯 · 門檻 · 室內'),
      3600
    );
  };

  const cameraFade = async () => {
    ctrl.setPositionForQA(STORY_START.x, GROUND_Y, STORY_START.z);
    await delay(360);
    const probe = ctrl.createOcclusionProbeForQA();
    if (!probe) return;
    await delay(520);
    const fadedOpacity = Number(probe.mesh.material.opacity.toFixed(3));
    const activeWhileBlocked = Number(renderer.domElement.dataset.cameraOccluders || 0);
    probe.remove();
    await delay(760);
    const restoredMaterial = probe.mesh.material === probe.material;
    const restoredOpacity = Number(probe.mesh.material.opacity.toFixed(3));
    console.info('[Sky QA] camera fade', JSON.stringify({
      fadedOpacity, activeWhileBlocked, restoredMaterial, restoredOpacity
    }));
    probe.mesh.geometry.dispose();
    probe.material.dispose();
    storyCard(tr('Camera obstruction fade passed.', '鏡頭遮擋淡化測試通過。'),
      tr('blocking object faded and restored in isolation', '遮擋物已單獨淡化並恢復'), 3600);
  };

  const enemyAttack = async () => {
    const waitFor = async (predicate, timeoutMs = 8500, stepMs = 80) => {
      const started = performance.now();
      let state = game.state;
      while (!predicate(state) && performance.now() - started < timeoutMs) {
        await delay(stepMs);
        state = game.state;
      }
      return state;
    };
    const run = async (label, options = {}) => {
      if (!game.startEnemyCombatProbe(options)) return { label, passed: false, reason: 'probe unavailable' };
      const beforeHp = GAME.hp;
      let pausedStats = null;
      if (options.safeWindow) {
        game.pauseEnemyCombatProbe(true);
        await delay(1800);
        pausedStats = game.state.combat;
        game.pauseEnemyCombatProbe(false);
      }
      let state;
      if (options.recoveryWall) {
        state = await waitFor(value => value.combat.windups > 0, 7000, 40);
        game.addEnemyCombatProbeWall();
        state = await waitFor(value => value.combat.wallBlocks > 0 && value.combat.pathRecoveries > 0, 5000, 60);
      } else if (options.wall) {
        await delay(2600);
        state = game.state;
      } else if (options.dodge) {
        state = await waitFor(value => value.combat.attacks > 0, 7000, 40);
        game.moveEnemyCombatProbePlayer(18, options.airborne ? 10 : GROUND_Y, 19, options.airborne);
        state = await waitFor(value => value.combat.dodges > 0 || value.combat.hits > 0, 3000, 60);
      } else {
        state = await waitFor(value => value.combat.hits > 0);
      }
      const result = {
        label,
        beforeHp: Number(beforeHp.toFixed(1)),
        afterHp: Number(GAME.hp.toFixed(1)),
        damageTaken: Number((beforeHp - GAME.hp).toFixed(1)),
        combat: state.combat,
        enemyStates: state.enemies.map(enemy => enemy.state),
        pausedStats
      };
      game.stopEnemyCombatProbe();
      result.passed = options.recoveryWall
        ? result.combat.wallBlocks > 0 && result.combat.pathRecoveries > 0 && result.combat.hits === 0
        : options.wall
          ? result.combat.notices === 0 && result.combat.attacks === 0 && result.combat.hits === 0
          : options.dodge
            ? result.combat.attacks > 0 && result.combat.dodges > 0 && result.combat.hits === 0
            : result.damageTaken > 0 && result.combat.notices > 0 && result.combat.windups > 0
              && result.combat.attacks > 0 && result.combat.hits > 0
              && (!options.safeWindow || pausedStats.attacks === 0);
      return result;
    };
    const results = [];
    for (const scenario of [
      ['stray-ground', { type: 'stray' }],
      ['groundskeeper-ground', { type: 'groundskeeper' }],
      ['bellwarden-ground', { type: 'bellwarden' }],
      ['stray-airborne', { type: 'stray', airborne: true }],
      ['stray-moving-dodge', { type: 'stray', dodge: true }],
      ['groundskeeper-moving-dodge', { type: 'groundskeeper', dodge: true }],
      ['bellwarden-moving-dodge', { type: 'bellwarden', dodge: true }],
      ['wall-block', { type: 'stray', wall: true }],
      ['blocked-path-recovery', { type: 'stray', recoveryWall: true }],
      ['safe-window', { type: 'stray', safeWindow: true }]
    ]) results.push(await run(scenario[0], scenario[1]));
    const passed = results.every(result => result.passed);
    console.info('[Sky QA] enemy combat suite', JSON.stringify({
      passed, difficulty: settings.prefs.difficulty, results
    }));
    storyCard(
      passed ? tr('Enemy combat suite passed.', '敵人戰鬥完整測試通過。') : tr('Enemy combat suite needs attention.', '敵人戰鬥完整測試仍需檢查。'),
      passed
        ? tr('3 archetypes · ground · flight · dodge · wall · safe window', '三種敵人 · 地面 · 飛行 · 閃避 · 牆壁 · 安全時間')
        : tr('Open the console for the failed scenario', '請開啟主控台查看失敗項目'),
      5200
    );
  };

  const chancellorToll = async () => {
    const character = playableCharacter(avatar.characterId);
    if (character.abilityConfig?.primary !== 'bell-toll'
      || !game.startEnemyCombatProbe({ type: 'groundskeeper' })) {
      storyCard(tr('Select Aldous Crane first.', '請先選擇 Aldous Crane。'),
        tr('Bell Toll test requires the Chancellor', '鐘鳴測試需要校長角色'), 3200);
      return;
    }
    game.pauseEnemyCombatProbe(true);
    const before = game.state.enemies[0];
    game.cast();
    await delay(220);
    const after = game.state.enemies[0];
    const effects = game.state.effects.chancellor;
    const damage = Number(((before?.hp || 0) - (after?.hp || 0)).toFixed(1));
    const passed = damage >= 12 && effects.triggered >= 2 && effects.tolls >= 1;
    console.info('[Sky QA] chancellor toll', JSON.stringify({
      passed, damage, beforeHp: before?.hp, afterHp: after?.hp, effects
    }));
    game.stopEnemyCombatProbe();
    storyCard(
      passed ? tr('Chancellor Bell Toll passed.', '校長鐘鳴測試通過。') : tr('Chancellor Bell Toll needs attention.', '校長鐘鳴仍需檢查。'),
      passed ? tr('violet nova · pooled effects · 12 damage confirmed', '紫色震波 · 特效池 · 已確認 12 傷害')
        : tr('Open the console for the failed value', '請開啟主控台查看失敗數值'),
      4200
    );
  };

  const buildingFire = async () => {
    if (!siege.startBuildingFireProbe()) return;
    const previousReducedSmoke = settings.prefs.reducedSmoke;
    const previousReducedFlash = settings.prefs.reducedFlash;
    settings.prefs.reducedSmoke = false;
    settings.prefs.reducedFlash = false;
    const sample = label => {
      const state = siege.state;
      const ward = state.wards.find(item => item.id === state.focus);
      return { label, ward, fire: state.fire, enemyTargetOffset: state.enemyTargetOffset };
    };
    const results = [];
    for (const stage of ['threatened', 'igniting', 'burning', 'critical']) {
      siege.setBuildingFireProbeStage(stage);
      await delay(420);
      results.push(sample(stage));
    }
    siege.setBuildingFireProbeStage('burning');
    await delay(180);
    const smokeBefore = siege.state.fire.maxSmokeOpacity;
    siege.rescueBuildingFireProbe();
    siege.setBuildingFireProbeBeam(true);
    await delay(760);
    siege.setBuildingFireProbeBeam(false);
    results.push(sample('rescued-and-suppressed'));

    settings.prefs.reducedSmoke = true;
    settings.prefs.reducedFlash = true;
    siege.setBuildingFireProbeStage('burning');
    await delay(420);
    const reduced = sample('reduced-effects');
    reduced.smokeBefore = smokeBefore;
    results.push(reduced);
    settings.prefs.reducedSmoke = previousReducedSmoke;
    settings.prefs.reducedFlash = previousReducedFlash;

    siege.setBuildingFireProbeStage('scorched');
    await delay(420);
    results.push(sample('scorched'));
    siege.setBuildingFireProbeBeam(true);
    await delay(2100);
    siege.setBuildingFireProbeBeam(false);
    results.push(sample('restored'));
    const byLabel = Object.fromEntries(results.map(result => [result.label, result]));
    const criticalSocketTarget = byLabel.critical.fire.capacity.socketsPerWard;
    const passed = byLabel.threatened.fire.activeAlarms === 1
      && byLabel.threatened.fire.activeFires === 0
      && byLabel.igniting.fire.activeFires >= 1
      && byLabel.burning.fire.visibleSockets >= criticalSocketTarget
      && byLabel.critical.fire.activeFires >= criticalSocketTarget
      && byLabel['rescued-and-suppressed'].ward.rescueCount >= 1
      && byLabel['rescued-and-suppressed'].ward.fireIntensity < byLabel.burning.ward.fireIntensity
      && byLabel['reduced-effects'].fire.reducedSmoke
      && byLabel['reduced-effects'].fire.reducedFlash
      && byLabel['reduced-effects'].fire.maxSmokeOpacity < smokeBefore
      && byLabel.scorched.ward.stage === 'scorched'
      && byLabel.scorched.fire.activeFires === 0
      && byLabel.restored.ward.stage === 'restored'
      && byLabel.restored.ward.restoration === 1
      && byLabel.restored.fire.residentsShown === byLabel.restored.ward.residentCount
      && results.every(result => result.fire.activeAlarms <= result.fire.capacity.alarms
        && result.fire.activeFires <= result.fire.capacity.fires
        && result.fire.activeSmoke <= result.fire.capacity.smoke
        && result.fire.activeEmbers <= result.fire.capacity.embers
        && result.fire.residentsShown <= result.fire.capacity.residents)
      && byLabel.threatened.enemyTargetOffset > 2;
    siege.stopBuildingFireProbe();
    console.info('[Sky QA] building fire suite', JSON.stringify({
      passed, quality: settings.prefs.quality, results
    }));
    storyCard(
      passed ? tr('Building fire suite passed.', '建築火災完整測試通過。') : tr('Building fire suite needs attention.', '建築火災完整測試仍需檢查。'),
      passed
        ? tr('threat · ignition · rescue · suppression · scorch · restoration', '威脅 · 起火 · 救援 · 滅火 · 焦黑 · 修復')
        : tr('Open the console for the failed state', '請開啟主控台查看失敗狀態'),
      5200
    );
  };

  const combinedLoad = async () => {
    if (!siege.startBuildingFireProbe()) return;
    const previousPhase = GAME.phase;
    let holdCritical = 0;
    try {
      siege.setBuildingFireProbeStage('critical');
      game.beginWave();
      holdCritical = window.setInterval(() => siege.setBuildingFireProbeStage('critical'), 500);
      await delay(8800);
      const gameState = game.state;
      const state = {
        fire: siege.state.fire,
        enemies: gameState.enemies,
        combat: gameState.combat,
        effects: gameState.effects
      };
      const withinFireBudget = state.fire.activeAlarms <= state.fire.capacity.alarms
        && state.fire.activeFires <= state.fire.capacity.fires
        && state.fire.activeSmoke <= state.fire.capacity.smoke
        && state.fire.activeEmbers <= state.fire.capacity.embers
        && state.fire.residentsShown <= state.fire.capacity.residents;
      const activeEnemies = state.enemies.length;
      const criticalSocketTarget = state.fire.capacity.socketsPerWard;
      const passed = withinFireBudget && activeEnemies > 0
        && state.fire.activeFires >= criticalSocketTarget;
      const report = {
        passed, quality: settings.prefs.quality, activeEnemies, withinFireBudget,
        criticalSocketTarget, state
      };
      renderer.domElement.dataset.combinedLoadProbe = JSON.stringify(report);
      console.info('[Sky QA] combined combat fire load', JSON.stringify(report));
      storyCard(
        passed ? tr('Combined load stayed inside its budgets.', '戰鬥與火災同時運作仍在效能上限內。')
          : tr('Combined load needs attention.', '戰鬥與火災同時壓力測試仍需檢查。'),
        tr('enemy wave · critical fire · pooled effects · 8.8 seconds', '敵人波次 · 危急火災 · 特效池 · 8.8 秒'),
        5200
      );
    } finally {
      window.clearInterval(holdCritical);
      game.endWave();
      GAME.phase = previousPhase;
      siege.stopBuildingFireProbe();
    }
  };

  const panel = document.createElement('aside');
  panel.id = 'storyQaPanel';
  panel.innerHTML = `
    <strong>${tr('CHAPTER II TEST', '第二章測試')}</strong>
    <button type="button" data-qa-story="enter">${tr('ENTER BLACK GARDEN', '直接進入黑色花園')}</button>
    <button type="button" data-qa-story="relays">${tr('CHARGE 3 RELAYS', '點亮三座中繼站')}</button>
    <button type="button" data-qa-story="boss">${tr('OPEN BOSS CHOICE', '進入 BOSS 選擇')}</button>
    <button type="button" data-qa-story="restore">${tr('RESTORE OUTCOME', '選擇恢復結局')}</button>
    <button type="button" data-qa-story="chancellor">${tr('TEST CHANCELLOR TOLL', '測試校長鐘鳴')}</button>
    <button type="button" data-qa-story="enemy">${tr('TEST ENEMY ATTACK', '測試敵人攻擊')}</button>
    <button type="button" data-qa-story="fire">${tr('TEST BUILDING FIRE', '測試建築火災')}</button>
    <button type="button" data-qa-story="combined">${tr('TEST COMBINED LOAD', '測試戰鬥火災負載')}</button>
    <button type="button" data-qa-story="hall-entry">${tr('TEST HALL ENTRY', '測試大廳入口')}</button>
    <button type="button" data-qa-story="camera">${tr('TEST CAMERA ENTRANCES', '測試建築入口鏡頭')}</button>
    <button type="button" data-qa-story="fade">${tr('TEST CAMERA FADE', '測試鏡頭遮擋淡化')}</button>`;
  document.body.appendChild(panel);
  panel.addEventListener('click', event => {
    const action = event.target.closest('[data-qa-story]')?.dataset.qaStory;
    if (action === 'enter') enterBlackGarden();
    else if (action === 'relays') chargeGarden();
    else if (action === 'boss') defeatGroundskeeper();
    else if (action === 'restore') skyMultiplayer.storyGardenVote('restore');
    else if (action === 'chancellor') chancellorToll();
    else if (action === 'enemy') enemyAttack();
    else if (action === 'fire') buildingFire();
    else if (action === 'combined') combinedLoad();
    else if (action === 'hall-entry') greatHallEntry();
    else if (action === 'camera') cameraEntrances();
    else if (action === 'fade') cameraFade();
  });

  window.addEventListener('keydown', event => {
    if (event.repeat || getMode() !== 'story') return;
    if (event.shiftKey && event.code === 'F6') {
      ctrl.setPositionForQA(0, 1.6, -76);
      setTimeout(() => skyMultiplayer.storyAct('enter-black-garden'), 180);
    } else if (event.shiftKey && event.code === 'F7') {
      [
        ['canopy', 92, 10, 79],
        ['root', 82, 1.6, 86],
        ['well', 102, 1.6, 86]
      ].forEach(([relay, x, y, z], index) => {
        setTimeout(() => {
          ctrl.setPositionForQA(x, y, z);
          setTimeout(() => skyMultiplayer.storyAct('charge-garden-relay', { relay }), 190);
        }, index * 520);
      });
    } else if (event.shiftKey && event.code === 'F8') {
      ctrl.setPositionForQA(92, 3.2, 99);
      for (let index = 0; index < 6; index++) {
        setTimeout(() => skyMultiplayer.storyAct('groundskeeper-hit', { weapon: 3, power: 1 }), index * 470 + 180);
      }
    } else if (event.shiftKey && event.code === 'F9') {
      skyMultiplayer.storyGardenVote('restore');
    } else if (event.code === 'F6') {
      ctrl.setPositionForQA(0, 1.6, 19);
      setTimeout(() => skyMultiplayer.storyAct('recover-opening'), 180);
    } else if (event.code === 'F7') {
      ['photograph', 'letter', 'watch'].forEach((relic, index) => {
        setTimeout(() => skyMultiplayer.storyAct('recover-relic', { relic }), index * 90);
      });
    } else if (event.code === 'F8') {
      skyMultiplayer.storyAct('cleanse-stray');
    } else if (event.code === 'F9') {
      ctrl.setPositionForQA(0, 8, -54);
      setTimeout(() => skyMultiplayer.storyAct('enter-cloister'), 180);
    } else if (event.code === 'F10') {
      [
        ['archive-slate', -12, 1.6, -68],
        ['bell-rope', 0, 1.6, -73],
        ['mara-satchel', 12, 1.6, -68]
      ].forEach(([incident, x, y, z], index) => {
        setTimeout(() => {
          ctrl.setPositionForQA(x, y, z);
          setTimeout(() => skyMultiplayer.storyAct('investigate-incident', { incident }), 190);
        }, index * 520);
      });
    } else if (event.code === 'F11') {
      skyMultiplayer.storyVote('mara');
    } else if (event.code === 'F12') {
      GAME.hp = 0;
      skyMultiplayer.storyAct('become-dimmed');
    }
  });
}
