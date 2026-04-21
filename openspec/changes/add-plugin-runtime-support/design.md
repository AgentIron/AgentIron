## Context

AgentIron already constructs an `iron-core::Config` and a single in-process session per tab, but it does not configure `Config::plugins`, register plugin sources, or expose any plugin registry information to the frontend. The current Plugins settings pane is only a built-in tool list, which means plugin lifecycle work would otherwise have to be introduced as an invasive replacement later.

## Goals / Non-Goals

**Goals:**
- Turn on plugin runtime support in a way that is explicit and inspectable.
- Give the desktop app a stable backend command surface for plugin inventory and session enablement.
- Replace the placeholder plugins UI with a management view that reflects runtime state.

**Non-Goals:**
- Implement plugin OAuth or credential entry flows.
- Render plugin rich result views inside chat transcripts.
- Add remote plugin marketplace discovery.

## Decisions

- Use a runtime-managed plugin inventory rather than registering plugins ad hoc from the chat flow.
  This matches `iron-core`'s registry model and keeps plugin state aligned with session creation.
- Separate runtime plugin configuration from per-session enablement.
  AgentIron should register known plugins once, then allow each session to enable or disable them independently.
- Store plugin source configuration in AgentIron settings and pass a normalized snapshot into the worker.
  This keeps plugin registration deterministic and avoids coupling the worker to frontend persistence details.
- Expose plugin summaries through explicit Tauri commands instead of overloading tool-event streams.
  Inventory and status are query-oriented state, not prompt-scoped events.

## Risks / Trade-offs

- [Plugin source validation differs between local and remote plugins] -> Validate configuration before registration and surface actionable error messages in settings.
- [Plugin runtime startup adds session creation cost] -> Register plugins once per worker and cache registry state instead of repeating work during each prompt.
- [UI complexity grows quickly if plugin health and availability are mixed together] -> Model plugin runtime status, auth status, and session enablement as separate fields in frontend types.

## Migration Plan

- Add plugin configuration types and non-destructive settings persistence first.
- Introduce backend plugin registration and inventory commands behind the new settings data.
- Replace the placeholder Plugins pane with the real management UI once inventory is available.
- Keep existing builtin tool information visible in a separate section if needed, but stop presenting it as plugin support.

## Open Questions

- Whether AgentIron should auto-enable configured plugins for new sessions or require explicit per-plugin opt-in.
- Whether plugin installation should accept only local paths in the first pass or also support remote URLs with checksums.
