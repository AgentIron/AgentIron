use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A model entry returned to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryModel {
    pub id: String,
    pub name: String,
    pub provider_id: String,
    pub context_window: Option<u64>,
    pub output_limit: Option<u64>,
    pub tool_call: bool,
    pub reasoning: bool,
    pub vision: bool,
    pub cost_input: Option<f64>,
    pub cost_output: Option<f64>,
}

/// Intermediate types for parsing models.dev/api.json
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ApiProvider {
    id: Option<String>,
    name: Option<String>,
    models: Option<HashMap<String, ApiModel>>,
}

#[derive(Debug, Deserialize)]
struct ApiModel {
    id: Option<String>,
    name: Option<String>,
    tool_call: Option<bool>,
    reasoning: Option<bool>,
    attachment: Option<bool>,
    limit: Option<ApiLimit>,
    cost: Option<ApiCost>,
    modalities: Option<ApiModalities>,
    #[serde(default)]
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiLimit {
    context: Option<u64>,
    output: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ApiCost {
    input: Option<f64>,
    output: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ApiModalities {
    input: Option<Vec<String>>,
}

/// Fetch the model registry from models.dev and return parsed models.
/// Uses iron-providers' ProviderRegistry to dynamically map models.dev
/// provider IDs to our provider IDs via the models_dev_slug metadata.
#[tauri::command]
pub async fn update_model_registry() -> Result<Vec<RegistryModel>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("https://models.dev/api.json")
        .timeout(std::time::Duration::from_secs(15))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch model registry: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Model registry returned status {}",
            response.status()
        ));
    }

    let data: HashMap<String, ApiProvider> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse model registry: {e}"))?;

    // Use iron-providers' builtin registry for models.dev → provider ID mapping.
    // Register OpenAI manually since it's not in the default registry
    // (iron-providers handles OpenAI via OpenAiProvider, not GenericProvider).
    let mut registry = iron_providers::ProviderRegistry::default();
    registry.register(
        iron_providers::ProviderProfile::new(
            "openai",
            iron_providers::ApiFamily::OpenAiChatCompletions,
            "https://api.openai.com/v1",
        )
    );

    let mut models = Vec::new();

    for (provider_key, provider) in &data {
        // Look up by models.dev ID using the registry's metadata
        let our_provider = match registry.resolve_by_models_dev_id(provider_key) {
            Some(profile) => profile.slug.clone(),
            None => continue, // Skip providers we don't support
        };

        if let Some(provider_models) = &provider.models {
            for (model_key, model) in provider_models {
                // Skip deprecated models
                if model.status.as_deref() == Some("deprecated") {
                    continue;
                }

                let model_id = model.id.as_deref().unwrap_or(model_key);
                let model_name = model.name.as_deref().unwrap_or(model_id);

                let has_vision = model
                    .modalities
                    .as_ref()
                    .and_then(|m| m.input.as_ref())
                    .map(|inputs| inputs.iter().any(|i| i == "image"))
                    .unwrap_or(false);

                models.push(RegistryModel {
                    id: model_id.to_string(),
                    name: model_name.to_string(),
                    provider_id: our_provider.clone(),
                    context_window: model.limit.as_ref().and_then(|l| l.context),
                    output_limit: model.limit.as_ref().and_then(|l| l.output),
                    tool_call: model.tool_call.unwrap_or(false),
                    reasoning: model.reasoning.unwrap_or(false),
                    vision: has_vision || model.attachment.unwrap_or(false),
                    cost_input: model.cost.as_ref().and_then(|c| c.input),
                    cost_output: model.cost.as_ref().and_then(|c| c.output),
                });
            }
        }
    }

    // Sort by provider then name
    models.sort_by(|a, b| a.provider_id.cmp(&b.provider_id).then(a.name.cmp(&b.name)));

    Ok(models)
}
