## ADDED Requirements

### Requirement: AgentIron SHALL expose the skill catalog and diagnostics
AgentIron SHALL allow the frontend to query discovered skills and the diagnostics produced during skill catalog refresh.

#### Scenario: Skill catalog is requested
- **WHEN** the frontend requests the available skill catalog for an active tab
- **THEN** AgentIron SHALL return discovered skills with metadata sufficient to show origin and activation suitability

#### Scenario: Discovery produced warnings
- **WHEN** skill refresh yields diagnostics such as hidden project skills or parse failures
- **THEN** AgentIron SHALL return those diagnostics without silently discarding them

### Requirement: AgentIron SHALL support session skill activation
AgentIron SHALL allow each session to activate and deactivate available skills independently.

#### Scenario: User activates a skill
- **WHEN** the frontend requests activation of a discovered skill for the active tab
- **THEN** AgentIron SHALL activate that skill only for that session

#### Scenario: User deactivates a skill
- **WHEN** the frontend requests deactivation of an active skill for the active tab
- **THEN** AgentIron SHALL remove that skill from the session's active skill set

### Requirement: AgentIron SHALL make project skill trust explicit
AgentIron SHALL expose whether project-level skills are trusted and SHALL allow users to opt into project skill discovery intentionally.

#### Scenario: Project skill trust is disabled
- **WHEN** project skills exist in the workspace and trust is disabled
- **THEN** AgentIron SHALL indicate that project skills are hidden rather than presenting an empty catalog with no explanation

#### Scenario: Project skill trust is enabled
- **WHEN** the user enables trust for project skills
- **THEN** a skill catalog refresh SHALL include eligible project-level skills from the workspace roots

### Requirement: AgentIron SHALL support session handoff export and import
AgentIron SHALL allow users to export a portable handoff bundle from an idle session and import a handoff bundle into a new session.

#### Scenario: User exports handoff from an idle session
- **WHEN** the frontend requests handoff export for an idle session
- **THEN** AgentIron SHALL return the `iron-core` handoff bundle for that session

#### Scenario: User attempts handoff export during an active prompt
- **WHEN** the frontend requests handoff export while the session is not idle
- **THEN** AgentIron SHALL reject the request with a user-visible error

#### Scenario: User imports a valid handoff bundle
- **WHEN** the frontend submits a valid handoff bundle for import
- **THEN** AgentIron SHALL create a session initialized from that bundle
