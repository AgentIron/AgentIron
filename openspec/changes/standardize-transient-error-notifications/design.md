## Context

AgentIron's global notification layer from issue #24 is already mounted around the main application tree and supports `info`, `success`, `warning`, and `error` notifications with deduplication and dismissal behavior. Issue #26 is the migration pass that replaces remaining user-relevant console-only failures with standardized notifications.

Some current failure sites already use the notification system, including tab creation, model registry updates, and skill catalog refresh failures. Other user actions still only log to the console. The main boundary is between transient action failures, persistent object health, and low-level diagnostics.

The main app can use `useNotification()` below `NotificationProvider`. `SettingsContext` currently wraps `NotificationProvider`, so settings persistence/load/auth-status failures cannot use that context without a provider-ordering change. `SnipOverlay` renders through a separate `/snip` entry path and is also outside the main notification provider.

## Goals / Non-Goals

**Goals:**

- Use global notifications for visible user-action failures that currently only log to the console.
- Keep console logging alongside notifications for developer diagnostics.
- Keep persistent MCP server health and diagnostics inline on MCP cards/details.
- Preserve the existing notification provider and toast primitives unless a narrow implementation gap is discovered.
- Keep the migration small enough to close issue #26 without reshaping provider hierarchy or overlay rendering.

**Non-Goals:**

- Reordering `SettingsProvider` and `NotificationProvider`.
- Adding a notification provider to the snip overlay window.
- Migrating `SettingsContext` persistence/load/auth-status failures to toasts.
- Migrating `SnipOverlay` capture/selection failures to toasts.
- Adding bulk aggregation for MCP hot-register failures.
- Replacing all console logging with notifications.

## Decisions

### Classify failures by user visibility and persistence

Failures will be treated according to the surface they represent:

```text
User clicked it and it failed
  -> toast plus console log

Persistent object is unhealthy
  -> inline state, with toast only for failed explicit actions

Background/system diagnostic
  -> console-only unless it blocks a visible flow
```

This avoids a noisy "toast everything" migration and keeps durable health state discoverable where users inspect the affected object.

### Notify at the action boundary

Components and contexts that handle direct user actions will trigger notifications in their `catch` blocks. This keeps messages close to the operation that failed and avoids broad error plumbing.

Examples include model switching, prompt cancellation, directory changes, skill activation/deactivation, MCP toggles/retries, and MCP server hot-registration after settings changes.

### Preserve inline MCP health state

MCP server connection errors, `lastError`, category, stage, and guidance remain inline in the MCP panel. Failed explicit MCP actions may also produce a toast, but the authoritative health state remains the server status.

### Leave selected contexts console-only for this slice

`SettingsContext` failures stay console-only because the context currently sits above `NotificationProvider`. Fixing that cleanly would be an architectural change beyond issue #26.

`SnipOverlay` failures stay console-only because the overlay renders through a separate `/snip` route outside the main provider. If overlay-specific notifications become important later, that should be scoped separately.

### Emit one MCP hot-register notification per affected tab

When saving MCP settings fails to register or update a server on multiple active tabs, each affected tab may produce its own notification. Aggregation or additional deduplication can be considered later if the real UX proves noisy.

## Risks / Trade-offs

- Some background failures remain invisible to users -> Mitigated by limiting console-only treatment to non-action diagnostics and explicitly documenting the boundary.
- One toast per failed MCP tab can be noisy -> Accepted for this slice; future aggregation can be tracked separately if needed.
- Context-level failures remain console-only -> Accepted to avoid provider-ordering churn while issue #26 is focused on action-level migration.
- Error messages may expose overly technical backend text -> Mitigated by using concise notification titles with raw error text only in message details, matching existing toast usage.

## Migration Plan

- Add notification usage only to components/contexts already below `NotificationProvider`.
- Keep existing console logging in migrated failure paths.
- Verify no normal app-flow `alert(...)` calls exist.
- Verify user-action console-only failures listed in issue #26 have in-app notification treatment unless explicitly excluded by this design.

## Open Questions

- Should a future follow-up aggregate repeated notifications across tabs or within a longer time window?
