# GitHub Releases Setup Guide

This guide explains how to automatically build and release your Roku Dev Studio for **macOS**, **Windows** and **Linux** using GitHub Actions.

## Prerequisites

- **Node.js 24.17 or newer** — both workflows pin `node-version: 24.17.0`, and the workspace packages declare `engines.node >= 24.17.0`.
- **App icons** are checked in at `apps/roku-dev-studio/assets/icon.icns` (macOS) and `assets/icon.ico` (Windows), with their sources in `icon.iconset/` and `ico-parts/` (PNG sizes rendered by `apps/roku-dev-studio/scripts/generate-icons.ts`). Nothing to create.
- **Hardened-runtime entitlements** are checked in at `apps/roku-dev-studio/entitlements.mac.plist` and wired through `build.mac.entitlements` / `entitlementsInherit`.
- **Repository secrets** for macOS signing + notarization — see [Code Signing](#code-signing) below. The mac release job fails fast without them.

## How to Create a Release

### Method 1: Using Git Tags (Recommended)

The release workflow accepts **either** an un-prefixed semver tag (`1.1.0`) **or** a v-prefixed one (`v1.1.0`). Pre-release suffixes (e.g. `1.1.0-rc.1`, `v1.1.0-beta.2`) are also accepted and are automatically marked as prereleases on GitHub. Pick one convention per repo and stick with it; this repo uses un-prefixed (`1.0.0`, `1.1.0`, …).

```bash
# 1. Update the desktop app's version
# Edit apps/roku-dev-studio/package.json: "version": "1.0.0" -> "1.1.0"
# (electron-builder reads this file; it determines the artifact filenames.)

# 2. Commit the version change
git add apps/roku-dev-studio/package.json
git commit -m "App | 1.0.0 ---> 1.1.0"

# 3. Create a version tag (un-prefixed convention used by this repo)
git tag 1.1.0
# Or, if you prefer the v-prefixed form:
# git tag v1.1.0

# 4. Push the commit and tag
git push origin main
git push origin 1.1.0
```

The GitHub Action will automatically:
1. Build the macOS app (DMG + zip, Apple Silicon only — signed and notarized)
2. Build the Windows app (Installer + Portable)
3. Build the Linux app (`.deb` and `.AppImage` for x64 and arm64)
4. Create a GitHub Release with all files attached, named `Roku Dev Studio v1.1.0` and pointing at whichever tag you pushed.

### Method 2: Manual Trigger

1. Go to your GitHub repository
2. Click **Actions** tab
3. Select **Build and Release** workflow
4. Click **Run workflow**
5. Enter the version number (e.g., `1.1.0`)
6. Click **Run workflow**

Manual dispatch always creates a `v`-prefixed tag on the release (e.g. `v1.1.0`), regardless of any existing un-prefixed tag. If you want the release attached to your existing un-prefixed tag, use Method 1 instead.

## Workflow Files

### `.github/workflows/release.yml`
Main release workflow — triggers on version tags or manual dispatch. Tag matching here uses **GitHub glob patterns** (not regex), and a semver guard step validates manual input before publishing. All three
platforms build via a single matrix job; artifacts are aggregated into one
GitHub Release by a follow-on `release` job.

Notes for maintainers (read these before changing the workflow):
- **`prepare` is CI-guarded in `apps/roku-dev-studio` and `roku-dev-studio-mcp`.**
  Each contains:
  ```js
  if (process.env.CI) process.exit(0);
  ```
  Without it, those packages' prepares race against
  `roku-dev-studio-api`'s prepare during `npm ci` (npm doesn't topologically
  order workspace prepares), and bundling fails with
  `Could not resolve '../../packages/roku-dev-studio-api/dist/lib/...'`.
  In CI the workflow builds mcp explicitly after `npm ci` (`api` and
  `remote-server` prepares are self-contained, so they run normally).
  `--ignore-scripts` does NOT solve this in npm 10+ —
  see [npm/cli#5856](https://github.com/npm/cli/issues/5856).
- **`build:mac`, `build:win`, `build:linux` are self-contained** and chain
  `build:bundle` → `clean:dist` → `electron-builder`. They do not rely on
  `prepare` having run.
- **`build.publish` stays populated (GitHub provider) and every packaging
  script passes `--publish never`.** The provider block is what makes
  electron-builder emit the updater metadata (`app-update.yml`,
  `latest-mac.yml`, `latest.yml`, `latest-linux*.yml`); nulling it out
  suppresses those files and breaks `checkForUpdates()` at runtime — that is
  how 1.2.0 shipped without them. `--publish never` keeps electron-builder
  from uploading anything itself: `build:win` / `build:linux` pass it inline
  and `build:mac` bakes it into `scripts/build/electron-builder-mac.ts`.
  Uploading is owned solely by `softprops/action-gh-release` in the
  `release` job.
- **All `uses:` references are pinned to full commit SHAs (org policy).**

### `.github/workflows/ci.yml`
Per-PR / per-push checks — workspace typecheck, unit tests, and per-package
smoke jobs (API package, remote server, Electron main bundle incl.
`verify:artifact-names`). Just
`actions/checkout` → `actions/setup-node` → `npm ci` → script per job, with
all actions SHA-pinned. The CI-guarded prepares above are sufficient — no
extra topological build is needed here because the smoke checks don't
consume the desktop app bundle.

## Release Outputs

Each release attaches the installers listed in the generated **Downloads** table plus the updater metadata electron-updater reads — `latest-mac.yml`, `latest.yml`, `latest-linux.yml` / `latest-linux-arm64.yml` and the `.blockmap` files. The workflow fills in the version from the tag (e.g. `v1.2.0` → `1.2.0`).

### Downloads

The **Downloads** table in the release body is **generated at release time from the assets actually uploaded** (one row per `.dmg` / `.zip` / `.exe` / `.deb` / `.AppImage`, grouped by platform), so it cannot drift from the real file names. Artifact file names come from `build.artifactName` in `apps/roku-dev-studio/package.json` (with `nsis` / `portable` overrides for the two Windows builds) — the single source of truth; `npm run verify:artifact-names -w roku-dev-studio` prints the exact names for every target and fails if two collide. Current scheme: `Roku-Dev-Studio-<version>-<arch>.<ext>`, with `Roku-Dev-Studio-Setup-…` / `Roku-Dev-Studio-Portable-…` for the Windows installer / portable build; x64 appears as `amd64` in `.deb` and `x86_64` in `.AppImage` names.

### Installation

**macOS**
1. Download the `.dmg` file (Apple Silicon)
2. Open the disk image
3. Drag the app to your Applications folder
4. Open the app — it is signed with a Developer ID certificate and notarized by Apple, so Gatekeeper opens it without any override.

**Windows**
1. Download the **Setup** `.exe` file
2. Run the installer
3. If you see "Windows protected your PC":
   - Click "More info"
   - Click "Run anyway"
4. Follow the installation wizard

**Note for Windows:** The app is not code-signed. Windows SmartScreen will show a warning initially.

**Linux**
- **Debian/Ubuntu:** Download the `.deb` file and install with `sudo dpkg -i filename.deb`
- **Other distros:** Download the `.AppImage` file, make it executable (`chmod +x filename.AppImage`), and run it


## Troubleshooting

### Build fails with "icon not found"
- Ensure `assets/icon.icns` and `assets/icon.ico` exist
- Check file permissions

### macOS app shows "damaged" on user's machine
- Release builds are signed + notarized, so this means the build ran without a Developer ID — a local `npm run build:mac` with no certificate (the release workflow fails fast if its secrets are missing)
- Verify: `spctl -a -vv -t exec "/Applications/Roku Dev Studio.app"` should print `source=Notarized Developer ID`
- Workaround for an unsigned build: `xattr -cr "/Applications/Roku Dev Studio.app"`

### Windows SmartScreen warning
- The app is unsigned (no code signing certificate)
- Users click "More info" → "Run anyway"

## Code Signing

### macOS (required — the mac release job fails without these)
1. Get an Apple Developer account ($99/year) and create a "Developer ID Application" certificate; export it from Keychain Access as `.p12`
2. Create an [app-specific password](https://appleid.apple.com/account/manage) for your Apple ID
3. Add repository secrets (Settings → Secrets and variables → Actions):
   - `CSC_LINK` - the `.p12`, base64 encoded: `base64 -i DeveloperID.p12 | pbcopy`
   - `CSC_KEY_PASSWORD` - the `.p12` password
   - `APPLE_ID` - your Apple ID email
   - `APPLE_APP_SPECIFIC_PASSWORD` - the app-specific password
   - `APPLE_TEAM_ID` - 10-character Team ID (developer.apple.com → Membership details; also in the certificate's parentheses)

electron-builder signs, notarizes via `notarytool` and staples the ticket itself (`build.mac.notarize: true`); there is no hook code. Local setup: `INSTALLATION.md` → macOS.

### Windows (optional)
1. Purchase a code signing certificate (from DigiCert, Sectigo, etc.)
2. Add to GitHub secrets:
   - `WIN_CSC_LINK` - Base64 encoded certificate
   - `WIN_CSC_KEY_PASSWORD` - Certificate password
3. Map them into the build job: the workflow does not read `WIN_CSC_*` yet — add both to the `env:` block in `.github/workflows/release.yml`, scoped to the Windows leg the same way `CSC_*` are scoped to the mac leg.

## Quick Start Checklist

- [ ] Add the five macOS signing / notarization secrets (see [Code Signing](#code-signing))
- [ ] Bump `version` in `apps/roku-dev-studio/package.json` (and in any package that changed); add the release notes to `CHANGELOG.md`
- [ ] `npm run verify:artifact-names -w roku-dev-studio` passes
- [ ] Push to GitHub
- [ ] Create and push a version tag (e.g., `git tag 1.0.0 && git push origin 1.0.0`, or the v-prefixed `v1.0.0` form — both are accepted)
- [ ] Check Actions tab for build progress
- [ ] Find release in Releases tab when complete