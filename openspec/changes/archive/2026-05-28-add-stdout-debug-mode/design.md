## Context

`iron-core v0.1.19` exposes a typed `DebugSink` surface and `IronAgent::set_debug_sink(...)`. AgentIron currently creates each `IronAgent` in `src-tauri/src/state.rs` after `create_agent` builds the provider and `iron_core::Config` in `src-tauri/src/commands/agent.rs`. There is no app-side debug sink today, so engine-level decisions such as prompt composition, context estimates, compaction, tool execution, approval evaluation, provider switching, and skill activation are not visible from `pnpm tauri dev`.

This feature is intended for developer and LLM-assisted debugging from a terminal. It is not a product settings feature and should not introduce persisted settings, UI controls, database migrations, log files, or in-app log viewing.

## Goals / Non-Goals

**Goals:**

- Enable global app debug mode at process startup.
- Attach a debug sink to every newly created `IronAgent` while global debug mode is enabled.
- Print human-readable debug events to stdout for terminal inspection.
- Keep normal app runs quiet unless debug mode is explicitly enabled.
- Keep the implementation backend-only unless a narrow startup flag bridge is required.

**Non-Goals:**

- Persisting debug mode in `SettingsContext`, SQLite, or any settings JSON.
- Adding settings UI, a log viewer, or a live debug panel.
- Writing debug events to a file.
- Guaranteeing machine-stable JSON output or long-term log compatibility.
- Changing `iron-core` debug event semantics or redaction behavior.

## Decisions

### Use Global Runtime State

Debug mode will be represented in Rust app state and copied into agent worker parameters when agents are created. This matches the intended behavior: debug mode applies to the whole app process and all agents created during that process.

Alternative considered: per-agent or per-tab debug flags. That would add frontend command plumbing and create inconsistent terminal output for a feature intended to diagnose the runtime globally.

### Enable at Startup Only

Debug mode should be enabled before agents are created, using process startup inputs such as a `--debug` argument and/or an environment variable. Runtime toggling is intentionally out of scope because it would require commands to update existing workers or recreate agents.

Alternative considered: persisted settings toggle. That was rejected because this feature is operational console output for `pnpm tauri dev`, not user-facing app configuration.

### Print to Stdout, Not Files

The sink will write to stdout with `println!` or equivalent formatting. The intended consumption path is the terminal running `pnpm tauri dev`.

Alternative considered: `debug.log` in the app data directory. That was rejected for this MVP because the user does not need long-term logging or in-app log exposure, and file writes add blocking and lifecycle concerns.

### Human-Readable Formatting

The formatter should summarize the event envelope and payload in concise text: sequence, severity, timestamp, scope identifiers when present, payload family, event kind, and key redacted metadata. It may use Rust `Debug` output as a fallback for unhandled or future non-exhaustive variants, but common payload families should be readable without decoding raw enum dumps.

Alternative considered: JSONL. That would be better for future tooling but worse for the immediate human/LLM terminal debugging workflow.

### Direct Stdout Writes Are Acceptable for MVP

`DebugSink::emit` is synchronous and should return quickly. Direct stdout writes can block, but this debug mode is explicitly development-only and terminal-oriented. A channel-backed async writer can be added later if output volume or blocking becomes a problem.

Alternative considered: non-blocking channel sink. That is more robust but adds lifecycle and backpressure complexity not needed for the first stdout-only implementation.

## Risks / Trade-offs

- Stdout output can be noisy during active prompts -> Keep debug disabled by default and require explicit startup opt-in.
- Direct stdout writes can block runtime progress -> Accept for development-only MVP; revisit with a channel sink if needed.
- New `iron-core` debug variants may be added later -> Use non-exhaustive-safe formatting with a fallback for unknown variants.
- Startup flag handling can differ under Tauri dev wrappers -> Support an environment variable as a practical fallback if CLI arg propagation is awkward.
- Debug output may contain metadata from user actions -> Rely on `iron-core` redaction-first payloads and avoid adding raw prompt/tool argument logging in AgentIron's formatter.

## Migration Plan

No data migration is required. The dependency update to `iron-core v0.1.19` has already been completed. If the feature causes issues, disabling the startup flag or environment variable restores the prior quiet behavior without changing persisted state.

## Open Questions

- Should the implementation support both `--debug` and an environment variable, or only the most reliable one for Tauri dev invocation?
- What exact environment variable name should be accepted if env-based enablement is included?
