## Why

AgentIron's release automation has become too complex for the desired release cadence. The current post-merge patch release approach creates follow-up release PRs, which preserves branch protection but adds extra review/check cycles after normal feature PRs are already merged. This makes patch releases feel like a second development workflow instead of a lightweight release operation.

The project needs a deliberate, maintainer-triggered release process that is simple to operate: choose a bump type, update version files, tag the release, build platform packages, and upload them to GitHub Releases.

## What Changes

- Replace post-merge automatic patch release behavior with a manual release workflow.
- Allow a narrow release automation identity to bypass protected-branch PR requirements for version metadata commits only.
- Collapse release preparation and package publishing into one intentional workflow run.
- Update version files in the repository as part of the release:
  - `package.json`
  - `src-tauri/Cargo.toml`
  - `src-tauri/tauri.conf.json`
- Tag the exact version-bump commit.
- Build macOS, Windows, and Linux packages from the release tag.
- Upload built packages to a GitHub Release, draft by default.
- Remove release-bump PR creation as the normal release path.

## Capabilities

### New Capabilities

- `release-workflow`: AgentIron provides a manual direct release workflow that bumps versions, tags releases, builds packages, and uploads release artifacts.

### Modified Capabilities

- `release-builds`: Release artifacts are built from tags created by the manual release workflow, not from separate post-merge release PRs.

## Impact

- Replace or heavily simplify `.github/workflows/release-manual.yml`.
- Delete `.github/workflows/release-patch.yml` if no longer needed.
- Fold `.github/workflows/release.yml` tag-build behavior into the manual release workflow, or keep it only if the release token can trigger tag workflows reliably.
- Keep using `scripts/bump_version.py` for semver file updates.
- Requires branch protection/ruleset configuration allowing a dedicated release identity to bypass PR requirements on `main`.
- Requires a repository secret for the release identity, preferably `AGENTIRON_RELEASE_TOKEN` backed by a narrowly scoped GitHub App or fine-grained PAT.
