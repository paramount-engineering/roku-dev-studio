/**
 * Scan a sideloaded channel .zip for `function`/`sub` declarations so BrightScript
 * Fiddle can offer them as autocomplete for whatever channel is currently on the
 * selected device.
 *
 * Deliberately separate from `scan-stops.ts`'s `lastZipByIp`: that map is
 * debug-sideload-only and `DebuggerRestart` assumes it always points at a zip
 * that was sideloaded with `remotedebug=1` — repurposing it here for plain
 * sideloads too would break that assumption. This module remembers the last
 * sideloaded zip *of any kind* instead.
 */
const AdmZip = require('adm-zip');
import { apiError } from '../log';
import { stripStringsAndComment } from './scan-stops';

export interface FiddleSymbol {
  name: string;
  kind: 'function' | 'sub';
  params: string[];
  /** `pkg:/…` path. */
  path: string;
  /** 1-based line number. */
  line: number;
}

/** Last sideloaded local .zip path (any sideload, debug or not), per device IP. */
const lastAnyZipByIp = new Map<string, string>();

export function rememberAnySideloadZip(ip: string, zipPath: string): void {
  if (ip && zipPath) lastAnyZipByIp.set(ip, zipPath);
}

/** The last sideloaded local .zip path for a device (any sideload), or undefined. */
export function getAnyRememberedZip(ip: string): string | undefined {
  return lastAnyZipByIp.get(ip);
}

const FUNCTION_DECL = /^\s*(function|sub)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/i;

/** Read every `.brs`/`.bs` entry in the zip and collect `function`/`sub` declarations. */
export function scanZipForSymbols(zipPath: string): FiddleSymbol[] {
  const out: FiddleSymbol[] = [];
  const seen = new Set<string>();
  let zip: { getEntries: () => Array<{ entryName: string; isDirectory: boolean; getData: () => Buffer }> };
  try {
    zip = new AdmZip(zipPath);
  } catch (e) {
    apiError('[fiddle] symbol scan: cannot open zip', zipPath, e instanceof Error ? e.message : String(e));
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
      const match = FUNCTION_DECL.exec(stripStringsAndComment(lines[i]));
      if (!match) continue;
      const [, kind, symbolName, rawParams] = match;
      const key = symbolName.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const params = rawParams
        .split(',')
        .map((p) => p.trim().split(/\s+as\s+/i)[0].trim())
        .filter(Boolean);
      out.push({
        name: symbolName,
        kind: kind.toLowerCase() as 'function' | 'sub',
        params,
        path: `pkg:/${name.replace(/^\/+/, '')}`,
        line: i + 1
      });
    }
  }
  return out;
}
