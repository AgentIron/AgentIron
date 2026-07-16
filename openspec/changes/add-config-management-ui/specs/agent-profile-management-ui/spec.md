## ADDED Requirements

### Requirement: Agents workspace SHALL expose agent-profile management
AgentIron SHALL activate the Agents workspace and provide graphical listing, creation, editing, and deletion of core-owned agent profiles through typed backend commands.

#### Scenario: User opens profile management
- **WHEN** the user selects Agents and opens Profiles
- **THEN** AgentIron displays valid profile entries and per-record diagnostics returned by the backend
- **AND** the frontend does not parse raw ConfigDb profile JSON

#### Scenario: User saves a profile
- **WHEN** the user explicitly saves a structurally valid profile form
- **THEN** AgentIron sends a typed profile mutation retaining the stable profile ID for edits
- **AND** refreshes profile state from the backend after success

#### Scenario: User cancels profile edits
- **WHEN** the user cancels a dirty profile form
- **THEN** AgentIron discards the unsaved form state
- **AND** does not issue a profile mutation

### Requirement: AgentIron SHALL use core-owned shipped profile seeding
AgentIron SHALL invoke the `iron-core` first-run seed operation for the ordinary shipped `explore`, `plan`, and `apply` profiles during secure shared-config initialization and SHALL NOT define or overwrite those profile payloads locally.

#### Scenario: Shared configuration starts for the first time
- **WHEN** shared configuration initializes successfully and the core seed marker is absent
- **THEN** AgentIron invokes core first-run profile seeding
- **AND** presents the resulting ordinary profile records without treating their names or IDs as runtime modes

#### Scenario: User edited or deleted a shipped profile
- **WHEN** normal startup occurs after first-run seeding
- **THEN** AgentIron does not overwrite an edited shipped profile
- **AND** does not silently recreate a deliberately deleted shipped profile

### Requirement: AgentIron SHALL prevent known zero-profile states
AgentIron SHALL reject profile deletions that would knowingly leave zero valid profiles and SHALL block normal profile and prompt management behind explicit recovery whenever the refreshed shared store contains zero valid profiles.

#### Scenario: User attempts to delete the last valid profile
- **WHEN** exactly one valid profile remains and the user requests its deletion
- **THEN** AgentIron rejects the deletion
- **AND** explains that at least one valid profile must remain

#### Scenario: Malformed records remain beside one valid profile
- **WHEN** one valid profile and any number of malformed profile records exist
- **AND** the user requests deletion of the valid profile
- **THEN** AgentIron treats the request as deletion of the last valid profile
- **AND** rejects it

#### Scenario: External client removes all valid profiles
- **WHEN** startup or refresh reports zero valid profiles
- **THEN** AgentIron blocks normal profile and prompt management
- **AND** offers an explicit Restore Default Profiles recovery action

#### Scenario: User restores default profiles
- **WHEN** the user invokes recovery
- **THEN** AgentIron calls the core restore-missing-defaults operation
- **AND** refreshes the workspace after the operation succeeds
- **AND** does not overwrite any existing valid shipped profile record

### Requirement: Profile management SHALL preserve portable references
AgentIron SHALL preserve structurally valid provider, model, tool, and skill identifiers that are unknown to the current AgentIron runtime and SHALL present core diagnostics without making machine-local availability a prerequisite for editing.

#### Scenario: Profile contains an unknown tool or skill
- **WHEN** AgentIron loads a valid profile containing a tool or skill identifier absent from its current catalog
- **THEN** the editor retains the identifier
- **AND** displays the applicable needs-attention diagnostic

#### Scenario: Profile contains an unavailable provider or model
- **WHEN** AgentIron loads a valid profile containing an unavailable provider or model reference
- **THEN** the editor preserves the reference
- **AND** does not silently replace it with a local selection

### Requirement: Profile diagnostics SHALL remain visible and actionable
AgentIron SHALL display malformed and unsupported profile diagnostics returned by core and SHALL NOT hide records by reserved-name conventions.

#### Scenario: Core reports a malformed profile
- **WHEN** profile loading returns a diagnostic for a malformed or unsupported record
- **THEN** AgentIron displays a diagnostic row with the core-provided explanation
- **AND** does not count the record as a valid profile

#### Scenario: User deletes a malformed record
- **WHEN** core permits deletion of a malformed profile record and the user confirms deletion
- **THEN** AgentIron deletes it through a typed backend operation
- **AND** refreshes diagnostics after success

### Requirement: Profile deletion SHALL honor core dependency impacts
AgentIron SHALL query and present core-owned dependency impacts before profile deletion and SHALL NOT cascade, reassign, or unassign dependent records automatically.

#### Scenario: Prompt references a profile
- **WHEN** the user requests deletion of a profile referenced by one or more stored prompts
- **THEN** AgentIron identifies the dependent prompts
- **AND** blocks deletion until the references are resolved

#### Scenario: Profile has no dependencies and is not the last valid profile
- **WHEN** the user confirms deletion of an unreferenced profile and another valid profile remains
- **THEN** AgentIron deletes the profile through the typed backend operation
- **AND** refreshes profile and prompt state
