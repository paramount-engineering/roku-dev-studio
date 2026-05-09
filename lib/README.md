# App-only shared utilities

Roku discovery, device info, ECP, screenshot, and sideload logic now live in the **`roku-dev-studio-api`** workspace package (`packages/roku-dev-studio-api/`). The Electron main process and the remote relay server depend on that package.

## What stays in this folder

| Module | Used by | Purpose |
|--------|---------|---------|
| **path-safe.ts** | **Source of truth.** `apps/roku-dev-studio/scripts/sync-path-safe.ts` (run with **`tsx`**) compiles it with **esbuild** to **`lib/path-safe.js`** (gitignored) and copies that file into `apps/roku-dev-studio/lib/path-safe.js` for the packaged app. **`npm run remote-server`** runs sync first so `packages/roku-dev-studio-remote-server/roku-remote-server.js` can `require('../../lib/path-safe.js')`. | Safe path resolution under allowed bases (userData, temp uploads, etc.). Not published in the API package. |

### Syncing into the Electron app

The copy under `apps/roku-dev-studio/lib/` is **generated** (gitignored). It is produced by:

- **`npm install` / `npm ci`** — `prepare` in `apps/roku-dev-studio` runs `scripts/sync-path-safe.ts` (via **`tsx`**).
- **`npm run start`** (repo root) — runs sync before launching Electron.
- **Packaging** — root `build*` scripts and `prebuild` in the app run sync before `cleanup-old-builds.ts` (**`tsx`**) / `electron-builder`.

Edit **`lib/path-safe.ts`** only; do not hand-edit **`lib/path-safe.js`** or the app `lib/` copy (both generated).

## See also

- **Package:** `packages/roku-dev-studio-api/README.md`
