## ADDED Requirements

### Requirement: AgentIron SHALL provide a right-side panel showing the last 25 tool calls for the active tab.

The tool history panel SHALL be hidden by default and toggled from the bottom bar. It SHALL display tool calls in reverse chronological order with status indicators, tool names, argument summaries, and expandable result details. It SHALL follow the same visual pattern as the existing MCP panel.

#### Scenario: Open tool history panel
- **WHEN** the user clicks the tool history icon in the bottom bar
- **THEN** the tool history panel SHALL slide in from the right

#### Scenario: Display recent tool calls
- **WHEN** the tool history panel is open
- **THEN** it SHALL display the last 25 tool calls for the active tab with the most recent at the top

#### Scenario: Expand tool call details
- **WHEN** the user clicks a tool call in the history
- **THEN** it SHALL expand to show arguments and result details

#### Scenario: Tool history persists across panel close
- **WHEN** the user closes and reopens the tool history panel
- **THEN** the tool calls SHALL still be visible (stored in context, not just DOM)

#### Scenario: Tool history tracks active tab
- **WHEN** the user switches to a different tab
- **THEN** the tool history panel SHALL update to show tool calls for the newly active tab
