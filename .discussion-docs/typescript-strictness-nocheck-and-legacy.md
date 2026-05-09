# TypeScript strictness, `noImplicitAny`, and `// @ts-nocheck` in this repo

This note complements **[`js-to-typescript-migration.md`](js-to-typescript-migration.md)**. It explains what the compiler flags mean and how they apply to **Electron**, **legacy renderer**, and **remote server** code paths.

---

## `strict`

When **`"strict": true`** is set (our **`tsconfig.base.json`**), TypeScript enables a bundle of checks. The important ones for day-to-day work include:

| Flag | Effect (short) |
|------|----------------|
| **`strictNullChecks`** | `null` and `undefined` are not assignable to arbitrary types unless allowed (e.g. unions, optional props). |
| **`strictFunctionTypes`** | Stricter checking of function parameter positions (contravariance for callbacks). |
| **`strictBindCallApply`** | `bind` / `call` / `apply` are checked against the target function’s signature. |
| **`strictPropertyInitialization`** | Class fields must be initialized in the constructor or marked definite. |
| **`noImplicitThis`** | `this` must have a known type in functions (no implicit `any` for `this`). |
| **`alwaysStrict`** | Emits `"use strict"`; aligns with strict mode semantics. |
| **`noImplicitAny`** | See below — often the first “wall” when tightening legacy JS-style code. |

**In this repo:** anything that **extends** `tsconfig.base.json` inherits **`strict: true`** unless a derived config overrides **`compilerOptions`**.

---

## `noImplicitAny`

When **`noImplicitAny`** is **on** (it is part of **`strict`**):

- If TypeScript **cannot infer** a type for a variable, parameter, or property, it reports an error instead of silently typing it as **`any`**.
- **Explicit** `any` is still allowed if you write it (that is a separate choice).

**Practical impact:** legacy patterns like empty `catch (e) { }` may need **`catch (e: unknown)`** and narrowing; untyped APIs may need interfaces or **`@types`** packages.

---

## `// @ts-nocheck`

- Placed at the **top of a source file** (before other statements), it tells TypeScript to **skip type checking for that entire file**.
- The file is still **parsed** and can be **emitted** if your build emits JS; only **checking** is disabled.
- It does **not** affect other files: imports from a `@ts-nocheck` file are still checked **from the importer’s** perspective according to whatever types are visible (often loose or `any`).

**Use in this repo:** a **temporary** escape hatch for large legacy renderer files while smaller areas (**`renderer/modules/`**, **`components/queries/`**) are brought under full checking. The goal is to **remove it file-by-file** (or folder-by-folder), not to rely on it indefinitely.

---

## How this maps to configs here

| Area | Config | Checking |
|------|--------|----------|
| **Electron main / preload + shared IPC** | `apps/roku-dev-studio/tsconfig.electron.json` | Extends base → **full `strict`**. Includes **`shared/**/*.ts`** (IPC channel names and payloads). |
| **Legacy renderer** | `apps/roku-dev-studio/tsconfig.legacy-renderer.json` | Extends base → **full `strict`** for included globs; many included files still start with **`// @ts-nocheck`**, which disables checking **inside** those files only. |
| **Remote server** | `packages/roku-dev-studio-remote-server/tsconfig.json` | **Strict**; **`roku-remote-server.ts`** may still use **`@ts-nocheck`** until peeled incrementally. |

**Commands (from repo root / app):**

- **`npm run typecheck`** — full project check (api, electron, legacy renderer, remote server, Solid).
- **`npm run typecheck:legacy-modules`** — **`tsc --noEmit -p tsconfig.legacy-renderer.json`** (workspace script forwards to **`roku-dev-studio`**).

---

## Incremental workflow: removing `// @ts-nocheck`

1. Pick **one file** (or a small directory) that still has **`// @ts-nocheck`**.
2. Delete the first line (`// @ts-nocheck`).
3. Run the appropriate **`tsc`** / **`npm run typecheck:…`** for that surface.
4. Fix errors locally: add types, narrow **`unknown`**, extend **`legacy-renderer-globals.d.ts`** for **`window`** / DOM extensions if needed, avoid widening everything to **`any`** unless unavoidable.
5. Commit when that file (or batch) is clean.
6. Repeat — **bulk-removing** every pragma at once tends to produce thousands of errors and is hard to review.

---

## Summary

| Concept | In one sentence |
|--------|------------------|
| **`strict`** | Enables a set of stricter rules (including **`noImplicitAny`**) so more bugs are caught at compile time. |
| **`noImplicitAny`** | Unannotated positions that would be **`any`** become errors — forces explicit typing or better inference. |
| **`// @ts-nocheck`** | Disables type checking for **one file**; use sparingly and remove incrementally on legacy surfaces. |

*Last updated: 2026-04-09*
