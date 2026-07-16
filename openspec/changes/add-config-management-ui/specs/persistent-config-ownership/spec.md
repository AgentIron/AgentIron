## MODIFIED Requirements

### Requirement: Shared runtime config SHALL move behind iron-core APIs
AgentIron SHALL treat agent profiles, stored prompts, provider config, provider credentials, default model, custom models, MCP servers, skills settings, and handoff API/storage as shared runtime state owned by `iron-core`.

#### Scenario: AgentIron opens shared core config
- **WHEN** AgentIron initializes shared runtime config
- **THEN** AgentIron SHALL use the platform-default `iron-core` config path through `ConfigStore::open()` unless a concrete platform blocker requires a documented exception
- **AND** AgentIron SHALL NOT use an AgentIron GUI-specific core config path by default

#### Scenario: AgentIron reads shared runtime config
- **WHEN** AgentIron needs agent profiles, stored prompts, provider config, credentials, default model, custom models, MCP server definitions, skills settings, or handoff state
- **THEN** AgentIron SHALL read that state through backend commands backed by typed `iron-core` APIs
- **AND** the frontend SHALL NOT read that state directly from app-owned SQL tables or parse raw core record JSON

#### Scenario: AgentIron updates shared runtime config
- **WHEN** the user updates agent profiles, stored prompts, provider config, credentials, default model, custom models, MCP server definitions, skills settings, or handoff state
- **THEN** AgentIron SHALL persist the update through typed `iron-core` APIs
- **AND** AgentIron SHALL NOT write directly to the core config database with frontend SQL or arbitrary schema-versioned payloads

#### Scenario: CLI or headless mode uses shared config
- **WHEN** CLI/headless and AgentIron run against the same core config store
- **THEN** they SHALL observe the same agent profiles, stored prompts, provider config, credentials, default model, custom models, MCP servers, skills settings, and handoff state

#### Scenario: Credential encryption key is unavailable
- **WHEN** AgentIron cannot access or create the `iron-core` credential encryption key during shared-config initialization
- **THEN** AgentIron SHALL block all shared configuration loading and management rather than expose partially initialized profiles, prompts, providers, or credentials
- **AND** AgentIron SHALL display a helpful error that explains how to provide `AGENTIRON_CONFIG_ENCRYPTION_KEY` or fix OS keyring access
- **AND** the error SHALL NOT expose credential material
