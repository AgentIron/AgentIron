import { invoke } from "@tauri-apps/api/core";

// ── Scheduled task manager commands ──

export interface ScheduledTaskDto {
  id: string;
  automationTaskId: string;
  cronExpression: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledTaskRecordDto {
  id: string;
  ready: boolean;
  task?: ScheduledTaskDto;
  diagnostics: string[];
}

export type ScheduleHealth = "healthy" | "degraded" | "unavailable";
export type DesiredState = "present" | "missing" | "unsupported";
export type ReferenceState = "valid" | "missing" | "invalid";
export type ExecutionState = "ready" | "unsafe_policy" | "unknown";
export type HostState = "installed" | "disabled" | "missing" | "drifted" | "corrupt" | "unknown";

export interface ScheduleDiagnosticDto {
  kind: string;
  message: string;
}

export interface HostRunMetadataDto {
  lastRun?: string;
  nextRun?: string;
  lastResult?: string;
}

/**
 * The composite status for one schedule.
 *
 * `health` is deliberately not the only signal: it collapses "not installed"
 * and "drifted" into `degraded`, so the indicator is derived from the
 * individual states instead. See `deriveScheduleIndicator`.
 */
export interface ScheduleStatusDto {
  scheduleId: string;
  health: ScheduleHealth;
  desiredState: DesiredState;
  referenceState: ReferenceState;
  executionState: ExecutionState;
  hostState: HostState;
  diagnostics: ScheduleDiagnosticDto[];
  hostMetadata?: HostRunMetadataDto;
}

export interface SchedulerAvailabilityDto {
  available: boolean;
  platform?: string;
  reason?: string;
}

export interface ScheduledTaskInputDto {
  id: string;
  automationTaskId: string;
  cronExpression: string;
  enabled: boolean;
}

export interface AutomationTaskOptionDto {
  id: string;
  displayName: string;
  ready: boolean;
}

export function schedulerAvailability(): Promise<SchedulerAvailabilityDto> {
  return invoke("scheduler_availability");
}

export function listScheduledTasks(): Promise<ScheduledTaskRecordDto[]> {
  return invoke("list_scheduled_tasks");
}

export function getScheduledTask(id: string): Promise<ScheduledTaskRecordDto | null> {
  return invoke("get_scheduled_task", { id });
}

export function saveScheduledTask(
  id: string,
  automationTaskId: string,
  cronExpression: string,
  enabled: boolean,
): Promise<ScheduledTaskDto> {
  return invoke("save_scheduled_task", { id, automationTaskId, cronExpression, enabled });
}

/** Validate without persisting; resolves with normalized values or rejects with a message. */
export function validateScheduledTask(
  id: string,
  automationTaskId: string,
  cronExpression: string,
  enabled: boolean,
): Promise<ScheduledTaskInputDto> {
  return invoke("validate_scheduled_task", { id, automationTaskId, cronExpression, enabled });
}

export function inspectSchedule(id: string): Promise<ScheduleStatusDto> {
  return invoke("inspect_schedule", { id });
}

export function inspectAllSchedules(): Promise<ScheduleStatusDto[]> {
  return invoke("inspect_all_schedules");
}

export function reconcileSchedule(id: string): Promise<ScheduleStatusDto> {
  return invoke("reconcile_schedule", { id });
}

export function reconcileAllSchedules(): Promise<ScheduleStatusDto[]> {
  return invoke("reconcile_all_schedules");
}

/** Remove the host entry and the desired state. */
export function deleteScheduledTask(id: string): Promise<string> {
  return invoke("delete_scheduled_task", { id });
}

/** Remove desired state only, leaving any host entry as an orphan. */
export function deleteScheduledTaskDesiredOnly(id: string): Promise<void> {
  return invoke("delete_scheduled_task_desired_only", { id });
}

export function listAutomationTaskOptions(): Promise<AutomationTaskOptionDto[]> {
  return invoke("list_automation_task_options");
}
