## Context

AgentIron currently stores provider API keys in the persisted provider settings JSON and passes a raw `apiKey` argument from the frontend to the Tauri `create_agent` command. The backend then manually constructs provider profiles and calls `iron_providers::RuntimeConfig::new(api_key)` before injecting the provider into `IronAgent`.

`iron-core` v0.1.9 and `iron-providers` v0.1.9 now provide the primitives AgentIron needs for OAuth-backed providers:

- `iron_providers::ProviderCredential` and `RuntimeConfig::from_credential(...)`.
- `iron_providers::ProviderRegistry::default()` with `kimi-code` dual-mode auth and `codex` OAuth-only auth.
- `iron_core::provider_credential::ProviderCredentialStore` for app-owned credential persistence.
- `iron_core::provider_credential::CredentialResolver` for API-key precedence, OAuth token refresh, auth status, and disconnect behavior.
- Device-code helpers for starting and polling OAuth flows.

AgentIron issue #22 owns the app integration: settings UX, local persistence, commands, readiness, and provider construction. AgentIron issue #23 remains the place for provider-specific OAuth-flow research and validation such as exact provider client IDs and endpoint correctness.

## Goals / Non-Goals

**Goals:**

- Store OAuth provider credentials in AgentIron SQLite storage, separate from normal settings JSON.
- Preserve existing API-key behavior and avoid API-key migration in this change.
- Treat explicit API keys as higher priority than OAuth credentials when both are present.
- Add device-code-only OAuth connect/poll/disconnect/status flows to the backend and frontend.
- Load provider auth status before automatic default-session creation.
- Add `codex` as a provider and use `iron_providers::ProviderRegistry::default()` for provider construction.
- Automatically refresh OAuth access tokens through `CredentialResolver` during provider resolution.
- File a follow-up GitHub issue for moving provider secrets from SQLite to OS-backed secure storage.

**Non-Goals:**

- Migrating API keys into the new credential store.
- Implementing OS keychain, Secret Service, or Windows Credential Manager storage.
- Implementing browser loopback or PKCE OAuth flows.
- Resolving provider-specific OAuth-flow research questions tracked by #23.
- Supporting custom provider base URL behavior.
- Refactoring AgentIron into a fully managed `IronRuntime` provider architecture.

## Decisions

### Use SQLite for the first OAuth credential store

AgentIron will implement `iron_core::provider_credential::ProviderCredentialStore` using a dedicated SQLite-backed credential table. This table stores OAuth access tokens, refresh tokens, expiry, and optional ID tokens for provider slugs.

Alternatives considered:

- OS-backed secure storage immediately. This better matches the long-term security target but expands the first slice across Linux Secret Service, macOS Keychain, and Windows Credential Manager behavior.
- Keep tokens in normal settings JSON. This is simpler but violates the requirement to keep OAuth secrets out of the existing settings blob.

This change will file a follow-up issue for moving provider secrets from SQLite to OS-backed storage.

### Keep API keys in existing settings for this change

Existing API keys remain in `ProviderConfig.apiKey` and are passed as optional explicit API keys when resolving credentials. OAuth credentials are stored through the backend credential store.

This avoids a credential migration, preserves current behavior, and matches `CredentialResolver`'s existing API-key-wins-over-OAuth semantics.

### Do not add an auth-mode preference for the MVP

Effective auth mode is derived from available credentials:

```text
if provider has a non-empty API key:
  use API key
else if provider has a stored OAuth credential:
  use OAuth
else:
  provider is not configured
```

For dual-mode providers such as `kimi-code`, the settings UI can show both API-key and OAuth controls while making the effective mode clear. If an API key is present, OAuth may remain connected but is not used.

### Use frontend-owned device-code polling

The backend will expose commands to start a device-code flow and poll the token endpoint. The frontend will own the polling timer, cancellation, and display of verification URL, user code, expiry, and errors.

This keeps the backend command surface simple and supports SSH/TUI-compatible OAuth flows. The device code may be returned to the frontend so it can correlate subsequent poll requests.

### Cache provider auth status in frontend state

AgentIron will keep a frontend provider-auth status map loaded after settings. This cache drives settings badges, tab creation readiness, and startup gating. Backend provider resolution remains authoritative during `create_agent`.

Status refresh triggers include startup, provider settings mount, successful connect, disconnect, API-key edits, and relevant auth failures.

### Wait for provider auth statuses before default session creation

Startup automatic tab creation will wait for both settings and provider auth statuses. This prevents OAuth-connected providers from being treated as unconfigured before the backend status is known.

### Use `ProviderRegistry::default()` for provider construction

AgentIron's manual provider profile construction is stale for `kimi-code` and does not include `codex`. Provider construction will use `iron_providers::ProviderRegistry::default()` with `RuntimeConfig::from_credential(...)` after resolving credentials.

Custom base URL behavior is out of scope for this change.

### Keep the existing provider-injection worker architecture

AgentIron will continue constructing a concrete provider before creating the worker and passing it to `IronAgent::with_tokio_handle(...)`. The credential resolver is used as an adapter before provider construction rather than moving the app to a fully managed runtime-provider architecture.

This minimizes the change while still consuming the new upstream credential contracts.

## Risks / Trade-offs

- SQLite is not OS-backed secure storage -> Mitigate by isolating OAuth credentials from normal settings JSON and filing a follow-up issue for OS secure storage.
- Frontend auth status can become stale -> Mitigate by keeping backend resolution authoritative and refreshing status after connect, disconnect, API-key edits, startup, and auth failures.
- Device-code metadata may still need provider-specific validation -> Mitigate by keeping #23 open for provider-flow research and limiting #22 to the AgentIron integration contract.
- Explicit API-key precedence can make connected OAuth unused for dual-mode providers -> Mitigate with UI copy that shows the effective auth mode and notes that OAuth is ignored while an API key is present.
- Replacing manual provider profiles may surface differences in provider behavior -> Mitigate by relying on `iron-providers` v0.1.9 registry tests and verifying existing API-key providers still create agents.
- Startup waits on auth status loading -> Mitigate with a bounded loading state and clear fallback if status retrieval fails.

## Migration Plan

- Existing provider settings continue to load unchanged.
- Existing API-key providers remain configured through `ProviderConfig.apiKey`.
- No existing API keys are moved or removed.
- New OAuth credentials are written only after a successful device-code token exchange.
- Rollback removes OAuth UI/commands and leaves existing API-key settings intact. OAuth credential rows can remain inert if code no longer reads them.

## Open Questions

- What exact follow-up issue wording should be used for OS-backed secure storage?
- Should provider auth status failures during startup block automatic tab creation or show a recoverable settings prompt?
