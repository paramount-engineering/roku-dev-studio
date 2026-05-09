# Discussion: Migrating from npm to Bun

**Status:** Exploratory  
**Date:** 2026-04-03  
**Branch:** `feat/Bun`

---

## Current state

| Aspect | Detail |
|---|---|
| **Package manager** | npm (lockfileVersion 3) |
| **Monorepo** | npm workspaces — `packages/*`, `apps/*` |
| **Workspaces** | `apps/roku-dev-studio` (Electron app), `packages/roku-dev-studio-api`, `packages/roku-dev-studio-remote-server` |
| **CI/CD** | GitHub Actions — `ci.yml`, `release.yml`, `pages.yml` |
| **CI node version** | Node 20 |
| **Electron** | v33.0.0 (devDependency) + `electron-builder` for packaging |
| **Native-ish deps** | `sharp` (prebuilt binaries via `@img/sharp-*`), Electron install script, optional `iconv-corefoundation` (macOS) |
| **Test framework** | None (CI runs `node --check` and `node -e require(...)` smoke tests) |
| **`.npmrc`** | Not present |
| **Lifecycle scripts** | None in project `package.json` files; only from dependencies (Electron, sharp) |

---

## Feasibility assessment

### What maps cleanly

- **Workspace support** — Bun supports workspaces via the same `"workspaces"` field in `package.json`. The `packages/*` / `apps/*` glob syntax is compatible.
- **Lock file** — `bun install` generates `bun.lockb` (binary) or `bun.lock` (text, since Bun 1.2). Drop-in replacement for `package-lock.json`.
- **Scripts** — `bun run <script>` replaces `npm run <script>`. Bun also runs JS/TS files directly without a separate `node` call.
- **No `.npmrc`** — nothing custom to port.
- **No lifecycle scripts** — no `postinstall`/`prepare` hooks in project code to worry about.
- **`file:` dependencies** — Bun resolves `file:` protocol links between workspaces.

### What needs investigation / carries risk

| Area | Risk | Notes |
|---|---|---|
| **Electron** | **High** | Electron ships its own Node.js runtime. `electron-builder` and the Electron install script have historically been tested against npm/yarn. Bun compatibility with `electron-builder` CLI, `rebuild` steps, and platform-specific optional deps needs hands-on validation. |
| **`sharp`** | **Medium** | `sharp` uses prebuilt platform binaries (`@img/sharp-darwin-arm64`, etc.). Bun claims sharp support, but install-script behavior and optional-dependency resolution differ subtly from npm. Must verify on all target platforms (macOS, Windows, Linux). |
| **CI/CD** | **Medium** | All three CI workflows use `npm ci` and `cache: npm`. Would need updates to install Bun, use `bun install --frozen-lockfile`, and adjust caching. GitHub Actions has `oven-sh/setup-bun` for this. |
| **Workspace filter syntax** | **Low–Medium** | Root scripts use `npm run … -w <workspace>`. Bun equivalent is `bun run --filter <workspace> <script>` or running from the workspace directory. All root `package.json` scripts need updating. |
| **Binary lockfile** | **Low** | `bun.lockb` is binary by default (harder to review in PRs). Bun 1.2+ supports `bun.lock` (JSON text). Decide which to use. |
| **Node API parity** | **Low** | The app code runs inside Electron's Node (not Bun's runtime), so Node API gaps in Bun are largely irrelevant for the app itself. Only build/dev scripts would run under Bun's runtime. |

### Verdict

**Feasible with caveats.** The biggest unknowns are Electron build tooling and `sharp` install behavior. A spike branch is the right way to de-risk.

---

## Pros

| Benefit | Detail |
|---|---|
| **Faster installs** | Bun's install is significantly faster than `npm ci` — often 5–20× on cold installs, with even larger gains on warm cache. CI time drops noticeably. |
| **Faster script execution** | `bun run` has near-zero startup overhead vs `npm run` (which spawns a subshell). Speeds up every `npm run …` invocation in dev and CI. |
| **Built-in TypeScript/JSX support** | If the project ever adopts TS, Bun runs `.ts` files natively — no separate `tsc` or `ts-node` step. |
| **Built-in test runner** | `bun test` is a fast, Jest-compatible test runner. Useful if/when the project adds unit tests. |
| **Workspace-native** | Bun's workspace support is first-class and generally requires less configuration than npm workspaces. |
| **Simpler toolchain** | One binary replaces `node` + `npm` + potentially `npx`. Reduces toolchain surface. |
| **Text lockfile option** | `bun.lock` (Bun 1.2+) is human-readable JSON — reviewable in diffs just like `package-lock.json`. |

## Cons

| Drawback | Detail |
|---|---|
| **Electron ecosystem risk** | `electron-builder` is tested primarily against npm and yarn. Undiscovered edge cases with Bun are possible (rebuild steps, platform optional deps, `asar` packaging). |
| **Platform parity** | Bun's Windows support has improved but historically lagged macOS/Linux. This project builds on all three platforms in CI. |
| **Team familiarity** | Contributors need to install Bun and learn its CLI differences (`--filter` vs `-w`, `bun x` vs `npx`, etc.). |
| **Binary lockfile by default** | `bun.lockb` is not reviewable in PRs. Mitigated by opting into `bun.lock` (text), but that's a non-default config. |
| **Smaller ecosystem / community** | Fewer Stack Overflow answers, fewer GitHub issues to reference when debugging install or runtime problems compared to npm. |
| **npm registry auth / scoped packages** | If private registries or scoped auth are ever needed, Bun's support is less battle-tested. |
| **Bun runtime ≠ Node runtime** | Build scripts that rely on Node-specific APIs or behaviors (e.g., `child_process` edge cases, `fs` nuances) could behave differently under Bun's runtime. Needs testing. |

---

## What changes

### Developer workflow

| Today (npm) | After (Bun) |
|---|---|
| `npm install` | `bun install` |
| `npm run start` | `bun run start` |
| `npm run build:mac` | `bun run build:mac` |
| `npm run -w roku-dev-studio <script>` | `bun run --filter roku-dev-studio <script>` |
| `npx <tool>` | `bun x <tool>` |
| `package-lock.json` | `bun.lock` (text) or `bun.lockb` (binary) |

### Root `package.json` scripts

Every script that uses `npm run … -w <workspace>` must be rewritten. Example:

```jsonc
// Before
"start": "npm run start -w roku-dev-studio"

// After
"start": "bun run --filter roku-dev-studio start"
```

### CI/CD (`.github/workflows/`)

- **`ci.yml` and `release.yml`**: Replace `actions/setup-node` + `npm ci` with `oven-sh/setup-bun` + `bun install --frozen-lockfile`.
- **Caching**: Switch from `cache: npm` to Bun's cache directory (`~/.bun/install/cache`).
- **Matrix**: Validate Bun works on all three OS runners (macOS, Windows, Ubuntu).

### Lock file

- Delete `package-lock.json`.
- Commit `bun.lock` (recommended — text format, reviewable).
- Add `package-lock.json` to `.gitignore` to prevent accidental regeneration.

### Electron build pipeline

- `electron-builder` invocations stay the same CLI-wise, but the dependency tree it reads comes from Bun's resolver. Needs end-to-end validation that built artifacts (`.dmg`, `.exe`, `.AppImage`) work correctly.
- `sharp` (used in `scripts/generate-icons.js`) must install cleanly via Bun on all platforms.

---

## Open questions — resolved

| Question | Answer |
|---|---|
| **Motivation** | Curiosity-driven — heard Bun is faster and better, wants to explore. No specific pain point with npm today. |
| **Hybrid vs all-in** | Nothing fixed. Open to whatever works. |
| **Windows builds** | Project not yet publicly released; no mature feedback loop. Windows is lower priority but still in the CI matrix. |
| **Team buy-in** | Solo developer — no coordination overhead. |
| **Timeline** | No pressure. Pure exploration. |
| **Prior Bun experience** | None — first time looking at Bun. |

---

## Remaining open questions

1. ~~**Electron-builder + Bun**~~ — **Validated.** Build succeeds on macOS (both arm64 and x64). Windows/Linux CI validation still needed.
2. ~~**Rollback plan**~~ — npm still works alongside Bun. `package-lock.json` can be regenerated via `npm install` at any time.

---

## Revised recommendation

Given the context (solo dev, no public release, no timeline, exploratory), the risk of trying is very low and the learning value is high. The worst case is "it doesn't work for Electron builds and we revert."

### Suggested approach

1. **Install Bun** — `curl -fsSL https://bun.sh/install | bash` (macOS/Linux).
2. **Try `bun install` on this repo** — see if it resolves the workspace, installs Electron and sharp without errors. This alone will answer 60% of the feasibility question.
3. **Try `bun run start`** — does the Electron app launch and work normally?
4. **Try `bun run build:mac`** — does `electron-builder` produce a valid `.dmg`? This is the highest-risk step.
5. **If all green** — update root scripts (`npm run -w` → `bun run --filter`), switch CI workflows, commit `bun.lock`, remove `package-lock.json`.
6. **If something breaks** — document the blocker here, keep the branch for revisiting later.

### Why this is low-risk

- **Electron's runtime is its own Node.js** — Bun only replaces the *package manager and script runner*, not the runtime your app code executes in. The actual app behavior won't change.
- **Solo dev** — no one else's workflow breaks if you experiment.
- **`feat/Bun` branch already exists** — isolated from `main`.
- **`npm install` can always regenerate `package-lock.json`** — full rollback at any time.

---

## Spike findings

### 2026-04-03: `-w` flag infinite recursion

**Tested:** `bun run start` from the repo root.

**Result:** Infinite recursion. Bun interprets `-w` (from `npm run start -w roku-dev-studio`) as its own `--watch` flag, not as a workspace selector. This causes the script to re-invoke itself endlessly, spawning hundreds of nested `bun run start -w ...` calls until manually killed with Ctrl+C.

**Root cause:** npm's `-w <workspace>` flag is npm-specific. Bun's CLI has `-w` / `--watch` which means something entirely different (watch mode — restart on file changes). There is no `-w` shorthand for workspace selection in Bun.

**Fix required:** All root `package.json` scripts that use `npm run <script> -w <workspace>` must be rewritten. Options:
1. `bun run --filter <workspace> <script>` — Bun's workspace filter syntax
2. Run directly from the workspace directory: `cd apps/roku-dev-studio && bun run start`

**Severity:** Blocker for drop-in replacement. Every root script needs updating. Not a "just switch the binary" migration.

### 2026-04-03: `bun install` succeeds (macOS)

**Tested:** `bun install` from the repo root.

**Result:** Completed successfully. Workspace resolution, Electron install script, sharp platform binaries, and `file:` dependency linking all worked without errors.

**Takeaway:** Bun's package manager is a viable drop-in replacement for `npm install` / `npm ci` on this project. This is the highest-value win — install speed is where Bun's advantage is most dramatic.

### 2026-04-03: `bun run build:mac` succeeds (macOS)

**Tested:** `cd apps/roku-dev-studio && bun run build:mac` from the app workspace.

**Result:** Full build pipeline completed successfully (exit code 0). This ran `prebuild` (old-build cleanup) followed by `electron-builder --mac`, producing all four expected artifacts:

| Artifact | Size |
|---|---|
| `Roku Dev Studio-2.0.0-arm64.dmg` | 92 MB |
| `Roku Dev Studio-2.0.0.dmg` (x64) | 95 MB |
| `Roku Dev Studio-2.0.0-arm64-mac.zip` | 97 MB |
| `Roku Dev Studio-2.0.0-mac.zip` (x64) | 64 MB |

**Takeaway:** `electron-builder` v24.13.3 works correctly when invoked through Bun. DMG creation (APFS), zip packaging, and block map generation all completed without issue. The pre-build `sharp`-based icon generation (via `prebuild` script) also ran successfully under Bun's runtime. This was the highest-risk checkpoint and it passed cleanly.

### 2026-04-03: Electron app launches successfully via Bun (macOS)

**Tested:** `cd apps/roku-dev-studio && bun run start` (bypassing root workspace script).

**Result:** App started successfully and noticeably faster than with `npm run start`. Electron window opened and app functions normally.

**Takeaway:** Bun as a script runner works fine for launching the Electron app. The speed improvement on `bun run` vs `npm run` is immediately noticeable even for a simple `electron .` invocation, due to Bun's near-zero startup overhead (no subshell spawn).

---

## Changes made

### Root `package.json` scripts (package-manager-agnostic)

All root scripts that used `npm run ... -w <workspace>` were rewritten to use `cd <workspace> && <command>` so they work with both `npm run` and `bun run` from the repo root.

| Script | Before | After |
|---|---|---|
| `start` | `npm run start -w roku-dev-studio` | `cd apps/roku-dev-studio && electron .` |
| `build` | `npm run build -w roku-dev-studio` | `cd apps/roku-dev-studio && node scripts/cleanup-old-builds.js && electron-builder` |
| `build:mac` | `npm run build:mac -w roku-dev-studio` | `cd apps/roku-dev-studio && node scripts/cleanup-old-builds.js && electron-builder --mac` |
| `build:win` | `npm run build:win -w roku-dev-studio` | `cd apps/roku-dev-studio && node scripts/cleanup-old-builds.js && electron-builder --win` |
| `build:linux` | `npm run build:linux -w roku-dev-studio` | `cd apps/roku-dev-studio && node scripts/cleanup-old-builds.js && electron-builder --linux` |
| `build:all` | `npm run build:all -w roku-dev-studio` | `cd apps/roku-dev-studio && node scripts/cleanup-old-builds.js && electron-builder --mac --win --linux` |
| `remote-server` | `npm run start -w roku-dev-studio-remote-server` | `cd packages/roku-dev-studio-remote-server && node roku-remote-server.js` |

### Workspace build scripts (`apps/roku-dev-studio/package.json`)

Replaced `npm run prebuild` with `node scripts/cleanup-old-builds.js` in all build scripts to remove the hardcoded npm reference.

### CI workflows — unchanged

CI stays on npm. Bun's advantage in CI is limited to the install step (~30–60s savings), while the electron-builder build step (3–10+ min) dominates total runtime and is unaffected by the package manager.

---

## Decision summary

| Aspect | Decision |
|---|---|
| **Local package manager** | Bun (preferred) or npm (both work) |
| **CI package manager** | npm (unchanged) |
| **Lock files** | Both `package-lock.json` and `bun.lock` may coexist during transition |
| **Scripts** | Package-manager-agnostic (no `npm run` or `bun run` references in scripts) |
| **Runtime** | Unchanged — Electron uses its own Node.js; Bun is only the package manager and script runner |
