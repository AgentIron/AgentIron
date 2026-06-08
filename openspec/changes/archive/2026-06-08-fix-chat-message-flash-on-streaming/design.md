# Design: Split Sealed/Active Chat Rendering

## Overview

Replace the single `grouped()` presentation array in `ChatArea.tsx` with two rendering zones so that streaming chunks do not trigger visual churn on past messages, while preserving entrance animations for new messages.

## Invariants

- **Sealed history** only recomputes when entry structure changes (add/remove, type/status changes). It does not subscribe to message content mutations.
- **Active zone** renders the current response turn and reads from the live store, updating on every chunk.
- Only the active zone or newly-created entries may use `animate-message-in`. Sealed history entries must not.
- When streaming completes, the completed active turn transitions into sealed history without re-triggering entrance animations.

## Entry Classification

A **response turn** is the latest user prompt and the following assistant/tool sequence for that prompt.

While `isStreaming(tabId) === true`, treat the response turn as active.
Everything before that turn is sealed.

```ts
function getResponseTurnStartIndex(entries: ChatEntry[]): number {
  // Find the last user message that is followed by assistant/tool activity.
  let lastUserIndex = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].type === "message" && entries[i].message?.role === "user") {
      lastUserIndex = i;
      break;
    }
  }
  return lastUserIndex >= 0 ? lastUserIndex : entries.length;
}
```

This classification is intentionally tolerant of streaming text that is not yet followed by a user message (e.g., first message in a conversation), in which case there is no sealed history yet.

## Structural Memo for Sealed History

Create a memo that only recomputes when the sealed portion’s structure changes. In Solid, this means the memo must read the sealed entries slice but should not deeply access mutable content properties inside `produce`-mutated objects.

Because `ChatContext` stores entries in a Solid store and mutates nested `message.content` via `produce`, a structural memo that simply reads `entries.slice(0, turnStart)` will be notified on every content change even if the slice object itself is unchanged. To avoid that, derive a structural fingerprint that only considers:

- `entry.id`
- `entry.type`
- `entry.message.role` (if type is message)
- `entry.toolEvent.type` and `entry.toolEvent.status` (if type is tool_event)

The memo can then return the actual sealed entries for rendering while using the fingerprint as its dependency.

```ts
function sealedHistoryFingerprint(entries: ChatEntry[]): string {
  return entries
    .map((e) => {
      if (e.type === "message") return `${e.id}:msg:${e.message?.role ?? ""}`;
      return `${e.id}:tool:${e.toolEvent?.type ?? ""}:${e.toolEvent?.status ?? ""}`;
    })
    .join("|");
}
```

The sealed memo:

```ts
const sealedFingerprint = createMemo(() =>
  sealedHistoryFingerprint(sealedEntries()),
);
```

This memo recomputes only when the fingerprint changes, not when content mutates. The render path then uses the stable entries directly.

## Split Rendering in ChatArea

Replace:

```tsx
<Index each={grouped()}>
  ...
</Index>
```

With:

```tsx
<div class="flex-1 overflow-auto px-6 py-4">
  <SealedHistory entries={sealedEntries()} />
  <ActiveZone entries={activeEntries()} streaming={streaming()} />
</div>
```

`SealedHistory` groups sealed entries with `groupEntries()` and renders them with `<For>` keyed by `entry.id`. It passes `animate={false}` to `MessageBubble`.

`ActiveZone` groups active entries with `groupEntries()` and renders them from the live store. It passes `animate={true}` to `MessageBubble` for new entries.

## Animation Eligibility

Add an optional `animate` prop to `MessageBubble` (default `true` for backward compatibility).

```tsx
interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  isStreaming?: boolean;
  animate?: boolean; // default true
}
```

When `animate` is false, omit the `animate-message-in` class from the message wrapper.

## Tool Grouping Edge Case

`groupEntries()` absorbs empty assistant messages between tool events into the same tool group. This is safe because:

- Active zone grouping happens on the live entries slice, so tool activity during streaming is correctly grouped.
- Sealed history grouping happens on the sealed entries slice, so completed tool groups are correctly grouped.

No changes to `groupEntries()` are required.

## Auto-Scroll

The existing auto-scroll effect in `ChatArea` should continue to observe `isStreaming(tabId)` and scroll the container. The scroll trigger already uses `currentEntries.length`, `lastAssistantLength`, and `toolActivityKey`. With the split, the active zone still emits the same signals, so auto-scroll should work without modification.

## Files Modified

- `src/components/chat/ChatArea.tsx` — Add sealed/active split, structural memo, and zone components.
- `src/components/chat/MessageBubble.tsx` — Add `animate` prop and conditional animation class.

## Files Not Modified

- `src/context/ChatContext.tsx` — No store or event changes.
- `src/components/chat/groupEntries.ts` — No logic changes.
- `src/components/chat/MarkdownRenderer.tsx` — No changes.
- `src/components/chat/ToolActivitySummary.tsx` — No changes.
- `src/components/chat/ToolActivityLine.tsx` — No changes.
