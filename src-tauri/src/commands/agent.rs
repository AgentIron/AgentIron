use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::sync::mpsc;
use tokio::sync::oneshot;
use crate::state::{AgentHandle, AgentParams, AgentRequest, AppState, McpServerConfigJson, McpServerStatusJson, spawn_agent_worker};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentInfo {
    pub id: String,
    pub name: String,
    pub transport: String,
    pub status: String,
    pub working_directory: String,
}

/// Build a provider profile for the given provider ID.
/// Known providers use their iron-providers registry profiles.
/// OpenAI is added manually since it's not in the default registry.
fn build_provider(
    provider_id: &str,
    api_key: &str,
) -> Result<iron_providers::GenericProvider, String> {
    let profile = match provider_id {
        "openai" => iron_providers::ProviderProfile::new(
            "openai",
            iron_providers::ApiFamily::OpenAiChatCompletions,
            "https://api.openai.com/v1",
        )
        .with_auth(iron_providers::AuthStrategy::BearerToken),

        "anthropic" => iron_providers::ProviderProfile::new(
            "anthropic",
            iron_providers::ApiFamily::AnthropicMessages,
            "https://api.anthropic.com",
        )
        .with_auth(iron_providers::AuthStrategy::ApiKeyHeader {
            header_name: "x-api-key".into(),
        }),

        "minimax" => iron_providers::ProviderProfile::new(
            "minimax",
            iron_providers::ApiFamily::AnthropicMessages,
            "https://api.minimax.io/anthropic",
        )
        .with_auth(iron_providers::AuthStrategy::BearerToken),

        "minimax-code" => iron_providers::ProviderProfile::new(
            "minimax-code",
            iron_providers::ApiFamily::AnthropicMessages,
            "https://api.minimax.io/anthropic",
        )
        .with_auth(iron_providers::AuthStrategy::BearerToken),

        "zai" => iron_providers::ProviderProfile::new(
            "zai",
            iron_providers::ApiFamily::OpenAiChatCompletions,
            "https://api.z.ai/api/paas/v4",
        ),

        "zai-code" => iron_providers::ProviderProfile::new(
            "zai-code",
            iron_providers::ApiFamily::OpenAiChatCompletions,
            "https://api.z.ai/api/coding/paas/v4",
        ),

        "kimi" => iron_providers::ProviderProfile::new(
            "kimi",
            iron_providers::ApiFamily::OpenAiChatCompletions,
            "https://api.moonshot.ai/v1",
        ),

        "kimi-code" => iron_providers::ProviderProfile::new(
            "kimi-code",
            iron_providers::ApiFamily::OpenAiChatCompletions,
            "https://api.moonshot.ai/v1",
        ),

        "openrouter" => iron_providers::ProviderProfile::new(
            "openrouter",
            iron_providers::ApiFamily::OpenAiChatCompletions,
            "https://openrouter.ai/api/v1",
        )
        .with_header("HTTP-Referer", "https://github.com/AgentIron/AgentIron")
        .with_header("X-OpenRouter-Title", "AgentIron"),

        "requesty" => iron_providers::ProviderProfile::new(
            "requesty",
            iron_providers::ApiFamily::OpenAiChatCompletions,
            "https://api.requesty.ai/v1",
        ),

        other => return Err(format!("Unknown provider: {other}")),
    };

    let runtime_config = iron_providers::RuntimeConfig::new(api_key);
    iron_providers::GenericProvider::from_profile(profile, runtime_config)
        .map_err(|e| format!("Provider error: {e}"))
}

#[tauri::command]
pub async fn create_agent(
    state: tauri::State<'_, AppState>,
    api_key: String,
    model: String,
    tab_id: String,
    working_directory: Option<String>,
    provider_id: Option<String>,
    mcp_servers: Option<Vec<McpServerConfigJson>>,
    transport: Option<String>,
) -> Result<AgentInfo, String> {
    let transport = transport.unwrap_or_else(|| "in-process".to_string());
    if transport != "in-process" {
        return Err(format!("Transport '{}' is not supported. Only 'in-process' is available.", transport));
    }

    let pid = provider_id.unwrap_or_else(|| "openai".to_string());
    let provider = build_provider(&pid, &api_key)?;

    let config = iron_core::Config::default()
        .with_model(model.clone())
        .with_max_iterations(10)
        .with_embedded_python_enabled()
        .with_context_management(
            iron_core::ContextManagementConfig::new()
                .enabled()
                .with_maintenance_threshold(50_000)
        )
        .with_mcp(
            iron_core::McpConfig::new()
                .with_enabled(true)
                .with_enabled_by_default(true)
        );

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
            provider,
            working_directory: work_dir,
            mcp_servers: mcp_servers.unwrap_or_default(),
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
        .send(AgentRequest::RegisterMcpServer { config, response_tx })
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
