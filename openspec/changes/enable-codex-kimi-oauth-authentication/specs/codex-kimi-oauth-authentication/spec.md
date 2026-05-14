## ADDED Requirements

### Requirement: AgentIron SHALL authenticate Codex with validated OAuth credentials
AgentIron SHALL allow a user to connect the `codex` provider with a validated device-code OAuth flow and create a working Codex-backed agent without an API key.

#### Scenario: User connects Codex OAuth
- **WHEN** the user starts OAuth connection for the `codex` provider
- **THEN** AgentIron SHALL use provider metadata validated against Codex/OpenAI device-code OAuth behavior to produce a user-authorizable login interaction

#### Scenario: Codex token is accepted by provider API
- **WHEN** Codex OAuth completes and AgentIron creates an agent for a Codex model
- **THEN** the provider SHALL send a basic prompt request to the Codex backend using the OAuth bearer credential and receive an authenticated provider response

#### Scenario: Codex auth metadata is incorrect
- **WHEN** validation proves the current Codex OAuth metadata or provider profile is incorrect
- **THEN** the correction SHALL be made in `iron-core` or `iron-providers` and AgentIron SHALL consume the corrected upstream contract

### Requirement: AgentIron SHALL authenticate Kimi Code with validated OAuth credentials
AgentIron SHALL allow a user to connect the `kimi-code` provider with a validated device-code OAuth flow and create a working Kimi Code-backed agent without an API key.

#### Scenario: User connects Kimi Code OAuth
- **WHEN** the user starts OAuth connection for the `kimi-code` provider
- **THEN** AgentIron SHALL use provider metadata validated against Kimi Code device-code OAuth behavior to produce a user-authorizable login interaction

#### Scenario: Kimi Code token is accepted by provider API
- **WHEN** Kimi Code OAuth completes and AgentIron creates an agent for a Kimi Code model without an API key
- **THEN** the provider SHALL send a basic prompt request to the Kimi Code API using the OAuth bearer credential and receive an authenticated provider response

#### Scenario: Tool calls are not required for OAuth validation
- **WHEN** Kimi Code or Codex OAuth validation is performed for this change
- **THEN** tool-call and streaming-specific behavior SHALL NOT be required to close the OAuth validation work

#### Scenario: Kimi Code API key is configured
- **WHEN** Kimi Code has both a non-empty API key and a stored OAuth credential
- **THEN** AgentIron SHALL resolve the provider credential as an API-key credential and preserve existing API-key behavior

### Requirement: Provider-specific OAuth behavior SHALL remain outside AgentIron UI logic
AgentIron SHALL rely on `iron-core` and `iron-providers` for provider-specific OAuth metadata, credential resolution, provider profile behavior, and wire-auth construction.

#### Scenario: Provider requires corrected endpoint or client metadata
- **WHEN** Codex or Kimi Code requires endpoint, client ID, scope, grant, or token-refresh corrections
- **THEN** those corrections SHALL be represented in upstream provider/core metadata rather than hardcoded in AgentIron frontend components

#### Scenario: Provider requires request routing metadata
- **WHEN** Codex or Kimi Code requires provider-specific request headers or account routing metadata derived from tokens
- **THEN** that request behavior SHALL be implemented in `iron-providers` without exposing secret token material to AgentIron UI state

### Requirement: OAuth validation SHALL avoid storing or exposing secrets
Validation for Codex and Kimi Code OAuth SHALL avoid committing, logging, or publishing OAuth secrets, tokens, account IDs, or refresh-token material.

#### Scenario: Manual validation is documented
- **WHEN** a provider requires real-account validation
- **THEN** the validation steps SHALL reference local environment variables or operator-provided credentials and SHALL redact secret token material from artifacts and issue comments

#### Scenario: Automated tests cover provider semantics
- **WHEN** provider-specific OAuth behavior can be represented with mocked HTTP responses
- **THEN** tests SHALL validate metadata handling, token exchange semantics, mocked refresh behavior, credential-mode support, or wire-auth construction without using real secrets

#### Scenario: Live refresh is deferred
- **WHEN** refresh behavior is validated for this change
- **THEN** mocked refresh validation SHALL be sufficient and live long-running refresh validation MAY be tracked as follow-up work

### Requirement: Provider-specific findings SHALL be documented and linked
Provider-specific OAuth findings for Codex and Kimi Code SHALL be captured so future AgentIron, `iron-core`, and `iron-providers` changes can preserve the validated behavior.

#### Scenario: OAuth behavior is confirmed
- **WHEN** Codex or Kimi Code OAuth behavior is validated
- **THEN** the confirmed endpoints, public client metadata, credential modes, token semantics, and request-auth behavior SHALL be documented in the change artifacts or linked upstream issues

#### Scenario: Upstream issue or release is needed
- **WHEN** validation requires changes in `iron-core` or `iron-providers`
- **THEN** AgentIron SHALL link the relevant upstream issue, PR, version, or Git revision before closing AgentIron issue #23

#### Scenario: Upstream issue is blocking
- **WHEN** an upstream issue prevents device-code connect, token exchange, provider construction, or a basic authenticated prompt
- **THEN** AgentIron issue #23 SHALL remain open until the blocking issue is resolved or explicitly rescoped

#### Scenario: Upstream issue is non-blocking
- **WHEN** an upstream issue affects refresh edge cases, richer metadata, documentation, non-basic prompt behavior, or long-term hardening
- **THEN** AgentIron SHALL file and link the issue without blocking completion of this change
