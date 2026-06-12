use async_trait::async_trait;
use base64::Engine;
use iron_core::config::{
    crypto::{DynCredentialCipher, XChaCha20Poly1305Cipher},
    ConfigError, ConfigStore, CustomModelInput, DefaultModelInput, McpServerConfigInput,
    OpenOptions, ProviderConfigInput, SkillSettingsInput,
};
use iron_core::provider_credential::{
    domain::{OAuthTokenSet, ProviderSlug, StoredCredential},
    store::ProviderCredentialStore,
};
use rusqlite::Connection;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, UNIX_EPOCH};

const MIGRATION_PROFILE_ID: &str = "agentiron.migration.v1";
const MIGRATION_VERSION: i64 = 1;

/// Wrapper around the shared `iron-core` config store.
#[derive(Clone)]
pub struct CoreConfig {
    pub store: Arc<ConfigStore>,
}

impl CoreConfig {
    /// Open the platform-default shared config store with a pre-resolved cipher.
    pub async fn open_with_cipher(
        cipher: Option<DynCredentialCipher>,
    ) -> Result<Self, ConfigError> {
        let path = iron_core::config::default_config_path()?;
        let store = ConfigStore::open_at_with_options(
            path,
            OpenOptions {
                cipher,
                busy_timeout: None,
            },
        )
        .await?;
        Ok(Self {
            store: Arc::new(store),
        })
    }
}

/// Resolve the credential cipher synchronously before entering Tokio.
///
/// The keyring crate's Linux backend uses zbus blocking APIs that create their own
/// runtime. Calling that path from inside Tokio panics, so startup resolves the key
/// first and then passes the cipher into `ConfigStore` explicitly.
pub fn resolve_config_cipher_sync() -> Option<DynCredentialCipher> {
    if let Ok(value) = std::env::var("AGENTIRON_CONFIG_ENCRYPTION_KEY") {
        if let Some(key) = decode_config_key(&value) {
            return Some(Arc::new(XChaCha20Poly1305Cipher::new(&key)) as DynCredentialCipher);
        }
    }

    let entry = keyring::Entry::new("agentiron", "config-encryption").ok()?;
    match entry.get_password() {
        Ok(password) => decode_config_key(&password)
            .map(|key| Arc::new(XChaCha20Poly1305Cipher::new(&key)) as DynCredentialCipher),
        Err(keyring::Error::NoEntry) => {
            let key = XChaCha20Poly1305Cipher::generate_key();
            let encoded = base64::engine::general_purpose::STANDARD.encode(key);
            if entry.set_password(&encoded).is_ok() {
                return Some(Arc::new(XChaCha20Poly1305Cipher::new(&key)) as DynCredentialCipher);
            }

            entry.get_password().ok().and_then(|password| {
                decode_config_key(&password)
                    .map(|key| Arc::new(XChaCha20Poly1305Cipher::new(&key)) as DynCredentialCipher)
            })
        }
        Err(_) => None,
    }
}

fn decode_config_key(value: &str) -> Option<[u8; 32]> {
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(value)
        .ok()?;
    if decoded.len() != 32 {
        return None;
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&decoded);
    Some(key)
}

/// Credential store backed by the shared `iron-core` config store.
pub struct CoreCredentialStore {
    store: Arc<ConfigStore>,
}

impl CoreCredentialStore {
    pub fn new(store: Arc<ConfigStore>) -> Self {
        Self { store }
    }
}

#[async_trait]
impl ProviderCredentialStore for CoreCredentialStore {
    async fn get(&self, slug: &ProviderSlug) -> Option<StoredCredential> {
        match self.store.get_credential(slug.as_str()).await {
            Ok(Some(bytes)) => match serde_json::from_slice::<StoredCredential>(&bytes) {
                Ok(cred) => Some(cred),
                Err(e) => {
                    eprintln!(
                        "[credential] Failed to deserialize stored credential for {}: {}",
                        slug.as_str(),
                        e
                    );
                    None
                }
            },
            Ok(None) => None,
            Err(e) => {
                eprintln!(
                    "[credential] Failed to get credential for {}: {}",
                    slug.as_str(),
                    e
                );
                None
            }
        }
    }

    async fn set(&self, slug: &ProviderSlug, credential: StoredCredential) {
        let mode = match &credential {
            StoredCredential::ApiKey(_) => "api_key",
            StoredCredential::OAuthBearer(_) => "oauth_bearer",
        };

        let payload = match serde_json::to_vec(&credential) {
            Ok(p) => p,
            Err(e) => {
                eprintln!(
                    "[credential] Failed to serialize credential for {}: {}",
                    slug.as_str(),
                    e
                );
                return;
            }
        };

        if let Err(e) = self
            .store
            .set_credential(slug.as_str(), mode, &payload)
            .await
        {
            eprintln!(
                "[credential] Failed to set credential for {}: {}",
                slug.as_str(),
                e
            );
        }
    }

    async fn remove(&self, slug: &ProviderSlug) {
        if let Err(e) = self.store.remove_credential(slug.as_str()).await {
            eprintln!(
                "[credential] Failed to remove credential for {}: {}",
                slug.as_str(),
                e
            );
        }
    }

    async fn list_slugs(&self) -> Vec<ProviderSlug> {
        match self.store.list_credential_slugs().await {
            Ok(slugs) => slugs.into_iter().map(ProviderSlug::new).collect(),
            Err(e) => {
                eprintln!("[credential] Failed to list credential slugs: {}", e);
                Vec::new()
            }
        }
    }
}

/// Migrate legacy AgentIron `agentiron.db` state into the shared `iron-core` config store.
///
/// This is idempotent: it records completion in `iron-core` config and skips work if already
/// done. Existing `iron-core` records are preserved rather than overwritten.
pub async fn migrate_legacy_settings(
    store: &ConfigStore,
    legacy_conn: &Connection,
) -> Result<(), String> {
    if is_migration_complete(store).await? {
        return Ok(());
    }

    // Migrate in an order that satisfies cross-record validation:
    // providers -> custom models -> default model -> MCP servers -> skills -> credentials.
    migrate_providers(store, legacy_conn).await?;
    migrate_custom_models(store, legacy_conn).await?;
    migrate_default_model(store, legacy_conn).await?;
    migrate_mcp_servers(store, legacy_conn).await?;
    migrate_skill_settings(store, legacy_conn).await?;
    migrate_credentials(store, legacy_conn).await?;

    // Delete migrated core-owned keys from the legacy settings table.
    delete_legacy_core_keys(legacy_conn)?;

    record_migration_complete(store).await?;

    Ok(())
}

async fn is_migration_complete(store: &ConfigStore) -> Result<bool, String> {
    match store.get_profile(MIGRATION_PROFILE_ID).await {
        Ok(Some(record)) => Ok(record
            .payload
            .get("completed")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)),
        Ok(None) => Ok(false),
        Err(e) => Err(format!("Failed to read migration marker: {e}")),
    }
}

async fn record_migration_complete(store: &ConfigStore) -> Result<(), String> {
    let payload = serde_json::json!({
        "completed": true,
        "version": MIGRATION_VERSION,
    });
    store
        .set_profile(&iron_core::config::ProfileInput {
            id: MIGRATION_PROFILE_ID.to_string(),
            schema_version: MIGRATION_VERSION,
            payload,
        })
        .await
        .map_err(|e| format!("Failed to record migration completion: {e}"))
}

fn delete_legacy_core_keys(conn: &Connection) -> Result<(), String> {
    let keys = [
        "providers",
        "default_model",
        "custom_models",
        "mcp_servers",
        "skills",
    ];
    for key in keys {
        conn.execute("DELETE FROM settings WHERE key = ?1", [key])
            .map_err(|e| format!("Failed to delete legacy key '{}': {}", key, e))?;
    }
    conn.execute("DELETE FROM provider_credentials", [])
        .map_err(|e| format!("Failed to clear legacy provider_credentials: {}", e))?;
    Ok(())
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyProviderConfig {
    id: String,
    name: String,
    api_key: String,
    base_url: Option<String>,
    enabled: bool,
}

async fn migrate_providers(store: &ConfigStore, conn: &Connection) -> Result<(), String> {
    let value = match load_legacy_setting(conn, "providers")? {
        Some(v) => v,
        None => return Ok(()),
    };

    let providers: Vec<LegacyProviderConfig> = serde_json::from_str(&value)
        .map_err(|e| format!("Failed to parse legacy providers: {e}"))?;

    for provider in providers {
        // The local provider remains implicit by default; do not persist it.
        if provider.id == "local" {
            continue;
        }

        // Preserve existing core provider config rather than overwriting.
        match store.get_provider_config(&provider.id).await {
            Ok(Some(_)) => continue,
            Ok(None) => {}
            Err(e) => return Err(format!("Failed to check provider config: {e}")),
        }

        store
            .set_provider_config(&ProviderConfigInput {
                provider_slug: provider.id.clone(),
                display_name: provider.name.clone(),
                enabled: provider.enabled,
                base_url: provider.base_url.clone(),
            })
            .await
            .map_err(|e| format!("Failed to migrate provider config '{}': {}", provider.id, e))?;

        if !provider.api_key.trim().is_empty() {
            let slug = ProviderSlug::new(&provider.id);
            let credential = StoredCredential::ApiKey(provider.api_key);
            store
                .set_credential(
                    slug.as_str(),
                    "api_key",
                    &serde_json::to_vec(&credential)
                        .map_err(|e| format!("Failed to serialize API key: {e}"))?,
                )
                .await
                .map_err(|e| format!("Failed to migrate API key for '{}': {}", provider.id, e))?;
        }
    }

    Ok(())
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyModelInfo {
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

async fn migrate_custom_models(store: &ConfigStore, conn: &Connection) -> Result<(), String> {
    let value = match load_legacy_setting(conn, "custom_models")? {
        Some(v) => v,
        None => return Ok(()),
    };

    let models: Vec<LegacyModelInfo> = serde_json::from_str(&value)
        .map_err(|e| format!("Failed to parse legacy custom models: {e}"))?;

    for model in models {
        // Preserve existing core custom model rather than overwriting.
        match store.get_custom_model(&model.provider_id, &model.id).await {
            Ok(Some(_)) => continue,
            Ok(None) => {}
            Err(e) => return Err(format!("Failed to check custom model: {e}")),
        }

        store
            .set_custom_model(&CustomModelInput {
                provider_slug: model.provider_id,
                model_id: model.id,
                display_name: model.name,
                context_window: model.context_window,
                output_limit: model.output_limit,
                supports_tool_calls: model.tool_call,
                supports_reasoning: model.reasoning,
                supports_vision: model.vision,
                supports_streaming: true,
                reasoning_effort_values: Vec::new(),
                cost_input_per_million: model.cost_input,
                cost_output_per_million: model.cost_output,
            })
            .await
            .map_err(|e| format!("Failed to migrate custom model: {e}"))?;
    }

    Ok(())
}

async fn migrate_default_model(store: &ConfigStore, conn: &Connection) -> Result<(), String> {
    let value = match load_legacy_setting(conn, "default_model")? {
        Some(v) => v,
        None => return Ok(()),
    };

    if value.trim().is_empty() {
        return Ok(());
    }

    let Some((provider_slug, model_id)) = value.split_once('/') else {
        // Invalid legacy value; skip without aborting migration.
        return Ok(());
    };

    // Check whether a default model is already set in core config.
    match store.get_default_model().await {
        Ok(Some(_)) => return Ok(()),
        Ok(None) => {}
        Err(e) => return Err(format!("Failed to check default model: {e}")),
    }

    // Validate against the effective catalog; skip if invalid.
    let custom_models = store
        .list_custom_models(None)
        .await
        .map_err(|e| format!("Failed to list custom models for default validation: {e}"))?;
    let catalog = iron_core::config::build_effective_catalog(
        &iron_core::config::builtin_model_catalog(),
        &custom_models,
    )
    .map_err(|e| format!("Failed to build model catalog: {e}"))?;

    if !catalog.contains(provider_slug, model_id) {
        // Skip invalid legacy default model without aborting migration.
        return Ok(());
    }

    store
        .set_default_model(&DefaultModelInput {
            provider_slug: provider_slug.to_string(),
            model_id: model_id.to_string(),
        })
        .await
        .map_err(|e| format!("Failed to migrate default model: {e}"))?;

    Ok(())
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyMcpServerConfig {
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

async fn migrate_mcp_servers(store: &ConfigStore, conn: &Connection) -> Result<(), String> {
    let value = match load_legacy_setting(conn, "mcp_servers")? {
        Some(v) => v,
        None => return Ok(()),
    };

    let servers: Vec<LegacyMcpServerConfig> = serde_json::from_str(&value)
        .map_err(|e| format!("Failed to parse legacy MCP servers: {e}"))?;

    for server in servers {
        match store.get_mcp_server(&server.id).await {
            Ok(Some(_)) => continue,
            Ok(None) => {}
            Err(e) => return Err(format!("Failed to check MCP server: {e}")),
        }

        let transport = match server.transport.as_str() {
            "stdio" => iron_core::McpTransport::Stdio {
                command: server.command.unwrap_or_default(),
                args: server.args.unwrap_or_default(),
                env: server.env.unwrap_or_default(),
            },
            "http" => iron_core::McpTransport::Http {
                config: iron_core::HttpConfig {
                    url: server.url.unwrap_or_default(),
                    headers: server.headers,
                },
            },
            "http_sse" => iron_core::McpTransport::HttpSse {
                config: iron_core::HttpConfig {
                    url: server.url.unwrap_or_default(),
                    headers: server.headers,
                },
            },
            _ => continue,
        };

        store
            .set_mcp_server(&McpServerConfigInput {
                id: server.id,
                label: server.label,
                description: server.description,
                transport,
                working_dir: server.working_dir.map(PathBuf::from),
                enabled_by_default: server.enabled_by_default,
                inherited_env_vars: Vec::new(),
            })
            .await
            .map_err(|e| format!("Failed to migrate MCP server: {e}"))?;
    }

    Ok(())
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacySkillSettings {
    trust_project_skills: bool,
    additional_skill_dirs: Vec<String>,
}

async fn migrate_skill_settings(store: &ConfigStore, conn: &Connection) -> Result<(), String> {
    let value = match load_legacy_setting(conn, "skills")? {
        Some(v) => v,
        None => return Ok(()),
    };

    let skills: LegacySkillSettings = serde_json::from_str(&value)
        .map_err(|e| format!("Failed to parse legacy skill settings: {e}"))?;

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
        .map_err(|e| format!("Failed to migrate skill settings: {e}"))?;

    Ok(())
}

async fn migrate_credentials(store: &ConfigStore, conn: &Connection) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "SELECT provider_slug, credential_mode, api_key, access_token, refresh_token, expires_at, id_token FROM provider_credentials",
        )
        .map_err(|e| format!("Failed to prepare legacy credentials query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            let provider_slug: String = row.get(0)?;
            let mode: String = row.get(1)?;
            let api_key: Option<String> = row.get(2)?;
            let access_token: Option<String> = row.get(3)?;
            let refresh_token: Option<String> = row.get(4)?;
            let expires_at: Option<i64> = row.get(5)?;
            let id_token: Option<String> = row.get(6)?;
            Ok((
                provider_slug,
                mode,
                api_key,
                access_token,
                refresh_token,
                expires_at,
                id_token,
            ))
        })
        .map_err(|e| format!("Failed to query legacy credentials: {e}"))?;

    for row in rows {
        let (provider_slug, mode, api_key, access_token, refresh_token, expires_at, id_token) =
            row.map_err(|e| format!("Failed to read legacy credential row: {e}"))?;

        let credential = match mode.as_str() {
            "api_key" => api_key.map(StoredCredential::ApiKey),
            "oauth_bearer" => {
                let access_token = access_token
                    .ok_or_else(|| "Legacy OAuth credential missing access_token".to_string())?;
                let refresh_token = refresh_token.unwrap_or_default();
                let expires_at = expires_at.and_then(|ts| {
                    if ts >= 0 {
                        Some(UNIX_EPOCH + Duration::from_secs(ts as u64))
                    } else {
                        None
                    }
                });
                Some(StoredCredential::OAuthBearer(OAuthTokenSet {
                    access_token,
                    refresh_token,
                    expires_at,
                    id_token,
                }))
            }
            _ => None,
        };

        if let Some(credential) = credential {
            // Preserve existing core credentials; do not overwrite with stale legacy data.
            match store.get_credential(&provider_slug).await {
                Ok(Some(_)) => continue,
                Ok(None) => {}
                Err(e) => {
                    return Err(format!(
                        "Failed to check existing credential for '{}': {}",
                        provider_slug, e
                    ))
                }
            }

            let payload = serde_json::to_vec(&credential).map_err(|e| {
                format!(
                    "Failed to serialize credential for '{}': {}",
                    provider_slug, e
                )
            })?;
            store
                .set_credential(&provider_slug, &mode, &payload)
                .await
                .map_err(|e| {
                    if matches!(e, ConfigError::KeyUnavailable(_)) {
                        "Credential encryption is unavailable. Set AGENTIRON_CONFIG_ENCRYPTION_KEY or ensure your OS keyring is accessible, then restart AgentIron.".to_string()
                    } else {
                        format!("Failed to migrate credential for '{}': {}", provider_slug, e)
                    }
                })?;
        }
    }

    Ok(())
}

fn load_legacy_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| format!("Failed to prepare legacy setting query: {e}"))?;
    let value: Result<String, rusqlite::Error> = stmt.query_row([key], |row| row.get(0));
    match value {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Failed to read legacy setting '{}': {}", key, e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use iron_core::provider_credential::ProviderCredentialStore;

    fn legacy_db_with_settings(values: &[(&str, &str)]) -> (Connection, tempfile::TempDir) {
        let temp_dir = tempfile::tempdir().unwrap();
        let db_path = temp_dir.path().join("legacy.db");
        let conn = Connection::open(&db_path).unwrap();
        conn.execute_batch(include_str!("../migrations/001_initial.sql"))
            .unwrap();
        conn.execute_batch(include_str!("../migrations/002_provider_credentials.sql"))
            .unwrap();
        for (key, value) in values {
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                [*key, *value],
            )
            .unwrap();
        }
        (conn, temp_dir)
    }

    #[tokio::test]
    async fn migration_preserves_existing_core_records() {
        let _temp_dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open_in_memory().await.unwrap();

        store
            .set_provider_config(&ProviderConfigInput {
                provider_slug: "openai".to_string(),
                display_name: "Already Migrated".to_string(),
                enabled: true,
                base_url: Some("https://example.com".to_string()),
            })
            .await
            .unwrap();

        let (legacy_conn, _legacy_temp) = legacy_db_with_settings(&[(
            "providers",
            "[{\"id\":\"openai\",\"name\":\"OpenAI\",\"apiKey\":\"sk-old\",\"enabled\":true}]",
        )]);

        migrate_legacy_settings(&store, &legacy_conn).await.unwrap();

        let config = store
            .get_provider_config("openai")
            .await
            .unwrap()
            .expect("provider should exist");
        assert_eq!(config.display_name, "Already Migrated");
        assert_eq!(config.base_url, Some("https://example.com".to_string()));

        // API key from legacy DB should NOT have overwritten the existing core record's credential.
        let cred = CoreCredentialStore::new(Arc::new(store))
            .get(&ProviderSlug::new("openai"))
            .await;
        assert!(
            cred.is_none(),
            "existing core record should not gain stale API key"
        );
    }

    #[tokio::test]
    async fn migration_roundtrips_provider_config_and_api_key() {
        let _temp_dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open_in_memory().await.unwrap();
        let (legacy_conn, _legacy_temp) = legacy_db_with_settings(&[("providers", "[{\"id\":\"openai\",\"name\":\"OpenAI\",\"apiKey\":\"sk-test\",\"enabled\":true,\"baseUrl\":\"https://api.openai.com/v1\"}]")],
        );

        migrate_legacy_settings(&store, &legacy_conn).await.unwrap();

        let config = store
            .get_provider_config("openai")
            .await
            .unwrap()
            .expect("provider should be migrated");
        assert_eq!(config.display_name, "OpenAI");
        assert_eq!(
            config.base_url,
            Some("https://api.openai.com/v1".to_string())
        );

        let cred = CoreCredentialStore::new(Arc::new(store))
            .get(&ProviderSlug::new("openai"))
            .await
            .expect("API key should be migrated");
        assert_eq!(cred, StoredCredential::ApiKey("sk-test".to_string()));
    }

    #[tokio::test]
    async fn migration_skips_invalid_default_model() {
        let _temp_dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open_in_memory().await.unwrap();
        let (legacy_conn, _legacy_temp) =
            legacy_db_with_settings(&[("default_model", "openai/invalid-model")]);

        migrate_legacy_settings(&store, &legacy_conn).await.unwrap();

        assert!(
            store.get_default_model().await.unwrap().is_none(),
            "invalid default model should be skipped"
        );

        let completed = is_migration_complete(&store)
            .await
            .expect("migration should record completion");
        assert!(completed);
    }

    #[tokio::test]
    async fn migration_roundtrips_mcp_servers_and_skills() {
        let _temp_dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open_in_memory().await.unwrap();
        let (legacy_conn, _legacy_temp) = legacy_db_with_settings(&[
            ("mcp_servers", "[{\"id\":\"fs\",\"label\":\"Filesystem\",\"transport\":\"stdio\",\"command\":\"npx\",\"args\":[\"-y\",\"@modelcontextprotocol/server-filesystem\",\".\"],\"enabledByDefault\":true}]") ,
            ("skills", "{\"trustProjectSkills\":true,\"additionalSkillDirs\":[\"/tmp/skills\"]}"),
        ],
        );

        migrate_legacy_settings(&store, &legacy_conn).await.unwrap();

        let servers = store.list_mcp_servers().await.unwrap();
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0].id, "fs");

        let skills = store.get_skill_settings().await.unwrap();
        assert!(skills.trust_project_skills);
        assert_eq!(skills.additional_skill_dirs.len(), 1);
    }

    #[tokio::test]
    async fn migration_deletes_legacy_core_keys() {
        let _temp_dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open_in_memory().await.unwrap();
        let (legacy_conn, _legacy_temp) = legacy_db_with_settings(&[(
            "providers",
            "[{\"id\":\"openai\",\"name\":\"OpenAI\",\"apiKey\":\"\",\"enabled\":true}]",
        )]);

        migrate_legacy_settings(&store, &legacy_conn).await.unwrap();

        let mut stmt = legacy_conn
            .prepare("SELECT COUNT(*) FROM settings WHERE key = 'providers'")
            .unwrap();
        let count: i64 = stmt.query_row([], |row| row.get(0)).unwrap();
        assert_eq!(count, 0);
    }

    #[tokio::test]
    async fn migration_is_idempotent() {
        let _temp_dir = tempfile::tempdir().unwrap();
        let store = ConfigStore::open_in_memory().await.unwrap();
        let (legacy_conn, _legacy_temp) = legacy_db_with_settings(&[(
            "providers",
            "[{\"id\":\"openai\",\"name\":\"OpenAI\",\"apiKey\":\"sk-test\",\"enabled\":true}]",
        )]);

        migrate_legacy_settings(&store, &legacy_conn).await.unwrap();
        migrate_legacy_settings(&store, &legacy_conn).await.unwrap();

        let configs = store.list_provider_configs().await.unwrap();
        assert_eq!(configs.len(), 1);
    }
}
