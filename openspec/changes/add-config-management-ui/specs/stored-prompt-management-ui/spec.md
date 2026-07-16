## ADDED Requirements

### Requirement: Agents workspace SHALL expose stored-prompt management
AgentIron SHALL provide graphical listing, creation, editing, renaming, profile assignment, and deletion of core-owned stored prompts through typed backend commands.

#### Scenario: User opens prompt management
- **WHEN** the user selects Agents and opens Prompts while at least one valid profile exists
- **THEN** AgentIron displays valid prompt entries and per-record diagnostics returned by the backend
- **AND** the frontend does not parse raw ConfigDb prompt JSON

#### Scenario: User creates a stored prompt
- **WHEN** the user explicitly saves a valid new prompt form
- **THEN** AgentIron creates the prompt through a typed backend command
- **AND** refreshes prompt state after success

#### Scenario: User cancels prompt edits
- **WHEN** the user cancels a dirty prompt form
- **THEN** AgentIron discards unsaved changes
- **AND** does not issue a prompt mutation

### Requirement: Stored-prompt identity SHALL remain core-owned and stable
AgentIron SHALL preserve stable prompt IDs across edits and renames and SHALL defer normalized handle generation and collision enforcement to `iron-core`.

#### Scenario: User renames a prompt
- **WHEN** the user saves a new display name for an existing prompt
- **THEN** AgentIron uses the typed core rename or save operation
- **AND** retains the prompt's stable ID

#### Scenario: Normalized prompt name collides
- **WHEN** core rejects a create or rename because its normalized handle collides case-insensitively with another prompt
- **THEN** AgentIron displays the conflict on the name field
- **AND** retains the user's unsaved form values for correction

### Requirement: Stored prompts SHALL support optional profile assignment
AgentIron SHALL allow a stored prompt to reference zero or one valid agent profile by stable profile ID.

#### Scenario: User assigns a profile
- **WHEN** the user selects a profile and saves a prompt
- **THEN** AgentIron persists the selected stable profile ID through the typed prompt mutation

#### Scenario: User removes a profile assignment
- **WHEN** the user clears a prompt's profile assignment and saves
- **THEN** AgentIron persists the prompt without a profile reference

#### Scenario: Assigned profile is unavailable
- **WHEN** a prompt load diagnostic reports a missing or malformed referenced profile
- **THEN** AgentIron preserves the unresolved reference for display
- **AND** identifies the prompt as needing attention

### Requirement: Prompt deletion SHALL honor core dependency impacts
AgentIron SHALL present core-owned dependency impacts before prompt deletion and SHALL NOT cascade deletion into future automation or scheduling records.

#### Scenario: Prompt has dependent records
- **WHEN** core reports that another record references the prompt
- **THEN** AgentIron displays those dependencies
- **AND** blocks deletion until the references are resolved

#### Scenario: Prompt has no dependent records
- **WHEN** the user confirms deletion and core reports no blocking references
- **THEN** AgentIron deletes the prompt through a typed backend operation
- **AND** refreshes prompt state

### Requirement: Prompt diagnostics SHALL remain visible and actionable
AgentIron SHALL display malformed, unsupported, and needs-attention prompt diagnostics returned by core without attempting raw JSON repair.

#### Scenario: Core reports a malformed prompt
- **WHEN** prompt loading returns a malformed or unsupported record diagnostic
- **THEN** AgentIron displays the diagnostic and excludes the record from the normal editor
- **AND** offers deletion when the typed backend permits it

#### Scenario: Prompt references unknown skills
- **WHEN** a valid prompt contains requested skills unavailable in the current AgentIron catalog
- **THEN** AgentIron preserves those skill identifiers
- **AND** displays the applicable needs-attention diagnostic
