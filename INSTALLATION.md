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
- `apps/roku-dev-studio/dist/mac/Roku Dev Studio-{version}.dmg` - macOS installer (x64 & arm64)
- `apps/roku-dev-studio/dist/mac/Roku Dev Studio-{version}-mac.zip` - Portable macOS app (x64 & arm64)

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

The `mac` block in `apps/roku-dev-studio/package.json` ships with `hardenedRuntime: true` and `notarize: false`. By default `electron-builder` produces a **signed-but-not-notarized** build if a Developer ID Application certificate is present in your login keychain, and an **ad-hoc-signed** build otherwise.

If you ship a build without a Developer ID, end users have to clear quarantine before launching:

```bash
xattr -cr "/Applications/Roku Dev Studio.app"
```

To remove that step for end users, set up Apple Developer ID signing + notarization. The full one-time setup (cert generation, App Store Connect API key, GitHub Actions secrets, env-var contract) is captured in **[`.discussion-docs/macos-code-signing-and-notarization.md`](.discussion-docs/macos-code-signing-and-notarization.md)**. Once you have the cert and an `app-specific password` / API key, set:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABCDE12345"
# Then build:
npm run build:mac
```

`apps/roku-dev-studio/scripts/notarize.cjs` is the `afterSign` hook that runs `@electron/notarize` against your build.

#### Single-arch DMG (skip cross-build)

Building for both Intel + Apple Silicon doubles the artifact size and the time. To produce a DMG only for the architecture you're currently on:

```bash
# From apps/roku-dev-studio/
npx electron-builder --mac --dmg --x64       # Intel
npx electron-builder --mac --dmg --arm64     # Apple Silicon
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
