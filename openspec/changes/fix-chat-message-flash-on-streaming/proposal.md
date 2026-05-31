## Why

When the assistant streams a response, all previously rendered messages in the chat flash/flicker. A prior fix stabilized the currently-streaming text, but sealed (past) messages still re-render on every streaming chunk. This happens because `groupEntries()` rebuilds the entire grouped array on every store mutation, causing every `<Index>` child to re-execute its render function and re-apply the `animate-message-in` CSS class.

## What Changes

- Split the chat message list into two rendering zones: a **sealed history** zone and an **active zone**.
- The sealed history zone renders all messages except the last assistant message and any in-progress tool activity. It uses a memo that only recomputes when the *structure* of entries changes (entries added/removed, tool event type/status changes), not when message content mutates.
- The active zone renders only the currently-streaming assistant message and any live tool activity lines. It reads from the live store and updates on every chunk.
- Use `<For>` with stable `entry.id` keys for the sealed history so SolidJS can skip DOM reconciliation for unchanged messages.
- Remove `animate-message-in` from sealed message bubbles so they never re-trigger the CSS animation. Apply it only to new messages as they transition from the active zone into sealed history.
- Keep the existing auto-scroll behavior intact, driven by the streaming state in the active zone.

## Capabilities

### New Capabilities

### Modified Capabilities

- `chat-ui`: AgentIron renders sealed history messages from a structural-only memo, preventing DOM churn on streaming content mutations while keeping the active streaming message fully reactive.

## Impact

- `src/components/chat/ChatArea.tsx` — Replace the single `<Index each={grouped()}>` with split sealed/active rendering logic; add a structural-key memo for sealed entries.
- `src/components/chat/MessageBubble.tsx` — Accept an optional `sealed` prop (or derive it) to conditionally skip the `animate-message-in` class.
- `src/components/chat/groupEntries.ts` — May need a variant or helper that produces a structural fingerprint without subscribing to message content.
- No backend API, context, or store changes.
- No changes to `MarkdownRenderer`, `ToolActivitySummary`, `ApprovalBar`, or other chat sub-components.
