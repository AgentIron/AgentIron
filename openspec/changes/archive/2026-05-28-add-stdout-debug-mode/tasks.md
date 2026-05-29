## 1. Startup Debug State

- [x] 1.1 Add backend debug-mode detection at app startup from the selected process inputs (`--debug` and/or environment variable).
- [x] 1.2 Store the debug-enabled flag in Rust app state without adding persisted settings, database schema, or frontend settings types.
- [x] 1.3 Pass the global debug-enabled flag into each agent worker through `AgentParams` or an equivalent backend-only path.

## 2. Stdout Debug Sink

- [x] 2.1 Implement an `iron_core::DebugSink` that writes received `DebugEvent` values to stdout.
- [x] 2.2 Format common debug payload families in concise human-readable output, including sequence, severity, timestamp, scope, payload family, event kind, and key redacted metadata.
- [x] 2.3 Add a fallback formatter for future or unhandled non-exhaustive debug variants.

## 3. Agent Integration

- [x] 3.1 Attach the stdout debug sink immediately after `IronAgent::with_tokio_handle(...)` when debug mode is enabled.
- [x] 3.2 Keep normal agent creation behavior unchanged when debug mode is disabled.
- [x] 3.3 Confirm no frontend settings UI, `AppSettings` field, database migration, log file, or log viewer is introduced.

## 4. Verification

- [x] 4.1 Run `cargo check --manifest-path src-tauri/Cargo.toml`.
- [x] 4.2 Run a dev-mode smoke check with debug enabled and confirm `iron-core` debug events print to the terminal during agent activity.
- [x] 4.3 Run a smoke check without debug enabled and confirm debug event output is quiet.
- [x] 4.4 Run `graphify update .` after implementation changes.
