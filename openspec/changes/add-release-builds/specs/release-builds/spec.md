## ADDED Requirements

### Requirement: AgentIron SHALL build release artifacts on version tag push
AgentIron SHALL produce installable release artifacts for macOS, Windows, and Linux when a version tag is pushed to the repository.

#### Scenario: Version tag is pushed
- **WHEN** a maintainer pushes a tag matching `v*`
- **THEN** GitHub Actions SHALL trigger a release workflow

#### Scenario: Workflow completes successfully
- **WHEN** the release workflow finishes
- **THEN** a GitHub Release SHALL exist with signed artifacts for all supported platforms

### Requirement: AgentIron SHALL produce signed macOS artifacts
AgentIron SHALL build and sign a `.dmg` installer for Apple Silicon macOS using an Apple Developer certificate and notarization.

#### Scenario: macOS artifact is produced
- **WHEN** the release workflow runs the macOS job
- **THEN** it SHALL produce a signed `.dmg` file suitable for distribution outside the App Store

#### Scenario: Unsigned build is rejected
- **WHEN** repository secrets for Apple signing are missing
- **THEN** the macOS build job SHALL fail with a clear error

### Requirement: AgentIron SHALL produce signed Windows artifacts
AgentIron SHALL build and sign `.msi` and `.exe` installers for Windows x86_64 using a code signing certificate.

#### Scenario: Windows artifacts are produced
- **WHEN** the release workflow runs the Windows job
- **THEN** it SHALL produce signed `.msi` and `.exe` files

#### Scenario: Unsigned Windows build is rejected
- **WHEN** repository secrets for Windows signing are missing
- **THEN** the Windows build job SHALL fail with a clear error

### Requirement: AgentIron SHALL produce Linux artifacts
AgentIron SHALL build `.deb` and `.AppImage` packages for Linux x86_64.

#### Scenario: Linux artifacts are produced
- **WHEN** the release workflow runs the Linux job
- **THEN** it SHALL produce `.deb` and `.AppImage` files

#### Scenario: AppImage is executable
- **WHEN** a user downloads the AppImage
- **THEN** it SHALL be executable after setting execute permissions

### Requirement: AgentIron SHALL provide installation documentation
AgentIron SHALL document how users install the application from release artifacts on each supported platform.

#### Scenario: User reads README
- **WHEN** a user reads the installation section of README.md
- **THEN** they SHALL find platform-specific instructions for installing from released artifacts
