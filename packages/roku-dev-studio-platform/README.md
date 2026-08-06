# `roku-dev-studio-platform`

Shared host-platform helpers for Roku Dev Studio — OS identity, human labels, modifier keys
(renderer-safe), plus node-only filesystem helpers. Used by the desktop app and other packages so
platform logic lives in one place instead of being re-implemented per consumer.

## Requirements

- Node.js 24.17 or higher

## Install and build

This package is consumed from within the monorepo via npm workspaces — it isn't meant to be
installed standalone. From the repository root:

```bash
npm install          # postinstall runs `npm run build:libs`, which builds this package to dist/
npm run typecheck:platform
```

## Exports

Everything is exported as separate subpath entries so consumers (and the renderer bundler) only
pull in what they use:

| Subpath | What it is |
|---------|------------|
| `.` (`index.ts`) | OS identity / human-label helpers. Intentionally **renderer-safe** — imports no Node built-ins, so the renderer bundle never pulls them in. |
| `./node` | Node-only helpers (filesystem / environment) — kept separate from the renderer-safe identity entry for the same reason. |
| `./validation` | Cross-cutting input validation (IP syntax, password length/control-character guards) shared by the desktop app, API, and remote server. |
| `./device-ref` | `DeviceRef` — normalizes the many ways callers refer to a device (raw IP, serial, friendly name) into one shape, with lookup helpers against a device collection. |
| `./ttl-cache` | Generic time-to-live cache with lazy expiry sweeps on write (no background timer). |
| `./async-patterns` | Shared timing / async-rate primitives — debounce, throttle, exponential backoff — so cancellation and edge-case semantics stay consistent everywhere they're used. |
| `./path-safe` | Safe path resolution / containment checks for building paths from user or external input. |
| `./text-match` | Environment-agnostic text-search primitives (regex compilation, ReDoS/length guards) shared by every "find" surface in the app. |

## Used by

- `apps/roku-dev-studio` — the Electron desktop app (main process and, for the renderer-safe
  entries, the renderer)
- `roku-dev-studio-api`
- `roku-dev-studio-mcp`
- `roku-dev-studio-network-inspector`
- `roku-dev-studio-remote-server`

## License

Released under the [MIT License](../../LICENSE).
