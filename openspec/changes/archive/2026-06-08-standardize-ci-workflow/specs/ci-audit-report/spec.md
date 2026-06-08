## ADDED Requirements

### Requirement: Non-blocking cargo audit on pull requests
The CI workflow SHALL run `cargo audit` on every pull request targeting `main` with `continue-on-error: true` so that dependency vulnerabilities do not block merging.

#### Scenario: PR has no vulnerabilities

- **WHEN** `cargo audit` reports no vulnerabilities
- **THEN** the step succeeds and posts or updates a PR comment with a short audit-clean summary

#### Scenario: PR has vulnerabilities

- **WHEN** `cargo audit` reports one or more vulnerabilities
- **THEN** the step posts or updates a PR comment with the full audit output for human review
- **AND** the overall PR check status is not affected

### Requirement: Single audit comment per PR
The CI workflow SHALL maintain exactly one audit report comment per pull request, identified by an HTML comment marker. On subsequent pushes, the workflow SHALL update the existing comment rather than creating a new one.

#### Scenario: First push to a PR

- **WHEN** a PR receives its first push and no audit comment exists
- **THEN** the workflow creates a new comment with the audit report

#### Scenario: Subsequent push to an existing PR

- **WHEN** a PR receives a new push and an audit comment already exists
- **THEN** the workflow updates the existing comment with the latest audit output

#### Scenario: Audit output exceeds GitHub comment limit

- **WHEN** the audit output exceeds 60,000 characters
- **THEN** the workflow SHALL truncate the output and append `[output truncated]`
- **AND** the 60,000-character threshold SHALL be treated as a conservative safety margin below GitHub's 65,536-character comment body limit, matching the workflow implementation that checks `rawOutput.length > 60000` and uses `slice(0, 60000)` before appending the truncation marker

### Requirement: Pinned Rust toolchain
All CI workflows that compile Rust code SHALL use `dtolnay/rust-toolchain@master` with `toolchain: 1.96.0`. Workflows that run Rust formatting or lint checks SHALL also install the `rustfmt` and `clippy` components.

#### Scenario: Pull request CI run

- **WHEN** the pull request workflow runs
- **THEN** the Rust toolchain is pinned to `1.96.0` with `rustfmt` and `clippy` components

#### Scenario: Release workflow run

- **WHEN** the release workflow runs
- **THEN** the Rust toolchain is pinned to `1.96.0`
