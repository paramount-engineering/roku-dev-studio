import type { IncomingMessage } from 'http';

const { createHash, randomBytes } = require('crypto');
const { request } = require('http');
const { errorMessage } = require('./err-util');

const DEV_USERNAME = 'rokudev';
const DEFAULT_TIMEOUT_MS = 15000;

type MultipartField = { name: string; value: string };
type MultipartFile = { name: string; filename: string; data: Buffer; contentType?: string };

/** Parse `WWW-Authenticate: Digest key="val", ...` challenge parameters. */
function parseDigestChallenge(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  const body = header.replace(/^Digest\s+/i, '').trim();
  const re = /(\w+)=("([^"]*)"|([^,\s]+))/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body))) {
    params[match[1]!] = match[3] ?? match[4] ?? '';
  }
  return params;
}

function pickQop(challenge: Record<string, string>): string | undefined {
  const raw = challenge.qop;
  if (!raw) return undefined;
  const options = raw.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
  if (options.includes('auth')) return 'auth';
  return options[0];
}

function md5Hex(value: string): string {
  return createHash('md5').update(value).digest('hex');
}

function buildDigestAuthorizationHeader(options: {
  username: string;
  password: string;
  method: string;
  uri: string;
  challenge: Record<string, string>;
  cnonce?: string;
}): string {
  const { username, password, method, uri, challenge, cnonce: cnonceIn } = options;
  const realm = challenge.realm ?? '';
  const nonce = challenge.nonce ?? '';
  const opaque = challenge.opaque;
  const qop = pickQop(challenge);

  const ha1 = md5Hex(`${username}:${realm}:${password}`);
  const ha2 = md5Hex(`${method}:${uri}`);

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`
  ];

  if (qop) {
    const nc = '00000001';
    const cnonce = cnonceIn ?? randomBytes(8).toString('hex');
    const response = md5Hex(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    parts.push(`response="${response}"`, `qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  } else {
    const response = md5Hex(`${ha1}:${nonce}:${ha2}`);
    parts.push(`response="${response}"`);
  }

  if (opaque) {
    parts.push(`opaque="${opaque}"`);
  }

  return `Digest ${parts.join(', ')}`;
}

function buildMultipartBody(
  fields: MultipartField[],
  files: MultipartFile[] = []
): { body: Buffer; contentType: string } {
  const boundary = `----RokuDevStudio${randomBytes(12).toString('hex')}`;
  const chunks: Buffer[] = [];
  const crlf = '\r\n';

  for (const field of fields) {
    chunks.push(Buffer.from(`--${boundary}${crlf}`));
    chunks.push(Buffer.from(`Content-Disposition: form-data; name="${field.name}"${crlf}${crlf}`));
    chunks.push(Buffer.from(field.value));
    chunks.push(Buffer.from(crlf));
  }

  for (const file of files) {
    const ct = file.contentType ?? 'application/octet-stream';
    chunks.push(Buffer.from(`--${boundary}${crlf}`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"${crlf}Content-Type: ${ct}${crlf}${crlf}`
      )
    );
    chunks.push(file.data);
    chunks.push(Buffer.from(crlf));
  }

  chunks.push(Buffer.from(`--${boundary}--${crlf}`));
  return {
    body: Buffer.concat(chunks),
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

function drainResponse(res: IncomingMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    res.on('data', () => {});
    res.on('end', resolve);
    res.on('error', reject);
    res.resume();
  });
}

function readResponseBody(res: IncomingMessage, maxBytes = 12 * 1024 * 1024): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = [];
    let total = 0;
    res.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        res.destroy();
        reject(new Error('Response body too large'));
        return;
      }
      parts.push(chunk);
    });
    res.on('end', () => resolve(Buffer.concat(parts)));
    res.on('error', reject);
  });
}

/** Pick the Digest challenge when the device sends Basic + Digest (common on Roku). */
function findDigestChallengeHeader(
  wwwAuthenticate: string | string[] | undefined
): string | undefined {
  if (!wwwAuthenticate) return undefined;
  const list = Array.isArray(wwwAuthenticate) ? wwwAuthenticate : [wwwAuthenticate];
  for (const entry of list) {
    const trimmed = String(entry).trim();
    const digestIdx = trimmed.search(/\bDigest\s+/i);
    if (digestIdx >= 0) {
      return trimmed.slice(digestIdx);
    }
  }
  return undefined;
}

interface HttpDigestRequestOptions {
  ip: string;
  password: string;
  path: string;
  method: 'GET' | 'POST';
  body?: Buffer;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

function httpDigestRequestOnce(options: HttpDigestRequestOptions): Promise<{ statusCode: number; body: Buffer }> {
  const { ip, password, path, method, body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  return new Promise((resolve, reject) => {
    const send = (authorization?: string) => {
      const reqHeaders: Record<string, string> = {
        Host: ip,
        Connection: 'close',
        ...headers
      };
      if (body) {
        reqHeaders['Content-Length'] = String(body.length);
      }
      if (authorization) {
        reqHeaders.Authorization = authorization;
      }

      const req = request(
        {
          host: ip,
          port: 80,
          path,
          method,
          headers: reqHeaders,
          // Fresh socket per round — Roku often RSTs keep-alive sockets after 401.
          agent: false,
          family: 4
        },
        (res: IncomingMessage) => {
          const status = res.statusCode ?? 0;

          if (status === 401 && !authorization) {
            const challengeHeader = findDigestChallengeHeader(res.headers['www-authenticate']);
            void drainResponse(res)
              .then(() => {
                if (!challengeHeader) {
                  reject(new Error('Device did not offer HTTP Digest authentication.'));
                  return;
                }
                const challenge = parseDigestChallenge(challengeHeader);
                const authHeader = buildDigestAuthorizationHeader({
                  username: DEV_USERNAME,
                  password,
                  method,
                  uri: path,
                  challenge
                });
                send(authHeader);
              })
              .catch(reject);
            return;
          }

          void readResponseBody(res)
            .then((responseBody) => {
              resolve({ statusCode: status, body: responseBody });
            })
            .catch(reject);
        }
      );

      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error('Connection timed out'));
      });
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    };

    send();
  });
}

async function httpDigestRequest(options: HttpDigestRequestOptions): Promise<{ statusCode: number; body: Buffer }> {
  try {
    return await httpDigestRequestOnce(options);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException)?.code;
    const msg = errorMessage(err);
    const retriable =
      code === 'ECONNRESET' ||
      /socket hang up|ECONNRESET/i.test(msg);
    if (!retriable) throw err;
    return httpDigestRequestOnce(options);
  }
}

function mapDeviceHttpError(err: unknown, context = 'Device request'): { success: false; error: string } {
  const msg = errorMessage(err);
  const code = (err as NodeJS.ErrnoException)?.code;
  if (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ENOTFOUND' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    /connection refused|failed to connect|couldn't connect|could not resolve host|timed out|socket hang up/i.test(msg)
  ) {
    return {
      success: false,
      error: 'Could not reach the device web server. Check the IP and network.'
    };
  }
  return { success: false, error: `${context} failed: ${msg}` };
}

function responseLooksLikeAuthFailure(statusCode: number, text: string): boolean {
  return statusCode === 401 || /authentication/i.test(text);
}

module.exports = {
  DEV_USERNAME,
  DEFAULT_TIMEOUT_MS,
  parseDigestChallenge,
  findDigestChallengeHeader,
  buildDigestAuthorizationHeader,
  buildMultipartBody,
  httpDigestRequest,
  mapDeviceHttpError,
  responseLooksLikeAuthFailure
};
