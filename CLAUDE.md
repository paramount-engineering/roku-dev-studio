# Roku Dev Studio — project rules

## UI text: single source of truth (`@shared/strings`)

All user-facing UI text lives in the shared catalog
`apps/roku-dev-studio/shared/strings/` and is driven from there. **Never hardcode a
display string** in components or HTML — add it to the catalog and reference it.

**Adding / changing a string**
- Put it in the matching per-area module `shared/strings/<area>.ts` (each is
  `export const <area> = { ... } as const;`). It's auto-composed into the single `S`
  object by `shared/strings/index.ts` — no wiring needed.
- Reuse `S.common.*` for generic words (Save, Cancel, Close, Copy, …). Don't duplicate.
- Parametrized text = a function returning a template literal, e.g.
  `withCount: (n: number): string => \`${n} item${n === 1 ? '' : 's'}\``.

**Referencing it**
- TS/renderer: `import { S } from '@shared/strings/index.js';` then `S.<area>.<key>`.
- Static HTML: `data-i18n="area.key"` for text; `data-i18n-title` /
  `data-i18n-placeholder` / `data-i18n-aria-label` for attributes. Keep the English
  inline as the fallback. Each window calls `applyI18n(document)` at load; any
  runtime-cloned/injected subtree must call `applyI18n(root)` on itself.

**What does NOT belong in the catalog**
CSS class names, element ids, IPC channel names, config/setting keys, ECP/RALE/
protocol tokens, URLs, regexes, file paths, and developer log messages (`console.*`,
`rendererError`, loggers). Only user-*visible* text.

**Casing — contextual, not mechanical Title Case**
Capitalize meaningful words (first word, nouns, adjectives, proper/product nouns like
BrightScript / Dev App / Developer Mode, and a leading imperative verb). Keep
lowercase: articles, prepositions, conjunctions, determiners (`this`/`that`), linking
verbs (`is`/`are`/`be`), and verbs right after infinitive "to" (…`to identify`…).
Never re-case acronyms/units/code literals (IP, ECP, ms, `.zip`, `true`). Real
multi-sentence help prose stays sentence case. Examples: "Display Name", "Check for
Updates", "A Friendly Name to identify this location", "Remember Password for this
device".

**Namespaces:** common, app, settings, sideloadRelay, networkInspector,
networkSessionViewer, devApp, actionScripts, inspector, queries, modals, consoleLog,
ui, telnet, fiddle, floatingRemote, about, deeplink, utils, logFileViewer.

**Verify:** `npm run verify:i18n` (in `apps/roku-dev-studio`) checks every
`data-i18n*` key in the HTML resolves to a real catalog string; `npm run typecheck`
catches missing `S.*` keys in TS. Static HTML text is only partly migrated — inline
prose containing child markup (`<strong>`/`<code>`/`<a>`) is intentionally left inline
(the single-text-node `applyI18n` can't rebuild it); everything else is catalog-driven.

To translate: add an alternate catalog with the same shape and swap what
`index.ts` composes into `S` — the lookup + `applyI18n` DOM pass are locale-agnostic.
