use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fs,
    path::{Component, Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

pub const SUPPORTED_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistryDocument {
    schema_version: u32,
    catalog_version: u32,
    characters: Vec<RegistryEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegistryEntry {
    id: String,
    slug: String,
    path: String,
    release_state: ReleaseState,
    capabilities: Capabilities,
    sort_order: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchetypeDocument {
    schema_version: u32,
    archetypes: BTreeMap<String, PresentationDefaults>,
}

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
struct PresentationDefaults {
    #[serde(default)]
    appearance: Map<String, Value>,
    #[serde(default)]
    movement: Map<String, Value>,
    #[serde(default)]
    weapon: Map<String, Value>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CharacterPackage {
    schema_version: u32,
    id: String,
    slug: String,
    release_state: ReleaseState,
    content_version: u32,
    capabilities: Capabilities,
    identity: Identity,
    world: World,
    presentation: Presentation,
    #[serde(default)]
    playable: Option<Value>,
    #[serde(default)]
    network: Option<Value>,
    #[serde(default)]
    story: Option<Value>,
    #[serde(default)]
    production: Option<Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub resident: bool,
    pub story_actor: bool,
    pub playable: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ReleaseState {
    Draft,
    Review,
    Active,
    Hidden,
    Retired,
}

impl ReleaseState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Review => "review",
            Self::Active => "active",
            Self::Hidden => "hidden",
            Self::Retired => "retired",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LocalisedCopy {
    pub en: String,
    #[serde(default)]
    pub zh: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Identity {
    name: LocalisedCopy,
    role: LocalisedCopy,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct World {
    home: String,
    #[serde(default)]
    starting_activity: Option<String>,
    #[serde(default)]
    starting_goal: Option<String>,
    #[serde(default)]
    starting_mood: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct Presentation {
    archetype: String,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    appearance: Map<String, Value>,
    #[serde(default)]
    movement: Map<String, Value>,
    #[serde(default)]
    weapon: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedPresentation {
    pub archetype: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    pub appearance: Map<String, Value>,
    pub movement: Map<String, Value>,
    pub weapon: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Character {
    pub id: String,
    pub slug: String,
    pub release_state: ReleaseState,
    pub content_version: u32,
    pub capabilities: Capabilities,
    pub name: LocalisedCopy,
    pub role: LocalisedCopy,
    pub home: String,
    pub starting_activity: String,
    pub starting_goal: String,
    pub starting_mood: String,
    pub presentation: ResolvedPresentation,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub playable: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<Value>,
    #[serde(skip)]
    pub story: Option<Value>,
    #[serde(skip)]
    pub production: Option<Value>,
    #[serde(skip)]
    pub source_path: PathBuf,
    #[serde(skip)]
    pub sort_order: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub level: &'static str,
    pub character_id: String,
    pub field: &'static str,
    pub message: &'static str,
}

#[derive(Debug, Clone)]
pub struct Catalog {
    pub schema_version: u32,
    pub catalog_version: u32,
    pub characters: Vec<Character>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CatalogSnapshot {
    pub schema_version: u32,
    pub catalog_version: u32,
    pub character_ids: Vec<String>,
    pub resident_ids: Vec<String>,
    pub playable_ids: Vec<String>,
    pub story_actor_ids: Vec<String>,
}

impl Catalog {
    pub fn active_characters(&self) -> impl Iterator<Item = &Character> {
        self.characters
            .iter()
            .filter(|character| character.release_state == ReleaseState::Active)
    }

    pub fn active_residents(&self) -> impl Iterator<Item = &Character> {
        self.active_characters()
            .filter(|character| character.capabilities.resident)
    }

    pub fn active_playable(&self) -> std::vec::IntoIter<&Character> {
        let mut characters: Vec<_> = self
            .active_characters()
            .filter(|character| character.capabilities.playable)
            .collect();
        characters.sort_by_key(|character| {
            character
                .playable
                .as_ref()
                .and_then(|value| value.get("selectorOrder"))
                .and_then(Value::as_u64)
                .unwrap_or(u64::MAX)
        });
        characters.into_iter()
    }

    pub fn find(&self, id: &str) -> Option<&Character> {
        self.characters.iter().find(|character| character.id == id)
    }

    pub fn snapshot(&self) -> CatalogSnapshot {
        CatalogSnapshot {
            schema_version: self.schema_version,
            catalog_version: self.catalog_version,
            character_ids: self
                .characters
                .iter()
                .map(|character| character.id.clone())
                .collect(),
            resident_ids: self
                .active_residents()
                .map(|character| character.id.clone())
                .collect(),
            playable_ids: self
                .active_playable()
                .map(|character| character.id.clone())
                .collect(),
            story_actor_ids: self
                .active_characters()
                .filter(|character| character.capabilities.story_actor)
                .map(|character| character.id.clone())
                .collect(),
        }
    }
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path) -> Result<T> {
    let source =
        fs::read_to_string(path).with_context(|| format!("could not read {}", path.display()))?;
    serde_json::from_str(&source).with_context(|| format!("invalid JSON in {}", path.display()))
}

fn validate_stable_id(value: &str, field: &str) -> Result<()> {
    let digits = value.strip_prefix("resident-");
    if digits
        .is_none_or(|digits| digits.len() < 2 || !digits.bytes().all(|byte| byte.is_ascii_digit()))
    {
        bail!("{field}: expected resident- followed by at least two digits; received {value:?}");
    }
    Ok(())
}

fn validate_slug(value: &str, field: &str) -> Result<()> {
    let valid = !value.is_empty()
        && !value.starts_with('-')
        && !value.ends_with('-')
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-');
    if !valid {
        bail!("{field}: expected a lowercase kebab-case slug; received {value:?}");
    }
    Ok(())
}

fn validate_package_path(value: &str) -> Result<()> {
    let path = Path::new(value);
    if path.is_absolute()
        || path
            .components()
            .any(|component| !matches!(component, Component::Normal(_)))
        || path.file_name().and_then(|name| name.to_str()) != Some("character.json")
    {
        bail!("registry path must be a relative character.json path without traversal: {value:?}");
    }
    Ok(())
}

fn require_copy(value: &str, field: &str) -> Result<()> {
    if value.trim().is_empty() {
        bail!("{field}: expected non-empty English copy");
    }
    Ok(())
}

fn merge_maps(
    fallback: &Map<String, Value>,
    archetype: &Map<String, Value>,
    character: &Map<String, Value>,
) -> Map<String, Value> {
    let mut merged = fallback.clone();
    merged.extend(archetype.clone());
    merged.extend(character.clone());
    merged
}

fn fallback_defaults() -> PresentationDefaults {
    serde_json::from_value(serde_json::json!({
        "appearance": {
            "cloak": "#302b3d", "accent": "#b08a46", "lanternColor": "#ffb464",
            "height": 1, "width": 1, "hood": "soft", "accessory": "none"
        },
        "movement": {
            "style": "walk", "speed": 1, "cadence": 5, "bob": 0.035,
            "sway": 0.035, "turn": 7
        },
        "weapon": {
            "type": "wand", "name": "simple wand", "color": "#e8b06a",
            "damage": 1, "range": 18
        }
    }))
    .expect("hard-coded fallback defaults must remain valid")
}

pub fn load_catalog(root: impl AsRef<Path>) -> Result<Catalog> {
    let root = root.as_ref();
    let registry_path = root.join("registry.json");
    let registry: RegistryDocument = read_json(&registry_path)?;
    if registry.schema_version != SUPPORTED_SCHEMA_VERSION {
        bail!(
            "{} schemaVersion: expected {}; received {}",
            registry_path.display(),
            SUPPORTED_SCHEMA_VERSION,
            registry.schema_version
        );
    }
    if registry.catalog_version == 0 {
        bail!(
            "{} catalogVersion must be positive",
            registry_path.display()
        );
    }

    let archetype_path = root.join("archetypes.json");
    let archetype_document: ArchetypeDocument = read_json(&archetype_path)?;
    if archetype_document.schema_version != SUPPORTED_SCHEMA_VERSION {
        bail!(
            "{} schemaVersion: expected {}; received {}",
            archetype_path.display(),
            SUPPORTED_SCHEMA_VERSION,
            archetype_document.schema_version
        );
    }

    let mut ids = HashSet::new();
    let mut slugs = HashSet::new();
    let mut paths = HashSet::new();
    let mut orders = HashSet::new();
    let mut packages = HashMap::new();

    for entry in &registry.characters {
        validate_stable_id(&entry.id, "registry.id")?;
        validate_slug(&entry.slug, "registry.slug")?;
        validate_package_path(&entry.path)?;
        if !ids.insert(entry.id.clone()) {
            bail!("registry.id must be unique: {:?}", entry.id);
        }
        if !slugs.insert(entry.slug.clone()) {
            bail!("registry.slug must be unique: {:?}", entry.slug);
        }
        if !paths.insert(entry.path.clone()) {
            bail!("registry.path must be unique: {:?}", entry.path);
        }
        if !orders.insert(entry.sort_order) {
            bail!("registry.sortOrder must be unique: {}", entry.sort_order);
        }

        let package_path = root.join(&entry.path);
        let package: CharacterPackage = read_json(&package_path)?;
        packages.insert(entry.id.clone(), (package_path, package));
    }

    let fallback = fallback_defaults();
    let mut diagnostics = Vec::new();
    let mut characters = Vec::with_capacity(registry.characters.len());
    let mut entries = registry.characters;
    entries.sort_by_key(|entry| entry.sort_order);

    for entry in entries {
        let (source_path, package) = packages
            .remove(&entry.id)
            .with_context(|| format!("missing package for {}", entry.id))?;
        if package.schema_version != SUPPORTED_SCHEMA_VERSION {
            bail!(
                "{} schemaVersion: expected {}; received {}",
                source_path.display(),
                SUPPORTED_SCHEMA_VERSION,
                package.schema_version
            );
        }
        if package.id != entry.id {
            bail!(
                "{} id: expected {:?}; received {:?}",
                source_path.display(),
                entry.id,
                package.id
            );
        }
        if package.slug != entry.slug {
            bail!(
                "{} slug: expected {:?}; received {:?}",
                source_path.display(),
                entry.slug,
                package.slug
            );
        }
        if package.release_state != entry.release_state {
            bail!(
                "{} releaseState disagrees with registry",
                source_path.display()
            );
        }
        if package.capabilities != entry.capabilities {
            bail!(
                "{} capabilities disagree with registry",
                source_path.display()
            );
        }
        if package.content_version == 0 {
            bail!("{} contentVersion must be positive", source_path.display());
        }
        require_copy(&package.identity.name.en, "identity.name.en")?;
        require_copy(&package.identity.role.en, "identity.role.en")?;
        if package.capabilities.resident && package.world.home.trim().is_empty() {
            bail!(
                "{} world.home is required for residents",
                source_path.display()
            );
        }
        if package.capabilities.playable {
            let manifest_id = package
                .playable
                .as_ref()
                .and_then(|value| value.get("manifestId"))
                .and_then(Value::as_str);
            if manifest_id != Some(entry.id.as_str()) {
                bail!(
                    "{} playable.manifestId must equal {}",
                    source_path.display(),
                    entry.id
                );
            }
            if package
                .network
                .as_ref()
                .and_then(|value| value.get("presence"))
                .is_none()
            {
                bail!(
                    "{} network.presence is required for playable characters",
                    source_path.display()
                );
            }
        }

        let archetype = archetype_document
            .archetypes
            .get(&package.presentation.archetype)
            .with_context(|| {
                format!(
                    "{} presentation.archetype references missing {:?}",
                    source_path.display(),
                    package.presentation.archetype
                )
            })?;
        if package.capabilities.story_actor
            && package
                .story
                .as_ref()
                .and_then(|value| value.get("migrationStatus"))
                .is_some()
        {
            diagnostics.push(Diagnostic {
                level: "warning",
                character_id: entry.id.clone(),
                field: "story",
                message: "Legacy story data still needs migration into the canonical story card.",
            });
        }

        characters.push(Character {
            id: entry.id,
            slug: entry.slug,
            release_state: entry.release_state,
            content_version: package.content_version,
            capabilities: package.capabilities,
            name: package.identity.name,
            role: package.identity.role,
            home: package.world.home,
            starting_activity: package
                .world
                .starting_activity
                .unwrap_or_else(|| "wandering".to_owned()),
            starting_goal: package
                .world
                .starting_goal
                .unwrap_or_else(|| "complete tonight's duties".to_owned()),
            starting_mood: package
                .world
                .starting_mood
                .unwrap_or_else(|| "calm".to_owned()),
            presentation: ResolvedPresentation {
                archetype: package.presentation.archetype,
                body: package.presentation.body,
                appearance: merge_maps(
                    &fallback.appearance,
                    &archetype.appearance,
                    &package.presentation.appearance,
                ),
                movement: merge_maps(
                    &fallback.movement,
                    &archetype.movement,
                    &package.presentation.movement,
                ),
                weapon: merge_maps(
                    &fallback.weapon,
                    &archetype.weapon,
                    &package.presentation.weapon,
                ),
            },
            playable: package.playable,
            network: package.network,
            story: package.story,
            production: package.production,
            source_path,
            sort_order: entry.sort_order,
        });
    }

    Ok(Catalog {
        schema_version: SUPPORTED_SCHEMA_VERSION,
        catalog_version: registry.catalog_version,
        characters,
        diagnostics,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_id_validation_rejects_drift() {
        assert!(validate_stable_id("resident-20", "id").is_ok());
        assert!(validate_stable_id("kael-morrow", "id").is_err());
        assert!(validate_stable_id("resident-2", "id").is_err());
    }

    #[test]
    fn package_paths_cannot_escape_catalog_root() {
        assert!(validate_package_path("resident-01/character.json").is_ok());
        assert!(validate_package_path("../secret/character.json").is_err());
        assert!(validate_package_path("/tmp/character.json").is_err());
    }

    #[test]
    fn repository_catalog_resolves_expected_views() -> Result<()> {
        let catalog =
            load_catalog(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../data/characters"))?;
        let snapshot = catalog.snapshot();
        assert_eq!(snapshot.character_ids.len(), 20);
        assert_eq!(snapshot.resident_ids.len(), 20);
        assert_eq!(
            snapshot.playable_ids,
            [
                "resident-01",
                "resident-05",
                "resident-10",
                "resident-06",
                "resident-19",
                "resident-20"
            ]
        );
        Ok(())
    }
}
