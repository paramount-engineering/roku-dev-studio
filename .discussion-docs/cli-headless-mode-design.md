# CLI / headless mode — design

## Context

Today, **Roku Dev Studio** is primarily experienced through the **Electron** desktop app: device selection, Dev App sideload, screenshots, Action Scripts, console, and RALE run in that environment.

The **`roku-dev-studio-api`** package already exposes the core **programmatic** surface: discovery (SSDP / subnet scan), device info, ECP helpers (`query`, `post`, `keypress`, `launch`, …), developer **sideload** / **delete sideload**, **screenshots**, validation utilities, and a **`createRelayClient`** path for remote deployments (same logical API over HTTP to **Roku Dev Studio Remote Server**).

This note proposes a **CLI companion** (and optionally a **`--headless` entry** on the desktop artifact) so pipelines and shell scripts can use that logic without opening the GUI.

**Related:** [ROKU_DEV_STUDIO_API_DESIGN.md](./ROKU_DEV_STUDIO_API_DESIGN.md), `packages/roku-dev-studio-api/README.md`.

---

## Goals

| Use case | Desired outcome |
|----------|-----------------|
| **CI/CD sideload** | Install a `.zip` / `.pkg` on a target Roku from a job (direct LAN/VPN or via relay). |
| **Terminal automation** | Run sequences comparable to **Action Scripts** (ECP, waits, sideload, screenshot) from the shell. |
| **Test harnesses** | Capture screenshots to files with stable exit codes and optional **machine-readable** output. |
| **Shell glue** | Query **device info** (and simple ECP `query` results) for scripting and assertions. |

---

## Non-goals (initially)

- Replacing the Electron app for interactive day-to-day work.
- Bundling a full **telnet console** or **RALE UI** in v1 CLI (RALE may appear later as optional commands if wire protocol is shared or exposed from a small Node layer).
- Supporting non-Node consumers (they already have the **relay HTTP API** per the API design doc).

---

## Product shape: CLI vs `--headless`

Three patterns are compatible; the repo can adopt one or combine them.

### A. Standalone CLI package

- **New workspace package**, e.g. `packages/roku-dev-studio-cli/`, with a **`bin`** named **`rds`** pointing at a small Node entry.
- **Depends on** `roku-dev-studio-api` (workspace `file:` link, same as the app).
- **Pros:** Library stays free of CLI-only dependencies and release churn; CLI can version independently if needed.
- **Cons:** Another package to version and document.

### A′. CLI inside `roku-dev-studio-api` (same package)

- Add a **`bin`** entry in `packages/roku-dev-studio-api/package.json` (e.g. **`rds`** → `cli.js`) alongside the existing **`main`** export. `require('roku-dev-studio-api')` is unchanged; the CLI entry `require()`s the same modules the library already ships.
- **Pros:** One install for **library + terminal** (`npm i roku-dev-studio-api` then `npx rds …` or global `bin`); no extra workspace package; matches how many tools ship (`eslint`, `typescript`, etc.).
- **Cons:** Adds **CLI dependencies** (e.g. commander) to the API package’s dependency tree — fine for most consumers, but pure-library users inherit them unless you use **optionalDependencies** (unusual for a parser) or keep the CLI dependency set minimal; **semver** must account for CLI UX (flags, help text) as well as API surface if you treat breaking CLI changes as major bumps.

**When A′ is a good fit:** You want the smallest monorepo surface and expect most CLI users to already depend on or install the API package anyway.

### B. `electron` app flag (`--headless`)

- The **desktop** `apps/roku-dev-studio` process starts without opening a window and runs the same (or a thin wrapper around) CLI command parsing in the **main** process.
- **Pros:** Single published “app” for users who already install Electron builds.
- **Cons:** Heavier cold start in CI; packaging complexity; still need to expose a **Node-only** path for agents that do not want Electron.

### C. Both

- Implement **command parsing and handlers once** (shared module used by CLI `bin` and optionally by Electron main when `--headless` is passed).

**Recommendation:** Choose **A′** (CLI in `roku-dev-studio-api`) if you are comfortable coupling CLI releases to the API package and want one artifact. Choose **A** (separate CLI package) if you want a hard split between “library semver” and “CLI semver” or to keep the API package dependency tree minimal. Add **B** only if there is a concrete need to distribute one Electron binary and avoid a separate Node CLI install.

---

## Command-line UX (sketch)

Use a **nested subcommand** style (familiar for automation tools). The executable name is **`rds`** (**R**oku **D**ev **S**tudio — short and recognizable).

- **Global options:** `--json` (structured stdout), `--quiet`, direct vs relay (`--relay <baseUrl>`), default `--ip` / discovery.
- **Discovery:** `discover` (SSDP and/or subnet; align with `ssdpDiscover` / `subnetScan` options).
- **Device:** `device info` → wraps `getDeviceInfo` / formatted table vs JSON.
- **ECP:** `ecp query <path>`, `ecp post <path>`, `keypress <key>`, `launch <appId>`, etc., mapping 1:1 to API helpers.
- **Dev tools:** `sideload <file>`, `sideload delete`, `screenshot <outfile>` using `sideloadChannel`, `deleteSideload`, `captureRokuScreenshot`.
- **Passwords:** support **`ROKU_DEV_PASSWORD`** (and/or `--password` with warning in docs) for sideload/screenshot; never log secret values.

**Exit codes:** `0` success; non-zero for validation errors, connection/ECP failure, and sideload/screenshot failure — mirror API `{ success: false }` cases consistently.

**Machine-readable output:** when `--json`, emit a single JSON object per invocation (or NDJSON for streaming discovery if needed later) so CI can parse without scraping tables.

**Examples:**

```bash
rds discover --json
rds device info --ip 192.168.1.10
rds ecp query /query/media-player --ip 192.168.1.10 --json
rds keypress Home --ip 192.168.1.10
rds sideload ./out/channel.zip --ip 192.168.1.10
rds screenshot ./artifacts/screen.png --ip 192.168.1.10
rds device info --relay http://relay-host:4951 --ip 10.0.0.50
rds script run ./ci/smoke.json --ip 192.168.1.10
```

---

## Argument parsing: Commander vs Yargs

| Criterion | Commander | Yargs |
|-----------|-----------|--------|
| **Style** | Declarative chains; common in modern CLIs | Verbose config; very flexible |
| **Nested commands** | Good fit for `device`, `ecp`, `sideload` | Good fit with `.commandDir` patterns |
| **Help text** | Strong defaults | Strong defaults |

**Recommendation:** **Commander** (or **Commander + `@commander-js/extra-typings`** if the CLI is later authored in TypeScript) for a small dependency footprint and straightforward subcommands. **Yargs** remains a fine choice if the team prefers its middleware and coercion ecosystem.

Parser choice is an implementation detail; **handlers should call `roku-dev-studio-api` only**, not embed protocol logic.

---

## Action Scripts from the terminal

The app’s **Action Scripts** are JSON documents with **typed steps** (`query`, `post`, `keypress`, `sideload`, `screenshot`, `wait`, `raleCommand`, `appFunction`, …) executed by **renderer-side** code (`executor-engine.js`), including **DOMParser** for media-player XML and **RALE** integration for some step types.

For CLI:

- **Phase 1 — “API-aligned” runner:** Implement `script run <file.json>` that executes only steps that map directly to **`roku-dev-studio-api`** (and relay client): e.g. `query`, `post`, `keypress`, `inputText`, `launch`, `deeplink`, `sideload`, `deleteSideload`, `screenshot`, and simple **`wait`** (fixed delay; media-player condition may reuse a **Node XML parser** or shared extracted helper — avoid pulling Electron/renderer into the CLI).
- **Phase 2 — parity:** Optionally extract a **headless-safe executor core** from the app (shared package) so CLI and GUI stay aligned; **RALE** steps require a defined Node transport (socket/client) and may remain **unsupported** or **best-effort** until that exists.

Document **clear error messages** when a script contains unsupported steps in CLI mode.

---

## CI/CD notes

- **Direct mode:** runner must reach the Roku (same LAN, VPN, or routed network); **`curl` on PATH** is required for sideload/screenshot/delete sideload (per API README).
- **Relay mode:** set `--relay https://host:port` and pass the device IP **as seen by the relay**; aligns with `createRelayClient`.
- **Secrets:** prefer **environment variables** in CI over flags; document variable names in package README when shipped.
- **Idempotency:** `sideload` overwrites dev channel; document behavior for repeated jobs.

---

## Implementation phases (suggested)

1. **CLI skeleton** — `bin` in `roku-dev-studio-api` or a dedicated package; Commander (or Yargs); global `--json`, `--relay`, `--ip`, `device info`, `ecp query`, `screenshot`, `sideload`.
2. **Discovery + remaining ECP shortcuts** — `discover`, `keypress`, `launch`, etc.
3. **Action Script subset runner** — validate JSON against the same schema rules as the app where possible; execute API-mapped steps only.
4. **Optional:** `--headless` on Electron that delegates to the same handler module; optional **shell completions**.

---

## Open questions

- **Binary name:** **`rds`** — confirm no unacceptable clash with other npm/global tools named `rds`; scoped package name (`@…/roku-dev-studio-api`) can still differ from the `bin` name.
- **Versioning:** lock CLI major/minor to **`roku-dev-studio-api`** or version independently with a documented compatibility matrix.
- **TypeScript:** keep CLI in plain JS for consistency with the API package, or introduce TS for the CLI only (types from future `.d.ts` on the API).
- **Action Script schema:** single source of truth for validation (shared module vs duplicated JSON Schema) to avoid GUI/CLI drift.

---

## Summary

A **small CLI** — either **`bin` on `roku-dev-studio-api`** (A′) or a **separate package** (A) — delivers the highest leverage for **CI sideload**, **scriptable screenshots**, and **device/ECP queries**, with **relay** support matching remote workflows. **`--headless` on Electron** is optional sugar. **Action Script** execution from the CLI should start with an **API-compatible subset** and grow toward shared executor logic if parity with the GUI is required.
