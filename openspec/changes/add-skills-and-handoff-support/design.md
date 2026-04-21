## Context

AgentIron already passes workspace roots into `iron-core`, which means it is close to a workable skill-discovery setup, but it never exposes the skill catalog or configures project-skill trust explicitly. It also supports only `/compact` even though `iron-core` can export a structured handoff bundle for portable continuity. Both features are upstream-ready but unused in the desktop product.

## Goals / Non-Goals

**Goals:**
- Expose discovered skills, discovery diagnostics, and per-session activation controls.
- Make project-skill trust an explicit product choice instead of an accidental default.
- Add a minimal but usable handoff export/import workflow.

**Non-Goals:**
- Build a full cloud sync system for handoff bundles.
- Auto-activate arbitrary project skills without a trust decision.
- Replace existing message history persistence with handoff bundles.

## Decisions

- Treat project-level skills as opt-in trust from the UI.
  `iron-core` defaults to hiding project skills, and AgentIron should preserve that safety posture while making it configurable.
- Keep skill activation session-scoped.
  This matches the `iron-core` API and avoids hidden cross-tab behavior.
- Represent handoff bundles as explicit export/import actions rather than implicit autosave state.
  Portability is useful only if users can choose where the bundle goes.
- Surface skill diagnostics directly instead of silently dropping hidden or invalid skills.
  Discovery problems are actionable and otherwise hard to debug.

## Risks / Trade-offs

- [Trusting project skills expands the instruction surface] -> Require an explicit trust toggle and show the skill origin in the UI.
- [Handoff import/export can confuse users if treated like persistence] -> Label it as portable continuity, not normal chat history storage.
- [Skill diagnostics may expose noisy filesystem issues] -> Present warnings clearly but avoid blocking the happy path when the catalog still loads.

## Migration Plan

- Add backend skill and handoff commands first.
- Add settings support for project-skill trust and skill discovery refresh second.
- Add frontend skill activation and handoff actions once the backend contract is stable.

## Open Questions

- Whether handoff import should create a new tab automatically or allow replacing the current session.
- Whether user-level and project-level skills should be displayed in separate sections.
