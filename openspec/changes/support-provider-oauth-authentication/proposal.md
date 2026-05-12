## Why

AgentIron is currently API-key-only even though `iron-core` and `iron-providers` now provide first-class provider credential abstractions, OAuth token refresh, and OAuth-capable `kimi-code`/`codex` provider support. This change lets AgentIron consume those upstream contracts so OAuth-connected providers can be configured and used without forcing access tokens into API-key settings.

## What Changes

- Add AgentIron backend support for OAuth provider credentials stored in SQLite through an implementation of `iron_core::provider_credential::ProviderCredentialStore`.
- Add device-code OAuth commands for starting, polling, disconnecting, and checking provider auth status through the `iron-core` provider credential APIs.
- Add frontend provider-auth status state, provider settings controls, and startup gating so OAuth-connected providers count as configured providers.
- Replace AgentIron's manual provider-profile construction with `iron_providers::ProviderRegistry::default()` so `codex` and the corrected `kimi-code` profile are available.
- Preserve existing API-key behavior: API keys remain in the current provider settings JSON for this change and explicit API keys take precedence over OAuth credentials.
- Add `codex` as an OAuth-capable provider in AgentIron's provider/model UI.
- File a follow-up issue to move provider secrets from SQLite to OS-backed secure storage.

## Capabilities

### New Capabilities
- `provider-oauth-authentication`: AgentIron can connect, store, report, and use OAuth-backed provider credentials via `iron-core` while preserving existing API-key behavior.

### Modified Capabilities

## Impact

- Frontend provider settings, provider readiness checks, startup/default-tab creation, and provider/model metadata.
- Tauri command bindings in `src/lib/tauri/commands.ts` and command registration in `src-tauri/src/lib.rs`.
- Backend agent creation in `src-tauri/src/commands/agent.rs`, application state in `src-tauri/src/state.rs`, and SQLite migrations/storage.
- Existing dependencies on `iron-core` v0.1.9 and `iron-providers` v0.1.9 provider credential APIs.
- GitHub issue boundaries: #22 owns AgentIron integration; #23 remains provider-specific OAuth-flow research and validation.
