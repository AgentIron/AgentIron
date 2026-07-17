#![allow(non_snake_case)]
//! Tauri commands for the scheduled task manager.
//!
//! Mirrors `config_management`, with one difference: the service is built with
//! a host scheduler attached, since inspect/reconcile/delete need to reach the
//! platform scheduler. Where no adapter or runner exists, the service is built
//! without one and those calls report `SchedulerUnavailable`, which the UI
//! surfaces as an unavailable state rather than an error.

use iron_core::management::ManagedScheduledTaskRecord;
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
    pub automationTaskId: String,
    pub cronExpression: String,
    pub enabled: bool,
    pub createdAt: String,
    pub updatedAt: String,
}

impl From<&ScheduledTask> for ScheduledTaskDto {
    fn from(t: &ScheduledTask) -> Self {
        Self {
            id: t.id.clone(),
            automationTaskId: t.automation_task_id.clone(),
            cronExpression: t.cron_expression.clone(),
            enabled: t.enabled,
            createdAt: t.created_at.to_rfc3339(),
            updatedAt: t.updated_at.to_rfc3339(),
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
    pub lastRun: Option<String>,
    pub nextRun: Option<String>,
    pub lastResult: Option<String>,
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
    pub scheduleId: String,
    pub health: String,
    pub desiredState: String,
    pub referenceState: String,
    pub executionState: String,
    pub hostState: String,
    pub diagnostics: Vec<ScheduleDiagnosticDto>,
    pub hostMetadata: Option<HostRunMetadataDto>,
}

impl From<&ScheduleStatus> for ScheduleStatusDto {
    fn from(s: &ScheduleStatus) -> Self {
        Self {
            scheduleId: s.schedule_id.clone(),
            health: match s.health {
                ScheduleHealth::Healthy => "healthy",
                ScheduleHealth::Degraded => "degraded",
                ScheduleHealth::Unavailable => "unavailable",
            }
            .to_string(),
            desiredState: match s.desired_state {
                DesiredState::Present => "present",
                DesiredState::Missing => "missing",
                DesiredState::Unsupported => "unsupported",
            }
            .to_string(),
            referenceState: match s.reference_state {
                ReferenceState::Valid => "valid",
                ReferenceState::Missing => "missing",
                ReferenceState::Invalid => "invalid",
            }
            .to_string(),
            executionState: match s.execution_state {
                ExecutionState::Ready => "ready",
                ExecutionState::UnsafePolicy => "unsafe_policy",
                ExecutionState::Unknown => "unknown",
            }
            .to_string(),
            hostState: match s.host_state {
                HostState::Installed => "installed",
                HostState::Disabled => "disabled",
                HostState::Missing => "missing",
                HostState::Drifted => "drifted",
                HostState::Corrupt => "corrupt",
                HostState::Unknown => "unknown",
            }
            .to_string(),
            diagnostics: s.diagnostics.iter().map(Into::into).collect(),
            hostMetadata: s.host_metadata.as_ref().map(|m| HostRunMetadataDto {
                lastRun: m.last_run.map(|t| t.to_rfc3339()),
                nextRun: m.next_run.map(|t| t.to_rfc3339()),
                lastResult: m.last_result.clone(),
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
    automationTaskId: String,
    cronExpression: String,
    enabled: bool,
) -> Result<ScheduledTaskDto, MutationErrorDto> {
    let config = shared_config_for_mutation(&app)?;

    let input = ScheduledTaskInput {
        id,
        automation_task_id: automationTaskId,
        cron_expression: cronExpression,
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
    automationTaskId: String,
    cronExpression: String,
    enabled: bool,
) -> Result<ScheduledTaskInputDto, String> {
    let input = ScheduledTaskInput {
        id,
        automation_task_id: automationTaskId,
        cron_expression: cronExpression,
        enabled,
    };

    validate_schedule_input(&input).map(|normalized| ScheduledTaskInputDto {
        id: normalized.id,
        automationTaskId: normalized.automation_task_id,
        cronExpression: normalized.cron_expression,
        enabled: normalized.enabled,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduledTaskInputDto {
    pub id: String,
    pub automationTaskId: String,
    pub cronExpression: String,
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
pub async fn delete_scheduled_task(app: AppHandle, id: String) -> Result<String, MutationErrorDto> {
    let config = shared_config_for_mutation(&app)?;
    service(&config)
        .delete_schedule_combined(&id)
        .await
        .map(|outcome| format!("{outcome:?}"))
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
    pub displayName: String,
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
                displayName: t.display_name.clone(),
                ready: true,
            },
            ManagedRecord::NeedsAttention { id, decoded, .. } => AutomationTaskOptionDto {
                displayName: decoded
                    .as_ref()
                    .map(|t| t.display_name.clone())
                    .unwrap_or_else(|| id.clone()),
                id,
                ready: false,
            },
        })
        .collect())
}
