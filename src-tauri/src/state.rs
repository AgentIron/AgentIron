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
    Shutdown,
}

/// Image data passed from the frontend.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageDataJson {
    pub data: String,
    pub mime_type: String,
}

/// MCP server status returned to the frontend.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatusJson {
    pub id: String,
    pub label: String,
    pub health: String,
    pub discovered_tools: Vec<McpToolInfoJson>,
    pub last_error: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolInfoJson {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
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
pub fn spawn_agent_worker(
    params: AgentParams,
    mut request_rx: mpsc::Receiver<AgentRequest>,
) {
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
            let agent = iron_core::IronAgent::with_tokio_handle(
                params.config,
                params.provider,
                bg_handle,
            );

            let working_dir = params.working_directory;
            let builtin_config = {
                let builtin_config = iron_core::BuiltinToolConfig::new(
                    vec![working_dir.clone()],
                );
                // Workaround: iron-core's ShellAvailability::detect() uses `which`
                // which doesn't exist on Windows (should use `where`). See iron-core#8.
                #[cfg(windows)]
                {
                    builtin_config
                        .with_shell_availability(iron_core::ShellAvailability::PowerShell)
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
                            &session, &app_handle, &tab_id, &blocks, &mut request_rx,
                        ).await;
                        emit_token_count(&session, &app_handle, &tab_id);
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::PromptWithBlocks {
                        text, images, app_handle, tab_id, response_tx,
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
                            &session, &app_handle, &tab_id, &blocks, &mut request_rx,
                        ).await;
                        emit_token_count(&session, &app_handle, &tab_id);
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::GetMcpStatus { response_tx } => {
                        let result = (|| -> Result<Vec<McpServerStatusJson>, String> {
                            let registry = agent.mcp_registry();
                            let servers = registry.list_servers();
                            Ok(servers.iter().map(|s| {
                                let enabled = session
                                    .is_mcp_server_enabled(&s.config.id)
                                    .unwrap_or(s.config.enabled_by_default);
                                McpServerStatusJson {
                                    id: s.config.id.clone(),
                                    label: s.config.label.clone(),
                                    health: format!("{:?}", s.health),
                                    discovered_tools: s.discovered_tools.iter().map(|t| {
                                        McpToolInfoJson {
                                            name: t.name.clone(),
                                            description: t.description.clone(),
                                            input_schema: t.input_schema.clone(),
                                        }
                                    }).collect(),
                                    last_error: s.last_error.clone(),
                                    enabled,
                                }
                            }).collect())
                        })();
                        let _ = response_tx.send(result);
                    }
                    AgentRequest::RegisterMcpServer { config: mcp, response_tx } => {
                        if let Some(config) = build_mcp_config(&mcp) {
                            agent.register_mcp_server(config);
                            let _ = response_tx.send(Ok(()));
                        } else {
                            let _ = response_tx.send(Err("Unknown transport".into()));
                        }
                    }
                    AgentRequest::SetMcpServerEnabled { server_id, enabled, response_tx } => {
                        session.set_mcp_server_enabled(&server_id, enabled);
                        let _ = response_tx.send(Ok(()));
                    }
                    AgentRequest::GetTokenCount { tab_id, app_handle } => {
                        emit_token_count(&session, &app_handle, &tab_id);
                    }
                    AgentRequest::Compact { tab_id, app_handle, response_tx } => {
                        let result = session
                            .checkpoint(iron_core::CompactionCheckpoint::TaskComplete)
                            .await
                            .map_err(|e| format!("{e}"));
                        emit_token_count(&session, &app_handle, &tab_id);
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

    while let Some(event) = events.next().await {
        match &event {
            iron_core::PromptEvent::Output { text } => {
                full_text.push_str(text);
                let _ = app_handle.emit(
                    "agent-stream-chunk",
                    serde_json::json!({ "tabId": tab_id, "chunk": text }),
                );
            }
            iron_core::PromptEvent::Complete { .. } => break,
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
                let approved = wait_for_approval(call_id, request_rx).await;
                if approved {
                    let _ = prompt_handle.approve(call_id);
                } else {
                    let _ = prompt_handle.deny(call_id);
                }
            }
            iron_core::PromptEvent::ToolResult { call_id, tool_name, status, result } => {
                let _ = app_handle.emit(
                    "agent-tool-event",
                    serde_json::json!({
                        "tabId": tab_id, "type": "tool_result",
                        "callId": call_id, "toolName": tool_name,
                        "status": format!("{:?}", status), "result": result,
                    }),
                );
            }
            _ => {}
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
        serde_json::json!({ "tabId": tab_id }),
    );

    Ok(full_text)
}

/// Wait for an approval response from the frontend for a specific call_id.
async fn wait_for_approval(
    call_id: &str,
    request_rx: &mut mpsc::Receiver<AgentRequest>,
) -> bool {
    loop {
        match request_rx.recv().await {
            Some(AgentRequest::ApprovalResponse {
                call_id: resp_id,
                approved,
            }) if resp_id == call_id => {
                return approved;
            }
            Some(AgentRequest::Shutdown) => return false,
            None => return false,
            _ => {}
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
                    if !command.is_empty() && !command.contains('.') && !command.contains('\\') && !command.contains('/') {
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
            url: mcp.url.clone().unwrap_or_default(),
        },
        "http_sse" => iron_core::McpTransport::HttpSse {
            url: mcp.url.clone().unwrap_or_default(),
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
