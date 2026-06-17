/**
 * Developer-password store for the main process.
 *
 * Backs the renderer's `roku-dev-passwords` cache with an on-disk file under
 * `<userData>/secrets/dev-passwords.json`. Per-entry storage (not whole-file)
 * so a corrupt entry can't take the rest down.
 *
 * Two on-disk modes — the file's `mode` field is the source of truth at read
 * time, the `rememberPasswordsInKeychain` setting is the source of truth at
 * write time:
 *
 *   - `mode: 'encrypted'`  — entries are base64 ciphertext produced by
 *     Electron `safeStorage.encryptString`. Used when the user has opted in
 *     to "Encrypt remembered passwords with System Keychain". Touching
 *     `safeStorage` on macOS triggers the OS keychain prompt — the
 *     "Roku Dev Studio wants to use your confidential information stored in
 *     'Roku Dev Studio Safe Storage' in your keychain" dialog — on every
 *     cold launch for unsigned builds.
 *   - `mode: 'plaintext'`  — entries are stored as JSON strings on disk.
 *     File mode is still `0o600`, but the values are readable by anything
 *     running as the user. Used when the keychain toggle is OFF. This is
 *     the same trust level as the legacy renderer `localStorage` blob and
 *     it survives quit/relaunch (the explicit user requirement that
 *     prompted this design — see
 *     `.discussion-docs/safe-storage-integration.md`).
 *
 * Toggle flips at runtime call `setEnabled(next)`, which:
 *   1. Loads the existing file in its current mode (if any), populating the
 *      in-memory cache.
 *   2. Re-writes the file in the new mode so subsequent launches read
 *      correctly without having to sniff.
 *
 * Status semantics surfaced to the renderer (`getStatus()`):
 *   - `encrypted`   — keychain ON, `safeStorage.isEncryptionAvailable() === true`,
 *                     and the selected backend is a real keychain.
 *   - `unencrypted` — keychain ON but Electron reports `basic_text` (Linux
 *                     without a keyring). Values are base64 plaintext on
 *                     disk — surface this so users know what they're
 *                     getting.
 *   - `unavailable` — keychain ON but `isEncryptionAvailable()` is false.
 *                     We refuse to persist via `safeStorage`; the
 *                     in-memory cache is the only thing keeping
 *                     remembered passwords for the session. (Note: we do
 *                     NOT silently fall back to plaintext mode here —
 *                     the user explicitly opted into keychain protection
 *                     and we shouldn't downgrade behind their back.)
 *   - `disabled`    — keychain OFF. Entries persist on disk as plaintext.
 */

import type { App } from 'electron';
import { isMacOS, isWindows } from 'roku-dev-studio-platform';

const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron') as typeof import('electron');

const FILE_VERSION = 1;
const FILE_NAME = 'dev-passwords.json';
const DIR_NAME = 'secrets';

export type SecretStoreStatus = 'encrypted' | 'unencrypted' | 'unavailable' | 'disabled';

/** What format the on-disk file holds entries in. */
type DiskMode = 'encrypted' | 'plaintext';

interface SecretsFile {
  version: number;
  /** How to decode `entries`. Authoritative at read time. */
  mode: DiskMode;
  /** Best-effort label of the encrypting backend; informational only. */
  backend: string;
  /**
   * `mode === 'encrypted'` → base64-encoded ciphertext from `safeStorage.encryptString`.
   * `mode === 'plaintext'` → JSON-encoded string value (so we never confuse
   *                         a literal `null`/empty/quoted password with a
   *                         missing entry).
   */
  entries: Record<string, string>;
}

let secretsDir: string | null = null;
let secretsFile: string | null = null;
let initialized = false;
let enabled = false;
let onDiskLoaded = false;

/** Cleartext, in-memory mirror of the on-disk store. Source of truth for reads
 * after load so we don't have to re-decrypt / re-parse on every IPC call. */
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
  // macOS / Windows don't expose backend name; infer from the host platform.
  if (isMacOS()) return 'keychain';
  if (isWindows()) return 'dpapi';
  return 'unknown';
}

/**
 * Single source of truth for "what kind of protection do remembered
 * passwords have right now?". Only probes `safeStorage` when the user opted
 * into keychain protection.
 */
export function getStatus(): { status: SecretStoreStatus; backend: string } {
  if (!enabled) return { status: 'disabled', backend: 'plaintext' };
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

function encryptForDisk(plaintext: string): string {
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

function encodePlaintextForDisk(plaintext: string): string {
  // JSON-encode so an empty string or a value containing surprising
  // characters round-trips losslessly. Decode handles malformed entries by
  // skipping them.
  return JSON.stringify(plaintext);
}

function decodePlaintextFromDisk(encoded: string): string | null {
  try {
    const parsed = JSON.parse(encoded);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    // Tolerate legacy entries that may have been stored unwrapped — treat
    // the raw value as the password so a hand-edited or migrated file
    // doesn't silently lose data.
    return typeof encoded === 'string' ? encoded : null;
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
    // Older files predate the `mode` field. If they were written by the
    // previous gated-keychain implementation, every entry was always
    // safeStorage-encrypted, so treat missing `mode` as `'encrypted'`.
    const rawMode = (parsed as { mode?: unknown }).mode;
    const mode: DiskMode = rawMode === 'plaintext' ? 'plaintext' : 'encrypted';
    return {
      version: typeof parsed.version === 'number' ? parsed.version : FILE_VERSION,
      mode,
      backend: typeof parsed.backend === 'string' ? parsed.backend : 'unknown',
      entries: cleanEntries
    };
  } catch (e) {
    logWarn('failed to read secrets file (will treat as empty):', e);
    return null;
  }
}

/**
 * Persist the in-memory cache to disk in the current mode (encrypted iff the
 * keychain toggle is on AND `safeStorage` is available, plaintext otherwise).
 * Always writes — keychain OFF still persists so "Remember" survives
 * quit/relaunch (the documented design).
 */
function writeFile(): void {
  if (!secretsFile) return;
  ensureDir();

  // Decide the mode we'll write in. We only ever emit `'encrypted'` when the
  // user has opted in AND `safeStorage` will actually accept calls; otherwise
  // refuse to write an encrypted file with no way to read it back.
  let writeMode: DiskMode = 'plaintext';
  let available = false;
  if (enabled) {
    try {
      available = safeStorage.isEncryptionAvailable();
    } catch {
      available = false;
    }
    if (available) {
      writeMode = 'encrypted';
      if (backendName === 'unknown') backendName = readBackend();
    } else {
      // Keychain toggle is on but the OS refused — fall back to in-memory
      // only for this write. Don't downgrade silently to plaintext on disk;
      // the user explicitly asked for keychain protection.
      logWarn('keychain toggle is on but safeStorage is unavailable; skipping disk write');
      return;
    }
  }

  const out: SecretsFile = {
    version: FILE_VERSION,
    mode: writeMode,
    backend: writeMode === 'encrypted' ? backendName : 'plaintext',
    entries: {}
  };
  for (const [serial, plaintext] of Object.entries(cache)) {
    try {
      out.entries[serial] =
        writeMode === 'encrypted'
          ? encryptForDisk(plaintext)
          : encodePlaintextForDisk(plaintext);
    } catch (e) {
      logWarn(`failed to encode entry for serial=${serial}; dropping from disk:`, e);
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
 * Load any existing on-disk file into the in-memory cache. Idempotent —
 * once loaded we keep using the in-memory copy.
 *
 * Reads the file's `mode` field to decide how to decode entries. This lets a
 * file written with the keychain toggle on (encrypted) survive being read
 * with the toggle off later (we still need the file's mode field — not the
 * current toggle — to choose the decoder).
 *
 * Touching `safeStorage` only happens when the file is in `'encrypted'`
 * mode, which is the only case where the OS keychain prompt is justified.
 */
function loadFromDiskIfNeeded(): { loaded: number; dropped: number } {
  if (onDiskLoaded) return { loaded: 0, dropped: 0 };
  onDiskLoaded = true;
  const file = readFile();
  if (!file) return { loaded: 0, dropped: 0 };
  let loaded = 0;
  let dropped = 0;
  for (const [serial, encoded] of Object.entries(file.entries)) {
    const cleartext =
      file.mode === 'encrypted' ? decryptFromDisk(encoded) : decodePlaintextFromDisk(encoded);
    if (cleartext != null) {
      cache[serial] = cleartext;
      loaded += 1;
    } else {
      dropped += 1;
    }
  }
  if (file.mode === 'encrypted' && backendName === 'unknown') backendName = readBackend();
  if (dropped > 0) {
    // Persist the cleaned cache so undecryptable entries don't keep tripping
    // the warning on every launch.
    writeFile();
  }
  return { loaded, dropped };
}

/**
 * Resolve paths, remember the keychain opt-in flag, and load any existing
 * on-disk store. Idempotent. May call `safeStorage.decryptString` if the
 * stored file is in `'encrypted'` mode (so the OS keychain prompt CAN fire
 * here on macOS) — but only when the file itself indicates encrypted mode,
 * which only happens if the user previously opted in.
 */
export function init(app: App, opts: { enabled: boolean }): void {
  if (initialized) return;
  initialized = true;
  const userData = app.getPath('userData');
  secretsDir = path.join(userData, DIR_NAME);
  secretsFile = path.join(secretsDir, FILE_NAME);
  enabled = !!opts.enabled;
  logInfo(`init (enabled=${enabled}, file=${secretsFile})`);
  loadFromDiskIfNeeded();
}

/**
 * Flip the keychain opt-in flag at runtime. Always re-writes the file in the
 * new mode so a subsequent cold launch reads it back with the right decoder
 * (we can't rely on probing the current toggle at read time — the user may
 * flip again while the app is closed).
 *
 * NOTE: turning off does NOT delete the on-disk file. Entries are simply
 * re-saved in plaintext form. The user can clear them explicitly via "Clear
 * Cache and Reload" / `clearAll`.
 */
export function setEnabled(next: boolean): { status: SecretStoreStatus; backend: string } {
  const was = enabled;
  enabled = !!next;
  if (was === enabled) return getStatus();
  // Make sure the cache reflects the current on-disk file before we
  // overwrite it in the new mode (otherwise flipping the toggle on an app
  // start that hasn't read the file yet would clobber whatever's there).
  loadFromDiskIfNeeded();
  // Re-emit the file in the new mode so the next cold launch reads it back
  // correctly. Safe even if the cache is empty — writes an empty entry map.
  writeFile();
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
  // Allow the next opt-in to re-hydrate fresh from disk (which will now be
  // empty / missing).
  onDiskLoaded = false;
}

/**
 * One-shot bulk import from the legacy renderer-side `localStorage` blob.
 * Only runs when the on-disk store is empty; returns the count migrated so
 * the renderer can decide whether to drop the legacy `localStorage` key.
 *
 * Migrated entries are written to disk immediately in whatever mode the
 * current toggle dictates — so a user who never opted into keychain still
 * has their previously-remembered passwords persisted (just in plaintext
 * mode, matching what they had under the legacy `localStorage` scheme).
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
