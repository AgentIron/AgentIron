## ADDED Requirements

### Requirement: Persistent state ownership SHALL be explicit
AgentIron SHALL classify persistent state as either shared `iron-core` runtime state, AgentIron desktop/frontend state, removable unused state, or out-of-scope ephemeral state before migrating config persistence.

#### Scenario: Inventory is reviewed
- **WHEN** AgentIron's persistent state is reviewed for issue 56
- **THEN** the inventory SHALL include `sqlite:agentiron.db` settings, provider credentials, schema-only tables, and user-selected handoff bundle files
- **AND** the inventory SHALL exclude ephemeral frontend stores, runtime status caches, temporary snip files, and Tauri app configuration from core config migration scope

### Requirement: Shared runtime config SHALL move behind iron-core APIs
AgentIron SHALL treat provider config, provider credentials, default model, custom models, MCP servers, skills settings, and handoff API/storage as shared runtime state owned by `iron-core`.

#### Scenario: AgentIron opens shared core config
- **WHEN** AgentIron initializes shared runtime config
- **THEN** AgentIron SHALL use the platform-default `iron-core` config path through `ConfigStore::open()` unless a concrete platform blocker requires a documented exception
- **AND** AgentIron SHALL NOT use an AgentIron GUI-specific core config path by default

#### Scenario: AgentIron reads shared runtime config
- **WHEN** AgentIron needs provider config, credentials, default model, custom models, MCP server definitions, skills settings, or handoff state
- **THEN** AgentIron SHALL read that state through backend commands backed by `iron-core` APIs
- **AND** the frontend SHALL NOT read that state directly from app-owned SQL tables

#### Scenario: AgentIron updates shared runtime config
- **WHEN** the user updates provider config, credentials, default model, custom models, MCP server definitions, skills settings, or handoff state
- **THEN** AgentIron SHALL persist the update through `iron-core` APIs
- **AND** AgentIron SHALL NOT write directly to the core config database with frontend SQL

#### Scenario: CLI or headless mode uses shared config
- **WHEN** CLI/headless and AgentIron run against the same core config store
- **THEN** they SHALL observe the same provider config, credentials, default model, custom models, MCP servers, skills settings, and handoff state

#### Scenario: Credential encryption key is unavailable
- **WHEN** AgentIron cannot access or create the `iron-core` credential encryption key during settings load
- **THEN** AgentIron SHALL block settings load rather than silently degrading credential behavior
- **AND** AgentIron SHALL display a helpful error that explains how to provide `AGENTIRON_CONFIG_ENCRYPTION_KEY` or fix OS keyring access
- **AND** the error SHALL NOT expose credential material

### Requirement: AgentIron-specific persistence SHALL remain app-owned
AgentIron SHALL keep desktop/frontend-specific persistent state in AgentIron-owned persistence rather than migrating it to `iron-core` config APIs.

#### Scenario: Desktop preference is persisted
- **WHEN** AgentIron persists theme, autostart preference, quick-launch shortcut, starred models, user profile, model registry cache, or Tauri-specific data
- **THEN** AgentIron SHALL store that state in AgentIron-owned persistence
- **AND** `iron-core` SHALL NOT be required to understand that state

#### Scenario: Model registry cache remains app-owned
- **WHEN** AgentIron caches fetched external model registry data for this change
- **THEN** AgentIron SHALL keep that cache in AgentIron-owned persistence
- **AND** model registry ownership refactoring SHALL remain out of scope for issue 56 and be tracked by AgentIron/AgentIron#57

#### Scenario: Tauri configuration is maintained
- **WHEN** AgentIron changes Tauri app configuration, capabilities, plugins, OS-shell integrations, or frontend-only UI behavior
- **THEN** those changes SHALL remain AgentIron-owned and out of scope for core config migration

### Requirement: Unused scheduled task schema SHALL be removed
AgentIron SHALL remove the unused `scheduled_tasks` schema rather than migrating it to `iron-core` as part of issue 56.

#### Scenario: Persistence schema is cleaned up
- **WHEN** AgentIron migrates persistent config ownership
- **THEN** the unused `scheduled_tasks` schema SHALL be removed from AgentIron-owned persistence
- **AND** no scheduled task data SHALL be migrated unless a separate future change introduces active scheduling behavior

### Requirement: AgentIron-only schema SHALL remain AgentIron-owned
AgentIron SHALL keep schema-only `agent_configs`, `conversations`, and `messages` tables under AgentIron ownership for this change.

#### Scenario: Schema-only tables are evaluated
- **WHEN** the migration evaluates schema-only AgentIron tables
- **THEN** `agent_configs`, `conversations`, and `messages` SHALL remain AgentIron-owned
- **AND** they SHALL NOT be moved to `iron-core` by issue 56

### Requirement: Existing persisted data SHALL migrate without loss
AgentIron SHALL preserve existing user configuration when moving core-owned settings out of AgentIron-owned persistence.

#### Scenario: Existing user has provider settings
- **WHEN** an existing AgentIron installation contains provider config, credentials, default model, custom models, MCP servers, or skills settings in `agentiron.db`
- **THEN** AgentIron SHALL migrate those values into `iron-core` config storage without losing user configuration
- **AND** AgentIron SHALL continue to preserve app-owned settings such as theme, autostart preference, quick-launch shortcut, starred models, and user profile

#### Scenario: Core config already contains migrated state
- **WHEN** migration finds an existing `iron-core` record corresponding to an old AgentIron setting
- **THEN** migration SHALL preserve the existing `iron-core` value by default
- **AND** migration SHALL NOT overwrite core config with stale AgentIron settings unless a future explicit recovery flow requests it

#### Scenario: Migration completion is recorded
- **WHEN** migration finishes moving core-owned state
- **THEN** AgentIron SHALL record migration completion in `iron-core` config storage
- **AND** AgentIron SHALL NOT rely only on the old AgentIron settings table to determine whether core migration completed

#### Scenario: Existing default model is invalid
- **WHEN** an existing AgentIron default model is not present in the `iron-core` effective model catalog during migration
- **THEN** AgentIron SHALL skip migrating that default model
- **AND** AgentIron SHALL continue migrating other valid state
- **AND** AgentIron SHALL fall back to core/default model behavior

#### Scenario: Migrated keys are cleaned up
- **WHEN** a core-owned setting has been successfully migrated to `iron-core`
- **THEN** AgentIron SHALL delete the migrated core-owned key from AgentIron settings persistence immediately

#### Scenario: Local provider remains implicit
- **WHEN** AgentIron migrates provider config
- **THEN** AgentIron SHALL keep the `local` provider implicit by default
- **AND** migration SHALL NOT create a persisted `local` provider config unless explicit user state requires it
