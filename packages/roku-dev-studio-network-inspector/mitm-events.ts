import type { NetworkHttpMessage, ParsedNetworkEvent } from './types';
import type { MitmTransaction } from './mitm-proxy';

const MAX_BODY_CHARS = 256_000;
// base64 can't be safely sliced (it would corrupt the payload), so binary bodies get a
// larger whole-or-nothing budget that comfortably covers the proxy's 4 MB raw cap
// (≈5.34 MB base64). Beyond it the body is dropped and marked truncated.
const MAX_BASE64_CHARS = 5_600_000;

function truncateBody(
  msg: NetworkHttpMessage
): { body?: string; bodyEncoding?: 'text' | 'base64'; bodyTruncated?: boolean } {
  const { body, bodyEncoding } = msg;
  if (!body) return {};
  const alreadyTruncated = msg.bodyTruncated ? { bodyTruncated: true as const } : {};
  if (bodyEncoding === 'base64') {
    if (body.length <= MAX_BASE64_CHARS) return { body, bodyEncoding, ...alreadyTruncated };
    return { bodyEncoding, bodyTruncated: true };
  }
  if (body.length <= MAX_BODY_CHARS) return { body, bodyEncoding, ...alreadyTruncated };
  return { body: body.slice(0, MAX_BODY_CHARS), bodyEncoding, bodyTruncated: true };
}

export function mitmTransactionToEvent(tx: MitmTransaction): ParsedNetworkEvent {
  const flowId = `mitm-${tx.deviceIp}-${tx.hostname}-${tx.request.method ?? 'GET'}-${tx.request.url ?? ''}`;
  const reqBody = truncateBody(tx.request);
  const resBody = truncateBody(tx.response);
  const request: NetworkHttpMessage = {
    method: tx.request.method,
    url: tx.request.url,
    headers: tx.request.headers,
    ...reqBody
  };
  const response: NetworkHttpMessage = {
    statusCode: tx.response.statusCode,
    statusText: tx.response.statusText,
    headers: tx.response.headers,
    ...resBody
  };
  return {
    id: tx.transactionId,
    type: 'http-transaction',
    deviceIp: tx.deviceIp,
    timestamp: tx.timestamp,
    hostname: tx.hostname,
    destPort: tx.destPort,
    flowId,
    httpRequest: request,
    httpResponse: response,
    mitm: true,
    durationMs: tx.durationMs
  };
}
