/**
 * Shared reader for stored RCE account tokens — one implementation for every main-process module
 * that needs to resolve an account name to its bearer token (rce-handlers.ts, rce-video-handlers.ts,
 * and now the RCE device registry / Sideload Relay + Fiddle RCE dispatch). Previously duplicated
 * inline in two files; consolidated here so the key-prefix convention only lives in one place.
 *
 * Tokens live in the existing dev-password secret store, namespaced by a key prefix — the same
 * idiom Sideload Relay already uses for its own non-dev-password secrets, not a parallel store.
 */

const secretStore = require('./secret-store') as typeof import('./secret-store');

const RCE_ACCOUNT_KEY_PREFIX = 'rce-account:';

function accountKey(name: string): string {
  return `${RCE_ACCOUNT_KEY_PREFIX}${name}`;
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

export { accountKey as rceAccountKey };
