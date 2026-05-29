## Why

AgentIron now depends on an `iron-core` release that exposes typed `DebugSink` events for engine-level diagnostics. The Tauri app needs a developer-facing way to consume those events so issue #39 can be debugged from `pnpm tauri dev` without adding persistent settings, UI panels, or long-term log storage.

## What Changes

- Add a global app debug mode that is enabled at process startup for development/debug runs.
- When debug mode is enabled, attach an `iron_core::DebugSink` to each created `IronAgent`.
- Print human-readable debug events to stdout for terminal consumption by humans or LLM-assisted debugging.
- Keep debug mode operational only: no persisted app setting, no settings UI, no database migration, no log file, and no in-app log viewer.
- Leave normal runs quiet unless debug mode is explicitly enabled.

## Capabilities

### New Capabilities
- `stdout-debug-mode`: AgentIron can enable global runtime debug output and print human-readable `iron-core` debug events to stdout.

### Modified Capabilities

## Impact

- Rust backend startup/state for tracking whether debug mode is enabled.
- Rust agent worker setup where `IronAgent` instances are constructed.
- A debug sink/formatter for `iron_core::DebugEvent` payloads.
- No Solid settings changes, no persisted settings changes, and no frontend command changes unless implementation discovers that the chosen enablement path requires a minimal bridge.
- Depends on the already-updated `iron-core v0.1.19` debug API.
