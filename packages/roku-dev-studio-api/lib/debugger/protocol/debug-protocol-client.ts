/**
 * BrightScript Debug Protocol client — in-house implementation.
 *
 * Speaks Roku's binary socket-based debugger protocol (control port 8081)
 * directly over a TCP socket: no `roku-debug` / `smart-buffer` / `eventemitter3`
 * dependency. Drop-in for the small surface `DebugSessionController` used from
 * roku-debug's `DebugProtocolClient` — same method names, event names, and
 * `{ data: { threads|entries|variables|breakpoints } }` response shapes.
 *
 * Improvements over the wrapped library:
 *  - `connect()` rejects promptly on a refused/errored port instead of hanging.
 *  - Responses are plain JSON (no getters), and 64-bit ints are stringified so an
 *    IPC `JSON.stringify` can't silently drop the whole payload.
 *  - `protocol-version` carries the real version string.
 *
 * See https://developer.roku.com/dev/docs/socket-based-debugger.
 */
import { EventEmitter } from 'events';
import type { Socket } from 'net';
import { CommandCode, DEBUG_CONTROL_PORT, DEBUGGER_MAGIC, ErrorCode, StepTypeCode } from './constants';
import {
  encodeAddBreakpoints,
  encodeAddConditionalBreakpoints,
  encodeContinue,
  encodeExecute,
  encodeExitChannel,
  encodeHandshake,
  encodeRemoveBreakpoints,
  encodeStackTrace,
  encodeStep,
  encodeStop,
  encodeThreads,
  encodeVariables
} from './encode';
import {
  parseBreakpoints,
  parseExecute,
  parseGeneric,
  parseHandshakeLegacy,
  parseHandshakeV3,
  parseStackTrace,
  parseThreads,
  parseUpdate,
  parseVariables,
  versionGte,
  type ParseResult
} from './decode';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const net = require('net') as typeof import('net');

export interface DebugProtocolClientOptions {
  host: string;
  controlPort?: number;
}

interface AddBreakpointInput {
  filePath: string;
  lineNumber: number;
  hitCount?: number;
  ignoreCount?: number;
  conditionalExpression?: string;
}

type AnyResult = ParseResult<Record<string, unknown>>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DebugProtocolClient extends EventEmitter {
  private readonly host: string;
  private readonly controlPort: number;

  private controlSocket?: Socket;
  private ioSocket?: Socket;

  /** Unconsumed bytes received on the control socket. */
  private buffer: Buffer = Buffer.alloc(0);

  private handshakeComplete = false;
  private watchPacketLength = false;
  private ended = false;

  /** Negotiated protocol version (e.g. "3.2.0"); empty until the handshake lands. */
  protocolVersion = '';

  private isStopped = false;
  private primaryThread = 0;
  private stackFrameIndex = 0;

  /** True while a thread is halted (stopped at entry / breakpoint / STOP / step / error).
   *  The device only reliably REGISTERS breakpoints added from a halted state, so the
   *  controller uses this to decide when a breakpoint add will actually take effect. */
  get halted(): boolean {
    return this.isStopped;
  }

  private requestIdSequence = 1;
  /** requestId -> the command we sent (so the reader picks the right parser). */
  private activeRequests = new Map<number, CommandCode>();
  /** requestId -> resolver for the awaiting caller. */
  private pending = new Map<number, (result: AnyResult) => void>();

  private handshakeResolve?: () => void;
  private handshakeReject?: (err: Error) => void;
  private ioPartialLine = '';

  constructor(options: DebugProtocolClientOptions) {
    super();
    this.host = options.host;
    this.controlPort = options.controlPort ?? DEBUG_CONTROL_PORT;
  }

  // --- Connection ------------------------------------------------------------

  async connect(sendHandshake = true): Promise<boolean> {
    await this.establishControlConnection();
    if (sendHandshake) {
      await this.sendHandshake();
    }
    return true;
  }

  private establishControlConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket({ allowHalfOpen: false });
      this.controlSocket = socket;
      let connected = false;

      socket.once('error', (err: Error) => {
        if (!connected) {
          // Failure before we ever connected — surface it to the attach retry loop.
          reject(err);
          return;
        }
        this.teardownControlSocket();
        this.endSession('close');
      });
      socket.on('close', () => {
        if (!connected) return; // connect rejection already handled it
        this.teardownControlSocket();
        this.endSession('app-exit');
      });
      socket.on('data', (data: Buffer) => this.onData(data));

      socket.connect({ port: this.controlPort, host: this.host }, () => {
        connected = true;
        resolve();
      });
    });
  }

  private sendHandshake(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.handshakeResolve = resolve;
      this.handshakeReject = reject;
      if (!this.controlSocket) {
        reject(new Error('Control socket was closed before the handshake.'));
        return;
      }
      this.controlSocket.write(encodeHandshake());
    });
  }

  // --- Receive loop ----------------------------------------------------------

  private onData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
    try {
      while (this.buffer.length > 0 && this.consumeOne()) {
        // consumeOne slices the buffer and dispatches one message per turn
      }
    } catch {
      // A malformed message shouldn't take the session down; wait for more bytes.
    }
  }

  private consumeOne(): boolean {
    if (!this.handshakeComplete) {
      return this.consumeHandshake();
    }

    const watch = this.watchPacketLength;
    const peek = parseGeneric(this.buffer, watch);
    if (!peek.success) return false;
    const packetLength = (peek.data.packetLength as number) ?? 0;
    if (watch && packetLength > this.buffer.length) return false; // wait for the rest

    const requestId = peek.data.requestId as number;
    const errorCode = peek.data.errorCode as number;

    let chosen: AnyResult;
    if (errorCode !== ErrorCode.OK) {
      // Error responses don't carry the command-specific payload — use the header.
      chosen = peek as AnyResult;
    } else if (requestId !== 0) {
      chosen = this.parseResponseFor(this.activeRequests.get(requestId), this.buffer, watch);
    } else {
      chosen = parseUpdate(this.buffer, watch);
    }

    if (!chosen.success) return false;
    if (watch && ((chosen.data.packetLength as number) ?? 0) > this.buffer.length) return false;

    const consume = chosen.readOffset || (watch ? packetLength : 0);
    if (consume <= 0) {
      // Can't determine framing — drop by the peeked packet length if we can, else wait.
      if (watch && packetLength > 0 && packetLength <= this.buffer.length) {
        this.buffer = this.buffer.subarray(packetLength);
        return true;
      }
      return false;
    }

    this.buffer = this.buffer.subarray(consume);
    this.dispatch(chosen, requestId);
    return true;
  }

  private consumeHandshake(): boolean {
    let hs = parseHandshakeV3(this.buffer);
    if (!hs.success) hs = parseHandshakeLegacy(this.buffer);
    if (!hs.success) return false; // wait for more bytes

    if (hs.data.magic !== DEBUGGER_MAGIC) {
      const err = new Error('Invalid debugger handshake magic from device.');
      this.handshakeReject?.(err);
      this.handshakeReject = undefined;
      this.handshakeResolve = undefined;
      this.endSession('close');
      return false;
    }

    this.buffer = this.buffer.subarray(hs.readOffset);
    this.handshakeComplete = true;
    this.protocolVersion = hs.data.protocolVersion;
    this.watchPacketLength = versionGte(this.protocolVersion, 3, 0, 0);

    const [major, minor, patch] = this.protocolVersion.split('.').map((n) => parseInt(n, 10) || 0);
    this.emit('protocol-version', { major, minor, patch, version: this.protocolVersion });

    this.handshakeResolve?.();
    this.handshakeResolve = undefined;
    this.handshakeReject = undefined;
    return true;
  }

  private parseResponseFor(command: CommandCode | undefined, buffer: Buffer, watch: boolean): AnyResult {
    switch (command) {
      case CommandCode.Threads:
        return parseThreads(buffer, watch) as AnyResult;
      case CommandCode.StackTrace:
        return parseStackTrace(buffer, watch) as AnyResult;
      case CommandCode.Variables:
        return parseVariables(buffer, watch) as AnyResult;
      case CommandCode.Execute:
        return parseExecute(buffer, watch) as AnyResult;
      case CommandCode.AddBreakpoints:
      case CommandCode.AddConditionalBreakpoints:
      case CommandCode.ListBreakpoints:
      case CommandCode.RemoveBreakpoints:
        return parseBreakpoints(buffer, watch) as AnyResult;
      default:
        // Stop / Continue / Step / ExitChannel / unknown: generic header only.
        return parseGeneric(buffer, watch) as AnyResult;
    }
  }

  private dispatch(result: AnyResult, requestId: number): void {
    if (requestId !== 0) {
      const resolve = this.pending.get(requestId);
      if (resolve) {
        this.pending.delete(requestId);
        this.activeRequests.delete(requestId);
        resolve(result);
      }
      this.emit('response', result);
    } else {
      this.handleUpdate(result.data);
    }
  }

  private handleUpdate(data: Record<string, unknown>): void {
    const type = data.updateType as string;
    if (type === 'AllThreadsStopped' || type === 'ThreadAttached') {
      this.isStopped = true;
      const reason = data.stopReason as string;
      const isValidStop = ['RuntimeError', 'Break', 'StopStatement', 'CaughtRuntimeError'].includes(reason);
      if (!isValidStop) return;
      const eventName = reason === 'RuntimeError' || reason === 'CaughtRuntimeError' ? 'runtime-error' : 'suspend';
      this.primaryThread = (data.threadIndex as number) ?? this.primaryThread;
      if (type === 'AllThreadsStopped') this.stackFrameIndex = 0;
      this.emit(eventName, data);
    } else if (type === 'IOPortOpened') {
      this.connectToIoPort(data.port as number);
    } else if (type === 'CompileError') {
      if (data.errorMessage) this.emit('compile-error', data);
    } else if (type === 'BreakpointError') {
      this.emit('breakpoint-error', data);
    } else if (type === 'BreakpointVerified') {
      if (Array.isArray(data.breakpoints) && data.breakpoints.length > 0) {
        this.emit('breakpoints-verified', data);
      }
    }
  }

  // --- Requests --------------------------------------------------------------

  private nextId(): number {
    return this.requestIdSequence++;
  }

  private send(command: CommandCode, requestId: number, buffer: Buffer): Promise<AnyResult> {
    return new Promise((resolve, reject) => {
      if (!this.controlSocket) {
        reject(new Error(`Control socket was closed — command ${CommandCode[command]}.`));
        return;
      }
      this.activeRequests.set(requestId, command);
      this.pending.set(requestId, resolve);
      this.controlSocket.write(buffer);
    });
  }

  async continue(): Promise<AnyResult | undefined> {
    if (!this.isStopped) return undefined;
    this.isStopped = false;
    const id = this.nextId();
    return this.send(CommandCode.Continue, id, encodeContinue(id));
  }

  async pause(force = false): Promise<AnyResult | undefined> {
    if (this.isStopped && !force) return undefined;
    const id = this.nextId();
    return this.send(CommandCode.Stop, id, encodeStop(id));
  }

  private async step(stepType: StepTypeCode, threadIndex = this.primaryThread): Promise<AnyResult | undefined> {
    if (!this.isStopped) return undefined;
    this.isStopped = false;
    const id = this.nextId();
    const result = await this.send(CommandCode.Step, id, encodeStep(id, threadIndex, stepType));
    if (result && (result.data.errorCode as number) !== ErrorCode.OK) {
      this.emit('cannot-continue');
    }
    return result;
  }

  stepIn(threadIndex?: number): Promise<AnyResult | undefined> {
    return this.step(StepTypeCode.Line, threadIndex ?? this.primaryThread);
  }
  stepOver(threadIndex?: number): Promise<AnyResult | undefined> {
    return this.step(StepTypeCode.Over, threadIndex ?? this.primaryThread);
  }
  stepOut(threadIndex?: number): Promise<AnyResult | undefined> {
    return this.step(StepTypeCode.Out, threadIndex ?? this.primaryThread);
  }

  async threads(): Promise<AnyResult | undefined> {
    if (!this.isStopped) return undefined;
    const id = this.nextId();
    const result = await this.send(CommandCode.Threads, id, encodeThreads(id));
    const list = (result?.data.threads as Array<{ isPrimary?: boolean }>) ?? [];
    for (let i = 0; i < list.length; i++) {
      if (list[i].isPrimary) {
        this.primaryThread = i;
        break;
      }
    }
    return result;
  }

  async getStackTrace(threadIndex = this.primaryThread): Promise<AnyResult | undefined> {
    if (!this.isStopped || !(threadIndex > -1)) return undefined;
    const id = this.nextId();
    return this.send(CommandCode.StackTrace, id, encodeStackTrace(id, threadIndex));
  }

  async getVariables(
    variablePathEntries: string[] = [],
    stackFrameIndex = this.stackFrameIndex,
    threadIndex = this.primaryThread
  ): Promise<AnyResult | undefined> {
    if (!this.isStopped || !(threadIndex > -1)) return undefined;
    const id = this.nextId();
    const result = await this.send(
      CommandCode.Variables,
      id,
      encodeVariables(id, {
        threadIndex,
        stackFrameIndex: stackFrameIndex ?? 0,
        variablePath: variablePathEntries,
        enableForceCaseInsensitivity: versionGte(this.protocolVersion, 3, 1, 0),
        getVirtualKeys: versionGte(this.protocolVersion, 3, 3, 0)
      })
    );
    // If the path pointed at something missing/invalid, synthesize a friendly
    // placeholder variable rather than surfacing an empty/erroring response.
    const errorData = result?.data.errorData as { missingKeyIndex?: number; invalidPathIndex?: number } | undefined;
    if (result && errorData && (errorData.missingKeyIndex != null || errorData.invalidPathIndex != null)) {
      const isMissing = errorData.missingKeyIndex != null;
      const lastName = variablePathEntries[variablePathEntries.length - 1];
      result.data.variables = [
        {
          name: lastName,
          type: isMissing ? 'Uninitialized' : 'Invalid',
          value: isMissing ? null : 'Invalid (not defined)',
          isConst: false,
          isContainer: false,
          isVirtual: false,
          refCount: 0
        }
      ];
    }
    return result;
  }

  async executeCommand(
    sourceCode: string,
    stackFrameIndex = this.stackFrameIndex,
    threadIndex = this.primaryThread
  ): Promise<AnyResult | undefined> {
    if (!this.isStopped || !(threadIndex > -1)) return undefined;
    const id = this.nextId();
    return this.send(CommandCode.Execute, id, encodeExecute(id, threadIndex, stackFrameIndex ?? 0, sourceCode));
  }

  async addBreakpoints(breakpoints: unknown): Promise<AnyResult> {
    const list: AddBreakpointInput[] = Array.isArray(breakpoints) ? (breakpoints as AddBreakpointInput[]) : [];
    if (list.length === 0) return { success: true, readOffset: 0, data: { breakpoints: [] } };

    const specs = list.map((b) => ({
      filePath: b.filePath,
      lineNumber: b.lineNumber,
      ignoreCount: b.hitCount ?? b.ignoreCount ?? 0,
      conditionalExpression: b.conditionalExpression
    }));
    const hasConditions = specs.some((b) => (b.conditionalExpression ?? '').trim().length > 0);
    const supportsConditional = versionGte(this.protocolVersion, 3, 1, 0);
    const useConditional = supportsConditional && hasConditions;
    if (hasConditions && !supportsConditional) {
      // The device's protocol predates conditional breakpoints (3.1.0 / Roku OS 11.5),
      // so encodeAddBreakpoints drops the condition and the breakpoint would halt on
      // EVERY hit. Register it anyway (so debugging still works) but tell the UI the
      // condition was dropped, instead of silently downgrading it with no feedback.
      this.emit('breakpoint-error', {
        reason: 'condition-unsupported',
        protocolVersion: this.protocolVersion,
        breakpoints: specs
          .filter((b) => (b.conditionalExpression ?? '').trim().length > 0)
          .map((b) => ({ filePath: b.filePath, lineNumber: b.lineNumber }))
      });
    }
    const id = this.nextId();
    const buffer = useConditional ? encodeAddConditionalBreakpoints(id, specs) : encodeAddBreakpoints(id, specs);
    const command = useConditional ? CommandCode.AddConditionalBreakpoints : CommandCode.AddBreakpoints;
    const result = await this.send(command, id, buffer);

    // Firmware without breakpoint verification (<3.2.0) never sends the verified
    // update — auto-mark them so the UI reflects reality.
    if (!versionGte(this.protocolVersion, 3, 2, 0)) {
      this.emit('breakpoints-verified', { breakpoints: (result?.data.breakpoints as unknown[]) ?? [] });
    }
    return result;
  }

  async removeBreakpoints(breakpointIds: number[]): Promise<AnyResult> {
    const ids = (breakpointIds ?? []).filter((x) => typeof x === 'number');
    if (ids.length === 0) return { success: true, readOffset: 0, data: { breakpoints: [] } };
    const id = this.nextId();
    return this.send(CommandCode.RemoveBreakpoints, id, encodeRemoveBreakpoints(id, ids));
  }

  // --- IO port ---------------------------------------------------------------

  /** Connect to the device's read-only I/O port to stream the channel's print output. */
  private connectToIoPort(port: number): void {
    if (!port || port <= 0) return;
    try {
      const io = new net.Socket({ allowHalfOpen: false });
      this.ioSocket = io;
      io.connect({ port, host: this.host }, () => {
        // connected; data handler streams output below
      });
      io.on('data', (buf: Buffer) => {
        const text = this.ioPartialLine + buf.toString('utf8');
        const lastNl = text.lastIndexOf('\n');
        if (lastNl >= 0) {
          this.emit('io-output', text.slice(0, lastNl + 1));
          this.ioPartialLine = text.slice(lastNl + 1);
        } else {
          this.ioPartialLine = text;
        }
      });
      io.once('error', () => {
        try {
          io.destroy();
        } catch {
          /* best-effort */
        }
      });
      io.on('close', () => {
        // flush any trailing partial line
        if (this.ioPartialLine) {
          this.emit('io-output', this.ioPartialLine);
          this.ioPartialLine = '';
        }
      });
    } catch {
      this.emit('app-exit');
    }
  }

  // --- Teardown --------------------------------------------------------------

  private teardownControlSocket(): void {
    if (this.controlSocket) {
      try {
        this.controlSocket.removeAllListeners();
        this.controlSocket.destroy();
      } catch {
        /* best-effort */
      }
      this.controlSocket = undefined;
    }
  }

  private endSession(evt: 'close' | 'app-exit'): void {
    if (this.ended) return;
    this.ended = true;
    // Fail any in-flight requests so awaiting callers don't hang.
    for (const [, resolve] of this.pending) {
      resolve({ success: false, readOffset: 0, data: { errorCode: ErrorCode.OTHER_ERR } });
    }
    this.pending.clear();
    this.activeRequests.clear();
    this.emit(evt);
  }

  async destroy(immediate = false): Promise<void> {
    // Politely ask the device to end the debug session (unless a hard/immediate kill).
    if (this.controlSocket && !immediate) {
      try {
        const id = this.nextId();
        await Promise.race([this.send(CommandCode.ExitChannel, id, encodeExitChannel(id)), sleep(1500)]);
      } catch {
        /* best-effort */
      }
    }
    this.ended = true;
    this.teardownControlSocket();
    if (this.ioSocket) {
      try {
        this.ioSocket.removeAllListeners();
        this.ioSocket.destroy();
      } catch {
        /* best-effort */
      }
      this.ioSocket = undefined;
    }
    for (const [, resolve] of this.pending) {
      resolve({ success: false, readOffset: 0, data: { errorCode: ErrorCode.OTHER_ERR } });
    }
    this.pending.clear();
    this.activeRequests.clear();
    this.buffer = Buffer.alloc(0);
    this.removeAllListeners();
  }
}
