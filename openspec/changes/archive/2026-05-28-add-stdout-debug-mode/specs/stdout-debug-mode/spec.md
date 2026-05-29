## ADDED Requirements

### Requirement: AgentIron SHALL support global stdout debug mode
AgentIron SHALL provide a global app debug mode that is enabled at process startup and applies to all `IronAgent` instances created during that app process.

#### Scenario: Debug mode is enabled before creating an agent
- **WHEN** AgentIron starts with debug mode enabled and an agent is created
- **THEN** AgentIron SHALL attach an `iron_core::DebugSink` to that agent before normal tool, MCP, session, prompt, or skill activity occurs

#### Scenario: Debug mode is disabled by default
- **WHEN** AgentIron starts without debug mode enabled
- **THEN** AgentIron SHALL create agents without attaching an app debug sink

### Requirement: AgentIron SHALL print debug events to stdout
AgentIron SHALL print events received from the `iron-core` debug sink to stdout in a human-readable format suitable for terminal inspection.

#### Scenario: A debug event is emitted
- **WHEN** an attached debug sink receives an `iron_core::DebugEvent`
- **THEN** AgentIron SHALL print a human-readable line or block to stdout that includes the event sequence, severity, timestamp, available scope identifiers, payload family, event kind, and key redacted metadata

#### Scenario: A future debug payload is encountered
- **WHEN** AgentIron receives a debug event variant that does not have a custom formatter
- **THEN** AgentIron SHALL still print a readable fallback representation instead of dropping the event

### Requirement: AgentIron SHALL keep stdout debug mode operational only
AgentIron SHALL NOT persist debug mode or expose it as user-facing app configuration in this change.

#### Scenario: Debug mode is enabled
- **WHEN** AgentIron runs with debug mode enabled
- **THEN** AgentIron SHALL NOT write a debug log file, create or update a persisted settings value, require a database migration, or expose an in-app debug log viewer

#### Scenario: Settings are loaded
- **WHEN** frontend settings are loaded from the settings store
- **THEN** debug mode SHALL NOT be represented as a setting in `AppSettings`
