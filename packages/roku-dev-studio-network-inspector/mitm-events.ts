import type { NetworkHttpMessage, ParsedNetworkEvent } from './types';
import { DEFAULT_MAX_BODY_RETAINED_BYTES } from './types';
import type { MitmTransaction } from './mitm-proxy';

// Body retention cap for the persisted detail (request/response shown when a row is selected). The
// proxy decompresses gzip/br/deflate for display, so decoded text can be several times larger than
// the bytes on the wire (e.g. a ~250 KB gzipped `utag.js` inflates to a few MB). This cap is
// user-configurable (Settings → Network Inspector → Max Body Size) and snapshot-only — it never
// affects the bytes the proxy forwards to the Roku. Bodies are disk-backed in the detail store and
// fetched on demand (the live list keeps only summaries), so a larger cap doesn't grow steady-state
// renderer memory. base64 can't be sliced (it would corrupt the payload), so binary bodies are
// whole-or-nothing against a ~4/3-scaled budget (base64 expands raw bytes by ~4/3).
function truncateBody(
  msg: NetworkHttpMessage,
  maxBodyChars: number
): { body?: string; bodyEncoding?: 'text' | 'base64'; bodyTruncated?: boolean } {
  const { body, bodyEncoding } = msg;
  if (!body) return {};
  const alreadyTruncated = msg.bodyTruncated ? { bodyTruncated: true as const } : {};
  if (bodyEncoding === 'base64') {
    const maxBase64Chars = Math.ceil((maxBodyChars * 4) / 3);
    if (body.length <= maxBase64Chars) return { body, bodyEncoding, ...alreadyTruncated };
    return { bodyEncoding, bodyTruncated: true };
  }
  if (body.length <= maxBodyChars) return { body, bodyEncoding, ...alreadyTruncated };
  return { body: body.slice(0, maxBodyChars), bodyEncoding, bodyTruncated: true };
}

export function mitmTransactionToEvent(
  tx: MitmTransaction,
  maxBodyRetainedBytes: number = DEFAULT_MAX_BODY_RETAINED_BYTES
): ParsedNetworkEvent {
  const flowId = `mitm-${tx.deviceIp}-${tx.hostname}-${tx.request.method ?? 'GET'}-${tx.request.url ?? ''}`;
  const reqBody = truncateBody(tx.request, maxBodyRetainedBytes);
  const resBody = truncateBody(tx.response, maxBodyRetainedBytes);
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
    ...(tx.replay ? { replay: true } : {}),
    durationMs: tx.durationMs,
    timing: tx.timing
  };
}
