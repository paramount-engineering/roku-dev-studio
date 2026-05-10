/**
 * Encrypted secret store for the main process.
 *
 * Backs the renderer's `roku-dev-passwords` cache with an `safeStorage`-encrypted
 * file under `<userData>/secrets/dev-passwords.json`. Per-entry encryption (not
 * whole-file) so a corrupt entry can't take the rest down.
 *
 * Status semantics:
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

export type SecretStoreStatus = 'encrypted' | 'unencrypted' | 'unavailable';

interface SecretsFile {
  version: number;
  backend: string;
  /** Per-serial base64-encoded ciphertext (or base64 plaintext on `basic_text`). */
  entries: Record<string, string>;
}

let secretsDir: string | null = null;
let secretsFile: string | null = null;
let initialized = false;

/** Cleartext, in-memory mirror of the on-disk store. Source of truth for reads
 * after `init()` so we don't have to re-decrypt on every IPC call. */
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
 * now". `basic_text` returns true for `isEncryptionAvailable()` so we have to
 * check the backend explicitly.
 */
export function getStatus(): { status: SecretStoreStatus; backend: string } {
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
  const status = getStatus().status;
  if (status === 'unavailable') {
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

function writeFile(): void {
  if (!secretsFile) return;
  ensureDir();
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
 * Resolve paths and load the on-disk store into the in-memory cache. Idempotent.
 * Must be called before any other API in this module.
 */
export function init(app: App): void {
  if (initialized) return;
  initialized = true;
  const userData = app.getPath('userData');
  secretsDir = path.join(userData, DIR_NAME);
  secretsFile = path.join(secretsDir, FILE_NAME);
  backendName = readBackend();

  const file = readFile();
  if (!file) {
    logInfo(`no existing store at ${secretsFile} (status=${getStatus().status}, backend=${backendName})`);
    return;
  }
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
  logInfo(
    `loaded ${loaded} entries from ${secretsFile} (status=${getStatus().status}, backend=${backendName}, dropped=${dropped})`
  );
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
  writeFile();
}

export function deletePassword(serial: string): void {
  if (typeof serial !== 'string' || !serial) return;
  if (!(serial in cache)) return;
  delete cache[serial];
  writeFile();
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
}

/**
 * One-shot bulk import from the legacy renderer-side `localStorage` blob.
 * Only runs when the on-disk store is empty; returns the count migrated so
 * the renderer can decide whether to drop the legacy `localStorage` key.
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
  if (count > 0) writeFile();
  return { migrated: count, skipped: false };
}
