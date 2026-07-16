## Why

AgentIron cannot currently manage the agent profiles, stored prompts, and provider credentials held in the shared `iron-core` configuration store. Issue #54 needs a graphical management surface that remains a thin, secret-safe adapter over core-owned typed contracts and gives users a recoverable, tested configuration experience.

## What Changes

- Activate the existing Agents workspace with graphical editors for agent profiles and stored prompts.
- Seed the ordinary `iron-core` shipped profiles (`explore`, `plan`, and `apply`) on first run and prevent AgentIron operations from knowingly leaving the shared store without a valid profile.
- Provide explicit recovery through the core restore-missing-defaults operation when external changes leave no valid profiles.
- Add typed Tauri adapters for profile, prompt, delete-impact, diagnostics, and credential-management operations without exposing raw schema JSON to frontend code.
- Replace saved API-key roundtripping with explicit secret-safe set, replace, and delete operations in Settings > Providers.
- Block all shared configuration management with an actionable, secret-safe error when core credential encryption initialization fails.
- Add frontend component-integration tests for navigation, forms, validation, mutation flows, recovery, conflicts, redaction, and error states.
- Keep profile application to chats, prompt preview/execution, live database watching, terminal UI, automation tasks, and scheduling out of scope.

## Capabilities

### New Capabilities

- `agent-profile-management-ui`: Graphical agent-profile listing, editing, diagnostics, first-run seeding, nonzero-profile protection, and explicit recovery.
- `stored-prompt-management-ui`: Graphical stored-prompt CRUD, stable identity, normalized-name conflicts, profile assignment, diagnostics, and delete-impact handling.
- `provider-credential-management-ui`: Secret-safe provider API-key and OAuth credential status management within the existing Providers settings surface.

### Modified Capabilities

- `persistent-config-ownership`: Classify agent profiles and stored prompts as shared core-owned configuration and define blocking behavior when shared configuration cannot initialize securely.

## Impact

- New typed Tauri command adapters over `iron_core::management::ConfigManagementService` and core default-profile seeding APIs.
- Agents navigation, workspace components, frontend command types, and shared configuration state management.
- Existing Providers settings and credential mutation flows; saved API keys will no longer be returned to JavaScript.
- Existing shared-config initialization and migration-marker handling.
- Frontend development dependencies, test configuration, test scripts, and CI verification.
- Rust adapter tests plus Solid component-integration tests with mocked Tauri command boundaries.
