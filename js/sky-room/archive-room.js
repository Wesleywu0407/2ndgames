export const ARCHIVE_EVIDENCE_LAYOUT = Object.freeze([
  Object.freeze({
    id: 'bell-ledger',
    home: Object.freeze({ x: -1.2, y: 2.3, z: -3.8 }),
    preserved: Object.freeze({ x: -0.9, y: 1.15, z: -2.4 }),
    title: Object.freeze({ en: 'Bell ledger', zh: '鐘聲紀錄冊' }),
    line: Object.freeze({
      en: "The bell stopped first. Mara's name vanished eleven seconds later.",
      zh: '鐘聲先停止；十一秒後，瑪拉的名字才消失。'
    })
  }),
  Object.freeze({
    id: 'rope-record',
    home: Object.freeze({ x: 0, y: 2.72, z: -3.5 }),
    preserved: Object.freeze({ x: 0, y: 1.16, z: -2.4 }),
    title: Object.freeze({ en: 'Rope record', zh: '鐘繩紀錄' }),
    line: Object.freeze({
      en: 'The rope was tied from below. The Warden could not have pulled it.',
      zh: '鐘繩是從下方綁住的；守望者不可能拉動它。'
    })
  }),
  Object.freeze({
    id: 'satchel-note',
    home: Object.freeze({ x: 1.2, y: 3.14, z: -3.2 }),
    preserved: Object.freeze({ x: 0.9, y: 1.17, z: -2.4 }),
    title: Object.freeze({ en: 'Satchel note', zh: '皮包紙條' }),
    line: Object.freeze({
      en: "The Warden's key lay beside the words: Make them forget me first.",
      zh: '守望者的鑰匙旁寫著：「先讓他們忘記我。」'
    })
  })
]);

const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export function createArchiveRoomExperience({ tr, storyCard, game, reportProgress = () => false }) {
  const evidence = ARCHIVE_EVIDENCE_LAYOUT.map(def => ({
    ...def,
    found: false,
    pulse: 0
  }));
  const desk = Object.freeze({ x: 0, z: -2.4 });
  let reconstructed = false;
  let reviewCooldown = 0;

  const foundCount = () => evidence.reduce((count, item) => count + Number(item.found), 0);
  const nearestMissing = localPosition => evidence
    .filter(item => !item.found)
    .map(item => ({ item, distance: distance2D(localPosition, item.home) }))
    .sort((a, b) => a.distance - b.distance)[0] || null;

  const campusReport = () => {
    if (game.phase <= 0) return tr('The archive marks a torn memory beneath the jacaranda.', '檔案記錄顯示：藍花楹下有一段破碎記憶。');
    if (game.phase === 1) return tr(`${Math.max(0, game.relicsNeeded - game.relics)} drifting memories remain.`, `仍有 ${Math.max(0, game.relicsNeeded - game.relics)} 段漂流記憶。`);
    if (game.phase === 2) return tr('Unlight pressure remains active on campus.', '校園內仍有蝕暗壓力。');
    if (game.phase === 3) return tr('The Great Hall hearth is waiting for the recovered morning.', '大禮堂壁爐正等待被尋回的晨光。');
    return tr('The campus record is stable—for now.', '校園紀錄目前穩定。');
  };

  function interactionPrompt(localPosition) {
    if (!localPosition) return null;
    if (!reconstructed) {
      const nearest = nearestMissing(localPosition);
      if (!nearest) return null;
      const ready = nearest.distance <= 1.7;
      return {
        action: tr('Preserve evidence', '保存證據'),
        target: tr(nearest.item.title.en, nearest.item.title.zh),
        detail: tr(
          `${foundCount()} / ${evidence.length} preserved · ${nearest.distance.toFixed(1)} m${ready ? ' · ready' : ' · move closer'}`,
          `已保存 ${foundCount()} / ${evidence.length} · ${nearest.distance.toFixed(1)} 公尺${ready ? ' · 可互動' : ' · 再靠近'}`
        ),
        blocked: !ready
      };
    }
    const distance = distance2D(localPosition, desk);
    if (distance > 4.2) return null;
    const ready = distance <= 1.8 && reviewCooldown <= 0;
    return {
      action: tr('Consult records', '查閱紀錄'),
      target: tr("Archivist's desk", '檔案師閱讀桌'),
      detail: reviewCooldown > 0
        ? tr(`memory settling · ${Math.ceil(reviewCooldown)} s`, `記憶沉澱中 · ${Math.ceil(reviewCooldown)} 秒`)
        : tr(`${distance.toFixed(1)} m${ready ? ' · ready' : ' · move closer'}`, `${distance.toFixed(1)} 公尺${ready ? ' · 可互動' : ' · 再靠近'}`),
      blocked: !ready
    };
  }

  function interact(localPosition) {
    if (!localPosition) return false;
    if (!reconstructed) {
      const nearest = nearestMissing(localPosition);
      if (!nearest || nearest.distance > 1.7) return false;
      nearest.item.found = true;
      nearest.item.pulse = 1;
      const count = foundCount();
      reconstructed = count === evidence.length;
      reportProgress(nearest.item.id, reconstructed);
      if (reconstructed) {
        game.hp = Math.min(game.maxHp, game.hp + 20);
        game.roleState.signatureCharge = Math.min(1, game.roleState.signatureCharge + 0.25);
      }
      storyCard(
        tr(nearest.item.line.en, nearest.item.line.zh),
        reconstructed
          ? tr('3 / 3 preserved · reconstruction: the accusation against the Warden is false', '已保存 3 / 3 · 重建結果：對守望者的指控並不成立')
          : tr(`${count} / ${evidence.length} preserved · find the next floating folio`, `已保存 ${count} / ${evidence.length} · 尋找下一份漂浮文獻`),
        6200
      );
      return true;
    }

    const distance = distance2D(localPosition, desk);
    if (distance > 1.8) return false;
    if (reviewCooldown > 0) return true;
    reviewCooldown = 20;
    reportProgress('service', true);
    game.hp = Math.min(game.maxHp, game.hp + 8);
    game.roleState.signatureCharge = Math.min(1, game.roleState.signatureCharge + 0.12);
    storyCard(campusReport(), tr('archive consultation · lantern and signature steadied', '檔案查閱 · 提燈與角色能力已穩定'), 4600);
    return true;
  }

  return {
    evidence,
    tick(dt) {
      reviewCooldown = Math.max(0, reviewCooldown - dt);
      for (const item of evidence) item.pulse = Math.max(0, item.pulse - dt * 1.8);
    },
    interactionPrompt,
    interact,
    applySharedProgress(items = []) {
      const shared = new Set(items);
      for (const item of evidence) {
        if (shared.has(item.id) && !item.found) { item.found = true; item.pulse = 1; }
      }
      reconstructed = foundCount() === evidence.length;
    },
    state: () => ({
      found: foundCount(),
      total: evidence.length,
      reconstructed,
      reviewCooldown: Number(reviewCooldown.toFixed(2)),
      ids: evidence.map(item => item.id)
    })
  };
}
