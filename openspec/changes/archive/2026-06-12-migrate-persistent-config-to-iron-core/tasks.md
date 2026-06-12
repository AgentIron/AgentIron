## 1. Upstream API Readiness

- [x] 1.1 Confirm `iron-core#58` exposes the base durable ConfigDb and credential APIs needed by AgentIron.
- [x] 1.2 File or update upstream `iron-core` issues for missing APIs needed by AgentIron: `iron-core#67`, `iron-core#68`, and `iron-core#69`.
- [x] 1.3 Confirm `iron-core#67` exposes shared runtime settings APIs for providers, default model, MCP servers, and skills settings.
- [x] 1.4 Confirm `iron-core#68` exposes custom model registry APIs.
- [x] 1.5 Confirm `iron-core#69` exposes core-managed handoff storage APIs.
- [x] 1.6 Update AgentIron's `iron-core` dependency once the required config APIs are available.

## 2. AgentIron Persistence Split

- [x] 2.1 Add an AgentIron-local persistence boundary for app-owned settings: theme, autostart, quick-launch shortcut, starred models, user profile, model registry cache, and retained AgentIron-only schema.
- [x] 2.2 Add backend command facades for core-owned state and route them through `iron-core` config APIs.
- [x] 2.3 Remove frontend direct SQL reads/writes for provider config, credentials, default model, custom models, MCP servers, skills settings, and handoff storage.
- [x] 2.4 Narrow Tauri SQL permissions so the frontend cannot mutate core-owned config state directly.
- [x] 2.5 Use `iron_core::config::ConfigStore::open()` for shared core config instead of an AgentIron-specific core config path.
- [x] 2.6 Keep model registry cache app-owned for this change and link AgentIron/AgentIron#57 as the follow-up for registry ownership refactoring.

## 3. State Migration

- [x] 3.1 Migrate existing provider config from `settings.providers` into `iron-core` config.
- [x] 3.2 Migrate existing API keys and OAuth credentials into `iron-core` credential storage.
- [x] 3.3 Migrate existing default model from `settings.default_model` into `iron-core` config.
- [x] 3.4 Migrate existing custom models from `settings.custom_models` into `iron-core` config.
- [x] 3.5 Migrate existing MCP servers from `settings.mcp_servers` into `iron-core` config.
- [x] 3.6 Migrate existing skills settings from `settings.skills` into `iron-core` config.
- [x] 3.7 Preserve AgentIron-owned settings in AgentIron-local persistence.
- [x] 3.8 Record migration completion in `iron-core` config storage.
- [x] 3.9 Preserve existing `iron-core` records instead of overwriting them with old AgentIron settings during migration.
- [x] 3.10 Skip invalid old default model values without aborting the rest of migration.
- [x] 3.11 Block settings load with an actionable keyring/env-var error if `iron-core` credential encryption is unavailable.
- [x] 3.12 Keep the `local` provider implicit by default during provider config migration.

## 4. Handoff Ownership

- [x] 4.1 Replace AgentIron-owned handoff file serialization/storage logic with `iron-core` handoff APIs.
- [x] 4.2 Keep AgentIron UI affordances for importing/exporting handoff bundles while delegating storage and bundle management to `iron-core`.

## 5. Schema Cleanup

- [x] 5.1 Remove the unused `scheduled_tasks` schema from AgentIron.
- [x] 5.2 Keep AgentIron-owned schema-only tables for `agent_configs`, `conversations`, and `messages` unless a future change reclassifies them.
- [x] 5.3 Remove migrated core-owned keys from AgentIron settings persistence immediately after each successful migration.

## 6. Verification

- [x] 6.1 Verify existing users' settings and credentials migrate without loss.
- [x] 6.2 Verify AgentIron can create agents using core-owned provider/default model/custom model/MCP/skills state.
- [x] 6.3 Verify CLI/headless and AgentIron observe the same core-owned runtime config.
- [x] 6.4 Run `cargo check --manifest-path src-tauri/Cargo.toml`.
- [x] 6.5 Run `pnpm lint`.
- [x] 6.6 Run `pnpm build`.
