# macOS Code Signing & Notarization for Roku Dev Studio

## Why this exists

Today, end users who download a Roku Dev Studio macOS build have to run:

```bash
xattr -cr "/Applications/Roku Dev Studio.app"
```

…before the app will launch. This is because the app is currently **unsigned**, so macOS Gatekeeper applies the `com.apple.quarantine` extended attribute when the user downloads the DMG/ZIP and refuses to open it.

The proper fix is to:

1. **Code sign** the app with an Apple **Developer ID Application** certificate.
2. **Notarize** it with Apple (so Gatekeeper trusts it on first launch on any Mac).
3. **Staple** the notarization ticket to the artifact.

Once that's done, the `xattr -cr` workaround is no longer needed for any user.

---

## Current state (before fix)

The mac block in `apps/roku-dev-studio/package.json` explicitly disabled signing:

```json
"mac": {
  "hardenedRuntime": false,
  "gatekeeperAssess": false,
  "identity": null,
  ...
}
```

`identity: null` tells `electron-builder` *do not sign*. Combined with `hardenedRuntime: false`, the produced `.app` is unsigned, unhardened, and not notarized.

---

## Prerequisites (one-time setup)

Requires an active **Apple Developer Program** membership ($99/year): https://developer.apple.com.

### 1. Developer ID Application certificate

In the Apple Developer portal:

- *Certificates, Identifiers & Profiles → Certificates → +*
- Choose **Developer ID Application** (this is the cert for distribution **outside** the App Store — what we want).
- Generate a CSR from Keychain Access, upload it, download the resulting `.cer`, and double-click to install into your **login** keychain.

Verify it's installed:

```bash
security find-identity -v -p codesigning
```

You should see something like:

```
1) ABC123... "Developer ID Application: Paramount Streaming (TEAMID1234)"
```

### 2. App-specific password (for notarization)

- Sign in at https://appleid.apple.com → *Sign-In and Security → App-Specific Passwords → Generate*.
- Save it somewhere secure (looks like `abcd-efgh-ijkl-mnop`).

### 3. Apple Team ID

The 10-character ID visible on your Apple Developer account page (e.g. `ABCDE12345`).

---

## Configuration changes

### `apps/roku-dev-studio/package.json` — `build.mac`

Remove `identity: null`, enable hardened runtime, and let our `afterSign` hook handle notarization:

```json
"mac": {
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "notarize": false,
  "signIgnore": ["node_modules"],
  "entitlements": "entitlements.mac.plist",
  "entitlementsInherit": "entitlements.mac.plist",
  ...
}
```

Why these flags:

| Flag | Purpose |
|---|---|
| (no `identity`) | Lets `electron-builder` auto-pick the **Developer ID Application** cert from the keychain. |
| `hardenedRuntime: true` | Required for notarization. |
| `notarize: false` | We use a custom `afterSign` script (electron-builder's built-in `notarize` is being phased out in favor of `@electron/notarize`). |

Also wire up the hook at the top level of `build`:

```json
"build": {
  "afterSign": "./scripts/notarize.cjs",
  "afterAllArtifactBuild": "./scripts/build-hooks-entry.cjs",
  ...
}
```

### `apps/roku-dev-studio/entitlements.mac.plist`

Hardened runtime is strict, so Electron/Chromium needs a few entitlements to run:

```xml
<key>com.apple.security.cs.allow-jit</key><true/>
<key>com.apple.security.cs.allow-unsigned-executable-memory</key><true/>
<key>com.apple.security.cs.allow-dyld-environment-variables</key><true/>
<key>com.apple.security.cs.disable-library-validation</key><true/>
<key>com.apple.security.network.client</key><true/>
<key>com.apple.security.network.server</key><true/>
```

Rationale:

- `allow-jit` + `allow-unsigned-executable-memory` — V8 JIT.
- `allow-dyld-environment-variables` — Electron honors `ELECTRON_*` env vars.
- `disable-library-validation` — allows loading unsigned native modules from `node_modules` (e.g. `sharp`).
- Network client/server — already required for Roku discovery + local HTTP.

### `apps/roku-dev-studio/scripts/notarize.cjs` (new)

`afterSign` hook that uploads the signed `.app` to Apple's `notarytool` service:

```js
const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;

  if (process.env.SKIP_NOTARIZE === '1') {
    console.log('[notarize] SKIP_NOTARIZE=1 — skipping notarization.');
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn(
      '[notarize] Skipping notarization. Set APPLE_ID, APPLE_ID_PASSWORD (app-specific password), and APPLE_TEAM_ID to enable.'
    );
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`[notarize] Notarizing ${appPath} for team ${teamId} ...`);
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
  console.log('[notarize] Done.');
};
```

The script:

- No-ops on non-mac builds.
- Skips cleanly when `SKIP_NOTARIZE=1` (fast iteration).
- Skips with a warning if creds are missing (so unsigned local dev builds still work).

### Dependency

`@electron/notarize` is already in `devDependencies`. If it ever isn't:

```bash
cd apps/roku-dev-studio
npm install --save-dev @electron/notarize
```

---

## Build workflow

### Local signed + notarized build

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="abcd-efgh-ijkl-mnop"   # app-specific password
export APPLE_TEAM_ID="ABCDE12345"

cd apps/roku-dev-studio
npm run build:mac
```

What happens:

1. `electron-builder` finds the **Developer ID Application** cert in the keychain.
2. Signs the `.app` (Frameworks, Helpers, MainExecutable) with hardened runtime + entitlements.
3. The `afterSign` hook ships the `.app` to Apple's notary service and waits for the ticket (~1–5 min).
4. The ticket is **stapled** into the `.app`.
5. DMG and ZIP artifacts are built containing the stapled, notarized `.app`.

### Local *signing-only* build (faster iteration)

```bash
SKIP_NOTARIZE=1 npm run build:mac
```

Produces a signed but un-notarized build — fine for testing on your own machine, but other Macs will still get the Gatekeeper warning on first launch.

### Local unsigned build

If `APPLE_ID`/`APPLE_ID_PASSWORD`/`APPLE_TEAM_ID` are not set **and** there's no Developer ID cert in the keychain, electron-builder will skip signing and the notarize hook will warn and skip. The result is the same as today's build (still requires `xattr -cr`).

---

## Verifying a signed + notarized build

```bash
# Identity + sealed-resources check
codesign -dv --verbose=4 "dist/mac-arm64/Roku Dev Studio.app"

# Gatekeeper assessment — expect: "accepted" / "source=Notarized Developer ID"
spctl -a -vvv -t install "dist/mac-arm64/Roku Dev Studio.app"

# Confirm the notarization ticket is stapled
stapler validate "dist/mac-arm64/Roku Dev Studio.app"
```

If all three pass, downloads no longer need `xattr -cr`.

---

## CI considerations (future work)

For GitHub Actions / other CI:

1. Export the cert from Keychain as `.p12`, then `base64` encode.
2. Add repo secrets:
   - `MAC_CERT_P12_BASE64`
   - `MAC_CERT_PASSWORD`
   - `APPLE_ID`
   - `APPLE_ID_PASSWORD`
   - `APPLE_TEAM_ID`
3. In the workflow, before `npm run build:mac`:
   - Create a temporary keychain.
   - Decode the p12 and `security import` it.
   - Run electron-builder with the env vars above set.
4. Post-build, delete the temporary keychain.

This is intentionally **not** wired up yet — captured here as a follow-up.

---

## Tradeoffs / open questions

- **Cost**: $99/year Apple Developer Program membership.
- **Build time**: notarization adds 1–5 minutes to a mac build.
- **Hardened runtime fragility**: any new native dependency that does its own runtime code generation may need additional entitlements.
- **Cert ownership**: cert should be tied to the *organization* (Paramount Streaming), not an individual developer's Apple ID, to avoid ownership churn.

---

## Summary of changed files

- `apps/roku-dev-studio/package.json` — removed `identity: null`, enabled `hardenedRuntime`, added `afterSign` hook.
- `apps/roku-dev-studio/entitlements.mac.plist` — added entitlements required for hardened-runtime Electron.
- `apps/roku-dev-studio/scripts/notarize.cjs` — new `afterSign` hook for notarization via `@electron/notarize` + `notarytool`.
