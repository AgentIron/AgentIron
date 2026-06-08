## Why

When the assistant streams a response, all previously rendered messages in the chat flash/flicker. A prior fix stabilized the currently-streaming text, but sealed (past) messages still visually churn on every streaming chunk. This happens because `groupEntries()` rebuilds the grouped presentation array on each store mutation, and the current `<Index>`/keyed control-flow boundaries can dispose or refresh message subtrees that still carry the `animate-message-in` CSS class.

## What Changes

- Split the chat message list into two rendering zones: a **sealed history** zone and an **active zone**.
- Treat the **current response turn** as the active boundary while streaming. A response turn includes the latest user prompt and the following assistant/tool sequence for that prompt.
- The sealed history zone renders everything before the current response turn. It uses a memo that only recomputes when the *structure* of sealed entries changes (entries added/removed, tool event type/status changes), not when active message content mutates.
- The active zone renders the current response turn from the live store: the latest user prompt, the currently-streaming assistant message, and any live tool activity lines. It updates on every chunk.
- Use `<For>` with stable `entry.id` keys for the sealed history so SolidJS can skip DOM reconciliation for unchanged messages.
- Make message entrance animation eligibility explicit. Active/new messages may use `animate-message-in`; sealed history messages must not. When streaming completes and the active turn becomes sealed, it must not re-animate during that transition.
- Keep the existing auto-scroll behavior intact, driven by the streaming state in the active zone.

## Capabilities

### New Capabilities

### Modified Capabilities

- `chat-ui`: AgentIron renders sealed history messages from a structural-only memo, preventing DOM churn on streaming content mutations while keeping the active streaming message fully reactive.

## Impact

- `src/components/chat/ChatArea.tsx` — Replace the single `<Index each={grouped()}>` with split sealed/active rendering logic; add a structural-key memo for sealed entries.
- `src/components/chat/MessageBubble.tsx` — Accept explicit animation mode/eligibility so sealed bubbles skip `animate-message-in` while active/new bubbles can still animate.
- `src/components/chat/groupEntries.ts` — May need a variant or helper that produces a structural fingerprint without subscribing to message content.
- No backend API, context, or store changes.
- No changes to `MarkdownRenderer`, `ToolActivitySummary`, `ApprovalBar`, or other chat sub-components.
