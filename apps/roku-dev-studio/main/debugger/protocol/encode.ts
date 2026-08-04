/**
 * BrightScript Debug Protocol — request encoders (client → device).
 *
 * Each builder returns the fully-framed packet: a 12-byte header
 * (packet_length, request_id, command_code — all uint32LE) followed by the
 * command body. Mirrors roku-debug's `insertCommonRequestFields`.
 */
import { BufWriter } from './buffer';
import { CommandCode, DEBUGGER_MAGIC, StepTypeCode } from './constants';

/** Prepend the common request header and finalize the packet. */
function frame(command: CommandCode, requestId: number, body: BufWriter): Buffer {
  const bodyBuf = body.toBuffer();
  const packetLength = bodyBuf.length + 12;
  return new BufWriter().u32(packetLength).u32(requestId).u32(command).raw(bodyBuf).toBuffer();
}

/** The handshake is special: just the NUL-terminated magic, no header. */
export function encodeHandshake(): Buffer {
  return new BufWriter().stringNT(DEBUGGER_MAGIC).toBuffer();
}

export function encodeContinue(requestId: number): Buffer {
  return frame(CommandCode.Continue, requestId, new BufWriter());
}

export function encodeStop(requestId: number): Buffer {
  return frame(CommandCode.Stop, requestId, new BufWriter());
}

export function encodeExitChannel(requestId: number): Buffer {
  return frame(CommandCode.ExitChannel, requestId, new BufWriter());
}

export function encodeListBreakpoints(requestId: number): Buffer {
  return frame(CommandCode.ListBreakpoints, requestId, new BufWriter());
}

export function encodeStep(requestId: number, threadIndex: number, stepType: StepTypeCode): Buffer {
  const body = new BufWriter().u32(threadIndex).u8(stepType);
  return frame(CommandCode.Step, requestId, body);
}

/** THREADS. We omit the identity-info flag for broad firmware compatibility. */
export function encodeThreads(requestId: number): Buffer {
  return frame(CommandCode.Threads, requestId, new BufWriter());
}

export function encodeStackTrace(requestId: number, threadIndex: number): Buffer {
  return frame(CommandCode.StackTrace, requestId, new BufWriter().u32(threadIndex));
}

export function encodeExecute(
  requestId: number,
  threadIndex: number,
  stackFrameIndex: number,
  sourceCode: string
): Buffer {
  const body = new BufWriter().u32(threadIndex).u32(stackFrameIndex).stringNT(sourceCode);
  return frame(CommandCode.Execute, requestId, body);
}

export function encodeRemoveBreakpoints(requestId: number, breakpointIds: number[]): Buffer {
  const ids = (breakpointIds ?? []).filter((x) => typeof x === 'number');
  const body = new BufWriter().u32(ids.length);
  for (const id of ids) body.u32(id);
  return frame(CommandCode.RemoveBreakpoints, requestId, body);
}

export interface BreakpointSpec {
  filePath: string;
  lineNumber: number;
  ignoreCount?: number;
  conditionalExpression?: string;
}

export function encodeAddBreakpoints(requestId: number, breakpoints: BreakpointSpec[]): Buffer {
  const list = breakpoints ?? [];
  const body = new BufWriter().u32(list.length);
  for (const bp of list) {
    body.stringNT(bp.filePath).u32(bp.lineNumber).u32(bp.ignoreCount ?? 0);
  }
  return frame(CommandCode.AddBreakpoints, requestId, body);
}

export function encodeAddConditionalBreakpoints(requestId: number, breakpoints: BreakpointSpec[]): Buffer {
  const list = breakpoints ?? [];
  const body = new BufWriter().u32(0 /* flags, reserved */).u32(list.length);
  for (const bp of list) {
    body
      .stringNT(bp.filePath)
      .u32(bp.lineNumber)
      .u32(bp.ignoreCount ?? 0)
      .stringNT((bp.conditionalExpression ?? '').trim() || 'true');
  }
  return frame(CommandCode.AddConditionalBreakpoints, requestId, body);
}

/** Bit flags for the VARIABLES request's leading uint8. */
const VAR_FLAG_GET_CHILD_KEYS = 1;
const VAR_FLAG_CASE_SENSITIVITY_OPTIONS = 2;
const VAR_FLAG_GET_VIRTUAL_KEYS = 4;
const VAR_FLAG_VIRTUAL_PATH_INCLUDED = 8;

export interface VariablesRequestOptions {
  threadIndex: number;
  stackFrameIndex: number;
  /** Raw path tokens as the caller supplied them (keys may be quoted for case-sensitivity). */
  variablePath: string[];
  /** True when the negotiated protocol supports per-entry case-insensitivity (>=3.1.0). */
  enableForceCaseInsensitivity: boolean;
  /** True when the negotiated protocol supports virtual variables (>=3.3.0). */
  getVirtualKeys: boolean;
}

/** Normalize a path token the way roku-debug does (strip surrounding quotes / unescape). */
function normalizePathEntry(token: string): { name: string; forceCaseInsensitive: boolean; isVirtual: boolean } {
  const quoted = token.length >= 2 && token.startsWith('"') && token.endsWith('"');
  const name = quoted ? token.slice(1, -1).replace(/""/g, '"') : token.replace(/^"/, '').replace(/"$/, '');
  return {
    name,
    // Unquoted keys are treated case-insensitively; quoted keys stay exact.
    forceCaseInsensitive: !token.startsWith('"') && !token.endsWith('"'),
    isVirtual: token.startsWith('$')
  };
}

export function encodeVariables(requestId: number, opts: VariablesRequestOptions): Buffer {
  const entries = (opts.variablePath ?? []).map(normalizePathEntry);
  const includesVirtualPath = entries.some((e) => e.isVirtual);
  const enableCaseInsensitivity = opts.enableForceCaseInsensitivity && entries.length > 0;

  let flags = VAR_FLAG_GET_CHILD_KEYS;
  if (enableCaseInsensitivity) flags |= VAR_FLAG_CASE_SENSITIVITY_OPTIONS;
  if (opts.getVirtualKeys) flags |= VAR_FLAG_GET_VIRTUAL_KEYS;
  if (includesVirtualPath) flags |= VAR_FLAG_VIRTUAL_PATH_INCLUDED;

  const body = new BufWriter().u8(flags).u32(opts.threadIndex).u32(opts.stackFrameIndex).u32(entries.length);
  for (const e of entries) body.stringNT(e.name);
  if (enableCaseInsensitivity) {
    for (const e of entries) body.u8(e.forceCaseInsensitive ? 1 : 0);
  }
  if (includesVirtualPath) {
    for (const e of entries) body.u8(e.isVirtual ? 1 : 0);
  }
  return frame(CommandCode.Variables, requestId, body);
}
