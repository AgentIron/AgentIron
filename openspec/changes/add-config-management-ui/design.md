## Context

AgentIron is a Tauri 2 and SolidJS desktop client over shared `iron-core` configuration. The application already opens the platform-default core `ConfigStore`, but its UI exposes only provider, model, MCP, skill, and desktop settings. The Agents sidebar entry is inert, profile and prompt management commands do not exist, and the current provider settings path can return persisted API keys to JavaScript.

`iron-core` v0.1.35 provides `ConfigManagementService`, typed agent-profile and stored-prompt contracts, secret-safe credential summaries and mutations, delete-impact queries, per-record diagnostics, and non-destructive seeding for the ordinary shipped `explore`, `plan`, and `apply` profiles. AgentIron should adapt those contracts rather than reproduce schema, normalization, reference, or seed logic.

The core store is shared with CLI and headless consumers. AgentIron therefore cannot assume that records remain unchanged while a screen is open or that all records were created by this UI. Existing migration completion is represented by a fake profile record, which would leak into typed profile diagnostics and must move to a core metadata primitive.

## Goals / Non-Goals

**Goals:**

- Expose typed, graphical CRUD for agent profiles and stored prompts in the existing Agents workspace.
- Keep the frontend independent of raw core schema JSON and schema-version rules.
- Seed core-owned shipped profiles on first run without overwriting edits or recreating deliberate deletions.
- Prevent AgentIron from knowingly leaving no valid profile and provide explicit recovery after external deletion or corruption.
- Manage provider credentials without returning persisted secret material to JavaScript.
- Block shared configuration consistently when secure core initialization fails.
- Establish frontend component-integration testing around a mocked Tauri command boundary.

**Non-Goals:**

- Applying or switching profiles in chat sessions.
- Stored-prompt preview, execution, automation, or scheduling.
- A terminal UI or a general-purpose raw ConfigDb editor.
- Editing upstream-owned provider protocol profiles.
- Live database watching or cross-process optimistic concurrency in `iron-core`.
- Raw repair of malformed core records.
- Full packaged-desktop end-to-end testing.

## Decisions

### 1. Use one typed backend boundary for core-owned management

A dedicated Tauri command module will construct or access `ConfigManagementService` through managed core configuration state. It will expose serializable DTOs for profile entries, prompt entries, credential summaries, diagnostics, mutation results, seed reports, and delete impacts. DTO conversion will be explicit; frontend payloads will not contain arbitrary schema-versioned JSON.

Alternative considered: call lower-level `ConfigStore` record APIs. This would duplicate validation, normalized prompt identity, reference, and credential-redaction rules in AgentIron and make schema evolution a frontend concern.

### 2. Place profiles and prompts in the existing Agents workspace

The dormant Agents navigation item will open a workspace with Profiles and Prompts sections. Credentials remain in Settings > Providers because credentials describe provider readiness rather than agent identity. The workspace will use list-and-editor interactions with explicit Save and Cancel actions instead of persisting partial state on each input event.

Alternative considered: add all three capabilities as Settings sections. This hides the primary agent-configuration concepts among desktop settings and leaves the existing Agents navigation without purpose.

### 3. Delegate shipped profile definitions and seed state to iron-core

During shared-config initialization, AgentIron will invoke the core `FirstRunOnly` default-profile seed operation. Core remains the source of the `explore`, `plan`, and `apply` payloads and durable seed marker. Seeded records are ordinary editable and deletable profiles; AgentIron will not branch on their IDs or names.

AgentIron will reject a profile deletion when its latest loaded delete impact and a backend recheck show that the operation would leave zero valid profiles. Malformed records do not count as valid profiles. If startup or refresh observes zero valid profiles because another consumer changed the shared store, the Agents workspace will enter a blocking recovery state with an explicit Restore Default Profiles action backed by core `RestoreMissing` behavior.

This is an AgentIron operational invariant, not a claim that AgentIron can transactionally constrain every external ConfigDb client. A failed or stale deletion will be reported and followed by a refresh.

Alternative considered: silently restore defaults whenever none remain. That would violate core's deliberate deletion-preservation semantics and surprise users who intentionally removed shipped records.

### 4. Move migration completion out of the profile namespace

The existing `agentiron.migration.v1` fake profile marker will be replaced by durable core metadata or a domain-scoped core setting. Initialization will recognize the old marker, record equivalent metadata, and remove only that known migration record after successful conversion. Normal profile listing will not hide records based on name patterns.

Alternative considered: filter the marker from profile results. This would preserve namespace pollution, reserve an undocumented profile name, and conceal malformed data from other shared-store clients.

### 5. Preserve unknown references and surface typed diagnostics

The profile editor will present known providers, models, tools, and skills as suggestions while preserving valid unknown identifiers received from core. Unknown machine-local references will be shown as needs-attention diagnostics rather than discarded. Malformed or unsupported records will appear as diagnostic rows that can be inspected and deleted through typed operations, but raw JSON repair is out of scope.

Alternative considered: restrict editors to AgentIron's current static catalogs. Shared profiles can validly reference tools, skills, or providers available to another runtime, so such restriction would make portable configuration lossy.

### 6. Keep destructive operations explicit and non-cascading

Before deletion, AgentIron will request core-owned delete-impact information. Referenced profiles or prompts will not be silently cascaded, reassigned, or unassigned. The UI will identify dependents and require users to resolve references before retrying deletion. Provider configuration and provider credential deletion remain independent operations.

Alternative considered: cascade profile deletion into prompt updates. Hidden rewriting is risky in a shared store and obscures core referential-integrity errors.

### 7. Treat stored IDs as identity and names as editable labels

Prompt and profile records retain stable core IDs across edits and renames. Prompt normalized handles and collision rules come from core. The frontend may display immediate validation hints, but the backend result remains authoritative. A prompt has zero or one profile assignment, matching the core contract.

### 8. Never hydrate saved API keys into frontend state

Provider loading will return credential metadata and effective authentication status, never a persisted API-key value. The existing API-key input becomes a write-only field with Add or Replace labeling based on credential status. Set/replace and delete use dedicated typed commands. OAuth connection and status behavior remains intact, and the UI explains API-key precedence when both modes exist.

Alternative considered: preserve whole-provider JSON persistence for compatibility. That keeps secrets in long-lived frontend state and makes clearing an input ambiguous with deleting a credential.

### 9. Block all shared configuration after encryption initialization failure

If core configuration cannot initialize its credential encryption key, AgentIron will not expose partial profile, prompt, provider, or credential management. The shared configuration surfaces will display an actionable error describing keyring or `AGENTIRON_CONFIG_ENCRYPTION_KEY` remediation without including secret material. Desktop-only settings may remain available if their existing initialization path is independent.

### 10. Refresh at defined boundaries rather than watching the database

Management state will refresh when the workspace is entered, after every successful mutation, after recovery, and when the user requests refresh. Mutation conflicts or stale references will trigger an error and refresh. Unsaved editor state will not be silently replaced; the user must confirm discard before an entry refresh that would overwrite it.

Alternative considered: filesystem or SQLite watching. Cross-process ordering and partially committed state require a core-level synchronization design beyond this issue.

### 11. Add Solid component-integration tests with mocked commands

The frontend will add a Vite-compatible test runner, Solid component testing utilities, and a DOM environment. Tests will render real components and providers while mocking the typed command module rather than mocking Tauri globally in each test. Coverage will include navigation, loading, explicit save/cancel, validation, conflicts, zero-profile recovery, credential redaction and mutation, encryption failure, and refresh behavior.

Rust tests will cover DTO serialization, command mapping, seed/recovery mapping, last-valid-profile enforcement, delete conflicts, diagnostics, and proof that credential responses omit secrets. Packaged Tauri end-to-end automation remains out of scope.

## Risks / Trade-offs

- **Risk: AgentIron cannot globally enforce the nonzero-profile invariant against other processes.** -> Recheck before AgentIron deletion, refresh after mutations, and block normal management behind explicit recovery when zero valid profiles are observed.
- **Risk: DTOs drift from upstream core types.** -> Keep DTO conversion centralized and cover every variant with Rust serialization tests.
- **Risk: migration-marker conversion could rerun an old migration.** -> Record new metadata before deleting the known legacy marker and retain idempotency tests.
- **Risk: unknown references make forms harder to represent.** -> Use suggestion controls that retain custom values and render diagnostics separately from structural validation.
- **Risk: replacing credential persistence changes existing provider form behavior.** -> Preserve provider configuration independently, migrate existing keys through the established core credential store, and test API-key and OAuth precedence states.
- **Risk: component tests overfit presentation markup.** -> Assert accessible roles, labels, state transitions, and command interactions rather than CSS classes or internal component structure.

## Migration Plan

1. Add frontend test infrastructure and establish the mocked command boundary.
2. Replace the legacy profile marker with core metadata through an idempotent migration.
3. Add typed management DTOs, Tauri commands, and Rust adapter tests.
4. Invoke core first-run profile seeding during secure shared-config initialization.
5. Add Agents workspace navigation, profile management, prompt management, diagnostics, and recovery.
6. Replace API-key hydration and whole-object secret persistence with typed credential commands in Providers settings.
7. Add component-integration coverage and run all Rust and frontend checks.

Rollback may remove the new UI and command registrations without deleting core records. Seeded profiles are ordinary shared records and remain usable by other clients. The migrated metadata and removed legacy marker remain valid; rollback must not recreate the fake profile marker or move secrets back into frontend-visible provider JSON.

## Open Questions

No proposal-blocking questions remain. Profile selection for new chats and packaged desktop end-to-end testing are explicit follow-up topics.
