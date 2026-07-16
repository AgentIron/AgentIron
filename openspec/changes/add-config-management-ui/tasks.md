## 1. Frontend Test Foundation

- [x] 1.1 Add a Vite-compatible frontend test runner, Solid component testing utilities, DOM environment, and `pnpm test` scripts.
- [x] 1.2 Add shared test rendering helpers for application providers and a reusable mock for the typed Tauri command module.
- [x] 1.3 Add a smoke component test proving Solid rendering, user interaction, and mocked command responses work in CI.

## 2. Shared Configuration Initialization and Migration

- [x] 2.1 Replace the `agentiron.migration.v1` fake profile marker with durable core metadata while preserving idempotent migration completion.
- [x] 2.2 Add migration tests for legacy-marker conversion, metadata-first write ordering, repeated startup, and preservation of unrelated profile records.
- [x] 2.3 Invoke the core `FirstRunOnly` shipped-profile seed operation after secure shared-config initialization.
- [x] 2.4 Map encryption-key initialization failures to one actionable secret-safe shared-config error that blocks profile, prompt, provider, and credential management.
- [x] 2.5 Add initialization tests for first-run seeding, preservation of edited or deleted shipped profiles, and encryption failure.

## 3. Typed Backend Management Boundary

- [x] 3.1 Add serializable DTOs for profile entries, prompt entries, credential summaries, load diagnostics, delete impacts, seed reports, and typed mutation errors.
- [x] 3.2 Add Tauri commands over `ConfigManagementService` for profile list/get/save/delete and profile delete-impact queries.
- [x] 3.3 Add Tauri commands over `ConfigManagementService` for prompt list/get/create/save/rename/delete and prompt delete-impact queries.
- [x] 3.4 Add Tauri commands for credential summaries and typed API-key set/replace/delete operations without secret-bearing response fields.
- [x] 3.5 Add a recovery command backed by core `RestoreMissing` default-profile seeding.
- [x] 3.6 Recheck valid-profile count and dependency impacts at profile deletion time so AgentIron does not knowingly delete the last valid profile or a referenced profile.
- [x] 3.7 Register the management commands with Tauri and expose typed frontend wrappers in the shared command module.
- [x] 3.8 Add Rust tests covering DTO variants, serialization, diagnostics, stable IDs, delete conflicts, last-valid-profile rejection, recovery mapping, and credential redaction.

## 4. Frontend Management State and Navigation

- [x] 4.1 Extend application navigation so the existing Agents sidebar item opens an Agents workspace with Profiles and Prompts sections.
- [x] 4.2 Add shared management state for loading profiles, prompts, diagnostics, credential summaries, mutation errors, and refresh status through typed commands.
- [x] 4.3 Refresh management state on workspace entry, explicit refresh, successful mutation, and recovery while protecting dirty editors from silent replacement.
- [x] 4.4 Add blocking shared-config error presentation for encryption initialization failures and a zero-valid-profile recovery state.
- [x] 4.5 Add component-integration tests for Agents navigation, section switching, loading, refresh, dirty-state protection, encryption failure, and recovery routing.

## 5. Agent Profile Management UI

- [x] 5.1 Build profile list and diagnostic-row presentation that distinguishes valid, needs-attention, malformed, and unsupported records.
- [x] 5.2 Build explicit Save and Cancel profile forms for name, provider/model context, tool filter, skill filter, approval policy, and identity prompt.
- [x] 5.3 Preserve unknown provider, model, tool, and skill identifiers while presenting known catalog entries as suggestions.
- [x] 5.4 Present core validation and mutation errors on the relevant profile fields without discarding unsaved input.
- [x] 5.5 Add profile delete confirmation with dependent-record details and last-valid-profile protection.
- [x] 5.6 Add explicit Restore Default Profiles interaction using the typed recovery command.
- [x] 5.7 Add component-integration tests for profile creation, editing, cancellation, unknown references, diagnostics, conflicts, deletion, and default restoration.

## 6. Stored Prompt Management UI

- [x] 6.1 Build prompt list and diagnostic-row presentation for valid, needs-attention, malformed, and unsupported records.
- [x] 6.2 Build explicit Save and Cancel prompt forms for display name, instructions, requested skills, and optional stable profile assignment.
- [x] 6.3 Preserve stable prompt IDs across edits and renames and map normalized-handle collisions to the name field.
- [x] 6.4 Preserve unknown requested-skill and missing-profile references while displaying core diagnostics.
- [x] 6.5 Add prompt delete confirmation with dependent-record details and no automatic cascading or reassignment.
- [x] 6.6 Add component-integration tests for prompt creation, editing, rename collisions, profile assignment, unknown references, diagnostics, and deletion conflicts.

## 7. Secret-Safe Provider Credential UI

- [x] 7.1 Remove persisted API-key values from provider settings responses, frontend provider state, and whole-provider mutation payloads.
- [x] 7.2 Update Settings > Providers to render secret-safe credential and effective-authentication status from typed summaries.
- [x] 7.3 Replace the API-key editor with a write-only Add or Replace flow backed by the typed credential command.
- [x] 7.4 Add explicit API-key deletion without removing provider configuration and preserve credentials when provider configuration is removed.
- [x] 7.5 Preserve OAuth connect, disconnect, refresh, and precedence behavior while explaining the effective mode when OAuth and API key coexist.
- [x] 7.6 Audit logs, errors, events, and frontend state to ensure submitted and persisted secret values are not retained or rendered.
- [x] 7.7 Add component-integration tests for redacted status, add, replace, delete, independent provider lifecycle, OAuth coexistence, and secret-safe failures.

## 8. Verification

- [x] 8.1 Run frontend component tests and resolve all failures.
- [x] 8.2 Run `cargo fmt -- --check`, `cargo clippy -- -D warnings`, and `cargo test` in `src-tauri`.
- [x] 8.3 Run `pnpm lint` and `pnpm build`.
- [x] 8.4 Validate the OpenSpec change in strict mode and confirm every specified scenario has implementation or automated coverage.
