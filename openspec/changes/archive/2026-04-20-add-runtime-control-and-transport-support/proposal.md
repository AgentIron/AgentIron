## Why

AgentIron still uses only a thin slice of the `iron-core` runtime interaction model. Prompt cancellation, script activity events, and stdio/TCP transport support exist upstream but are absent from the product, which leaves users with less control than the core runtime already allows.

## What Changes

- Add prompt cancellation support to the AgentIron backend and UI.
- Forward script activity events from embedded Python execution so the chat UI can show richer in-flight activity.
- Expose transport selection during agent creation and implement supported `iron-core` transports instead of always forcing in-process mode.

## Capabilities

### New Capabilities
- `runtime-control-and-transport-support`: AgentIron can cancel prompts, surface runtime activity events, and create agents using supported `iron-core` transports.

### Modified Capabilities

## Impact

- Worker request and streaming control in `src-tauri/src/state.rs`
- Frontend chat state and controls in `src/context/ChatContext.tsx` and chat components
- Agent creation UI and command bindings in `src/components/agents/AgentConfig.tsx`, `src/lib/tauri/commands.ts`, and `src/types/agent.ts`
- Tighter coupling to `iron-core` prompt-handle and transport APIs
