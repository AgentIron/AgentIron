## 1. Backend Skill Support

- [ ] 1.1 Add skill catalog, diagnostics, activation, and deactivation commands to the Tauri backend
- [ ] 1.2 Configure AgentIron skill settings explicitly, including project-skill trust and refresh behavior
- [ ] 1.3 Return active-skill state in a form the frontend can render per session

## 2. Backend Handoff Support

- [ ] 2.1 Add Tauri commands for exporting a handoff bundle from an idle session
- [ ] 2.2 Add a Tauri command for importing a handoff bundle into a new session
- [ ] 2.3 Validate handoff import and export error cases clearly for the UI

## 3. Frontend UX

- [ ] 3.1 Add a skill management UI that shows available skills, origins, diagnostics, and activation state
- [ ] 3.2 Add a user-facing project-skill trust control with explanatory copy
- [ ] 3.3 Add handoff export and import actions in the chat or session UI

## 4. Verification

- [ ] 4.1 Verify user and project skills appear according to trust settings
- [ ] 4.2 Verify skill activation changes only affect the active tab
- [ ] 4.3 Verify handoff export and import work across sessions and build cleanly
