## ADDED Requirements

### Requirement: AgentIron SHALL configure and register runtime plugins
AgentIron SHALL allow users to define plugin sources and SHALL register those plugins with `iron-core` before creating a session that may use them.

#### Scenario: Configured plugins are loaded into the runtime
- **WHEN** a tab creates an agent with one or more valid plugin configurations
- **THEN** the backend registers those plugins with the `iron-core` runtime before the session becomes available

#### Scenario: Invalid plugin configuration is rejected
- **WHEN** a plugin configuration is missing required source information or fails runtime validation
- **THEN** AgentIron SHALL return a user-visible error that identifies the failing plugin and the validation problem

### Requirement: AgentIron SHALL expose plugin inventory and status
AgentIron SHALL provide a queryable plugin inventory that includes plugin identity, runtime health, session enablement, and summarized availability.

#### Scenario: Frontend requests plugin inventory
- **WHEN** the frontend requests plugin status for an active tab
- **THEN** the backend SHALL return all registered plugins with enough status information to render a management UI

#### Scenario: Plugin status changes after registration
- **WHEN** a plugin's runtime status changes between queries
- **THEN** a subsequent inventory request SHALL return the updated status without requiring an agent restart

### Requirement: AgentIron SHALL support per-session plugin enablement
AgentIron SHALL allow each session to enable or disable registered plugins independently of the runtime inventory.

#### Scenario: User enables a plugin for the current session
- **WHEN** the frontend requests that a plugin be enabled for the active tab
- **THEN** AgentIron SHALL update that session's plugin enablement without changing other tabs

#### Scenario: User disables a plugin for the current session
- **WHEN** the frontend requests that a plugin be disabled for the active tab
- **THEN** AgentIron SHALL remove that plugin from the session's effective tool set for future prompts

### Requirement: AgentIron SHALL provide a plugin management UI
AgentIron SHALL provide a settings surface where users can review configured plugins, inspect status, and control session enablement.

#### Scenario: Plugins settings are opened
- **WHEN** the user opens the Plugins settings section
- **THEN** AgentIron SHALL display plugin inventory instead of a placeholder-only message

#### Scenario: No plugins are configured
- **WHEN** the plugin inventory is empty
- **THEN** AgentIron SHALL show an empty state that explains how to add a plugin configuration
