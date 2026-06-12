## Context

The completed inventory found no hidden browser storage, Tauri store plugin, keychain/Stronghold persistence, or additional app-managed files. Persistent state is currently concentrated in `sqlite:agentiron.db`, plus explicit handoff bundle files chosen by the user.

`iron-core#58` introduced durable config APIs and a shared config database for CLI/headless and AgentIron. AgentIron should not write the core config database directly from the frontend or with app-owned SQL. Instead, AgentIron should use backend commands that call `iron-core` APIs.

Upstream API gaps are tracked in:

- `AgentIron/iron-core#67`: ConfigDb APIs for shared runtime settings.
- `AgentIron/iron-core#68`: ConfigDb APIs for custom model registry entries.
- `AgentIron/iron-core#69`: Core-managed handoff bundle storage APIs.

AgentIron should use `iron_core::config::ConfigStore::open()` for shared core config wherever possible. Avoid `open_at(...)` with an AgentIron-specific GUI path unless a concrete blocker appears, because shared CLI/headless behavior depends on all frontends using the same platform-default core config path.

## Ownership Boundary

```text
iron-core-owned shared runtime state
  providers
  credentials
  default model
  custom models
  MCP servers
  skills settings
  handoff API/storage

AgentIron-owned desktop/frontend state
  theme
  autostart preference
  quick-launch shortcut
  starred models
  user profile
  model registry cache
  Tauri config/data
  AgentIron-only agent configs/conversations/messages schema
```

## State Classification

| State | Current location | Target owner | Rationale |
| --- | --- | --- | --- |
| Provider config | `settings.providers` | `iron-core` | Provider selection and runtime setup are needed by CLI/headless. |
| Provider API keys | `settings.providers[].apiKey` | `iron-core` | Secrets should be core credential state, not frontend JSON settings. |
| OAuth credentials | `provider_credentials` | `iron-core` | Shared credential store should serve all frontends. |
| Default model | `settings.default_model` | `iron-core` | Runtime model selection should be shared. |
| Custom models | `settings.custom_models` | `iron-core` | Custom models are a core model catalog/override concept. |
| MCP servers | `settings.mcp_servers` | `iron-core` | Tool server configuration is runtime behavior. |
| Skills settings | `settings.skills` | `iron-core` | Skill discovery/trust policy affects runtime behavior and security. |
| Handoff API/storage | user-selected JSON via commands | `iron-core` | Core should expose and manage handoff persistence; AgentIron presents UI affordances. |
| Theme | `settings.theme` | AgentIron | Desktop/frontend presentation. |
| Autostart | `settings.autostart` | AgentIron | Tauri/OS shell integration. |
| Quick-launch shortcut | `settings.quick_launch_shortcut` | AgentIron | Tauri/global-shortcut UI behavior. |
| Starred models | `settings.starred_models` | AgentIron | Frontend favorite/preference state. |
| User profile | `settings.user_profile` | AgentIron | AgentIron profile UI state unless a future core identity model requires it. |
| Model registry cache | `settings.model_registry`, `settings.model_registry_updated` | AgentIron/cache | Cache of external catalog data, not durable user intent for this migration. |
| Agent configs | `agent_configs` | AgentIron | Schema-only today and explicitly retained by AgentIron. |
| Conversations | `conversations` | AgentIron | Schema-only today and explicitly retained by AgentIron. |
| Messages | `messages` | AgentIron | Schema-only today and explicitly retained by AgentIron. |
| Scheduled tasks | `scheduled_tasks` | Remove | Unused schema today; do not migrate dead state. |

## Access Model

- AgentIron SHALL remove frontend SQL access for core-owned state.
- AgentIron SHALL expose Tauri commands for reading/updating shared runtime state.
- Those commands SHALL call `iron-core` config APIs rather than using app-owned SQL against the core config store.
- AgentIron MAY keep a small app-local settings store for frontend/desktop-specific state.
- AgentIron SHALL keep Tauri configuration, capabilities, plugins, and OS-shell integrations in the app repo.
- AgentIron SHALL use `ConfigStore::open()` for shared core config so AgentIron and CLI/headless consumers observe the same platform-default store.

## Scope Decisions

- The fetched model registry cache remains AgentIron-owned for this change.
- Custom model entries move to `iron-core`; fetched external registry/cache behavior does not.
- Model registry ownership/refactoring is tracked separately in AgentIron/AgentIron#57 and should not expand this migration.
- The `local` provider remains implicit by default. Migration should not create a persisted `local` provider config unless a future change requires explicit local-provider state.

## Migration Shape

1. Add or consume `iron-core` APIs for providers, credentials, default model, custom models, MCP servers, skills settings, and handoff storage.
2. Introduce backend command facades in AgentIron for the core-owned state.
3. Migrate existing `agentiron.db` values into core config once the core API exists.
4. Stop writing migrated keys to the AgentIron `settings` table.
5. Narrow frontend SQL permissions and app-local persistence to AgentIron-owned state.
6. Drop or otherwise remove the unused `scheduled_tasks` schema from AgentIron.

## Migration Policy

- Migrate old AgentIron values into `iron-core` only when the corresponding core value is absent.
- Do not overwrite existing core config by default.
- Record migration completion in `iron-core`, not only in the old AgentIron settings table.
- If an old default model is invalid or no longer present in the effective catalog, skip that default-model migration, preserve the rest of the migration, and fall back to the core/default model behavior.
- Delete migrated core-owned keys from AgentIron's settings persistence immediately after their successful migration.
- If the `iron-core` credential store cannot access or create its encryption key, block settings load and present an actionable error explaining how the user can provide `AGENTIRON_CONFIG_ENCRYPTION_KEY` or fix OS keyring access.

## Open Questions

- Whether `user_profile` eventually becomes a core identity/profile concept. For this change, it remains AgentIron-owned.
- Whether future model registry ownership should move behind core APIs is deferred to AgentIron/AgentIron#57.

## CLI/Headless Parity Note

AgentIron currently ships only as a Tauri desktop application (`src-tauri/src/main.rs` calls `agentiron_lib::run()`). There is no separate CLI or headless binary in this repository, so task 6.3 cannot be exercised end-to-end against an in-repo CLI consumer. Parity is structurally guaranteed because:

1. AgentIron uses `iron_core::config::ConfigStore::open()` for shared core config.
2. `iron-core` itself resolves the platform-default path for all consumers.
3. Backend commands and future CLI/headless consumers both read from `ConfigStore` / `load_runtime_settings()`.

When a CLI/headless binary is added, it should call `ConfigStore::open()` and `load_runtime_settings()` and compare results with AgentIron's backend commands as a manual smoke test.
