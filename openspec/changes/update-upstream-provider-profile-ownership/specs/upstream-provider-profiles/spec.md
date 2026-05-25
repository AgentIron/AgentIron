## ADDED Requirements

### Requirement: Providers use upstream profiles
AgentIron SHALL construct built-in model providers through the upstream provider registry and SHALL NOT define built-in provider API families, auth header strategies, provider quirks, endpoint purpose, default provider headers, or `models.dev` aliases in AgentIron backend provider construction, except for explicitly documented temporary compatibility exceptions tracked upstream.

#### Scenario: Creating an upstream-backed provider
- **WHEN** an agent is created with a supported provider slug and valid credential state
- **THEN** AgentIron constructs the provider using the upstream provider registry for that slug

#### Scenario: Provider protocol metadata changes upstream
- **WHEN** upstream provider metadata changes for a built-in provider
- **THEN** AgentIron does not require backend provider profile code changes for API family, auth strategy, provider quirks, endpoint purpose, default provider headers, or `models.dev` aliases

#### Scenario: Temporary upstream compatibility gap
- **WHEN** AgentIron must keep an exposed provider working before `iron-providers` exposes the needed profile or runtime override API
- **THEN** AgentIron MAY define the narrow minimum local profile metadata required for that provider
- **AND** the exception SHALL be documented in code and tracked by an upstream `iron-providers` issue
- **AND** AgentIron SHALL remove the local metadata after upstream support lands

### Requirement: Provider slug is passed to core configuration
AgentIron SHALL pass the selected provider slug into `iron-core` agent configuration when creating an agent.

#### Scenario: Agent starts with provider-specific configuration
- **WHEN** an agent is created for a provider with upstream provider-specific behavior
- **THEN** `iron-core` receives the selected provider slug so it can apply that behavior

### Requirement: Local provider supports default and overrideable base URL
AgentIron SHALL expose a `local` provider that uses the upstream default local base URL unless the user has configured a `baseUrl` override for that provider.

#### Scenario: Local provider without override
- **WHEN** the user creates an agent with provider `local` and no configured `baseUrl`
- **THEN** AgentIron uses the upstream default local provider endpoint

#### Scenario: Local provider with override
- **WHEN** the user creates an agent with provider `local` and a configured `baseUrl`
- **THEN** AgentIron passes the configured `baseUrl` to backend provider construction and uses it for that local provider session

#### Scenario: Local provider override waits for upstream support
- **WHEN** upstream registry/runtime APIs do not support applying a per-session `local` base URL override
- **THEN** AgentIron MAY temporarily construct the overridden `local` session with narrow local profile metadata
- **AND** the exception SHALL be removed after upstream support exists

#### Scenario: Local provider remains single endpoint configuration
- **WHEN** the user configures local model support
- **THEN** AgentIron provides one overrideable `baseUrl` for the `local` provider rather than multiple named local provider endpoints

### Requirement: Ollama Cloud is upstream-backed
AgentIron SHALL expose `ollama-cloud` as a selectable provider backed by the upstream provider registry.

#### Scenario: Creating an Ollama Cloud provider
- **WHEN** the user creates an agent with provider `ollama-cloud` and valid credentials
- **THEN** AgentIron constructs the provider through the upstream provider registry without local protocol metadata for Ollama Cloud

### Requirement: Model catalog provider mapping is deterministic
AgentIron SHALL map model catalog provider identities deterministically when multiple upstream provider profiles reference the same external model catalog source.

#### Scenario: Shared external model catalog source
- **WHEN** multiple upstream provider profiles reference the same `models.dev` provider identity
- **THEN** AgentIron assigns catalog models to the intended AgentIron provider identity without relying on nondeterministic map iteration
