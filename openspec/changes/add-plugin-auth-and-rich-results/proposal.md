## Why

Even after plugin registration is added, AgentIron still cannot handle plugin authentication or render the richer tool-result payloads that `iron-core` now emits. Without this, authenticated plugins remain unusable and plugin tools degrade to lossy plain JSON in chat.

## What Changes

- Add backend command support for starting and completing plugin auth flows and for querying auth prompts.
- Forward plugin auth state transitions and rich tool-result metadata from `iron-core` into AgentIron events and types.
- Add frontend UX for auth-required plugins and render plugin rich result views such as status, progress, and todo payloads.

## Capabilities

### New Capabilities
- `plugin-auth-and-rich-results`: AgentIron can complete plugin auth flows and render structured plugin tool output from `iron-core`.

### Modified Capabilities

## Impact

- Tauri worker event handling in `src-tauri/src/state.rs`
- Frontend chat event types and rendering in `src/types/agent.ts`, `src/context/ChatContext.tsx`, and `src/components/chat/ToolDetailRenderers.tsx`
- Plugin settings and auth command bindings in `src/lib/tauri/commands.ts`
- Dependency on `iron-core` auth and rich-output event contracts
