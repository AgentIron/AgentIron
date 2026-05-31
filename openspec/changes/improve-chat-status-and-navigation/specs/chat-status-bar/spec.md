## ADDED Requirements

### Requirement: AgentIron SHALL provide a compact bottom status bar below the message list and above the text input.

The bottom bar SHALL be always visible, small, and unobtrusive. It SHALL be divided into three zones: switchable settings on the left, an animated status indicator in the center, and clickable sidebar toggle icons on the right.

#### Scenario: Bottom bar is visible during chat
- **WHEN** the user is on the chat view
- **THEN** the bottom status bar SHALL be rendered between the message list and the text input area

#### Scenario: Bottom bar layout — left zone
- **WHEN** the bottom bar is rendered
- **THEN** the left zone SHALL contain the current directory picker, current model switcher, and (when supported in a future change) reasoning effort control

#### Scenario: Bottom bar layout — center zone
- **WHEN** the bottom bar is rendered
- **THEN** the center zone SHALL display an animated status indicator showing the current agent state as a short text label

#### Scenario: Bottom bar layout — right zone
- **WHEN** the bottom bar is rendered
- **THEN** the right zone SHALL contain clickable icons to toggle the MCP panel, tool history panel, and model info panel

### Requirement: The bottom bar status indicator SHALL display animated states for all agent activity phases.

The status indicator SHALL support the following states with distinct colors and gentle animations: ready (idle), thinking (waiting for first stream chunk), streaming (receiving chunks), compacting (context compaction in progress), error (something failed), and waiting (waiting on user input such as tool approvals). Color motion SHALL be gentle and non-distracting.

#### Scenario: Status transitions through thinking to streaming
- **WHEN** the user sends a message
- **THEN** the status indicator SHALL transition to "thinking" with an animated color
- **WHEN** the first stream chunk arrives
- **THEN** the status indicator SHALL transition to "streaming" with a different animated color

#### Scenario: Status shows compacting
- **WHEN** a context compaction tool call starts
- **THEN** the status indicator SHALL transition to "compacting" with an animated color
- **WHEN** the compaction completes
- **THEN** the status indicator SHALL transition back to the previous appropriate state

#### Scenario: Status shows waiting for user input
- **WHEN** a tool approval request is pending
- **THEN** the status indicator SHALL transition to "waiting" with an animated color
- **WHEN** the user approves or denies
- **THEN** the status indicator SHALL transition back to the appropriate state

#### Scenario: Status shows error
- **WHEN** an error occurs during agent operation
- **THEN** the status indicator SHALL transition to "error" with an animated color
- **WHEN** the error is resolved or the user sends a new message
- **THEN** the status indicator SHALL transition away from error

#### Scenario: Status shows ready when idle
- **WHEN** no agent activity is in progress
- **THEN** the status indicator SHALL show "ready" with a static or subtle appearance

### Requirement: The context usage indicator SHALL display distinct color bands for healthy, warning, and compact-threshold levels.

The context indicator SHALL use green/healthy color below 70%, yellow/warning between 70% and 90%, and red/error above 90%. When iron-core provides a compact threshold value, the indicator SHALL display a distinct marker at that threshold position.

#### Scenario: Context usage at healthy level
- **WHEN** context usage is below 70%
- **THEN** the context bar SHALL display with the healthy color

#### Scenario: Context usage at warning level
- **WHEN** context usage is between 70% and 90%
- **THEN** the context bar SHALL display with the warning color

#### Scenario: Context usage above compact threshold
- **WHEN** context usage exceeds 90%
- **THEN** the context bar SHALL display with the error color

#### Scenario: Compact threshold marker
- **WHEN** iron-core provides a compact threshold value via context metadata
- **THEN** the context bar SHALL display a distinct marker at the threshold position

### Requirement: The bottom bar SHALL provide clickable icons to toggle right-side panels.

Each icon SHALL indicate the panel state (open/closed) and the panel's health or activity status when relevant.

#### Scenario: Toggle MCP panel from bottom bar
- **WHEN** the user clicks the MCP icon in the bottom bar
- **THEN** the MCP right-side panel SHALL toggle open or closed

#### Scenario: Toggle tool history panel from bottom bar
- **WHEN** the user clicks the tool history icon in the bottom bar
- **THEN** the tool history right-side panel SHALL toggle open or closed

#### Scenario: Toggle model info panel from bottom bar
- **WHEN** the user clicks the model info icon in the bottom bar
- **THEN** the model info right-side panel SHALL toggle open or closed
