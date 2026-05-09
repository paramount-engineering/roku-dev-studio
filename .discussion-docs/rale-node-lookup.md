# Design: Scene node lookup (by ID and by subtype/class) in Roku Dev Studio

## Goals

- Query the live SceneGraph from **App Connector** using the existing RALE protocol (`TrackerTask.xml` handlers), without new BrightScript.
- Support **Get Node by ID** and **Get Node by SubType (component class)** via the same **`Execute Function`** flow as app-defined functions.

## UX (current)

- The **Function** dropdown uses **`<optgroup>`** with two sections:
  1. **App Connector functions** — from `getExternalControlFunctions` (unchanged; **Refresh** reloads only this list).
  2. **RALE functions** — built-ins defined in `apps/roku-dev-studio/renderer/components/inspector/rale-builtins.js` (extensible; add entries and wire execution in `function-execution.js`).
- **One Execute button** for everything: app selections use `executeExternalControlFunction`; RALE selections use `getNodeById` / `getNodeByName` with args from the **Parameters** area.
- RALE option values are **namespaced** (`__rale__…`) so they do not collide with app function names.
- After **Connect**, the dropdown is populated immediately with **RALE** entries and an empty App Connector group until `getExternalControlFunctions` returns.

## RALE mapping

| Label in UI | Socket command   | Args |
|-------------|------------------|------|
| Get Node by ID | `getNodeById` | `{ path, id }` |
| Get Node by SubType (component class) | `getNodeByName` | `{ path, name }` where `name` is `node.subtype()` |

**Path:** JSON array (default `[]` = scene root). Same semantics as TrackerTask `RALE_getNodeByPath`.

**Search:** Depth-first, first match only.

## Implementation map

| Piece | Role |
|-------|------|
| `rale-builtins.js` | Labels, descriptions, param schemas for RALE dropdown entries |
| `function-selector.js` | Builds `<optgroup>`s; on change, renders params for app vs RALE |
| `function-execution.js` | Routes Execute to `executeExternalControlFunction` vs RALE `raleCommand` |
| `node-lookup.js` | Path normalization and RALE response formatting helpers |
| `parameter-inputs.js` | Optional `defaultValue` on param objects (e.g. `[]` for `path`) |

## References

- `roku-components/TrackerTask.xml` — `UIThread_getNodeById`, `UIThread_getNodeByName`
- `apps/roku-dev-studio/main/ipc/rale-handlers.js` — TCP transport
