## 1. Provider Flow Research

- [x] 1.1 Validate Kimi Code OAuth metadata from public Kimi CLI or provider documentation, including issuer, device authorization endpoint, token endpoint, client ID, scopes, token fields, refresh-token rotation, and API base URL.
- [x] 1.2 Validate Codex device-code OAuth metadata from OpenAI Codex CLI, Goose, or provider documentation, including issuer, supported grant type, client ID, scopes, token fields, refresh behavior, and Codex API base URL.
- [x] 1.3 Determine whether Codex supports device-code OAuth; if not, document the finding and file/link a follow-up or blocking provider/upstream issue rather than implementing a different interaction type in this change.
- [x] 1.4 Document confirmed provider-flow findings with secret values redacted and link them to AgentIron issue #23.

## 2. Upstream Metadata And Provider Corrections

- [x] 2.1 Update `iron-core` OAuth metadata for `kimi-code` if validation finds incorrect endpoint, client ID, scopes, token parsing, or refresh behavior.
- [x] 2.2 Update `iron-core` OAuth metadata or interaction model for `codex` if validation finds incorrect endpoint, client ID, scopes, grant type, token parsing, or refresh behavior.
- [x] 2.3 Update `iron-providers` `kimi-code` profile if validation finds incorrect API family, base URL, credential-mode support, or wire-auth strategy.
- [x] 2.4 Update `iron-providers` `codex` profile or Codex API adapter if validation finds incorrect API family, base URL, request path, request body shape, auth headers, streaming behavior, or account routing.
- [x] 2.5 Add or update upstream tests for credential-mode support, metadata shape, mocked token refresh behavior, Codex account routing, and provider request auth without real secrets.
- [x] 2.6 Publish, tag, or pin corrected `iron-core` / `iron-providers` versions or Git revisions for AgentIron consumption.

## 3. AgentIron Integration Adjustments

- [x] 3.1 Update AgentIron dependencies to consume corrected `iron-core` and `iron-providers` contracts.
- [x] 3.2 Verify AgentIron's OAuth start/poll/disconnect/status commands work with the corrected `kimi-code` metadata.
- [x] 3.3 Verify AgentIron's OAuth start/poll/disconnect/status commands work with the corrected `codex` device-code metadata.
- [x] 3.4 Ensure AgentIron provider settings display actionable status for provider-specific OAuth failures without logging token material.
- [x] 3.5 Ensure `kimi-code` keeps API-key-over-OAuth precedence after dependency updates.

## 4. End-To-End Validation

- [ ] 4.1 Manually connect Kimi Code OAuth in AgentIron using a real account and verify an agent can send and receive a basic prompt without an API key.
- Fixed metadata 2026-05-13 in local `iron-core`: Kimi device-code start must use `POST /api/oauth/device_authorization`, `POST /api/oauth/token`, no scope parameter, and Kimi device headers. Direct endpoint verification now returns a device-code JSON response.
- Fixed provider profile 2026-05-13 in local `iron-providers`: Kimi Code base URL must be `https://api.kimi.com/coding` because the Anthropic Messages adapter appends `/v1/messages`. The stale `https://api.kimi.com/coding/v1` base produced `/coding/v1/v1/messages` and Kimi returned `resource_not_found_error`.
- [ ] 4.2 Manually connect Codex OAuth in AgentIron using a real account and verify an agent can send and receive a basic prompt without an API key.
- Blocked 2026-05-13: Codex device-code start returns a 403 Cloudflare managed challenge from `https://auth.openai.com/oauth/device/code` before AgentIron can display a device code. This needs upstream/provider rescope to a supported Codex login flow before end-to-end Codex OAuth can pass.
- [ ] 4.3 Manually verify Kimi Code API-key mode still works when a non-empty API key is configured.
- [ ] 4.4 Manually verify OAuth disconnect removes only OAuth credentials and does not clear Kimi Code API-key settings.
- [ ] 4.5 Record manual verification results in issue #23 with secrets, account IDs, access tokens, refresh tokens, ID tokens, and authorization codes redacted.

## 5. Final Checks

- [x] 5.1 Run `openspec validate enable-codex-kimi-oauth-authentication --strict`.
- [x] 5.2 Run `pnpm lint` and `pnpm build` if AgentIron frontend behavior changes.
- [x] 5.3 Run `cargo check --manifest-path src-tauri/Cargo.toml` if AgentIron Rust dependencies or commands change.
- [x] 5.4 Run relevant upstream `iron-core` and `iron-providers` tests for metadata, resolver, mocked refresh, and provider request behavior.
- [ ] 5.5 Close AgentIron issue #23 only after both Codex and Kimi Code OAuth have been verified end-to-end or the issue is explicitly rescoped.
