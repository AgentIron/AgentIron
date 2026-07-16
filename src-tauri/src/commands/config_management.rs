#![allow(non_snake_case)]
use iron_core::management::{
    ConfigManagementService, CredentialSummary, DependencyDirection, DependencyEntity,
    DependencyImpactReport, DependencyLink, DependencyProximity, DiagnosticCategory,
    ManagedProfileEntry, ManagedProfileRecord, ManagedPromptEntry, ManagedPromptRecord,
    ManagedRecord, ManagementError, RecordDiagnostic,
};
use iron_core::profile::{
    AgentApproval, AgentProfile, AgentProfileId, AgentProfileProvider, DefaultProfileSeedPolicy,
    ProfileDeletePolicy, SkillFilter, ToolFilter,
};
use iron_core::stored_prompt::{IdentityState, StoredPrompt};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::core_config::CoreConfig;

/// Managed state holding a shared-config initialization error.
/// When `Some`, the frontend shows a blocking error and shared-config
/// commands are unavailable.
pub type SharedConfigError = std::sync::Mutex<Option<String>>;

// ============================================================================
// Serializable DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum ProfileProviderDto {
    RuntimeDefault,
    Managed { providerSlug: String, model: String },
}

impl From<&AgentProfileProvider> for ProfileProviderDto {
    fn from(p: &AgentProfileProvider) -> Self {
        match p {
            AgentProfileProvider::RuntimeDefault => ProfileProviderDto::RuntimeDefault,
            AgentProfileProvider::Managed {
                provider_slug,
                model,
            } => ProfileProviderDto::Managed {
                providerSlug: provider_slug.as_str().to_string(),
                model: model.clone(),
            },
        }
    }
}

impl TryFrom<ProfileProviderDto> for AgentProfileProvider {
    type Error = String;

    fn try_from(dto: ProfileProviderDto) -> Result<Self, Self::Error> {
        match dto {
            ProfileProviderDto::RuntimeDefault => Ok(AgentProfileProvider::RuntimeDefault),
            ProfileProviderDto::Managed {
                providerSlug,
                model,
            } => {
                let slug = providerSlug.trim();
                let model = model.trim();
                if slug.is_empty() {
                    return Err("provider_slug must not be empty".to_string());
                }
                if model.is_empty() {
                    return Err("model must not be empty".to_string());
                }
                Ok(AgentProfileProvider::Managed {
                    provider_slug: iron_core::provider_credential::domain::ProviderSlug::new(slug),
                    model: model.to_string(),
                })
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentProfileDto {
    pub name: String,
    #[serde(flatten)]
    pub provider: ProfileProviderDto,
    pub tools: ToolFilterDto,
    pub skills: SkillFilterDto,
    pub approval: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identity_prompt: Option<String>,
}

impl From<&AgentProfile> for AgentProfileDto {
    fn from(p: &AgentProfile) -> Self {
        Self {
            name: p.name.clone(),
            provider: ProfileProviderDto::from(&p.provider),
            tools: ToolFilterDto::from(&p.tools),
            skills: SkillFilterDto::from(&p.skills),
            approval: match p.approval {
                AgentApproval::PerTool => "perTool".to_string(),
                AgentApproval::AutoApprove => "autoApprove".to_string(),
            },
            identity_prompt: p.identity_prompt.clone(),
        }
    }
}

impl TryFrom<AgentProfileDto> for AgentProfile {
    type Error = String;

    fn try_from(dto: AgentProfileDto) -> Result<Self, Self::Error> {
        let approval = match dto.approval.as_str() {
            "perTool" => AgentApproval::PerTool,
            "autoApprove" => AgentApproval::AutoApprove,
            other => {
                return Err(format!("Unsupported approval policy: {other}"));
            }
        };
        Ok(Self {
            name: dto.name,
            provider: dto.provider.try_into()?,
            tools: dto.tools.into(),
            skills: dto.skills.into(),
            approval,
            identity_prompt: dto.identity_prompt,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum ToolFilterDto {
    Inherit,
    Allow { names: Vec<String> },
    Deny { names: Vec<String> },
}

impl From<&ToolFilter> for ToolFilterDto {
    fn from(f: &ToolFilter) -> Self {
        match f {
            ToolFilter::Inherit => ToolFilterDto::Inherit,
            ToolFilter::Allow(names) => ToolFilterDto::Allow {
                names: names.clone(),
            },
            ToolFilter::Deny(names) => ToolFilterDto::Deny {
                names: names.clone(),
            },
        }
    }
}

impl From<ToolFilterDto> for ToolFilter {
    fn from(dto: ToolFilterDto) -> Self {
        match dto {
            ToolFilterDto::Inherit => ToolFilter::Inherit,
            ToolFilterDto::Allow { names } => ToolFilter::Allow(names),
            ToolFilterDto::Deny { names } => ToolFilter::Deny(names),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum SkillFilterDto {
    None,
    Allow { names: Vec<String> },
    Inherit,
}

impl From<&SkillFilter> for SkillFilterDto {
    fn from(f: &SkillFilter) -> Self {
        match f {
            SkillFilter::None => SkillFilterDto::None,
            SkillFilter::Allow(names) => SkillFilterDto::Allow {
                names: names.clone(),
            },
            SkillFilter::Inherit => SkillFilterDto::Inherit,
        }
    }
}

impl From<SkillFilterDto> for SkillFilter {
    fn from(dto: SkillFilterDto) -> Self {
        match dto {
            SkillFilterDto::None => SkillFilter::None,
            SkillFilterDto::Allow { names } => SkillFilter::Allow(names),
            SkillFilterDto::Inherit => SkillFilter::Inherit,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedProfileEntryDto {
    pub id: String,
    pub profile: AgentProfileDto,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum ManagedProfileRecordDto {
    Ready {
        entry: ManagedProfileEntryDto,
    },
    NeedsAttention {
        id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        decoded: Option<AgentProfileDto>,
        diagnostics: Vec<RecordDiagnosticDto>,
    },
}

impl From<ManagedProfileRecord> for ManagedProfileRecordDto {
    fn from(record: ManagedProfileRecord) -> Self {
        match record {
            ManagedRecord::Ready(ManagedProfileEntry {
                id,
                profile,
                created_at,
                updated_at,
            }) => ManagedProfileRecordDto::Ready {
                entry: ManagedProfileEntryDto {
                    id: id.as_str().to_string(),
                    profile: AgentProfileDto::from(&profile),
                    created_at: created_at.to_rfc3339(),
                    updated_at: updated_at.to_rfc3339(),
                },
            },
            ManagedRecord::NeedsAttention {
                id,
                decoded,
                diagnostics,
            } => ManagedProfileRecordDto::NeedsAttention {
                id,
                decoded: decoded.as_ref().map(|e| AgentProfileDto::from(&e.profile)),
                diagnostics: diagnostics.into_iter().map(Into::into).collect(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredPromptDto {
    pub display_name: String,
    pub normalized_name: String,
    pub instructions: String,
    pub skills: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<String>,
}

impl From<&StoredPrompt> for StoredPromptDto {
    fn from(p: &StoredPrompt) -> Self {
        Self {
            display_name: p.display_name.clone(),
            normalized_name: p.normalized_name.clone(),
            instructions: p.instructions.clone(),
            skills: p.skills.clone(),
            profile: p.profile.as_ref().map(|id| id.as_str().to_string()),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedPromptEntryDto {
    pub id: String,
    pub prompt: StoredPromptDto,
    pub identity_state: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum ManagedPromptRecordDto {
    Ready {
        entry: ManagedPromptEntryDto,
    },
    NeedsAttention {
        id: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        decoded: Option<StoredPromptDto>,
        diagnostics: Vec<RecordDiagnosticDto>,
    },
}

impl From<ManagedPromptRecord> for ManagedPromptRecordDto {
    fn from(record: ManagedPromptRecord) -> Self {
        match record {
            ManagedRecord::Ready((
                id,
                ManagedPromptEntry {
                    prompt,
                    identity_state,
                    created_at,
                    updated_at,
                },
            )) => ManagedPromptRecordDto::Ready {
                entry: ManagedPromptEntryDto {
                    id,
                    prompt: StoredPromptDto::from(&prompt),
                    identity_state: match identity_state {
                        IdentityState::Ready => "ready".to_string(),
                        IdentityState::NeedsRename => "needsRename".to_string(),
                    },
                    created_at: created_at.to_rfc3339(),
                    updated_at: updated_at.to_rfc3339(),
                },
            },
            ManagedRecord::NeedsAttention {
                id,
                decoded,
                diagnostics,
            } => ManagedPromptRecordDto::NeedsAttention {
                id,
                decoded: decoded
                    .as_ref()
                    .map(|(_, e)| StoredPromptDto::from(&e.prompt)),
                diagnostics: diagnostics.into_iter().map(Into::into).collect(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordDiagnosticDto {
    pub category: String,
    pub message: String,
}

impl From<RecordDiagnostic> for RecordDiagnosticDto {
    fn from(d: RecordDiagnostic) -> Self {
        Self {
            category: match d.category {
                DiagnosticCategory::UnsupportedSchemaVersion => "unsupportedSchemaVersion",
                DiagnosticCategory::InvalidPayload => "invalidPayload",
                DiagnosticCategory::MissingRecord => "missingRecord",
                DiagnosticCategory::UnavailableProfile => "unavailableProfile",
                DiagnosticCategory::UnavailableSkill => "unavailableSkill",
                DiagnosticCategory::NeedsRename => "needsRename",
                DiagnosticCategory::ReadOnlyRejected => "readOnlyRejected",
                DiagnosticCategory::UnknownIdentityState => "unknownIdentityState",
            }
            .to_string(),
            message: d.message,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialSummaryDto {
    pub provider_slug: String,
    pub credential_mode: String,
    pub auth_status: String,
    pub expires_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl From<CredentialSummary> for CredentialSummaryDto {
    fn from(c: CredentialSummary) -> Self {
        let (auth_status, expires_at) = match &c.auth_status {
            iron_core::provider_credential::domain::ProviderAuthStatus::ConfiguredApiKey => {
                ("configuredApiKey".to_string(), None)
            }
            iron_core::provider_credential::domain::ProviderAuthStatus::ConnectedOAuth {
                expires_at,
            } => {
                let ts = expires_at.map(|t| chrono::DateTime::<chrono::Utc>::from(t).to_rfc3339());
                ("connectedOAuth".to_string(), ts)
            }
            iron_core::provider_credential::domain::ProviderAuthStatus::Refreshing => {
                ("refreshing".to_string(), None)
            }
            iron_core::provider_credential::domain::ProviderAuthStatus::Expired => {
                ("expired".to_string(), None)
            }
            iron_core::provider_credential::domain::ProviderAuthStatus::RefreshFailed {
                reason,
            } => (format!("refreshFailed:{}", reason), None),
            iron_core::provider_credential::domain::ProviderAuthStatus::Revoked => {
                ("revoked".to_string(), None)
            }
            iron_core::provider_credential::domain::ProviderAuthStatus::NotConfigured => {
                ("notConfigured".to_string(), None)
            }
            iron_core::provider_credential::domain::ProviderAuthStatus::UnsupportedCredential => {
                ("unsupported".to_string(), None)
            }
        };
        Self {
            provider_slug: c.provider_slug,
            credential_mode: format!("{:?}", c.credential_mode).to_lowercase(),
            auth_status,
            expires_at,
            created_at: c.created_at.to_rfc3339(),
            updated_at: c.updated_at.to_rfc3339(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum DependencyEntityDto {
    ProviderCredential { slug: String },
    Profile { id: String },
    Prompt { id: String },
    AutomationTask { id: String },
    ScheduledTask { id: String },
}

impl From<DependencyEntity> for DependencyEntityDto {
    fn from(entity: DependencyEntity) -> Self {
        match entity {
            DependencyEntity::ProviderCredential { slug } => Self::ProviderCredential { slug },
            DependencyEntity::Profile { id } => Self::Profile { id },
            DependencyEntity::Prompt { id } => Self::Prompt { id },
            DependencyEntity::AutomationTask { id } => Self::AutomationTask { id },
            DependencyEntity::ScheduledTask { id } => Self::ScheduledTask { id },
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyLinkDto {
    pub entity: DependencyEntityDto,
    pub direction: String,
    pub proximity: String,
    pub path: Vec<DependencyEntityDto>,
}

impl From<DependencyLink> for DependencyLinkDto {
    fn from(link: DependencyLink) -> Self {
        Self {
            entity: link.entity.into(),
            direction: match link.direction {
                DependencyDirection::Depends => "depends",
                DependencyDirection::Dependent => "dependent",
            }
            .to_string(),
            proximity: match link.proximity {
                DependencyProximity::Direct => "direct",
                DependencyProximity::Transitive => "transitive",
            }
            .to_string(),
            path: link.path.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyImpactReportDto {
    pub target: DependencyEntityDto,
    pub links: Vec<DependencyLinkDto>,
    pub diagnostics: Vec<String>,
}

impl From<DependencyImpactReport> for DependencyImpactReportDto {
    fn from(report: DependencyImpactReport) -> Self {
        Self {
            target: report.target.into(),
            links: report.links.into_iter().map(Into::into).collect(),
            diagnostics: report.diagnostics,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SeedReportDto {
    pub policy: String,
    pub marker_was_present: bool,
    pub marker_written: bool,
    pub created: Vec<String>,
    pub skipped_existing: Vec<String>,
    pub diagnostics: Vec<String>,
}

// ============================================================================
// Error conversion
// ============================================================================

/// Typed mutation error that the frontend can map to specific form fields.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MutationErrorDto {
    pub kind: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub referrers: Vec<String>,
}

impl From<ManagementError> for MutationErrorDto {
    fn from(e: ManagementError) -> Self {
        match e {
            ManagementError::Validation(msg) => {
                let field = infer_error_field(&msg);
                MutationErrorDto {
                    kind: "validation".to_string(),
                    message: msg,
                    field,
                    referrers: Vec::new(),
                }
            }
            ManagementError::Reference(msg) => {
                let field = infer_error_field(&msg);
                MutationErrorDto {
                    kind: "reference".to_string(),
                    message: msg,
                    field,
                    referrers: Vec::new(),
                }
            }
            ManagementError::Conflict { target, referrers } => MutationErrorDto {
                kind: "conflict".to_string(),
                message: format!("'{target}' is referenced by: {}", referrers.join(", ")),
                field: None,
                referrers,
            },
            ManagementError::Storage(inner) => MutationErrorDto {
                kind: "storage".to_string(),
                message: format!("Storage error: {inner}"),
                field: None,
                referrers: Vec::new(),
            },
            ManagementError::IntegrityUnknown { details } => MutationErrorDto {
                kind: "integrityUnknown".to_string(),
                message: format!("Cannot verify referential integrity: {details}"),
                field: None,
                referrers: Vec::new(),
            },
            ManagementError::MinimumValidProfiles { minimum, remaining } => MutationErrorDto {
                kind: "minimumValidProfiles".to_string(),
                message: format!(
                    "Cannot delete this profile: at least {minimum} valid profile must remain ({remaining} would remain)."
                ),
                field: None,
                referrers: Vec::new(),
            },
            ManagementError::SchedulerUnavailable => MutationErrorDto {
                kind: "schedulerUnavailable".to_string(),
                message: "Scheduler is not attached".to_string(),
                field: None,
                referrers: Vec::new(),
            },
            ManagementError::Scheduler(msg) => MutationErrorDto {
                kind: "scheduler".to_string(),
                message: msg,
                field: None,
                referrers: Vec::new(),
            },
            ManagementError::Partial {
                target,
                durable_succeeded,
                error,
            } => MutationErrorDto {
                kind: "partial".to_string(),
                message: format!(
                    "Partial operation for '{target}': durable_succeeded={durable_succeeded}, error={error}"
                ),
                field: None,
                referrers: Vec::new(),
            },
        }
    }
}

/// Infer which form field a validation/reference error relates to.
fn infer_error_field(msg: &str) -> Option<String> {
    let lower = msg.to_lowercase();
    if lower.contains("normalized")
        || lower.contains("handle")
        || lower.contains("collision")
        || lower.contains("display name")
        || lower.contains("name ")
        || lower.contains("name.")
    {
        Some("displayName".to_string())
    } else if lower.contains("provider") {
        Some("providerSlug".to_string())
    } else if lower.contains("model") {
        Some("model".to_string())
    } else {
        None
    }
}

fn management_error_to_string(e: ManagementError) -> String {
    match e {
        ManagementError::Storage(inner) => format!("Storage error: {inner}"),
        ManagementError::Validation(msg) => msg,
        ManagementError::Reference(msg) => msg,
        ManagementError::Conflict { target, referrers } => {
            format!("'{target}' is referenced by: {}", referrers.join(", "))
        }
        ManagementError::IntegrityUnknown { details } => {
            format!("Cannot verify referential integrity: {details}")
        }
        ManagementError::MinimumValidProfiles { minimum, remaining } => format!(
            "Cannot delete this profile: at least {minimum} valid profile must remain ({remaining} would remain)."
        ),
        ManagementError::SchedulerUnavailable => "Scheduler is not attached".to_string(),
        ManagementError::Scheduler(msg) => msg,
        ManagementError::Partial {
            target,
            durable_succeeded,
            error,
        } => {
            format!("Partial operation for '{target}': durable_succeeded={durable_succeeded}, error={error}")
        }
    }
}

fn service(config: &CoreConfig) -> ConfigManagementService {
    ConfigManagementService::new((*config.store).clone())
}

// ============================================================================
// Profile commands
// ============================================================================

#[tauri::command]
pub async fn list_profiles(
    config: State<'_, CoreConfig>,
) -> Result<Vec<ManagedProfileRecordDto>, String> {
    let svc = service(&config);
    svc.list_profiles()
        .await
        .map_err(management_error_to_string)
        .map(|records| records.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn get_profile(
    config: State<'_, CoreConfig>,
    id: String,
) -> Result<Option<ManagedProfileRecordDto>, String> {
    let svc = service(&config);
    svc.get_profile(&id)
        .await
        .map_err(management_error_to_string)
        .map(|opt| opt.map(Into::into))
}

#[tauri::command]
pub async fn save_profile(
    config: State<'_, CoreConfig>,
    id: String,
    profile: AgentProfileDto,
) -> Result<(), MutationErrorDto> {
    let svc = service(&config);
    let typed: AgentProfile = profile.try_into().map_err(|e: String| MutationErrorDto {
        kind: "validation".to_string(),
        message: e,
        field: None,
        referrers: Vec::new(),
    })?;
    svc.save_profile(&id, &typed)
        .await
        .map_err(MutationErrorDto::from)
}

#[tauri::command]
pub async fn delete_profile(
    config: State<'_, CoreConfig>,
    id: String,
) -> Result<(), MutationErrorDto> {
    let svc = service(&config);

    svc.delete_profile_with_policy(&id, ProfileDeletePolicy::RequireMinimumValid(1))
        .await
        .map_err(MutationErrorDto::from)
}

#[tauri::command]
pub async fn profile_impact(
    config: State<'_, CoreConfig>,
    profileId: String,
) -> Result<DependencyImpactReportDto, String> {
    let svc = service(&config);
    svc.profile_impact(&profileId)
        .await
        .map_err(management_error_to_string)
        .map(Into::into)
}

// ============================================================================
// Prompt commands
// ============================================================================

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePromptInput {
    pub display_name: String,
    pub instructions: String,
    #[serde(default)]
    pub skills: Vec<String>,
    pub profile: Option<String>,
}

#[tauri::command]
pub async fn list_prompts(
    config: State<'_, CoreConfig>,
) -> Result<Vec<ManagedPromptRecordDto>, String> {
    let svc = service(&config);
    svc.list_prompts()
        .await
        .map_err(management_error_to_string)
        .map(|records| records.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn get_prompt(
    config: State<'_, CoreConfig>,
    id: String,
) -> Result<Option<ManagedPromptRecordDto>, String> {
    let svc = service(&config);
    svc.get_prompt(&id)
        .await
        .map_err(management_error_to_string)
        .map(|opt| opt.map(Into::into))
}

#[tauri::command]
pub async fn create_prompt(
    config: State<'_, CoreConfig>,
    input: CreatePromptInput,
) -> Result<(String, StoredPromptDto), MutationErrorDto> {
    let svc = service(&config);
    let profile_id = input.profile.map(AgentProfileId::from);
    svc.create_prompt(
        &input.display_name,
        &input.instructions,
        input.skills,
        profile_id,
    )
    .await
    .map_err(MutationErrorDto::from)
    .map(|(id, prompt)| (id, StoredPromptDto::from(&prompt)))
}

#[tauri::command]
pub async fn save_prompt(
    config: State<'_, CoreConfig>,
    id: String,
    prompt: StoredPromptDto,
) -> Result<(), MutationErrorDto> {
    let svc = service(&config);
    let typed = StoredPrompt {
        display_name: prompt.display_name,
        normalized_name: prompt.normalized_name,
        instructions: prompt.instructions,
        skills: prompt.skills,
        profile: prompt.profile.map(AgentProfileId::from),
    };
    svc.save_prompt(&id, &typed)
        .await
        .map_err(MutationErrorDto::from)
}

#[tauri::command]
pub async fn rename_prompt(
    config: State<'_, CoreConfig>,
    id: String,
    newDisplayName: String,
) -> Result<(), MutationErrorDto> {
    let svc = service(&config);
    svc.rename_prompt(&id, &newDisplayName)
        .await
        .map_err(MutationErrorDto::from)
}

#[tauri::command]
pub async fn delete_prompt(
    config: State<'_, CoreConfig>,
    id: String,
) -> Result<(), MutationErrorDto> {
    let svc = service(&config);
    svc.delete_prompt(&id).await.map_err(MutationErrorDto::from)
}

#[tauri::command]
pub async fn prompt_impact(
    config: State<'_, CoreConfig>,
    promptId: String,
) -> Result<DependencyImpactReportDto, String> {
    let svc = service(&config);
    svc.prompt_impact(&promptId)
        .await
        .map_err(management_error_to_string)
        .map(Into::into)
}

// ============================================================================
// Credential commands
// ============================================================================

#[tauri::command]
pub async fn list_credentials(
    config: State<'_, CoreConfig>,
) -> Result<Vec<CredentialSummaryDto>, String> {
    let svc = service(&config);
    svc.list_credentials()
        .await
        .map_err(management_error_to_string)
        .map(|creds| creds.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn set_api_key(
    config: State<'_, CoreConfig>,
    providerSlug: String,
    apiKey: String,
) -> Result<CredentialSummaryDto, MutationErrorDto> {
    let svc = service(&config);
    svc.set_api_key(&providerSlug, &apiKey)
        .await
        .map_err(MutationErrorDto::from)
        .map(Into::into)
}

#[tauri::command]
pub async fn delete_credential(
    config: State<'_, CoreConfig>,
    providerSlug: String,
) -> Result<(), MutationErrorDto> {
    let svc = service(&config);
    svc.delete_credential(&providerSlug)
        .await
        .map_err(MutationErrorDto::from)
}

// ============================================================================
// Shared-config initialization status
// ============================================================================

#[tauri::command]
pub async fn get_shared_config_error(
    error: State<'_, SharedConfigError>,
) -> Result<Option<String>, String> {
    Ok(error.lock().map_err(|e| e.to_string())?.clone())
}

// ============================================================================
// Seed / recovery commands
// ============================================================================

#[tauri::command]
pub async fn seed_default_profiles(config: State<'_, CoreConfig>) -> Result<SeedReportDto, String> {
    let report = iron_core::profile::seed_default_profiles(
        &config.store,
        DefaultProfileSeedPolicy::FirstRunOnly,
    )
    .await
    .map_err(|e| format!("Failed to seed default profiles: {e}"))?;

    Ok(SeedReportDto {
        policy: "firstRunOnly".to_string(),
        marker_was_present: report.marker_was_present,
        marker_written: report.marker_written,
        created: report
            .created
            .iter()
            .map(|id| id.as_str().to_string())
            .collect(),
        skipped_existing: report
            .skipped_existing
            .iter()
            .map(|id| id.as_str().to_string())
            .collect(),
        diagnostics: report
            .diagnostics
            .iter()
            .map(|d| format!("{:?}", d))
            .collect(),
    })
}

#[tauri::command]
pub async fn restore_default_profiles(
    config: State<'_, CoreConfig>,
) -> Result<SeedReportDto, String> {
    let report = iron_core::profile::seed_default_profiles(
        &config.store,
        DefaultProfileSeedPolicy::RestoreMissing,
    )
    .await
    .map_err(|e| format!("Failed to restore default profiles: {e}"))?;

    Ok(SeedReportDto {
        policy: "restoreMissing".to_string(),
        marker_was_present: report.marker_was_present,
        marker_written: report.marker_written,
        created: report
            .created
            .iter()
            .map(|id| id.as_str().to_string())
            .collect(),
        skipped_existing: report
            .skipped_existing
            .iter()
            .map(|id| id.as_str().to_string())
            .collect(),
        diagnostics: report
            .diagnostics
            .iter()
            .map(|d| format!("{:?}", d))
            .collect(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_dto_roundtrip_runtime_default() {
        let profile = AgentProfile::with_name("Test");
        let dto = AgentProfileDto::from(&profile);
        assert_eq!(dto.name, "Test");
        assert!(matches!(dto.provider, ProfileProviderDto::RuntimeDefault));
        assert_eq!(dto.approval, "perTool");
    }

    #[test]
    fn profile_dto_managed_provider() {
        let profile = AgentProfile {
            name: "Managed".to_string(),
            provider: AgentProfileProvider::Managed {
                provider_slug: iron_core::provider_credential::domain::ProviderSlug::new("openai"),
                model: "gpt-4o".to_string(),
            },
            tools: ToolFilter::Allow(vec!["search".to_string()]),
            skills: SkillFilter::Inherit,
            approval: AgentApproval::AutoApprove,
            identity_prompt: Some("You are helpful.".to_string()),
        };
        let dto = AgentProfileDto::from(&profile);
        match &dto.provider {
            ProfileProviderDto::Managed {
                providerSlug,
                model,
            } => {
                assert_eq!(providerSlug, "openai");
                assert_eq!(model, "gpt-4o");
            }
            _ => panic!("expected Managed provider"),
        }
        assert_eq!(dto.approval, "autoApprove");
    }

    #[test]
    fn tool_filter_dto_roundtrip() {
        let cases = vec![
            (ToolFilter::Inherit, ToolFilterDto::Inherit),
            (
                ToolFilter::Allow(vec!["a".into(), "b".into()]),
                ToolFilterDto::Allow {
                    names: vec!["a".into(), "b".into()],
                },
            ),
            (
                ToolFilter::Deny(vec!["c".into()]),
                ToolFilterDto::Deny {
                    names: vec!["c".into()],
                },
            ),
        ];
        for (original, dto) in cases {
            let converted: ToolFilter = dto.into();
            assert_eq!(converted, original);
        }
    }

    #[test]
    fn credential_summary_dto_never_exposes_secret() {
        let summary = CredentialSummary {
            provider_slug: "openai".to_string(),
            credential_mode: iron_core::provider_credential::domain::CredentialMode::ApiKey,
            auth_status:
                iron_core::provider_credential::domain::ProviderAuthStatus::ConfiguredApiKey,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };
        let dto = CredentialSummaryDto::from(summary);
        assert_eq!(dto.auth_status, "configuredApiKey");
        let json = serde_json::to_string(&dto).unwrap();
        assert!(!json.contains("sk-"));
    }

    #[test]
    fn dependency_impact_dto_preserves_typed_links_and_paths() {
        let target = DependencyEntity::Profile {
            id: "profile-1".to_string(),
        };
        let prompt = DependencyEntity::Prompt {
            id: "prompt-1".to_string(),
        };
        let task = DependencyEntity::AutomationTask {
            id: "task-1".to_string(),
        };
        let report = DependencyImpactReport {
            target: target.clone(),
            links: vec![
                DependencyLink {
                    entity: prompt.clone(),
                    direction: DependencyDirection::Dependent,
                    proximity: DependencyProximity::Direct,
                    path: vec![target.clone(), prompt.clone()],
                },
                DependencyLink {
                    entity: task.clone(),
                    direction: DependencyDirection::Dependent,
                    proximity: DependencyProximity::Transitive,
                    path: vec![target, prompt, task],
                },
            ],
            diagnostics: Vec::new(),
        };

        let json = serde_json::to_value(DependencyImpactReportDto::from(report)).unwrap();
        assert_eq!(json["target"]["kind"], "profile");
        assert_eq!(json["links"][0]["entity"]["kind"], "prompt");
        assert_eq!(json["links"][0]["direction"], "dependent");
        assert_eq!(json["links"][1]["entity"]["kind"], "automationTask");
        assert_eq!(json["links"][1]["proximity"], "transitive");
        assert_eq!(json["links"][1]["path"][1]["kind"], "prompt");
    }

    #[test]
    fn minimum_valid_profiles_error_maps_to_typed_mutation_error() {
        let dto = MutationErrorDto::from(ManagementError::MinimumValidProfiles {
            minimum: 1,
            remaining: 0,
        });

        assert_eq!(dto.kind, "minimumValidProfiles");
        assert!(dto.message.contains("at least 1 valid profile"));
    }

    #[tokio::test]
    async fn list_profiles_round_trip_with_seed() {
        let store = iron_core::config::ConfigStore::open_in_memory()
            .await
            .unwrap();
        iron_core::profile::seed_default_profiles(
            &store,
            iron_core::profile::DefaultProfileSeedPolicy::RestoreMissing,
        )
        .await
        .unwrap();
        let svc = ConfigManagementService::new(store);
        let records = svc.list_profiles().await.unwrap();
        assert_eq!(records.len(), 3);
        assert!(records.iter().all(|r| matches!(r, ManagedRecord::Ready(_))));
    }

    #[tokio::test]
    async fn core_service_allows_last_profile_deletion() {
        // The unrestricted core API remains backward compatible.
        let store = iron_core::config::ConfigStore::open_in_memory()
            .await
            .unwrap();
        iron_core::profile::seed_default_profiles(
            &store,
            iron_core::profile::DefaultProfileSeedPolicy::RestoreMissing,
        )
        .await
        .unwrap();
        let svc = ConfigManagementService::new(store);
        svc.delete_profile("explore").await.unwrap();
        svc.delete_profile("plan").await.unwrap();
        svc.delete_profile("apply").await.unwrap();
        assert!(svc.list_profiles().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn core_policy_rejects_deleting_last_valid_profile() {
        let store = iron_core::config::ConfigStore::open_in_memory()
            .await
            .unwrap();
        iron_core::profile::seed_default_profiles(
            &store,
            iron_core::profile::DefaultProfileSeedPolicy::RestoreMissing,
        )
        .await
        .unwrap();
        let svc = ConfigManagementService::new(store);
        svc.delete_profile("explore").await.unwrap();
        svc.delete_profile("plan").await.unwrap();

        let result = svc
            .delete_profile_with_policy("apply", ProfileDeletePolicy::RequireMinimumValid(1))
            .await;

        assert!(matches!(
            result,
            Err(ManagementError::MinimumValidProfiles {
                minimum: 1,
                remaining: 0
            })
        ));
        assert!(svc.get_profile("apply").await.unwrap().is_some());
    }

    #[tokio::test]
    async fn credential_set_and_delete_redacted() {
        let store = iron_core::config::ConfigStore::open_in_memory()
            .await
            .unwrap();
        let svc = ConfigManagementService::new(store);
        svc.set_api_key("openai", "sk-test-secret").await.unwrap();
        let creds = svc.list_credentials().await.unwrap();
        assert_eq!(creds.len(), 1);
        let dto = CredentialSummaryDto::from(creds[0].clone());
        let json = serde_json::to_string(&dto).unwrap();
        assert!(!json.contains("sk-test-secret"));
        svc.delete_credential("openai").await.unwrap();
        assert!(svc.list_credentials().await.unwrap().is_empty());
    }

    #[tokio::test]
    async fn create_and_delete_prompt() {
        let store = iron_core::config::ConfigStore::open_in_memory()
            .await
            .unwrap();
        let svc = ConfigManagementService::new(store);
        let (id, prompt) = svc
            .create_prompt("My Task", "Do the thing", vec![], None)
            .await
            .unwrap();
        assert_eq!(prompt.display_name, "My Task");
        assert!(!id.is_empty());
        svc.delete_prompt(&id).await.unwrap();
        assert!(svc.list_prompts().await.unwrap().is_empty());
    }
}
