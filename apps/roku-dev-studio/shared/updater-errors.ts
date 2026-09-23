/**
 * Turns the raw errors electron-updater throws into a small set of reasons the renderer can phrase
 * for a human. Missing-channel-file errors are NOT classified here — auto-updater.ts already routes
 * those through its own version-gated "manual download" path. Pure: no electron imports, so
 * `npm run verify:updater-errors` can pin the mapping.
 *
 * Where each reason comes from, in the order the check runs:
 *   1. releases Atom feed          → bare HttpError (404 = no releases page; else GitHub/proxy trouble),
 *                                    "No published versions" (feed empty), "Cannot parse releases feed"
 *                                    (a captive portal / proxy answered with HTML).
 *   2. releases/latest tag lookup  → ERR_UPDATER_LATEST_VERSION_NOT_FOUND wraps the real cause after
 *                                    "production release exists:" — 404 means no stable release, any other
 *                                    status / a JSON parse error means GitHub or the network misbehaved.
 *   3. download                    → `Cannot download "<url>", status <code>` (404/410 = asset missing).
 *   Anywhere                       → DNS/socket errors and Chromium net:: codes = offline; checksum mismatch.
 */
export type UpdaterErrorReason = 'asset-missing' | 'http' | 'checksum' | 'offline' | 'no-release' | 'github-unavailable';

export interface UpdaterErrorClass {
  reason: UpdaterErrorReason;
  /** Release version parsed from the download URL, when the error carries one. */
  version?: string;
  /** HTTP status when the failure was an HTTP response. */
  httpStatus?: number;
}

const NET_CODES = /^(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ENETDOWN|EPIPE|UND_ERR_CONNECT_TIMEOUT)$/;
const NET_MESSAGE =
  /net::ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|NAME_RESOLUTION_FAILED|CONNECTION_\w+|TIMED_OUT|ADDRESS_UNREACHABLE|NETWORK_CHANGED|PROXY_CONNECTION_FAILED|TUNNEL_CONNECTION_FAILED)|\b(ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH)\b|\bsocket hang up\b/i;
/** electron-updater's httpExecutor: `Cannot download "<url>", status <code>: <text>` */
const CANNOT_DOWNLOAD = /cannot download\s+"([^"]*)",\s*status\s+(\d{3})/i;
const NOT_JSON = /SyntaxError|Unexpected token|Unexpected end of JSON|is not valid JSON/i;

/**
 * "The release has no updater metadata": the channel file (latest-mac.yml / latest.yml /
 * latest-linux*.yml) is missing from the release, or the app's own bundled app-update.yml is
 * missing. auto-updater.ts routes these through a version-gated "download manually" path instead
 * of an error. Deliberately NARROW: a 503 or a proxy page on the very same URL is not "missing" —
 * matching on the file name alone (as this once did) turned every GitHub hiccup into a "please
 * download manually" banner.
 */
export function isMissingMetadataError(err: unknown): boolean {
  const o = err as { message?: unknown; code?: unknown } | undefined;
  const msg = String(o?.message ?? err ?? '');
  const code = String(o?.code ?? '');
  return (
    code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' ||
    /cannot find (latest(-mac|-linux(-arm64)?)?\.yml|channel)/i.test(msg) ||
    (/app-update\.yml/i.test(msg) && /ENOENT|no such file/i.test(msg))
  );
}

export function classifyUpdaterError(err: unknown): UpdaterErrorClass | undefined {
  const o = err as { message?: unknown; code?: unknown; statusCode?: unknown; cause?: unknown } | undefined;
  const msg = String(o?.message ?? err ?? '');
  const code = String(o?.code ?? '');
  // Node's fetch throws `TypeError: fetch failed` and hides the real failure in `cause`.
  const cause = o?.cause as { code?: unknown; message?: unknown } | undefined;
  const causeCode = String(cause?.code ?? '');
  const causeMsg = String(cause?.message ?? '');

  if (code === 'ERR_CHECKSUM_MISMATCH' || /checksum mismatch/i.test(msg)) return { reason: 'checksum' };

  const dl = CANNOT_DOWNLOAD.exec(msg);
  if (dl) {
    const httpStatus = Number(dl[2]);
    const version = /\/releases\/download\/v?(\d+\.\d+\.\d+[^/"\s]*)\//i.exec(dl[1] ?? '')?.[1];
    return { reason: httpStatus === 404 || httpStatus === 410 ? 'asset-missing' : 'http', version, httpStatus };
  }

  if (code === 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' || /unable to find latest version/i.test(msg)) {
    const cause = msg.replace(/^[\s\S]*?production release exists:/i, '');
    const http = /HttpError: (\d{3})/i.exec(cause);
    if (http) return http[1] === '404' ? { reason: 'no-release' } : { reason: 'github-unavailable', httpStatus: Number(http[1]) };
    if (NET_MESSAGE.test(cause)) return { reason: 'offline' };
    if (NOT_JSON.test(cause)) return { reason: 'github-unavailable' };
    return { reason: 'no-release' };
  }
  if (code === 'ERR_UPDATER_NO_PUBLISHED_VERSIONS' || /no published versions on github/i.test(msg)) return { reason: 'no-release' };
  if (code === 'ERR_UPDATER_INVALID_RELEASE_FEED' || /cannot parse releases feed/i.test(msg)) return { reason: 'github-unavailable' };
  // The channel file was served but is not a manifest (proxy / captive-portal page in its place).
  if (code === 'ERR_UPDATER_INVALID_UPDATE_INFO' || /cannot parse update info/i.test(msg) ||
      code === 'ERR_UPDATER_INVALID_VERSION' || /does not have a valid semver version/i.test(msg)) return { reason: 'github-unavailable' };

  // A bare HttpError (builder-util-runtime: code HTTP_ERROR_<status>, numeric statusCode), e.g. the Atom feed request.
  const bare = typeof o?.statusCode === 'number' ? o.statusCode : Number(/^HTTP_ERROR_(\d{3})$/.exec(code)?.[1]);
  if (bare && bare > 0) return bare === 404 ? { reason: 'no-release' } : { reason: 'github-unavailable', httpStatus: bare };

  if (NET_CODES.test(code) || NET_CODES.test(causeCode) || NET_MESSAGE.test(msg) || NET_MESSAGE.test(causeMsg)) return { reason: 'offline' };
  // fetch failed for a non-network reason: TLS interception by a proxy, a bad certificate chain, undici errors.
  if (/fetch failed/i.test(msg) || /^(UNABLE_TO_VERIFY_LEAF_SIGNATURE|CERT_HAS_EXPIRED|SELF_SIGNED_CERT_IN_CHAIN|DEPTH_ZERO_SELF_SIGNED_CERT|ERR_TLS_CERT_ALTNAME_INVALID|UND_ERR_\w+)$/.test(causeCode)) return { reason: 'github-unavailable' };
  return undefined;
}
