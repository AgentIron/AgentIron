## Context

AgentIron issue #22 added the app-level OAuth integration: SQLite-backed provider credential storage, device-code Tauri commands, provider auth status, startup readiness, and provider construction through `iron_providers::ProviderRegistry::default()`. Issue #23 is the next layer down: verify that the provider-specific OAuth metadata and provider profiles are correct enough for real users to authenticate against Codex and Kimi Code with OAuth.

Current upstream assumptions already exist:

- `iron-core` owns OAuth metadata and token lifecycle helpers through `provider_credential::oauth`.
- `iron-core::CredentialResolver` owns API-key precedence, refresh attempts, and sanitized auth status.
- `iron-providers` owns provider profiles, credential-mode declarations, wire auth headers, API families, Codex request shaping, and provider-specific routing metadata such as `chatgpt-account-id`.
- AgentIron should consume those contracts and avoid provider-specific OAuth hacks in the UI or Tauri command layer.

The risky part is not the AgentIron chassis anymore. The risky part is whether the current `codex` and `kimi-code` metadata matches provider reality: endpoints, client IDs, scopes, grant type, refresh behavior, token payloads, and accepted wire auth.

```text
┌──────────────────┐
│ AgentIron        │ connect / poll / status / create agent
└────────┬─────────┘
         │ provider slug
         ▼
┌──────────────────┐
│ iron-core        │ OAuth metadata, token exchange, refresh, resolver
└────────┬─────────┘
         │ ProviderCredential
         ▼
┌──────────────────┐
│ iron-providers   │ provider profile, auth headers, API family
└────────┬─────────┘
         │ HTTP request
         ▼
┌──────────────────┐
│ Codex / Kimi API │ authoritative provider behavior
└──────────────────┘
```

## Goals / Non-Goals

**Goals:**

- Validate and correct device-code OAuth metadata for `codex` and `kimi-code`.
- Validate that OAuth tokens obtained through device-code flows are accepted by the corresponding provider APIs.
- Keep provider-specific metadata and wire behavior in `iron-core` / `iron-providers`, not AgentIron UI code.
- Ensure AgentIron can create a working `codex` agent using OAuth credentials and no API key, send a basic prompt, and receive a response.
- Ensure AgentIron can create a working `kimi-code` agent using OAuth credentials and no API key, send a basic prompt, and receive a response.
- Preserve `kimi-code` API-key mode and API-key-over-OAuth precedence.
- Provide repeatable verification steps that do not commit secrets, tokens, or account identifiers.

**Non-Goals:**

- Moving OAuth secrets from SQLite to OS-backed secure storage; that remains follow-up issue #29.
- Changing public `openai` provider behavior; Codex remains a separate `codex` provider path.
- Adding arbitrary custom provider OAuth metadata in AgentIron settings.
- Storing refresh tokens in `iron-providers`.
- Adding provider-specific OAuth conditionals to AgentIron frontend components or Tauri commands unless the upstream abstractions prove insufficient.
- Implementing loopback PKCE or any non-device-code OAuth interaction type.
- Using tool calls or streaming behavior as acceptance criteria for OAuth validation.

## Decisions

### Treat this as provider validation plus upstream correction

AgentIron should not be the source of truth for provider-specific OAuth endpoints. The implementation work should first validate provider behavior, then correct `iron-core` and `iron-providers` contracts as needed, then update AgentIron dependency versions or commits.

Alternatives considered:

- Patch AgentIron directly with provider-specific endpoint/header logic. This is faster locally but creates the wrong ownership boundary and duplicates upstream provider metadata.
- Treat current metadata as authoritative and only perform manual testing. This risks shipping broken OAuth if placeholders or stale endpoints remain.

### Keep `codex` separate from public `openai`

Codex uses ChatGPT/Codex backend behavior, not the public OpenAI API. It should remain a dedicated `codex` provider with its own API family/profile while retaining `models_dev_id = "openai"` if that is useful for model metadata alignment.

The public `openai` provider remains API-key-only unless a separate change explicitly adds public OpenAI OAuth support.

### Preserve dual-mode `kimi-code`

`kimi-code` must continue supporting two credential modes with different wire auth behavior:

```text
API key      -> x-api-key: <api_key>
OAuth bearer -> Authorization: Bearer <access_token>
```

The resolver already prefers explicit API keys over stored OAuth credentials. This change should verify that behavior with the corrected upstream profile and a real or mocked provider path.

### Device-code is the OAuth interaction target for this change

AgentIron's current OAuth UI and command surface assume device-code flows. This change intentionally targets device-code OAuth for both Kimi Code and Codex.

If Codex cannot support device-code OAuth, that finding should be documented and tracked as a follow-up or blocking upstream/provider issue. This change should not expand into loopback PKCE or another OAuth interaction type without an explicit rescope.

### Validate OAuth with a basic prompt only

OAuth validation is satisfied when AgentIron can connect, create an agent, send a basic prompt, and receive an authenticated response. Tool calls and streaming are important provider capabilities, but they are not OAuth-specific and should not be used as acceptance criteria for this issue.

### Treat upstream issues as blocking only when they prevent basic OAuth use

Provider or upstream issues are blocking for #23 only if they prevent device-code connect, token exchange, provider construction, or a basic authenticated prompt. Issues limited to refresh edge cases, richer metadata, documentation, non-basic prompt behavior, or long-term hardening should be filed and linked without blocking closure.

### Verification should separate safe artifacts from secrets

Provider findings may be documented, but raw access tokens, refresh tokens, ID tokens, authorization codes, account IDs, and private account screenshots must not be committed or pasted into issues.

Acceptable verification artifacts include:

- Endpoint names and public client IDs when already public in upstream CLIs.
- Redacted request/response shapes.
- Mock-server tests reproducing provider response and refresh semantics.
- Manual test checklists that reference local environment variables for secrets.

## Risks / Trade-offs

- Provider OAuth metadata may be private, rate-limited, or change without notice -> Prefer metadata observed in official or widely used CLIs, and keep validation notes linked to upstream issues.
- Codex may not support device-code OAuth -> Document the finding and keep #23 focused on device-code unless explicitly rescoped.
- Real-provider verification can be flaky or account-dependent -> Pair manual validation with mocked protocol tests for deterministic CI coverage.
- `chatgpt-account-id` routing may depend on token claims that vary by account -> Keep extraction tolerant and verify fallback behavior without logging claim contents.
- Updating `iron-core` / `iron-providers` may require publishing new versions or pinning Git revisions -> Make dependency update explicit in tasks and verify AgentIron consumes the corrected upstream APIs.
- Existing OAuth integration change is still in-progress -> Keep this change focused on provider-specific correctness so it can layer on top of #22 without reopening app storage/UX scope.

## Migration Plan

- No persisted settings migration is expected.
- Existing API-key provider configurations remain unchanged.
- Existing OAuth rows for `codex` or `kimi-code` may need reconnect if corrected metadata changes issuer, client ID, scopes, or token audience.
- If reconnect is needed, AgentIron should surface an actionable auth status and let the user reconnect from Settings > Providers.
- Rollback means reverting dependency updates and provider metadata changes; SQLite OAuth rows can remain inert or be disconnected by the user.

## Open Questions

- Does Codex actually support device-code OAuth with the current `auth.openai.com` endpoints?
- 2026-05-13 finding: starting Codex device-code OAuth against `https://auth.openai.com/oauth/device/code` with the public Codex client ID returns `403 Forbidden` with Cloudflare managed-challenge HTML (`cf-mitigated: challenge`) before any device code is issued. Treat Codex device-code auth as blocked unless upstream/provider behavior changes or this OpenSpec is explicitly rescoped to a supported browser/loopback flow.
- Is the current Kimi Code client ID in `iron-core` correct, or should it use the public Kimi CLI client ID documented in issue #23?
- 2026-05-13 finding: Kimi Code uses the documented public client ID, but the endpoint paths differ from the stale `iron-core v0.1.11` metadata. Device-code start succeeds with `POST https://auth.kimi.com/api/oauth/device_authorization`, token polling/refresh should use `POST https://auth.kimi.com/api/oauth/token`, requests should omit `scope`, and Kimi requires `X-Msh-*` device headers.
- 2026-05-13 finding: Kimi Code prompt requests should reach `https://api.kimi.com/coding/v1/messages`. `iron-providers` should store the profile base as `https://api.kimi.com/coding`, not `https://api.kimi.com/coding/v1`, because the Anthropic Messages adapter appends `/v1/messages`.
- Are current scopes sufficient for both providers, or does either require provider-specific audience/resource parameters?
- Does Codex require `id_token`, access-token claims, userinfo, or another endpoint to determine `chatgpt-account-id`?
- Which upstream issues, if any, are blocking because they prevent device-code connect, token exchange, provider construction, or a basic authenticated prompt?
