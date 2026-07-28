# Sky Room character backend (Rust)

This service implements the character-data boundary described in
`SKY_ROOM_CHARACTER_DATA_BACKEND_PLAN.md`.

- `data/characters/` is the authored source of truth.
- `check` validates registry/package parity, stable IDs, capabilities,
  archetypes, playable network contracts, and safe package paths.
- `sync` transactionally caches resolved authored definitions in SQLite.
- `serve` exposes filtered read-only catalog endpoints.
- The synchronizer never updates or deletes evolving NPC state, memories, or
  relationships.

From the repository root:

```sh
/Users/wumingjuan/.cargo/bin/cargo run --manifest-path rust-backend/Cargo.toml -- check
/Users/wumingjuan/.cargo/bin/cargo run --manifest-path rust-backend/Cargo.toml -- sync \
  --database server/data/sky-world.db
/Users/wumingjuan/.cargo/bin/cargo run --manifest-path rust-backend/Cargo.toml -- serve \
  --database server/data/sky-world.db
```

The read-only API defaults to `http://127.0.0.1:4330`:

- `GET /api/health`
- `GET /api/catalog`
- `GET /api/characters`
- `GET /api/characters/{resident-id}`

Use `RUST_LOG=debug` for more detailed server logs.
