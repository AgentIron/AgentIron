## Why

The current chat UI has several UX gaps. The info bar (directory, context usage, model switcher, MCP toggle) sits above the message list, consuming vertical space and separating status information from the input area where the user's attention is focused. There is no visual feedback between sending a message and receiving the first stream chunk, making the client feel frozen. Context usage is shown as a small numeric indicator without clear color thresholds or compact boundary awareness. Tool activity is only visible inline in the message flow, with no way to review recent tool history without scrolling. Compaction events render as generic tool calls with no distinct visual treatment.

## What Changes

- Move the info bar (directory, model switcher, context indicator, MCP toggle) from above the message list to just above the text input, creating a compact bottom status bar.
- Add a centered status indicator in the bottom bar with animated states: ready, thinking, streaming, compacting, error, and waiting (for user input such as approvals).
- Enhance the context usage indicator with distinct color bands for healthy, warning, and compact-threshold levels, driven by metadata from iron-core.
- Add a tool history right-side panel (hidden by default) showing the last 25 tool calls, following the existing MCP panel pattern.
- Add a model info right-side panel (hidden by default) showing model card details (context window, pricing, capabilities, supported features).
- Add clickable sidebar icons in the bottom bar to toggle the MCP, tool history, and model info right-side panels.
- Defer reasoning effort control to a future change; open an iron-core issue for model metadata support.
- Render compaction tool calls with a distinct visual treatment in the chat, showing compaction start/finish with token metrics.
- Keep the existing top tab bar unchanged.

## Capabilities

### New Capabilities

- `chat-status-bar`: AgentIron provides a compact bottom status bar with switchable settings on the left, an animated status indicator in the center, and clickable sidebar toggle icons on the right.

- `tool-history-panel`: AgentIron provides a right-side panel showing the last 25 tool calls with status, timestamps, and expandable details.

- `model-info-panel`: AgentIron provides a right-side panel showing model metadata including context window size, pricing, capabilities, and supported features.

- `compaction-indicator`: AgentIron renders compaction events with a distinct visual treatment in the chat, showing start/finish state and token metrics when available from iron-core.

### Modified Capabilities

- `chat-ui`: The chat message list area expands to full height with the info bar relocated to the bottom. The status indicator replaces the existing inline streaming dots as the primary activity signal.

## Impact

- `src/components/layout/AppShell.tsx` — No changes expected (top tab bar stays).
- `src/components/chat/ChatArea.tsx` — Remove the info bar from above the message list; add bottom bar container below the message list and above the input; add status indicator logic; add sidebar toggle buttons.
- `src/components/chat/MessageBubble.tsx` — Update streaming indicator to work with the new status system; thinking state may add a distinct visual treatment to the empty assistant bubble.
- `src/components/chat/ContextIndicator.tsx` — Enhance with compact-threshold color band; relocate to bottom bar.
- `src/components/chat/DirectoryIndicator.tsx` — Relocate to bottom bar.
- `src/components/chat/ModelSwitcher.tsx` — Relocate to bottom bar.
- `src/components/chat/ToolDetailRenderers.tsx` — Add compaction-specific renderer.
- `src/components/chat/ToolActivitySummary.tsx` — Add distinct styling for compaction tool groups.
- `src/context/UIContext.tsx` — Add signals for tool history pane and model info pane open state.
- `src/context/ChatContext.tsx` — Add rolling tool history buffer (last 25 events); add compaction event handling; add status state tracking (ready/thinking/streaming/compacting/error/waiting).
- New file: `src/components/chat/StatusBar.tsx` — Bottom bar component with left settings, center status, right sidebar icons.
- New file: `src/components/chat/StatusIndicator.tsx` — Animated status pill with color and motion per state.
- New file: `src/components/chat/ToolHistoryPanel.tsx` — Right-side panel for tool call history.
- New file: `src/components/chat/ModelInfoPanel.tsx` — Right-side panel for model metadata.
- No backend API changes in this change. Iron-core issue to be filed separately for reasoning effort model metadata and compact threshold values.
- CSS additions in `src/index.css` for status indicator animations (thinking pulse, streaming shimmer, compacting pulse, error flash).
