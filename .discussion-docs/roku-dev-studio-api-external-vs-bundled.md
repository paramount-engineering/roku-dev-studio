# roku-dev-studio-api: external install vs bundled app code

## Context

`roku-dev-studio-api` is published as one npm package that exposes:

- **Library**: `require('roku-dev-studio-api')` and subpaths like `roku-dev-studio-api/lib/shared-constants`
- **CLI**: binary `rds` (`package.json` → `"bin": { "rds": "./dist/cli.js" }`)

Roku Dev Studio (Electron) consumes the **library** during normal operation. The distributed app is built with a fixed dependency tree (typically `file:../../packages/roku-dev-studio-api` in the monorepo, then whatever ships inside the installer).

**Question under discussion:** If we fix or optimize the API package with **no protocol / tool / IPC surface changes**, can end users (or developers) **install the CLI package** and have the **desktop app** use that installed code instead of what was bundled at build time?

---

## How the app loads the API today

### Main process — runtime `require` (not inlined)

`esbuild` bundles `main.ts` → `main.bundled.cjs` with `roku-dev-studio-api` marked **external** (`transpile-main-process.ts`). At runtime, Node resolves `require('roku-dev-studio-api')` from the app’s `node_modules` (inside `app.asar` for production builds).

So the **main process** always uses whichever **`roku-dev-studio-api` tree** sits next to the Electron app on disk, as resolved by Node’s module algorithm.

### Preload — inlined from build-time paths

`preload.ts` intentionally **does not** use bare `require('roku-dev-studio-api/...')` for shared libs. It pulls specific files under `packages/roku-dev-studio-api/dist/lib/*.js` via **relative paths**, and `esbuild` **inlines** those modules into `preload.bundled.cjs`.

That means a large slice of “shared pure logic” (action script helpers, RALE normalization bits, shared constants bridge, etc.) is **fixed at build time** in the preload bundle. It does **not** follow runtime replacement of `node_modules/roku-dev-studio-api` unless the preload bundle is rebuilt against new sources.

### Renderer

The renderer does not import the API package directly (`nodeIntegration: false`). It uses **`contextBridge`** APIs that preload constructed using the inlined modules above.

---

## Can “install the CLI package” redirect the app?

**Not automatically.**

- `npm install -g roku-dev-studio-api` (or a local `npm install`) installs a **global** (or other-prefix) tree. Electron’s main process does **not** search global npm bins or global `node_modules` for `require('roku-dev-studio-api')` unless something in the environment explicitly prepends that path (non-standard and fragile).
- The **CLI** (`rds`) and the **library** are the **same package**, but the app does not shell out to `rds` for core device/API work; it loads the library. Installing the CLI proves the package is present on disk; it does not rewire Electron’s module resolution by itself.

So “use the CLI package” really means “**resolve `roku-dev-studio-api` from a chosen directory at runtime**” — which is a **deliberate feature**, not what you get from a normal global CLI install alone.

---

## What *would* let users run newer API code without an app rebuild?

Rough options (increasing invasiveness):

1. **Developer / power-user: replace `node_modules` under the packaged app**  
   Fragile, OS-specific, may break signatures/notarization, and **still does not update preload** unless preload is rebuilt or changed to load from disk.

2. **Ship an optional “API override” path (env or settings)**  
   - Main process: `Module._resolveFilename` hook or `NODE_PATH` / explicit `createRequire` from a user-chosen `root` (needs security and path validation).  
   - Preload: must either **externalize** those lib imports (mark `roku-dev-studio-api` external in preload build and load from the same root) or **rebuild** preload when overriding — otherwise behavior stays split.

3. **Unpack API to `app.asar.unpacked` and document replacement**  
   Still requires preload to consume unpacked paths or external requires; same version-skew concern between main and preload.

4. **Keep a single source of truth**  
   For any override story, **main + preload + about/version UI** should agree on which build of `roku-dev-studio-api` is active to avoid subtle bugs.

---

## Version skew risk

If main process loads API **v2** from an override path while preload still embeds **v1** lib code, “zero tool changes” can still produce **user-visible inconsistencies** (constants, wait timings, normalization) even when IPC payloads are unchanged.

Any design for “external API” should explicitly address **preload alignment** (re-externalize + single resolve root, or require full app rebuild for API updates that touch preload-exposed code).

---

## Clarifying questions (for product / engineering)

1. **Who is the audience** — internal developers only, or end users installing from npm/registry?
2. **Distribution** — is the API published to the public npm registry under the same name, or only `file:` / private registry?
3. **Scope of “use external package”** — must **all** API behavior (including preload-exposed helpers) update, or only main-process paths (ECP, telnet, discovery)?
4. **Security** — should an arbitrary filesystem path be allowed, or only signed/verified bundles or a fixed sibling directory?
5. **Operational preference** — is a documented **faster app release** preferred over **runtime overrides**?

---

## Summary

| Layer            | Bundled?        | Swappable by replacing only `node_modules` in shipped app? |
|-----------------|-----------------|------------------------------------------------------------|
| Main process    | No (external)   | Yes, in principle — same caveats as any native app tampering |
| Preload         | Yes (inlined)   | **No** — needs build change or architecture change          |
| CLI (`rds` bin) | N/A for Electron | Independent; does not redirect the app’s `require`          |

**Short answer:** Installing the published CLI package **by itself** does not make Roku Dev Studio use that code. The app would need an **explicit** mechanism to resolve the library from a chosen install location, and **preload** must be included in that story or rebuilt so main and preload stay consistent.

---

## Proposal: Settings — “Bundled API” vs “npm-installed API”

**User story:** The app ships with a bundled `roku-dev-studio-api`. Later, a newer package is published (optimizations, no tool IPC changes). The user runs `npm install -g roku-dev-studio-api` (or installs to a known location), opens **Settings**, chooses **Use latest from npm**, and on next launch the app loads that package instead of the bundled copy.

### Is this buildable?

**Yes**, as a deliberate feature — with two engineering requirements:

1. **Single resolved root** — At startup, main process (after reading settings) resolves an absolute path to the **package root** of `roku-dev-studio-api` (the folder that contains `package.json` and `dist/`). Both main and preload must load from that same root when the setting is “external.”
2. **Preload must participate** — Today preload inlines API `dist/lib` files. For this feature, preload needs to load those modules **either** from the bundled resolution (`require('roku-dev-studio-api/lib/...')` when using shipped `node_modules`) **or** from `path.join(resolvedRoot, 'dist/lib/...')` when the user chose npm. Without that change, only the main process would switch versions (skew risk).

### Suggested resolution modes (settings)

| Mode | Behavior |
|------|----------|
| **Bundled (default)** | Same as today: Node resolves `roku-dev-studio-api` from the app’s packaged `node_modules`. |
| **Global npm** | Resolve e.g. `path.join(<npm global root>, 'roku-dev-studio-api')` where global root comes from `npm root -g` (or equivalent), with validation that `package.json` name/version exists. |
| **Custom path (optional)** | User picks a directory that is the package root (useful for `npx`, local installs, or corporate mirrors). |

“Like how users use CLI” maps cleanly to **global npm**: the same install that puts `rds` on `PATH` usually also installs the package under the global `node_modules` tree.

### Startup order (important)

Settings must be read **before** any `BrowserWindow` (and thus before preload runs), so the main process can:

1. Load persisted setting.
2. Resolve and validate the external package path (existence, readable `dist/index.js`, optional semver check vs app-supported range).
3. Set something the preload can read — typically **`process.env.RDS_ROKU_DEV_STUDIO_API_ROOT`** (absolute path) when using external mode, or clear it when bundled.

Preload then branches at the top: if the env var is set, `require(path.join(root, 'dist/lib/…'))`; otherwise keep current resolution strategy for bundled.

Changing this setting should **require an app restart** (or at least document restart): preload is loaded once per window creation and is not hot-swappable like a web bundle.

### Main process loading

Use **`module.createRequire`** from the resolved package root (or `require(path.join(root, 'dist/index.js'))` with careful `exports` alignment) so IPC handlers do not rely on the default `node_modules` search path when external mode is on. Centralize “get API module” in one helper used by all main-process entry points.

### UX and safety

- **About / diagnostics** — Show **which** source is active (bundled vs path) and the **resolved semver** of `roku-dev-studio-api` to reduce confusion.
- **Failure modes** — If external path is missing or invalid, fall back to bundled with a clear toast or settings banner, and log the error.
- **Security** — Custom path allows loading arbitrary JS from disk; treat like other “advanced” settings (warning copy, optional restriction to global npm only for v1).

### Summary for this proposal

| Piece | Work |
|-------|------|
| Settings UI + persistence | Standard app settings pattern |
| Main: dynamic load from root | `createRequire` / explicit paths + one helper |
| Preload: branch on env + load from same root | Refactor off pure inlining for `dist/lib` imports |
| Restart | Required or strongly recommended |
| Publishing | npm package must remain compatible with app’s expected API surface |

This matches the flow you described (install in Terminal → flip setting → restart) and is technically coherent if preload and main share one resolution rule.
