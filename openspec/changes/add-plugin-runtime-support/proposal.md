## Why

`iron-core` now includes a real WASM plugin runtime, but AgentIron still exposes only built-in tools and MCP servers. That leaves a large portion of upstream capability unusable from the desktop app and forces future plugin work to start from a placeholder UI.

## What Changes

- Enable `iron-core` plugin runtime configuration when creating AgentIron sessions.
- Add backend support for registering configured plugins, querying plugin inventory, and toggling plugin enablement per session.
- Add a frontend plugin management surface that replaces the current placeholder Plugins settings pane.
- Surface plugin runtime status and per-plugin availability in a form the UI can render and refresh.

## Capabilities

### New Capabilities
- `plugin-runtime-support`: AgentIron can configure, register, inspect, and enable `iron-core` WASM plugins at runtime and per session.

### Modified Capabilities

## Impact

- Tauri backend agent creation and worker state in `src-tauri/src/commands/agent.rs` and `src-tauri/src/state.rs`
- Frontend settings UI in `src/components/settings/PluginsSettings.tsx`
- Frontend Tauri command bindings and types in `src/lib/tauri/commands.ts` and `src/types/plugin.ts`
- Dependency on the pinned `iron-core` plugin runtime APIs and plugin cache configuration
