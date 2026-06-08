## Context

AgentIron uses GitHub Actions for CI/CD. The current `pull-request.yml` runs required Rust and frontend checks behind a validation gate that enforces issue references in PR titles or bodies. Three additional workflow files run automated code review bots (OpenCode interactive, OpenCode formal review, PR Agent/Gemini). Code review is now handled exclusively by the external CodeRabbit service, making the GitHub Actions review bots redundant. The project has no dependency security scanning.

The upstream `iron-providers` crate has a more mature CI pattern with pinned toolchains, `cargo audit`, and structured reporting that serves as the reference for this change.

## Goals / Non-Goals

**Goals:**
- Establish a clear CI contract: required checks that must pass before merge, plus advisory checks for human review.
- Remove all automated code review from GitHub Actions (CodeRabbit handles this externally).
- Add dependency security auditing as a non-blocking PR report.
- Pin the Rust toolchain for reproducible builds.
- Normalize tooling versions across all CI workflows.
- Document agent pre-submit requirements in AGENTS.md.

**Non-Goals:**
- Changing the release workflow structure (covered by the existing `simplify-manual-release-workflow` change).
- Adding JavaScript/TypeScript unit tests (no test runner is configured; adding one is a separate change).
- Changing branch protection rules (the required status check "PR Checks" already gates merges).

## Decisions

### Pin Rust toolchain to 1.96.0

Use `dtolnay/rust-toolchain@master` with `toolchain: 1.96.0` in all workflows. This matches the local development version and provides reproducible CI. Iron-providers currently pins `1.91.0`; issues will be filed to align all three repos.

**Alternative considered:** Use `stable` (current approach). Rejected because `stable` rolls forward automatically and can introduce unpredictable CI failures.

### cargo audit as non-blocking PR comment

Run `cargo audit` with `continue-on-error: true`, capture output, and post it as a PR comment using `actions/github-script@v7`. Use an HTML comment marker (`<!-- cargo-audit-report -->`) to find and update the comment on subsequent pushes rather than creating duplicates.

**Alternative considered:** Run audit as a blocking required check. Rejected because dependency vulnerabilities should not block development velocity; they are advisory for human review.

### Remove all three review bot workflows

Delete `opencode.yml`, `opencode-formal-review.yml`, and `pr-agent.yml`. CodeRabbit is the sole code review service. The OpenCode bot is useful interactively but redundant as an automated reviewer.

**Alternative considered:** Keep OpenCode bot as interactive-only (respond to `@opencode` mentions). Rejected to simplify the CI surface — the bot can be re-added later if interactive CI assistance is wanted.

### Normalize pnpm to v3 action with pnpm 10

Use `pnpm/action-setup@v3` with `version: "10"` in all workflows. Current workflows mix `v2`/pnpm 9 and `v3`/pnpm 10.

### Remove issue-reference enforcement, keep agent guidance

The `validate` job in `pull-request.yml` blocks merges if the PR title or body does not contain "Closes/Fixes/Resolves #N". Remove this CI gate. AGENTS.md will instruct agents to reference issues or mark PRs as chores, but this is a workflow convention, not a merge requirement.

### Minimal permissions on all workflows

Add explicit `permissions:` blocks to `pull-request.yml` and `release-manual.yml`. The PR workflow needs `contents: read` and `pull-requests: write` (for audit comments). The release workflow already has appropriate permissions.

## Risks / Trade-offs

- **[Toolchain drift]** If a future Rust version introduces breaking changes that affect the build, all three repos need coordinated toolchain bumps. → Mitigation: file issues proactively; toolchain pin is a single line to update.
- **[Audit noise on large PRs]** Every push to a PR triggers the audit comment update. → Mitigation: the marker-based find-or-update pattern keeps it to one comment per PR.
- **[Removing OpenCode bot removes interactive CI capability]** Users can no longer `@opencode` in PR comments to trigger CI actions. → Mitigation: acceptable trade-off; bot can be re-added if needed.
- **[Unused secrets]** `ZHIPU_API_KEY` and `GEMINI_API_KEY` become unused. → Mitigation: note in proposal impact; clean up in repo settings after merge.
