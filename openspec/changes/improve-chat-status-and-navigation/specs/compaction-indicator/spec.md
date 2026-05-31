## ADDED Requirements

### Requirement: AgentIron SHALL render compaction tool calls with a distinct visual treatment in the chat.

Compaction events SHALL be visually distinguished from regular tool calls. When iron-core provides token metrics in the tool result (tokens before/after, compaction method), those SHALL be displayed. The compaction indicator SHALL also trigger the status bar to show the "compacting" state.

#### Scenario: Compaction tool call renders distinctly
- **WHEN** a compaction tool call occurs
- **THEN** it SHALL render in the chat with a distinct visual style (icon, color, or layout) different from regular tool calls

#### Scenario: Compaction shows token metrics
- **WHEN** a compaction tool result includes tokens-before and tokens-after values
- **THEN** the compaction indicator SHALL display the token reduction (e.g. "12.4k → 8.1k tokens")

#### Scenario: Compaction triggers status bar
- **WHEN** a compaction tool call starts
- **THEN** the status bar SHALL transition to the "compacting" state
- **WHEN** the compaction tool result arrives
- **THEN** the status bar SHALL transition away from the "compacting" state
