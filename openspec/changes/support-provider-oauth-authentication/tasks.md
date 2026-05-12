## 1. Backend Credential Storage

- [x] 1.1 Add a SQLite migration for provider OAuth credentials keyed by provider slug.
- [x] 1.2 Implement a backend SQLite credential store that satisfies `iron_core::provider_credential::ProviderCredentialStore`.
- [x] 1.3 Add store serialization/deserialization for `StoredCredential::OAuthBearer`, including access token, refresh token, expiry, and optional ID token.
- [x] 1.4 Add backend tests for credential store get, set, remove, and list behavior.

## 2. Backend OAuth Commands

- [x] 2.1 Extend `AppState` to own shared provider credential storage and credential resolution state.
- [x] 2.2 Add a Tauri command to start provider device-code OAuth and return sanitized interaction details plus device code.
- [x] 2.3 Add a Tauri command to poll provider token exchange, persist successful OAuth credentials, and return sanitized status.
- [x] 2.4 Add a Tauri command to disconnect provider OAuth without clearing API-key settings.
- [x] 2.5 Add a Tauri command to return provider auth status while considering an optional explicit API key.
- [x] 2.6 Register the new OAuth/auth-status commands in the Tauri invoke handler.

## 3. Provider Construction

- [x] 3.1 Replace manual provider profile construction in `create_agent` with `iron_providers::ProviderRegistry::default()`.
- [x] 3.2 Change agent creation credential resolution to pass provider slug, model, and optional API key into `CredentialResolver`.
- [x] 3.3 Construct providers with `RuntimeConfig::from_credential(...)` after resolution.
- [x] 3.4 Preserve existing API-key provider behavior and verify explicit API keys win over stored OAuth credentials.
- [x] 3.5 Surface unsupported, not-configured, refresh-failed, and revoked auth errors with actionable messages.

## 4. Frontend Command Bindings And Types

- [x] 4.1 Add TypeScript command wrappers for starting OAuth, polling OAuth, disconnecting OAuth, and fetching provider auth status.
- [x] 4.2 Add frontend types for provider auth status and device-code start responses.
- [x] 4.3 Add provider metadata for auth capability: API-key-only, OAuth-only, and dual-mode providers.
- [x] 4.4 Add `codex` to provider metadata/model selection surfaces as an OAuth-capable provider.

## 5. Frontend Auth Status State

- [x] 5.1 Add a provider-auth status cache loaded after settings are loaded.
- [x] 5.2 Refresh provider auth status after startup, settings mount, OAuth connect success, OAuth disconnect, and API-key edits.
- [x] 5.3 Update configured-provider checks to use API-key presence or cached OAuth auth status.
- [x] 5.4 Gate automatic default-session creation until settings and provider auth statuses are loaded.

## 6. Provider Settings UX

- [x] 6.1 Render OAuth connection controls for OAuth-capable providers.
- [x] 6.2 Render device-code verification URL, user code, expiry, polling progress, and cancellation state while connecting.
- [x] 6.3 Use frontend-owned polling at the backend-provided interval until success, expiry, denial, cancellation, or error.
- [x] 6.4 Show effective auth mode, including that API key is used when a non-empty API key is present.
- [x] 6.5 Show connected, not configured, refreshing, expired, refresh failed, revoked, and unsupported credential statuses without exposing secrets.

## 7. Follow-Up Tracking

- [x] 7.1 File a GitHub follow-up issue to move provider credentials from SQLite to OS-backed secure storage.
- [x] 7.2 Link the follow-up issue from AgentIron issue #22.
- [x] 7.3 Confirm AgentIron issue #23 remains the tracking issue for provider-specific OAuth-flow research and metadata validation.

## 8. Verification

- [x] 8.1 Add or update frontend tests for provider readiness and OAuth settings behavior where test coverage exists.
- [x] 8.2 Run `pnpm lint`.
- [x] 8.3 Run `pnpm build`.
- [x] 8.4 Run `cargo check --manifest-path src-tauri/Cargo.toml` when local system dependencies are available.
- [ ] 8.5 Manually verify API-key provider creation still works.
- [ ] 8.6 Manually verify device-code start, polling, status refresh, and disconnect behavior with a supported provider or mocked credential flow.
