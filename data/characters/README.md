# Sky Room character catalog

This directory is the authored source of truth for character discovery,
resident presentation, release state, and capability membership.

## Five-minute procedural resident

1. Reserve the next never-used `resident-XX` ID and an immutable kebab-case
   slug.
2. Copy a nearby non-playable package folder and edit its `character.json`.
3. Set identity, home, archetype, procedural presentation overrides, release
   state, and capability flags.
4. Add one small matching entry to `registry.json`.
5. Validate it:

```sh
/Users/wumingjuan/.cargo/bin/cargo run --manifest-path rust-backend/Cargo.toml -- check
node scripts/qa-character-contract.mjs
```

An active resident using an existing archetype needs no JavaScript or server
roster edit. The browser and Living World derive it from the registry.

## Release rules

- `draft`: authoring only.
- `review`: available only when the browser uses `?character-review=1`.
- `active`: eligible consumers discover the declared capabilities.
- `hidden`: remains loadable for compatibility but is not newly offered.
- `retired`: preserved for migrations and old state.

Never reuse an ID or slug. Never put executable code in a package. New
mechanics are registered and reviewed in code; character packages only select
those mechanics.

## Current compatibility bridge

Playable packages currently use `playable.manifestId` to join the catalog
capability record to the existing high-detail model, animation, ability, and
selector contract in `js/sky-room/characters/manifest.js`. This bridge prevents
runtime regressions while those large records move into their packages.

The validator fails when an active playable package has no manifest contract,
so release state cannot silently create a client/server mismatch.
