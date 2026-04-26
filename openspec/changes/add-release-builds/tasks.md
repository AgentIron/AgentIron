## 1. Workflow and Configuration

- [x] 1.1 Create `.github/workflows/release.yml` with macOS, Windows, and Linux build jobs triggered on `v*` tag push
- [x] 1.2 Update `src-tauri/tauri.conf.json` with bundle metadata (copyright, category, shortDescription, longDescription)
- [x] 1.3 Verify `bundle.targets` is configured to produce `.dmg`, `.msi`, `.exe`, `.deb`, and `.AppImage`

## 2. macOS Signing Setup

- [x] 2.1 Document required repository secrets for macOS signing in README
- [x] 2.2 Add macOS job steps: install Apple certificate, build with signing, notarize `.dmg`
- [x] 2.3 Configure macOS job to build for `aarch64` only (Apple Silicon)

## 3. Windows Signing Setup

- [x] 3.1 Document required repository secrets for Windows signing in README
- [x] 3.2 Add Windows job steps: install signing certificate, build signed `.msi` and `.exe`

## 4. Linux Build Setup

- [x] 4.1 Add Linux job steps: install dependencies, build `.deb` and `.AppImage`
- [x] 4.2 Verify AppImage builds with correct permissions

## 5. Release and Documentation

- [x] 5.1 Configure workflow to create GitHub Release and upload artifacts
- [x] 5.2 Add installation instructions to README.md for macOS, Windows, and Linux
- [x] 5.3 Create GitHub issue to track auto-updater integration (deferred)
- [x] 5.4 Create GitHub issue to track Flatpak packaging (deferred)

## 6. Verification (Manual — requires actual hardware)

- [ ] 6.1 Push test tag (`v0.0.0-test`) and verify workflow triggers
- [ ] 6.2 Verify macOS artifact installs and runs on Apple Silicon Mac
- [ ] 6.3 Verify Windows artifact installs and runs on Windows x86_64
- [ ] 6.4 Verify Linux artifacts install and run on Ubuntu/Debian x86_64

> Tasks 6.1–6.4 require manual verification. They are intentionally left unchecked until tested.
