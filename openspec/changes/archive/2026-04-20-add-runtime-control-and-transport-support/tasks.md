## 1. Prompt Control Plumbing

- [x] 1.1 Store active prompt control state in the worker so prompts can be cancelled safely
- [x] 1.2 Add a Tauri command for cancelling the active prompt on a tab
- [x] 1.3 Update frontend chat controls and state handling for cancelled prompts

## 2. Runtime Activity Events

- [x] 2.1 Forward `ScriptActivity` events from the worker to the frontend with a typed payload
- [x] 2.2 Extend frontend event types and chat state to track script activity separately from generic status updates
- [x] 2.3 Add concise UI rendering for in-flight and completed script activity

## 3. Transport Support (in-process only)

- [x] 3.1 Restrict frontend `Transport` type to `"in-process"` only
- [x] 3.2 Add backend validation in `create_agent` that rejects any transport other than `"in-process"`
- [x] 3.3 Update `AgentConfig` stub to reflect in-process-only transport

## 4. Verification

- [x] 4.1 Verify prompt cancellation behaves correctly during active and already-completed prompts
- [x] 4.2 Verify script activity events render without breaking existing tool activity summaries
- [x] 4.3 Verify the Rust crate and frontend build cleanly after all changes
