export const MAX_ACTIVE_ENEMIES = 14;
export const MAX_LOCAL_PROJECTILES = 4;
export const MAX_AUDIO_SFX_VOICES = 32;

export function effectBudgets(quality = 'balanced') {
  const preset = ['high', 'balanced', 'performance'].includes(quality) ? quality : 'balanced';
  const performance = preset === 'performance';
  return Object.freeze({
    quality: preset,
    enemies: MAX_ACTIVE_ENEMIES,
    projectiles: MAX_LOCAL_PROJECTILES,
    audioSfxVoices: MAX_AUDIO_SFX_VOICES,
    combat: Object.freeze({
      impacts: preset === 'high' ? 30 : performance ? 14 : 22,
      motes: preset === 'high' ? 18 : performance ? 8 : 12,
      restorations: performance ? 3 : 5
    }),
    chancellor: Object.freeze({
      tolls: performance ? 2 : 3,
      impacts: performance ? 8 : preset === 'high' ? 16 : 12
    }),
    buildingFire: Object.freeze({
      socketsPerWard: preset === 'high' ? 4 : performance ? 2 : 3,
      smokeSpritesPerSocket: 2,
      residentsPerWard: 3
    })
  });
}
