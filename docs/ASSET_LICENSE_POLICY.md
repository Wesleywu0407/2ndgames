# Sky Room — External Asset Licence Policy

## Purpose

Sky Room is stored in a public GitHub repository. An asset must therefore be legal both inside the playable game and as a file distributed from the repository. Permission to use an asset in a rendered game does not automatically permit redistributing its source or derived model publicly.

## Accepted licences

An external model, texture, animation, sound, or derived asset may be committed only when its recorded licence explicitly supports the intended use.

- **CC0 / public domain:** preferred.
- **CC BY:** accepted when attribution, modification notices, and licence links are recorded and shipped.
- **Commercial or custom licence:** accepted only when it clearly permits modification, use in games, and distribution of the game-ready derivative through this public repository.
- **Original commissioned work:** accepted when the project has written rights to modify and redistribute the delivered source and game-ready exports.

## Rejected or quarantined licences

Do not commit assets marked:

- Editorial Only.
- No Derivatives / CC BY-ND.
- Non-Commercial / CC BY-NC unless the entire project use has been formally limited and reviewed.
- Personal use only.
- Extracted from another game, film, application, or copyrighted franchise.
- AI-generated without a traceable source and acceptable platform terms.
- Unknown, missing, contradictory, or unverifiable licence.
- Permitted only in a compiled product when this repository would expose a reusable raw or derived asset.

Assets that are useful for private evaluation but lack repository redistribution permission must stay outside the repository until replaced or separately licensed.

## Required evidence

Before download or modification, record:

1. Asset name and stable source URL.
2. Creator or publisher.
3. Licence name and licence URL or saved licence text.
4. Download date.
5. Whether commercial game use is permitted.
6. Whether modification is permitted.
7. Whether a game-ready derivative may be distributed in this public repository.
8. Required attribution.
9. Intended Sky Room use.

If any answer is unclear, the asset is not approved.

## Review gates

### Candidate

The source has been found but no files are committed. Licence evidence may still be under review.

### Approved for prototype

The asset can be evaluated locally. This status does not automatically allow committing it.

### Approved for repository

The licence record confirms the game-ready derivative may be committed publicly. Required attribution and notices are present.

### Rejected

The asset fails legal, provenance, art-direction, technical, or performance requirements. Local copies should not become project dependencies.

## Modification record

Every committed derivative must list meaningful changes, including applicable retopology, rerigging, UV changes, texture replacement, clothing redesign, removed materials, animation retargeting, optimisation, compression, and export settings.

## Repository rules

- Store only the files needed to build or run the game.
- Do not commit marketplace archives, source ZIP files, account receipts, or unrelated demo scenes.
- Do not remove author names, licence files, metadata, or required attribution.
- Prefer a project-authored game-ready GLB over an untouched marketplace asset.
- Keep source-specific notices beside the asset and summarise them in `assets/models/characters/LICENSES.md`.
- Review licence compatibility again before publishing, selling, or moving the project to another distribution model.

This policy is a project gate, not legal advice. Ambiguous high-value assets require confirmation from the rights holder or qualified legal review.
