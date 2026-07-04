/**
 * Server side of HTTP Digest auth — the mirror image of the client in
 * `http-digest.ts`. Used by the Sideload Relay's "fake Roku" HTTP server to
 * (1) issue a `401 WWW-Authenticate: Digest` challenge and (2) validate the
 * `Authorization` header the IDE (roku-deploy / VS Code / Eclipse) sends back.
 *
 * Roku's dev server authenticates user `rokudev` with the dev password over
 * MD5 Digest, realm `rokudev`. We validate cryptographically (recompute the
 * response digest from the client-echoed nonce/uri and our known password),
 * which keeps the challenge stateless — no server-side nonce store needed for
 * a LAN dev tool.
 */

'use strict';

const { createHash, randomBytes, timingSafeEqual } = require('crypto');

const DEV_USERNAME = 'rokudev';
const DEFAULT_REALM = 'rokudev';

function md5Hex(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

/** Parse `Digest key="val", key=val, ...` parameters from an Authorization header. */
function parseAuthorizationHeader(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  const body = header.replace(/^Digest\s+/i, '').trim();
  const re = /(\w+)=("([^"]*)"|([^,\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    params[match[1]!] = match[3] ?? match[4] ?? '';
  }
  return params;
}

/**
 * Build a `WWW-Authenticate: Digest` challenge value for a fresh 401.
 * The nonce is random per challenge; `qop="auth"` is advertised so modern
 * clients (postman-request, used by roku-deploy) use the stronger form, but
 * validation also accepts the legacy (no-qop) response.
 */
function buildDigestChallenge(opts: { realm?: string } = {}): { nonce: string; opaque: string; header: string } {
  const realm = opts.realm ?? DEFAULT_REALM;
  const nonce = randomBytes(16).toString('hex');
  const opaque = randomBytes(8).toString('hex');
  const header = `Digest realm="${realm}", qop="auth", nonce="${nonce}", opaque="${opaque}"`;
  return { nonce, opaque, header };
}

function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

type DigestValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * Validate an `Authorization: Digest ...` header against the known password.
 *
 * `method` must be the request method the client hashed (POST for
 * plugin_install). We recompute HA1/HA2/response from the client-echoed
 * `nonce`, `uri`, `qop`, `nc`, `cnonce` and compare (timing-safe) to the
 * `response` the client sent. Only user `rokudev` is accepted.
 */
function validateDigestAuthorization(opts: {
  authorization: string | undefined;
  method: string;
  password: string;
  realm?: string;
}): DigestValidationResult {
  const { authorization, method, password } = opts;
  const realm = opts.realm ?? DEFAULT_REALM;
  if (!authorization || !/^\s*Digest\s+/i.test(authorization)) {
    return { ok: false, reason: 'missing_digest' };
  }
  const p = parseAuthorizationHeader(authorization);
  if ((p.username || '') !== DEV_USERNAME) {
    return { ok: false, reason: 'bad_username' };
  }
  const nonce = p.nonce || '';
  const uri = p.uri || '';
  const response = (p.response || '').toLowerCase();
  if (!nonce || !uri || !response) {
    return { ok: false, reason: 'incomplete' };
  }

  // Digest is realm-scoped; recompute HA1 with the realm the client used
  // (falls back to our default) so a client that echoes a slightly different
  // realm string still validates against the same shared password.
  const clientRealm = p.realm || realm;
  const ha1 = md5Hex(`${DEV_USERNAME}:${clientRealm}:${password}`);
  const ha2 = md5Hex(`${method}:${uri}`);

  let expected: string;
  const qop = (p.qop || '').replace(/^"|"$/g, '');
  if (qop) {
    if (qop !== 'auth') return { ok: false, reason: 'unsupported_qop' };
    const nc = p.nc || '';
    const cnonce = p.cnonce || '';
    if (!nc || !cnonce) return { ok: false, reason: 'incomplete_qop' };
    expected = md5Hex(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  } else {
    expected = md5Hex(`${ha1}:${nonce}:${ha2}`);
  }

  if (!safeEqualHex(expected.toLowerCase(), response)) {
    return { ok: false, reason: 'response_mismatch' };
  }
  return { ok: true };
}

module.exports = {
  DEV_USERNAME,
  DEFAULT_REALM,
  parseAuthorizationHeader,
  buildDigestChallenge,
  validateDigestAuthorization
};
