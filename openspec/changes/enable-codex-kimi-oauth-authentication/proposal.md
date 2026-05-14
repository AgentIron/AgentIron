## Why

AgentIron now has the app-level OAuth chassis, but issue #23 is still unresolved: the provider-specific Codex and Kimi Code OAuth flows must be validated and corrected so users can actually authenticate and create agents with OAuth credentials. This change turns provider-flow research into an implementation contract for real end-to-end Codex and Kimi Code OAuth authentication.

## What Changes

- Validate the real device-code OAuth metadata for `codex` and `kimi-code`, including authorization/token endpoints, client IDs, scopes, polling semantics, refresh behavior, and any provider-specific token/account metadata.
- Correct upstream `iron-core` OAuth metadata and `iron-providers` provider profiles as needed so AgentIron can consume provider support through existing abstractions rather than app-specific hacks.
- Ensure AgentIron can connect, refresh status, disconnect, create agents, send a basic prompt, and receive an authenticated response for `codex` and `kimi-code` using OAuth credentials with no API key.
- Preserve dual-mode behavior for `kimi-code`: non-empty API keys continue to win over stored OAuth credentials.
- Document provider-specific validation findings and keep them linked to AgentIron issue #23 and the relevant upstream `iron-core` / `iron-providers` issues.
- Add mocked refresh coverage plus repeatable manual validation steps for both providers without committing secrets or refresh tokens.

## Capabilities

### New Capabilities
- `codex-kimi-oauth-authentication`: AgentIron can complete validated OAuth authentication flows for Codex and Kimi Code and use the resulting credentials to construct working providers.

### Modified Capabilities

## Impact

- AgentIron OAuth commands, provider settings UX, auth status display, and provider creation paths may need small adjustments if provider-flow reality differs from the current metadata assumptions.
- `iron-core` may need corrected OAuth metadata, token exchange handling, refresh handling, or claim extraction for provider-specific account routing.
- `iron-providers` may need corrected provider profiles, auth strategies, API families, account routing headers, or credential-mode declarations for `codex` and `kimi-code`.
- Verification will require real provider accounts or a documented mock strategy; secrets must remain outside the repository and issue comments.
