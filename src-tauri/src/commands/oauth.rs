use serde::{Deserialize, Serialize};
use tauri::State;

use crate::state::AppState;
use iron_core::provider_credential::{
    domain::{ProviderAuthError, ProviderAuthStatus, ProviderSlug, StoredCredential},
    oauth::{poll_token_exchange, start_device_code_flow, v1_oauth_metadata},
};

// ── Sanitized frontend DTOs ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceCodeStartResponse {
    pub device_code: String,
    pub verification_uri: String,
    pub user_code: String,
    pub expires_in_secs: u64,
    pub interval_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderAuthStatusResponse {
    pub provider: String,
    pub status: String,
    pub expires_at: Option<u64>,
    pub reason: Option<String>,
}

// ── Commands ──

#[tauri::command]
pub async fn start_provider_oauth(
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<DeviceCodeStartResponse, String> {
    let slug = ProviderSlug::new(&provider_id);
    let metadata = v1_oauth_metadata(&slug)
        .ok_or_else(|| format!("Provider '{}' does not support OAuth", provider_id))?;

    let client = oauth_http_client()?;
    let result = start_device_code_flow(&metadata, &client)
        .await
        .map_err(|e| oauth_start_error(&provider_id, &e.to_string()))?;

    state
        .oauth_clients
        .write()
        .await
        .insert(oauth_flow_key(&provider_id, &result.device_code), client);

    Ok(DeviceCodeStartResponse {
        device_code: result.device_code,
        verification_uri: result.interaction.verification_uri,
        user_code: result.interaction.user_code,
        expires_in_secs: result.interaction.expires_in_secs,
        interval_secs: result.interaction.interval_secs,
    })
}

#[tauri::command]
pub async fn poll_provider_oauth(
    state: State<'_, AppState>,
    provider_id: String,
    device_code: String,
) -> Result<ProviderAuthStatusResponse, String> {
    let slug = ProviderSlug::new(&provider_id);
    let metadata = v1_oauth_metadata(&slug)
        .ok_or_else(|| format!("Provider '{}' does not support OAuth", provider_id))?;

    let flow_key = oauth_flow_key(&provider_id, &device_code);
    let client = match state.oauth_clients.read().await.get(&flow_key).cloned() {
        Some(client) => client,
        None => oauth_http_client()?,
    };
    let result = match poll_token_exchange(&metadata, &device_code, &client).await {
        Ok(result) => {
            state.oauth_clients.write().await.remove(&flow_key);
            result
        }
        Err(error) => {
            if !is_retryable_oauth_poll_error(&error) {
                state.oauth_clients.write().await.remove(&flow_key);
            }
            return Err(format!("OAuth token exchange failed: {}", error));
        }
    };

    let token_set = result.into_token_set(None);

    // Persist the credential
    if let Some(store) = &state.credential_store {
        store
            .set(&slug, StoredCredential::OAuthBearer(token_set.clone()))
            .await;
    }

    let expires_at = token_set.expires_at.map(|t| {
        t.duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs()
    });

    Ok(ProviderAuthStatusResponse {
        provider: provider_id,
        status: "connectedOAuth".to_string(),
        expires_at,
        reason: None,
    })
}

#[tauri::command]
pub async fn disconnect_provider_oauth(
    state: State<'_, AppState>,
    provider_id: String,
) -> Result<(), String> {
    let slug = ProviderSlug::new(&provider_id);

    if let Some(resolver) = &state.credential_resolver {
        resolver.disconnect_oauth(&slug).await;
    } else if let Some(store) = &state.credential_store {
        // Only remove OAuth credentials; never delete an API key
        if let Some(cred) = store.get(&slug).await {
            if matches!(cred, StoredCredential::OAuthBearer(_)) {
                store.remove(&slug).await;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn get_provider_auth_status(
    state: State<'_, AppState>,
    provider_id: String,
    api_key: Option<String>,
) -> Result<ProviderAuthStatusResponse, String> {
    let slug = ProviderSlug::new(&provider_id);

    // If API key is present and non-empty, let the resolver validate whether
    // this provider supports API-key auth before reporting it as configured.
    if let Some(key) = api_key {
        if !key.trim().is_empty() {
            if let Some(resolver) = &state.credential_resolver {
                return Ok(auth_status_response(
                    provider_id,
                    resolver.status(&slug, Some(key.trim())).await,
                ));
            }

            return Ok(ProviderAuthStatusResponse {
                provider: provider_id,
                status: "configuredApiKey".to_string(),
                expires_at: None,
                reason: None,
            });
        }
    }

    // Otherwise check credential resolver / store
    if let Some(resolver) = &state.credential_resolver {
        return Ok(auth_status_response(
            provider_id,
            resolver.status(&slug, None).await,
        ));
    }

    // Fallback: no resolver configured
    Ok(ProviderAuthStatusResponse {
        provider: provider_id,
        status: "notConfigured".to_string(),
        expires_at: None,
        reason: None,
    })
}

fn auth_status_response(
    provider_id: String,
    status: ProviderAuthStatus,
) -> ProviderAuthStatusResponse {
    let (status_str, expires_at, reason) = match status {
        ProviderAuthStatus::NotConfigured => ("notConfigured", None, None),
        ProviderAuthStatus::ConfiguredApiKey => ("configuredApiKey", None, None),
        ProviderAuthStatus::ConnectedOAuth { expires_at } => {
            let ts = expires_at.map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
            });
            ("connectedOAuth", ts, None)
        }
        ProviderAuthStatus::Refreshing => ("refreshing", None, None),
        ProviderAuthStatus::Expired => ("expired", None, None),
        ProviderAuthStatus::RefreshFailed { reason } => ("refreshFailed", None, Some(reason)),
        ProviderAuthStatus::Revoked => ("revoked", None, None),
        ProviderAuthStatus::UnsupportedCredential => ("unsupportedCredential", None, None),
    };

    ProviderAuthStatusResponse {
        provider: provider_id,
        status: status_str.to_string(),
        expires_at,
        reason,
    }
}

fn oauth_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|e| format!("Failed to create OAuth HTTP client: {}", e))
}

fn oauth_flow_key(provider_id: &str, device_code: &str) -> String {
    format!("{}\n{}", provider_id, device_code)
}

fn is_retryable_oauth_poll_error(error: &ProviderAuthError) -> bool {
    match error {
        ProviderAuthError::RefreshFailed { reason, .. } => {
            let lower = reason.to_lowercase();
            lower.contains("authorization pending") || lower.contains("polling too fast")
        }
        _ => false,
    }
}

fn oauth_start_error(provider_id: &str, error: &str) -> String {
    if provider_id == "codex" && looks_like_cloudflare_challenge(error) {
        return "OAuth start failed: Codex device-code OAuth is blocked by OpenAI's auth.openai.com Cloudflare challenge (403). This requires upstream/provider rescope to a supported Codex login flow; no credentials were stored.".to_string();
    }

    let message = format!("OAuth start failed: {}", error);
    if message.chars().count() > 800 {
        format!("{}...", message.chars().take(800).collect::<String>())
    } else {
        message
    }
}

fn looks_like_cloudflare_challenge(error: &str) -> bool {
    let lower = error.to_lowercase();
    lower.contains("403 forbidden")
        && (lower.contains("cloudflare")
            || lower.contains("challenges.cloudflare.com")
            || lower.contains("cf_chl")
            || lower.contains("just a moment"))
}
