use std::{
    collections::HashSet,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result};
use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;
use serde_json::json;

use crate::catalog::{Catalog, Character};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub database: PathBuf,
    pub catalog_version: u32,
    pub synchronized: usize,
    pub inserted: usize,
    pub updated: usize,
    pub preserved_missing: usize,
}

fn definition_json(character: &Character) -> Result<String> {
    Ok(serde_json::to_string(&json!({
        "id": character.id,
        "slug": character.slug,
        "releaseState": character.release_state,
        "contentVersion": character.content_version,
        "capabilities": character.capabilities,
        "identity": {
            "name": character.name,
            "role": character.role
        },
        "world": {
            "home": character.home,
            "startingActivity": character.starting_activity,
            "startingGoal": character.starting_goal,
            "startingMood": character.starting_mood
        },
        "presentation": character.presentation,
        "playable": character.playable,
        "network": character.network,
        "story": character.story,
        "production": character.production
    }))?)
}

fn create_schema(connection: &Connection) -> Result<()> {
    connection
        .execute_batch(
            r#"
        PRAGMA foreign_keys = ON;
        PRAGMA busy_timeout = 3000;

        CREATE TABLE IF NOT EXISTS character_catalog_meta (
          singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
          schema_version INTEGER NOT NULL,
          catalog_version INTEGER NOT NULL,
          synchronized_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS character_definitions (
          character_id TEXT PRIMARY KEY,
          slug TEXT NOT NULL UNIQUE,
          release_state TEXT NOT NULL,
          content_version INTEGER NOT NULL,
          is_resident INTEGER NOT NULL,
          is_story_actor INTEGER NOT NULL,
          is_playable INTEGER NOT NULL,
          display_name TEXT NOT NULL,
          role TEXT NOT NULL,
          home TEXT NOT NULL,
          definition_json TEXT NOT NULL,
          synchronized_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS character_migrations (
          migration_id TEXT PRIMARY KEY,
          applied_at INTEGER NOT NULL,
          details_json TEXT NOT NULL DEFAULT '{}'
        );
        "#,
        )
        .context("could not create character backend schema")
}

fn sync_connection(
    connection: &mut Connection,
    catalog: &Catalog,
    database: PathBuf,
) -> Result<SyncReport> {
    create_schema(connection)?;
    let existing_ids: HashSet<String> = {
        let mut statement = connection.prepare("SELECT character_id FROM character_definitions")?;
        statement
            .query_map([], |row| row.get(0))?
            .collect::<rusqlite::Result<_>>()?
    };
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .context("system clock is before the Unix epoch")?
        .as_millis() as i64;

    let transaction = connection
        .transaction()
        .context("could not begin character catalog transaction")?;
    let mut inserted = 0;
    let mut updated = 0;
    {
        let mut upsert = transaction.prepare(
            r#"
            INSERT INTO character_definitions (
              character_id, slug, release_state, content_version,
              is_resident, is_story_actor, is_playable,
              display_name, role, home, definition_json, synchronized_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(character_id) DO UPDATE SET
              slug=excluded.slug,
              release_state=excluded.release_state,
              content_version=excluded.content_version,
              is_resident=excluded.is_resident,
              is_story_actor=excluded.is_story_actor,
              is_playable=excluded.is_playable,
              display_name=excluded.display_name,
              role=excluded.role,
              home=excluded.home,
              definition_json=excluded.definition_json,
              synchronized_at=excluded.synchronized_at
            "#,
        )?;
        for character in &catalog.characters {
            if existing_ids.contains(&character.id) {
                updated += 1;
            } else {
                inserted += 1;
            }
            upsert.execute(params![
                character.id,
                character.slug,
                character.release_state.as_str(),
                character.content_version,
                character.capabilities.resident,
                character.capabilities.story_actor,
                character.capabilities.playable,
                character.name.en,
                character.role.en,
                character.home,
                definition_json(character)?,
                now
            ])?;
        }
    }
    transaction.execute(
        r#"
        INSERT INTO character_catalog_meta (
          singleton, schema_version, catalog_version, synchronized_at
        ) VALUES (1, ?, ?, ?)
        ON CONFLICT(singleton) DO UPDATE SET
          schema_version=excluded.schema_version,
          catalog_version=excluded.catalog_version,
          synchronized_at=excluded.synchronized_at
        "#,
        params![catalog.schema_version, catalog.catalog_version, now],
    )?;
    transaction
        .commit()
        .context("could not commit character catalog transaction")?;

    let current_ids: HashSet<&str> = catalog
        .characters
        .iter()
        .map(|character| character.id.as_str())
        .collect();
    let preserved_missing = existing_ids
        .iter()
        .filter(|id| !current_ids.contains(id.as_str()))
        .count();
    Ok(SyncReport {
        database,
        catalog_version: catalog.catalog_version,
        synchronized: catalog.characters.len(),
        inserted,
        updated,
        preserved_missing,
    })
}

pub fn sync_catalog(catalog: &Catalog, database: impl AsRef<Path>) -> Result<SyncReport> {
    let database = database.as_ref().to_path_buf();
    if let Some(parent) = database.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("could not create {}", parent.display()))?;
    }
    let mut connection = Connection::open(&database)
        .with_context(|| format!("could not open {}", database.display()))?;
    sync_connection(&mut connection, catalog, database)
}

pub fn stored_catalog_version(database: impl AsRef<Path>) -> Result<Option<u32>> {
    let connection = Connection::open(database.as_ref())?;
    create_schema(&connection)?;
    connection
        .query_row(
            "SELECT catalog_version FROM character_catalog_meta WHERE singleton=1",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;
    use serde_json::Map;

    use crate::catalog::{
        Capabilities, Catalog, Character, LocalisedCopy, ReleaseState, ResolvedPresentation,
    };

    use super::*;

    fn test_catalog() -> Catalog {
        Catalog {
            schema_version: 1,
            catalog_version: 7,
            characters: vec![Character {
                id: "resident-21".to_owned(),
                slug: "test-resident".to_owned(),
                release_state: ReleaseState::Active,
                content_version: 1,
                capabilities: Capabilities {
                    resident: true,
                    story_actor: false,
                    playable: false,
                },
                name: LocalisedCopy {
                    en: "Test Resident".to_owned(),
                    zh: None,
                },
                role: LocalisedCopy {
                    en: "tester".to_owned(),
                    zh: None,
                },
                home: "great hall".to_owned(),
                starting_activity: "wandering".to_owned(),
                starting_goal: "test the catalog".to_owned(),
                starting_mood: "focused".to_owned(),
                presentation: ResolvedPresentation {
                    archetype: "student".to_owned(),
                    body: None,
                    appearance: Map::new(),
                    movement: Map::new(),
                    weapon: Map::new(),
                },
                playable: None,
                network: None,
                story: None,
                production: None,
                source_path: PathBuf::new(),
                sort_order: 1,
            }],
            diagnostics: Vec::new(),
        }
    }

    #[test]
    fn synchronization_does_not_touch_evolving_world_tables() -> Result<()> {
        let mut connection = Connection::open_in_memory()?;
        connection.execute_batch(
            "CREATE TABLE npcs (id TEXT PRIMARY KEY, mood TEXT NOT NULL);
             INSERT INTO npcs VALUES ('resident-21', 'changed-by-player');",
        )?;
        sync_connection(&mut connection, &test_catalog(), PathBuf::from(":memory:"))?;
        let mood: String =
            connection.query_row("SELECT mood FROM npcs WHERE id='resident-21'", [], |row| {
                row.get(0)
            })?;
        assert_eq!(mood, "changed-by-player");
        Ok(())
    }

    #[test]
    fn synchronization_preserves_definitions_missing_from_new_catalog() -> Result<()> {
        let mut connection = Connection::open_in_memory()?;
        create_schema(&connection)?;
        connection.execute(
            r#"INSERT INTO character_definitions
              (character_id, slug, release_state, content_version, is_resident,
               is_story_actor, is_playable, display_name, role, home,
               definition_json, synchronized_at)
              VALUES ('resident-99', 'old-resident', 'retired', 1, 1, 0, 0,
                      'Old Resident', 'archived', 'great hall', '{}', 0)"#,
            [],
        )?;
        let report = sync_connection(&mut connection, &test_catalog(), PathBuf::from(":memory:"))?;
        assert_eq!(report.preserved_missing, 1);
        let count: u32 = connection.query_row(
            "SELECT COUNT(*) FROM character_definitions WHERE character_id='resident-99'",
            [],
            |row| row.get(0),
        )?;
        assert_eq!(count, 1);
        Ok(())
    }
}
