/**
 * BrightScript Debug Protocol — wire constants.
 *
 * In-house reimplementation of RokuCommunity `roku-debug`'s protocol enums so
 * RDS owns the whole debug stack (no `roku-debug` / `smart-buffer` runtime dep).
 * Values are the on-the-wire integers defined by Roku's socket-based debugger
 * (https://developer.roku.com/dev/docs/socket-based-debugger). Do not renumber.
 */

/** 64-bit handshake magic, little-endian `b'bsdebug\0'`. Sent by the client and echoed by the device. */
export const DEBUGGER_MAGIC = 'bsdebug';

/** Control port for the debug protocol. */
export const DEBUG_CONTROL_PORT = 8081;

/** Client→device command codes (the `command_code` field of a request). */
export enum CommandCode {
  Stop = 1,
  Continue = 2,
  Threads = 3,
  StackTrace = 4,
  Variables = 5,
  Step = 6,
  AddBreakpoints = 7,
  ListBreakpoints = 8,
  RemoveBreakpoints = 9,
  Execute = 10,
  AddConditionalBreakpoints = 11,
  SetExceptionBreakpoints = 12,
  ExitChannel = 122
}

/** Step granularity (the `step_type` field of a STEP request). */
export enum StepTypeCode {
  None = 0,
  Line = 1,
  Out = 2,
  Over = 3
}

/** `error_code` in every response header. */
export enum ErrorCode {
  OK = 0,
  OTHER_ERR = 1,
  UNDEFINED_COMMAND = 2,
  CANT_CONTINUE = 3,
  NOT_STOPPED = 4,
  INVALID_ARGS = 5,
  THREAD_DETACHED = 6,
  EXECUTION_TIMEOUT = 7
}

/** Bitfield in the optional error-data section of a response header. */
export enum ErrorFlags {
  INVALID_VALUE_IN_PATH = 1,
  MISSING_KEY_IN_PATH = 2
}

/** Why a thread stopped (in AllThreadsStopped / ThreadAttached updates). */
export enum StopReasonCode {
  Undefined = 0,
  NotStopped = 1,
  NormalExit = 2,
  StopStatement = 3,
  Break = 4,
  RuntimeError = 5,
  CaughtRuntimeError = 6
}

export const StopReasonName: Record<number, string> = {
  [StopReasonCode.Undefined]: 'Undefined',
  [StopReasonCode.NotStopped]: 'NotStopped',
  [StopReasonCode.NormalExit]: 'NormalExit',
  [StopReasonCode.StopStatement]: 'StopStatement',
  [StopReasonCode.Break]: 'Break',
  [StopReasonCode.RuntimeError]: 'RuntimeError',
  [StopReasonCode.CaughtRuntimeError]: 'CaughtRuntimeError'
};

/** Unsolicited server→client message kinds (request_id === 0). */
export enum UpdateTypeCode {
  Undefined = 0,
  IOPortOpened = 1,
  AllThreadsStopped = 2,
  ThreadAttached = 3,
  BreakpointError = 4,
  CompileError = 5,
  BreakpointVerified = 6,
  ProtocolError = 7,
  ExceptionBreakpointError = 8
}

/** Per-variable flags byte in a VARIABLES response. */
export enum VariableFlags {
  isChildKey = 1,
  isConst = 2,
  isContainer = 4,
  isNameHere = 8,
  isRefCounted = 16,
  isValueHere = 32,
  isKeysCaseSensitive = 64,
  isVirtual = 128
}

/** BrightScript value types (the `variable_type` / `key_type` byte). */
export enum VariableTypeCode {
  AssociativeArray = 1,
  Array = 2,
  Boolean = 3,
  Double = 4,
  Float = 5,
  Function = 6,
  Integer = 7,
  Interface = 8,
  Invalid = 9,
  List = 10,
  LongInteger = 11,
  Object = 12,
  String = 13,
  Subroutine = 14,
  SubtypedObject = 15,
  Uninitialized = 16,
  Unknown = 17
}

/** String names for VariableTypeCode, matching roku-debug's `VariableType`. */
export const VariableTypeName: Record<number, string> = {
  [VariableTypeCode.AssociativeArray]: 'AssociativeArray',
  [VariableTypeCode.Array]: 'Array',
  [VariableTypeCode.Boolean]: 'Boolean',
  [VariableTypeCode.Double]: 'Double',
  [VariableTypeCode.Float]: 'Float',
  [VariableTypeCode.Function]: 'Function',
  [VariableTypeCode.Integer]: 'Integer',
  [VariableTypeCode.Interface]: 'Interface',
  [VariableTypeCode.Invalid]: 'Invalid',
  [VariableTypeCode.List]: 'List',
  [VariableTypeCode.LongInteger]: 'LongInteger',
  [VariableTypeCode.Object]: 'Object',
  [VariableTypeCode.String]: 'String',
  [VariableTypeCode.Subroutine]: 'Subroutine',
  [VariableTypeCode.SubtypedObject]: 'SubtypedObject',
  [VariableTypeCode.Uninitialized]: 'Uninitialized',
  [VariableTypeCode.Unknown]: 'Unknown'
};
