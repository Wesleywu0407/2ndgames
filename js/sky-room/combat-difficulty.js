export const COMBAT_DIFFICULTIES = Object.freeze({
  story: Object.freeze({
    id: 'story', health: 0.78, damage: 0.7, speed: 0.9,
    detection: 0.9, windup: 1.22, postHitInvulnerability: 0.9,
    baseAttackers: 1
  }),
  normal: Object.freeze({
    id: 'normal', health: 1, damage: 1, speed: 1,
    detection: 1, windup: 1, postHitInvulnerability: 0.65,
    baseAttackers: 1
  }),
  warden: Object.freeze({
    id: 'warden', health: 1.12, damage: 1.22, speed: 1.12,
    detection: 1.12, windup: 0.84, postHitInvulnerability: 0.48,
    baseAttackers: 2
  })
});

export function combatTuning(difficulty = 'normal', partySize = 1) {
  const preset = COMBAT_DIFFICULTIES[difficulty] || COMBAT_DIFFICULTIES.normal;
  const party = Math.max(1, Math.min(4, Math.round(Number(partySize) || 1)));
  // Parties gain pressure primarily through coverage. Health grows only 12%
  // per extra lantern, avoiding the four-player "quadruple sponge" problem.
  return {
    ...preset,
    partySize: party,
    health: preset.health * (1 + (party - 1) * 0.12),
    maxAttackers: Math.min(4, preset.baseAttackers + Math.floor(party / 2))
  };
}

