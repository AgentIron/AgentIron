## Context

The current AgentIron worker creates one in-process agent per tab and exposes only prompt, approval, MCP, and compaction operations. `iron-core` additionally supports prompt cancellation, script activity events from `python_exec`, and stdio/TCP transports. AgentIron's type layer already mentions stdio and TCP, but the backend never honors those values.

## Goals / Non-Goals

**Goals:**
- Let users stop an active prompt cleanly.
- Surface script activity as first-class runtime activity rather than opaque tool output.
- Make transport selection real instead of aspirational in the frontend type model.

**Non-Goals:**
- Add every ACP method that `iron-core` may support in the future.
- Build a full remote-session management console for TCP transports.
- Redesign the entire chat activity presentation.

## Decisions

- Store the active prompt handle inside the worker while a prompt is running so cancellation can be routed safely.
- Forward script activity as a dedicated event type instead of trying to coerce it into status text.
- Support in-process first and only expose stdio/TCP options that AgentIron can configure correctly.
  Transport selection should not advertise unsupported parameters.
- Keep transport selection part of agent creation config rather than a runtime toggle.
  Changing transports requires a new connection model, not a live switch.

## Risks / Trade-offs

- [Prompt cancellation can race with completion] -> Treat cancellation as best-effort and reconcile frontend state when a completion event wins the race.
- [Script activity may generate noisy event streams] -> Aggregate repeated activity where possible and render concise summaries in the UI.
- [Transport support adds backend complexity and test surface] -> Implement one transport at a time behind a shared frontend selection model.

## Migration Plan

- Introduce prompt cancellation plumbing first because it is self-contained and low risk.
- Add script activity forwarding next using the same event infrastructure.
- Extend agent creation to support non-default transports only after the data contract and UI are in place.

## Open Questions

- Whether stdio and TCP should both ship in the first pass or whether stdio should land before TCP.
- How much script activity detail should be retained in chat history after the prompt completes.
