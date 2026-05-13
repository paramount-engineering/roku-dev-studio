/**
 * Encrypted secret store for the main process.
 *
 * Backs the renderer's `roku-dev-passwords` cache with a `safeStorage`-encrypted
 * file under `<userData>/secrets/dev-passwords.json`. Per-entry encryption (not
 * whole-file) so a corrupt entry can't take the rest down.
 *
 * Opt-in gating
 * -------------
 * Touching `safeStorage` on macOS triggers the OS keychain prompt — the
 * "Roku Dev Studio wants to use your confidential information stored in 'Roku
 * Dev Studio Safe Storage' in your keychain" dialog — on every cold launch for
 * unsigned builds. To avoid prompting users who never opted in to keychain
 * persistence, the entire store is gated behind a `rememberPasswordsInKeychain`
 * setting (default off). When the setting is off:
 *   - `init()` does NOT call any `safeStorage.*` API.
 *   - `init()` does NOT decrypt the on-disk file.
 *   - `getStatus()` returns `'disabled'` without probing.
 *   - `setPassword()` stores in-memory only for the session.
 *   - `deletePassword()` mutates the in-memory cache only.
 *   - `getAllPasswords()` returns the session cache.
 * Flipping the setting on (via Settings → General) calls `setEnabled(true)`,
 * which lazily loads + decrypts the existing on-disk file the first time. THIS
 * is the point where macOS may prompt — and by that point the user has clearly
 * opted in.
 *
 * Status semantics (when enabled):
 *   - `encrypted`   — `safeStorage.isEncryptionAvailable() === true` AND the
 *                     selected backend is a real keychain (macOS Keychain,
 *                     Windows DPAPI, secret-service, kwallet, etc.).
 *   - `unencrypted` — Electron reports encryption is "available" but the
 *                     backend is `basic_text` (Linux without a keyring).
 *                     Values are base64 plaintext on disk; surface this in
 *                     UI so users know what they're getting.
 *   - `unavailable` — `isEncryptionAvailable()` is false. Persistence is
 *                     refused; in-memory cache is the only thing keeping
 *                     remembered passwords for the session.
 *   - `disabled`    — User has not opted in. No `safeStorage` call has been
 *                     made; we have no idea what the backend would report.
 *
 * Security:
 *   - File mode 0600.
 *   - Renderer never sees ciphertext — it asks for cleartext over IPC and
 *     receives a decrypted snapshot. Same trust boundary as the previous
 *     localStorage-based scheme (the renderer already had the cleartext).
 */

import type { App } from 'electron';

const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron') as typeof import('electron');

const FILE_VERSION = 1;
const FILE_NAME = 'dev-passwords.json';
const DIR_NAME = 'secrets';

export type SecretStoreStatus = 'encrypted' | 'unencrypted' | 'unavailable' | 'disabled';

interface SecretsFile {
  version: number;
  backend: string;
  /** Per-serial base64-encoded ciphertext (or base64 plaintext on `basic_text`). */
  entries: Record<string, string>;
}

let secretsDir: string | null = null;
let secretsFile: string | null = null;
let initialized = false;
let enabled = false;
let onDiskLoaded = false;

/** Cleartext, in-memory mirror of the on-disk store. Source of truth for reads
 * after enable+load so we don't have to re-decrypt on every IPC call. */
const cache: Record<string, string> = {};
let backendName: string = 'unknown';

function logInfo(msg: string, ...rest: unknown[]): void {
  console.log(`[secret-store] ${msg}`, ...rest);
}

function logWarn(msg: string, ...rest: unknown[]): void {
  console.warn(`[secret-store] ${msg}`, ...rest);
}

function ensureDir(): void {
  if (!secretsDir) return;
  try {
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
    }
  } catch (e) {
    logWarn('failed to create secrets directory:', e);
  }
}

function readBackend(): string {
  try {
    const ss = safeStorage as unknown as {
      getSelectedStorageBackend?: () => string;
    };
    if (typeof ss.getSelectedStorageBackend === 'function') {
      return ss.getSelectedStorageBackend() || 'unknown';
    }
  } catch {
    /* not available on every platform */
  }
  // macOS / Windows don't expose backend name; infer from process.platform.
  if (process.platform === 'darwin') return 'keychain';
  if (process.platform === 'win32') return 'dpapi';
  return 'unknown';
}

/**
 * Single source of truth for "is the on-disk file actually encrypted right
 * now". Only probes `safeStorage` if the user has opted in; otherwise returns
 * `disabled` without touching the keychain.
 */
export function getStatus(): { status: SecretStoreStatus; backend: string } {
  if (!enabled) return { status: 'disabled', backend: 'disabled' };
  let available = false;
  try {
    available = safeStorage.isEncryptionAvailable();
  } catch (e) {
    logWarn('isEncryptionAvailable threw:', e);
    available = false;
  }
  if (!available) return { status: 'unavailable', backend: backendName };
  if (backendName === 'basic_text') return { status: 'unencrypted', backend: backendName };
  return { status: 'encrypted', backend: backendName };
}

function encryptOrEncodeForDisk(plaintext: string): string {
  let available = false;
  try {
    available = safeStorage.isEncryptionAvailable();
  } catch {
    available = false;
  }
  if (!available) {
    throw new Error('safeStorage encryption is not available on this system');
  }
  // `basic_text` mode: safeStorage will base64-encode (NOT encrypt). We still
  // route through it so the on-disk format is uniform across backends.
  const buf = safeStorage.encryptString(plaintext);
  return Buffer.from(buf).toString('base64');
}

function decryptFromDisk(encoded: string): string | null {
  try {
    const buf = Buffer.from(encoded, 'base64');
    return safeStorage.decryptString(buf);
  } catch (e) {
    logWarn('decryptString failed for one entry; skipping:', e);
    return null;
  }
}

function readFile(): SecretsFile | null {
  if (!secretsFile) return null;
  try {
    if (!fs.existsSync(secretsFile)) return null;
    const raw = fs.readFileSync(secretsFile, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SecretsFile>;
    if (!parsed || typeof parsed !== 'object') return null;
    const entries = parsed.entries && typeof parsed.entries === 'object' ? parsed.entries : {};
    const cleanEntries: Record<string, string> = {};
    for (const [k, v] of Object.entries(entries)) {
      if (typeof k === 'string' && typeof v === 'string') cleanEntries[k] = v;
    }
    return {
      version: typeof parsed.version === 'number' ? parsed.version : FILE_VERSION,
      backend: typeof parsed.backend === 'string' ? parsed.backend : 'unknown',
      entries: cleanEntries
    };
  } catch (e) {
    logWarn('failed to read secrets file (will treat as empty):', e);
    return null;
  }
}

/**
 * Persist the in-memory cache to disk. No-op when disabled — we never write
 * cleartext or touch the keychain unless the user has opted in.
 */
function writeFile(): void {
  if (!enabled) return;
  if (!secretsFile) return;
  ensureDir();
  if (backendName === 'unknown') backendName = readBackend();
  // Re-encrypt the in-memory cache from scratch so the on-disk file is
  // always consistent with the current backend (defensive against backend
  // changes between launches).
  const out: SecretsFile = {
    version: FILE_VERSION,
    backend: backendName,
    entries: {}
  };
  for (const [serial, plaintext] of Object.entries(cache)) {
    try {
      out.entries[serial] = encryptOrEncodeForDisk(plaintext);
    } catch (e) {
      logWarn(`failed to encrypt entry for serial=${serial}; dropping from disk:`, e);
    }
  }
  try {
    const tmp = `${secretsFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(out, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, secretsFile);
  } catch (e) {
    logWarn('failed to write secrets file:', e);
  }
}

/**
 * Decrypt any existing on-disk file into the in-memory cache. Idempotent — once
 * loaded we keep using the in-memory copy. Only called after the user opts in
 * (`enabled === true`); this is the first time we ever invoke `safeStorage`.
 *
 * Returns the cleaned entry counts so callers can log a single line about the
 * one-time hydration.
 */
function loadFromDiskIfEnabled(): { loaded: number; dropped: number } {
  if (!enabled || onDiskLoaded) return { loaded: 0, dropped: 0 };
  onDiskLoaded = true;
  if (backendName === 'unknown') backendName = readBackend();
  const file = readFile();
  if (!file) return { loaded: 0, dropped: 0 };
  let loaded = 0;
  let dropped = 0;
  for (const [serial, encoded] of Object.entries(file.entries)) {
    const cleartext = decryptFromDisk(encoded);
    if (cleartext != null) {
      cache[serial] = cleartext;
      loaded += 1;
    } else {
      dropped += 1;
    }
  }
  if (dropped > 0) {
    // Persist the cleaned cache so undecryptable entries don't keep tripping
    // the warning on every launch.
    writeFile();
  }
  return { loaded, dropped };
}

/**
 * Resolve paths and remember the opt-in flag. Idempotent. NEVER calls
 * `safeStorage.*` on its own — that only happens after `setEnabled(true)` is
 * invoked (typically from the Settings window toggle).
 */
export function init(app: App, opts: { enabled: boolean }): void {
  if (initialized) return;
  initialized = true;
  const userData = app.getPath('userData');
  secretsDir = path.join(userData, DIR_NAME);
  secretsFile = path.join(secretsDir, FILE_NAME);
  enabled = !!opts.enabled;
  // Note: we deliberately do NOT call `readBackend()` here either. Although on
  // macOS/Windows that's a no-op for `safeStorage`, keeping init free of any
  // platform-specific keychain code path makes the "never prompt unless opted
  // in" guarantee easier to audit. The backend name is filled in lazily by
  // `loadFromDiskIfEnabled()` / `writeFile()` when we actually need it.
  logInfo(`init (enabled=${enabled}, file=${secretsFile})`);
  if (enabled) loadFromDiskIfEnabled();
}

/**
 * Flip the opt-in flag at runtime. When turning **on** for the first time
 * this triggers the one-shot hydration from disk (`safeStorage.decryptString`
 * may prompt the OS at that moment). When turning **off**, any in-memory
 * passwords saved during the session are kept (they were already exposed to
 * the renderer); we just stop persisting new writes.
 *
 * NOTE: turning off does NOT delete the on-disk file. The user can clear it
 * explicitly via "Clear Cache and Reload" / `clearAll`.
 */
export function setEnabled(next: boolean): { status: SecretStoreStatus; backend: string } {
  const was = enabled;
  enabled = !!next;
  if (!was && enabled) {
    // First hydrate from any existing on-disk file (catches users who had the
    // toggle on previously, then off, then on again).
    loadFromDiskIfEnabled();
    // Then persist any in-memory entries that accumulated while disabled —
    // e.g. legacy localStorage entries imported via `migrateLegacy`, or
    // session-only passwords the user typed earlier in this launch. Without
    // this, flipping on would silently lose those values at app quit.
    if (Object.keys(cache).length > 0) writeFile();
  }
  return getStatus();
}

export function isEnabled(): boolean {
  return enabled;
}

export function getAllPasswords(): Record<string, string> {
  // Shallow copy so callers can't mutate our cache.
  return { ...cache };
}

export function setPassword(serial: string, password: string): void {
  if (typeof serial !== 'string' || !serial) return;
  if (typeof password !== 'string') return;
  if (cache[serial] === password) return;
  cache[serial] = password;
  // Persists only when the user has opted in. Otherwise the password stays
  // session-only (renderer treats this as "remembered for now"; lost on quit).
  if (enabled) writeFile();
}

export function deletePassword(serial: string): void {
  if (typeof serial !== 'string' || !serial) return;
  if (!(serial in cache)) return;
  delete cache[serial];
  if (enabled) writeFile();
}

export function clearAll(): void {
  let touched = false;
  for (const k of Object.keys(cache)) {
    delete cache[k];
    touched = true;
  }
  if (touched && secretsFile) {
    try {
      if (fs.existsSync(secretsFile)) fs.rmSync(secretsFile, { force: true });
    } catch (e) {
      logWarn('failed to remove secrets file during clearAll:', e);
    }
  }
  // Allow the next opt-in to re-hydrate fresh from disk (which will now be
  // empty / missing).
  onDiskLoaded = false;
}

/**
 * One-shot bulk import from the legacy renderer-side `localStorage` blob.
 * Only runs when the on-disk store is empty; returns the count migrated so
 * the renderer can decide whether to drop the legacy `localStorage` key.
 *
 * Legacy migration is allowed regardless of the opt-in flag so we don't lose
 * existing entries — but if the user is currently opted **out**, the migrated
 * entries live in memory only until they opt in (at which point `writeFile`
 * persists them).
 */
export function migrateLegacy(legacy: Record<string, string>): { migrated: number; skipped: boolean } {
  if (Object.keys(cache).length > 0) {
    // Already populated — never overwrite.
    return { migrated: 0, skipped: true };
  }
  if (!legacy || typeof legacy !== 'object') return { migrated: 0, skipped: false };
  let count = 0;
  for (const [serial, password] of Object.entries(legacy)) {
    if (typeof serial !== 'string' || !serial) continue;
    if (typeof password !== 'string' || !password) continue;
    cache[serial] = password;
    count += 1;
  }
  if (count > 0 && enabled) writeFile();
  return { migrated: count, skipped: false };
}
