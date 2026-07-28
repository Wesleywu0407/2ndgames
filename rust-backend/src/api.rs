use std::{net::SocketAddr, sync::Arc};

use anyhow::Result;
use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::get,
};
use serde::Serialize;
use serde_json::{Value, json};

use crate::catalog::{Catalog, CatalogSnapshot, Character};

#[derive(Clone)]
struct AppState {
    catalog: Arc<Catalog>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    ok: bool,
    schema_version: u32,
    catalog_version: u32,
    characters: usize,
    active_residents: usize,
    active_playable_characters: usize,
    diagnostics: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CharacterSummary {
    id: String,
    slug: String,
    name: String,
    role: String,
    release_state: &'static str,
    capabilities: crate::catalog::Capabilities,
}

async fn health(State(state): State<AppState>) -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        schema_version: state.catalog.schema_version,
        catalog_version: state.catalog.catalog_version,
        characters: state.catalog.characters.len(),
        active_residents: state.catalog.active_residents().count(),
        active_playable_characters: state.catalog.active_playable().count(),
        diagnostics: state.catalog.diagnostics.len(),
    })
}

async fn snapshot(State(state): State<AppState>) -> Json<CatalogSnapshot> {
    Json(state.catalog.snapshot())
}

async fn characters(State(state): State<AppState>) -> Json<Vec<CharacterSummary>> {
    let summaries = state
        .catalog
        .active_characters()
        .map(|character| CharacterSummary {
            id: character.id.clone(),
            slug: character.slug.clone(),
            name: character.name.en.clone(),
            role: character.role.en.clone(),
            release_state: character.release_state.as_str(),
            capabilities: character.capabilities.clone(),
        })
        .collect();
    Json(summaries)
}

async fn character(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Character>, ApiError> {
    state
        .catalog
        .find(&id)
        .filter(|character| character.release_state == crate::catalog::ReleaseState::Active)
        .cloned()
        .map(Json)
        .ok_or_else(|| ApiError::not_found(format!("unknown active character {id:?}")))
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn not_found(message: String) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            message,
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.status, Json::<Value>(json!({ "error": self.message }))).into_response()
    }
}

pub fn router(catalog: Arc<Catalog>) -> Router {
    Router::new()
        .route("/api/health", get(health))
        .route("/api/catalog", get(snapshot))
        .route("/api/characters", get(characters))
        .route("/api/characters/{id}", get(character))
        .with_state(AppState { catalog })
}

pub async fn serve(catalog: Catalog, address: SocketAddr) -> Result<()> {
    let listener = tokio::net::TcpListener::bind(address).await?;
    tracing::info!(%address, "Sky Room character backend listening");
    axum::serve(listener, router(Arc::new(catalog)))
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}
