## ADDED Requirements

### Requirement: AgentIron SHALL support prompt cancellation
AgentIron SHALL allow users to cancel an active prompt and SHALL propagate that request to the active `iron-core` prompt handle.

#### Scenario: User cancels an active prompt
- **WHEN** the user requests cancellation while a prompt is running
- **THEN** AgentIron SHALL invoke prompt cancellation and stop presenting the prompt as actively streaming

#### Scenario: User cancels after completion
- **WHEN** the user requests cancellation after the prompt has already completed
- **THEN** AgentIron SHALL handle the request safely without corrupting session state

### Requirement: AgentIron SHALL surface script activity events
AgentIron SHALL forward embedded Python script activity events to the frontend in a typed form.

#### Scenario: Script execution emits activity events
- **WHEN** `iron-core` emits `ScriptActivity` during a prompt
- **THEN** AgentIron SHALL forward the activity type, status, and detail fields to the frontend

#### Scenario: Chat UI receives script activity events
- **WHEN** the frontend receives script activity for a tool call
- **THEN** it SHALL render that activity without losing the underlying tool call and result association

### Requirement: AgentIron SHALL enforce in-process transport
AgentIron SHALL accept an in-process transport parameter during agent creation and SHALL reject any non-in-process transport configuration.

#### Scenario: User creates an agent with in-process transport
- **WHEN** an agent is created with in-process transport
- **THEN** AgentIron SHALL create the current embedded runtime-backed session and report the transport accurately in agent metadata

#### Scenario: User selects an unsupported transport configuration
- **WHEN** an agent creation request uses a transport mode other than in-process
- **THEN** AgentIron SHALL reject the request with a clear validation error
