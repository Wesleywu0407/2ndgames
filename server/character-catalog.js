'use strict';

const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { resolveCharacterCatalog, catalogSnapshot } =
  require('../js/sky-room/characters/catalog-core.mjs');

const ROOT = resolve(__dirname, '..');
const CATALOG_ROOT = resolve(ROOT, 'data/characters');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadCharacterCatalog({ includeReview = false } = {}) {
  const registry = readJson(resolve(CATALOG_ROOT, 'registry.json'));
  const archetypeDocument = readJson(resolve(CATALOG_ROOT, 'archetypes.json'));
  const packages = registry.characters.map(entry => readJson(resolve(CATALOG_ROOT, entry.path)));
  return resolveCharacterCatalog({
    registry,
    archetypes: archetypeDocument.archetypes,
    packages,
    includeReview
  });
}

const CHARACTER_CATALOG = loadCharacterCatalog();

module.exports = {
  CHARACTER_CATALOG,
  loadCharacterCatalog,
  catalogSnapshot
};
