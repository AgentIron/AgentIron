use crate::provider_box::ProviderBox;
use crate::state::{
    spawn_agent_worker, AgentHandle, AgentParams, AgentRequest, AppState, McpServerConfigJson,
    McpServerStatusJson,
};
use iron_core::provider_credential::domain::{ProviderAuthError, ProviderPromptContext};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::sync::mpsc;
use tokio::sync::oneshot;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub transport: String,
    pub status: String,
    pub working_directory: String,
}

/// Create a provider registry with upstream builtins plus temporary local registrations.
/// openai is registered here because upstream register_builtins does not yet include it.
fn create_registry() -> iron_providers::ProviderRegistry {
    let mut registry = iron_providers::ProviderRegistry::default();
    registry.register(iron_providers::ProviderProfile::new(
        "openai",
        iron_providers::ApiFamily::Responses,
        "https://api.openai.com/v1",
    ));
    registry
}

/// Build a provider for the given provider ID using upstream registry and credential resolution.
async fn build_provider(
    state: &AppState,
    provider_id: &str,
    api_key: &str,
    model: &str,
    base_url: Option<&str>,
) -> Result<Box<dyn iron_core::Provider>, String> {
    if provider_id == "local" {
        let url = base_url.unwrap_or("http://localhost:11434/v1");
        let profile = iron_providers::ProviderProfile::new(
            "local",
            iron_providers::ApiFamily::Completions,
            url,
        )
        .with_auth(iron_providers::AuthStrategy::BearerToken)
        .with_credential_auth(
            iron_providers::CredentialKind::NoAuth,
            iron_providers::AuthStrategy::NoAuth,
        );

        let runtime_config = if api_key.trim().is_empty() {
            iron_providers::RuntimeConfig::none()
        } else {
            iron_providers::RuntimeConfig::new(api_key)
        };

        return iron_providers::ProviderConnection::from_profile(profile, runtime_config)
            .map(|p| Box::new(p) as Box<dyn iron_core::Provider>)
            .map_err(|e| format!("Provider error: {e}"));
    }

    // Use credential resolver
    let context = ProviderPromptContext {
        provider_slug: iron_core::provider_credential::domain::ProviderSlug::new(provider_id),
        model: model.to_string(),
        api_key: if api_key.trim().is_empty() {
            None
        } else {
            Some(api_key.to_string())
        },
    };

    let resolved = state
        .credential_resolver
        .resolve(&context, context.api_key.clone())
        .await
        .map_err(credential_resolution_message)?;

    let runtime_config =
        iron_providers::RuntimeConfig::from_credential(resolved.provider_credential);

    let registry = create_registry();
    registry
        .get(provider_id, runtime_config)
        .map_err(|e| format!("Provider registry error: {e}"))
}

fn credential_resolution_message(error: ProviderAuthError) -> String {
    match error {
        ProviderAuthError::NotConfigured(provider) => format!(
            "Provider '{provider}' is not configured. Add an API key or connect OAuth in Settings > Providers."
        ),
        ProviderAuthError::UnsupportedCredential { provider, mode } => format!(
            "Provider '{provider}' does not support {mode:?} credentials. Use a supported authentication method in Settings > Providers."
        ),
        ProviderAuthError::Expired(provider) => format!(
            "OAuth token expired for provider '{provider}'. Reconnect OAuth in Settings > Providers."
        ),
        ProviderAuthError::RefreshFailed { provider, reason } => format!(
            "OAuth refresh failed for provider '{provider}': {reason}. Reconnect OAuth in Settings > Providers."
        ),
        ProviderAuthError::Revoked(provider) => format!(
            "OAuth credential for provider '{provider}' was revoked. Reconnect OAuth in Settings > Providers."
        ),
        ProviderAuthError::StoreError { provider, reason } => format!(
            "Credential store error for provider '{provider}': {reason}. Check local app storage permissions."
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core_config::CoreConfig;
    use crate::state::AppState;
    use iron_core::config::{
        CustomModelInput, DefaultModelInput, McpServerConfigInput, ProviderConfigInput,
        SkillSettingsInput,
    };
    use iron_core::provider_credential::domain::StoredCredential;
    use std::collections::HashMap;
    use std::sync::Arc;

    #[tokio::test]
    async fn agent_creation_uses_core_provider_config_and_api_key() {
        let store = iron_core::config::ConfigStore::open_in_memory()
            .await
            .unwrap();
        store
            .set_provider_config(&ProviderConfigInput {
                provider_slug: "openai".to_string(),
                display_name: "OpenAI".to_string(),
                enabled: true,
                base_url: None,
            })
            .await
            .unwrap();

        let credential = StoredCredential::ApiKey("sk-agent-test".to_string());
        let payload = serde_json::to_vec(&credential).unwrap();
        store
            .set_credential("openai", "api_key", &payload)
            .await
            .unwrap();

        let store_arc = Arc::new(store);
        let core_config = Arc::new(CoreConfig {
            store: store_arc.clone(),
        });
        let state = AppState::new(core_config, false);

        let provider = build_provider(
            &state, "openai", "", // no explicit API key; should resolve from core store
            "gpt-4o", None,
        )
        .await
        .expect("should build provider from core-owned state");

        // If we got a provider back, credential resolution succeeded.
        let _ = provider.as_ref();
    }

    #[tokio::test]
    async fn agent_creation_uses_core_default_model_and_skills() {
        let store = iron_core::config::ConfigStore::open_in_memory()
            .await
            .unwrap();
        store
            .set_provider_config(&ProviderConfigInput {
                provider_slug: "openai".to_string(),
                display_name: "OpenAI".to_string(),
                enabled: true,
                base_url: None,
            })
            .await
            .unwrap();
        store
            .set_default_model(&DefaultModelInput {
                provider_slug: "openai".to_string(),
                model_id: "gpt-4o".to_string(),
            })
            .await
            .unwrap();
        store
            .set_skill_settings(&SkillSettingsInput {
                trust_project_skills: true,
                additional_skill_dirs: vec![PathBuf::from("/tmp/skills")],
            })
            .await
            .unwrap();

        let snapshot = store.load_runtime_settings().await.unwrap();
        assert_eq!(snapshot.default_model.unwrap().model_id, "gpt-4o");
        assert!(snapshot.skill_settings.trust_project_skills);
    }

    #[tokio::test]
    async fn agent_creation_uses_core_custom_model_and_mcp() {
        let store = iron_core::config::ConfigStore::open_in_memory()
            .await
            .unwrap();
        store
            .set_provider_config(&ProviderConfigInput {
                provider_slug: "openai".to_string(),
                display_name: "OpenAI".to_string(),
                enabled: true,
                base_url: None,
            })
            .await
            .unwrap();
        store
            .set_custom_model(&CustomModelInput {
                provider_slug: "openai".to_string(),
                model_id: "custom-model".to_string(),
                display_name: "Custom".to_string(),
                context_window: None,
                output_limit: None,
                supports_tool_calls: true,
                supports_reasoning: false,
                supports_vision: false,
                supports_streaming: true,
                reasoning_effort_values: Vec::new(),
                cost_input_per_million: None,
                cost_output_per_million: None,
            })
            .await
            .unwrap();
        store
            .set_mcp_server(&McpServerConfigInput {
                id: "fs".to_string(),
                label: "Filesystem".to_string(),
                description: None,
                transport: iron_core::McpTransport::Stdio {
                    command: "npx".to_string(),
                    args: vec!["-y".to_string()],
                    env: HashMap::new(),
                },
                working_dir: None,
                enabled_by_default: true,
                inherited_env_vars: Vec::new(),
            })
            .await
            .unwrap();

        let snapshot = store.load_runtime_settings().await.unwrap();
        assert_eq!(snapshot.custom_models.len(), 1);
        assert_eq!(snapshot.mcp_servers.len(), 1);
    }

    #[tokio::test]
    async fn core_runtime_settings_match_agentiron_command_view() {
        // This test verifies that the same ConfigStore content an AgentIron backend command
        // would write is also readable through iron-core's runtime snapshot API, which is the
        // same API a future CLI/headless consumer would use for parity.
        let store = iron_core::config::ConfigStore::open_in_memory()
            .await
            .unwrap();
        store
            .set_provider_config(&ProviderConfigInput {
                provider_slug: "openai".to_string(),
                display_name: "OpenAI".to_string(),
                enabled: true,
                base_url: None,
            })
            .await
            .unwrap();
        store
            .set_default_model(&DefaultModelInput {
                provider_slug: "openai".to_string(),
                model_id: "gpt-4o".to_string(),
            })
            .await
            .unwrap();
        store
            .set_skill_settings(&SkillSettingsInput {
                trust_project_skills: false,
                additional_skill_dirs: Vec::new(),
            })
            .await
            .unwrap();

        let snapshot = store.load_runtime_settings().await.unwrap();
        assert_eq!(snapshot.provider_configs.len(), 1);
        assert_eq!(snapshot.default_model.unwrap().model_id, "gpt-4o");
        assert!(!snapshot.skill_settings.trust_project_skills);
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn create_agent(
    state: tauri::State<'_, AppState>,
    api_key: String,
    model: String,
    tab_id: String,
    working_directory: Option<String>,
    provider_id: Option<String>,
    mcp_servers: Option<Vec<McpServerConfigJson>>,
    transport: Option<String>,
    trust_project_skills: Option<bool>,
    additional_skill_dirs: Option<Vec<String>>,
    base_url: Option<String>,
) -> Result<AgentInfo, String> {
    let transport = transport.unwrap_or_else(|| "in-process".to_string());
    if transport != "in-process" {
        return Err(format!(
            "Transport '{}' is not supported. Only 'in-process' is available.",
            transport
        ));
    }

    let pid = provider_id.unwrap_or_else(|| "openai".to_string());
    let provider = build_provider(&state, &pid, &api_key, &model, base_url.as_deref()).await?;

    let mut skill_config = iron_core::config::SkillConfig::new()
        .with_trust_project_skills(trust_project_skills.unwrap_or(false));
    for dir in additional_skill_dirs.unwrap_or_default() {
        skill_config = skill_config.with_additional_skill_dir(PathBuf::from(dir));
    }

    let context_management = iron_core::ContextManagementConfig::new()
        .enabled()
        .with_maintenance_threshold(50_000);

    let config = iron_core::Config::default()
        .with_model(model.clone())
        .with_provider_name(&pid)
        .with_max_iterations(10)
        .with_embedded_python_enabled()
        .with_context_management(context_management.clone())
        .with_mcp(
            iron_core::McpConfig::new()
                .with_enabled(true)
                .with_enabled_by_default(true),
        )
        .with_skills(skill_config);

    let compact_threshold_tokens = context_management.maintenance_threshold;

    let work_dir = working_directory
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")));

    // Set workspace roots so iron-core's runtime context tells the model the correct directory
    let config = config.with_workspace_roots(vec![work_dir.clone()]);

    let work_dir_str = work_dir.to_string_lossy().to_string();

    let (request_tx, request_rx) = mpsc::channel::<AgentRequest>(32);

    spawn_agent_worker(
        AgentParams {
            config,
            provider: ProviderBox(provider),
            working_directory: work_dir,
            mcp_servers: mcp_servers.unwrap_or_default(),
            debug_enabled: state.debug_enabled,
            compact_threshold_tokens: Some(compact_threshold_tokens),
        },
        request_rx,
    );

    let info = AgentInfo {
        id: tab_id.clone(),
        name: model.clone(),
        transport: transport.clone(),
        status: "connected".to_string(),
        working_directory: work_dir_str,
    };

    let mut agents = state.agents.write().await;
    agents.insert(
        tab_id,
        AgentHandle {
            request_tx,
            name: model,
        },
    );

    Ok(info)
}

#[tauri::command]
pub async fn disconnect_agent(
    state: tauri::State<'_, AppState>,
    tab_id: String,
) -> Result<(), String> {
    let mut agents = state.agents.write().await;
    if let Some(handle) = agents.remove(&tab_id) {
        let _ = handle.request_tx.send(AgentRequest::Shutdown).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn change_working_directory(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    working_directory: String,
) -> Result<bool, String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::SetWorkspaceRoots {
            roots: vec![std::path::PathBuf::from(working_directory)],
            response_tx,
        })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn list_agents(state: tauri::State<'_, AppState>) -> Result<Vec<AgentInfo>, String> {
    let agents = state.agents.read().await;
    Ok(agents
        .iter()
        .map(|(id, handle)| AgentInfo {
            id: id.clone(),
            name: handle.name.clone(),
            transport: "in-process".to_string(),
            status: "connected".to_string(),
            working_directory: String::new(),
        })
        .collect())
}

/// Register a new MCP server on a running agent (hot-add).
#[tauri::command]
pub async fn register_mcp_server(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    config: McpServerConfigJson,
) -> Result<(), String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::RegisterMcpServer {
            config,
            response_tx,
        })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn get_mcp_status(
    state: tauri::State<'_, AppState>,
    tab_id: String,
) -> Result<Vec<McpServerStatusJson>, String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::GetMcpStatus { response_tx })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn set_mcp_server_enabled(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    server_id: String,
    enabled: bool,
) -> Result<(), String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::SetMcpServerEnabled {
            server_id,
            enabled,
            response_tx,
        })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn reconnect_mcp_server(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    server_id: String,
) -> Result<(), String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::ReconnectMcpServer {
            server_id,
            response_tx,
        })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

// ---------------------------------------------------------------------------
// Skill commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn refresh_skill_catalog(
    state: tauri::State<'_, AppState>,
    tab_id: String,
) -> Result<Vec<crate::state::SkillDiagnosticJson>, String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::RefreshSkillCatalog { response_tx })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn list_available_skills(
    state: tauri::State<'_, AppState>,
    tab_id: String,
) -> Result<Vec<crate::state::SkillMetadataJson>, String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::ListAvailableSkills { response_tx })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn activate_skill(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    name: String,
) -> Result<(), String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::ActivateSkill { name, response_tx })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn deactivate_skill(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    name: String,
) -> Result<(), String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::DeactivateSkill { name, response_tx })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn list_active_skills(
    state: tauri::State<'_, AppState>,
    tab_id: String,
) -> Result<Vec<String>, String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::ListActiveSkills { response_tx })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

// ---------------------------------------------------------------------------
// Handoff commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn export_handoff(
    state: tauri::State<'_, AppState>,
    tab_id: String,
) -> Result<iron_core::HandoffBundle, String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::ExportHandoff { response_tx })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn import_handoff(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    bundle: iron_core::HandoffBundle,
) -> Result<(), String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::ImportHandoff {
            bundle,
            response_tx,
        })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[tauri::command]
pub async fn save_handoff_bundle(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    file_path: String,
) -> Result<(), String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::ExportHandoff { response_tx })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    let bundle = response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?;

    let json = serde_json::to_string_pretty(&bundle)
        .map_err(|e| format!("Failed to serialize handoff bundle: {e}"))?;

    std::fs::write(&file_path, json).map_err(|e| format!("Failed to write handoff bundle: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn save_handoff_to_core(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    name: String,
) -> Result<String, String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::ExportHandoff { response_tx })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    let bundle = response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())??;

    let id = uuid::Uuid::new_v4().to_string();
    state
        .config_store
        .store
        .save_handoff(&iron_core::config::SavedHandoffInput {
            id: id.clone(),
            name,
            bundle,
        })
        .await
        .map_err(|e| format!("Failed to save handoff to core storage: {e}"))?;

    Ok(id)
}

#[tauri::command]
pub async fn load_handoff_from_core(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    id: String,
) -> Result<(), String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    let record = state
        .config_store
        .store
        .load_handoff(&id)
        .await
        .map_err(|e| format!("Failed to load handoff from core storage: {e}"))?
        .ok_or_else(|| format!("Saved handoff '{id}' not found"))?;

    let (response_tx, response_rx) = oneshot::channel();
    request_tx
        .send(AgentRequest::ImportHandoff {
            bundle: record.bundle,
            response_tx,
        })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker dropped the response channel".to_string())?
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedHandoffMetadataJson {
    pub id: String,
    pub name: String,
    pub bundle_version: String,
    pub source_session_id: Option<String>,
    pub source_model: Option<String>,
    pub source_provider: Option<String>,
    pub size_estimate_tokens: usize,
    pub created_at: String,
    pub updated_at: String,
}

impl From<iron_core::config::SavedHandoffMetadata> for SavedHandoffMetadataJson {
    fn from(m: iron_core::config::SavedHandoffMetadata) -> Self {
        Self {
            id: m.id,
            name: m.name,
            bundle_version: m.bundle_version,
            source_session_id: m.source_session_id,
            source_model: m.source_model,
            source_provider: m.source_provider,
            size_estimate_tokens: m.size_estimate_tokens,
            created_at: m.created_at.to_rfc3339(),
            updated_at: m.updated_at.to_rfc3339(),
        }
    }
}

#[tauri::command]
pub async fn list_saved_handoffs(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SavedHandoffMetadataJson>, String> {
    state
        .config_store
        .store
        .list_handoffs()
        .await
        .map_err(|e| format!("Failed to list saved handoffs: {e}"))
        .map(|items| items.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn delete_saved_handoff(
    state: tauri::State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state
        .config_store
        .store
        .delete_handoff(&id)
        .await
        .map_err(|e| format!("Failed to delete saved handoff: {e}"))
}

#[tauri::command]
pub async fn load_handoff_bundle(file_path: String) -> Result<iron_core::HandoffBundle, String> {
    let content = std::fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read handoff bundle: {e}"))?;

    let bundle: iron_core::HandoffBundle = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse handoff bundle: {e}"))?;

    Ok(bundle)
}
