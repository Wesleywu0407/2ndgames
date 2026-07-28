import { CHARACTER_CATALOG } from './sky-room/characters/catalog.js';
import { CHARACTER_FALLBACK } from './sky-room/characters/catalog-core.mjs';

let profileMap = new Map();

export async function loadCharacterProfiles() {
  profileMap = new Map(CHARACTER_CATALOG.allCharacters.map(character => [
    character.id,
    character.profile
  ]));
  return { version: CHARACTER_CATALOG.catalogVersion, profiles: profileMap };
}

export function characterProfile(id) {
  return profileMap.get(id) || {
    id,
    name: `Resident ${id.slice(-2)}`,
    role: 'resident',
    archetype: 'resident',
    appearance: { ...CHARACTER_FALLBACK.appearance },
    movement: { ...CHARACTER_FALLBACK.movement },
    weapon: { ...CHARACTER_FALLBACK.weapon }
  };
}

export function colorNumber(value, fallback = 0xffffff) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value.replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}
