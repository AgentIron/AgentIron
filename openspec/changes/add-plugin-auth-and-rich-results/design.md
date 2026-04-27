## Context

`iron-core` already models plugin auth state, client-initiated auth flows, and rich plugin tool result envelopes. AgentIron currently ignores `AuthStateChange`, does not expose auth commands, and strips `transcript_text` and `view` from `PromptEvent::ToolResult`. That means the app cannot support any plugin that requires credentials and cannot faithfully render structured plugin results.

## Goals / Non-Goals

**Goals:**
- Make authenticated plugin workflows usable from the desktop app.
- Preserve the richer `iron-core` tool-result contract through the Tauri boundary.
- Render structured status/progress/todo views in chat without losing transcript text.

**Non-Goals:**
- Build a generic browser-based OAuth server inside AgentIron.
- Add plugin installation or plugin source configuration; that belongs to plugin runtime support.
- Design a permanent credential storage subsystem beyond what `iron-core` already governs.

## Decisions

- Treat auth as explicit client actions instead of implicit model-driven prompts.
  AgentIron should expose auth initiation and completion as frontend-driven commands.
- Preserve both transcript text and structured view payloads in tool events.
  The transcript remains the canonical text history while the view adds UI-specific rendering.
- Render rich views inline within tool results rather than as a separate sidebar.
  This keeps plugin output attached to the tool call that produced it.
- Model auth state separately from plugin health.
  A plugin can be healthy but unusable until authenticated.

## Risks / Trade-offs

- [OAuth redirect handling may differ by provider] -> Start with the `iron-core` request/response contract and avoid provider-specific UI logic in the first pass.
- [Rich result rendering can become tightly coupled to current payload kinds] -> Implement a typed renderer for the current `status`, `progress`, and `todo_list` payloads with a safe JSON fallback.
- [More event variants increase frontend state complexity] -> Normalize all tool and auth events through a single typed event layer before rendering.

## Migration Plan

- Extend backend event forwarding and Tauri commands first.
- Update frontend types and chat state normalization second.
- Add auth UX and rich result renderers once the data contract is end-to-end.

## Open Questions

- Whether auth flows should live in the Plugins settings pane, the chat area, or both.
- Whether todo-style rich views should be purely informational or support interactive updates later.
