import type { ScheduleStatusDto } from "@lib/tauri/schedule-commands";

/**
 * Indicator colours for a schedule row.
 *
 * `blocked` is not in the original three-colour spec. It covers a schedule that
 * is installed and otherwise healthy but cannot execute — a green dot on a task
 * that silently never runs is worse than no dot at all.
 */
export type IndicatorTone = "green" | "red" | "yellow" | "blocked" | "grey";

export interface ScheduleIndicator {
  tone: IndicatorTone;
  label: string;
  /** Why this tone was chosen, shown on hover and in the detail panel. */
  reason: string;
}

/**
 * Derive a row indicator from a schedule's composite status.
 *
 * `health` alone is insufficient: `Degraded` covers "host entry missing",
 * "drifted", and "partially installed" alike, so red and yellow are
 * indistinguishable from it. The individual `desiredState` / `hostState` /
 * `executionState` values carry that detail, and the diagnostics carry the
 * human-readable reason, so both are used here.
 */
export function deriveScheduleIndicator(status: ScheduleStatusDto): ScheduleIndicator {
  const diagnostic = (kind: string) => status.diagnostics.find((d) => d.kind === kind)?.message;
  const firstMessage = status.diagnostics[0]?.message;

  // The platform scheduler could not be reached at all, so nothing below can be
  // trusted: the host state is unknown rather than known-bad.
  if (status.health === "unavailable") {
    return {
      tone: "grey",
      label: "Unavailable",
      reason:
        diagnostic("platform_unavailable") ??
        firstMessage ??
        "The platform scheduler is unavailable, so this schedule cannot be evaluated.",
    };
  }

  // An owned host entry with no desired state behind it.
  const orphaned = diagnostic("orphaned_host_entry");
  if (orphaned || (status.desiredState === "missing" && status.hostState !== "missing")) {
    return {
      tone: "yellow",
      label: "Orphaned",
      reason: orphaned ?? "A host entry exists with no corresponding schedule.",
    };
  }

  if (status.desiredState === "unsupported") {
    return {
      tone: "yellow",
      label: "Unsupported",
      reason:
        diagnostic("unsupported_schedule") ??
        firstMessage ??
        "This schedule's stored format is not supported.",
    };
  }

  // The schedule points at an automation task that is gone or undecodable, so
  // installing it would schedule nothing.
  if (status.referenceState === "missing" || status.referenceState === "invalid") {
    return {
      tone: "red",
      label: status.referenceState === "missing" ? "Task missing" : "Task invalid",
      reason:
        diagnostic("missing_task") ??
        diagnostic("invalid_task") ??
        "The automation task this schedule runs is missing or invalid.",
    };
  }

  switch (status.hostState) {
    case "missing":
      return {
        tone: "red",
        label: "Not installed",
        reason:
          diagnostic("installation_failed") ??
          diagnostic("not_installed") ??
          "This schedule is not installed on the system.",
      };
    case "corrupt":
      return {
        tone: "yellow",
        label: "Corrupt",
        reason: diagnostic("corrupt_host_entry") ?? "The host entry is malformed.",
      };
    case "drifted":
      return {
        tone: "yellow",
        label: "Mismatched",
        reason:
          diagnostic("schedule_drift") ??
          diagnostic("runner_path_drift") ??
          "The installed entry differs from this schedule.",
      };
    case "disabled":
      return {
        tone: "yellow",
        label: "Disabled",
        reason: "The host entry is installed but disabled, so it will not run.",
      };
    case "unknown":
      return {
        tone: "grey",
        label: "Unknown",
        reason: firstMessage ?? "The host entry's state could not be determined.",
      };
    case "installed":
      break;
  }

  // Installed and matching — but a profile needing interactive approval cannot
  // complete a headless run, so this is not a green light.
  if (status.executionState === "unsafe_policy") {
    return {
      tone: "blocked",
      label: "Cannot run headless",
      reason:
        diagnostic("unsafe_policy") ??
        "Installed, but the profile requires interactive approval, so scheduled runs will not complete.",
    };
  }

  if (status.executionState === "unknown") {
    return {
      tone: "grey",
      label: "Unknown",
      reason: firstMessage ?? "Execution readiness could not be determined.",
    };
  }

  return {
    tone: "green",
    label: "Installed",
    reason: "Installed and matching this schedule.",
  };
}

/** Tailwind classes per tone, kept next to the derivation so they stay in step. */
export const TONE_CLASSES: Record<IndicatorTone, string> = {
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  blocked: "bg-orange-500",
  grey: "bg-gray-400",
};
