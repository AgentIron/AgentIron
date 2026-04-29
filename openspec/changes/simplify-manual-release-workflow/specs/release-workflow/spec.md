## ADDED Requirements

### Requirement: AgentIron SHALL provide a manual direct release workflow

AgentIron SHALL provide a maintainer-triggered workflow for creating versioned releases without requiring release-bump pull requests.

#### Scenario: Maintainer starts a patch release

- **WHEN** a maintainer runs the manual release workflow with `bump` set to `patch`
- **THEN** the workflow SHALL compute the next patch version from the repository version files
- **AND** update `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`

#### Scenario: Maintainer starts a minor or major release

- **WHEN** a maintainer runs the manual release workflow with `bump` set to `minor` or `major`
- **THEN** the workflow SHALL compute the corresponding semantic version bump
- **AND** update all repository version files consistently

### Requirement: Release automation SHALL commit version metadata directly to main

AgentIron release automation SHALL commit release version metadata directly to `main` using a dedicated release identity that is allowed to bypass the protected-branch pull request requirement.

#### Scenario: Version bump is committed

- **WHEN** the release workflow has updated version files
- **THEN** it SHALL commit only `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`
- **AND** push the commit directly to `main` using the configured release identity

#### Scenario: Unexpected files are modified

- **WHEN** files other than the approved version files are modified before the release commit
- **THEN** the workflow SHALL fail before pushing to `main`

### Requirement: AgentIron SHALL tag the exact release commit

AgentIron SHALL create a version tag pointing to the exact commit that contains the release version metadata.

#### Scenario: Version commit is pushed

- **WHEN** the release version commit has been pushed to `main`
- **THEN** the workflow SHALL create tag `v<version>` at that commit
- **AND** push the tag to GitHub

#### Scenario: Tag already exists

- **WHEN** tag `v<version>` already exists
- **THEN** the workflow SHALL fail before creating a duplicate release

### Requirement: AgentIron SHALL build release packages from the release tag

AgentIron SHALL build platform packages from the generated release tag so artifacts match the published version.

#### Scenario: Release tag is created

- **WHEN** tag `v<version>` has been pushed
- **THEN** macOS, Windows, and Linux build jobs SHALL checkout that tag
- **AND** build their platform packages from that tag

#### Scenario: Platform artifacts are produced

- **WHEN** all platform build jobs complete successfully
- **THEN** the workflow SHALL have uploadable artifacts for supported package formats

### Requirement: AgentIron SHALL publish GitHub Releases with built artifacts

AgentIron SHALL create a GitHub Release for the generated tag and upload all platform artifacts.

#### Scenario: Release publishing succeeds

- **WHEN** all platform artifacts have been built
- **THEN** the workflow SHALL create a GitHub Release for tag `v<version>`
- **AND** upload macOS, Windows, and Linux artifacts
- **AND** include generated release notes

#### Scenario: Draft release is requested

- **WHEN** the workflow `draft` input is true
- **THEN** the GitHub Release SHALL be created as a draft

## MODIFIED Requirements

### Requirement: AgentIron SHALL build release artifacts on version tag push

AgentIron currently builds release artifacts on pushed version tags. This behavior SHALL be superseded by the manual release workflow unless a separate tag rebuild workflow is intentionally retained.

#### Scenario: Manual release creates a tag

- **WHEN** the manual release workflow creates tag `v<version>`
- **THEN** package builds SHALL occur in the same workflow run
- **AND** the release process SHALL NOT depend on a second workflow being triggered by the tag push

### Requirement: AgentIron SHALL not create automatic release-bump PRs after normal merges

AgentIron SHALL not create release-bump pull requests as a side effect of every merge to `main`.

#### Scenario: Feature PR is merged

- **WHEN** a normal feature or fix PR is merged to `main`
- **THEN** AgentIron SHALL NOT automatically create a release-bump PR
- **AND** release preparation SHALL wait for an explicit maintainer-triggered release workflow run
