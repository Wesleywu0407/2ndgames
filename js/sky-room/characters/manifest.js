import { ACTIVE_PLAYABLE_IDS } from './catalog.js';

const LEGACY_PLAYABLE_CHARACTERS = Object.freeze([
  {
    id: 'resident-01', profileId: 'resident-01', roleKey: 'balanced',
    model: 'assets/models/characters/elian-voss/elian-voss.glb', scale: 1,
    gameplayRotationY: Math.PI,
    animationSources: [
      'assets/models/characters/elian-voss/general.glb',
      'assets/models/characters/elian-voss/movement.glb'
    ],
    animationMap: {
      idle: 'Idle_A',
      // The KayKit library already ships the variants this hero needs, so his
      // motion depth costs nothing: a second idle, a heavier flinch, a second
      // attack throw, and two spare gaits.
      idleB: 'Idle_B',
      walk: 'Walking_A',
      walkSlow: 'Walking_B',
      wounded: 'Walking_C',
      run: 'Running_A',
      lift: 'Jump_Start',
      fly: 'Jump_Idle',
      land: 'Jump_Land',
      cast: 'Use_Item',
      castB: 'Throw',
      hit: 'Hit_A',
      hitHeavy: 'Hit_B',
      down: 'Death_A',
      interact: 'Interact',
      revive: 'Spawn_Ground',
      celebration: 'Interact'
    },
    idleBreaks: ['idleB'],
    idleBreakWindow: [9, 15],
    animationConfig: {
      idleB: { loop: false },
      walkSlow: { timeScale: 0.95 },
      wounded: { timeScale: 0.9 },
      lift: { duration: 0.6, loop: false },
      land: { duration: 0.52, loop: false },
      cast: { duration: 1.05, loop: false },
      castB: { duration: 0.95, loop: false },
      hit: { duration: 0.62, loop: false },
      hitHeavy: { duration: 0.78, loop: false },
      down: { duration: 0.8, loop: false, clamp: true },
      interact: { duration: 1.1, loop: false },
      revive: { duration: 1.3, loop: false },
      celebration: { duration: 1.1, loop: false }
    },
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
    animations: ['idle', 'idleB', 'walk', 'walkSlow', 'wounded', 'run', 'lift', 'fly', 'land',
      'cast', 'castB', 'hit', 'hitHeavy', 'down', 'interact', 'revive', 'celebration'],
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
  },
  {
    id: 'resident-19', profileId: 'resident-19', roleKey: 'sage',
    model: 'assets/models/characters/chancellor/chancellor.glb', scale: 1,
    gameplayRotationY: Math.PI,
    animationSources: [
      'assets/models/characters/chancellor/anim-idle.glb',
      'assets/models/characters/chancellor/anim-walk.glb',
      'assets/models/characters/chancellor/anim-cast.glb',
      'assets/models/characters/chancellor/anim-idle-look.glb',
      'assets/models/characters/chancellor/anim-idle-alert.glb',
      'assets/models/characters/chancellor/anim-turn.glb',
      'assets/models/characters/chancellor/anim-step-turn.glb',
      'assets/models/characters/chancellor/anim-walk-slow.glb',
      'assets/models/characters/chancellor/anim-wounded.glb',
      'assets/models/characters/chancellor/anim-run.glb',
      'assets/models/characters/chancellor/anim-hit.glb',
      'assets/models/characters/chancellor/anim-hit-heavy.glb',
      'assets/models/characters/chancellor/anim-down.glb',
      'assets/models/characters/chancellor/anim-cast-b.glb',
      'assets/models/characters/chancellor/anim-dodge.glb',
      'assets/models/characters/chancellor/anim-fly.glb',
      'assets/models/characters/chancellor/anim-fly-glide.glb'
    ],
    animationMap: {
      idle: 'Armature|Idle|baselayer',
      idleLook: 'Armature|Long_Breathe_and_Look_Around|baselayer',
      idleAlert: 'Armature|Alert|baselayer',
      turn: 'Armature|Idle_Turn_Left|baselayer',
      stepTurn: 'Armature|Idle_Step_Turn_Left|baselayer',
      walk: 'Armature|Casual_Walk|baselayer',
      walkSlow: 'Armature|Walk_Slowly_and_Look_Around|baselayer',
      wounded: 'Armature|Injured_Walk|baselayer',
      run: 'Armature|Quick_Walk|baselayer',
      // Flight is two motions: a slowed tread reads as a held hover, and a
      // spread-armed soar takes over once he is really travelling.
      fly: 'Armature|Swim_Idle|baselayer',
      // Leap_of_Faith turned out to be pure root motion — with the fall removed
      // it is just standing in mid-air — so the glide borrows the forward swim.
      // Retargeted clips are portable between Meshy-rigged heroes now that they
      // are rotation-only, and a slower time scale keeps his soar languid.
      flyGlide: 'Armature|Swim_Forward|baselayer',
      lift: 'Armature|Charged_Spell_Cast|baselayer',
      land: 'Armature|Idle|baselayer',
      cast: 'Armature|Charged_Spell_Cast|baselayer',
      castB: 'Armature|Charged_Ground_Slam|baselayer',
      dodge: 'Armature|Stand_Dodge|baselayer',
      hit: 'Armature|Hit_Reaction|baselayer',
      hitHeavy: 'Armature|Electrocution_Reaction|baselayer',
      down: 'Armature|Shot_and_Slow_Fall_Backward|baselayer',
      interact: 'Armature|Charged_Spell_Cast|baselayer',
      revive: 'Armature|Charged_Spell_Cast|baselayer',
      celebration: 'Armature|Charged_Ground_Slam|baselayer'
    },
    // Standing still cycles through quiet flourishes instead of one loop.
    idleBreaks: ['idleLook', 'idleAlert', 'turn', 'stepTurn'],
    idleBreakWindow: [7, 12],
    animationConfig: {
      idle: { timeScale: 0.78 },
      idleLook: { loop: false, timeScale: 0.85 },
      idleAlert: { loop: false, timeScale: 0.9 },
      turn: { loop: false, timeScale: 0.85 },
      stepTurn: { loop: false, timeScale: 0.85 },
      walk: { timeScale: 0.92 },
      walkSlow: { timeScale: 0.9 },
      wounded: { timeScale: 0.95 },
      run: { timeScale: 1.12 },
      fly: { timeScale: 0.42 },
      flyGlide: { timeScale: 0.55 },
      lift: { duration: 1.05, loop: false, clamp: true },
      land: { duration: 0.42, loop: false },
      cast: { duration: 0.95, loop: false },
      castB: { duration: 1.05, loop: false },
      dodge: { duration: 0.6, loop: false },
      hit: { duration: 0.65, loop: false },
      hitHeavy: { duration: 0.9, loop: false },
      down: { duration: 1.5, loop: false, clamp: true },
      interact: { duration: 1.1, loop: false },
      revive: { duration: 1.1, loop: false },
      celebration: { duration: 1.25, loop: false }
    },
    modelContract: {
      format: 'glb-2.0', authoredForwardAxis: '+Z', gameplayForwardAxis: '-Z',
      groundAxis: 'Y', groundOrigin: 0,
      bounds: { min: [-0.657565, 0, -0.304428], max: [0.657565, 1.85, 0.304428] }
    },
    attachments: {
      lantern: { node: 'RightHand', offset: [0, 0, 0] },
      leftHand: { node: 'LeftHand', offset: [0, 0, 0] },
      rightHand: { node: 'RightHand', offset: [0, 0, 0] },
      head: { node: 'Head', offset: [0, 0, 0] },
      chest: { node: 'Spine01', offset: [0, 0, 0] },
      leftFoot: { node: 'LeftFoot', offset: [0, 0, 0] },
      rightFoot: { node: 'RightFoot', offset: [0, 0, 0] },
      projectile: { node: 'RightHand', offset: [0, 0, 0] },
      effect: { node: 'Spine01', offset: [0, 0, 0] }
    },
    materialRules: {
      importedMaterials: ['Material_1'], tintableMaterials: [],
      accentApplication: 'ui-and-effects-only',
      fixedIdentityColors: ['#1f2747', '#b79358', '#ffd9a0']
    },
    modelBudget: {
      maxTriangles: 32000, maxModelBytes: 8000000, maxMaterials: 1,
      maxUniqueImages: 1, maxTextureEdge: 2048, maxDecodedTextureBytes: 16777216,
      measuredTriangles: 30129, measuredModelBytes: 377468,
      measuredAnimationBytes: 1364568
    },
    thumbnail: 'assets/images/characters/aldous-crane.svg',
    name: 'Aldous Crane', role: { en: 'The Chancellor', zh: '校長' }, difficulty: 3,
    tagline: { en: 'Sage · Holds the hour', zh: '賢者型 · 扣住時刻' },
    bio: {
      en: 'The white-bearded chancellor of the Great Hall, who signed every ward order the campus forgot — and now searches his own hall for the signature that betrayed it.',
      zh: '大禮堂的白鬚校長；校園遺忘的每一道結界令都出自他手。如今他在自己的禮堂中，追查那個背叛結界的簽名。'
    },
    colors: { primary: '#1f2747', accent: '#b79358', light: '#ffd9a0' },
    ratings: { mobility: 2, defence: 3, control: 4, support: 4 },
    passive: { en: "Chancellor's Word", zh: '校長之言' },
    passiveText: { en: 'Restored lanterns near the Chancellor burn brighter and reveal slightly farther.', zh: '校長附近被復原的提燈燃燒得更亮，照見更遠。' },
    signature: { en: 'Eleventh Hour', zh: '第十一時' },
    signatureText: { en: 'Hold the hour: nearby Unlight slows while the bell of the Great Hall tolls.', zh: '短暫扣住時刻：大禮堂鐘聲迴盪期間，附近夜蝕行動減緩。' },
    abilityConfig: {
      passive: 'chancellors-word', signature: 'eleventh-hour', primary: 'bell-toll',
      cooldownMs: 24000, durationMs: 6000,
      primaryConfig: {
        radius: 11.5, damage: 12, cooldownMs: 1250,
        empoweredRadius: 15, empoweredDamage: 22, empoweredCooldownMs: 900,
        bossDamage: 1, empoweredBossDamage: 2
      }
    },
    camera: { distance: 3.7, height: 1.2 }, collider: { radius: 0.7 },
    animations: ['idle', 'idleLook', 'idleAlert', 'turn', 'stepTurn', 'walk', 'walkSlow', 'wounded',
      'run', 'lift', 'fly', 'flyGlide', 'land', 'cast', 'castB', 'dodge', 'hit', 'hitHeavy', 'down',
      'interact', 'revive', 'celebration'],
    accessibilityDescription: {
      en: 'An elderly white-bearded chancellor in a deep blue and gold academic robe, carrying a moonlit staff and casting violet bell magic.',
      zh: '一位白色長鬚、身穿深藍金邊學院長袍的年長校長，手持月光法杖並施放紫色鐘鳴魔法。'
    },
    licence: { status: 'project-commissioned-ai-generated', creator: 'Higgsfield (Meshy image_to_3d)', record: 'assets/models/characters/LICENSES.md' }
  },
  {
    id: 'resident-20', profileId: 'resident-20', roleKey: 'striker',
    model: 'assets/models/characters/kael-morrow/kael-morrow.glb', scale: 1,
    gameplayRotationY: Math.PI,
    animationSources: [
      'assets/models/characters/kael-morrow/anim-idle.glb',
      'assets/models/characters/kael-morrow/anim-walk.glb',
      'assets/models/characters/kael-morrow/anim-run.glb',
      'assets/models/characters/kael-morrow/anim-fly.glb',
      'assets/models/characters/kael-morrow/anim-strike.glb',
      'assets/models/characters/kael-morrow/anim-cast.glb',
      'assets/models/characters/kael-morrow/anim-hit.glb',
      'assets/models/characters/kael-morrow/anim-down.glb',
      'assets/models/characters/kael-morrow/anim-idle-taunt.glb',
      'assets/models/characters/kael-morrow/anim-idle-box.glb',
      'assets/models/characters/kael-morrow/anim-turn.glb',
      'assets/models/characters/kael-morrow/anim-dodge.glb',
      'assets/models/characters/kael-morrow/anim-hit-heavy.glb',
      'assets/models/characters/kael-morrow/anim-cast-b.glb',
      'assets/models/characters/kael-morrow/anim-wounded.glb',
      'assets/models/characters/kael-morrow/anim-fly-hover.glb'
    ],
    animationMap: {
      idle: 'Armature|Idle_02|baselayer',
      // A brawler's downtime is restless: he taunts and shadow-boxes rather
      // than breathing and surveying like the Chancellor.
      idleTaunt: 'Armature|Chest_Pound_Taunt|baselayer',
      idleBox: 'Armature|Boxing_Practice|baselayer',
      turn: 'Armature|Combat_Idle_Turn_Left|baselayer',
      walk: 'Armature|Walk_Fight_Forward|baselayer',
      wounded: 'Armature|Cautious_Crouch_Walk_Forward|baselayer',
      run: 'Armature|Standard_Forward_Charge|baselayer',
      fly: 'Armature|Swim_Idle|baselayer',
      flyGlide: 'Armature|Swim_Forward|baselayer',
      lift: 'Armature|Flying_Fist_Kick|baselayer',
      land: 'Armature|Idle_02|baselayer',
      cast: 'Armature|Flying_Fist_Kick|baselayer',
      castB: 'Armature|Kung_Fu_Punch|baselayer',
      dodge: 'Armature|Roll_Dodge|baselayer',
      hit: 'Armature|Hit_Reaction|baselayer',
      hitHeavy: 'Armature|BeHit_FlyUp|baselayer',
      down: 'Armature|Shot_in_the_Back_and_Fall|baselayer',
      interact: 'Armature|Charged_Spell_Cast_1|baselayer',
      revive: 'Armature|Charged_Spell_Cast_1|baselayer',
      celebration: 'Armature|Chest_Pound_Taunt|baselayer'
    },
    idleBreaks: ['idleTaunt', 'idleBox', 'turn'],
    idleBreakWindow: [6, 11],
    animationConfig: {
      idle: { timeScale: 0.9 },
      idleTaunt: { loop: false, timeScale: 1 },
      idleBox: { loop: false, timeScale: 1 },
      turn: { loop: false, timeScale: 1 },
      walk: { timeScale: 1.05 },
      wounded: { timeScale: 1 },
      run: { timeScale: 1.25 },
      fly: { timeScale: 0.85 },
      flyGlide: { timeScale: 1 },
      lift: { duration: 0.85, loop: false, clamp: true },
      land: { duration: 0.4, loop: false },
      cast: { duration: 0.9, loop: false },
      castB: { duration: 0.8, loop: false },
      dodge: { duration: 0.75, loop: false },
      hit: { duration: 0.6, loop: false },
      hitHeavy: { duration: 0.95, loop: false },
      down: { duration: 1.4, loop: false, clamp: true },
      interact: { duration: 1.1, loop: false },
      revive: { duration: 1.1, loop: false },
      celebration: { duration: 1.0, loop: false }
    },
    thumbnail: 'assets/images/characters/kael-morrow.svg',
    name: 'Kael Morrow', role: { en: 'The Breacher', zh: '攻堅手' }, difficulty: 4,
    tagline: { en: 'Striker · First through the door', zh: '攻堅型 · 第一個破門的人' },
    bio: {
      en: 'Every door the Unlight sealed across the campus, Kael broke open with one brass gauntlet — and he is still counting the doors it owes him.',
      zh: '夜蝕封住校園的每一扇門，都是凱爾用那隻黃銅拳套一拳一拳敲開的——而他還在數夜蝕欠他的門。'
    },
    colors: { primary: '#4a2a24', accent: '#c96f3b', light: '#ffab6e' },
    ratings: { mobility: 5, defence: 2, control: 2, support: 1 },
    passive: { en: 'Momentum', zh: '乘勢' },
    passiveText: { en: 'Right after a Breach Dash, his next strikes land harder.', zh: '破陣突刺後短暫時間內，攻擊更加沉重。' },
    signature: { en: 'Breach', zh: '破城' },
    signatureText: { en: 'A single crushing blow that tears through everything in the lane ahead.', zh: '蓄力一記粉碎重擊，貫穿前方路徑上的一切。' },
    abilityConfig: {
      passive: 'momentum', signature: 'breach', primary: 'breach-dash',
      cooldownMs: 20000, durationMs: 3000,
      primaryConfig: { range: 6, radius: 2.4, damage: 10, cooldownMs: 1100 }
    },
    camera: { distance: 3.45, height: 1.05 }, collider: { radius: 0.7 },
    animations: ['idle', 'idleTaunt', 'idleBox', 'turn', 'walk', 'wounded', 'run', 'lift', 'fly',
      'flyGlide', 'land', 'cast', 'castB', 'dodge', 'hit', 'hitHeavy', 'down',
      'interact', 'revive', 'celebration'],
    modelContract: {
      format: 'glb-2.0', authoredForwardAxis: '+Z', gameplayForwardAxis: '-Z',
      groundAxis: 'Y', groundOrigin: 0,
      bounds: { min: [-0.585, 0, -0.241], max: [0.585, 1.78, 0.241] }
    },
    attachments: {
      lantern: { node: 'LeftHand', offset: [0, 0, 0] },
      leftHand: { node: 'LeftHand', offset: [0, 0, 0] },
      rightHand: { node: 'RightHand', offset: [0, 0, 0] },
      head: { node: 'Head', offset: [0, 0, 0] },
      chest: { node: 'Spine01', offset: [0, 0, 0] },
      leftFoot: { node: 'LeftFoot', offset: [0, 0, 0] },
      rightFoot: { node: 'RightFoot', offset: [0, 0, 0] },
      projectile: { node: 'RightHand', offset: [0, 0, 0] },
      effect: { node: 'RightHand', offset: [0, 0, 0] }
    },
    materialRules: {
      importedMaterials: ['Material_1'], tintableMaterials: [],
      accentApplication: 'ui-and-effects-only',
      fixedIdentityColors: ['#4a2a24', '#c96f3b', '#ffab6e']
    },
    modelBudget: {
      maxTriangles: 32000, maxModelBytes: 9000000, maxMaterials: 1,
      maxUniqueImages: 1, maxTextureEdge: 2048, maxDecodedTextureBytes: 16777216,
      measuredTriangles: 30903, measuredModelBytes: 378544,
      measuredAnimationBytes: 923580
    },
    accessibilityDescription: {
      en: 'An athletic young man in a rust-red jacket with one oversized brass breaching gauntlet, dashing through enemies with ember-orange impacts.',
      zh: '一位身穿鏽紅短外套的年輕壯碩男子，右手戴著巨大的黃銅破門拳套，以餘燼橘色的衝擊突刺穿越敵陣。'
    },
    licence: { status: 'project-commissioned-ai-generated', creator: 'Higgsfield (Meshy image_to_3d)', record: 'assets/models/characters/LICENSES.md' }
  }
,
  {
    id: 'resident-21', profileId: 'resident-21', roleKey: 'marksman',
    model: 'assets/models/characters/sylwen-yarrow/sylwen-yarrow.glb', scale: 1,
    gameplayRotationY: Math.PI,
    animationSources: [
      'assets/models/characters/sylwen-yarrow/anim-idle.glb',
      'assets/models/characters/sylwen-yarrow/anim-walk.glb',
      'assets/models/characters/sylwen-yarrow/anim-run.glb',
      'assets/models/characters/sylwen-yarrow/anim-fly.glb',
      'assets/models/characters/sylwen-yarrow/anim-fly-glide.glb',
      'assets/models/characters/sylwen-yarrow/anim-cast.glb',
      'assets/models/characters/sylwen-yarrow/anim-cast-b.glb',
      'assets/models/characters/sylwen-yarrow/anim-idle-listen.glb',
      'assets/models/characters/sylwen-yarrow/anim-idle-read.glb',
      'assets/models/characters/sylwen-yarrow/anim-turn.glb',
      'assets/models/characters/sylwen-yarrow/anim-wounded.glb',
      'assets/models/characters/sylwen-yarrow/anim-dodge.glb',
      'assets/models/characters/sylwen-yarrow/anim-hit.glb',
      'assets/models/characters/sylwen-yarrow/anim-hit-heavy.glb',
      'assets/models/characters/sylwen-yarrow/anim-down.glb'
    ],
    animationMap: {
      idle: 'Armature|Idle_3|baselayer',
      // A keeper's downtime is watchful rather than restless: she listens for
      // the room, and she reads. None of it is shared with the other heroes.
      idleListen: 'Armature|Listening_Gesture|baselayer',
      idleRead: 'Armature|Checkout_Gesture|baselayer',
      turn: 'Armature|Idle_Turn_Left|baselayer',
      walk: 'Armature|Stage_Walk|baselayer',
      wounded: 'Armature|Injured_Walk|baselayer',
      run: 'Armature|Run_02|baselayer',
      fly: 'Armature|Swim_Idle|baselayer',
      flyGlide: 'Armature|Swim_Forward|baselayer',
      lift: 'Armature|Draw_and_Shoot_from_Back|baselayer',
      land: 'Armature|Idle_3|baselayer',
      cast: 'Armature|Archery_Shot|baselayer',
      castB: 'Armature|Draw_and_Shoot_from_Back|baselayer',
      dodge: 'Armature|Stand_Dodge_1|baselayer',
      hit: 'Armature|Slap_Reaction|baselayer',
      hitHeavy: 'Armature|Gunshot_Reaction|baselayer',
      down: 'Armature|dying_backwards|baselayer',
      interact: 'Armature|Checkout_Gesture|baselayer',
      revive: 'Armature|Checkout_Gesture|baselayer',
      celebration: 'Armature|Draw_and_Shoot_from_Back|baselayer'
    },
    idleBreaks: ['idleListen', 'idleRead', 'turn'],
    idleBreakWindow: [8, 14],
    animationConfig: {
      idle: { timeScale: 0.85 },
      idleListen: { loop: false, timeScale: 0.9 },
      idleRead: { loop: false, timeScale: 0.85 },
      turn: { loop: false, timeScale: 0.9 },
      walk: { timeScale: 0.95 },
      wounded: { timeScale: 0.92 },
      run: { timeScale: 1.1 },
      fly: { timeScale: 0.5 },
      flyGlide: { timeScale: 0.7 },
      lift: { duration: 0.95, loop: false, clamp: true },
      land: { duration: 0.42, loop: false },
      cast: { duration: 0.85, loop: false },
      castB: { duration: 1, loop: false },
      dodge: { duration: 0.65, loop: false },
      hit: { duration: 0.6, loop: false },
      hitHeavy: { duration: 0.9, loop: false },
      down: { duration: 1.5, loop: false, clamp: true },
      interact: { duration: 1.2, loop: false },
      revive: { duration: 1.1, loop: false },
      celebration: { duration: 1.2, loop: false }
    },
    thumbnail: 'assets/images/characters/sylwen-yarrow.svg',
    name: 'Sylwen Yarrow', role: { en: 'The Archive Keeper', zh: '守書人' }, difficulty: 4,
    tagline: { en: 'Marksman · Seals what she reads', zh: '精準型 · 讀過即封緘' },
    bio: {
      en: 'The elf who kept the Moon Archive long before the campus was built around it. On the night a name was cut from her shelves she saw nothing at all — and a keeper who cannot account for her own watch has one duty left: read everything, and let nothing pass unmarked.',
      zh: '早在校園繞著月之檔案館蓋起之前，這位精靈就守在那裡。有人從她的書架上剪去一個名字的那一夜，她什麼都沒看見——一個無法交代自己那班崗的守書人，只剩一項職責：讀盡一切，不讓任何東西未經標記地通過。'
    },
    colors: { primary: '#2f4a3a', accent: '#7fc9a0', light: '#bdf0d2' },
    ratings: { mobility: 3, defence: 2, control: 3, support: 4 },
    passive: { en: 'Marginalia', zh: '眉批' },
    passiveText: { en: 'Sealed targets stay readable through darkness for the whole party.', zh: '被緘印的目標穿透黑暗，整支隊伍都看得見。' },
    signature: { en: 'Closing the Index', zh: '閉架' },
    signatureText: { en: 'Seal every threat in sight at once, so the next shot from anyone lands harder.', zh: '一次緘印視野內所有威脅，任何人的下一擊都更沉重。' },
    abilityConfig: {
      passive: 'marginalia', signature: 'closing-index', primary: 'seal-arrow',
      cooldownMs: 22000, durationMs: 4000,
      primaryConfig: { sealSeconds: 6, damageMultiplier: 1.4, drawSeconds: 1.1 }
    },
    camera: { distance: 3.4, height: 1.06 }, collider: { radius: 0.7 },
    modelContract: {
      format: 'glb-2.0', authoredForwardAxis: '+Z', gameplayForwardAxis: '-Z',
      groundAxis: 'Y', groundOrigin: 0,
      bounds: { min: [-0.535, 0, -0.221], max: [0.535, 1.68, 0.221] }
    },
    attachments: {
      lantern: { node: 'LeftHand', offset: [0, 0, 0] },
      leftHand: { node: 'LeftHand', offset: [0, 0, 0] },
      rightHand: { node: 'RightHand', offset: [0, 0, 0] },
      head: { node: 'Head', offset: [0, 0, 0] },
      chest: { node: 'Spine01', offset: [0, 0, 0] },
      leftFoot: { node: 'LeftFoot', offset: [0, 0, 0] },
      rightFoot: { node: 'RightFoot', offset: [0, 0, 0] },
      // Her arrows leave the drawing hand, not a staff or a gauntlet.
      projectile: { node: 'RightHand', offset: [0, 0, 0] },
      effect: { node: 'RightHand', offset: [0, 0, 0] }
    },
    materialRules: {
      importedMaterials: ['Material_1'], tintableMaterials: [],
      accentApplication: 'ui-and-effects-only',
      fixedIdentityColors: ['#2f4a3a', '#7fc9a0', '#bdf0d2']
    },
    modelBudget: {
      maxTriangles: 32000, maxModelBytes: 10000000, maxMaterials: 1,
      maxUniqueImages: 1, maxTextureEdge: 2048, maxDecodedTextureBytes: 16777216,
      measuredTriangles: 30751, measuredModelBytes: 438868,
      measuredAnimationBytes: 1151892
    },
    animations: ['idle', 'idleListen', 'idleRead', 'turn', 'walk', 'wounded', 'run', 'lift', 'fly',
      'flyGlide', 'land', 'cast', 'castB', 'dodge', 'hit', 'hitHeavy', 'down',
      'interact', 'revive', 'celebration'],
    accessibilityDescription: {
      en: 'A slender green-skinned elf with very long silver-green hair and pointed ears, in a deep moss keeper tunic with glowing jade vine embroidery, drawing a bow of mint light.',
      zh: '一位身形纖細的綠膚精靈，長尖耳、銀綠色長髮及腰，身穿深苔綠守書人短袍，藤葉刺繡泛著翡翠微光，正拉開一張薄荷色光弓。'
    },
    licence: { status: 'project-commissioned-ai-generated', creator: 'Higgsfield (Meshy image_to_3d)', record: 'assets/models/characters/LICENSES.md' }
  }
]);

const playableById = new Map(LEGACY_PLAYABLE_CHARACTERS.map(character => [character.id, character]));
export const PLAYABLE_CHARACTERS = Object.freeze(ACTIVE_PLAYABLE_IDS.map(id => {
  const character = playableById.get(id);
  if (!character) {
    throw new Error(`Character catalog marks ${id} playable, but its presentation contract is missing.`);
  }
  return character;
}));

export function playableCharacter(id) {
  return PLAYABLE_CHARACTERS.find(character => character.id === id) || PLAYABLE_CHARACTERS[0];
}

export function localised(copy, language = document.documentElement.lang) {
  return language === 'zh-Hant' ? copy.zh : copy.en;
}
