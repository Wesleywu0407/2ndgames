const ROLE_ZH = [
  ['warden', '守夜人'], ['student', '學生'], ['alchemist', '鍊金術學徒'], ['healer', '療癒師'],
  ['librarian', '圖書管理員'], ['archivist', '記憶檔案師'], ['researcher', '研究員'],
  ['courier', '夜間信使'], ['owl keeper', '貓頭鷹飼養員'], ['tutor', '決鬥導師'],
  ['groundskeeper', '庭園管理員']
];
const ACTIVITY_ZH = {
  'sleeping': '正在睡覺', 'eating breakfast': '正在用早餐', 'studying': '正在學習', 'patrolling': '正在巡邏',
  'treating residents': '正在照顧居民', 'sorting messages': '正在整理信件', 'cataloguing memories': '正在編目記憶',
  'brewing': '正在調製藥劑', 'working': '正在工作', 'socialising': '正在與朋友交談',
  'walking alone': '正在獨自散步', 'returning home': '正在回家', 'recovering': '正在醫務室恢復',
  'fleeing': '正在逃離你', 'seeking protection': '正在尋求守夜人保護',
  'searching for the player': '正在搜尋提燈者', 'resting': '正在休息'
};
const MOOD_ZH = {
  quiet: '寧靜', calm: '平靜', focused: '專注', hopeful: '充滿希望', warm: '親切', thoughtful: '沉思',
  tired: '疲憊', afraid: '害怕', shaken: '驚魂未定', concerned: '擔心', wary: '戒備', alert: '警覺', alarmed: '高度警戒'
};
const WEAPON_ZH = { wand: '魔杖', staff: '法杖', flask: '鍊金藥瓶', moonbow: '月弓' };

const movementZh = style => {
  if (style.includes('march')) return '行進步伐';
  if (style.includes('float')) return '漂浮';
  if (style.includes('glide')) return '滑行';
  if (style.includes('skip') || style.includes('bouncy')) return '輕快跳步';
  if (style.includes('limp')) return '跛行';
  if (style.includes('skitter')) return '快速碎步';
  if (style.includes('stride')) return '大步行走';
  if (style.includes('quiet') || style.includes('measured')) return '沉穩步伐';
  return '自然行走';
};

export function createNpcInteraction({
  residentSystem, livingWorld, tr, getLanguage, storyCard, isBlocked, isPerformanceMode,
  isPrimaryInteractionReady = () => false
}) {
  const card = document.getElementById('npcCard');
  const elements = {
    kicker: card.querySelector('.npc-card-kicker'), name: card.querySelector('.npc-card-name'),
    mood: card.querySelector('.npc-card-mood'), role: card.querySelector('.npc-card-role'),
    activity: card.querySelector('.npc-card-activity'), movement: card.querySelector('.npc-card-movement'),
    weapon: card.querySelector('.npc-card-weapon'), memory: card.querySelector('.npc-card-memory'),
    action: card.querySelector('.npc-card-action span')
  };
  let current = null;
  let interactPressed = false;
  let refreshT = 0;
  let proximityT = 0;
  let cardOpen = false;

  window.addEventListener('keydown', event => {
    if (event.code === 'KeyE' && !event.repeat && !isBlocked() && !isPrimaryInteractionReady()) {
      interactPressed = true;
    }
  });

  const render = resident => {
    const npc = livingWorld.getNPC(resident.id);
    const zh = getLanguage() === 'zh-Hant';
    const number = Number(resident.id.slice(-2));
    elements.kicker.textContent = tr('LIVING RESIDENT', '永續世界居民');
    elements.name.textContent = npc?.name || tr(`Resident ${number}`, `居民 ${number}`);
    elements.role.textContent = npc ? (zh ? ROLE_ZH.find(([key]) => npc.role.includes(key))?.[1] || '居民' : npc.role) : tr('resident', '居民');
    elements.mood.textContent = npc ? (zh ? MOOD_ZH[npc.mood] || '平靜' : npc.mood) : tr('calm', '平靜');
    elements.activity.textContent = npc ? (zh ? ACTIVITY_ZH[npc.activity] || '正在城中生活' : npc.activity) : tr('walking through the city', '正在城中行走');
    elements.movement.textContent = tr(
      `MOVE · ${resident.profile.movement.style} · ${resident.profile.movement.speed.toFixed(2)}x`,
      `移動 · ${movementZh(resident.profile.movement.style)} · ${resident.profile.movement.speed.toFixed(2)}x`
    );
    elements.weapon.textContent = tr(
      `WEAPON · ${resident.profile.weapon.name} · ${resident.profile.weapon.damage} DMG`,
      `武器 · ${WEAPON_ZH[resident.profile.weapon.type] || '法器'} · 傷害 ${resident.profile.weapon.damage}`
    );
    const memory = npc?.memories?.[0];
    elements.memory.textContent = memory ? tr(`Remembers: ${memory.summary_en}`, `記得：${memory.summary_zh}`) : tr('No strong memory of you yet.', '對你還沒有鮮明的記憶。');
    elements.action.textContent = npc?.fearPlayer >= 65 ? tr('APPROACH CAREFULLY', '謹慎靠近') : tr('GREET', '打招呼');
  };

  return {
    update(dt, playerPos, enabled) {
      const primaryInteractionReady = enabled && isPrimaryInteractionReady();
      card.classList.toggle('primary-interaction-ready', primaryInteractionReady);
      refreshT -= dt;
      proximityT -= dt;
      if (proximityT <= 0) {
        proximityT = isPerformanceMode() ? .12 : .065;
        current = (enabled ? residentSystem.nearest(playerPos, 4.8) : null)?.resident || null;
        const nextOpen = !!current;
        if (nextOpen !== cardOpen) {
          cardOpen = nextOpen;
          card.classList.toggle('open', cardOpen);
          card.setAttribute('aria-hidden', String(!cardOpen));
        }
      }
      if (current && refreshT <= 0) { render(current); refreshT = .25; }
      if (interactPressed && current && !primaryInteractionReady) {
        const npc = livingWorld.getNPC(current.id);
        livingWorld.act('greet', current.id);
        storyCard(npc?.name || tr('The resident', '這名居民'), npc?.fearPlayer >= 65
          ? tr('steps back and watches your lantern', '後退一步，警戒地看著你的提燈')
          : tr('remembers that you stopped to speak', '記住了你曾停下來交談'));
      }
      interactPressed = false;
    }
  };
}
