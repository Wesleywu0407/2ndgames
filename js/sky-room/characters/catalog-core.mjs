export const CHARACTER_SCHEMA_VERSION = 1;
export const CHARACTER_RELEASE_STATES = Object.freeze([
  'draft', 'review', 'active', 'hidden', 'retired'
]);

export const CHARACTER_FALLBACK = Object.freeze({
  appearance: Object.freeze({
    cloak: '#302b3d', accent: '#b08a46', lanternColor: '#ffb464',
    height: 1, width: 1, hood: 'soft', accessory: 'none'
  }),
  movement: Object.freeze({
    style: 'walk', speed: 1, cadence: 5, bob: 0.035, sway: 0.035, turn: 7
  }),
  weapon: Object.freeze({
    type: 'wand', name: 'simple wand', color: '#e8b06a', damage: 1, range: 18
  })
});

function fail(path, rule, actual) {
  const rendered = typeof actual === 'string' ? `"${actual}"` : JSON.stringify(actual);
  throw new Error(`Character catalog ${path}: expected ${rule}; received ${rendered}`);
}

function requireString(value, path) {
  if (typeof value !== 'string' || !value.trim()) fail(path, 'a non-empty string', value);
  return value;
}

function requireBoolean(value, path) {
  if (typeof value !== 'boolean') fail(path, 'a boolean', value);
  return value;
}

function localisedEnglish(value, path) {
  if (!value || typeof value !== 'object') fail(path, 'a localised copy object', value);
  return requireString(value.en, `${path}.en`);
}

function unique(entries, property, path) {
  const seen = new Set();
  for (const entry of entries) {
    const value = entry[property];
    if (seen.has(value)) fail(`${path}.${property}`, 'a unique value', value);
    seen.add(value);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function eligibleRelease(releaseState, includeReview) {
  return releaseState === 'active' || (includeReview && releaseState === 'review');
}

export function resolveCharacterCatalog({ registry, archetypes, packages, includeReview = false }) {
  if (registry?.schemaVersion !== CHARACTER_SCHEMA_VERSION) {
    fail('registry.schemaVersion', CHARACTER_SCHEMA_VERSION, registry?.schemaVersion);
  }
  if (!Number.isInteger(registry.catalogVersion) || registry.catalogVersion < 1) {
    fail('registry.catalogVersion', 'a positive integer', registry.catalogVersion);
  }
  if (!Array.isArray(registry.characters) || !registry.characters.length) {
    fail('registry.characters', 'a non-empty array', registry.characters);
  }
  if (!archetypes || typeof archetypes !== 'object') {
    fail('archetypes', 'an object', archetypes);
  }
  if (!Array.isArray(packages) || packages.length !== registry.characters.length) {
    fail('packages', `an array of ${registry.characters.length} packages`, packages?.length);
  }

  unique(registry.characters, 'id', 'registry.characters');
  unique(registry.characters, 'slug', 'registry.characters');
  unique(registry.characters, 'path', 'registry.characters');

  const packageById = new Map();
  for (const characterPackage of packages) {
    requireString(characterPackage?.id, 'package.id');
    if (packageById.has(characterPackage.id)) fail('package.id', 'a unique value', characterPackage.id);
    packageById.set(characterPackage.id, characterPackage);
  }

  const diagnostics = [];
  const resolved = registry.characters
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(entry => {
      const path = `${entry.path} (${entry.id})`;
      const characterPackage = packageById.get(entry.id);
      if (!characterPackage) fail(path, 'a package matching the registry ID', null);
      if (characterPackage.schemaVersion !== CHARACTER_SCHEMA_VERSION) {
        fail(`${path}.schemaVersion`, CHARACTER_SCHEMA_VERSION, characterPackage.schemaVersion);
      }
      if (characterPackage.id !== entry.id) fail(`${path}.id`, entry.id, characterPackage.id);
      if (characterPackage.slug !== entry.slug) fail(`${path}.slug`, entry.slug, characterPackage.slug);
      if (characterPackage.releaseState !== entry.releaseState) {
        fail(`${path}.releaseState`, entry.releaseState, characterPackage.releaseState);
      }
      if (!CHARACTER_RELEASE_STATES.includes(entry.releaseState)) {
        fail(`${path}.releaseState`, CHARACTER_RELEASE_STATES.join(', '), entry.releaseState);
      }
      if (!Number.isInteger(characterPackage.contentVersion) || characterPackage.contentVersion < 1) {
        fail(`${path}.contentVersion`, 'a positive integer', characterPackage.contentVersion);
      }

      const capabilities = characterPackage.capabilities;
      for (const capability of ['resident', 'storyActor', 'playable']) {
        requireBoolean(capabilities?.[capability], `${path}.capabilities.${capability}`);
        if (capabilities[capability] !== entry.capabilities?.[capability]) {
          fail(`${path}.capabilities.${capability}`, entry.capabilities?.[capability], capabilities[capability]);
        }
      }
      const name = localisedEnglish(characterPackage.identity?.name, `${path}.identity.name`);
      const role = localisedEnglish(characterPackage.identity?.role, `${path}.identity.role`);
      const archetypeKey = requireString(characterPackage.presentation?.archetype,
        `${path}.presentation.archetype`);
      const archetype = archetypes[archetypeKey];
      if (!archetype) fail(`${path}.presentation.archetype`, 'a registered archetype', archetypeKey);
      if (capabilities.resident) requireString(characterPackage.world?.home, `${path}.world.home`);
      if (capabilities.playable) {
        if (characterPackage.playable?.manifestId !== entry.id) {
          fail(`${path}.playable.manifestId`, entry.id, characterPackage.playable?.manifestId);
        }
        if (!characterPackage.network?.presence) {
          fail(`${path}.network.presence`, 'a remote-presence preset', characterPackage.network?.presence);
        }
      }
      if (capabilities.storyActor && characterPackage.story?.migrationStatus) {
        diagnostics.push({
          level: 'warning',
          characterId: entry.id,
          field: 'story',
          message: 'Legacy story data still needs migration into the canonical story card.'
        });
      }

      const presentation = {
        archetype: archetypeKey,
        body: characterPackage.presentation.body || null,
        appearance: {
          ...CHARACTER_FALLBACK.appearance,
          ...(archetype.appearance || {}),
          ...(characterPackage.presentation.appearance || {})
        },
        movement: {
          ...CHARACTER_FALLBACK.movement,
          ...(archetype.movement || {}),
          ...(characterPackage.presentation.movement || {})
        },
        weapon: {
          ...CHARACTER_FALLBACK.weapon,
          ...(archetype.weapon || {}),
          ...(characterPackage.presentation.weapon || {})
        }
      };

      return {
        ...characterPackage,
        registryPath: entry.path,
        sortOrder: entry.sortOrder,
        identity: { ...characterPackage.identity, name: characterPackage.identity.name, role: characterPackage.identity.role },
        presentation,
        profile: {
          id: entry.id,
          name,
          role,
          archetype: archetypeKey,
          body: presentation.body,
          appearance: presentation.appearance,
          movement: presentation.movement,
          weapon: presentation.weapon
        }
      };
    });

  const characterById = new Map(resolved.map(character => [character.id, character]));
  const eligible = resolved.filter(character => eligibleRelease(character.releaseState, includeReview));
  const activeResidents = eligible.filter(character => character.capabilities.resident);
  const activePlayableCharacters = eligible
    .filter(character => character.capabilities.playable)
    .sort((left, right) => left.playable.selectorOrder - right.playable.selectorOrder);
  const storyActors = eligible.filter(character => character.capabilities.storyActor);
  const networkCharacterSummary = activePlayableCharacters.map(character => ({
    id: character.id,
    slug: character.slug,
    name: character.identity.name.en,
    presence: character.network.presence
  }));

  return deepFreeze({
    schemaVersion: CHARACTER_SCHEMA_VERSION,
    catalogVersion: registry.catalogVersion,
    includeReview,
    allCharacters: resolved,
    activeResidents,
    activePlayableCharacters,
    storyActors,
    characterById,
    networkCharacterSummary,
    resolvedWorldSeed: activeResidents.map(character => ({
      id: character.id,
      name: character.identity.name.en,
      role: character.identity.role.en,
      home: character.world.home,
      activity: character.world.startingActivity || 'wandering',
      goal: character.world.startingGoal || "complete tonight's duties",
      mood: character.world.startingMood || 'calm',
      contentVersion: character.contentVersion,
      releaseState: character.releaseState,
      profile: character.profile
    })),
    diagnostics
  });
}

export function catalogSnapshot(catalog) {
  return {
    schemaVersion: catalog.schemaVersion,
    catalogVersion: catalog.catalogVersion,
    characterIds: catalog.allCharacters.map(character => character.id),
    residentIds: catalog.activeResidents.map(character => character.id),
    playableIds: catalog.activePlayableCharacters.map(character => character.id),
    storyActorIds: catalog.storyActors.map(character => character.id)
  };
}
