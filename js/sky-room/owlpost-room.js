export const OWLPOST_DESK = Object.freeze({ x: 0, y: 1.6, z: -3.8 });

export const OWLPOST_ROUTE_LAYOUT = Object.freeze([
  { id: 'west-belfry', x: -9.5, y: 7.2, z: -1.5, name: { en: 'west belfry roost', zh: '西側鐘樓棲架' } },
  { id: 'east-roost', x: 10.5, y: 6.2, z: 1.0, name: { en: 'east roof roost', zh: '東側屋頂棲架' } },
  { id: 'court-post', x: 0, y: 1.6, z: 15, name: { en: 'court letter post', zh: '庭院信柱' } }
]);

const REPLAY_COOLDOWN = 20;
const PROMPT_RANGE = 24;

const distance3D = (a, b) => Math.hypot(a.x - b.x, (a.y || 0) - (b.y || 0), a.z - b.z);

export function createOwlPostRoomExperience({ tr, storyCard, game, reportProgress = () => false }) {
  let phase = 'idle';
  let routeIndex = 0;
  let delivered = 0;
  let replayCooldown = 0;
  let firstCompletionRewarded = false;
  const target = () => OWLPOST_ROUTE_LAYOUT[Math.min(routeIndex, OWLPOST_ROUTE_LAYOUT.length - 1)];
  const complete = () => delivered >= OWLPOST_ROUTE_LAYOUT.length;
  const targetName = route => tr(route.name.en, route.name.zh);

  function beginDelivery() {
    phase = 'carrying';
    storyCard(
      tr(`Letter ${routeIndex + 1} entrusted to you.`, `第 ${routeIndex + 1} 封信已交給你。`),
      tr(`deliver it to the ${targetName(target())} · violet beacon outside`, `送往${targetName(target())} · 戶外紫色信標`)
    );
  }

  function interactionPrompt(localPosition) {
    if (!localPosition) return null;
    if (phase === 'carrying') {
      const distance = distance3D(localPosition, target());
      if (distance > PROMPT_RANGE) return null;
      return {
        action: tr('Deliver letter', '投遞信件'),
        target: targetName(target()),
        detail: tr(
          `${distance.toFixed(1)} m${distance <= 2.35 ? ' · ready' : ' · follow the violet beacon'}`,
          `${distance.toFixed(1)} 公尺${distance <= 2.35 ? ' · 可投遞' : ' · 跟隨紫色信標'}`
        ),
        blocked: distance > 2.35
      };
    }

    const distance = distance3D(localPosition, OWLPOST_DESK);
    if (distance > PROMPT_RANGE) return null;
    const cooling = complete() && replayCooldown > 0;
    return {
      action: complete() ? tr('Repeat mail run', '重跑送信路線') : tr('Collect letter', '領取信件'),
      target: tr('Owl Post sorting desk', '貓頭鷹郵局分信桌'),
      detail: distance > 2.2
        ? tr(`${distance.toFixed(1)} m · return to the sorting desk`, `${distance.toFixed(1)} 公尺 · 返回分信桌`)
        : cooling
          ? tr(`owls resting · ${Math.ceil(replayCooldown)} s`, `貓頭鷹休息中 · ${Math.ceil(replayCooldown)} 秒`)
          : tr(`${delivered} / ${OWLPOST_ROUTE_LAYOUT.length} delivered · ready`, `已投遞 ${delivered} / ${OWLPOST_ROUTE_LAYOUT.length} · 可領取`),
      blocked: distance > 2.2 || cooling
    };
  }

  function interact(localPosition) {
    const prompt = interactionPrompt(localPosition);
    if (!prompt || prompt.blocked) return false;
    if (phase === 'carrying') {
      const deliveredRoute = target().id;
      delivered++;
      routeIndex++;
      reportProgress(deliveredRoute, complete());
      if (complete()) {
        phase = 'complete';
        replayCooldown = REPLAY_COOLDOWN;
        if (!firstCompletionRewarded) {
          firstCompletionRewarded = true;
          game.hp = Math.min(game.maxHp, game.hp + 8);
          game.roleState.signatureCharge = Math.min(1, game.roleState.signatureCharge + 0.12);
        }
        storyCard(
          tr('Three replies cross the campus before dawn.', '三封回信在黎明前穿過校園。'),
          tr('Owl Post complete · mail run replay unlocked', '貓頭鷹郵局完成 · 已解鎖重跑送信')
        );
      } else {
        phase = 'returning';
        storyCard(
          tr(`Letter ${delivered} delivered.`, `第 ${delivered} 封信已送達。`),
          tr('return to the sorting desk for the next route', '返回分信桌領取下一條路線')
        );
      }
      return true;
    }

    if (complete()) {
      delivered = 0;
      routeIndex = 0;
    }
    beginDelivery();
    return true;
  }

  function tick(dt) {
    replayCooldown = Math.max(0, replayCooldown - dt);
  }

  return {
    acceptsOutside: true,
    tick,
    interact,
    interactionPrompt,
    routeActive: id => phase === 'carrying' && target().id === id,
    applySharedProgress(items = []) {
      const shared = new Set(items);
      delivered = OWLPOST_ROUTE_LAYOUT.filter(route => shared.has(route.id)).length;
      routeIndex = delivered;
      if (complete()) {
        phase = 'complete';
        firstCompletionRewarded = true;
      } else if (delivered > 0 && phase !== 'carrying') phase = 'returning';
    },
    get phase() { return phase; },
    get activeRouteId() { return phase === 'carrying' ? target().id : null; },
    state: () => ({
      phase,
      delivered,
      total: OWLPOST_ROUTE_LAYOUT.length,
      complete: complete(),
      carrying: phase === 'carrying',
      activeRouteId: phase === 'carrying' ? target().id : null,
      replayCooldown: Number(replayCooldown.toFixed(2))
    })
  };
}
