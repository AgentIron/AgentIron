## 1. Release Workflow Simplification

- [x] 1.1 Remove post-merge automatic patch release behavior from `.github/workflows/release-patch.yml`, or delete the workflow entirely.
- [x] 1.2 Replace `.github/workflows/release-manual.yml` with a single manual release workflow driven by `workflow_dispatch`.
- [x] 1.3 Add workflow inputs for `bump` (`patch`, `minor`, `major`) and `draft` (default `true`).
- [x] 1.4 Reuse `scripts/bump_version.py` to update `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.

## 2. Release Identity and Guardrails

- [x] 2.1 Document required `AGENTIRON_RELEASE_TOKEN` secret and required repository permissions.
- [x] 2.2 Configure the workflow checkout/push steps to use `AGENTIRON_RELEASE_TOKEN` instead of the default `GITHUB_TOKEN` for protected `main` updates.
- [x] 2.3 Add guardrails that fail if files other than `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` are modified before the release commit.
- [x] 2.4 Fail if the computed release tag already exists.
- [x] 2.5 Use a fixed commit message format: `chore(release): bump version to <version>`.

## 3. Tagging and Build Jobs

- [x] 3.1 Push the version bump commit directly to `main` using the release identity.
- [x] 3.2 Create and push tag `v<version>` pointing to the version-bump commit.
- [x] 3.3 Build macOS packages from the release tag.
- [x] 3.4 Build Windows packages from the release tag.
- [x] 3.5 Build Linux packages from the release tag.
- [x] 3.6 Upload platform artifacts for the publish job.

## 4. GitHub Release Publishing

- [x] 4.1 Create a GitHub Release for the generated tag.
- [x] 4.2 Upload macOS, Windows, and Linux artifacts to the release.
- [x] 4.3 Create releases as drafts by default.
- [x] 4.4 Preserve generated release notes.

## 5. Cleanup and Documentation

- [x] 5.1 Remove release-bump PR exemption from `.github/workflows/pull-request.yml` if release PRs are no longer part of the workflow.
- [x] 5.2 Delete `.github/workflows/release.yml` if its tag-build behavior is fully folded into the manual workflow.
- [x] 5.3 Update README or contributing documentation with the new release procedure.
- [ ] 5.4 Close or supersede PRs/issues related to automatic release-bump PRs after this change is adopted.

## 6. Verification

- [x] 6.1 Validate workflow YAML formatting and parsing.
- [ ] 6.2 Run a dry-run or test release against a disposable version/tag if feasible.
- [x] 6.3 Confirm packages are built from the same tag that is published.
- [ ] 6.4 Confirm branch protection permits only the configured release identity to push the version bump.
