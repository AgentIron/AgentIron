## ADDED Requirements

### Requirement: AgentIron SHALL provide a right-side panel showing model metadata for the currently active model.

The model info panel SHALL be hidden by default and toggled from the bottom bar. It SHALL display the model name, provider, context window size, pricing information, capabilities (reasoning, vision, etc.), and supported features. It SHALL follow the same visual pattern as the existing MCP panel.

#### Scenario: Open model info panel
- **WHEN** the user clicks the model info icon in the bottom bar
- **THEN** the model info panel SHALL slide in from the right

#### Scenario: Display model metadata
- **WHEN** the model info panel is open
- **THEN** it SHALL show the model name, provider, context window size, pricing, and supported capabilities

#### Scenario: Model info updates on model switch
- **WHEN** the user switches to a different model via the model switcher
- **THEN** the model info panel SHALL update to reflect the new model's metadata (if open)
