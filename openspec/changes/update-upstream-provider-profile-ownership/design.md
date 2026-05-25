## Context

AgentIron currently carries provider construction logic that belongs in the shared provider crates. The backend can use the credential resolver and upstream `ProviderRegistry`, but it still has a fallback table that defines provider API families, auth strategies, base URLs, and headers locally. That table depends on old `iron-providers` names such as `ApiFamily::OpenAiChatCompletions`, `ApiFamily::AnthropicMessages`, and `GenericProvider`, which have changed or been removed upstream.

The latest upstream provider model makes `ProviderProfile` the owner of protocol details and exposes built-in profiles for providers including `local` and `ollama-cloud`. AgentIron should become a consumer of those profiles, while preserving desktop-specific settings and UI behavior.

## Goals / Non-Goals

**Goals:**
- Build providers through upstream `ProviderRegistry` instead of local profile construction.
- Keep AgentIron responsible for desktop concerns: selected provider slug, selected model, user-entered credentials, and provider settings UI.
- Pass provider slug through `iron-core::Config` so upstream provider-specific system prompt fragments can be applied.
- Add `ollama-cloud` as an upstream-backed provider option.
- Add `local` as an upstream-backed provider option with default URL behavior and one overrideable `baseUrl` setting.
- Make model catalog mapping deterministic enough to avoid the OpenAI/Codex `models.dev` ambiguity introduced by upstream profile metadata.
- Document narrow temporary compatibility exceptions where upstream APIs do not yet expose the needed profile or runtime override.

**Non-Goals:**
- Creating arbitrary custom provider profiles in AgentIron.
- Supporting multiple named local endpoints.
- Redesigning OAuth beyond compatibility with upstream credential handling.
- Moving all frontend presentation metadata upstream in this change.
- Permanently owning built-in provider protocol metadata in AgentIron.

## Decisions

1. AgentIron will treat provider profiles as upstream-owned.

   The backend should not define API family, auth header strategy, default provider headers, provider quirks, endpoint purpose, or `models.dev` aliases for built-in providers. Those facts are shared across AgentIron and other `iron-*` consumers, so the upstream crates are the correct source of truth.

   Alternative considered: update the local match table to the new upstream enum names and provider connection type. This would compile in the short term but preserve drift and require AgentIron updates for provider metadata changes that should be crate-level changes.

2. Provider construction will use upstream `ProviderRegistry`.

   `build_provider` should resolve credentials into an upstream `ProviderCredential`, build a `RuntimeConfig`, and call `ProviderRegistry::default().get(provider_id, runtime_config)`. The no-resolver fallback should not reconstruct built-in profiles locally; it should create the minimal runtime credential needed by the registry.

   Alternative considered: use `ProviderConnection::from_profile` directly in AgentIron. That still requires AgentIron to own profile selection and would bypass the upstream registry as the canonical built-in provider catalog.

3. `local` will be a single configurable provider.

   AgentIron will expose one `local` provider using the upstream default base URL when no override is configured. The user may override `baseUrl` for that provider, and the selected value must be passed to the backend when creating an agent. This keeps local model support useful without introducing named endpoint management.

   Alternative considered: use a fixed local URL only. That is simpler but too restrictive for users running local OpenAI-compatible servers on non-default hosts or ports.

   Alternative considered: support multiple named local endpoints. That is more flexible but adds settings, identity, and migration complexity that is not needed for this update.

4. `ollama-cloud` will be added as a normal upstream-backed provider.

   Since upstream already owns the `ollama-cloud` profile, AgentIron should only add the presentation and settings metadata needed to select it and provide credentials.

5. Model catalog mapping must avoid nondeterministic OpenAI/Codex ambiguity.

   Upstream profiles can map multiple logical providers to the same `models.dev` source. AgentIron must not rely on nondeterministic `HashMap` iteration when turning `models.dev` provider IDs into AgentIron provider IDs. The implementation should use a deterministic mapping or upstream API that preserves the intended provider identity.

6. Provider-specific core behavior should receive the provider slug.

   Agent creation should call `Config::with_provider_name(provider_id)` alongside the selected model. This lets `iron-core` apply provider-specific prompt fragments or behavior exposed by `iron-providers`.

7. Temporary compatibility exceptions are allowed only when tracked upstream.

   AgentIron may temporarily define the minimal provider profile metadata needed to keep currently exposed providers working when `iron-providers` does not yet expose the required built-in profile or runtime override API. These exceptions are limited to:

   - Direct `openai` registration while `ProviderRegistry::default()` does not expose an API-key OpenAI profile distinct from `codex`.
   - `local` `baseUrl` override sessions while the registry/runtime API cannot apply a per-session endpoint override to the upstream `local` profile.

   These exceptions must stay narrow, documented in code, and removed after upstream support lands. Upstream tracking issue: https://github.com/AgentIron/iron-providers/issues/25.

## Risks / Trade-offs

- Upstream profile metadata may still be incomplete or incorrect for some providers -> fix provider protocol bugs in `iron-providers` rather than reintroducing AgentIron-local protocol overrides.
- Local `baseUrl` override may require upstream runtime/profile override support that is not yet exposed in the desired shape -> prefer a small upstream change over local profile duplication if the current API cannot express the override cleanly.
- Credential support metadata may remain duplicated across frontend display metadata, `iron-core` resolver support, and `iron-providers` profiles -> keep this change compatibility-focused and file/follow upstream work for a queryable provider capability surface.
- Model catalog identity may be ambiguous where OpenAI and Codex share `models.dev` metadata -> use deterministic mapping and explicitly test the affected providers.
- Temporary AgentIron-local profile definitions can drift if they persist too long -> track them with upstream issue https://github.com/AgentIron/iron-providers/issues/25 and remove them once `iron-providers` exposes the needed support.

## Migration Plan

1. Update crate dependencies and compile against the latest upstream provider APIs.
2. Replace local provider profile construction with registry-based construction.
3. Add provider slug propagation to `iron-core::Config`.
4. Add frontend/backend plumbing for the `local` `baseUrl` override.
5. Add or update provider presentation metadata for `local` and `ollama-cloud`.
6. Make model catalog mapping deterministic for shared `models.dev` provider IDs.
7. Document any temporary local profile exceptions and file upstream follow-up work.
8. Verify Rust and frontend checks.

Rollback is dependency-level: revert the dependency bump and associated provider construction changes if upstream APIs block implementation. Persisted settings should remain compatible because the intended new `baseUrl` field already exists in frontend provider configuration shape and only needs backend propagation.

## Open Questions

- Should `ollama-cloud` appear in the model catalog only when `models.dev` has matching entries, or should AgentIron provide a curated fallback model entry?
