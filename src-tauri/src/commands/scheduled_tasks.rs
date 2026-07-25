//! Tauri commands for the scheduled task manager.
//!
//! Mirrors `config_management`, with one difference: the service is built with
//! a host scheduler attached, since inspect/reconcile/delete need to reach the
//! platform scheduler. Where no adapter or runner exists, the service is built
//! without one and those calls report `SchedulerUnavailable`, which the UI
//! surfaces as an unavailable state rather than an error.

use iron_core::management::{ManagedScheduledTaskRecord, ScheduleDeletionOutcome};
use iron_core::scheduled_task::manager::OrphanPolicy;
use iron_core::scheduled_task::{
    validate_schedule_input, DesiredState, ExecutionState, HostState, ReferenceState,
    ScheduleDiagnostic, ScheduleDiagnosticKind, ScheduleHealth, ScheduleStatus, ScheduledTask,
    ScheduledTaskInput,
};
use iron_core::ConfigManagementService;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::commands::config_management::{
    management_error_to_string, shared_config, shared_config_for_mutation, MutationErrorDto,
};
use crate::core_config::CoreConfig;
use crate::scheduler;

// ============================================================================
// Serializable DTOs
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskDto {
    pub id: String,
    pub automation_task_id: String,
    pub cron_expression: String,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

impl From<&ScheduledTask> for ScheduledTaskDto {
    fn from(t: &ScheduledTask) -> Self {
        Self {
            id: t.id.clone(),
            automation_task_id: t.automation_task_id.clone(),
            cron_expression: t.cron_expression.clone(),
            enabled: t.enabled,
            created_at: t.created_at.to_rfc3339(),
            updated_at: t.updated_at.to_rfc3339(),
        }
    }
}

/// A schedule row for the list view.
///
/// `NeedsAttention` records may not decode, so `task` is optional and
/// `diagnostics` explains why.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskRecordDto {
    pub id: String,
    pub ready: bool,
    pub task: Option<ScheduledTaskDto>,
    pub diagnostics: Vec<String>,
}

impl From<ManagedScheduledTaskRecord> for ScheduledTaskRecordDto {
    fn from(r: ManagedScheduledTaskRecord) -> Self {
        match r {
            ManagedScheduledTaskRecord::Ready(t) => Self {
                id: t.id.clone(),
                ready: true,
                task: Some((&t).into()),
                diagnostics: Vec::new(),
            },
            ManagedScheduledTaskRecord::NeedsAttention {
                id,
                decoded,
                diagnostics,
            } => Self {
                id,
                ready: false,
                task: decoded.as_ref().map(Into::into),
                diagnostics: diagnostics.iter().map(|d| d.message.clone()).collect(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDiagnosticDto {
    pub kind: String,
    pub message: String,
}

impl From<&ScheduleDiagnostic> for ScheduleDiagnosticDto {
    fn from(d: &ScheduleDiagnostic) -> Self {
        Self {
            kind: diagnostic_kind_str(d.kind).to_string(),
            message: d.message.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostRunMetadataDto {
    pub last_run: Option<String>,
    pub next_run: Option<String>,
    pub last_result: Option<String>,
}

/// The full composite status for one schedule.
///
/// Every state is passed through rather than collapsed into a single colour:
/// `health` alone cannot distinguish "not installed" from "drifted" (both are
/// `Degraded`), so the UI derives its indicator from `desiredState` +
/// `hostState` + diagnostics.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleStatusDto {
    pub schedule_id: String,
    pub health: String,
    pub desired_state: String,
    pub reference_state: String,
    pub execution_state: String,
    pub host_state: String,
    pub diagnostics: Vec<ScheduleDiagnosticDto>,
    pub host_metadata: Option<HostRunMetadataDto>,
}

impl From<&ScheduleStatus> for ScheduleStatusDto {
    fn from(s: &ScheduleStatus) -> Self {
        Self {
            schedule_id: s.schedule_id.clone(),
            health: match s.health {
                ScheduleHealth::Healthy => "healthy",
                ScheduleHealth::Degraded => "degraded",
                ScheduleHealth::Unavailable => "unavailable",
            }
            .to_string(),
            desired_state: match s.desired_state {
                DesiredState::Present => "present",
                DesiredState::Missing => "missing",
                DesiredState::Unsupported => "unsupported",
            }
            .to_string(),
            reference_state: match s.reference_state {
                ReferenceState::Valid => "valid",
                ReferenceState::Missing => "missing",
                ReferenceState::Invalid => "invalid",
            }
            .to_string(),
            execution_state: match s.execution_state {
                ExecutionState::Ready => "ready",
                ExecutionState::UnsafePolicy => "unsafe_policy",
                ExecutionState::Unknown => "unknown",
            }
            .to_string(),
            host_state: match s.host_state {
                HostState::Installed => "installed",
                HostState::Disabled => "disabled",
                HostState::Missing => "missing",
                HostState::Drifted => "drifted",
                HostState::Corrupt => "corrupt",
                HostState::Unknown => "unknown",
            }
            .to_string(),
            diagnostics: s.diagnostics.iter().map(Into::into).collect(),
            host_metadata: s.host_metadata.as_ref().map(|m| HostRunMetadataDto {
                last_run: m.last_run.map(|t| t.to_rfc3339()),
                next_run: m.next_run.map(|t| t.to_rfc3339()),
                last_result: m.last_result.clone(),
            }),
        }
    }
}

fn diagnostic_kind_str(kind: ScheduleDiagnosticKind) -> &'static str {
    match kind {
        ScheduleDiagnosticKind::InstallationFailed => "installation_failed",
        ScheduleDiagnosticKind::NotInstalled => "not_installed",
        ScheduleDiagnosticKind::ScheduleDrift => "schedule_drift",
        ScheduleDiagnosticKind::CorruptHostEntry => "corrupt_host_entry",
        ScheduleDiagnosticKind::OrphanedHostEntry => "orphaned_host_entry",
        ScheduleDiagnosticKind::MissingTask => "missing_task",
        ScheduleDiagnosticKind::InvalidTask => "invalid_task",
        ScheduleDiagnosticKind::UnsafePolicy => "unsafe_policy",
        ScheduleDiagnosticKind::UnsupportedSchedule => "unsupported_schedule",
        ScheduleDiagnosticKind::PlatformUnavailable => "platform_unavailable",
        ScheduleDiagnosticKind::RunnerPathDrift => "runner_path_drift",
        ScheduleDiagnosticKind::DesiredDeletionFailed => "desired_deletion_failed",
    }
}

/// The result of removing a schedule from both the host and the ConfigStore.
///
/// Host removal succeeding while the desired-state delete fails is a real
/// outcome rather than an error, so it is reported as a value and `drift`
/// carries the post-failure status. Modelled field by field instead of
/// forwarding the upstream type's `Debug` output, so the wire contract does not
/// shift when iron-core renames or reorders anything.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleDeletionOutcomeDto {
    pub schedule_id: String,
    pub host_removed: bool,
    pub desired_deleted: bool,
    pub drift: Option<ScheduleStatusDto>,
}

impl From<&ScheduleDeletionOutcome> for ScheduleDeletionOutcomeDto {
    fn from(o: &ScheduleDeletionOutcome) -> Self {
        Self {
            schedule_id: o.schedule_id.clone(),
            host_removed: o.host_removed,
            desired_deleted: o.desired_deleted,
            drift: o.drift.as_ref().map(Into::into),
        }
    }
}

/// Why the host scheduler is unusable, when it is.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulerAvailabilityDto {
    pub available: bool,
    pub platform: Option<String>,
    pub reason: Option<String>,
}

// ============================================================================
// Service construction
// ============================================================================

/// Build the service with a host scheduler attached when one is usable.
///
/// A missing adapter or runner is not fatal: the schedule list still reads from
/// the ConfigStore, and only host-touching calls report `SchedulerUnavailable`.
fn service(config: &CoreConfig) -> ConfigManagementService {
    let svc = ConfigManagementService::new((*config.store).clone());

    match (scheduler::host_scheduler(), scheduler::install_context()) {
        (Some(host), Ok(context)) => svc.with_scheduler(host, context),
        _ => svc,
    }
}

// ============================================================================
// Commands
// ============================================================================

#[tauri::command]
pub async fn scheduler_availability(app: AppHandle) -> Result<SchedulerAvailabilityDto, String> {
    let _config = shared_config(&app)?;

    let host = scheduler::host_scheduler();
    let platform = host.as_ref().map(|h| h.platform().to_string());

    let reason = match (&host, scheduler::install_context()) {
        (None, _) => Some("No host scheduler is available for this platform.".to_string()),
        (Some(_), Err(e)) => Some(e),
        (Some(_), Ok(_)) => None,
    };

    Ok(SchedulerAvailabilityDto {
        available: reason.is_none(),
        platform,
        reason,
    })
}

#[tauri::command]
pub async fn list_scheduled_tasks(app: AppHandle) -> Result<Vec<ScheduledTaskRecordDto>, String> {
    let config = shared_config(&app)?;
    service(&config)
        .list_scheduled_tasks()
        .await
        .map_err(management_error_to_string)
        .map(|records| records.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn get_scheduled_task(
    app: AppHandle,
    id: String,
) -> Result<Option<ScheduledTaskRecordDto>, String> {
    let config = shared_config(&app)?;
    service(&config)
        .get_scheduled_task(&id)
        .await
        .map_err(management_error_to_string)
        .map(|opt| opt.map(Into::into))
}

#[tauri::command]
pub async fn save_scheduled_task(
    app: AppHandle,
    id: String,
    automation_task_id: String,
    cron_expression: String,
    enabled: bool,
) -> Result<ScheduledTaskDto, MutationErrorDto> {
    let config = shared_config_for_mutation(&app)?;

    let input = ScheduledTaskInput {
        id,
        automation_task_id,
        cron_expression,
        enabled,
    };

    service(&config)
        .save_scheduled_task(&input)
        .await
        .map(|t| (&t).into())
        .map_err(MutationErrorDto::from)
}

/// Validate a schedule without persisting it, for live feedback in the editor.
///
/// Returns the normalized input on success, or a human-readable message.
#[tauri::command]
pub async fn validate_scheduled_task(
    id: String,
    automation_task_id: String,
    cron_expression: String,
    enabled: bool,
) -> Result<ScheduledTaskInputDto, String> {
    let input = ScheduledTaskInput {
        id,
        automation_task_id,
        cron_expression,
        enabled,
    };

    validate_schedule_input(&input).map(|normalized| ScheduledTaskInputDto {
        id: normalized.id,
        automation_task_id: normalized.automation_task_id,
        cron_expression: normalized.cron_expression,
        enabled: normalized.enabled,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskInputDto {
    pub id: String,
    pub automation_task_id: String,
    pub cron_expression: String,
    pub enabled: bool,
}

#[tauri::command]
pub async fn inspect_schedule(app: AppHandle, id: String) -> Result<ScheduleStatusDto, String> {
    let config = shared_config(&app)?;
    service(&config)
        .inspect_schedule(&id)
        .await
        .map_err(management_error_to_string)
        .map(|s| (&s).into())
}

#[tauri::command]
pub async fn inspect_all_schedules(app: AppHandle) -> Result<Vec<ScheduleStatusDto>, String> {
    let config = shared_config(&app)?;
    service(&config)
        .inspect_all_schedules()
        .await
        .map_err(management_error_to_string)
        .map(|list| list.iter().map(Into::into).collect())
}

/// Install or repair the host entry for one schedule.
#[tauri::command]
pub async fn reconcile_schedule(
    app: AppHandle,
    id: String,
) -> Result<ScheduleStatusDto, MutationErrorDto> {
    let config = shared_config_for_mutation(&app)?;
    service(&config)
        .reconcile_schedule(&id)
        .await
        .map(|s| (&s).into())
        .map_err(MutationErrorDto::from)
}

/// Reconcile every schedule, leaving orphaned host entries in place so they
/// surface in the list rather than disappearing without the user's say-so.
#[tauri::command]
pub async fn reconcile_all_schedules(
    app: AppHandle,
) -> Result<Vec<ScheduleStatusDto>, MutationErrorDto> {
    let config = shared_config_for_mutation(&app)?;
    service(&config)
        .reconcile_all_schedules(OrphanPolicy::ReportOnly)
        .await
        .map(|list| list.iter().map(Into::into).collect())
        .map_err(MutationErrorDto::from)
}

/// Remove both the host entry and the desired state.
#[tauri::command]
pub async fn delete_scheduled_task(
    app: AppHandle,
    id: String,
) -> Result<ScheduleDeletionOutcomeDto, MutationErrorDto> {
    let config = shared_config_for_mutation(&app)?;
    service(&config)
        .delete_schedule_combined(&id)
        .await
        .map(|outcome| (&outcome).into())
        .map_err(MutationErrorDto::from)
}

/// Remove desired state only, leaving any host entry behind as an orphan.
#[tauri::command]
pub async fn delete_scheduled_task_desired_only(
    app: AppHandle,
    id: String,
) -> Result<(), MutationErrorDto> {
    let config = shared_config_for_mutation(&app)?;
    service(&config)
        .delete_scheduled_task(&id)
        .await
        .map_err(MutationErrorDto::from)
}

/// Automation tasks a schedule can reference, for the editor's picker.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationTaskOptionDto {
    pub id: String,
    pub display_name: String,
    pub ready: bool,
}

#[tauri::command]
pub async fn list_automation_task_options(
    app: AppHandle,
) -> Result<Vec<AutomationTaskOptionDto>, String> {
    use iron_core::management::ManagedRecord;

    let config = shared_config(&app)?;
    let records = service(&config)
        .list_automation_tasks()
        .await
        .map_err(management_error_to_string)?;

    Ok(records
        .into_iter()
        .map(|r| match r {
            ManagedRecord::Ready(t) => AutomationTaskOptionDto {
                id: t.id.clone(),
                display_name: t.display_name.clone(),
                ready: true,
            },
            ManagedRecord::NeedsAttention { id, decoded, .. } => AutomationTaskOptionDto {
                display_name: decoded
                    .as_ref()
                    .map(|t| t.display_name.clone())
                    .unwrap_or_else(|| id.clone()),
                id,
                ready: false,
            },
        })
        .collect())
}
