export const INFIRMARY_PATIENT_LAYOUT = Object.freeze([
  Object.freeze({ id: 'patient-west', bed: Object.freeze({ x: -3.25, y: 1.02, z: -3.25 }), name: Object.freeze({ en: 'West ward resident', zh: '西側病床居民' }) }),
  Object.freeze({ id: 'patient-east', bed: Object.freeze({ x: 3.25, y: 1.02, z: -3.25 }), name: Object.freeze({ en: 'East ward resident', zh: '東側病床居民' }) }),
  Object.freeze({ id: 'patient-entry', bed: Object.freeze({ x: -3.25, y: 1.02, z: 1.5 }), name: Object.freeze({ en: 'Entry ward resident', zh: '入口病床居民' }) })
]);

const TREATMENT_POOL = Object.freeze({ x: 0, z: -4.35 });
const distance2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function createInfirmaryRoomExperience({ tr, storyCard, game, reportProgress = () => false }) {
  const patients = INFIRMARY_PATIENT_LAYOUT.map(def => ({ ...def, stabilized: false, pulse: 0 }));
  let smokeLevel = 0;
  let treatmentCooldown = 0;

  const stabilizedCount = () => patients.reduce((count, patient) => count + Number(patient.stabilized), 0);
  const complete = () => stabilizedCount() === patients.length;
  const nearestPatient = localPosition => patients
    .filter(patient => !patient.stabilized)
    .map(patient => ({ patient, distance: distance2D(localPosition, patient.bed) }))
    .sort((a, b) => a.distance - b.distance)[0] || null;
  const routeBlocked = () => smokeLevel >= 0.55;
  const safeAisle = patient => patient.bed.x < 0 ? tr('west aisle', '西側走道') : tr('east aisle', '東側走道');

  function smokeTarget(threat) {
    if (!threat) return 0;
    const stageFloor = {
      safe: 0,
      threatened: 0.12,
      igniting: 0.42,
      burning: 0.72,
      critical: 0.95,
      scorched: 0.48,
      restored: 0
    }[threat.stage] || 0;
    return clamp01(Math.max(stageFloor, Number(threat.fireIntensity) || 0));
  }

  function interactionPrompt(localPosition) {
    if (!localPosition) return null;
    if (!complete()) {
      const nearest = nearestPatient(localPosition);
      if (!nearest) return null;
      const centreBlocked = routeBlocked() && Math.abs(localPosition.x) < 1.55 && nearest.distance > 1.7;
      const ready = nearest.distance <= 1.7 && !centreBlocked;
      let guidance = ready ? tr('ready', '可互動') : tr('move closer', '再靠近');
      if (centreBlocked) guidance = tr(`centre smoke blocked · use ${safeAisle(nearest.patient)}`, `中央濃煙封鎖 · 請走${safeAisle(nearest.patient)}`);
      return {
        action: tr('Stabilize resident', '穩定居民'),
        target: tr(nearest.patient.name.en, nearest.patient.name.zh),
        detail: tr(
          `${stabilizedCount()} / ${patients.length} stable · ${nearest.distance.toFixed(1)} m · ${guidance}`,
          `已穩定 ${stabilizedCount()} / ${patients.length} · ${nearest.distance.toFixed(1)} 公尺 · ${guidance}`
        ),
        blocked: !ready
      };
    }

    const distance = distance2D(localPosition, TREATMENT_POOL);
    if (distance > 4.2) return null;
    const ready = distance <= 2.05 && treatmentCooldown <= 0;
    return {
      action: tr('Receive treatment', '接受治療'),
      target: tr('Moonwell treatment pool', '月泉治療池'),
      detail: treatmentCooldown > 0
        ? tr(`moonwell recovering · ${Math.ceil(treatmentCooldown)} s`, `月泉恢復中 · ${Math.ceil(treatmentCooldown)} 秒`)
        : tr(`${distance.toFixed(1)} m${ready ? ' · ready' : ' · move closer'}`, `${distance.toFixed(1)} 公尺${ready ? ' · 可互動' : ' · 再靠近'}`),
      blocked: !ready
    };
  }

  function interact(localPosition) {
    if (!localPosition) return false;
    if (!complete()) {
      const nearest = nearestPatient(localPosition);
      if (!nearest || nearest.distance > 1.7) return false;
      nearest.patient.stabilized = true;
      nearest.patient.pulse = 1;
      const count = stabilizedCount();
      const allStable = complete();
      reportProgress(nearest.patient.id, allStable);
      if (allStable) {
        game.hp = Math.min(game.maxHp, game.hp + 25);
        game.roleState.signatureCharge = Math.min(1, game.roleState.signatureCharge + 0.2);
      }
      storyCard(
        tr(`${nearest.patient.name.en} is breathing steadily.`, `${nearest.patient.name.zh}的呼吸已穩定。`),
        allStable
          ? tr('3 / 3 stable · moonwell treatment service restored', '已穩定 3 / 3 · 月泉治療服務已恢復')
          : tr(`${count} / ${patients.length} stable${routeBlocked() ? ` · keep below the smoke via the ${safeAisle(nearest.patient)}` : ''}`, `已穩定 ${count} / ${patients.length}${routeBlocked() ? ` · 沿${safeAisle(nearest.patient)}避開濃煙` : ''}`),
        5200
      );
      return true;
    }

    const distance = distance2D(localPosition, TREATMENT_POOL);
    if (distance > 2.05) return false;
    if (treatmentCooldown > 0) return true;
    treatmentCooldown = 15;
    reportProgress('service', true);
    game.hp = Math.min(game.maxHp, game.hp + 15);
    game.roleState.signatureCharge = Math.min(1, game.roleState.signatureCharge + 0.08);
    storyCard(tr('The moonwell steadies your lantern.', '月泉穩住了你的提燈。'), tr('treatment complete · service recovers in 15 seconds', '治療完成 · 服務將於 15 秒後恢復'), 3600);
    return true;
  }

  return {
    patients,
    get smokeLevel() { return smokeLevel; },
    get routeBlocked() { return routeBlocked(); },
    tick(dt, threat = null) {
      const target = smokeTarget(threat);
      const speed = target > smokeLevel ? 1.7 : 0.48;
      smokeLevel += (target - smokeLevel) * Math.min(1, dt * speed);
      treatmentCooldown = Math.max(0, treatmentCooldown - dt);
      for (const patient of patients) patient.pulse = Math.max(0, patient.pulse - dt * 1.7);
    },
    interactionPrompt,
    interact,
    applySharedProgress(items = []) {
      const shared = new Set(items);
      for (const patient of patients) {
        if (shared.has(patient.id) && !patient.stabilized) { patient.stabilized = true; patient.pulse = 1; }
      }
    },
    healingRate(localPosition) {
      if (routeBlocked()) return distance2D(localPosition, TREATMENT_POOL) <= 2.1 ? 6 : 0;
      return complete() ? 14 : 5;
    },
    state: () => ({
      stabilized: stabilizedCount(),
      total: patients.length,
      complete: complete(),
      smokeLevel: Number(smokeLevel.toFixed(3)),
      routeBlocked: routeBlocked(),
      treatmentCooldown: Number(treatmentCooldown.toFixed(2)),
      ids: patients.map(patient => patient.id)
    })
  };
}
