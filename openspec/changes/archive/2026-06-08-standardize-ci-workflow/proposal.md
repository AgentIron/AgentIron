## Why

AgentIron's CI has accumulated multiple overlapping review bots (OpenCode, PR Agent/Gemini, OpenCode formal review) that duplicate effort and create noise on pull requests. The PR workflow enforces an issue-reference gate that blocks merges even for chore work. There is no dependency security scanning. The project needs a focused CI contract: required checks that agents must pass locally before pushing, non-blocking audit reports for human review, and a single external reviewer (CodeRabbit).

## What Changes

- Remove `opencode.yml`, `opencode-formal-review.yml`, and `pr-agent.yml` workflows (all code review bots).
- Remove the issue-reference enforcement gate from `pull-request.yml` (agents are still asked to reference issues, but CI does not block on it).
- Add `cargo audit` as a non-blocking step that posts a summary comment on pull requests.
- Pin Rust toolchain to `1.96.0` across CI workflows.
- Normalize `pnpm/action-setup` to `v3` with pnpm `10` across CI workflows.
- Add explicit `permissions:` blocks to all remaining workflows.
- Update `AGENTS.md` to require agents run `cargo fmt`, `cargo clippy`, `cargo test`, `pnpm lint`, and `pnpm build` before submitting PRs.
- File issues on `iron-core` and `iron-providers` to pin their Rust toolchain to `1.96.0`.

## Capabilities

### New Capabilities
- `ci-audit-report`: Non-blocking cargo audit step that posts a dependency security report as a PR comment for human review.

### Modified Capabilities
- `ci-pull-request`: PR workflow is simplified to required rust/frontend checks plus non-blocking audit, with no issue-reference enforcement and no embedded review bots.

## Impact

- `.github/workflows/pull-request.yml`: rewritten (remove validate job, add audit, pin toolchain, normalize pnpm, add permissions).
- `.github/workflows/release-manual.yml`: updated (pin toolchain, normalize pnpm).
- `.github/workflows/opencode.yml`: deleted.
- `.github/workflows/opencode-formal-review.yml`: deleted.
- `.github/workflows/pr-agent.yml`: deleted.
- `.github/scripts/submit-opencode-formal-review.mjs`: deleted (no longer referenced).
- `.github/scripts/opencode-formal-review-prompt.md`: deleted (no longer referenced).
- `AGENTS.md`: updated with pre-submit check requirements.
- Repository secrets `ZHIPU_API_KEY` and `GEMINI_API_KEY` become unused and can be removed from settings.
- Upstream issues filed on `AgentIron/iron-core` and `AgentIron/iron-providers`.
