use iron_core::config::{
    CustomModelInput, CustomModelRecord, DefaultModelInput, McpServerConfigInput,
    McpServerConfigRecord, ProviderConfigInput, SkillSettingsInput, SkillSettingsRecord,
};
use iron_core::provider_credential::domain::StoredCredential;
use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

use crate::core_config::CoreConfig;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingRow {
    pub key: String,
    pub value: String,
}

/// App-owned settings that remain in the AgentIron `settings` table.
const APP_OWNED_KEYS: [&str; 7] = [
    "theme",
    "autostart",
    "quick_launch_shortcut",
    "starred_models",
    "user_profile",
    "model_registry",
    "model_registry_updated",
];

/// Core-owned settings that are routed through `iron-core` config APIs.
const CORE_OWNED_KEYS: [&str; 5] = [
    "providers",
    "default_model",
    "custom_models",
    "mcp_servers",
    "skills",
];

fn db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data directory: {e}"))?;
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;
    Ok(app_data_dir.join("agentiron.db"))
}

pub fn ensure_settings_schema_inner(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(include_str!("../../migrations/001_initial.sql"))
        .map_err(|e| format!("Failed to initialize settings schema: {e}"))?;
    conn.execute_batch(include_str!(
        "../../migrations/002_provider_credentials.sql"
    ))
    .map_err(|e| format!("Failed to initialize credential schema: {e}"))
}

fn open_settings_db(app: &AppHandle) -> Result<Connection, String> {
    let conn = Connection::open(db_path(app)?).map_err(|e| format!("Failed to open DB: {e}"))?;
    ensure_settings_schema_inner(&conn)?;
    Ok(conn)
}

pub fn ensure_settings_schema(app: &AppHandle) -> Result<(), String> {
    open_settings_db(app).map(|_| ())
}

#[tauri::command]
pub async fn load_settings_rows(
    app: AppHandle,
    config: State<'_, CoreConfig>,
) -> Result<Vec<SettingRow>, String> {
    let config = config.store.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let rt = tokio::runtime::Handle::current();
        let conn = open_settings_db(&app)?;

        // Load app-owned rows from the legacy settings table.
        let mut stmt = conn
            .prepare("SELECT key, value FROM settings")
            .map_err(|e| format!("Failed to prepare settings load: {e}"))?;
        let app_rows = stmt
            .query_map([], |row| {
                Ok(SettingRow {
                    key: row.get::<usize, String>(0)?,
                    value: row.get::<usize, String>(1)?,
                })
            })
            .map_err(|e| format!("Failed to query settings: {e}"))?;
        let mut rows: Vec<SettingRow> = app_rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to read settings rows: {e}"))?;

        // Ensure core-owned keys are present (read from iron-core config store).
        let core_rows = rt.block_on(load_core_owned_settings(&config))?;
        rows.extend(core_rows);

        Ok(rows)
    })
    .await
    .map_err(|e| format!("Settings task failed: {e}"))?
}

async fn load_core_owned_settings(
    store: &iron_core::config::ConfigStore,
) -> Result<Vec<SettingRow>, String> {
    let mut rows = Vec::new();

    let provider_configs = store
        .list_provider_configs()
        .await
        .map_err(|e| format!("Failed to load provider configs: {e}"))?;
    let credentials = store
        .list_credential_slugs()
        .await
        .map_err(|e| format!("Failed to list credential slugs: {e}"))?;

    let providers: Vec<ProviderConfigJson> = provider_configs
        .into_iter()
        .map(|p| ProviderConfigJson {
            id: p.provider_slug.clone(),
            name: p.display_name,
            api_key: None,
            base_url: p.base_url,
            enabled: p.enabled,
        })
        .collect();

    // Fill in API keys from the credential store without exposing them in logs.
    let mut providers_with_keys = providers;
    for provider in &mut providers_with_keys {
        if credentials.contains(&provider.id) {
            if let Ok(Some(bytes)) = store.get_credential(&provider.id).await {
                provider.api_key = match serde_json::from_slice::<StoredCredential>(&bytes) {
                    Ok(StoredCredential::ApiKey(key)) => Some(key),
                    Ok(StoredCredential::OAuthBearer(_)) => None,
                    Err(_) => None,
                };
            }
        }
    }
    rows.push(SettingRow {
        key: "providers".to_string(),
        value: serde_json::to_string(&providers_with_keys)
            .map_err(|e| format!("Failed to serialize providers: {e}"))?,
    });

    if let Some(default) = store
        .get_default_model()
        .await
        .map_err(|e| format!("Failed to load default model: {e}"))?
    {
        rows.push(SettingRow {
            key: "default_model".to_string(),
            value: format!("{}/{}", default.provider_slug, default.model_id),
        });
    }

    let custom_models = store
        .list_custom_models(None)
        .await
        .map_err(|e| format!("Failed to load custom models: {e}"))?;
    rows.push(SettingRow {
        key: "custom_models".to_string(),
        value: serde_json::to_string(
            &custom_models
                .into_iter()
                .map(ModelInfoJson::from)
                .collect::<Vec<_>>(),
        )
        .map_err(|e| format!("Failed to serialize custom models: {e}"))?,
    });

    let mcp_servers = store
        .list_mcp_servers()
        .await
        .map_err(|e| format!("Failed to load MCP servers: {e}"))?;
    rows.push(SettingRow {
        key: "mcp_servers".to_string(),
        value: serde_json::to_string(
            &mcp_servers
                .into_iter()
                .map(McpServerConfigJson::from)
                .collect::<Vec<_>>(),
        )
        .map_err(|e| format!("Failed to serialize MCP servers: {e}"))?,
    });

    let skills = store
        .get_skill_settings()
        .await
        .map_err(|e| format!("Failed to load skill settings: {e}"))?;
    rows.push(SettingRow {
        key: "skills".to_string(),
        value: serde_json::to_string(&SkillSettingsJson::from(skills))
            .map_err(|e| format!("Failed to serialize skill settings: {e}"))?,
    });

    Ok(rows)
}

#[tauri::command]
pub async fn save_setting_row(
    app: AppHandle,
    config: State<'_, CoreConfig>,
    key: String,
    value: String,
) -> Result<(), String> {
    if CORE_OWNED_KEYS.contains(&key.as_str()) {
        let store = config.store.clone();
        return save_core_owned_setting(&store, &key, &value)
            .await
            .map_err(|e| format!("Failed to save core-owned setting '{}': {}", key, e));
    }

    if !APP_OWNED_KEYS.contains(&key.as_str()) {
        // Allow unknown keys to be stored in the legacy table for forward compatibility.
    }

    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_settings_db(&app)?;
        conn.execute(
            "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            (&key, &value),
        )
        .map_err(|e| format!("Failed to save setting '{key}': {e}"))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Settings task failed: {e}"))?
}

async fn save_core_owned_setting(
    store: &iron_core::config::ConfigStore,
    key: &str,
    value: &str,
) -> Result<(), String> {
    match key {
        "providers" => save_providers(store, value).await,
        "default_model" => save_default_model(store, value).await,
        "custom_models" => save_custom_models(store, value).await,
        "mcp_servers" => save_mcp_servers(store, value).await,
        "skills" => save_skills(store, value).await,
        _ => Err(format!("Unknown core-owned setting key: {key}")),
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderConfigJson {
    id: String,
    name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    api_key: Option<String>,
    base_url: Option<String>,
    enabled: bool,
}

async fn save_providers(store: &iron_core::config::ConfigStore, value: &str) -> Result<(), String> {
    let providers: Vec<ProviderConfigJson> =
        serde_json::from_str(value).map_err(|e| format!("Failed to parse providers JSON: {e}"))?;

    // Build a set of slugs that should exist after the save.
    let desired_slugs: std::collections::HashSet<String> = providers
        .iter()
        .filter(|p| p.id != "local")
        .map(|p| p.id.clone())
        .collect();

    // Remove provider configs that are no longer present.
    let existing = store
        .list_provider_configs()
        .await
        .map_err(|e| format!("Failed to list provider configs: {e}"))?;
    for config in existing {
        if !desired_slugs.contains(&config.provider_slug) {
            store
                .remove_provider_config(&config.provider_slug)
                .await
                .map_err(|e| format!("Failed to remove provider config: {e}"))?;
        }
    }

    for provider in providers {
        if provider.id == "local" {
            continue;
        }

        store
            .set_provider_config(&ProviderConfigInput {
                provider_slug: provider.id.clone(),
                display_name: provider.name,
                enabled: provider.enabled,
                base_url: provider.base_url,
            })
            .await
            .map_err(|e| format!("Failed to save provider config '{}': {}", provider.id, e))?;

        let existing_bytes = store.get_credential(&provider.id).await.map_err(|e| {
            format!(
                "Failed to read existing credential for '{}': {}",
                provider.id, e
            )
        })?;
        let is_oauth = matches!(
            existing_bytes
                .as_deref()
                .and_then(|b| serde_json::from_slice::<StoredCredential>(b).ok()),
            Some(StoredCredential::OAuthBearer(_))
        );

        match provider.api_key.as_deref().map(str::trim) {
            None => {
                // No key was sent; preserve the existing credential (e.g. OAuth).
            }
            Some("") if is_oauth => {
                // Frontend sends an empty apiKey for OAuth-backed providers by default.
                // Preserve the OAuth credential instead of deleting it.
            }
            Some("") => {
                store.remove_credential(&provider.id).await.map_err(|e| {
                    format!("Failed to remove API key for '{}': {}", provider.id, e)
                })?;
            }
            Some(key) => {
                let credential = StoredCredential::ApiKey(key.to_string());
                let payload = serde_json::to_vec(&credential)
                    .map_err(|e| format!("Failed to serialize API key: {e}"))?;
                store
                    .set_credential(&provider.id, "api_key", &payload)
                    .await
                    .map_err(|e| {
                        if matches!(e, iron_core::config::ConfigError::KeyUnavailable(_)) {
                            "Credential encryption is unavailable. Set AGENTIRON_CONFIG_ENCRYPTION_KEY or ensure your OS keyring is accessible.".to_string()
                        } else {
                            format!("Failed to save API key: {e}")
                        }
                    })?;
            }
        }
    }

    Ok(())
}

async fn save_default_model(
    store: &iron_core::config::ConfigStore,
    value: &str,
) -> Result<(), String> {
    if value.trim().is_empty() {
        store
            .clear_default_model()
            .await
            .map_err(|e| format!("Failed to clear default model: {e}"))?;
        return Ok(());
    }

    let Some((provider_slug, model_id)) = value.split_once('/') else {
        return Err(format!("Invalid default model format: {value}"));
    };

    store
        .set_default_model(&DefaultModelInput {
            provider_slug: provider_slug.to_string(),
            model_id: model_id.to_string(),
        })
        .await
        .map_err(|e| format!("Failed to save default model: {e}"))?;

    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelInfoJson {
    id: String,
    name: String,
    provider_id: String,
    context_window: Option<u32>,
    output_limit: Option<u32>,
    tool_call: bool,
    reasoning: bool,
    vision: bool,
    cost_input: Option<f64>,
    cost_output: Option<f64>,
}

impl From<CustomModelRecord> for ModelInfoJson {
    fn from(m: CustomModelRecord) -> Self {
        Self {
            id: m.model_id,
            name: m.display_name,
            provider_id: m.provider_slug,
            context_window: m.context_window,
            output_limit: m.output_limit,
            tool_call: m.supports_tool_calls,
            reasoning: m.supports_reasoning,
            vision: m.supports_vision,
            cost_input: m.cost_input_per_million,
            cost_output: m.cost_output_per_million,
        }
    }
}

impl From<ModelInfoJson> for CustomModelInput {
    fn from(m: ModelInfoJson) -> Self {
        Self {
            provider_slug: m.provider_id,
            model_id: m.id,
            display_name: m.name,
            context_window: m.context_window,
            output_limit: m.output_limit,
            supports_tool_calls: m.tool_call,
            supports_reasoning: m.reasoning,
            supports_vision: m.vision,
            supports_streaming: true,
            reasoning_effort_values: Vec::new(),
            cost_input_per_million: m.cost_input,
            cost_output_per_million: m.cost_output,
        }
    }
}

async fn save_custom_models(
    store: &iron_core::config::ConfigStore,
    value: &str,
) -> Result<(), String> {
    let models: Vec<ModelInfoJson> = serde_json::from_str(value)
        .map_err(|e| format!("Failed to parse custom models JSON: {e}"))?;

    let desired_keys: std::collections::HashSet<(String, String)> = models
        .iter()
        .map(|m| (m.provider_id.clone(), m.id.clone()))
        .collect();

    let existing = store
        .list_custom_models(None)
        .await
        .map_err(|e| format!("Failed to list custom models: {e}"))?;
    for model in existing {
        if !desired_keys.contains(&(model.provider_slug.clone(), model.model_id.clone())) {
            store
                .remove_custom_model(&model.provider_slug, &model.model_id)
                .await
                .map_err(|e| format!("Failed to remove custom model: {e}"))?;
        }
    }

    for model in models {
        store
            .set_custom_model(&model.into())
            .await
            .map_err(|e| format!("Failed to save custom model: {e}"))?;
    }

    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct McpServerConfigJson {
    id: String,
    label: String,
    transport: String,
    command: Option<String>,
    args: Option<Vec<String>>,
    env: Option<HashMap<String, String>>,
    url: Option<String>,
    headers: Option<HashMap<String, String>>,
    working_dir: Option<String>,
    enabled_by_default: bool,
    description: Option<String>,
}

impl From<McpServerConfigRecord> for McpServerConfigJson {
    fn from(m: McpServerConfigRecord) -> Self {
        let (transport, command, args, env, url, headers) = match m.transport {
            iron_core::McpTransport::Stdio { command, args, env } => (
                "stdio".to_string(),
                Some(command),
                Some(args),
                Some(env),
                None,
                None,
            ),
            iron_core::McpTransport::Http { config } => (
                "http".to_string(),
                None,
                None,
                None,
                Some(config.url),
                config.headers,
            ),
            iron_core::McpTransport::HttpSse { config } => (
                "http_sse".to_string(),
                None,
                None,
                None,
                Some(config.url),
                config.headers,
            ),
        };

        Self {
            id: m.id,
            label: m.label,
            transport,
            command,
            args,
            env,
            url,
            headers,
            working_dir: m.working_dir.map(|p| p.to_string_lossy().to_string()),
            enabled_by_default: m.enabled_by_default,
            description: m.description,
        }
    }
}

impl TryFrom<McpServerConfigJson> for McpServerConfigInput {
    type Error = String;

    fn try_from(m: McpServerConfigJson) -> Result<Self, Self::Error> {
        let transport = match m.transport.as_str() {
            "stdio" => iron_core::McpTransport::Stdio {
                command: m.command.unwrap_or_default(),
                args: m.args.unwrap_or_default(),
                env: m.env.unwrap_or_default(),
            },
            "http" => iron_core::McpTransport::Http {
                config: iron_core::HttpConfig {
                    url: m.url.unwrap_or_default(),
                    headers: m.headers,
                },
            },
            "http_sse" => iron_core::McpTransport::HttpSse {
                config: iron_core::HttpConfig {
                    url: m.url.unwrap_or_default(),
                    headers: m.headers,
                },
            },
            other => return Err(format!("Unknown MCP transport: {other}")),
        };

        Ok(Self {
            id: m.id,
            label: m.label,
            description: m.description,
            transport,
            working_dir: m.working_dir.map(PathBuf::from),
            enabled_by_default: m.enabled_by_default,
            inherited_env_vars: Vec::new(),
        })
    }
}

async fn save_mcp_servers(
    store: &iron_core::config::ConfigStore,
    value: &str,
) -> Result<(), String> {
    let servers: Vec<McpServerConfigJson> = serde_json::from_str(value)
        .map_err(|e| format!("Failed to parse MCP servers JSON: {e}"))?;

    // Pre-validate all entries before touching storage so a single invalid entry
    // does not leave core storage partially updated.
    let desired_inputs: Vec<McpServerConfigInput> = servers
        .into_iter()
        .map(TryInto::try_into)
        .collect::<Result<_, _>>()?;
    let desired_ids: std::collections::HashSet<String> =
        desired_inputs.iter().map(|s| s.id.clone()).collect();

    let existing = store
        .list_mcp_servers()
        .await
        .map_err(|e| format!("Failed to list MCP servers: {e}"))?;
    for server in existing {
        if !desired_ids.contains(&server.id) {
            store
                .remove_mcp_server(&server.id)
                .await
                .map_err(|e| format!("Failed to remove MCP server: {e}"))?;
        }
    }

    for server in desired_inputs {
        store
            .set_mcp_server(&server)
            .await
            .map_err(|e| format!("Failed to save MCP server: {e}"))?;
    }

    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillSettingsJson {
    trust_project_skills: bool,
    additional_skill_dirs: Vec<String>,
}

impl From<SkillSettingsRecord> for SkillSettingsJson {
    fn from(s: SkillSettingsRecord) -> Self {
        Self {
            trust_project_skills: s.trust_project_skills,
            additional_skill_dirs: s
                .additional_skill_dirs
                .into_iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect(),
        }
    }
}

async fn save_skills(store: &iron_core::config::ConfigStore, value: &str) -> Result<(), String> {
    let skills: SkillSettingsJson = serde_json::from_str(value)
        .map_err(|e| format!("Failed to parse skill settings JSON: {e}"))?;

    store
        .set_skill_settings(&SkillSettingsInput {
            trust_project_skills: skills.trust_project_skills,
            additional_skill_dirs: skills
                .additional_skill_dirs
                .into_iter()
                .map(PathBuf::from)
                .collect(),
        })
        .await
        .map_err(|e| format!("Failed to save skill settings: {e}"))?;

    Ok(())
}
