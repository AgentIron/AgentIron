## ADDED Requirements

### Requirement: Minimal workflow permissions
The pull request workflow SHALL declare explicit `permissions: contents: read, pull-requests: write` to follow least-privilege principles.

#### Scenario: PR workflow runs
- **WHEN** the pull request workflow is triggered
- **THEN** the workflow token has only `contents: read` and `pull-requests: write` permissions

### Requirement: Agent pre-submit checks documented
`AGENTS.md` SHALL instruct agents to run `cargo fmt`, `cargo clippy -- -D warnings`, `cargo test`, `pnpm lint`, and `pnpm build` locally before creating or updating pull requests.

#### Scenario: Agent reads AGENTS.md
- **WHEN** an agent reviews project rules in AGENTS.md
- **THEN** the agent finds explicit instructions to run all CI checks locally before submitting PRs

### Requirement: No automated code review in CI
The repository SHALL NOT contain any GitHub Actions workflows that perform automated code review. Code review is handled exclusively by the external CodeRabbit service.

#### Scenario: Review bot workflows removed
- **WHEN** the change is applied
- **THEN** `opencode.yml`, `opencode-formal-review.yml`, and `pr-agent.yml` do not exist in `.github/workflows/`

### Requirement: Normalized pnpm version
All CI workflows that install pnpm SHALL use `pnpm/action-setup@v3` with pnpm version `10`.

#### Scenario: Pull request workflow installs pnpm
- **WHEN** the frontend-checks job runs
- **THEN** pnpm is installed via `pnpm/action-setup@v3` with `version: "10"`

#### Scenario: Release workflow installs pnpm
- **WHEN** a build job in the release workflow runs
- **THEN** pnpm is installed via `pnpm/action-setup@v3` with `version: "10"`

## REMOVED Requirements

### Requirement: Issue reference enforcement
**Reason**: Issue references are a workflow convention, not a merge gate. Agents are instructed to reference issues, but CI should not block merges on this.
**Migration**: The `validate` job's issue-reference check is removed from `pull-request.yml`. AGENTS.md guidance replaces the enforcement.

## MODIFIED Requirements

### Requirement: Required PR checks
The pull request workflow SHALL require that `rust-checks` (cargo fmt, clippy, build, test) and `frontend-checks` (pnpm lint, build) pass before merging. The `pr-checks` gate job SHALL aggregate these results.

#### Scenario: All checks pass
- **WHEN** rust-checks and frontend-checks both succeed
- **THEN** the pr-checks gate job passes and the PR is mergeable

#### Scenario: A required check fails
- **WHEN** any of rust-checks or frontend-checks fails
- **THEN** the pr-checks gate job fails and the PR cannot be merged
