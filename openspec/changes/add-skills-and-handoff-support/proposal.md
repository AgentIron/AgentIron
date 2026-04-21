## Why

`iron-core` now supports skill discovery, activation, diagnostics, and portable session handoff bundles, but AgentIron exposes none of that behavior. As a result, repo-local skills are effectively invisible to users and session portability is limited to manual context compaction.

## What Changes

- Add backend support for skill catalog refresh, diagnostics, activation, and deactivation.
- Configure AgentIron skill trust and discovery in a way that can expose project and user skill directories intentionally.
- Add session handoff export and import commands so users can move context between sessions or save it for later resumption.
- Add frontend UX for skill management and handoff actions.

## Capabilities

### New Capabilities
- `skills-and-handoff-support`: AgentIron can manage `iron-core` skills and export or import portable session handoff bundles.

### Modified Capabilities

## Impact

- Agent creation config in `src-tauri/src/commands/agent.rs`
- Worker/session commands in `src-tauri/src/state.rs`
- Settings and chat UI surfaces for skills and handoff actions
- Potential persistence or file export UX for handoff bundles
