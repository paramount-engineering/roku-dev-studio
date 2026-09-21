# Installation

Roku Dev Studio — setup and build instructions.

## Monorepo layout

- **`apps/roku-dev-studio/`** — Electron desktop app (`npm start` from repo root runs this workspace).
- **`packages/roku-dev-studio-api/`** — shared Node API package.
- **`packages/roku-dev-studio-remote-server/`** — HTTP relay server.

Always run **`npm install` from the repository root** so workspaces link correctly.

## Quick Start (Development)

1. **Install dependencies (from repo root):**
   ```bash
   npm install
   ```

2. **Run the app:**
   ```bash
   npm start
   ```

3. **Optional — verify TypeScript (API, Electron main/preload, HTML renderer modules, remote server, Solid renderer):**
   ```bash
   npm run typecheck
   ```
   From the repository root; runs all workspace `tsc --noEmit` targets. The desktop app also transpiles through **`apps/roku-dev-studio/scripts/build/index.ts`** (via **`tsx`**: main, preload, `renderer/dist/`).

## Building Distributable Apps

### For macOS:
```bash
npm run build:mac
```
This creates (under `apps/roku-dev-studio/dist/`):
- `apps/roku-dev-studio/dist/mac/arm64/Roku Dev Studio-{version}-arm64.dmg` — Apple Silicon installer
- `apps/roku-dev-studio/dist/mac/arm64/Roku Dev Studio-{version}-arm64-mac.zip` — portable Apple Silicon app

Intel Mac builds are no longer produced by default. To build them locally (deprecated):

```bash
npm run build:mac:intel
```

### For Windows:
```bash
npm run build:win
```
This creates (under `apps/roku-dev-studio/dist/`):
- `apps/roku-dev-studio/dist/win/Roku Dev Studio Setup {version}.exe` - Windows installer (x64)
- `apps/roku-dev-studio/dist/win/Roku Dev Studio {version}.exe` - Portable Windows app (x64)

### For Linux:
```bash
npm run build:linux
```
This creates (under `apps/roku-dev-studio/dist/`):
- `apps/roku-dev-studio/dist/linux/Roku Dev Studio-{version}.deb` - Debian package (x64 & arm64)
- `apps/roku-dev-studio/dist/linux/Roku Dev Studio-{version}-{arch}.AppImage` - AppImage (x64 & arm64)

### For All Platforms:
```bash
npm run build:all
```
Builds for macOS, Windows, and Linux simultaneously.

## Per-platform notes

### macOS — code signing & notarization

`build.mac` in `apps/roku-dev-studio/package.json` ships with `hardenedRuntime: true` and `notarize: true`: electron-builder signs with the Developer ID Application identity it finds, submits the `.app` to Apple's `notarytool`, and staples the ticket before the DMG/zip are packed. Both steps are skipped (with a warning) when the inputs below are missing, leaving an ad-hoc-signed build whose users must clear quarantine before launching:

```bash
xattr -cr "/Applications/Roku Dev Studio.app"
```

**1. Certificate.** A *Developer ID Application* `.p12` — not "Apple Development" or "Mac App Distribution", which notarization rejects. Import it once into your login keychain so electron-builder auto-discovers it:

```bash
security import ~/path/to/DeveloperID.p12 -k ~/Library/Keychains/login.keychain-db -P '<p12 password>' -T /usr/bin/codesign
security find-identity -v -p codesigning   # expect: "Developer ID Application: <Name> (<TEAMID>)"
```

…or pass it per build, which uses a throwaway keychain (this is what CI does):

```bash
export CSC_LINK=~/path/to/DeveloperID.p12      # a file path, or the file's base64
export CSC_KEY_PASSWORD='<p12 password>'
```

**2. notarytool credentials.** The certificate alone cannot notarize. You also need your Apple ID, an [app-specific password](https://appleid.apple.com/account/manage) (Sign-In and Security → App-Specific Passwords) and your 10-character Team ID (developer.apple.com → Membership details; it is also the `(…)` suffix on the identity above). Store them in the keychain once and point electron-builder at the profile:

```bash
xcrun notarytool store-credentials rds-notary --apple-id you@example.com --team-id ABCDE12345 --password xxxx-xxxx-xxxx-xxxx
export APPLE_KEYCHAIN_PROFILE=rds-notary
```

Plain env vars work too — `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` (what the release workflow uses), or an App Store Connect API key via `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.

**3. Build and verify.** Notarization adds roughly 1–5 minutes while Apple scans the upload.

```bash
npm run build:mac
APP="apps/roku-dev-studio/dist/mac/arm64/Roku Dev Studio.app"
codesign -dv --verbose=2 "$APP"       # Authority=Developer ID Application: …
xcrun stapler validate "$APP"         # The validate action worked!
spctl -a -vv -t exec "$APP"           # accepted  source=Notarized Developer ID
```

GitHub releases: the mac job in `.github/workflows/release.yml` reads the same values from repository secrets and fails fast if any are missing — see `RELEASE_SETUP.md` → Code Signing.

#### Intel Mac builds (opt-in, deprecated)

Default macOS builds target Apple Silicon (`arm64`) only. Intel/x64 artifacts are not produced in CI. To build them locally:

```bash
npm run build:mac:intel
```

Or, from `apps/roku-dev-studio/`:

```bash
npx electron-builder --mac dmg:x64 zip:x64
```

### Windows

The `win` target builds an NSIS installer and a portable `.exe` for x64. No code signing is configured by default — Windows will show a SmartScreen warning until you add an Authenticode certificate (`win.certificateFile` + `win.certificatePassword`, or an EV cert in a hardware token).

Cross-building Windows artifacts from macOS / Linux requires Wine. The reliable option is to run `npm run build:win` on Windows (or in a Windows VM / GitHub Actions runner — see [`RELEASE_SETUP.md`](RELEASE_SETUP.md)).

### Linux

The `deb` target lists the runtime dependencies it needs in `package.json` → `build.deb.depends`:

```
libgtk-3-0  libnotify4  libnss3  libxss1  libxtst6  xdg-utils  libatspi2.0-0  libuuid1
```

On Debian / Ubuntu users install with:

```bash
sudo apt install ./Roku\ Dev\ Studio-*.deb
```

apt resolves the depends automatically. The AppImage variant is self-contained — chmod +x and run.

To build Linux artifacts, the build host needs the standard build essentials (`gcc`, `make`, `python3`) plus the same shared libraries listed above so `electron-builder` can stage the bundle.

## CI release pipeline

GitHub Actions workflow + secret layout (signing identity, notarization API keys, etc.) is documented in **[`RELEASE_SETUP.md`](RELEASE_SETUP.md)**.

## Troubleshooting

### Connection Issues

1. **Ensure Roku and computer are on the same network**
2. **Control by Mobile Apps (ECP):**
   Settings → System → Advanced system settings → Control by mobile apps → **Network access**. The app supports all four modes:
   - **Disabled** – Remote control is off; the app shows a warning and blocks remote/keypress areas.
   - **Limited** – Text input, app launch, and app query work; full remote keypress may not. The app shows an "ECP Limited" badge and adapts.
   - **Permissive** – Full control; Roku accepts commands only from private network or same subnet. If you see a "Check Network" warning, ensure this computer is on the same subnet.
   - **Enabled** – Full control on private network addresses.
3. **Firewall:** Allow connections on port 8060

### Building Issues

- **macOS code signing:** For distribution, you'll need an Apple Developer certificate
- **Windows builds on macOS:** Use a Windows VM or GitHub Actions
- **Linux builds:** Ensure required dependencies are installed (see package.json deb.depends)
