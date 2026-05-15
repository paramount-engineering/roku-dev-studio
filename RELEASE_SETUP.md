# GitHub Releases Setup Guide

This guide explains how to automatically build and release your Roku Dev Studio for both **macOS** and **Windows** using GitHub Actions.

## Prerequisites

### 1. App Icons (Required)

You need to create app icons in the `assets/` folder:

**For macOS:** `assets/icon.icns`
- Resolution: 1024x1024 px (and lower sizes embedded)
- Format: Apple Icon Image format

**For Windows:** `assets/icon.ico`
- Resolution: 256x256 px (and lower sizes embedded)
- Format: Windows Icon format

**How to create icons:**

Option A - Use online converter:
1. Create a 1024x1024 PNG image
2. Go to https://cloudconvert.com/png-to-icns
3. Convert to `.icns` for macOS
4. Go to https://cloudconvert.com/png-to-ico
5. Convert to `.ico` for Windows

Option B - Use command line (macOS):
```bash
# Create iconset folder
mkdir icon.iconset

# Create different sizes (from your 1024x1024 source image)
sips -z 16 16     icon-1024.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon-1024.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon-1024.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon-1024.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon-1024.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon-1024.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon-1024.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon-1024.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon-1024.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon-1024.png --out icon.iconset/icon_512x512@2x.png

# Convert to icns
iconutil -c icns icon.iconset -o assets/icon.icns
```

### 2. Entitlements File

Create `entitlements.mac.plist` in the root folder (if not exists):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
</dict>
</plist>
```

## How to Create a Release

### Method 1: Using Git Tags (Recommended)

The release workflow accepts **either** an un-prefixed semver tag (`1.1.0`) **or** a v-prefixed one (`v1.1.0`). Pre-release suffixes (e.g. `1.1.0-rc.1`, `v1.1.0-beta.2`) are also accepted. Pick one convention per repo and stick with it; this repo uses un-prefixed (`1.0.0`, `1.1.0`, …).

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
1. Build the macOS app (DMG for both Intel and Apple Silicon)
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
Main release workflow — triggers on version tags or manual dispatch. All three
platforms build via a single matrix job; artifacts are aggregated into one
GitHub Release by a follow-on `release` job.

Notes for maintainers:
- Build steps install with `npm ci --ignore-scripts`, then `npm rebuild`, then
  explicitly build workspace packages in dependency order
  (`api → mcp → remote-server → app`). This is intentional: npm does not
  guarantee topological ordering of workspace `prepare` scripts during
  `npm ci`, and the desktop app's preload bundle requires
  `roku-dev-studio-api/dist/` to already exist.
- The electron + electron-builder download caches are persisted across runs
  (~150 MB per platform), keyed on the lockfile and `apps/roku-dev-studio/package.json`.
- Do **not** add `-- --publish never` to the build commands. Root-level
  scripts re-invoke npm via `npm --prefix apps/roku-dev-studio run build:*`,
  and the inner npm strips the `--publish` flag, leaving a stray `never`
  that electron-builder treats as a target name. Publishing is handled by
  `softprops/action-gh-release` in the `release` job — electron-builder
  itself never publishes.
- All `uses:` references are pinned to full commit SHAs (org policy).

### `.github/workflows/ci.yml`
Per-PR / per-push smoke checks (typecheck + per-package syntax). Uses the
same `npm ci --ignore-scripts` + `npm rebuild` + explicit workspace-build
pattern as the release workflow, so contributors can't get bitten by the
prepare-ordering race.

## Release Outputs

Each release will include the artifacts listed in the **Downloads** table below. On GitHub Releases, the workflow automatically fills in the version from the tag (e.g. `v1.2.0` → `1.2.0`), so the release notes show the correct filenames. The table here is a reference for the artifact naming pattern.

### Downloads

| Platform | Intel/x64 | ARM64/Apple Silicon |
|----------|-----------|----------------------|
| **macOS** | Roku Dev Studio-VERSION.dmg | Roku Dev Studio-VERSION-arm64.dmg |
| **Windows** | Roku Dev Studio Setup VERSION.exe, Roku Dev Studio VERSION.exe (portable) | - |
| **Linux** | roku-dev-studio_VERSION_amd64.deb, Roku Dev Studio-VERSION-x86_64.AppImage | roku-dev-studio_VERSION_arm64.deb, Roku Dev Studio-VERSION-arm64.AppImage |

*(VERSION is replaced automatically in the release body; in this doc it just shows the naming pattern.)*

### Installation

**macOS**
1. Download the appropriate `.dmg` file for your Mac
2. Open the disk image
3. Drag the app to your Applications folder
4. **IMPORTANT - Before first launch:**
   - Use Terminal: `xattr -cr "/Applications/Roku Dev Studio.app"`
   - Then open the app.

**Note for macOS:** The app is not code-signed. macOS Gatekeeper will block it. The command above removes quarantine attributes.

**Windows**
1. Download the Setup `.exe` file
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
- The app is unsigned (no Apple Developer certificate)
- Users need to right-click → Open on first launch
- Or run: `xattr -cr /Applications/Roku\ App\ Connector.app`

### Windows SmartScreen warning
- The app is unsigned (no code signing certificate)
- Users click "More info" → "Run anyway"

## Code Signing (Optional, for Production)

For a professional release without security warnings:

### macOS
1. Get an Apple Developer account ($99/year)
2. Create a "Developer ID Application" certificate
3. Add secrets to GitHub:
   - `APPLE_CERTIFICATE` - Base64 encoded .p12 certificate
   - `APPLE_CERTIFICATE_PASSWORD` - Certificate password
   - `APPLE_ID` - Your Apple ID
   - `APPLE_ID_PASSWORD` - App-specific password

### Windows
1. Purchase a code signing certificate (from DigiCert, Sectigo, etc.)
2. Add to GitHub secrets:
   - `WIN_CSC_LINK` - Base64 encoded certificate
   - `WIN_CSC_KEY_PASSWORD` - Certificate password

## Quick Start Checklist

- [ ] Create `assets/icon.icns` (macOS icon)
- [ ] Create `assets/icon.ico` (Windows icon)
- [ ] Create `entitlements.mac.plist`
- [ ] Push to GitHub
- [ ] Create and push a version tag (e.g., `git tag 1.0.0 && git push origin 1.0.0`, or the v-prefixed `v1.0.0` form — both are accepted)
- [ ] Check Actions tab for build progress
- [ ] Find release in Releases tab when complete