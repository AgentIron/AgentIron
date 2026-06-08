## 1. Notification Migration

- [x] 1.1 Add global notification calls for failed model switches while preserving console logging.
- [x] 1.2 Add global notification calls for failed snip-start and prompt-cancel actions while preserving console logging.
- [x] 1.3 Add global notification calls for failed working-directory changes while preserving console logging.
- [x] 1.4 Add global notification calls for failed skill activation/deactivation while preserving console logging.
- [x] 1.5 Add global notification calls for failed automatic tab creation if startup cannot create the initial agent.

## 2. MCP Failure Treatment

- [x] 2.1 Add global notification calls for failed MCP server enable/disable operations while preserving thrown errors and console logging.
- [x] 2.2 Add global notification calls for failed MCP server reconnect operations while preserving thrown errors and console logging.
- [x] 2.3 Add one notification per affected tab when MCP server hot-register or hot-update fails after settings changes.
- [x] 2.4 Confirm MCP server cards/details continue rendering inline `lastError`, category, stage, and guidance state.

## 3. Scope Guardrails

- [x] 3.1 Leave `SettingsContext` persistence/load/auth-status failures console-only.
- [x] 3.2 Leave `SnipOverlay` capture/selection failures console-only.
- [x] 3.3 Leave platform shortcut availability diagnostics console-only.
- [x] 3.4 Confirm no normal app-flow browser `alert(...)` calls remain.

## 4. Verification

- [x] 4.1 Run `pnpm lint`.
- [x] 4.2 Run `pnpm build`.
- [x] 4.3 Manually inspect or exercise affected actions where practical to confirm notifications are non-blocking and inline MCP health state remains visible.
