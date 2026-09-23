/**
 * Pins shared/updater-errors.ts against the exact messages electron-updater 6.x produces (the 404
 * text is verbatim from a live dev-build download against the v1.2.0 release, 2026-09-23).
 *   npm run verify:updater-errors   (in apps/roku-dev-studio; also part of the root `ci:app-check`)
 */
import { classifyUpdaterError, isMissingMetadataError } from '../shared/updater-errors';

const cases: Array<[string, unknown, ReturnType<typeof classifyUpdaterError>]> = [
  ['asset 404 (v1.2.0 manifest/asset mismatch)',
    new Error('Cannot download "https://github.com/paramount-engineering/roku-dev-studio/releases/download/v1.2.0/Roku-Dev-Studio-1.2.0-arm64-mac.zip", status 404: '),
    { reason: 'asset-missing', version: '1.2.0', httpStatus: 404 }],
  ['asset 410', new Error('Cannot download "https://x/releases/download/v2.0.0-rc.1/a.zip", status 410: Gone'),
    { reason: 'asset-missing', version: '2.0.0-rc.1', httpStatus: 410 }],
  ['server 502', new Error('Cannot download "https://x/releases/download/v1.3.0/a.zip", status 502: Bad Gateway'),
    { reason: 'http', version: '1.3.0', httpStatus: 502 }],
  ['checksum by code', Object.assign(new Error('sha512 checksum mismatch, expected abc, got def'), { code: 'ERR_CHECKSUM_MISMATCH' }), { reason: 'checksum' }],
  ['checksum header variant', new Error('checksum mismatch: expected abc but got def (X-Checksum-Sha2 header)'), { reason: 'checksum' }],
  ['no production release', Object.assign(new Error('Unable to find latest version on GitHub (https://github.com/o/r/releases/latest), please ensure a production release exists: HttpError: 404'), { code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' }), { reason: 'no-release' }],
  ['offline (chromium)', new Error('net::ERR_INTERNET_DISCONNECTED'), { reason: 'offline' }],
  ['offline (node code)', Object.assign(new Error('getaddrinfo ENOTFOUND github.com'), { code: 'ENOTFOUND' }), { reason: 'offline' }],
  ['offline (message only)', new Error('connect ECONNREFUSED 140.82.112.3:443'), { reason: 'offline' }],
  ['latest lookup: GitHub 502', Object.assign(new Error('Unable to find latest version on GitHub (https://github.com/o/r/releases/latest), please ensure a production release exists: HttpError: 502 Bad Gateway\n    at createHttpError'), { code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' }), { reason: 'github-unavailable', httpStatus: 502 }],
  ['latest lookup: rate limited 429', Object.assign(new Error('Unable to find latest version on GitHub (https://github.com/o/r/releases/latest), please ensure a production release exists: HttpError: 429 Too Many Requests'), { code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' }), { reason: 'github-unavailable', httpStatus: 429 }],
  ['latest lookup: proxy page instead of JSON', Object.assign(new Error('Unable to find latest version on GitHub (https://github.com/o/r/releases/latest), please ensure a production release exists: SyntaxError: Unexpected token < in JSON at position 0'), { code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' }), { reason: 'github-unavailable' }],
  ['latest lookup: network dropped mid-way', Object.assign(new Error('Unable to find latest version on GitHub (https://github.com/o/r/releases/latest), please ensure a production release exists: Error: net::ERR_NAME_NOT_RESOLVED'), { code: 'ERR_UPDATER_LATEST_VERSION_NOT_FOUND' }), { reason: 'offline' }],
  ['feed empty', Object.assign(new Error('No published versions on GitHub'), { code: 'ERR_UPDATER_NO_PUBLISHED_VERSIONS' }), { reason: 'no-release' }],
  ['feed is an HTML page', Object.assign(new Error('Cannot parse releases feed: Error: Non-whitespace before first tag.,\nXML:\n<html><body>Sign in to your proxy</body></html>'), { code: 'ERR_UPDATER_INVALID_RELEASE_FEED' }), { reason: 'github-unavailable' }],
  ['feed request: bare HttpError 404 (repo gone)', Object.assign(new Error('404 Not Found\n"method: GET url: https://github.com/o/r/releases.atom"'), { code: 'HTTP_ERROR_404', statusCode: 404, name: 'HttpError' }), { reason: 'no-release' }],
  ['feed request: bare HttpError 503', Object.assign(new Error('503 Service Unavailable'), { code: 'HTTP_ERROR_503', statusCode: 503, name: 'HttpError' }), { reason: 'github-unavailable', httpStatus: 503 }],
  ['API probe offline (fetch failed, cause ENOTFOUND)', Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('getaddrinfo ENOTFOUND api.github.com'), { code: 'ENOTFOUND' }) }), { reason: 'offline' }],
  ['API probe behind TLS-intercepting proxy', Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('unable to verify the first certificate'), { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }) }), { reason: 'github-unavailable' }],
  ['API probe: GitHub API 503', Object.assign(new Error('GitHub API returned 503 for https://api.github.com/repos/o/r/releases/latest'), { code: 'HTTP_ERROR_503', statusCode: 503 }), { reason: 'github-unavailable', httpStatus: 503 }],
  ['API probe: GitHub API 404 (no stable release)', Object.assign(new Error('GitHub API returned 404 for https://api.github.com/repos/o/r/releases/latest'), { code: 'HTTP_ERROR_404', statusCode: 404 }), { reason: 'no-release' }],
  ['channel file is an HTML page (GitHub provider)', Object.assign(new Error('Cannot parse update info from latest-mac.yml in the latest release artifacts (https://github.com/o/r/releases/download/v1.2.0/latest-mac.yml): YAMLException, rawData: <html>proxy</html>'), { code: 'ERR_UPDATER_INVALID_UPDATE_INFO' }), { reason: 'github-unavailable' }],
  ['channel file is an HTML page (generic provider)', Object.assign(new Error('This file could not be downloaded, or the latest version (from update server) does not have a valid semver version: "undefined"'), { code: 'ERR_UPDATER_INVALID_VERSION' }), { reason: 'github-unavailable' }],
  ['channel file request: 503 mentioning the yml URL', Object.assign(new Error('503 Service Unavailable\n"method: GET url: https://github.com/o/r/releases/download/v1.2.0/latest-mac.yml"'), { code: 'HTTP_ERROR_503', statusCode: 503, name: 'HttpError' }), { reason: 'github-unavailable', httpStatus: 503 }],
  ['unknown stays unclassified', new Error('something unexpected'), undefined],
  ['missing channel file is NOT ours', Object.assign(new Error('Cannot find latest-mac.yml in the latest release artifacts (https://x/latest-mac.yml): HttpError: 404'), { code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' }), undefined],
];

// Missing-metadata predicate: only genuine "not there" errors, never a failing fetch of the same URL.
const metadataCases: Array<[string, unknown, boolean]> = [
  ['channel file 404 (code)', Object.assign(new Error('Cannot find channel "latest-mac.yml" update info: HttpError: 404'), { code: 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND' }), true],
  ['channel file 404 (GitHub wording, no code)', new Error('Cannot find latest-mac.yml in the latest release artifacts (https://github.com/o/r/releases/download/v1.2.0/latest-mac.yml): HttpError: 404'), true],
  ['linux arm64 channel file 404', new Error('Cannot find latest-linux-arm64.yml in the latest release artifacts (x): HttpError: 404'), true],
  ['bundled app-update.yml missing', new Error("ENOENT: no such file or directory, open '/Applications/Roku Dev Studio.app/Contents/Resources/app-update.yml'"), true],
  ['503 on the channel-file URL is NOT missing metadata', Object.assign(new Error('503 Service Unavailable\n"method: GET url: https://github.com/o/r/releases/download/v1.2.0/latest-mac.yml"'), { code: 'HTTP_ERROR_503', statusCode: 503 }), false],
  ['HTML in place of the channel file is NOT missing metadata', Object.assign(new Error('Cannot parse update info from latest-mac.yml in the latest release artifacts (x): YAMLException'), { code: 'ERR_UPDATER_INVALID_UPDATE_INFO' }), false],
  ['asset 404 is NOT missing metadata', new Error('Cannot download "https://github.com/o/r/releases/download/v1.2.0/a.zip", status 404: '), false],
];

let failed = 0;
for (const [name, err, expected] of metadataCases) {
  const got = isMissingMetadataError(err);
  const ok = got === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  metadata: ${name}${ok ? '' : ` (expected ${expected}, got ${got})`}`);
  if (!ok) failed++;
}
for (const [name, err, expected] of cases) {
  const got = classifyUpdaterError(err);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(got)}`}`);
  if (!ok) failed++;
}
if (failed) { console.error(`verify-updater-errors: ${failed} failing case(s)`); process.exit(1); }
console.log(`verify-updater-errors: OK — ${cases.length} classifier + ${metadataCases.length} metadata cases`);
