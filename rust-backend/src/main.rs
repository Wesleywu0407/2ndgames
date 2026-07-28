use std::{net::SocketAddr, path::PathBuf};

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use sky_room_character_backend::{api, load_catalog, sync_catalog};
use tracing_subscriber::EnvFilter;

#[derive(Debug, Parser)]
#[command(name = "sky-room-character-backend")]
#[command(about = "Validate, synchronize, and serve the Sky Room character catalog")]
struct Cli {
    /// Directory containing registry.json and the per-character packages.
    #[arg(long, global = true, env = "SKY_CHARACTER_CATALOG")]
    catalog: Option<PathBuf>,

    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Validate the complete catalog and print its derived roster snapshot.
    Check {
        /// Print machine-readable JSON.
        #[arg(long)]
        json: bool,
    },
    /// Transactionally synchronize authored definitions into SQLite.
    Sync {
        #[arg(long, env = "SKY_WORLD_DB_PATH")]
        database: PathBuf,
    },
    /// Serve read-only public character catalog endpoints.
    Serve {
        #[arg(long, default_value = "127.0.0.1")]
        host: String,
        #[arg(long, default_value_t = 4330)]
        port: u16,
        /// Synchronize the catalog to this database before opening the port.
        #[arg(long, env = "SKY_WORLD_DB_PATH")]
        database: Option<PathBuf>,
    },
}

fn default_catalog_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../data/characters")
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("sky_room_character_backend=info")),
        )
        .init();

    let cli = Cli::parse();
    let catalog_path = cli.catalog.unwrap_or_else(default_catalog_path);
    let catalog = load_catalog(&catalog_path)
        .with_context(|| format!("character catalog rejected: {}", catalog_path.display()))?;

    match cli.command {
        Command::Check { json } => {
            let snapshot = catalog.snapshot();
            if json {
                println!("{}", serde_json::to_string_pretty(&snapshot)?);
            } else {
                println!(
                    "Character catalog v{} passed: {} characters, {} residents, {} playable, {} warning(s).",
                    snapshot.catalog_version,
                    snapshot.character_ids.len(),
                    snapshot.resident_ids.len(),
                    snapshot.playable_ids.len(),
                    catalog.diagnostics.len()
                );
                for diagnostic in &catalog.diagnostics {
                    println!(
                        "{} {}.{}: {}",
                        diagnostic.level,
                        diagnostic.character_id,
                        diagnostic.field,
                        diagnostic.message
                    );
                }
            }
        }
        Command::Sync { database } => {
            let report = sync_catalog(&catalog, database)?;
            println!("{}", serde_json::to_string_pretty(&report)?);
        }
        Command::Serve {
            host,
            port,
            database,
        } => {
            if let Some(database) = database {
                let report = sync_catalog(&catalog, database)?;
                tracing::info!(
                    synchronized = report.synchronized,
                    inserted = report.inserted,
                    updated = report.updated,
                    preserved_missing = report.preserved_missing,
                    "character definitions synchronized"
                );
            }
            let address: SocketAddr = format!("{host}:{port}")
                .parse()
                .with_context(|| format!("invalid listen address {host}:{port}"))?;
            api::serve(catalog, address).await?;
        }
    }
    Ok(())
}
