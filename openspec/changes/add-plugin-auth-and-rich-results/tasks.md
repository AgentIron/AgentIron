## 1. Backend Auth Surface

- [ ] 1.1 Add Tauri commands for getting auth prompts and starting and completing plugin auth flows
- [ ] 1.2 Wire the new commands to the active `iron-core` session and validate plugin state transitions
- [ ] 1.3 Forward `AuthStateChange` events from the worker to the frontend event layer

## 2. Rich Tool Event Plumbing

- [ ] 2.1 Extend backend tool-result event payloads to include `transcriptText` and `view`
- [ ] 2.2 Update frontend agent and chat event types to model auth and rich-result data explicitly
- [ ] 2.3 Normalize chat state updates so rich tool results and auth changes do not overwrite existing tool history incorrectly

## 3. Frontend UX

- [ ] 3.1 Add UI affordances for auth-required plugins and auth prompt handling
- [ ] 3.2 Implement structured renderers for status, progress, and todo-list rich views
- [ ] 3.3 Keep a safe JSON fallback for unsupported or malformed rich payloads

## 4. Verification

- [ ] 4.1 Verify authenticated plugin flows can start and complete through the UI
- [ ] 4.2 Verify rich plugin results render without losing transcript text
- [ ] 4.3 Build the Rust crate and frontend after the auth and renderer work lands
