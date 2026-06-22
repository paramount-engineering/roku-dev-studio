/**
 * Per-device developer-password storage.
 *
 * The on-disk store lives in the main process (see `main/secret-store.ts`)
 * either encrypted via Electron `safeStorage` (when the user opts into
 * keychain protection) or as JSON-encoded plaintext (when they don't).
 * Either way "Remember" survives quit/relaunch — the toggle controls *how*
 * the value is stored, not *whether* it's stored.
 *
 * The renderer holds a hydrated cleartext mirror so the UI can keep using a
 * synchronous API (`getStoredPassword(serial)` returns immediately on the
 * auto-verify path).
 *
 * Lifecycle:
 *   1. `hydrateSecretCache()` runs once early in `app.ts#init`. It:
 *        a. migrates the legacy `localStorage["roku-dev-passwords"]` blob
 *           into the encrypted store (only if the encrypted store is empty),
 *           then removes the legacy key,
 *        b. asks the main process for the current cleartext snapshot.
 *      Both steps are best-effort; on failure the cache is empty and the UI
 *      degrades to "no remembered passwords this session" (the user just
 *      types it again).
 *   2. Sync helpers below read/write the cache. Writes also fire IPC to
 *      persist; we don't await it because every call site treats password
 *      persistence as fire-and-forget already.
 */

import { rendererWarn } from './logger.js';

const LEGACY_PASSWORDS_KEY = 'roku-dev-passwords';

/**
 * - `encrypted`   — system keychain backs the on-disk store.
 * - `unencrypted` — Electron's `basic_text` backend (Linux without a keyring).
 *                   `safeStorage` is in use but produces base64 plaintext.
 * - `unavailable` — User opted into keychain but
 *                   `safeStorage.isEncryptionAvailable()` is false; main
 *                   refuses to write an unreadable encrypted file, so
 *                   entries are session-only until the keychain comes back.
 * - `disabled`    — User has opted **out** of system keychain in Settings →
 *                   General → "Encrypt Saved Passwords with System
 *                   Keychain". Remembered passwords still persist across
 *                   quit/relaunch, but as JSON-encoded plaintext on disk
 *                   (mode 0600).
 * - `unknown`     — Hydration hasn't completed yet.
 */
export type SecretStorageStatus = 'encrypted' | 'unencrypted' | 'unavailable' | 'disabled' | 'unknown';

interface SecretsApi {
  secretsStatus?: () => Promise<{ success: boolean; status?: SecretStorageStatus; backend?: string; error?: string }>;
  secretsGetAll?: () => Promise<{
    success: boolean;
    entries?: Record<string, string>;
    status?: SecretStorageStatus;
    backend?: string;
    error?: string;
  }>;
  secretsSetPassword?: (serial: string, password: string) => Promise<{ success: boolean; error?: string }>;
  secretsDeletePassword?: (serial: string) => Promise<{ success: boolean; error?: string }>;
  secretsMigrateLegacy?: (entries: Record<string, string>) => Promise<{
    success: boolean;
    migrated?: number;
    skipped?: boolean;
    error?: string;
  }>;
}

let cache: Record<string, string> = {};
let hydrationPromise: Promise<void> | null = null;
let storageStatus: SecretStorageStatus = 'unknown';
let storageBackend: string | null = null;

function rokuApi(): SecretsApi | null {
  const w = typeof window !== 'undefined' ? (window as Window & { roku?: SecretsApi }) : null;
  return w?.roku ?? null;
}

function readLegacyBlob(): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(LEGACY_PASSWORDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === 'string' && typeof v === 'string') out[k] = v;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Initialize the secret cache from the main process. Idempotent: callers can
 * invoke it multiple times; only the first invocation does work.
 *
 * MUST be awaited before any device panel that auto-fires `verifyPassword`
 * mounts — otherwise `getStoredPassword` will return `''` and the auto-verify
 * never triggers.
 */
export async function hydrateSecretCache(): Promise<void> {
  if (hydrationPromise) return hydrationPromise;
  hydrationPromise = (async () => {
    const api = rokuApi();
    if (!api || typeof api.secretsGetAll !== 'function') {
      // Preload didn't expose the API (older preload bundle, etc). Fall back
      // to legacy localStorage so we at least don't lose remembered passwords
      // until the next rebuild.
      const legacy = readLegacyBlob();
      if (legacy) cache = { ...legacy };
      return;
    }

    // One-shot legacy migration. Only push entries to main; main itself
    // refuses to overwrite a non-empty store, so this is safe to retry.
    const legacy = readLegacyBlob();
    if (legacy && typeof api.secretsMigrateLegacy === 'function') {
      try {
        await api.secretsMigrateLegacy(legacy);
      } catch (err) {
        rendererWarn('[secrets] legacy migration failed:', err);
      }
    }
    if (legacy) {
      try {
        localStorage.removeItem(LEGACY_PASSWORDS_KEY);
      } catch {
        /* ignore quota / private mode */
      }
    }

    try {
      const result = await api.secretsGetAll();
      if (result?.success && result.entries) {
        cache = { ...result.entries };
      }
      if (result?.status) storageStatus = result.status;
      if (result?.backend) storageBackend = result.backend;
    } catch (err) {
      rendererWarn('[secrets] hydrate failed (cache stays empty for this session):', err);
    }
  })();
  return hydrationPromise;
}

/**
 * Status of the encrypted store. Renderer UIs can use this to surface a
 * "stored unencrypted on this machine" caveat next to Remember checkboxes
 * when running on Linux without a real keyring backend.
 */
export function getSecretStorageStatus(): { status: SecretStorageStatus; backend: string | null } {
  return { status: storageStatus, backend: storageBackend };
}

/**
 * Get the remembered developer password for a device serial. Synchronous; the
 * cache is populated by `hydrateSecretCache()` at startup.
 */
export function getStoredPassword(serial: string): string {
  if (!serial) return '';
  return cache[serial] || '';
}

/**
 * Save a remembered developer password. Updates the in-memory cache
 * immediately and fires a fire-and-forget IPC to persist via `safeStorage`.
 * Failure to persist is logged but doesn't block the UI — the in-session
 * cache still holds the value.
 */
export function savePassword(serial: string, password: string): void {
  if (!serial) return;
  if (typeof password !== 'string') return;
  cache[serial] = password;
  const api = rokuApi();
  if (api && typeof api.secretsSetPassword === 'function') {
    api.secretsSetPassword(serial, password).catch((err) => {
      rendererWarn('[secrets] set failed:', err);
    });
  }
}

/**
 * Remove a remembered developer password. Updates the in-memory cache
 * immediately and fires a fire-and-forget IPC to persist the deletion.
 */
export function removePassword(serial: string): void {
  if (!serial) return;
  if (!(serial in cache)) {
    // Still fire the IPC in case main has it but the cache is stale.
    const api = rokuApi();
    if (api && typeof api.secretsDeletePassword === 'function') {
      api.secretsDeletePassword(serial).catch(() => {
        /* ignore */
      });
    }
    return;
  }
  delete cache[serial];
  const api = rokuApi();
  if (api && typeof api.secretsDeletePassword === 'function') {
    api.secretsDeletePassword(serial).catch((err) => {
      rendererWarn('[secrets] delete failed:', err);
    });
  }
}
