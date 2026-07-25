import { createSignal, createMemo, For, Show, onMount, type Component } from "solid-js";
import { TbOutlineRefresh, TbOutlinePlus, TbOutlineTrash, TbOutlineX } from "solid-icons/tb";
import {
  schedulerAvailability,
  listScheduledTasks,
  inspectAllSchedules,
  saveScheduledTask,
  validateScheduledTask,
  reconcileSchedule,
  reconcileAllSchedules,
  deleteScheduledTask,
  listAutomationTaskOptions,
  type ScheduledTaskRecordDto,
  type ScheduleStatusDto,
  type SchedulerAvailabilityDto,
  type AutomationTaskOptionDto,
} from "@lib/tauri/schedule-commands";
import { deriveScheduleIndicator, TONE_CLASSES } from "@lib/schedule-status";

/** Extract a message from a command rejection, which may be a string or a MutationErrorDto. */
function errorMessage(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export const ScheduledTasksSettings: Component = () => {
  const [availability, setAvailability] = createSignal<SchedulerAvailabilityDto | null>(null);
  const [records, setRecords] = createSignal<ScheduledTaskRecordDto[]>([]);
  const [statuses, setStatuses] = createSignal<ScheduleStatusDto[]>([]);
  const [taskOptions, setTaskOptions] = createSignal<AutomationTaskOptionDto[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [busyId, setBusyId] = createSignal<string | null>(null);

  const [editorOpen, setEditorOpen] = createSignal(false);
  const [formId, setFormId] = createSignal("");
  const [formTaskId, setFormTaskId] = createSignal("");
  const [formCron, setFormCron] = createSignal("0 3 * * *");
  const [formEnabled, setFormEnabled] = createSignal(true);
  const [formError, setFormError] = createSignal<string | null>(null);
  const [saving, setSaving] = createSignal(false);

  const statusById = createMemo(() => {
    const m = new Map<string, ScheduleStatusDto>();
    for (const s of statuses()) m.set(s.scheduleId, s);
    return m;
  });

  /** Host entries with no desired state have no schedule row, so surface them separately. */
  const orphanStatuses = createMemo(() => {
    const known = new Set(records().map((r) => r.id));
    return statuses().filter((s) => !known.has(s.scheduleId));
  });

  /**
   * Reload the list, replacing whatever error is on screen.
   *
   * Every mutation refreshes on the way out, so the error signal is only
   * written once here, at the end: setting it inside a handler and clearing it
   * on entry to this function would drop the message before a render could show
   * it. Handlers pass their failure as `carry` instead, and it takes precedence
   * over anything the reload itself reports, being the more specific of the two.
   */
  const refresh = async (carry: string | null = null) => {
    setLoading(true);
    let nextError = carry;
    try {
      const [avail, recs, opts] = await Promise.all([
        schedulerAvailability(),
        listScheduledTasks(),
        listAutomationTaskOptions(),
      ]);
      setAvailability(avail);
      setRecords(recs);
      setTaskOptions(opts);

      // Inspecting reaches the host scheduler, so it can fail independently of
      // the list; a failure here must not blank out the schedules themselves.
      try {
        setStatuses(await inspectAllSchedules());
      } catch (e) {
        setStatuses([]);
        nextError ??= `Schedules loaded, but their system status is unavailable: ${errorMessage(e)}`;
      }
    } catch (e) {
      nextError ??= errorMessage(e);
    } finally {
      setError(nextError);
      setLoading(false);
    }
  };

  onMount(() => {
    void refresh();
  });

  const openEditor = (record?: ScheduledTaskRecordDto) => {
    setFormError(null);
    if (record?.task) {
      setFormId(record.task.id);
      setFormTaskId(record.task.automationTaskId);
      setFormCron(record.task.cronExpression);
      setFormEnabled(record.task.enabled);
    } else {
      setFormId("");
      setFormTaskId(taskOptions()[0]?.id ?? "");
      setFormCron("0 3 * * *");
      setFormEnabled(true);
    }
    setEditorOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    let failure: string | null = null;
    try {
      // Validate first so cron and identifier problems read as form errors
      // rather than as a failed write.
      await validateScheduledTask(formId(), formTaskId(), formCron(), formEnabled());
      await saveScheduledTask(formId(), formTaskId(), formCron(), formEnabled());

      // Saving records desired state only; installing is a separate step.
      try {
        await reconcileSchedule(formId());
      } catch (e) {
        failure = `Saved, but installing it on the system failed: ${errorMessage(e)}`;
      }
      setEditorOpen(false);
      await refresh(failure);
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleReconcile = async (id: string) => {
    setBusyId(id);
    // Clear on entry so a stale message does not sit there during the work;
    // `refresh` has the last word on what is shown once it finishes.
    setError(null);
    let failure: string | null = null;
    try {
      await reconcileSchedule(id);
    } catch (e) {
      failure = errorMessage(e);
    } finally {
      setBusyId(null);
      await refresh(failure);
    }
  };

  const handleReconcileAll = async () => {
    setLoading(true);
    setError(null);
    let failure: string | null = null;
    try {
      await reconcileAllSchedules();
    } catch (e) {
      failure = errorMessage(e);
    } finally {
      await refresh(failure);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(null);
    let failure: string | null = null;
    try {
      // A delete that clears the system entry but not the saved schedule
      // resolves rather than rejecting, so the outcome has to be read.
      const outcome = await deleteScheduledTask(id);
      if (!outcome.desiredDeleted) {
        failure = outcome.hostRemoved
          ? "Removed from the system, but the saved schedule could not be deleted."
          : "The schedule could not be deleted.";
      }
    } catch (e) {
      failure = errorMessage(e);
    } finally {
      setBusyId(null);
      await refresh(failure);
    }
  };

  return (
    <div class="space-y-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-sm font-semibold text-text-secondary">Scheduled Tasks</h2>
          <p class="text-sm text-text-tertiary mt-1">
            Run automation tasks on a recurring schedule using your system scheduler.
          </p>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleReconcileAll}
            disabled={loading()}
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50"
            title="Re-check every schedule against the system and repair any that drifted"
          >
            <TbOutlineRefresh size={15} />
            <span>Reconcile all</span>
          </button>
          <button
            onClick={() => openEditor()}
            disabled={!availability()?.available}
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm bg-bg-hover text-text-primary hover:opacity-90 disabled:opacity-50"
          >
            <TbOutlinePlus size={15} />
            <span>New schedule</span>
          </button>
        </div>
      </div>

      <Show when={availability() && !availability()!.available}>
        <div class="rounded-md border border-border-subtle bg-bg-hover px-3 py-2 text-sm text-text-secondary">
          Scheduling is unavailable: {availability()!.reason}
        </div>
      </Show>

      <Show when={error()}>
        <div class="flex items-start justify-between gap-3 rounded-md border border-red-500/40 px-3 py-2 text-sm text-text-secondary">
          <span>{error()}</span>
          <button onClick={() => setError(null)} class="text-text-tertiary hover:text-text-primary">
            <TbOutlineX size={14} />
          </button>
        </div>
      </Show>

      <Show
        when={records().length > 0 || orphanStatuses().length > 0}
        fallback={
          <p class="text-sm text-text-tertiary">
            <Show when={!loading()} fallback="Loading…">
              No scheduled tasks yet.
            </Show>
          </p>
        }
      >
        <div class="space-y-2">
          <For each={records()}>
            {(record) => {
              const status = () => statusById().get(record.id);
              const indicator = () => {
                const s = status();
                return s ? deriveScheduleIndicator(s) : null;
              };
              return (
                <div class="rounded-md border border-border-subtle p-3 space-y-2">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span
                        class={`h-2 w-2 rounded-full flex-shrink-0 ${
                          indicator() ? TONE_CLASSES[indicator()!.tone] : TONE_CLASSES.grey
                        }`}
                        title={indicator()?.reason ?? "Status unknown"}
                      />
                      <div class="min-w-0">
                        <div class="text-sm text-text-primary truncate">{record.id}</div>
                        <div class="text-xs text-text-tertiary truncate">
                          <Show when={record.task} fallback="Unreadable schedule">
                            <code>{record.task!.cronExpression}</code> → {record.task!.automationTaskId}
                          </Show>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                      <span class="text-xs text-text-tertiary">{indicator()?.label ?? "—"}</span>
                      <button
                        onClick={() => openEditor(record)}
                        disabled={!record.task}
                        class="px-2 py-1 rounded text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-40"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleReconcile(record.id)}
                        disabled={busyId() === record.id}
                        class="px-2 py-1 rounded text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-40"
                        title="Install or repair this schedule on the system"
                      >
                        <Show when={busyId() === record.id} fallback="Install">
                          Working…
                        </Show>
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        disabled={busyId() === record.id}
                        class="p-1 rounded text-text-tertiary hover:text-red-400 hover:bg-bg-hover disabled:opacity-40"
                        title="Remove this schedule and its system entry"
                      >
                        <TbOutlineTrash size={14} />
                      </button>
                    </div>
                  </div>

                  <Show when={indicator() && indicator()!.tone !== "green"}>
                    <p class="text-xs text-text-tertiary pl-[18px]">{indicator()!.reason}</p>
                  </Show>

                  <Show when={record.diagnostics.length > 0}>
                    <ul class="text-xs text-text-tertiary pl-[18px] space-y-0.5">
                      <For each={record.diagnostics}>{(d) => <li>{d}</li>}</For>
                    </ul>
                  </Show>

                  <Show when={status()?.hostMetadata}>
                    <div class="text-xs text-text-tertiary pl-[18px]">
                      Last run: {formatTime(status()!.hostMetadata!.lastRun)} · Next run:{" "}
                      {formatTime(status()!.hostMetadata!.nextRun)}
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>

          <For each={orphanStatuses()}>
            {(status) => {
              const indicator = deriveScheduleIndicator(status);
              return (
                <div class="rounded-md border border-border-subtle p-3">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span
                        class={`h-2 w-2 rounded-full flex-shrink-0 ${TONE_CLASSES[indicator.tone]}`}
                        title={indicator.reason}
                      />
                      <div class="min-w-0">
                        <div class="text-sm text-text-primary truncate">{status.scheduleId}</div>
                        <div class="text-xs text-text-tertiary">{indicator.reason}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(status.scheduleId)}
                      disabled={busyId() === status.scheduleId}
                      class="px-2 py-1 rounded text-xs text-text-secondary hover:bg-bg-hover disabled:opacity-40"
                      title="Remove the leftover system entry"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      <Show when={editorOpen()}>
        <div class="rounded-md border border-border-subtle p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-text-secondary">Schedule</h3>
            <button
              onClick={() => setEditorOpen(false)}
              class="text-text-tertiary hover:text-text-primary"
            >
              <TbOutlineX size={14} />
            </button>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-text-tertiary">Schedule ID</label>
            <input
              value={formId()}
              onInput={(e) => setFormId(e.currentTarget.value)}
              placeholder="nightly-report"
              class="w-full px-2 py-1.5 rounded border border-border-subtle bg-transparent text-sm text-text-primary"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs text-text-tertiary">Automation task</label>
            <Show
              when={taskOptions().length > 0}
              fallback={
                <p class="text-xs text-text-tertiary">
                  No automation tasks exist yet. Create one before scheduling it.
                </p>
              }
            >
              <select
                value={formTaskId()}
                onChange={(e) => setFormTaskId(e.currentTarget.value)}
                class="w-full px-2 py-1.5 rounded border border-border-subtle bg-transparent text-sm text-text-primary"
              >
                <For each={taskOptions()}>
                  {(o) => (
                    <option value={o.id}>
                      {o.displayName}
                      {o.ready ? "" : " (needs attention)"}
                    </option>
                  )}
                </For>
              </select>
            </Show>
          </div>

          <div class="space-y-1">
            <label class="text-xs text-text-tertiary">Cron expression</label>
            <input
              value={formCron()}
              onInput={(e) => setFormCron(e.currentTarget.value)}
              placeholder="0 3 * * *"
              class="w-full px-2 py-1.5 rounded border border-border-subtle bg-transparent text-sm font-mono text-text-primary"
            />
            <p class="text-xs text-text-tertiary">
              Five numeric fields: minute hour day-of-month month day-of-week. Names and shorthands
              like <code>@daily</code> are not supported.
            </p>
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formEnabled()}
              onChange={(e) => setFormEnabled(e.currentTarget.checked)}
              class="rounded border-border-subtle"
            />
            <span class="text-sm text-text-secondary">Enabled</span>
          </label>

          <Show when={formError()}>
            <p class="text-xs text-red-400">{formError()}</p>
          </Show>

          <div class="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving() || taskOptions().length === 0}
              class="px-3 py-1.5 rounded-md text-sm bg-bg-hover text-text-primary hover:opacity-90 disabled:opacity-50"
            >
              <Show when={saving()} fallback="Save and install">
                Saving…
              </Show>
            </button>
            <button
              onClick={() => setEditorOpen(false)}
              class="px-3 py-1.5 rounded-md text-sm text-text-secondary hover:bg-bg-hover"
            >
              Cancel
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};
