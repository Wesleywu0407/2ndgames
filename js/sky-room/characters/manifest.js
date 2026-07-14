export const PLAYABLE_CHARACTERS = Object.freeze([
  {
    id: 'resident-01', profileId: 'resident-01', roleKey: 'balanced',
    model: 'assets/models/characters/elian-voss/elian-voss.glb', scale: 1,
    animationSources: [
      'assets/models/characters/elian-voss/general.glb',
      'assets/models/characters/elian-voss/movement.glb'
    ],
    animationMap: { idle: 'Idle_A', walk: 'Walking_A', run: 'Running_A', fly: 'Jump_Idle', cast: 'Use_Item', hit: 'Hit_A', down: 'Death_A', interact: 'Interact' },
    thumbnail: 'assets/images/characters/elian-voss.svg',
    name: 'Elian Voss', role: { en: 'Lantern Student', zh: '提燈學生' }, difficulty: 1,
    tagline: { en: 'Balanced · Recommended', zh: '平衡型 · 推薦首選' },
    bio: {
      en: 'An astronomy student whose broken star chart now points toward memories instead of stars.',
      zh: '一名天文學生；他破碎的星圖如今不再指向星辰，而是指向失落的記憶。'
    },
    colors: { primary: '#252f51', accent: '#b79358', light: '#98b9ff' },
    ratings: { mobility: 4, defence: 3, control: 3, support: 2 },
    passive: { en: 'Second Sight', zh: '第二視界' },
    passiveText: { en: 'Focused targets remain visible through nearby darkness and foliage.', zh: '被專注觀察的目標會短暫穿透黑暗與樹葉保持可見。' },
    signature: { en: 'Memory Flare', zh: '記憶閃光' },
    signatureText: { en: 'Reveal nearby threats, memories, doors, and cleansable objects.', zh: '揭露附近威脅、記憶、入口與可淨化物件。' },
    abilityConfig: { passive: 'second-sight', signature: 'memory-flare', cooldownMs: 18000, durationMs: 5000 },
    camera: { distance: 3.4, height: 1.08 }, collider: { radius: 0.7 },
    animations: ['idle', 'walk', 'run', 'fly', 'cast', 'hit', 'down', 'interact'],
    licence: { status: 'approved-cc0-derived', creator: 'Kay Lousberg', source: 'https://kaylousberg.itch.io/kaykit-adventurers', licence: 'CC0-1.0', record: 'assets/models/characters/LICENSES.md' }
  },
  {
    id: 'resident-05', profileId: 'resident-05', roleKey: 'defender', model: null,
    thumbnail: 'assets/images/characters/corin-ash.svg',
    name: 'Corin Ash', role: { en: 'Moon Warden', zh: '月之守衛' }, difficulty: 2,
    tagline: { en: 'Defender · Space holder', zh: '防衛型 · 守住陣地' },
    bio: {
      en: 'A junior warden searching for the truth behind the eastern ward that failed at 11:47.',
      zh: '一名年輕守衛，追查東側結界在 11:47 崩潰的真正原因。'
    },
    colors: { primary: '#27313c', accent: '#94a5bd', light: '#b9d2ff' },
    ratings: { mobility: 2, defence: 5, control: 3, support: 3 },
    passive: { en: 'Steadfast Flame', zh: '堅定之焰' },
    passiveText: { en: 'Resist damage and stagger while protecting an ally, ward, or objective.', zh: '守護隊友、結界或目標時，降低傷害與硬直。' },
    signature: { en: 'Ward Dome', zh: '守護穹頂' },
    signatureText: { en: 'Raise a temporary moonlit barrier around nearby allies.', zh: '在附近隊友周圍展開短暫月光屏障。' },
    abilityConfig: { passive: 'steadfast-flame', signature: 'ward-dome', cooldownMs: 24000, durationMs: 6000 },
    camera: { distance: 3.6, height: 1.12 }, collider: { radius: 0.7 },
    animations: ['idle', 'walk', 'run', 'fly', 'cast', 'hit', 'down', 'interact'],
    licence: { status: 'project-authored-procedural-fallback', record: 'assets/models/characters/LICENSES.md' }
  },
  {
    id: 'resident-10', profileId: 'resident-10', roleKey: 'controller', model: null,
    thumbnail: 'assets/images/characters/iris-flint.svg',
    name: 'Iris Flint', role: { en: 'Jacaranda Alchemist', zh: '藍花楹鍊金師' }, difficulty: 4,
    tagline: { en: 'Controller · Advanced', zh: '控制型 · 進階' },
    bio: {
      en: 'A potion researcher determined to reverse the experiment that turned remembered petals black.',
      zh: '一名藥劑研究者，決心逆轉令記憶花瓣變黑的實驗。'
    },
    colors: { primary: '#3d2849', accent: '#c98355', light: '#b586ff' },
    ratings: { mobility: 3, defence: 2, control: 5, support: 2 },
    passive: { en: 'Catalyst Chain', zh: '催化連鎖' },
    passiveText: { en: 'Combine marks from different shared weapons to slow and weaken a threat.', zh: '組合不同共用武器的印記，使敵人減速並弱化。' },
    signature: { en: 'Violet Bloom', zh: '紫羅蘭綻放' },
    signatureText: { en: 'Create a petal field that controls enemies and pauses corruption growth.', zh: '生成花瓣領域控制敵人並暫停腐化蔓延。' },
    abilityConfig: { passive: 'catalyst-chain', signature: 'violet-bloom', cooldownMs: 22000, durationMs: 6500 },
    camera: { distance: 3.45, height: 1.05 }, collider: { radius: 0.7 },
    animations: ['idle', 'walk', 'run', 'fly', 'cast', 'hit', 'down', 'interact'],
    licence: { status: 'project-authored-procedural-fallback', record: 'assets/models/characters/LICENSES.md' }
  },
  {
    id: 'resident-06', profileId: 'resident-06', roleKey: 'support', model: null,
    thumbnail: 'assets/images/characters/nessa-vale.svg',
    name: 'Nessa Vale', role: { en: 'Campus Healer', zh: '校園療癒師' }, difficulty: 3,
    tagline: { en: 'Support · Restoration', zh: '支援型 · 環境復甦' },
    bio: {
      en: 'A healer who hears the campus as overlapping heartbeats and refuses to let its final tree fade.',
      zh: '一名能聽見校園重疊心跳的療癒師，拒絕讓最後一棵樹凋零。'
    },
    colors: { primary: '#3a625a', accent: '#c9b99b', light: '#8be0c1' },
    ratings: { mobility: 3, defence: 3, control: 2, support: 5 },
    passive: { en: 'Gentle Rekindling', zh: '柔光復燃' },
    passiveText: { en: 'Nearby lanterns begin natural recovery sooner after danger passes.', zh: '危險過後，附近提燈更早開始自然恢復。' },
    signature: { en: 'Restoration Pulse', zh: '復甦脈衝' },
    signatureText: { en: 'Heal lantern health and strengthen nearby environmental restoration.', zh: '恢復提燈生命，並強化附近環境復甦。' },
    abilityConfig: { passive: 'gentle-rekindling', signature: 'restoration-pulse', cooldownMs: 26000, durationMs: 4500 },
    camera: { distance: 3.5, height: 1.08 }, collider: { radius: 0.7 },
    animations: ['idle', 'walk', 'run', 'fly', 'cast', 'hit', 'down', 'interact'],
    licence: { status: 'project-authored-procedural-fallback', record: 'assets/models/characters/LICENSES.md' }
  }
]);

export const DEFAULT_PLAYABLE_CHARACTER_ID = PLAYABLE_CHARACTERS[0].id;

export function playableCharacter(id) {
  return PLAYABLE_CHARACTERS.find(character => character.id === id) || PLAYABLE_CHARACTERS[0];
}

export function localised(copy, language = document.documentElement.lang) {
  return language === 'zh-Hant' ? copy.zh : copy.en;
}
