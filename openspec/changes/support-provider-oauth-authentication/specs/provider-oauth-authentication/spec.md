## ADDED Requirements

### Requirement: AgentIron SHALL store OAuth provider credentials separately from settings JSON
AgentIron SHALL persist OAuth provider credentials through a backend SQLite credential store that implements the `iron_core::provider_credential::ProviderCredentialStore` contract.

#### Scenario: OAuth credential is saved after token exchange
- **WHEN** a provider device-code flow completes successfully
- **THEN** AgentIron SHALL store the provider's OAuth token set in the backend credential store rather than in the normal settings JSON blob

#### Scenario: Existing API keys remain in provider settings
- **WHEN** this change is applied to an installation with existing provider API keys
- **THEN** AgentIron SHALL continue reading those API keys from the existing provider settings without migrating them

### Requirement: AgentIron SHALL use explicit API keys before OAuth credentials
AgentIron SHALL prefer a non-empty configured API key over any stored OAuth credential for the same provider.

#### Scenario: Provider has both API key and OAuth credential
- **WHEN** AgentIron creates an agent for a provider with a non-empty API key and a stored OAuth credential
- **THEN** AgentIron SHALL resolve the provider credential as an API-key credential

#### Scenario: Provider has OAuth credential and no API key
- **WHEN** AgentIron creates an agent for a provider with no non-empty API key and a stored OAuth credential
- **THEN** AgentIron SHALL resolve the provider credential as an OAuth bearer credential

### Requirement: AgentIron SHALL expose device-code OAuth provider commands
AgentIron SHALL expose Tauri commands for starting a provider device-code flow, polling the token exchange, disconnecting OAuth, and retrieving provider auth status.

#### Scenario: User starts device-code OAuth
- **WHEN** the frontend requests OAuth connection for a supported provider
- **THEN** the backend SHALL return the verification URI, user code, expiry, polling interval, and device code required for frontend polling

#### Scenario: Frontend polls OAuth token exchange
- **WHEN** the frontend submits a provider slug and device code for polling
- **THEN** the backend SHALL poll the provider token endpoint through `iron-core` and store the OAuth credential on success

#### Scenario: User disconnects OAuth
- **WHEN** the frontend requests OAuth disconnect for a provider
- **THEN** AgentIron SHALL remove only the stored OAuth credential for that provider and SHALL NOT clear any configured API key

#### Scenario: Frontend requests provider auth status
- **WHEN** the frontend requests auth status for a provider
- **THEN** the backend SHALL return a sanitized status that does not include secret token material

### Requirement: AgentIron SHALL load provider auth status before automatic session creation
AgentIron SHALL wait for provider auth status loading before automatically creating the default agent session at startup.

#### Scenario: Default provider is OAuth-connected
- **WHEN** settings are loaded and the default provider has a usable OAuth credential but no API key
- **THEN** AgentIron SHALL treat the provider as configured and may create the default agent session

#### Scenario: Default provider status is not configured
- **WHEN** settings and provider auth status are loaded and the default provider has no API key or usable OAuth credential
- **THEN** AgentIron SHALL NOT create the default agent session automatically

### Requirement: AgentIron SHALL refresh OAuth access tokens during provider resolution
AgentIron SHALL use `iron-core` credential resolution so expired or near-expiry OAuth access tokens are refreshed automatically before provider construction when possible.

#### Scenario: OAuth access token needs refresh
- **WHEN** AgentIron creates an agent for a provider with a stored OAuth credential whose access token is expired or near expiry
- **THEN** AgentIron SHALL attempt to refresh the access token through `iron-core` before constructing the provider

#### Scenario: OAuth refresh fails
- **WHEN** token refresh fails or the credential is revoked
- **THEN** AgentIron SHALL surface an actionable auth status or error without exposing secret token material

### Requirement: AgentIron SHALL construct providers through the upstream provider registry
AgentIron SHALL construct providers using `iron_providers::ProviderRegistry::default()` and `RuntimeConfig::from_credential(...)` after resolving credentials.

#### Scenario: Codex provider is selected
- **WHEN** AgentIron creates an agent for the `codex` provider with a valid OAuth credential
- **THEN** AgentIron SHALL construct the provider through the upstream registry rather than a manual local provider profile

#### Scenario: Kimi Code provider is selected
- **WHEN** AgentIron creates an agent for the `kimi-code` provider
- **THEN** AgentIron SHALL use the upstream registry profile that supports API-key and OAuth bearer credential modes

### Requirement: AgentIron SHALL include Codex in provider selection
AgentIron SHALL expose `codex` as an OAuth-capable provider in provider settings and model/provider selection surfaces.

#### Scenario: User views provider settings
- **WHEN** provider settings are rendered
- **THEN** `codex` SHALL be available as a provider that uses OAuth credentials

#### Scenario: User selects a Codex model
- **WHEN** the user selects a model associated with the `codex` provider
- **THEN** AgentIron SHALL use the `codex` provider slug for auth status and provider construction

### Requirement: AgentIron SHALL keep provider-specific OAuth research separate from app integration
AgentIron SHALL treat provider-specific OAuth endpoint, client ID, and protocol validation as separate from the AgentIron app-integration work in this change.

#### Scenario: Provider OAuth metadata needs correction
- **WHEN** Kimi or Codex OAuth metadata is found to be incorrect during validation
- **THEN** the correction SHALL be tracked under provider-flow research or upstream provider/core work rather than expanding this AgentIron integration scope

### Requirement: AgentIron SHALL track OS secure storage as follow-up work
AgentIron SHALL create a follow-up issue for moving provider secrets from SQLite to OS-backed secure storage.

#### Scenario: OAuth integration change is prepared
- **WHEN** this change is implemented
- **THEN** a follow-up issue SHALL exist for evaluating and implementing platform secret storage for provider credentials
