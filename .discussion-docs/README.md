# `.discussion-docs/` — design notes, RFCs, and lessons-learned

Per the always-applied workspace rule [`discussion-design-docs.mdc`](../.cursor/rules/discussion-design-docs.mdc), **exploratory write-ups, design docs, and ADR-style notes** for Roku Dev Studio live in this folder (kebab-case filenames). End-user / public docs go under `docs/` or package READMEs instead — don't cross the streams.

This index is curated by hand. When you add or rename a doc here, add or update the matching row.

---

## How to read this folder

- **Living guides** (top of the list) — read these first; they describe how the repo wants to be built and what's already shipped.
- **Landed designs** — designs that produced merged code; read the **Lessons learned** / **Status** section first when revisiting an area.
- **Planning / exploratory** — proposals, options write-ups, and conversation drift. Status block at the top of each doc says whether anything was acted on.

A new design doc should follow the template described in [`engineering-principles.md` §15](./engineering-principles.md#15-design-doc-before-major-changes) (status, what was wrong, goals & non-goals, design, migration plan, risks, decisions needed, lessons learned).

---

## Living guides (read first)

| Doc | What it's for |
|-----|---------------|
| [`engineering-principles.md`](./engineering-principles.md) | The workspace's living style guide — 20 numbered principles, the anti-patterns we've fixed, where things live, build order, smoke-test loop, when to ask before scope expansion. **Updated whenever a new pattern lands or the user states a guideline.** |
| [`principle-aligned-cleanups.md`](./principle-aligned-cleanups.md) | Backlog of "this code doesn't follow the conventions in `engineering-principles.md` yet". Each entry cites the offending file, the principle it violates, the symptom it'd produce, and what the fix is. Most items shipped 2026-05-04; one is intentionally deferred. |

## Landed architecture / refactor designs

| Doc | What it landed |
|-----|----------------|
| [`mcp-server-action-scripts.md`](./mcp-server-action-scripts.md) | Original v1 design for the `roku-dev-studio-mcp` server, plus a **Status (2026-04)** block describing what shipped (two surfaces: direct ops + Action Scripts) and how the design has evolved since. |
| [`unified-action-script-validation.md`](./unified-action-script-validation.md) | One canonical Action Script validator in `roku-dev-studio-api/lib/validate-action-script.ts`; MCP, renderer, and CLI are all thin adapters. Phase 0a → 0c all landed, 51-case fixture covers the rules. |
| [`app-connector-state-centralization.md`](./app-connector-state-centralization.md) | Per-panel `AppConnector` now also owns the channel's function list (one cache, fan-out via `onFunctionsChange`). Replaces the three-cache trio that Inspector / Builder / MCP bridge used to keep separately. |
| [`app-connector-refactor.md`](./app-connector-refactor.md) | The earlier move from per-component RALE socket ownership to a single per-panel `AppConnector`. Foundation for `app-connector-state-centralization.md`. |
| [`safe-storage-integration.md`](./safe-storage-integration.md) | Encrypts the per-device dev-password store via Electron `safeStorage` (macOS Keychain / Windows DPAPI / secret-service / kwallet). Replaces plaintext `localStorage`. |
| [`rale-node-lookup.md`](./rale-node-lookup.md) | Inspector node lookup design (Get Node by ID / by SubType) — the UX foundation that the **Update Node** modal (`selectNode` / `setField` / `removeField`) is built on. |
| [`rale-builtins-action-scripts-integration.md`](./rale-builtins-action-scripts-integration.md) | Surfacing the Inspector RALE built-ins (registry CRUD, node lookup, etc.) into Action Scripts via the `raleCommand` step type. |
| [`wait-node-field-condition.md`](./wait-node-field-condition.md) | The `wait` step's `rale-node-field` condition source: poll `getNodeById` and compare a field with string-friendly operators. |
| [`remote-section-metrics-graphs-design.md`](./remote-section-metrics-graphs-design.md) | Remote-tab CPU / memory / objects performance charts — data sources, polling cadence, scaling for many devices, relay-server expectations. |

## CLI, automation, and library surface

| Doc | Topic |
|-----|-------|
| [`cli-headless-mode-design.md`](./cli-headless-mode-design.md) | Design for `rds` (the headless CLI shipped with `roku-dev-studio-api`) so the same flows work outside Electron. |
| [`ROKU_DEV_STUDIO_API_DESIGN.md`](./ROKU_DEV_STUDIO_API_DESIGN.md) | Target design and language-support matrix for the `roku-dev-studio-api` npm package. |
| [`roku-dev-studio-api-external-vs-bundled.md`](./roku-dev-studio-api-external-vs-bundled.md) | When the desktop app should consume the published `roku-dev-studio-api` from npm vs. a bundled local copy, and the implications for upgrades. |
| [`automated-channel-testing-and-dev-studio.md`](./automated-channel-testing-and-dev-studio.md) | How Roku WebDriver, the Robot Framework library, and the JS library relate to this workspace, and where Dev Studio could feasibly integrate. |
| [`scenegraph-rale-visualization.md`](./scenegraph-rale-visualization.md) | Proposal: live SceneGraph explorer (tree, inspector, search, highlight-on-screenshot) on top of the existing RALE surface in `TrackerTask.xml`. |

## AI / Action Script authoring

| Doc | Topic |
|-----|-------|
| [`action-script-enhancements-design.md`](./action-script-enhancements-design.md) | Builder-first authoring, variables, control flow (`if`), reuse, CLI execution. Foundation for Script v2 features that have since shipped. |
| [`AI-ActionScript-Generator-NextSteps.md`](./AI-ActionScript-Generator-NextSteps.md) | Planning notes for an AI-powered Action Script generator. No code shipped from this doc on its own. |
| [`ai-ticket-to-action-script.md`](./ai-ticket-to-action-script.md) | Exploratory design: feed a feature/bug ticket into an AI and get a runnable Action Script back. Conversation only — no implementation. |

## Build, packaging, and tooling

| Doc | Topic |
|-----|-------|
| [`macos-code-signing-and-notarization.md`](./macos-code-signing-and-notarization.md) | Removing the `xattr -cr` step for end users — Apple Developer ID signing + notarization plan and the env-var contract `electron-builder` expects. |
| [`js-to-typescript-migration.md`](./js-to-typescript-migration.md) | Plan for moving the renderer + main + preload from JavaScript to TypeScript with `strict: true`, in lockstep with the existing `npm run typecheck` CI gate. |
| [`typescript-strictness-nocheck-and-legacy.md`](./typescript-strictness-nocheck-and-legacy.md) | What the strict-mode flags actually mean in this repo and where `// @ts-nocheck` is intentionally used. Companion to the migration plan. |
| [`dependency-automation.md`](./dependency-automation.md) | How Renovate is configured (`renovate.json`) for npm deps, GitHub Actions, and lockfiles. |
| [`npm-to-bun-migration.md`](./npm-to-bun-migration.md) | Exploratory write-up on whether to switch from npm workspaces to Bun. **Status: exploratory** — no migration committed. |

## Verification reports & comparisons

| Doc | Topic |
|-----|-------|
| [`mcp-flows-test-report.md`](./mcp-flows-test-report.md) | Hands-on MCP flow audit (every tool against three real Rokus, 2026-05-01). The bugs surfaced here drove the validator unification, App Connector centralization, and several agent-prose fixes. |
| [`rokdock-vs-roku-dev-studio.md`](./rokdock-vs-roku-dev-studio.md) | Detailed comparison vs. `paramount-streaming/rokdock` — what each tool covers, where they overlap, sources of truth used. |

---

## When to add a new doc

- Anything that touches multiple packages, has architectural impact, or would surprise a reviewer in a large diff → write a design doc here **before** coding.
- Anything where the user or a reviewer has open decisions to make → put them in the doc's "Decisions needed before coding" checklist so the diff that follows is mechanical.
- A bug-fix that exposed a generalizable principle → add it to `engineering-principles.md` (per [`keep-engineering-principles-current.mdc`](../.cursor/rules/keep-engineering-principles-current.mdc)) rather than starting a new doc.

When a design graduates to "shipped, user-facing": mirror the relevant parts into `docs/`, the package README, or the in-app Help modal — and leave the design doc here with a `Status: landed` line so future readers don't re-litigate it.
