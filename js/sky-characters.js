const FALLBACK = {
  appearance: {
    cloak: '#302b3d', accent: '#b08a46', lanternColor: '#ffb464',
    height: 1, width: 1, hood: 'soft', accessory: 'none'
  },
  movement: { style: 'walk', speed: 1, cadence: 5, bob: 0.035, sway: 0.035, turn: 7 },
  weapon: { type: 'wand', name: 'simple wand', color: '#e8b06a', damage: 1, range: 18 }
};

let profileMap = new Map();

export async function loadCharacterProfiles() {
  try {
    const response = await fetch(new URL('../data/sky-characters.json', import.meta.url));
    if (!response.ok) throw new Error(`Character data HTTP ${response.status}`);
    const data = await response.json();
    const archetypes = data.archetypes || {};
    profileMap = new Map((data.characters || []).map(character => {
      const archetype = archetypes[character.archetype] || {};
      return [character.id, {
        ...character,
        appearance: { ...FALLBACK.appearance, ...archetype.appearance, ...character.appearance },
        movement: { ...FALLBACK.movement, ...archetype.movement, ...character.movement },
        weapon: { ...FALLBACK.weapon, ...archetype.weapon, ...character.weapon }
      }];
    }));
    return { version: data.version || 1, profiles: profileMap };
  } catch (error) {
    console.warn('Sky Room character profiles unavailable; using fallback figures.', error);
    profileMap = new Map();
    return { version: 0, profiles: profileMap };
  }
}

export function characterProfile(id) {
  return profileMap.get(id) || {
    id,
    name: `Resident ${id.slice(-2)}`,
    role: 'resident',
    archetype: 'resident',
    appearance: { ...FALLBACK.appearance },
    movement: { ...FALLBACK.movement },
    weapon: { ...FALLBACK.weapon }
  };
}

export function colorNumber(value, fallback = 0xffffff) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return fallback;
  const parsed = Number.parseInt(value.replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}
