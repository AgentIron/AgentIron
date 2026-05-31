## MODIFIED Requirements

### Requirement: Sealed history messages SHALL not re-render during streaming

Sealed history messages (all messages except the currently-streaming assistant message and any in-progress tool activity) SHALL be rendered from a structural-only memo that does not recompute when message content mutates. This prevents DOM churn and visual flashing on past messages while the assistant streams a response.

#### Scenario: User sends a message and assistant streams a response
- **WHEN** the assistant begins streaming a new response in a conversation with multiple prior messages
- **THEN** all prior messages SHALL remain visually stable with no flashing or re-animation
- **AND** only the new streaming message bubble SHALL update on each chunk

#### Scenario: Streaming completes and new message becomes sealed
- **WHEN** streaming completes (stream-end event received)
- **THEN** the completed message SHALL transition into the sealed history
- **AND** the sealed history memo SHALL recompute once to include the new message

### Requirement: Active zone SHALL remain fully reactive during streaming

The active zone SHALL render the currently-streaming assistant message and any in-progress tool activity lines from the live store, updating on every streaming chunk without debouncing that would cause visible lag.

#### Scenario: Streaming text appears in real-time
- **WHEN** each chunk arrives via the agent-stream-chunk event
- **THEN** the active zone message bubble SHALL update to reflect the new content
- **AND** the markdown rendering SHALL follow its existing debounce behavior

#### Scenario: Tool activity appears during streaming
- **WHEN** a tool call is initiated during streaming
- **THEN** the tool activity line SHALL appear in the active zone
- **AND** past messages SHALL not flash when the tool event is added

### Requirement: Auto-scroll SHALL continue to work correctly with split rendering

The existing auto-scroll behavior (pin to bottom during streaming, respect user scroll-up) SHALL be preserved with the split rendering approach.

#### Scenario: User is pinned to bottom during streaming
- **WHEN** the assistant streams a response that causes the content to grow
- **THEN** the messages container SHALL scroll to keep the latest content visible

#### Scenario: User scrolls up during streaming
- **WHEN** the user has scrolled up to read prior messages and the assistant continues streaming
- **THEN** the scroll position SHALL not be forced back to the bottom
