## Context

AgentIron is a Tauri desktop application with multiple version declarations and cross-platform release artifacts. The project currently has:

- `scripts/bump_version.py` to update `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
- `.github/workflows/release.yml` to build packages on `v*` tag pushes.
- `.github/workflows/release-patch.yml` to create release-bump PRs after pushes to `main`.
- `.github/workflows/release-manual.yml` to create release-bump PRs manually.

The release-bump PR pattern is policy-correct but operationally heavy. It creates extra PRs and review/check cycles after regular feature work has already passed branch protection.

The new model treats releases as deliberate maintainer actions. Normal PR merges do not trigger release preparation. A maintainer starts a release when enough changes have accumulated.

## Goals / Non-Goals

**Goals:**

- Provide a one-button manual release flow for patch, minor, and major releases.
- Update all repository version files during release.
- Commit the version bump directly to `main` using a narrow release automation identity.
- Tag the exact version-bump commit.
- Build macOS, Windows, and Linux packages from the tag.
- Upload packages to GitHub Releases.
- Make releases draft by default so artifacts can be sanity-checked before publishing.
- Remove post-merge automatic release PR creation.

**Non-Goals:**

- Releasing automatically on every PR merge.
- Creating release-bump PRs as the default release path.
- Changing the normal PR validation/review workflow.
- Implementing app auto-update.
- Changing package signing requirements beyond preserving the existing release build behavior.

## Proposed Flow

```
Normal development
══════════════════

Feature PR
   │
   ├─ PR Checks
   ├─ formal review
   └─ merge to main

No release automation runs here.
```

```
Manual release
══════════════

Maintainer runs workflow_dispatch
   │
   ▼
prepare-release
   │
   ├─ checkout main using release identity
   ├─ compute next version from selected bump type
   ├─ update package.json
   ├─ update src-tauri/Cargo.toml
   ├─ update src-tauri/tauri.conf.json
   ├─ verify only version files changed
   ├─ commit version bump to main
   └─ tag the version-bump commit
       │
       ├───────────────┬───────────────┐
       ▼               ▼               ▼
build-macos      build-windows     build-linux
       │               │               │
       └───────────────┼───────────────┘
                       ▼
              publish-release
```

## Workflow Structure

Use one authoritative manual release workflow, likely `.github/workflows/release-manual.yml`.

Inputs:

- `bump`: `patch | minor | major`, default `patch`.
- `draft`: boolean, default `true`.

Jobs:

1. `prepare-release`
   - Checkout `main` with `AGENTIRON_RELEASE_TOKEN`.
   - Verify the workflow is running against `main`.
   - Run `python scripts/bump_version.py <bump>`.
   - Read the new version.
   - Verify tag `v<version>` does not already exist.
   - Verify the only changed files are the expected version files.
   - Commit `chore(release): bump version to <version>`.
   - Push the commit directly to `main`.
   - Create and push tag `v<version>` pointing to the version-bump commit.
   - Output `version`, `tag`, and commit SHA.

2. `build-macos`, `build-windows`, `build-linux`
   - Depend on `prepare-release`.
   - Checkout the release tag, not floating `main`.
   - Build the existing Tauri artifacts for each platform.
   - Upload artifacts for the final publish job.

3. `publish-release`
   - Depend on all build jobs.
   - Download artifacts.
   - Create GitHub Release for the tag.
   - Upload artifacts.
   - Use `draft: true` by default.

## Release Identity and Branch Protection

Use a dedicated secret:

```
AGENTIRON_RELEASE_TOKEN
```

Preferred backing identity:

- GitHub App installation token, if practical.
- Fine-grained PAT from a machine user, if simpler.

Required repository permissions:

- Contents: read/write.
- Metadata: read.

The identity must be allowed to bypass the `main` branch PR requirement. This bypass should be treated as release infrastructure, not a general development path.

Because GitHub branch protection generally cannot restrict bypasses by file path or commit message, the workflow must enforce narrow behavior:

- Only run through `workflow_dispatch`.
- Only checkout/push `main`.
- Only stage:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
- Fail if any other file is modified.
- Use a fixed release commit message format.
- Fail if the target tag already exists.

## Tag and Build Coupling

Build jobs must checkout the tag produced by `prepare-release`. This guarantees uploaded packages match the version files and tag exactly.

Avoid depending on a separate tag-push workflow triggered by the release workflow. GitHub may suppress workflows triggered by `GITHUB_TOKEN`, and using a release token still creates unnecessary coupling between two workflows.

## Failure and Rerun Behavior

Initial implementation can keep recovery simple:

- If failure happens before the version commit, rerun normally.
- If failure happens after the tag is pushed, rerun should fail clearly because the tag exists.
- A future enhancement may add an explicit `existing_tag` or `resume_tag` input to rebuild/upload artifacts for an existing tag.

This keeps the first implementation simple while making partial-release failures visible and recoverable through manual intervention.

## Risks / Trade-offs

- **Protected-branch bypass risk**: The release identity can push to `main`. Mitigation: use a dedicated token/App and strict workflow guardrails.
- **Partial release risk**: A commit/tag could be created before platform builds fail. Mitigation: draft releases by default and document manual recovery; add resume support later if needed.
- **Workflow size**: One workflow will contain prepare, build, and publish jobs. Mitigation: preserve parallel platform jobs and avoid cross-workflow triggers.
- **Signing secrets missing**: Builds may fail if signing secrets are unavailable. Mitigation: preserve existing signed/unsigned behavior or explicitly fail with clear errors, depending on current release policy.

## Open Questions

- Should missing signing secrets produce unsigned packages, or fail the release?
- Should the workflow support an explicit `resume_tag` input in the first implementation?
- Should the release be draft-only, or allow a `draft` input to publish immediately?
- Should `.github/workflows/release.yml` be deleted entirely, or kept as an emergency tag rebuild workflow?
