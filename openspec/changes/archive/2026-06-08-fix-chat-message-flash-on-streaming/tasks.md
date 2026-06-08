# Tasks: Fix Chat Message Flash on Streaming

## Task 1: Add `animate` prop to `MessageBubble`
- [x] Modify `src/components/chat/MessageBubble.tsx` to accept an optional `animate` prop.
- [x] Default `animate` to `true` for backward compatibility.
- [x] When `animate` is `false`, omit the `animate-message-in` class from message wrappers.

## Task 2: Implement structural memo for sealed history
- [x] In `src/components/chat/ChatArea.tsx`, add `getResponseTurnStartIndex()` to classify active vs sealed entries.
- [x] Add `sealedHistoryFingerprint()` to compute a structural hash that ignores message content.
- [x] Create a `createMemo` that only recomputes when the sealed fingerprint changes.

## Task 3: Split ChatArea rendering into sealed and active zones
- [x] Replace the single `<Index each={grouped()}>` with two separate rendering zones.
- [x] `SealedHistory` zone: renders sealed entries with `<For>` keyed by `entry.id`, passing `animate={false}`.
- [x] `ActiveZone` zone: renders the current response turn from the live store, passing `animate={true}`.
- [x] Ensure tool grouping still works in both zones by calling `groupEntries()` on the respective slices.

## Task 4: Preserve auto-scroll behavior
- [x] Verify the existing scroll effect still triggers correctly on streaming content changes.
- [x] No changes needed if scroll signals remain the same; if not, adjust scroll dependencies to observe active zone.

## Task 5: Validate and test
- [x] Run `pnpm lint`.
- [x] Run `pnpm exec tsc --noEmit`.
- [x] Run `pnpm build`.
- [x] Manual test: send a message in a conversation with prior messages, verify past messages do not flash during streaming.
- [x] Manual test: verify new messages still animate when they first appear.
- [x] Manual test: verify auto-scroll still works during streaming.
