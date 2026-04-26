## Context

AgentIron is a Tauri v2 desktop application with no existing CI/CD infrastructure. The project currently requires users to build from source (Rust + pnpm). This change establishes the first release pipeline.

## Goals / Non-Goals

**Goals:**
- Produce signed, installable artifacts for macOS (Apple Silicon), Windows (x86_64), and Linux (x86_64) on every version tag push
- Ensure code signing works end-to-end for macOS and Windows
- Provide clear installation instructions for users downloading releases

**Non-Goals:**
- Auto-updater integration (deferred to future issue)
- Flatpak packaging (deferred to future issue)
- macOS x86_64 support (Apple Silicon only)
- App Store or Flathub distribution
- Nightly/continuous builds from main branch

## Decisions

- **GitHub Actions over other CI providers**: Native integration with GitHub releases, free for public repos, matrix build support across all three platforms.
- **Tag-driven releases only**: Simple mental model. Push `v0.1.0` tag → artifacts appear on Releases page. No complex branching strategies.
- **Apple Silicon only for macOS**: aarch64 is the current default for Apple hardware. x86_64 Macs are declining; omitting simplifies CI and reduces build time.
- **AppImage + deb for Linux**: AppImage is portable and works across distros. deb is native for Debian/Ubuntu users. Flatpak deferred.
- **MSI + NSIS for Windows**: MSI for corporate/quiet installs, NSIS exe for consumer-friendly installer. Both built by Tauri natively.
- **Repository secrets for signing**: macOS signing requires `APPLE_CERTIFICATE` (base64 p12), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`. Windows signing requires `WINDOWS_CERTIFICATE` (base64 pfx), `WINDOWS_CERTIFICATE_PASSWORD`.

## Risks / Trade-offs

- [Repository secrets not configured] → Build will fail on signing step. Mitigation: Document exact secret setup in README and verify with a test tag before public release.
- [Certificate expiration] → Signed builds break silently. Mitigation: Document renewal calendar, monitor expiration dates.
- [Apple notarization delays] → Release pipeline may timeout. Mitigation: Set generous timeout (30+ min) on macOS job, use `--wait` flag appropriately.
- [Linux AppImage permissions] → Users must `chmod +x` before running. Mitigation: Document in installation instructions.

## Migration Plan

1. Create GitHub Actions workflow file
2. Configure repository secrets (manual step by repository owner)
3. Update `tauri.conf.json` with proper bundle metadata
4. Push test tag (e.g., `v0.0.0-test`) to verify pipeline
5. Verify artifacts install and run on each platform
6. Document installation instructions in README

## Open Questions

- Should we publish a draft release automatically, or require manual approval?
- Do we want release notes auto-generated from commit messages?
