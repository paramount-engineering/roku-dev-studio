/**
 * Scan a sideloaded channel .zip for BrightScript `STOP` statements so the
 * debugger's Breakpoints panel can list them BEFORE they're hit.
 *
 * Roku's debug protocol never enumerates breakpoints (they're client-owned), and
 * a `STOP` in code is not a "managed" breakpoint — the device just halts on it.
 * The only way to list them ahead of time is to read the source, which lives in
 * the sideloaded .zip (`source/**.brs`, `components/**.brs`). We keep the last
 * debug-sideloaded zip path per device IP and re-scan on demand.
 */
const AdmZip = require('adm-zip');
const fs = require('fs');
import { mainError } from '../log.js';

export interface ScannedStop {
  /** `pkg:/…` path (matches the debug protocol's file_spec). */
  path: string;
  /** 1-based line number. */
  line: number;
}

/** Last debug-sideloaded local .zip path, per device IP. */
const lastZipByIp = new Map<string, string>();

export function rememberSideloadZip(ip: string, zipPath: string): void {
  if (ip && zipPath) lastZipByIp.set(ip, zipPath);
}

/** The last debug-sideloaded local .zip path for a device (used by Restart), or undefined. */
export function getRememberedZip(ip: string): string | undefined {
  return lastZipByIp.get(ip);
}

/** Scanned STOPs for a device's most recent debug sideload ([] if unknown / file gone). */
export function getScannedStops(ip: string): ScannedStop[] {
  const zip = lastZipByIp.get(ip);
  if (!zip) return [];
  try {
    if (!fs.existsSync(zip)) return [];
  } catch {
    return [];
  }
  return scanZipForStops(zip);
}

/** Read every `.brs`/`.bs` entry in the zip and collect lines that are a bare `STOP` statement. */
export function scanZipForStops(zipPath: string): ScannedStop[] {
  const out: ScannedStop[] = [];
  let zip: { getEntries: () => Array<{ entryName: string; isDirectory: boolean; getData: () => Buffer }> };
  try {
    zip = new AdmZip(zipPath);
  } catch (e) {
    mainError('[debugger] STOP scan: cannot open zip', zipPath, e instanceof Error ? e.message : String(e));
    return out;
  }
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const name = entry.entryName.replace(/\\/g, '/');
    if (!/\.(brs|bs)$/i.test(name)) continue;
    let text: string;
    try {
      text = entry.getData().toString('utf8');
    } catch {
      continue;
    }
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (lineHasStopStatement(lines[i])) {
        out.push({ path: `pkg:/${name.replace(/^\/+/, '')}`, line: i + 1 });
      }
    }
  }
  return out;
}

/**
 * True if the line contains a bare `STOP` statement. Strips string literals and
 * `'` comments, splits on `:` (BrightScript statement separator), and matches a
 * segment that is exactly `stop` — so `stopwatch`, `.stop()`, `print "stop"`, and
 * `' stop here` never false-positive.
 */
function lineHasStopStatement(raw: string): boolean {
  const code = stripStringsAndComment(raw);
  for (const part of code.split(':')) {
    if (part.trim().toLowerCase() === 'stop') return true;
  }
  return false;
}

/** Blank out `"…"` string contents and cut at the first unquoted `'` (comment). */
function stripStringsAndComment(line: string): string {
  let inStr = false;
  let res = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inStr = !inStr;
      res += ' ';
      continue;
    }
    if (!inStr && c === "'") break; // rest of line is a comment
    res += inStr ? ' ' : c;
  }
  return res;
}
