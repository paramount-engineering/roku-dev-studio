# Electron `safeStorage` integration for Roku Dev Studio

## Why

Today the only persisted secret in the app is the **Roku developer password**, kept per device serial in the renderer's `localStorage["roku-dev-passwords"]` blob. That's plaintext JSON in Chromium's `Local Storage/leveldb` — readable by anything running as the user. We can do better with no UX change.

## Scope

In-scope:
- Move `serial → developer password` storage from renderer `localStorage` to a main-process file encrypted by Electron `safeStorage`.
- Migrate any existing legacy entries on first launch, then wipe the legacy `localStorage` key.

Out of scope (intentionally, see the survey in chat):
- `app-settings.json` — no credentials live there today.
- The MCP bridge bearer token — per-launch, 0600, regenerated each start.
- Renderer `localStorage` keys that aren't secrets (`roku-devices`, `roku-collapsed-locations`, …).

## What `safeStorage` actually buys us

| Platform | Backend | Strength |
|---|---|---|
| macOS | AES-GCM, key in login Keychain | Strong; survives reboots; unlocked when the user is logged in. |
| Windows | DPAPI, scoped to the OS user | Strong. |
| Linux | `secret-service` / kwallet / kde-wallet *or* `basic_text` fallback | Strong if a real backend is selected; **base64 plaintext** with `basic_text`. We must surface this. |

Electron version: pinned at **33.4.11** in `apps/roku-dev-studio/package.json` — well past `safeStorage`'s introduction.

## Architecture

### Main process — `main/secret-store.ts`

A small module owned by the main process. It is the **only** code that touches the encrypted file.

- File: `<userData>/secrets/dev-passwords.json`, mode `0o600`.
- Schema:
  ```json
  {
    "version": 1,
    "backend": "keychain | dpapi | secret_service | kwallet | basic_text | unknown",
    "entries": { "<serial>": "<base64 ciphertext>" }
  }
  ```
- **Per-entry** ciphertext (not whole-file). A corrupt entry can't take down the rest of the store.
- API:
  - `init(app)` — resolves the path; loads the file (skipping bad entries with a warning).
  - `getStatus(): { status: 'encrypted' | 'unencrypted' | 'unavailable', backend?: string }`
    - `unencrypted` is reserved for Linux `basic_text` (encryption is "available" but not actually encrypted).
  - `getAllPasswords(): Record<serial, plaintext>`
  - `setPassword(serial, plaintext)` / `deletePassword(serial)` / `clearAll()`
  - `migrateLegacy(entries)` — bulk import that **only** runs when the on-disk store is empty.

### IPC surface (`shared/ipc/channels.ts`)

A tight, narrow set; never returns ciphertext to the renderer.

- `secrets:status` — `{ status, backend }`
- `secrets:get-all` — `{ success, entries: { [serial]: string }, status, backend }`
- `secrets:set-password` — `{ success }`
- `secrets:delete-password` — `{ success }`
- `secrets:migrate-legacy` — `{ success, migrated: number }`
- `secrets:clear-all` — `{ success }` (used by `Clear Cache and Reload`)

### Preload — `preload.ts`

Exposes the channels under `window.roku.secrets*`.

### Renderer — `renderer/modules/utils/storage.ts`

The existing **synchronous** API (`getStoredPassword`, `savePassword`, `removePassword`) is preserved so all callers stay unchanged. It is now backed by an in-memory cache:

- `hydrateSecretCache()` — called once, very early in `app.ts#init`, before any device panels mount. It (a) migrates the legacy `localStorage["roku-dev-passwords"]` blob into the new store on first run and removes it, then (b) loads the cleartext map into the cache.
- `getStoredPassword(serial)` — sync read from cache. Returns `''` until hydration completes (acceptable: panels mount after `await hydrateSecretCache()`).
- `savePassword(serial, password)` — updates the cache **and** fires `secrets:set-password` (best-effort; failures are logged, the in-session cache is still authoritative).
- `removePassword(serial)` — same pattern.
- `getSecretStorageStatus()` — surface the `unencrypted | encrypted | unavailable` status to UI (e.g. a small caveat next to `Remember`).

This shape is deliberate: every existing call site keeps compiling, only the writes change semantics (best-effort persist instead of synchronous `localStorage.setItem`). Reads remain synchronous.

## Decisions

These are the choices made up front; revisit if they don't hold up in practice.

1. **Linux `basic_text` policy → persist with caveat, don't refuse.** Status quo is plaintext `localStorage`; "encrypted on macOS/Windows, plaintext on Linux-without-keyring" is a strict win. The status is exposed via `getSecretStorageStatus()` so we can later add a small UI hint without another round of plumbing.
2. **Migration → silent and automatic.** No toast, no opt-in. The app already implicitly opted into per-serial password persistence; we're moving it to a strictly safer location.
3. **Scope → just dev passwords for now**, but the IPC names use `secrets:*` (not `passwords:*`) so we can fold in future secrets (relay tokens, etc.) without renaming.

## Risks and trade-offs

- **Cache hydration must run before device panels mount.** If a future refactor mounts panels before `init()` awaits `hydrateSecretCache()`, the auto-verify on first device tab will silently fail (returns `''` → no auto-fire). Documented at the call site; init order is enforced by `app.ts`.
- **Best-effort writes.** If `setPassword` IPC fails, the cache still reflects the user's intent for the session, but the next launch will see the previous value. We log to console so a recurring failure is visible to anyone running with debug logging on.
- **Linux Keychain unlocking.** On systems where `safeStorage.isEncryptionAvailable()` is true but the keyring is locked, `setPassword` can throw at runtime. We catch + log + continue (the in-memory cache still works for the session); the next "Remember" attempt after the user unlocks the keyring will succeed.
- **Coupling to `safeStorage` API stability.** Already considered stable in Electron (33+); no plans to vendor an alternative.

## What does *not* change

- `app-settings.json` — stays plaintext.
- MCP bridge token — per-launch, 0600.
- Renderer `localStorage` for non-secret keys.
- Fiddle's session-scoped in-memory password (used for window-close cleanup) — already in-process only, no change needed.
- `mcp-bridge.ts`'s round-trip to the renderer for stored passwords — kept as-is for now (smaller diff). Could be simplified later to read from `secret-store` directly in main.
