## Why

AgentIron now has a global toast/notification system, but several user-triggered failures still only write to the developer console. This change finishes the follow-up migration from issue #26 so important transient failures are visible without reintroducing blocking browser alerts or moving persistent health state out of context.

## What Changes

- Notify users when visible, user-triggered actions fail, including model switching, snip start, prompt cancellation, working-directory changes, skill activation/deactivation, MCP server toggles/retries, and MCP hot-registration on active tabs.
- Keep persistent object-specific health, such as MCP server `lastError` and diagnostics, inline where that state belongs.
- Keep background/system diagnostics console-only when they do not directly block a visible user action.
- Preserve existing console logging for debugging while ensuring it is not the only feedback path for important user-action failures.
- Leave `SettingsContext` persistence/load/auth-status failures console-only for this slice.
- Leave `SnipOverlay` failures console-only because the overlay renders outside the main app notification provider.
- Show MCP hot-register/update failures as one notification per affected tab; notification aggregation or additional deduplication remains future follow-up work if needed.

## Capabilities

### New Capabilities
- `transient-error-notifications`: AgentIron presents user-relevant transient action failures through the global notification system while preserving inline persistent health state and console-only diagnostics where appropriate.

### Modified Capabilities

## Impact

- Frontend action handlers in chat, layout, settings, MCP, and model-selection components.
- MCP context operations that already run under the notification provider.
- No backend API or persisted settings format changes.
- No changes to the notification system primitives added by issue #24 unless a narrow gap is discovered during implementation.
- Related GitHub issues: #24 introduced the shared notification system; #26 tracks this migration.
