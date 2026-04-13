use serde::{Deserialize, Serialize};
use tokio::sync::oneshot;
use crate::state::{AgentRequest, AppState, ImageDataJson};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: String,
    pub role: String,
    pub content: String,
}

#[tauri::command]
pub async fn send_message(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    tab_id: String,
    content: String,
) -> Result<ChatMessage, String> {
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
        .send(AgentRequest::Prompt {
            content,
            app_handle: app,
            tab_id: tab_id.clone(),
            response_tx,
        })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    let full_text = response_rx
        .await
        .map_err(|_| "Agent worker thread dropped the response channel".to_string())?
        .map_err(|e| format!("Prompt error: {e}"))?;

    Ok(ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "assistant".to_string(),
        content: full_text,
    })
}

/// Send a message with text and images (uses blocking multimodal API).
#[tauri::command]
pub async fn send_message_with_images(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    tab_id: String,
    content: String,
    images: Vec<ImageDataJson>,
) -> Result<ChatMessage, String> {
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
        .send(AgentRequest::PromptWithBlocks {
            text: content,
            images,
            app_handle: app,
            tab_id: tab_id.clone(),
            response_tx,
        })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    let full_text = response_rx
        .await
        .map_err(|_| "Agent worker thread dropped the response channel".to_string())?
        .map_err(|e| format!("Prompt error: {e}"))?;

    Ok(ChatMessage {
        id: uuid::Uuid::new_v4().to_string(),
        role: "assistant".to_string(),
        content: full_text,
    })
}

/// Respond to a tool approval request from the agent.
#[tauri::command]
pub async fn respond_to_approval(
    state: tauri::State<'_, AppState>,
    tab_id: String,
    call_id: String,
    approved: bool,
) -> Result<(), String> {
    let request_tx = {
        let agents = state.agents.read().await;
        agents
            .get(&tab_id)
            .ok_or_else(|| "No agent session for this tab".to_string())?
            .request_tx
            .clone()
    };

    request_tx
        .send(AgentRequest::ApprovalResponse { call_id, approved })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    Ok(())
}

/// Compact the session context to reduce token usage.
#[tauri::command]
pub async fn compact_session(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    tab_id: String,
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
        .send(AgentRequest::Compact {
            tab_id,
            app_handle: app,
            response_tx,
        })
        .await
        .map_err(|_| "Agent worker thread is not running".to_string())?;

    response_rx
        .await
        .map_err(|_| "Agent worker thread dropped the response channel".to_string())?
}
