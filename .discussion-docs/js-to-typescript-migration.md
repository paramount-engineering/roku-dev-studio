# JavaScript → TypeScript migration plan

**Goals**

- **`"strict": true`** everywhere TypeScript is used (no project-wide `strict: false` escape hatches; fix types instead).
- **Both** UI paths: **legacy renderer** (`renderer/app.js`, components, modules) **and** **Solid + Vite** (`src/renderer-vite/`).
- **Main process + preload** compiled from **TypeScript** via a **bundled build** (e.g. esbuild; aligned with existing preload bundling).
- **Electron version bump** is **explicitly deferred** until after this migration is done **and** you have verified locally (see [Deferred work](#deferred-work-after-migration-is-verified)). **CI already runs** **`npm run typecheck`** (see **`.github/workflows/ci.yml`**); treat that as the automated gate, not a post-migration add-on.

**Workflow**

- Work stays on **this branch**; **no PR process** assumed here. You commit when satisfied.
- This file is the **checklist**: mark phases **`[x]`** as they are completed (in git or together with the agent as work proceeds).

**Strictness reference (what `strict`, `noImplicitAny`, and `// @ts-nocheck` do):** see **[`typescript-strictness-nocheck-and-legacy.md`](typescript-strictness-nocheck-and-legacy.md)**.

### Current state (rolling log)

- **2026-04-09 — Pass 1 (agent):** Repo **`tsconfig.base.json`** added. **`lib/path-safe.ts`** is the source of truth; **`apps/roku-dev-studio/scripts/sync-path-safe.ts`** (**`tsx`**) compiles it with **esbuild** to `lib/path-safe.js` (gitignored) and copies into `apps/roku-dev-studio/lib/`. Root **`remote-server`** and **`ci:remote-check`** run sync first.
- **`roku-dev-studio-api`:** All library / CLI / example sources renamed to **`.ts`**. **Runtime build** is **`node build.mjs`** (esbuild) → **`dist/*.js`**, then **`tsc --emitDeclarationOnly`** → **`dist/*.d.ts`**. **`package.json`** `main` / `types` / `bin` / **`exports`** (with **`types`** conditions) point at **`dist/`**. **`files`:** **`["dist"]`**. **`prepare`** runs build on `npm install`. **Preload** deep-imports updated to **`…/dist/lib/*.js`**. Root **`rds`** / **`ci:api`** use **`dist/cli.js`**.
- **Strict `tsc`:** Root **`npm run typecheck`** runs **api**, **electron** (**`tsconfig.electron.json`** extends base **`strict: true`** including **`noImplicitAny`**; shared IPC under **`shared/ipc/`**), **legacy renderer** (**`strict: true`**; fully checked: **`renderer/modules`** + **`components/queries`**; **`// @ts-nocheck`** still on **`app.ts`** + large **`components/{action-scripts,inspector,dev-app,modals}`** trees — see **[strictness doc](typescript-strictness-nocheck-and-legacy.md)**), **remote-server** (**`strict: true`** + **`@ts-nocheck`** on **`roku-remote-server.ts`**), and **Solid** (**`renderer:solid:typecheck`**). **`roku-dev-studio-api`**: runtime JS from **esbuild**; **`tsc --emitDeclarationOnly`** for **`.d.ts`**; **`tsc --noEmit`** for **`npm run typecheck`**.
- **2026-04-09 — Phase 3 slice (agent):** `renderer/modules/**` sources are **`.ts`**; runtime **`.js`** under **`renderer/dist/`** from **`scripts/build/`** (**`tsx`**, same pipeline as main/preload). **`npm run typecheck:renderer`** (root + workspace).
- **2026-04-09 — Phase 2 (agent):** **`main.ts`** + **`preload.ts`** + **`main/**/*.ts`**; **`scripts/build/`** (**`transpile-main-process.ts`**) → **`main.bundled.cjs`** / **`preload.bundled.cjs`**; deprecated **`bundle-electron.ts`** / **`bundle-preload.ts`** forward to **`build/index.ts`**; About-dialog paths adjusted for **`__dirname`** = app root when bundled; **`createWindow(appState)`** on macOS activate; root **`ci:app-check`** uses **`main.bundled.cjs`**. **`npm run typecheck:electron`** passes with full **`strict`** + **`noImplicitAny`** (see **`shared/ipc/`**).
- **2026-04-09 — Phase 3 (agent, broad):** Legacy **`renderer/app.ts`** + **`components/{action-scripts,inspector,dev-app,modals}/**/*.ts`**; **esbuild** emits **`renderer/dist/**/*.js`**. **`// @ts-nocheck`** on **`app.ts`** and those component trees; **`renderer/modules`** + **`components/queries`** are **strict**-checked (same project). **`window.roku`**: **`RokuPreloadApi`** in **`legacy-renderer-globals.d.ts`**. **Follow-up:** remove **`@ts-nocheck`** incrementally; tighten **`window.roku`** vs **`preload.ts`**; **`tsconfig.electron.json`** → **`strict: true`** after fixing main/ipc nullability (**2.x**).
- **2026-04-09 — Remote relay + About preload:** **`packages/roku-dev-studio-remote-server/roku-remote-server.ts`** → **`build.mjs` (esbuild)** → **`roku-remote-server.js`** (gitignored); **`prepare`** builds on install. **`preload-about.ts`** built by **`scripts/build`** (**`tsx`**) → **`preload-about.js`** (gitignored). Root **`npm run typecheck`** + **`ci:remote-check`** build remote server before **`node --check`**.
- **2026-04-09 — User verified (local):** `node packages/roku-dev-studio-api/dist/cli.js --help`, **`npm run ci:api`**, **`npm run ci:app-check`**, **`npm start`** — SSDP discovery (3 devices), telnet **8080** / **8085** to `192.168.1.75` as expected. *(Relay **`npm run remote-server`** not exercised in that run — tick below when you smoke-test it.)*

---

## Phase 0 — Tooling and layout

- [x] **0.1** Root and/or workspace `tsconfig` base (shared `compilerOptions`: `strict`, `moduleResolution`, targets aligned with **current** Electron Node version — bump later).
- [x] **0.2** `packages/roku-dev-studio-api`: `tsconfig.json` + **`build.mjs` (esbuild)** → **`dist/`** (see Current state; **`tsc`** used for **`typecheck`** only until clean).
- [x] **0.3** `packages/roku-dev-studio-remote-server`: **`tsconfig.json`** + **`build.mjs`** → emitted **`roku-remote-server.js`**; **`npm run typecheck`** in package.
- [x] **0.4** `apps/roku-dev-studio`: **Node/main** (`tsconfig.electron.json`), **HTML renderer** (`tsconfig.renderer.json`), **build scripts** (`tsconfig.scripts.json`), **Solid** (`tsconfig.json` **extends** base). **Legacy renderer** uses **`strict: true`** with **`// @ts-nocheck`** on selected large files until migrated incrementally (see **[strictness doc](typescript-strictness-nocheck-and-legacy.md)**).
- [x] **0.5** **Bundled main + preload**: **`scripts/build/transpile-main-process.ts`** (**`tsx`**) outputs **`main.bundled.cjs`** + **`preload.bundled.cjs`** (+ **`preload-about.js`**); `package.json` **`main`** → **`main.bundled.cjs`**; preload **`external: ['electron']`**; main **`external`**: `electron`, `roku-dev-studio-api`, `ws`, `form-data`, `pdf-lib`.
- [x] **0.6** Root **`npm run typecheck`**: api + electron + **`typecheck:renderer`** + **`typecheck:scripts`** + remote-server + Solid **`renderer:solid:typecheck`**.
- [x] **0.7** Workspace **imports**: `roku-dev-studio-api` resolves to **`dist/index.js`**; preload uses **`dist/lib/*`**. **`.d.ts`** + **`declarationMap`** emitted into **`dist/`** and included in the published tarball (registry consumers get types).

---

## Phase 1 — Shared library and packages (bottom of dependency graph)

- [x] **1.1** Repo-root **`lib/path-safe.js`** → TypeScript (or app-local copy only if duplication is removed); consumers updated.
- [x] **1.2** **`packages/roku-dev-studio-api`**: all hand-maintained `.js` sources → `.ts`; **`rds`** + examples run from **`dist/`** after esbuild + **`.d.ts`** emit. **Follow-up:** **`noImplicitAny`** in api **`tsconfig.json`** remains **`false`** until tightened incrementally.
- [x] **1.3** **`packages/roku-dev-studio-remote-server`**: **`roku-remote-server.ts`** (+ **`@ts-nocheck`**); emitted **`roku-remote-server.js`** (gitignored at repo root — **`prepare`** rebuilds on install/publish); **`package.json`** **`files`** lists **`roku-remote-server.js`**, **`swagger.json`**, **`swagger-ui.html`** so npm contents are explicit. **`npm start`** unchanged.

**Verify (Phase 1)**

- [x] From repo root: `npm install` succeeds.
- [x] `rds --help` (or `npm exec -w roku-dev-studio-api -- rds --help`) runs.
- [x] Desktop app: `npm start` — window, discovery, ECP/telnet paths you use (verified 2026-04-09).
- [x] Remote server: `npm run remote-server` reaches listening state / health (optional until you rely on relay).

---

## Phase 2 — Electron main + preload (bundled)

- [x] **2.1** `main.js` → `main.ts` (or `src/main/index.ts`): window creation, menus, `loadMainRenderer`, settings hooks, error handlers — typed.
- [x] **2.2** `preload.js` → `preload.ts`: `contextBridge` surface typed; **shared types** for IPC/channel names where practical (`preload ↔ main ↔ renderer`). *(**`shared/ipc/channels.ts`**, **`payloads.ts`**, **`index.ts`**; main IPC + preload use **`IPC.*`** and typed payloads.)*
- [x] **2.3** `main/ipc/*.js` → `.ts`: handlers typed; `safeSendToRenderer` payloads narrowed where possible.
- [x] **2.4** Other main-process helpers (`about-dialog`, `settings`, etc.) → `.ts`.
- [x] **2.5** **esbuild (or chosen bundler)** config: main bundle target = current Electron Node; preload bundle = existing CJS + `external: ['electron']` pattern preserved.
- [x] **2.6** Remove obsolete raw `main.js` / `preload.js` from runtime path after bundle is source of truth (keep git history; delete or redirect only when bundle is verified).

**Verify (Phase 2)**

- [x] `npm start` (legacy renderer): window opens, menu works, **About** opens.
- [x] Connect to a device (local or relay): discovery / manual IP still works.
- [x] **Telnet** debug console: connect, receive logs, disconnect.
- [x] **One ECP path**: e.g. remote key or query from UI.
- [x] **Dev mode / sideload** path: at least open Dev App tab and confirm no preload errors in DevTools console.
- [x] **`npm run start:solid`**: Solid shell loads; `window.roku` still detected if expected.

---

## Phase 3 — Legacy renderer (largest surface)

Work in **slices** (order flexible; complete all before marking phase done):

- [x] **3.1** `renderer/modules/**/*.js` → `.ts` (utils, UI helpers, constants). **Emit:** **`scripts/build/index.ts`** (**`tsx`**) orchestrates **`transpile-main-process.ts`** (main + preload CJS) and **`transpile-renderer.ts`** (legacy **`.ts`** → **`renderer/dist/**/*.js`**). **`bundle-electron.ts`** is a thin forwarder. **Gitignore:** `renderer/dist/`. **Types:** `tsconfig.renderer.json`, `renderer/legacy-renderer-globals.d.ts`.
- [x] **3.2** `renderer/components/**/*.js` → `.ts`: **queries**, **action-scripts**, **inspector**, **dev-app**, **modals** — **emit** + **gitignore** like 3.1; **`@ts-nocheck`** on **app + large component trees** (see Current state).
- [x] **3.3** `renderer/app.js` → **`app.ts`** (runtime loads **`dist/app.js`** via **`index.html`**). **`window.roku`**: loose preload-shaped typing in **`legacy-renderer-globals.d.ts`** (tighten vs **`preload.ts`** later).
- [x] **3.4** Build integration: **esbuild** compiles legacy **`.ts`** → **`renderer/dist/`** (ESM); modal **HTML** fragments copied into **`dist/`** for **`import.meta.url`**. **Optional later:** single Vite bundle for the full legacy tree.
- [x] **3.5** Typings for **DOM** templates: minimal `data-*` contracts or small interfaces for panel roots passed into setup functions. **`renderer/types/device-panel-dom.ts`** (`DeviceInnerTabId`, `DevicePanelRoot`), **`renderer/types/dom-string-map-augmentation.ts`** (`DOMStringMap`); main setup entrypoints use **`DevicePanelRoot`**.
- [x] **3.6** No hand-maintained **`renderer/**/*.js`** sources left (runtime **`.js`** is build output only; **vendor/copied assets** unchanged if added later).

**Verify (Phase 3)**

- [x] Full manual pass on **each major tab**: Home, Remote, Apps, Queries, Dev App, Telnet, App Connector, Action Scripts, Settings flows you use.
- [ ] **Find/filter** in telnet view; **copy/save** logs.
- [ ] **Action Scripts**: build, run, PDF export if you use it.
- [ ] **Remote server** flows: add location, connect, telnet/ECP via relay.
- [ ] No repeated errors in **main** or **renderer** DevTools console during normal use.

---

## Phase 4 — Solid + Vite renderer (align with strict monorepo)

- [x] **4.1** **`apps/roku-dev-studio/tsconfig.json`** **`extends`** **`../../tsconfig.base.json`** (Solid + Vite sources).
- [ ] **4.2** Expand **`global.d.ts`** / preload API types as bridges grow.
- [x] **4.3** **`npm run renderer:solid:typecheck`** included in root **`npm run typecheck`**; **`renderer:solid:build`** still verify locally if you ship **`RDS_SOLID_RENDERER=dist`**.

**Verify (Phase 4)**

- [x] `npm run renderer:solid:typecheck` (also run from root **`npm run typecheck`** and in **CI**).
- [ ] `npm run renderer:solid:build` → `renderer-vite-dist/` usable with `RDS_SOLID_RENDERER=dist npm start` (if that path is still supported).

---

## Phase 5 — Scripts and cleanup

- [x] **5.1** `apps/roku-dev-studio/scripts/**` build tooling is **`.ts`** run with **`tsx`**; **`electron-builder`** hook uses **`scripts/build-hooks-entry.cjs`** (registers **`tsx`**, loads **`build-hooks.ts`**). **`generate-icons`**, deprecated **`bundle-electron`** / **`bundle-preload`** forwarders are **`.ts`**.
- [x] **5.2** **INSTALLATION.md** / **README** reference **`npm run typecheck`** and current layout; repo tree note uses bundled main/preload (**`README.md`**).
- [x] **5.3** **electron-builder** **`main`**: **`main.bundled.cjs`**; preload bundles + legacy emit wired by **`prepare` / `start`**. Re-grep after large refactors.

**Verify (Phase 5)**

- [ ] `npm run build` (or platform-specific) produces artifacts; smoke-install or run packaged app once if you normally ship.

---

## Deferred work (after migration is verified)

Do **not** block the migration branch on **Electron upgrade**; schedule after you are happy with manual verification. **CI** already runs **`npm run typecheck`** plus **`ci:api`**, **`ci:remote-check`**, and **`ci:app-check`** (see **`.github/workflows/ci.yml`**).

| Item | Notes |
|------|--------|
| **Electron bump** | Upgrade `electron` + align `electron-builder` / native deps; re-run full **Verify** sections. |

---

## Single “definition of done” checklist

Use this before you consider the migration finished.

- [ ] **Strict**: every `tsconfig` **should** use **`"strict": true`**; **remaining gaps:** **`// @ts-nocheck`** on legacy **`app.ts`** + large component trees, and on **`roku-remote-server.ts`** — remove incrementally (see **[strictness doc](typescript-strictness-nocheck-and-legacy.md)**). Electron **`noImplicitAny`** is on.
- [x] **No hand-maintained migration JS** in **`packages/*`** (remote server source is **`.ts`**), **`renderer/`** sources (emit is **`.js`**), **`preload*.ts`** / **`main*.ts`**, **`apps/roku-dev-studio/scripts/*.ts`** (plus **`build-hooks-entry.cjs`** for **electron-builder** `require`). **Remaining:** **`lib/path-safe.js`** (generated from **`.ts`**).
- [ ] **`npm start`** = legacy UI, fully functional for your smoke tests (manual).
- [ ] **`npm run start:solid`** = Solid shell still runs (manual).
- [x] **`npm run typecheck`** (root) passes locally (and in **CI**).
- [ ] This doc: remaining open items are **`4.2`**, manual **Verify** sections, **`renderer:solid:build`** smoke, packaged **`npm run build`** if you ship installers, and **`@ts-nocheck`** removal per strictness doc.

---

## Notes for the implementer (agent / human)

- Prefer **incremental commits** per phase inside the branch so `git bisect` stays possible.
- When converting **preload**, keep **contextIsolation** and **minimal exposure** unchanged unless explicitly security-reviewed.
- **Large renderer**: converting **modules → components → app** reduces risk before touching the 4k-line app shell.
- Update **this file’s checkboxes** in the same commits that complete each phase.

---

*Last updated: 2026-04-09 — App **`scripts/**`** TypeScript + **`tsx`** (**5.1**); **`tsconfig.scripts.json`**; **`build-hooks-entry.cjs`** for **electron-builder**.*
