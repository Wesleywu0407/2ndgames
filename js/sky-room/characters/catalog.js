import { resolveCharacterCatalog, catalogSnapshot } from './catalog-core.mjs';

const CATALOG_ROOT = new URL('../../../data/characters/', import.meta.url);
const CATALOG_ASSET_VERSION = 'playable-roster-2';

async function fetchJson(url) {
  if (typeof window === 'undefined') {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(url, 'utf8'));
  }
  const requestUrl = new URL(url);
  requestUrl.searchParams.set('v', CATALOG_ASSET_VERSION);
  const response = await fetch(requestUrl);
  if (!response.ok) throw new Error(`Character catalog HTTP ${response.status}: ${url.pathname}`);
  return response.json();
}

export async function loadCharacterCatalog({ includeReview = false } = {}) {
  const registry = await fetchJson(new URL('registry.json', CATALOG_ROOT));
  const archetypeDocument = await fetchJson(new URL('archetypes.json', CATALOG_ROOT));
  const packages = await Promise.all(registry.characters.map(entry =>
    fetchJson(new URL(entry.path, CATALOG_ROOT))
  ));
  return resolveCharacterCatalog({
    registry,
    archetypes: archetypeDocument.archetypes,
    packages,
    includeReview
  });
}

const includeReview = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('character-review');

export const CHARACTER_CATALOG = await loadCharacterCatalog({ includeReview });
export const ACTIVE_PLAYABLE_CHARACTERS = CHARACTER_CATALOG.activePlayableCharacters;
export const ACTIVE_PLAYABLE_IDS = Object.freeze(ACTIVE_PLAYABLE_CHARACTERS.map(character => character.id));
export const CHARACTER_CATALOG_SNAPSHOT = Object.freeze(catalogSnapshot(CHARACTER_CATALOG));
