## ADDED Requirements

### Requirement: Provider settings SHALL expose secret-safe credential status
AgentIron SHALL display provider credential kind, configured status, OAuth status, and other core-approved metadata without returning or rendering persisted secret material.

#### Scenario: Provider has a saved API key
- **WHEN** provider settings load a credential summary for an API-key credential
- **THEN** the UI indicates that an API key is configured
- **AND** neither the backend response nor frontend state contains the saved API-key value

#### Scenario: Provider has OAuth credentials
- **WHEN** provider settings load OAuth credential status
- **THEN** the UI displays connection and effective-authentication status using secret-safe metadata
- **AND** does not expose access tokens, refresh tokens, or bearer credentials

### Requirement: API-key mutation SHALL use explicit typed operations
AgentIron SHALL add, replace, and delete API-key credentials through dedicated typed core-backed commands rather than persisting secret values in whole-provider settings payloads.

#### Scenario: User adds an API key
- **WHEN** no API-key credential exists and the user submits a non-empty API key
- **THEN** AgentIron invokes the typed set-credential command
- **AND** clears the write-only input after success
- **AND** refreshes credential status

#### Scenario: User replaces an API key
- **WHEN** an API-key credential exists and the user submits a replacement
- **THEN** AgentIron labels the operation as replacement
- **AND** invokes the typed set-credential command without loading the previous key

#### Scenario: User deletes an API key
- **WHEN** the user confirms API-key deletion
- **THEN** AgentIron invokes the typed delete-credential command
- **AND** refreshes provider credential and readiness status

### Requirement: Provider configuration and credentials SHALL have independent lifecycles
AgentIron SHALL NOT implicitly delete a provider credential when provider configuration is removed and SHALL NOT remove provider configuration when a credential is deleted.

#### Scenario: User removes provider configuration
- **WHEN** the user removes or disables a provider configuration
- **THEN** AgentIron preserves any stored provider credential
- **AND** makes credential removal a separate explicit action

#### Scenario: User removes a credential
- **WHEN** the user deletes a provider credential
- **THEN** AgentIron preserves non-secret provider configuration
- **AND** updates readiness to reflect the missing credential

### Requirement: Effective authentication mode SHALL be understandable
AgentIron SHALL show which authentication mode is effective when a provider supports both API-key and OAuth credentials and SHALL preserve core-owned precedence semantics.

#### Scenario: API key and OAuth are both configured
- **WHEN** core status reports both credential modes and API-key precedence
- **THEN** AgentIron identifies API key as the effective mode
- **AND** explains that the OAuth connection remains stored but is not currently used

#### Scenario: API key is removed while OAuth remains connected
- **WHEN** the user deletes the API key and OAuth status remains usable
- **THEN** AgentIron refreshes status
- **AND** displays OAuth as the effective mode

### Requirement: Credential failures SHALL remain secret-safe
AgentIron SHALL display actionable credential mutation and status errors without logging, retaining, or rendering submitted or persisted secret values.

#### Scenario: API-key mutation fails
- **WHEN** setting or deleting an API key fails
- **THEN** AgentIron displays a provider-specific error without secret material
- **AND** does not report the failed mutation as configured
