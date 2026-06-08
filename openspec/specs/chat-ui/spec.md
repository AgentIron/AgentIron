## Purpose

Define chat UI behavior for streaming responses, message stability, entrance animations, and auto-scroll.

## Requirements

### Requirement: Sealed history messages SHALL not re-render during streaming

Sealed history messages (all entries before the current response turn) SHALL be rendered from a structural-only memo that does not recompute when active message content mutates. This prevents DOM churn and visual flashing on past messages while the assistant streams a response.

The current response turn SHALL include the latest user prompt and the following assistant/tool sequence for that prompt while streaming is active.

#### Scenario: User sends a message and assistant streams a response
- **WHEN** the assistant begins streaming a new response in a conversation with multiple prior messages
- **THEN** all prior messages SHALL remain visually stable with no flashing or re-animation
- **AND** only the new streaming message bubble SHALL update on each chunk

#### Scenario: Current response turn includes tool activity
- **WHEN** the assistant streams a response that includes tool calls
- **THEN** the latest user prompt, live tool activity, and assistant continuation SHALL remain in the active zone while streaming
- **AND** entries from earlier turns SHALL remain in sealed history

#### Scenario: Streaming completes and new message becomes sealed
- **WHEN** streaming completes (stream-end event received)
- **THEN** the completed response turn SHALL transition into the sealed history
- **AND** the sealed history memo SHALL recompute once to include the completed turn
- **AND** the completed turn SHALL not re-run entrance animations during the transition

### Requirement: Active zone SHALL remain fully reactive during streaming

The active zone SHALL render the current response turn from the live store, updating on every streaming chunk without debouncing that would cause visible lag.

#### Scenario: Streaming text appears in real-time
- **WHEN** each chunk arrives via the agent-stream-chunk event
- **THEN** the active zone message bubble SHALL update to reflect the new content
- **AND** the markdown rendering SHALL follow its existing debounce behavior

#### Scenario: Tool activity appears during streaming
- **WHEN** a tool call is initiated during streaming
- **THEN** the tool activity line SHALL appear in the active zone
- **AND** past messages SHALL not flash when the tool event is added

### Requirement: Message entrance animations SHALL be limited to active or newly-arriving messages

Message entrance animation eligibility SHALL be explicit. Active or newly-arriving messages MAY use the existing entrance animation, but sealed history messages SHALL render without the entrance animation class.

#### Scenario: User sends a new prompt
- **WHEN** a user sends a new prompt
- **THEN** the new prompt and response turn MAY animate into view
- **AND** prior sealed history messages SHALL not animate

#### Scenario: Active turn becomes sealed
- **WHEN** streaming completes and the active turn is incorporated into sealed history
- **THEN** that turn SHALL not animate again because of the zone transition

### Requirement: Auto-scroll SHALL continue to work correctly with split rendering

The existing auto-scroll behavior (pin to bottom during streaming, respect user scroll-up) SHALL be preserved with the split rendering approach.

#### Scenario: User is pinned to bottom during streaming
- **WHEN** the assistant streams a response that causes the content to grow
- **THEN** the messages container SHALL scroll to keep the latest content visible

#### Scenario: User scrolls up during streaming
- **WHEN** the user has scrolled up to read prior messages and the assistant continues streaming
- **THEN** the scroll position SHALL not be forced back to the bottom
