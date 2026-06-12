## Why

AgentIron currently owns persistent agent configuration in its desktop app database even when that state is needed by CLI and headless workflows. This creates drift between frontends, keeps secrets and runtime configuration behind AgentIron-specific persistence, and prevents `iron-core` from being the shared source of truth for provider setup, model selection, MCP configuration, skills policy, credentials, and handoff storage.

Issue 56 follows `AgentIron/iron-core#58` and should migrate shared runtime state behind `iron-core` config APIs while preserving AgentIron-owned desktop and frontend preferences in the app.

## What Changes

- Treat the current persistent-state inventory as complete for AgentIron's codebase: `agentiron.db` settings and credentials, explicit handoff JSON files, and ephemeral snip temp files.
- Move provider config, provider credentials, default model, custom models, MCP servers, skills settings, and handoff API/storage behind `iron-core` APIs.
- Keep AgentIron-specific state in AgentIron: theme, autostart preference, quick-launch shortcut, starred models, user profile, model registry cache, Tauri-specific configuration/data, and AgentIron-only schema such as agent configs, conversations, and messages.
- Remove the unused `scheduled_tasks` schema from AgentIron instead of migrating it.
- Remove frontend-owned SQL access to core-owned state; AgentIron should call backend commands that use `iron-core` APIs.
- Preserve AgentIron-local persistence only for desktop/frontend-specific state.
- Use the shared `iron-core` default config path via `ConfigStore::open()` rather than an AgentIron-specific core config database path.
- Keep model registry ownership/refactoring out of this change; track that follow-up in AgentIron/AgentIron#57.

## Capabilities

### New Capabilities
- `persistent-config-ownership`: Defines which persistent state belongs to `iron-core` versus AgentIron and the required access boundaries for migration.

### Modified Capabilities

## Inventory Summary

### Active AgentIron Persistence Today
- `settings` table in `sqlite:agentiron.db`, historically written directly by `src/context/SettingsContext.tsx` through frontend SQL access and now accessed through backend command facades.
- `provider_credentials` table in `sqlite:agentiron.db`, written by `src-tauri/src/credential_store.rs` and OAuth commands.
- User-selected handoff JSON files written and read by handoff commands.

### Schema-Only State Today
- `agent_configs`
- `conversations`
- `messages`
- `scheduled_tasks`

### Out Of Scope
- Ephemeral frontend stores such as chat UI state, MCP status, skill catalog cache, and UI pane state.
- Temporary snip screenshot files.
- Tauri app configuration, capabilities, plugin setup, and OS-shell integration state.

## Impact

- Frontend settings persistence in `src/context/SettingsContext.tsx` and `src/lib/tauri/db.ts`.
- Tauri SQL plugin setup and migrations in `src-tauri/src/lib.rs` and `src-tauri/migrations`.
- Credential persistence in `src-tauri/src/credential_store.rs` and `src-tauri/src/commands/oauth.rs`.
- Agent creation inputs in `src/context/AgentContext.tsx`, `src/lib/tauri/commands.ts`, and `src-tauri/src/commands/agent.rs`.
- Provider settings, model settings, MCP settings, skills settings, and handoff UI surfaces.
- Upstream dependency/API coordination with `iron-core` config APIs from `AgentIron/iron-core#58`.
- Upstream follow-up issues: `AgentIron/iron-core#67`, `AgentIron/iron-core#68`, and `AgentIron/iron-core#69`.
