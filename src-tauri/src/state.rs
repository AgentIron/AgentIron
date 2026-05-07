use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, RwLock};

/// Request sent to an agent worker thread.
pub enum AgentRequest {
    Prompt {
        content: String,
        app_handle: tauri::AppHandle,
        tab_id: String,
        response_tx: oneshot::Sender<Result<String, String>>,
    },
    /// Send a prompt with text + images (uses streaming multimodal API).
    PromptWithBlocks {
        text: String,
        images: Vec<ImageDataJson>,
        app_handle: tauri::AppHandle,
        tab_id: String,
        response_tx: oneshot::Sender<Result<String, String>>,
    },
    /// Respond to a tool approval request.
    ApprovalResponse {
        call_id: String,
        approved: bool,
    },
    /// Cancel the currently active prompt, if one exists.
    CancelActivePrompt {
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    /// Register a new MCP server on the running agent.
    RegisterMcpServer {
        config: McpServerConfigJson,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    /// Query MCP server status from the registry.
    GetMcpStatus {
        response_tx: oneshot::Sender<Result<Vec<McpServerStatusJson>, String>>,
    },
    /// Enable or disable an MCP server for the current session.
    SetMcpServerEnabled {
        server_id: String,
        enabled: bool,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    /// Force-reconnect an MCP server.
    ReconnectMcpServer {
        server_id: String,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    /// Query the current token count.
    #[allow(dead_code)]
    GetTokenCount {
        tab_id: String,
        app_handle: tauri::AppHandle,
    },
    /// Compact the session context.
    Compact {
        tab_id: String,
        app_handle: tauri::AppHandle,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    /// Refresh the skill catalog and return diagnostics.
    RefreshSkillCatalog {
        response_tx: oneshot::Sender<Result<Vec<SkillDiagnosticJson>, String>>,
    },
    /// List skills available in the runtime catalog.
    ListAvailableSkills {
        response_tx: oneshot::Sender<Result<Vec<SkillMetadataJson>, String>>,
    },
    /// Activate a skill for this session.
    ActivateSkill {
        name: String,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    /// Deactivate a skill for this session.
    DeactivateSkill {
        name: String,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    /// List the names of skills currently active in this session.
    ListActiveSkills {
        response_tx: oneshot::Sender<Result<Vec<String>, String>>,
    },
    /// Export a handoff bundle for this session.
    ExportHandoff {
        response_tx: oneshot::Sender<Result<iron_core::HandoffBundle, String>>,
    },
    /// Import a handoff bundle into this session.
    ImportHandoff {
        bundle: iron_core::HandoffBundle,
        response_tx: oneshot::Sender<Result<(), String>>,
    },
    Shutdown,
}

/// Image data passed from the frontend.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDataJson {
    pub data: String,
    pub mime_type: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum McpErrorCategory {
    TransportSetup,
    Initialize,
    ResponseParse,
    Auth,
    ToolDiscovery,
    ServerError,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum McpErrorStage {
    Connection,
    Initialize,
    ToolDiscovery,
}

/// MCP server status returned to the frontend.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatusJson {
    pub id: String,
    pub label: String,
    pub health: String,
    pub transport: String,
    pub endpoint: String,
    pub discovered_tools: Vec<McpToolInfoJson>,
    pub last_error: Option<String>,
    pub error_category: Option<McpErrorCategory>,
    pub error_stage: Option<McpErrorStage>,
    pub guidance: Option<String>,
    pub enabled: bool,
}

fn categorize_error(error: &str) -> (McpErrorCategory, McpErrorStage, String) {
    let lower = error.to_lowercase();

    let category = if lower.contains("tool")
        && (lower.contains("discover") || lower.contains("list") || lower.contains("fetch"))
    {
        McpErrorCategory::ToolDiscovery
    } else if lower.contains("connection refused")
        || lower.contains("connection reset")
        || lower.contains("timed out")
        || lower.contains("timeout")
        || lower.contains("couldn't connect")
        || lower.contains("no such host")
        || lower.contains("dns")
        || lower.contains("network")
        || lower.contains("tcp")
        || lower.contains("socket")
        || lower.contains("transport")
        || lower.contains("io error")
        || lower.contains("process failed")
        || lower.contains("spawn")
        || lower.contains("command not found")
        || lower.contains("executable not found")
        || lower.contains("no such file")
        || lower.contains("executable ")
    {
        McpErrorCategory::TransportSetup
    } else if lower.contains("unauthorized")
        || lower.contains("forbidden")
        || lower.contains("401")
        || lower.contains("403")
        || lower.contains("authentication")
        || lower.contains("api key")
        || lower.contains("invalid token")
        || lower.contains("access denied")
    {
        McpErrorCategory::Auth
    } else if lower.contains("initialize")
        || lower.contains("handshake")
        || lower.contains("protocol version")
        || lower.contains("capabilities")
    {
        McpErrorCategory::Initialize
    } else if lower.contains("parse")
        || lower.contains("json")
        || lower.contains("deserialize")
        || lower.contains("expected token")
        || lower.contains("expected value")
        || lower.contains("expected object")
        || lower.contains("expected array")
        || lower.contains("unexpected token")
        || lower.contains("invalid response")
        || lower.contains("event stream")
        || lower.contains("text/event-stream")
        || lower.contains("server-sent event")
        || lower.contains("content-type")
    {
        McpErrorCategory::ResponseParse
    } else {
        McpErrorCategory::ServerError
    };

    let stage = match category {
        McpErrorCategory::TransportSetup | McpErrorCategory::Auth => McpErrorStage::Connection,
        McpErrorCategory::Initialize => McpErrorStage::Initialize,
        McpErrorCategory::ToolDiscovery => McpErrorStage::ToolDiscovery,
        McpErrorCategory::ResponseParse => McpErrorStage::Initialize,
        McpErrorCategory::ServerError => McpErrorStage::Connection,
    };

    let guidance = match category {
        McpErrorCategory::TransportSetup => "Check that the server is running and reachable. For stdio, verify the command is installed. For HTTP, verify the URL and network connectivity.".into(),
        McpErrorCategory::Auth => "Check your API key or authentication headers in the server configuration.".into(),
        McpErrorCategory::Initialize => "The server may be running an incompatible MCP protocol version. Check server logs for details.".into(),
        McpErrorCategory::ResponseParse => "The server returned an unexpected response. If using HTTP+SSE, try switching to HTTP (Streamable HTTP). Some servers do not fully support SSE transport.".into(),
        McpErrorCategory::ToolDiscovery => "The server connected but tool discovery failed. The server may not implement the tools/list method correctly.".into(),
        McpErrorCategory::ServerError => "The server reported an internal error. Check server logs for details.".into(),
    };

    (category, stage, guidance)
}

fn mcp_health_label(health: iron_core::McpServerHealth) -> &'static str {
    match health {
        iron_core::McpServerHealth::Configured => "Configured",
        iron_core::McpServerHealth::Connecting => "Connecting",
        iron_core::McpServerHealth::Connected => "Connected",
        iron_core::McpServerHealth::Error => "Error",
        iron_core::McpServerHealth::Disabled => "Disabled",
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolInfoJson {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

/// Skill metadata returned to the frontend.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillMetadataJson {
    pub id: String,
    pub display_name: String,
    pub description: String,
    pub origin: String,
    pub auto_activate: bool,
    pub tags: Vec<String>,
    pub requires_tools: Vec<String>,
    pub requires_capabilities: Vec<String>,
    pub requires_trust: bool,
}

/// Skill diagnostic returned to the frontend.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillDiagnosticJson {
    pub level: String,
    pub message: String,
    pub skill_name: Option<String>,
}

/// MCP server config passed from the frontend.
#[derive(Debug, Clone, serde::Deserialize)]
#[allow(dead_code)]
pub struct McpServerConfigJson {
    pub id: String,
    pub label: String,
    pub transport: String,
    pub command: Option<String>,
    pub args: Option<Vec<String>>,
    pub env: Option<HashMap<String, String>>,
    pub url: Option<String>,
    pub headers: Option<HashMap<String, String>>,
    #[serde(rename = "workingDir")]
    pub working_dir: Option<String>,
    #[serde(rename = "enabledByDefault")]
    pub enabled_by_default: bool,
    pub description: Option<String>,
}

/// Parameters needed to create an agent on the worker thread.
pub struct AgentParams {
    pub config: iron_core::Config,
    pub provider: iron_providers::GenericProvider,
    pub working_directory: PathBuf,
    pub mcp_servers: Vec<McpServerConfigJson>,
}

unsafe impl Send for AgentParams {}

/// A handle to communicate with an agent worker thread.
pub struct AgentHandle {
    pub request_tx: mpsc::Sender<AgentRequest>,
    pub name: String,
}

/// Managed application state held by Tauri.
pub struct AppState {
    pub agents: Arc<RwLock<HashMap<String, AgentHandle>>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            agents: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

/// Spawn a dedicated thread for an agent.
///
/// Architecture: Two runtimes are used:
/// - A multi-thread runtime (`bg_rt`) for iron-core's background tasks (MCP connections, etc.)
/// - A current-thread runtime + LocalSet for the !Send AgentSession
///
/// The IronAgent gets the multi-thread runtime's handle so its spawned tasks
/// (MCP connect, health checks, etc.) actually run on background threads.
pub fn spawn_agent_worker(params: AgentParams, mut request_rx: mpsc::Receiver<AgentRequest>) {
    std::thread::spawn(move || {
        // Background runtime for iron-core's async tasks (MCP, plugins, etc.)
        let bg_rt = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2)
            .enable_all()
            .build()
            .expect("Failed to create background runtime");

        let bg_handle = bg_rt.handle().clone();

        // Current-thread runtime + LocalSet for the !Send AgentSession
        let local_rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("Failed to create local runtime");

        let local = tokio::task::LocalSet::new();

        local.block_on(&local_rt, async move {
            // Give the agent the BACKGROUND runtime handle so its spawned tasks
            // (MCP connections, etc.) run on actual worker threads
            let agent =
                iron_core::IronAgent::with_tokio_handle(params.config, params.provider, bg_handle);

            let working_dir = params.working_directory;
            let builtin_config = {
                let builtin_config = iron_core::BuiltinToolConfig::new(vec![working_dir.clone()]);
                // Workaround: iron-core's ShellAvailability::detect() uses `which`
                // which doesn't exist on Windows (should use `where`). See iron-core#8.
                #[cfg(windows)]
                {
                    builtin_config.with_shell_availability(iron_core::ShellAvailability::PowerShell)
                }
                #[cfg(not(windows))]
                {
                    builtin_config
                }
            };
            agent.register_builtin_tools(&builtin_config);
            agent.register_python_exec_tool();

            // Register MCP servers — connections spawn on the bg_rt
            for mcp in &params.mcp_servers {
                if let Some(config) = build_mcp_config(mcp) {
                    agent.register_mcp_server(config);
                }
            }

            let connection = agent.connect();
            let session = match connection.create_session() {
                Ok(s) => s,
                Err(e) => {
                    eprintln!("[agent-worker] Session error: {e}");
                    while let Some(req) = request_rx.recv().await {
                        if let AgentRequest::Prompt { response_tx, .. } = req {
                            let _ = response_tx.send(Err(format!("Session creation failed: {e}")));
                        }
                    }
                    return;
                }
            };

            while let Some(request) = request_rx.recv().await {
                match request {
                    AgentRequest::Prompt {
                        content,
                        app_handle,
                        tab_id,
                        response_tx,
                    } => {
                        let blocks = vec![iron_core::ContentBlock::Text { text: content }];
                        let result = handle_prompt_stream(
                            &session,
                            &app_handle,
                            &tab_id,
                            &blocks,
                            &mut request_rx,
                        )
                        .await;
                        emit_token_count(&session, &app_handle, &tab_id);
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::PromptWithBlocks {
                        text,
                        images,
                        app_handle,
                        tab_id,
                        response_tx,
                    } => {
                        let mut blocks: Vec<iron_core::ContentBlock> = Vec::new();
                        for img in &images {
                            blocks.push(iron_core::ContentBlock::Image {
                                data: img.data.clone(),
                                mime_type: img.mime_type.clone(),
                            });
                        }
                        if !text.is_empty() {
                            blocks.push(iron_core::ContentBlock::Text { text });
                        }
                        let result = handle_prompt_stream(
                            &session,
                            &app_handle,
                            &tab_id,
                            &blocks,
                            &mut request_rx,
                        )
                        .await;
                        emit_token_count(&session, &app_handle, &tab_id);
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::GetMcpStatus { response_tx } => {
                        let registry = agent.mcp_registry();
                        let servers = registry.list_servers();
                        let result = Ok(servers
                            .iter()
                            .map(|s| {
                                let enabled = session
                                    .is_mcp_server_enabled(&s.config.id)
                                    .unwrap_or(s.config.enabled_by_default);

                                let (transport_label, endpoint) = match &s.config.transport {
                                    iron_core::McpTransport::Stdio { command, args, .. } => (
                                        "stdio".into(),
                                        if args.is_empty() {
                                            command.clone()
                                        } else {
                                            format!("{} {}", command, args.join(" "))
                                        },
                                    ),
                                    iron_core::McpTransport::Http { config } => {
                                        ("http".into(), config.url.clone())
                                    }
                                    iron_core::McpTransport::HttpSse { config } => {
                                        ("http_sse".into(), config.url.clone())
                                    }
                                };

                                let (error_category, error_stage, guidance) = s
                                    .last_error
                                    .as_deref()
                                    .map(categorize_error)
                                    .map(|(c, st, g)| (Some(c), Some(st), Some(g)))
                                    .unwrap_or((None, None, None));

                                McpServerStatusJson {
                                    id: s.config.id.clone(),
                                    label: s.config.label.clone(),
                                    health: mcp_health_label(s.health).into(),
                                    transport: transport_label,
                                    endpoint,
                                    discovered_tools: s
                                        .discovered_tools
                                        .iter()
                                        .map(|t| McpToolInfoJson {
                                            name: t.name.clone(),
                                            description: t.description.clone(),
                                            input_schema: t.input_schema.clone(),
                                        })
                                        .collect(),
                                    last_error: s.last_error.clone(),
                                    error_category,
                                    error_stage,
                                    guidance,
                                    enabled,
                                }
                            })
                            .collect());
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::RegisterMcpServer {
                        config: mcp,
                        response_tx,
                    } => {
                        if let Some(config) = build_mcp_config(&mcp) {
                            agent.register_mcp_server(config);
                            let _ = response_tx.send(Ok(()));
                        } else {
                            let _ = response_tx.send(Err("Unknown transport".into()));
                        }
                    }
                    AgentRequest::SetMcpServerEnabled {
                        server_id,
                        enabled,
                        response_tx,
                    } => {
                        session.set_mcp_server_enabled(&server_id, enabled);
                        let _ = response_tx.send(Ok(()));
                    }
                    AgentRequest::ReconnectMcpServer {
                        server_id,
                        response_tx,
                    } => {
                        let manager = agent.runtime().mcp_connection_manager();
                        manager.reconnect_server(&server_id).await;
                        let server_state = agent.mcp_registry().get_server(&server_id);
                        let connected = manager.is_connected(&server_id).await;
                        let result = match server_state {
                            Some(_) if connected => Ok(()),
                            Some(server) => Err(server.last_error.unwrap_or_else(|| {
                                format!("MCP server {server_id} did not reconnect")
                            })),
                            None => Err(format!("MCP server {server_id} is not registered")),
                        };
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::GetTokenCount { tab_id, app_handle } => {
                        emit_token_count(&session, &app_handle, &tab_id);
                    }
                    AgentRequest::Compact {
                        tab_id,
                        app_handle,
                        response_tx,
                    } => {
                        let result = session
                            .checkpoint(iron_core::CompactionCheckpoint::TaskComplete)
                            .await
                            .map_err(|e| e.to_string());
                        emit_token_count(&session, &app_handle, &tab_id);
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::CancelActivePrompt { response_tx } => {
                        let _ = response_tx.send(Ok(()));
                    }
                    AgentRequest::RefreshSkillCatalog { response_tx } => {
                        let diagnostics = session.refresh_skill_catalog();
                        let result = Ok(diagnostics
                            .into_iter()
                            .map(|d| SkillDiagnosticJson {
                                level: format!("{:?}", d.level),
                                message: d.message,
                                skill_name: d.skill_name,
                            })
                            .collect());
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::ListAvailableSkills { response_tx } => {
                        let skills = session.list_available_skills();
                        let result = Ok(skills
                            .into_iter()
                            .map(|s| SkillMetadataJson {
                                id: s.id,
                                display_name: s.display_name,
                                description: s.description,
                                origin: format!("{:?}", s.origin),
                                auto_activate: s.auto_activate,
                                tags: s.tags,
                                requires_tools: s.requires_tools,
                                requires_capabilities: s.requires_capabilities,
                                requires_trust: s.requires_trust,
                            })
                            .collect());
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::ActivateSkill { name, response_tx } => {
                        let result = session.activate_skill(&name).map_err(|e| e.to_string());
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::DeactivateSkill { name, response_tx } => {
                        session.deactivate_skill(&name);
                        let _ = response_tx.send(Ok(()));
                    }
                    AgentRequest::ListActiveSkills { response_tx } => {
                        let skills = session.list_active_skills();
                        let _ = response_tx.send(Ok(skills));
                    }
                    AgentRequest::ExportHandoff { response_tx } => {
                        let result = session
                            .export_handoff("", None)
                            .await
                            .map_err(|e| e.to_string());
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::ImportHandoff {
                        bundle,
                        response_tx,
                    } => {
                        let result = session.import_handoff(bundle).map_err(|e| e.to_string());
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::Shutdown => break,
                    _ => {}
                }
            }
        });

        // Keep bg_rt alive until the worker exits — dropping it shuts down MCP connections
        drop(bg_rt);
    });
}

async fn handle_prompt_stream(
    session: &iron_core::AgentSession,
    app_handle: &tauri::AppHandle,
    tab_id: &str,
    blocks: &[iron_core::ContentBlock],
    request_rx: &mut mpsc::Receiver<AgentRequest>,
) -> Result<String, String> {
    use tauri::Emitter;

    let (prompt_handle, mut events) = session.prompt_stream_with_blocks(blocks);
    let mut full_text = String::new();
    let mut was_cancelled = false;

    loop {
        tokio::select! {
            maybe_event = events.next() => {
                let Some(event) = maybe_event else {
                    break;
                };

                match &event {
                    iron_core::PromptEvent::Output { text } => {
                        full_text.push_str(text);
                        let _ = app_handle.emit(
                            "agent-stream-chunk",
                            serde_json::json!({ "tabId": tab_id, "chunk": text }),
                        );
                    }
                    iron_core::PromptEvent::Complete { outcome } => {
                        if *outcome == iron_core::PromptOutcome::Cancelled {
                            was_cancelled = true;
                        }
                        break;
                    }
                    iron_core::PromptEvent::Status { message } => {
                        let _ = app_handle.emit(
                            "agent-event",
                            serde_json::json!({ "tabId": tab_id, "type": "status", "message": message }),
                        );
                    }
                    iron_core::PromptEvent::ToolCall { call_id, tool_name, arguments } => {
                        let _ = app_handle.emit(
                            "agent-tool-event",
                            serde_json::json!({
                                "tabId": tab_id, "type": "tool_call",
                                "callId": call_id, "toolName": tool_name, "arguments": arguments,
                            }),
                        );
                    }
                    iron_core::PromptEvent::ApprovalRequest { call_id, tool_name, arguments } => {
                        let _ = app_handle.emit(
                            "agent-tool-event",
                            serde_json::json!({
                                "tabId": tab_id, "type": "approval_request",
                                "callId": call_id, "toolName": tool_name, "arguments": arguments,
                            }),
                        );
                        match wait_for_approval(call_id, request_rx, session, app_handle, tab_id, &prompt_handle).await {
                            ApprovalDecision::Approve => {
                                let _ = prompt_handle.approve(call_id);
                            }
                            ApprovalDecision::Deny => {
                                let _ = prompt_handle.deny(call_id);
                            }
                            ApprovalDecision::Cancel => {
                                was_cancelled = true;
                            }
                        }
                    }
                    iron_core::PromptEvent::ToolResult {
                        call_id,
                        tool_name,
                        status,
                        result,
                        ..
                    } => {
                        let _ = app_handle.emit(
                            "agent-tool-event",
                            serde_json::json!({
                                "tabId": tab_id, "type": "tool_result",
                                "callId": call_id, "toolName": tool_name,
                                "status": format!("{:?}", status), "result": result,
                            }),
                        );
                    }
                    iron_core::PromptEvent::ScriptActivity {
                        script_id,
                        parent_call_id,
                        activity_type,
                        status,
                        detail,
                    } => {
                        let _ = app_handle.emit(
                            "agent-tool-event",
                            serde_json::json!({
                                "tabId": tab_id,
                                "type": "script_activity",
                                "scriptId": script_id,
                                "parentCallId": parent_call_id,
                                "toolName": "python_exec",
                                "activityType": format!("{:?}", activity_type),
                                "status": format!("{:?}", status),
                                "detail": detail,
                            }),
                        );
                    }
                    _ => {}
                }
            }
            maybe_request = request_rx.recv() => {
                let Some(request) = maybe_request else {
                    break;
                };

                if handle_active_request(request, session, app_handle, tab_id, &prompt_handle).await {
                    was_cancelled = true;
                }
            }
        }
    }

    // Fallback: extract from session messages if streaming produced no output
    if full_text.is_empty() {
        let messages = session.messages();
        for msg in messages.iter().rev() {
            if let iron_core::StructuredMessage::Agent { content } = msg {
                let text: String = content
                    .iter()
                    .filter_map(|block| block.to_text())
                    .collect::<Vec<_>>()
                    .join("");
                if !text.is_empty() {
                    full_text = text;
                }
                break;
            }
        }
    }

    let _ = app_handle.emit(
        "agent-stream-done",
        serde_json::json!({ "tabId": tab_id, "cancelled": was_cancelled }),
    );

    Ok(full_text)
}

enum ApprovalDecision {
    Approve,
    Deny,
    Cancel,
}

/// Wait for an approval response from the frontend for a specific call_id.
async fn wait_for_approval(
    call_id: &str,
    request_rx: &mut mpsc::Receiver<AgentRequest>,
    session: &iron_core::AgentSession,
    app_handle: &tauri::AppHandle,
    tab_id: &str,
    prompt_handle: &iron_core::PromptHandle,
) -> ApprovalDecision {
    loop {
        match request_rx.recv().await {
            Some(AgentRequest::ApprovalResponse {
                call_id: resp_id,
                approved,
            }) if resp_id == call_id => {
                return if approved {
                    ApprovalDecision::Approve
                } else {
                    ApprovalDecision::Deny
                };
            }
            Some(request) => {
                if handle_active_request(request, session, app_handle, tab_id, prompt_handle).await
                {
                    return ApprovalDecision::Cancel;
                }
            }
            None => return ApprovalDecision::Cancel,
        }
    }
}

async fn handle_active_request(
    request: AgentRequest,
    session: &iron_core::AgentSession,
    _app_handle: &tauri::AppHandle,
    _tab_id: &str,
    prompt_handle: &iron_core::PromptHandle,
) -> bool {
    match request {
        AgentRequest::ApprovalResponse { .. } => false,
        AgentRequest::CancelActivePrompt { response_tx } => {
            prompt_handle.cancel().await;
            let _ = response_tx.send(Ok(()));
            true
        }
        AgentRequest::GetTokenCount { tab_id, app_handle } => {
            emit_token_count(session, &app_handle, &tab_id);
            false
        }
        AgentRequest::Compact { response_tx, .. } => {
            let _ = response_tx.send(Err(
                "Cannot compact a session while a prompt is running".into()
            ));
            false
        }
        AgentRequest::RegisterMcpServer { response_tx, .. } => {
            let _ = response_tx.send(Err(
                "Cannot register MCP servers while a prompt is running".into()
            ));
            false
        }
        AgentRequest::GetMcpStatus { response_tx } => {
            let _ = response_tx.send(Err(
                "Cannot query MCP status while a prompt is running".into()
            ));
            false
        }
        AgentRequest::SetMcpServerEnabled { response_tx, .. } => {
            let _ = response_tx.send(Err(
                "Cannot change MCP enablement while a prompt is running".into(),
            ));
            false
        }
        AgentRequest::ReconnectMcpServer { response_tx, .. } => {
            let _ = response_tx.send(Err(
                "Cannot reconnect MCP servers while a prompt is running".into(),
            ));
            false
        }
        AgentRequest::Prompt { response_tx, .. } => {
            let _ = response_tx.send(Err("A prompt is already running for this tab".into()));
            false
        }
        AgentRequest::PromptWithBlocks { response_tx, .. } => {
            let _ = response_tx.send(Err("A prompt is already running for this tab".into()));
            false
        }
        AgentRequest::Shutdown => {
            prompt_handle.cancel().await;
            true
        }
        AgentRequest::RefreshSkillCatalog { response_tx } => {
            let diagnostics = session.refresh_skill_catalog();
            let result = Ok(diagnostics
                .into_iter()
                .map(|d| SkillDiagnosticJson {
                    level: format!("{:?}", d.level),
                    message: d.message,
                    skill_name: d.skill_name,
                })
                .collect());
            let _ = response_tx.send(result);
            false
        }
        AgentRequest::ListAvailableSkills { response_tx } => {
            let skills = session.list_available_skills();
            let result = Ok(skills
                .into_iter()
                .map(|s| SkillMetadataJson {
                    id: s.id,
                    display_name: s.display_name,
                    description: s.description,
                    origin: format!("{:?}", s.origin),
                    auto_activate: s.auto_activate,
                    tags: s.tags,
                    requires_tools: s.requires_tools,
                    requires_capabilities: s.requires_capabilities,
                    requires_trust: s.requires_trust,
                })
                .collect());
            let _ = response_tx.send(result);
            false
        }
        AgentRequest::ActivateSkill { name, response_tx } => {
            let result = session.activate_skill(&name).map_err(|e| e.to_string());
            let _ = response_tx.send(result);
            false
        }
        AgentRequest::DeactivateSkill { name, response_tx } => {
            session.deactivate_skill(&name);
            let _ = response_tx.send(Ok(()));
            false
        }
        AgentRequest::ListActiveSkills { response_tx } => {
            let skills = session.list_active_skills();
            let _ = response_tx.send(Ok(skills));
            false
        }
        AgentRequest::ExportHandoff { response_tx } => {
            let _ = response_tx.send(Err("Cannot export handoff while a prompt is running".into()));
            false
        }
        AgentRequest::ImportHandoff { response_tx, .. } => {
            let _ = response_tx.send(Err("Cannot import handoff while a prompt is running".into()));
            false
        }
    }
}

/// Build an iron-core McpServerConfig from frontend JSON config.
fn build_mcp_config(mcp: &McpServerConfigJson) -> Option<iron_core::McpServerConfig> {
    let transport = match mcp.transport.as_str() {
        "stdio" => {
            let env = mcp.env.clone().unwrap_or_default();
            let command = {
                let command = mcp.command.clone().unwrap_or_default();

                // On Windows, resolve .cmd extensions for batch scripts (npx, node, npm)
                #[cfg(windows)]
                {
                    let mut command = command;
                    if !command.is_empty()
                        && !command.contains('.')
                        && !command.contains('\\')
                        && !command.contains('/')
                    {
                        if let Ok(output) = std::process::Command::new("where")
                            .arg(format!("{}.cmd", command))
                            .output()
                        {
                            if output.status.success() {
                                command = format!("{}.cmd", command);
                            }
                        }
                    }
                    command
                }

                #[cfg(not(windows))]
                {
                    command
                }
            };

            iron_core::McpTransport::Stdio {
                command,
                args: mcp.args.clone().unwrap_or_default(),
                env,
            }
        }
        "http" => iron_core::McpTransport::Http {
            config: iron_core::HttpConfig {
                url: mcp.url.clone().unwrap_or_default(),
                headers: mcp.headers.clone(),
            },
        },
        "http_sse" => iron_core::McpTransport::HttpSse {
            config: iron_core::HttpConfig {
                url: mcp.url.clone().unwrap_or_default(),
                headers: mcp.headers.clone(),
            },
        },
        _ => return None,
    };

    Some(iron_core::McpServerConfig {
        id: mcp.id.clone(),
        label: mcp.label.clone(),
        transport,
        enabled_by_default: mcp.enabled_by_default,
        working_dir: mcp.working_dir.clone().map(PathBuf::from),
    })
}

fn emit_token_count(
    session: &iron_core::AgentSession,
    app_handle: &tauri::AppHandle,
    tab_id: &str,
) {
    use tauri::Emitter;
    let tokens = session.uncompacted_tokens();
    let _ = app_handle.emit(
        "agent-context-update",
        serde_json::json!({ "tabId": tab_id, "activeTokens": tokens }),
    );
}
