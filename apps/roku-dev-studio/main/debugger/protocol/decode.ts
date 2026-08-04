/**
 * BrightScript Debug Protocol — response & update decoders (device → client).
 *
 * Every parser returns { success, readOffset, data }. `readOffset` is how many
 * bytes this message occupies (used to advance the receive buffer); for protocol
 * >=3.0.0 that's the wire `packet_length`, otherwise the bytes actually consumed.
 * A parser that runs out of bytes throws (via BufReader), which `run()` turns
 * into `success:false` so the caller waits for the next TCP chunk.
 */
import { BufReader } from './buffer';
import {
  ErrorCode,
  ErrorFlags,
  StopReasonName,
  UpdateTypeCode,
  VariableFlags,
  VariableTypeName
} from './constants';

export interface ParseResult<T = Record<string, unknown>> {
  success: boolean;
  readOffset: number;
  data: T;
}

/** Compare a dotted version string against major/minor/patch (defaults 0). */
export function versionGte(version: string, major: number, minor = 0, patch = 0): boolean {
  const parts = String(version || '').split('.').map((n) => parseInt(n, 10) || 0);
  const a = parts[0] ?? 0;
  const b = parts[1] ?? 0;
  const c = parts[2] ?? 0;
  if (a !== major) return a > major;
  if (b !== minor) return b > minor;
  return c >= patch;
}

/** Mirror of roku-debug's `bufferLoaderHelper`: guards min length + try/catch. */
function run<T extends object>(
  buffer: Buffer,
  minByteLength: number,
  processor: (r: BufReader, data: T) => boolean | void
): ParseResult<T> {
  const result: ParseResult<T> = { success: false, readOffset: 0, data: {} as T };
  try {
    if (buffer.length >= minByteLength) {
      const r = new BufReader(buffer);
      const ok = processor(r, result.data);
      result.success = ok ?? true;
      if (result.success && !result.readOffset) {
        const pkt = (result.data as { packetLength?: number }).packetLength;
        result.readOffset = pkt ?? r.offset;
      }
    }
  } catch {
    result.readOffset = 0;
    result.success = false;
  }
  return result;
}

interface CommonResponse {
  packetLength?: number;
  requestId: number;
  errorCode: number;
  errorData?: { invalidPathIndex?: number; missingKeyIndex?: number };
  // Index signature so the concrete response `data` shapes remain assignable to
  // the client's generic `ParseResult<Record<string, unknown>>` without casts.
  [key: string]: unknown;
}

/** Read the shared response header. For >=3.0.0 there's a leading packet_length. */
function readCommonResponse(r: BufReader, data: Partial<CommonResponse>, watchPacketLength: boolean): void {
  if (watchPacketLength) {
    data.packetLength = r.u32();
  }
  data.requestId = r.u32();
  data.errorCode = r.u32();
  const pkt = data.packetLength;
  if (data.errorCode !== ErrorCode.OK && (pkt === undefined || pkt > r.offset)) {
    data.errorData = {};
    const flags = r.u32();
    if (flags & ErrorFlags.INVALID_VALUE_IN_PATH) data.errorData.invalidPathIndex = r.u32();
    if (flags & ErrorFlags.MISSING_KEY_IN_PATH) data.errorData.missingKeyIndex = r.u32();
  }
}

// --- Handshake ---------------------------------------------------------------

export interface HandshakeData {
  magic: string;
  protocolVersion: string;
  revisionTimestamp?: number;
}

/** Protocol >=3.0.0 handshake: magic + version + remaining_len + revision timestamp. */
export function parseHandshakeV3(buffer: Buffer): ParseResult<HandshakeData> {
  return run<HandshakeData>(buffer, 20, (r, data) => {
    data.magic = r.stringNT();
    data.protocolVersion = [r.u32(), r.u32(), r.u32()].join('.');
    const legacyReadSize = r.offset;
    const remainingPacketLength = r.i32();
    const requiredBufferSize = remainingPacketLength + legacyReadSize;
    data.revisionTimestamp = Number(r.u64());
    if (r.length < requiredBufferSize) {
      throw new Error('handshake incomplete');
    }
    // Only >=3.0.0 uses this handshake shape; reject lower so the legacy parser wins.
    if (!versionGte(data.protocolVersion, 3, 0, 0)) {
      throw new Error(`unsupported v3 handshake version ${data.protocolVersion}`);
    }
    // readOffset is set by the caller from r.offset; force it to the full packet.
    (data as { packetLength?: number }).packetLength = requiredBufferSize;
    return true;
  });
}

/** Legacy (<3.0.0) handshake: magic + 3x signed int32 version, no packet length. */
export function parseHandshakeLegacy(buffer: Buffer): ParseResult<HandshakeData> {
  return run<HandshakeData>(buffer, 20, (r, data) => {
    data.magic = r.stringNT();
    data.protocolVersion = [r.i32(), r.i32(), r.i32()].join('.');
    // The legacy handshake only applies to <3.0.0. If the version reads >=3.0.0
    // this is really a not-yet-complete v3 handshake — fail so we wait for more.
    if (versionGte(data.protocolVersion, 3, 0, 0)) {
      throw new Error(`v3 handshake misread as legacy: ${data.protocolVersion}`);
    }
    return true;
  });
}

// --- Generic (peek header) ---------------------------------------------------

/** Read just the header so the caller can route by requestId / errorCode. */
export function parseGeneric(buffer: Buffer, watchPacketLength: boolean): ParseResult<CommonResponse> {
  return run<CommonResponse>(buffer, watchPacketLength ? 12 : 8, (r, data) => {
    if (watchPacketLength) {
      readCommonResponse(r, data, true);
      // consume the whole (possibly unknown) packet
      (data as { packetLength?: number }).packetLength = data.packetLength;
    } else {
      data.packetLength = 8;
      data.requestId = r.u32();
      data.errorCode = r.u32();
    }
    return true;
  });
}

// --- Threads -----------------------------------------------------------------

export interface ThreadInfo {
  isPrimary: boolean;
  isDetached: boolean;
  stopReason: string;
  stopReasonDetail: string;
  lineNumber: number;
  functionName: string;
  filePath: string;
  codeSnippet: string;
  osThreadId?: string;
  name?: string;
  type?: string;
}

export function parseThreads(buffer: Buffer, watchPacketLength: boolean): ParseResult<{ threads: ThreadInfo[] } & CommonResponse> {
  return run<{ threads: ThreadInfo[] } & CommonResponse>(buffer, watchPacketLength ? 16 : 12, (r, data) => {
    readCommonResponse(r, data, watchPacketLength);
    const count = r.u32();
    const threads: ThreadInfo[] = [];
    for (let i = 0; i < count; i++) {
      const flags = r.u8();
      const isPrimary = (flags & 1) > 0;
      const isDetached = (flags & 2) > 0;
      const includesIdentity = (flags & 4) > 0;
      const stopReason = StopReasonName[r.u32()] ?? 'Undefined';
      const stopReasonDetail = r.stringNT();
      const lineNumber = r.u32();
      const functionName = r.stringNT();
      const filePath = r.stringNT();
      const codeSnippet = r.stringNT();
      const thread: ThreadInfo = { isPrimary, isDetached, stopReason, stopReasonDetail, lineNumber, functionName, filePath, codeSnippet };
      if (includesIdentity) {
        thread.osThreadId = r.stringNT();
        thread.name = r.stringNT();
        thread.type = r.stringNT();
      }
      threads.push(thread);
    }
    (data as { threads: ThreadInfo[] }).threads = threads;
    return threads.length === count;
  });
}

// --- Stack trace (v3) --------------------------------------------------------

export interface StackEntry {
  lineNumber: number;
  functionName: string;
  filePath: string;
}

export function parseStackTrace(buffer: Buffer, watchPacketLength: boolean): ParseResult<{ entries: StackEntry[] } & CommonResponse> {
  return run<{ entries: StackEntry[] } & CommonResponse>(buffer, watchPacketLength ? 16 : 12, (r, data) => {
    readCommonResponse(r, data, watchPacketLength);
    const count = r.u32();
    const entries: StackEntry[] = [];
    for (let i = 0; i < count; i++) {
      const lineNumber = r.u32();
      const functionName = r.stringNT();
      const filePath = r.stringNT();
      entries.push({ lineNumber, functionName, filePath });
    }
    (data as { entries: StackEntry[] }).entries = entries;
    return entries.length === count;
  });
}

// --- Variables ---------------------------------------------------------------

export interface VariableInfo {
  name?: string;
  type: string;
  value?: unknown;
  isConst: boolean;
  isContainer: boolean;
  isVirtual: boolean;
  refCount: number;
  keyType?: string;
  childCount?: number;
  children?: VariableInfo[];
}

function readVariableValue(typeName: string, r: BufReader): unknown {
  switch (typeName) {
    case 'Interface':
    case 'Object':
    case 'String':
    case 'Subroutine':
    case 'Function':
      return r.stringNT();
    case 'SubtypedObject':
      return [r.stringNT(), r.stringNT()].join('; ');
    case 'Boolean':
      return r.u8() > 0;
    case 'Integer':
      return r.i32();
    case 'LongInteger':
      // A 64-bit int isn't JSON-serializable; stringify so the IPC payload survives.
      return r.i64().toString();
    case 'Float':
      return r.f32();
    case 'Double':
      return r.f64();
    default:
      // Uninitialized / Unknown / Invalid / AssociativeArray / Array / List
      return null;
  }
}

function readVariable(r: BufReader): VariableInfo & { __isChildKey: boolean } {
  const flags = r.u8();
  const isChildKey = (flags & VariableFlags.isChildKey) > 0;
  const isConst = (flags & VariableFlags.isConst) > 0;
  const isContainer = (flags & VariableFlags.isContainer) > 0;
  const isNameHere = (flags & VariableFlags.isNameHere) > 0;
  const isRefCounted = (flags & VariableFlags.isRefCounted) > 0;
  const isValueHere = (flags & VariableFlags.isValueHere) > 0;
  const isVirtual = (flags & VariableFlags.isVirtual) > 0;
  const type = VariableTypeName[r.u8()] ?? 'Unknown';
  const variable: VariableInfo & { __isChildKey: boolean } = {
    __isChildKey: isChildKey,
    type,
    isConst,
    isContainer,
    isVirtual,
    refCount: 0
  };
  if (isNameHere) variable.name = r.stringNT();
  variable.refCount = isRefCounted ? r.u32() : 0;
  if (isContainer) {
    variable.keyType = VariableTypeName[r.u8()] ?? 'Unknown';
    variable.childCount = r.u32();
  }
  if (isValueHere) variable.value = readVariableValue(type, r);
  return variable;
}

export function parseVariables(buffer: Buffer, watchPacketLength: boolean): ParseResult<{ variables: VariableInfo[] } & CommonResponse> {
  return run<{ variables: VariableInfo[] } & CommonResponse>(buffer, 12, (r, data) => {
    readCommonResponse(r, data, watchPacketLength);
    const num = r.u32();
    const variables: VariableInfo[] = [];
    let latestContainer: VariableInfo | undefined;
    let count = 0;
    for (let i = 0; i < num; i++) {
      const v = readVariable(r);
      count++;
      const isChildKey = v.__isChildKey;
      delete (v as { __isChildKey?: boolean }).__isChildKey;
      if (!isChildKey) {
        // A requested (root) variable. Its children (if any) follow inline.
        delete v.childCount;
        v.children = [];
        latestContainer = v;
        variables.push(v);
      } else if (latestContainer) {
        latestContainer.children!.push(v);
      } else {
        variables.push(v);
      }
    }
    (data as { variables: VariableInfo[] }).variables = variables;
    return count === num;
  });
}

// --- Execute (v3) ------------------------------------------------------------

export interface ExecuteData extends CommonResponse {
  executeSuccess: boolean;
  runtimeStopCode: number;
  compileErrors: string[];
  runtimeErrors: string[];
  otherErrors: string[];
}

function readStringList(r: BufReader): string[] {
  const n = r.u32();
  const list: string[] = [];
  for (let i = 0; i < n; i++) list.push(r.stringNT());
  return list;
}

export function parseExecute(buffer: Buffer, watchPacketLength: boolean): ParseResult<ExecuteData> {
  return run<ExecuteData>(buffer, watchPacketLength ? 12 : 8, (r, data) => {
    readCommonResponse(r, data, watchPacketLength);
    data.executeSuccess = r.u8() !== 0;
    data.runtimeStopCode = r.u8();
    data.compileErrors = readStringList(r);
    data.runtimeErrors = readStringList(r);
    data.otherErrors = readStringList(r);
    return true;
  });
}

// --- Breakpoints (list / add / remove share one layout) ----------------------

export interface BreakpointResult {
  id: number;
  breakpointId: number;
  errorCode: number;
  ignoreCount?: number;
}

export function parseBreakpoints(buffer: Buffer, watchPacketLength: boolean): ParseResult<{ breakpoints: BreakpointResult[] } & CommonResponse> {
  return run<{ breakpoints: BreakpointResult[] } & CommonResponse>(buffer, watchPacketLength ? 12 : 8, (r, data) => {
    readCommonResponse(r, data, watchPacketLength);
    const num = r.u32();
    const breakpoints: BreakpointResult[] = [];
    for (let i = 0; i < num; i++) {
      const id = r.u32();
      const errorCode = r.u32();
      const bp: BreakpointResult = { id, breakpointId: id, errorCode };
      if (id > 0) bp.ignoreCount = r.u32();
      breakpoints.push(bp);
    }
    (data as { breakpoints: BreakpointResult[] }).breakpoints = breakpoints;
    return breakpoints.length === num;
  });
}

// --- Updates -----------------------------------------------------------------

export interface UpdateData {
  packetLength?: number;
  requestId: number;
  errorCode: number;
  updateType: string;
  [key: string]: unknown;
}

export function parseUpdate(buffer: Buffer, watchPacketLength: boolean): ParseResult<UpdateData> {
  return run<UpdateData>(buffer, watchPacketLength ? 16 : 12, (r, data) => {
    if (watchPacketLength) data.packetLength = r.u32();
    data.requestId = r.u32();
    data.errorCode = r.u32();
    data.updateType = UpdateTypeCode[r.u32()] ?? 'Undefined';

    switch (data.updateType) {
      case 'AllThreadsStopped':
      case 'ThreadAttached': {
        data.threadIndex = r.i32();
        data.stopReason = StopReasonName[r.u8()] ?? 'Undefined';
        data.stopReasonDetail = r.stringNT();
        break;
      }
      case 'IOPortOpened': {
        data.port = r.i32();
        break;
      }
      case 'CompileError': {
        data.flags = r.u32();
        data.errorMessage = r.stringNT();
        data.filePath = r.stringNT();
        data.lineNumber = r.u32();
        data.libraryName = r.stringNT();
        break;
      }
      case 'BreakpointError': {
        r.u32(); // flags (reserved)
        data.breakpointId = r.u32();
        data.compileErrors = readStringList(r);
        data.runtimeErrors = readStringList(r);
        data.otherErrors = readStringList(r);
        break;
      }
      case 'BreakpointVerified': {
        r.u32(); // flags (reserved)
        const n = r.u32();
        const breakpoints: { id: number; breakpointId: number }[] = [];
        for (let i = 0; i < n; i++) {
          const id = r.u32();
          breakpoints.push({ id, breakpointId: id });
        }
        data.breakpoints = breakpoints;
        break;
      }
      default:
        // ProtocolError / ExceptionBreakpointError / Undefined: header only; the
        // packet_length (v3) lets us skip the unknown remainder cleanly.
        break;
    }
    return true;
  });
}
