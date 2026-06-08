## 1. Delete obsolete workflows

- [x] 1.1 Delete `.github/workflows/opencode.yml`
- [x] 1.2 Delete `.github/workflows/opencode-formal-review.yml`
- [x] 1.3 Delete `.github/workflows/pr-agent.yml`
- [x] 1.4 Delete `.github/scripts/submit-opencode-formal-review.mjs`
- [x] 1.5 Delete `.github/scripts/opencode-formal-review-prompt.md`

## 2. Rewrite pull request workflow

- [x] 2.1 Add `permissions: contents: read, pull-requests: write` to workflow level
- [x] 2.2 Remove the `validate` job (branch check and issue-reference enforcement)
- [x] 2.3 Update `rust-checks` job: pin toolchain to `1.96.0` via `dtolnay/rust-toolchain@master`
- [x] 2.4 Update `frontend-checks` job: switch to `pnpm/action-setup@v3` with pnpm `10`
- [x] 2.5 Add `cargo-audit` job: run `cargo audit` with `continue-on-error: true`, capture output to file
- [x] 2.6 Add `audit-comment` step using `actions/github-script@v7` to post/update audit report with HTML marker
- [x] 2.7 Update `pr-checks` gate to depend on `rust-checks`, `frontend-checks` (not `validate`)

## 3. Update release workflow

- [x] 3.1 Pin toolchain to `1.96.0` in `build-macos`, `build-windows`, `build-linux` jobs
- [x] 3.2 Switch all `pnpm/action-setup` to `v3` with pnpm `10` across all build jobs

## 4. Update project documentation

- [x] 4.1 Add pre-submit check requirements to `AGENTS.md`: `cargo fmt`, `cargo clippy -- -D warnings`, `cargo test`, `pnpm lint`, `pnpm build`

## 5. File upstream issues

- [x] 5.1 File issue on `AgentIron/iron-core` to pin Rust toolchain to `1.96.0` (https://github.com/AgentIron/iron-core/issues/55)
- [x] 5.2 File issue on `AgentIron/iron-providers` to update Rust toolchain from `1.91.0` to `1.96.0` (https://github.com/AgentIron/iron-providers/issues/33)
