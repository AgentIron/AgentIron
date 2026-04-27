## Why

AgentIron currently has no automated build or release infrastructure. Users must build from source, which limits adoption. Setting up signed, tag-driven release builds for macOS, Windows, and Linux makes the project immediately usable without requiring a development environment.

## What Changes

- Add GitHub Actions workflow that builds signed release artifacts on version tag push
- Configure code signing for macOS (Apple Developer certificate + notarization) and Windows (code signing certificate)
- Produce `.dmg` for macOS (Apple Silicon only), `.msi`/`.exe` for Windows, `.deb` and `.AppImage` for Linux
- Update `tauri.conf.json` with bundle metadata (copyright, category, descriptions)
- Create `README` section documenting how users install from released artifacts
- File GitHub issue to track future auto-updater integration (deferred)
- File GitHub issue to track future Flatpak packaging (deferred)

## Capabilities

### New Capabilities
- `release-builds`: AgentIron produces signed, installable release artifacts for macOS, Windows, and Linux via GitHub Actions on tag push

### Modified Capabilities

## Impact

- New `.github/workflows/release.yml` CI workflow
- Changes to `src-tauri/tauri.conf.json` for bundle metadata
- New documentation in `README.md` for installation
- Requires repository secrets for signing certificates (APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID, WINDOWS_CERTIFICATE, WINDOWS_CERTIFICATE_PASSWORD)
- No application code changes; purely build/packaging infrastructure
