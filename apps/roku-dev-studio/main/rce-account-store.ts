/**
 * Shared reader/writer for stored RCE account tokens — one implementation for every main-process
 * module that needs to resolve an account name to its bearer token (rce-handlers.ts,
 * rce-video-handlers.ts, and the RCE device registry / Sideload Relay + Fiddle RCE dispatch).
 * Previously duplicated inline in two files; consolidated here so the key-prefix convention only
 * lives in one place.
 *
 * Tokens live in the existing dev-password secret store, namespaced by a key prefix — the same
 * idiom Sideload Relay already uses for its own non-dev-password secrets, not a parallel store.
 * Each account also records the RCE user id (`GET /user/me` `id`) under a sibling key so a second
 * PAT for the same user can be rejected at add time without re-asking the API.
 */

const secretStore = require('./secret-store') as typeof import('./secret-store');

const RCE_ACCOUNT_KEY_PREFIX = 'rce-account:';
const RCE_ACCOUNT_USER_KEY_PREFIX = 'rce-account-user:';

function accountKey(name: string): string {
  return `${RCE_ACCOUNT_KEY_PREFIX}${name}`;
}

function userKey(name: string): string {
  return `${RCE_ACCOUNT_USER_KEY_PREFIX}${name}`;
}

export function getRceAccountNames(): string[] {
  const all = secretStore.getAllPasswords();
  return Object.keys(all)
    .filter((k) => k.startsWith(RCE_ACCOUNT_KEY_PREFIX))
    .map((k) => k.slice(RCE_ACCOUNT_KEY_PREFIX.length));
}

export function getRceAccountToken(name: string): string | undefined {
  return secretStore.getAllPasswords()[accountKey(name)];
}

export function getRceAccountUserId(name: string): string | undefined {
  return secretStore.getAllPasswords()[userKey(name)];
}

/** Name of the stored account that already holds exactly this token, if any. */
export function findRceAccountByToken(token: string): string | undefined {
  const all = secretStore.getAllPasswords();
  return getRceAccountNames().find((n) => all[accountKey(n)] === token);
}

/** Name of the stored account whose recorded RCE user id matches, if any. */
export function findRceAccountByUserId(userId: string): string | undefined {
  const all = secretStore.getAllPasswords();
  return getRceAccountNames().find((n) => all[userKey(n)] === userId);
}

export function setRceAccount(name: string, token: string, userId?: string): void {
  secretStore.setPassword(accountKey(name), token);
  if (userId) secretStore.setPassword(userKey(name), userId);
}

export function setRceAccountUserId(name: string, userId: string): void {
  secretStore.setPassword(userKey(name), userId);
}

export function deleteRceAccount(name: string): void {
  secretStore.deletePassword(accountKey(name));
  secretStore.deletePassword(userKey(name));
}
