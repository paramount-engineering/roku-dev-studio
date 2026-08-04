/**
 * Detects whether a system Java runtime is available — `sca-cmd` needs one, and RDS never
 * attempts to install it (same "detect, guide the user, never auto-install" stance as the Npcap
 * check for Network Inspector's packet capture on Windows). No minimum version is enforced here:
 * Roku doesn't publish one, so an incompatible Java is instead surfaced reactively from a run's
 * own stderr (`UnsupportedClassVersionError`) rather than guessed at preflight.
 */

import { execFile } from 'child_process';
import type { JavaStatus } from '../../shared/ipc/payloads';

/** `java -version` prints its banner to stderr on every JVM (Oracle, OpenJDK, Temurin, Zulu,
 *  Corretto) — read stderr first, stdout as a fallback. */
export function checkJavaAvailable(): Promise<JavaStatus> {
  return new Promise((resolve) => {
    execFile('java', ['-version'], { timeout: 5000, windowsHide: true }, (err, stdout, stderr) => {
      const text = (stderr || stdout || '').toString();
      if (err) {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          resolve({ available: false, error: { code: 'java-not-found', message: 'Java runtime not found on PATH.' } });
          return;
        }
        resolve({ available: false, error: { code: 'java-check-failed', message: err.message } });
        return;
      }
      resolve({ available: true, versionString: text.split('\n')[0]?.trim(), majorVersion: parseJavaMajorVersion(text) });
    });
  });
}

/** Handles both legacy "1.8.0_301" (major = 2nd field) and modern "17.0.2" / "21" (major = 1st field). */
export function parseJavaMajorVersion(text: string): number | undefined {
  const m = /version\s+"?(\d+)(?:\.(\d+))?/i.exec(text);
  if (!m) return undefined;
  const first = parseInt(m[1]!, 10);
  return first === 1 && m[2] ? parseInt(m[2], 10) : first;
}
