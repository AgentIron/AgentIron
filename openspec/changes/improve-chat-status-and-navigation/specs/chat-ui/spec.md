## MODIFIED Requirements

### Requirement: The chat message list area SHALL expand to full height with the info bar relocated to the bottom.

The directory indicator, model switcher, context indicator, and MCP toggle SHALL be removed from above the message list and placed in the new bottom status bar. The message list SHALL fill the full available height between the tab bar and the bottom bar.

#### Scenario: Info bar removed from above messages
- **WHEN** the user is on the chat view
- **THEN** no info bar SHALL appear above the message list

#### Scenario: Message list fills available space
- **WHEN** the info bar is relocated to the bottom
- **THEN** the message list SHALL extend from the tab bar to the bottom status bar without interruption
