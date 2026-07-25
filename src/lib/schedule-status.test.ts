import { describe, it, expect } from "vitest";
import { deriveScheduleIndicator } from "@lib/schedule-status";
import type { ScheduleStatusDto } from "@lib/tauri/schedule-commands";

function status(over: Partial<ScheduleStatusDto> = {}): ScheduleStatusDto {
  return {
    scheduleId: "s1",
    health: "healthy",
    desiredState: "present",
    referenceState: "valid",
    executionState: "ready",
    hostState: "installed",
    diagnostics: [],
    hostMetadata: null,
    ...over,
  };
}

describe("deriveScheduleIndicator", () => {
  it("reports green when installed and matching", () => {
    const i = deriveScheduleIndicator(status());
    expect(i.tone).toBe("green");
    expect(i.label).toBe("Installed");
  });

  // health is `degraded` for both "missing" and "drifted", so these two cases
  // are the reason the indicator is derived from hostState rather than health.
  it("distinguishes not-installed from mismatched, which health alone cannot", () => {
    const missing = deriveScheduleIndicator(
      status({
        health: "degraded",
        hostState: "missing",
        diagnostics: [{ kind: "not_installed", message: "host entry 's1' is not installed" }],
      }),
    );
    const drifted = deriveScheduleIndicator(
      status({
        health: "degraded",
        hostState: "drifted",
        diagnostics: [{ kind: "schedule_drift", message: "host entry differs" }],
      }),
    );

    expect(missing.tone).toBe("red");
    expect(drifted.tone).toBe("yellow");
    expect(missing.reason).toContain("not installed");
    expect(drifted.reason).toContain("differs");
  });

  it("surfaces the install failure rather than a bare not-installed message", () => {
    // The real shape observed when iron-core's Task Scheduler XML is rejected.
    const i = deriveScheduleIndicator(
      status({
        health: "degraded",
        hostState: "unknown",
        executionState: "unknown",
        diagnostics: [
          {
            kind: "installation_failed",
            message: "host install failed: schtasks /Create failed: The task XML is missing...",
          },
        ],
      }),
    );
    // hostState `unknown` yields grey, but the diagnostic must still reach the user.
    expect(i.reason).toContain("schtasks");
  });

  it("prefers installation_failed over not_installed when the host entry is missing", () => {
    const i = deriveScheduleIndicator(
      status({
        health: "degraded",
        hostState: "missing",
        diagnostics: [
          { kind: "installation_failed", message: "host install failed: permission denied" },
          { kind: "not_installed", message: "host entry 's1' is not installed" },
        ],
      }),
    );
    expect(i.tone).toBe("red");
    expect(i.reason).toContain("permission denied");
  });

  it("flags an installed-but-unrunnable schedule instead of showing green", () => {
    const i = deriveScheduleIndicator(
      status({
        executionState: "unsafe_policy",
        diagnostics: [{ kind: "unsafe_policy", message: "profile requires interactive approval" }],
      }),
    );
    expect(i.tone).toBe("blocked");
    expect(i.tone).not.toBe("green");
    expect(i.reason).toContain("approval");
  });

  it("treats a missing automation task as red, since installing would schedule nothing", () => {
    const i = deriveScheduleIndicator(
      status({
        health: "degraded",
        referenceState: "missing",
        hostState: "installed",
        diagnostics: [{ kind: "missing_task", message: "automation task 't1' does not exist" }],
      }),
    );
    expect(i.tone).toBe("red");
    expect(i.label).toBe("Task missing");
  });

  it("reports an orphaned host entry as yellow", () => {
    const i = deriveScheduleIndicator(
      status({
        health: "degraded",
        desiredState: "missing",
        hostState: "installed",
        diagnostics: [{ kind: "orphaned_host_entry", message: "orphaned entry 's1'" }],
      }),
    );
    expect(i.tone).toBe("yellow");
    expect(i.label).toBe("Orphaned");
  });

  it("reports grey when the platform scheduler is unavailable", () => {
    const i = deriveScheduleIndicator(
      status({
        health: "unavailable",
        hostState: "unknown",
        executionState: "unknown",
        diagnostics: [{ kind: "platform_unavailable", message: "no scheduler on this platform" }],
      }),
    );
    expect(i.tone).toBe("grey");
    expect(i.reason).toContain("no scheduler");
  });

  it("reports a disabled host entry as yellow, since it will not run", () => {
    const i = deriveScheduleIndicator(status({ health: "degraded", hostState: "disabled" }));
    expect(i.tone).toBe("yellow");
    expect(i.label).toBe("Disabled");
  });

  it("always produces a non-empty reason", () => {
    const cases: Partial<ScheduleStatusDto>[] = [
      {},
      { health: "degraded", hostState: "missing" },
      { health: "degraded", hostState: "drifted" },
      { health: "degraded", hostState: "corrupt" },
      { health: "degraded", hostState: "unknown" },
      { health: "unavailable" },
      { desiredState: "unsupported" },
      { executionState: "unsafe_policy" },
      { executionState: "unknown" },
    ];
    for (const c of cases) {
      expect(deriveScheduleIndicator(status(c)).reason.length).toBeGreaterThan(0);
    }
  });
});
