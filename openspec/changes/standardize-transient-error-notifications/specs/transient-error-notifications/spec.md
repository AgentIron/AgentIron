## ADDED Requirements

### Requirement: AgentIron SHALL notify users about visible transient action failures
AgentIron SHALL use the global notification system to present failures from visible user-triggered actions when those failures would otherwise only be logged to the console.

#### Scenario: Model switch fails
- **WHEN** a user selects a different model for an active agent tab and the switch fails
- **THEN** AgentIron SHALL show a non-blocking error notification describing the failed model switch

#### Scenario: Prompt cancellation fails
- **WHEN** a user cancels an active prompt and the cancellation request fails
- **THEN** AgentIron SHALL show a non-blocking notification describing the failed cancellation

#### Scenario: Working directory change fails
- **WHEN** a user selects a new working directory and the agent replacement fails
- **THEN** AgentIron SHALL show a non-blocking error notification describing the failed directory change

#### Scenario: Skill activation changes fail
- **WHEN** a user activates or deactivates a skill and the command fails
- **THEN** AgentIron SHALL show a non-blocking error notification describing the failed skill update

### Requirement: AgentIron SHALL notify users about visible MCP action failures
AgentIron SHALL use the global notification system when user-visible MCP operations fail, while preserving MCP server health state in the MCP panel.

#### Scenario: MCP server toggle fails
- **WHEN** a user enables or disables an MCP server and the toggle fails
- **THEN** AgentIron SHALL show a non-blocking error notification describing the failed MCP server toggle

#### Scenario: MCP server retry fails
- **WHEN** a user retries an MCP server connection and the retry fails
- **THEN** AgentIron SHALL show a non-blocking error notification describing the failed reconnect attempt

#### Scenario: MCP server hot-register fails for active tabs
- **WHEN** a user saves MCP server settings and applying the update to an active tab fails
- **THEN** AgentIron SHALL show a notification for the affected tab

### Requirement: AgentIron SHALL preserve inline persistent health state
AgentIron SHALL keep persistent object-specific failures inline when the failure represents current object state rather than a transient action result.

#### Scenario: MCP server reports current error state
- **WHEN** an MCP server status includes current error details such as `lastError`, error category, stage, or guidance
- **THEN** AgentIron SHALL keep those details visible in the MCP server card or detail panel rather than replacing them with only a toast

### Requirement: AgentIron SHALL keep selected diagnostics console-only for this change
AgentIron SHALL leave background/system diagnostic failures console-only when they are outside the main notification provider or not directly caused by a visible user action in this change's scope.

#### Scenario: Settings context persistence or status loading fails
- **WHEN** settings persistence, settings loading, or provider auth-status refresh fails inside `SettingsContext`
- **THEN** AgentIron SHALL continue logging the failure to the console without requiring an in-app notification for this change

#### Scenario: Snip overlay operation fails
- **WHEN** screenshot loading, capture, or snip completion fails inside `SnipOverlay`
- **THEN** AgentIron SHALL continue logging the failure to the console without requiring an in-app notification for this change

#### Scenario: Platform shortcut support is unavailable
- **WHEN** global shortcut registration is unavailable on the current platform
- **THEN** AgentIron SHALL allow console-only diagnostic logging for that condition

### Requirement: AgentIron SHALL retain developer diagnostics for migrated failures
AgentIron SHALL preserve console logging for migrated error paths so notifications improve user feedback without removing developer diagnostics.

#### Scenario: A migrated action failure occurs
- **WHEN** AgentIron shows a notification for a migrated transient failure
- **THEN** AgentIron SHALL also retain enough console logging to support developer troubleshooting
