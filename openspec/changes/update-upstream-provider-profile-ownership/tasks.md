## 1. Dependency Update

- [x] 1.1 Update `iron-core` and `iron-providers` dependency versions in `src-tauri/Cargo.toml`.
- [x] 1.2 Refresh the Rust lockfile and identify compile errors caused by upstream provider API changes.

## 2. Backend Provider Construction

- [x] 2.1 Remove local built-in provider profile construction from `src-tauri/src/commands/agent.rs`.
- [x] 2.2 Build provider runtime config from resolved credentials and construct providers through `ProviderRegistry::default().get(provider_id, runtime_config)`.
- [x] 2.3 Replace any old `ApiFamily`, `AuthStrategy`, or `GenericProvider` usage with upstream-compatible registry construction.
- [x] 2.4 Pass the selected provider slug into `iron-core::Config` with the upstream provider-name configuration API.

## 3. Local Provider Configuration

- [x] 3.1 Pass provider `baseUrl` from frontend provider settings through the `create_agent` Tauri command payload.
- [x] 3.2 Apply the `baseUrl` override only for the `local` provider while preserving the upstream default when no override is set.
- [x] 3.3 Add validation or error handling for invalid local provider base URLs at the narrowest appropriate boundary.

## 4. Provider Catalog and UI Metadata

- [x] 4.1 Add or update frontend provider metadata for `local` with no required API key and an editable `baseUrl`.
- [x] 4.2 Add or update frontend provider metadata for `ollama-cloud` with the credential behavior expected by upstream.
- [x] 4.3 Update model catalog provider mapping to avoid nondeterministic assignment when upstream profiles share a `models.dev` provider identity.

## 5. Verification

- [x] 5.1 Run `cargo check --manifest-path src-tauri/Cargo.toml`.
- [x] 5.2 Run `pnpm lint`.
- [x] 5.3 Run `pnpm build`.
- [x] 5.4 Run `graphify update .` after code changes are implemented.

## 6. Upstream Follow-up

- [x] 6.1 Document temporary AgentIron-local profile exceptions for direct `openai` registration and `local` `baseUrl` override sessions.
- [x] 6.2 File upstream `iron-providers` issue for direct OpenAI profile support and local provider runtime base URL override support: https://github.com/AgentIron/iron-providers/issues/25.
- [ ] 6.3 Remove the temporary AgentIron-local profile exceptions after upstream support lands.
