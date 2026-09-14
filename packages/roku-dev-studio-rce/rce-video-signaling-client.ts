/**
 * Negotiates a Roku Cloud Emulator (RCE) device's video/audio stream over the Janus WebSocket
 * signaling protocol: create a session, attach the streaming plugin, then a `watch` request
 * resolves with a JSEP SDP offer. Signaling only — no WebRTC dependency here at all: `connect()`
 * resolves with the offer, and the caller (main process, see `rce-video-handlers.ts`) relays it to
 * the renderer's real `RTCPeerConnection` and calls back into `sendAnswer()`/`sendCandidate()`/
 * `sendCandidatesComplete()` with what comes back.
 *
 * Lives in this package (not the renderer) for the same reason `rce-socket.ts`'s ports-bridge does:
 * the Janus WebSocket handshake requires an `Authorization: Bearer` header, which a browser/renderer
 * `WebSocket` cannot set — so this runs under Node's `ws` in the main process and hands the
 * offer/answer/candidates across IPC to wherever the actual `RTCPeerConnection` lives.
 *
 * Ported from the RokuCommunity reference implementation (`roku-deploy@4.0.0-alpha.6`'s
 * `RceVideoSignalingClient`, the same npm package that independently confirmed this package's ECP
 * routes and sideload's auth headers) — reading its actual `.js`, not just guessing from the field
 * names on `DeviceInstanceInfo`, is what resolved three things nothing else documented:
 *   - `janus_id` is the streaming plugin's `id` param in the `watch` request body (the stream to watch).
 *   - `janus_pin` is that same body's optional `pin` field — its role was undocumented everywhere
 *     else this design doc's research looked.
 *   - `janus_token` is sent as `apisecret` on *every* Janus request, not `token` (a different,
 *     stored-token Janus auth field this gateway rejects with a 403 on `create`).
 * The RCE account bearer token is a fourth, distinct credential: `Authorization: Bearer` on the
 * WebSocket handshake itself, alongside a `'janus-protocol'` subprotocol.
 */

import { EventEmitter } from 'node:events';
import WebSocketImpl from 'ws';
import type { IceServer } from './types';

interface JanusMessage {
  janus?: string;
  transaction?: string;
  data?: { id?: number };
  jsep?: RceVideoJsep;
  error?: { code?: number; reason?: string };
  plugindata?: { data?: { error?: string; error_code?: number } };
  reason?: string;
}

export interface RceVideoJsep {
  type: string;
  sdp: string;
}

/** Everything needed to negotiate a stream from a running RCE device's Janus gateway (built from
 *  the device's `runningDevice` Janus fields). */
export interface RceVideoSignalingConfig {
  websocketUrl: string;
  streamId: number;
  pin?: string | null;
  /** `runningDevice.janusToken`, sent as the `apisecret` field on every Janus request. */
  janusToken?: string | null;
  /** RCE account bearer token, sent as `Authorization: Bearer <apiToken>` on the WS handshake. */
  apiToken: string;
  iceServers?: IceServer[] | null;
}

export interface RceVideoSignalingClientOptions {
  /** How often to send a Janus keepalive. Defaults to 25000ms (Janus sessions time out at 60s). */
  keepaliveIntervalMs?: number;
  /** How long connect() waits (through the 'watch' response) before giving up. Defaults to 20000ms. */
  negotiationTimeoutMs?: number;
}

export interface RceVideoSignalingOffer {
  offer: RceVideoJsep;
  iceServers: IceServer[];
}

type PendingRequest = { resolve: (message: JanusMessage) => void; reject: (error: Error) => void };

const DEFAULT_KEEPALIVE_MS = 25000;
const DEFAULT_NEGOTIATION_TIMEOUT_MS = 20000;

export declare interface RceVideoSignalingClient {
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'close', listener: () => void): this;
}

export class RceVideoSignalingClient extends EventEmitter {
  private readonly keepaliveIntervalMs: number;
  private readonly negotiationTimeoutMs: number;
  private webSocket: WebSocketImpl | undefined;
  private sessionId: number | undefined;
  private handleId: number | undefined;
  private keepaliveTimerId: ReturnType<typeof setInterval> | undefined;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  /** Settles the pending websocket-handshake promise; stored because stop() strips the socket
   *  listeners that promise is built on, so stop() and the unexpected-close handler must reject it
   *  directly or a connect() cancelled mid-handshake would hang until the negotiation timeout. */
  private rejectConnected: ((error: Error) => void) | undefined;
  private transactionCounter = 0;

  constructor(
    private readonly config: RceVideoSignalingConfig,
    options?: RceVideoSignalingClientOptions
  ) {
    super();
    this.keepaliveIntervalMs = options?.keepaliveIntervalMs ?? DEFAULT_KEEPALIVE_MS;
    this.negotiationTimeoutMs = options?.negotiationTimeoutMs ?? DEFAULT_NEGOTIATION_TIMEOUT_MS;
  }

  /**
   * Connect and negotiate as far as the SDP offer. Rejects (tearing the session down) if
   * negotiation exceeds `negotiationTimeoutMs`, so a silently unresponsive gateway fails loudly.
   * One session at a time — a second connect() while one is active rejects; call stop() first.
   */
  async connect(): Promise<RceVideoSignalingOffer> {
    if (this.webSocket) {
      throw new Error(`Janus signaling session for stream '${this.config.streamId}' is already connected or connecting; call stop() before reconnecting`);
    }
    let negotiationSettled = false;
    let timeoutHandle: ReturnType<typeof setTimeout>;
    const negotiationPromise = this.negotiate();
    // Without this, a negotiate() rejection arriving after the timeout already won the race below
    // would otherwise be an unhandled promise rejection.
    negotiationPromise.catch(() => {});
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        if (negotiationSettled) return;
        negotiationSettled = true;
        this.stop();
        reject(new Error(`Timed out negotiating the Janus stream '${this.config.streamId}'`));
      }, this.negotiationTimeoutMs);
    });
    try {
      return await Promise.race([negotiationPromise, timeoutPromise]);
    } catch (error) {
      this.stop();
      throw error;
    } finally {
      negotiationSettled = true;
      clearTimeout(timeoutHandle!);
    }
  }

  /** A dedicated method (rather than inline in negotiate()) so tests can stub it with a fake. */
  private createWebSocket(url: string, requestOptions: { headers: Record<string, string> }): WebSocketImpl {
    return new WebSocketImpl(url, 'janus-protocol', requestOptions);
  }

  private async negotiate(): Promise<RceVideoSignalingOffer> {
    const webSocket = this.createWebSocket(this.config.websocketUrl, {
      headers: { Authorization: `Bearer ${this.config.apiToken}` }
    });
    this.webSocket = webSocket;

    const connected = new Promise<void>((resolve, reject) => {
      this.rejectConnected = reject;
      webSocket.once('open', () => resolve());
      webSocket.once('error', (error: Error) => reject(new Error(`Failed to connect to the Janus WebSocket: ${error.message}`)));
    });

    webSocket.on('message', (data: WebSocketImpl.RawData) => this.handleMessage(data.toString()));
    webSocket.on('close', () => {
      this.stopKeepalive();
      // The socket is gone: nothing can ever answer requests still in flight.
      this.webSocket = undefined;
      this.sessionId = undefined;
      this.handleId = undefined;
      const closedError = new Error(`The Janus WebSocket for stream '${this.config.streamId}' closed unexpectedly`);
      this.rejectConnected?.(closedError);
      this.rejectConnected = undefined;
      this.rejectPendingRequests(closedError);
      this.emit('close');
    });

    await connected;
    this.rejectConnected = undefined;
    // From here on, a socket error is a session-lifetime error rather than a failed connection attempt.
    webSocket.removeAllListeners('error');
    webSocket.on('error', (error: Error) => {
      this.emit('error', new Error(`Janus WebSocket error: ${error.message}`));
    });

    const createResponse = await this.sendRequest({ janus: 'create' });
    this.sessionId = createResponse.data?.id;
    this.startKeepalive();

    const attachResponse = await this.sendRequest({
      janus: 'attach',
      session_id: this.sessionId,
      plugin: 'janus.plugin.streaming'
    });
    this.handleId = attachResponse.data?.id;

    const watchResponse = await this.sendRequest({
      janus: 'message',
      session_id: this.sessionId,
      handle_id: this.handleId,
      body: { request: 'watch', id: this.config.streamId, ...(this.config.pin ? { pin: this.config.pin } : {}) }
    });

    const offer = watchResponse.jsep;
    if (!offer?.sdp) {
      throw new Error(`Janus did not return an SDP offer for stream '${this.config.streamId}'`);
    }
    return { offer, iceServers: this.config.iceServers ?? [] };
  }

  /** Answer the offer returned by connect(). Sends the `start` plugin message with the answer. */
  async sendAnswer(jsep: RceVideoJsep): Promise<void> {
    await this.sendRequest({
      janus: 'message',
      session_id: this.sessionId,
      handle_id: this.handleId,
      body: { request: 'start' },
      jsep
    });
  }

  /** Trickle a single local ICE candidate to Janus. */
  sendCandidate(candidate: unknown): void {
    this.sendFireAndForget({ janus: 'trickle', session_id: this.sessionId, handle_id: this.handleId, candidate });
  }

  /** Tell Janus local ICE gathering has finished. */
  sendCandidatesComplete(): void {
    this.sendFireAndForget({
      janus: 'trickle',
      session_id: this.sessionId,
      handle_id: this.handleId,
      candidate: { completed: true }
    });
  }

  /** Tear the session down: best-effort session destroy, then close the socket and clear the
   *  keepalive timer. Safe to call more than once, or before connect() has finished. */
  stop(): void {
    this.stopKeepalive();
    this.rejectConnected?.(new Error(`Janus signaling session for stream '${this.config.streamId}' was stopped`));
    this.rejectConnected = undefined;
    if (this.sessionId !== undefined) {
      this.sendFireAndForget({ janus: 'destroy', session_id: this.sessionId });
    }
    if (this.webSocket) {
      const webSocket = this.webSocket;
      webSocket.removeAllListeners();
      // Closing a socket still CONNECTING makes ws abort the handshake and emit 'error'; with no
      // listener Node's EventEmitter throws it instead of swallowing it.
      webSocket.on('error', () => {});
      try {
        if (webSocket.readyState === WebSocketImpl.CONNECTING) {
          webSocket.terminate();
        } else {
          webSocket.close();
        }
      } catch {
        // ws can also throw synchronously here; either way the socket is being discarded.
      }
      this.webSocket = undefined;
    }
    this.rejectPendingRequests(new Error(`Janus signaling session for stream '${this.config.streamId}' was stopped`));
    this.sessionId = undefined;
    this.handleId = undefined;
  }

  private rejectPendingRequests(error: Error): void {
    for (const pendingRequest of this.pendingRequests.values()) {
      pendingRequest.reject(error);
    }
    this.pendingRequests.clear();
  }

  private handleMessage(rawData: string): void {
    let message: JanusMessage;
    try {
      message = JSON.parse(rawData);
    } catch {
      return;
    }
    if (message.janus === 'ack') {
      // Acknowledges receipt of an async request; the real response arrives later as
      // 'success'/'event' carrying the same transaction.
      return;
    }
    if (message.janus === 'success' || message.janus === 'event') {
      this.settlePendingRequest(message.transaction, message, undefined);
      return;
    }
    if (message.janus === 'error') {
      const errorMessage = this.describeJanusError(message);
      const wasPending = this.settlePendingRequest(message.transaction, undefined, errorMessage);
      if (!wasPending) this.emit('error', new Error(errorMessage));
      return;
    }
    if (message.janus === 'hangup') {
      this.emit('error', new Error(`Janus hung up on stream '${this.config.streamId}'${message.reason ? `: ${message.reason}` : ''}`));
    }
    // Keepalive acks, webrtcup/media/slowlink notifications, and other informational events are
    // not currently surfaced.
  }

  /** Plugin-level errors arrive as Janus-protocol successes but are treated as rejections so the
   *  real reason surfaces. @returns whether a pending request was found (and settled) */
  private settlePendingRequest(transaction: string | undefined, message: JanusMessage | undefined, errorMessage: string | undefined): boolean {
    if (transaction === undefined) return false;
    const pendingRequest = this.pendingRequests.get(transaction);
    if (!pendingRequest) return false;
    this.pendingRequests.delete(transaction);
    const pluginErrorMessage = message ? this.describePluginError(message) : undefined;
    if (errorMessage !== undefined) {
      pendingRequest.reject(new Error(errorMessage));
    } else if (pluginErrorMessage !== undefined) {
      pendingRequest.reject(new Error(pluginErrorMessage));
    } else {
      pendingRequest.resolve(message!);
    }
    return true;
  }

  private describeJanusError(message: JanusMessage): string {
    const reason = message.error?.reason ?? 'unknown error';
    const code = message.error?.code;
    return `Janus error for stream '${this.config.streamId}'${code !== undefined ? ` (code ${code})` : ''}: ${reason}`;
  }

  /** Describes a streaming-plugin-level error (e.g. a wrong pin or unknown stream id), which
   *  arrives as a normal 'event' with no jsep rather than a top-level `{janus:'error'}`. */
  private describePluginError(message: JanusMessage): string | undefined {
    const pluginErrorText = message.plugindata?.data?.error;
    if (pluginErrorText === undefined) return undefined;
    const errorCode = message.plugindata?.data?.error_code;
    return `Janus plugin error for stream '${this.config.streamId}'${errorCode !== undefined ? ` (code ${errorCode})` : ''}: ${pluginErrorText}`;
  }

  private sendRequest(request: Record<string, unknown>): Promise<JanusMessage> {
    const transaction = this.nextTransactionId();
    return new Promise((resolve, reject) => {
      if (!this.webSocket) {
        reject(new Error(`Cannot send a Janus request for stream '${this.config.streamId}': the signaling session is not connected`));
        return;
      }
      this.pendingRequests.set(transaction, { resolve, reject });
      this.webSocket.send(JSON.stringify(this.withTransactionAndSecret(request, transaction)));
    });
  }

  private sendFireAndForget(request: Record<string, unknown>): void {
    this.webSocket?.send(JSON.stringify(this.withTransactionAndSecret(request, this.nextTransactionId())));
  }

  private withTransactionAndSecret(request: Record<string, unknown>, transaction: string): Record<string, unknown> {
    return {
      ...request,
      transaction,
      ...(this.config.janusToken !== undefined && this.config.janusToken !== null ? { apisecret: this.config.janusToken } : {})
    };
  }

  private nextTransactionId(): string {
    this.transactionCounter += 1;
    return `rce-video-${this.transactionCounter}`;
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    this.keepaliveTimerId = setInterval(() => {
      if (this.sessionId !== undefined) {
        this.sendFireAndForget({ janus: 'keepalive', session_id: this.sessionId });
      }
    }, this.keepaliveIntervalMs);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimerId) {
      clearInterval(this.keepaliveTimerId);
      this.keepaliveTimerId = undefined;
    }
  }
}
