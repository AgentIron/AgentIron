## Why

AgentIron needs to update to the latest breaking `iron-core` and `iron-providers` releases without continuing to duplicate upstream provider protocol metadata. Moving provider profiles upstream reduces drift, unlocks newly added providers such as `local` and `ollama-cloud`, and makes future provider changes happen in the shared crates instead of the desktop app.

## What Changes

- Update AgentIron's `iron-core` and `iron-providers` dependencies to versions compatible with the upstream breaking provider-profile refactor.
- Remove AgentIron's local built-in provider profile match table from backend provider construction.
- Construct providers through upstream `ProviderRegistry` using provider slug, model, and resolved credentials supplied by AgentIron.
- Treat provider base URLs, API families, auth header strategies, provider quirks, endpoint purpose, and `models.dev` mappings as upstream-owned metadata.
- Pass the selected provider slug into `iron-core::Config` so provider-specific system prompt fragments can be applied upstream.
- Surface `ollama-cloud` as an upstream-backed provider in AgentIron.
- Surface `local` as an upstream-backed provider with a default base URL and a single overrideable `baseUrl` setting.
- Allow narrow temporary AgentIron-local profile definitions only for upstream compatibility gaps that are tracked for removal in `iron-providers`.
- Avoid introducing arbitrary custom provider creation or multiple named local endpoint profiles in this change.

## Capabilities

### New Capabilities
- `upstream-provider-profiles`: Covers AgentIron's use of upstream-owned provider profiles, provider registry construction, local provider base URL override behavior, and provider catalog integration for upstream-backed providers.

### Modified Capabilities

## Impact

- Backend provider construction in `src-tauri/src/commands/agent.rs`.
- Frontend provider settings and command payloads for passing a local `baseUrl` override.
- Model catalog refresh and provider mapping in `src-tauri/src/commands/models.rs`.
- Provider metadata surfaced in frontend settings/model selection code.
- Dependency versions in `src-tauri/Cargo.toml` and related lockfile updates.
- Verification with `cargo check --manifest-path src-tauri/Cargo.toml`, `pnpm lint`, and `pnpm build`.
- Upstream follow-up issue: https://github.com/AgentIron/iron-providers/issues/25.
