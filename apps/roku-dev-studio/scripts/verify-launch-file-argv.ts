#!/usr/bin/env npx tsx
/**
 * Regression guard for main/launch-file-argv.ts — the helpers behind the
 * "Open With" file-association feature for the Log Viewer AND the Network
 * Session Viewer (Windows/Linux cold launch via argv, and the
 * `second-instance` relay when the app is already running).
 *
 * The Network Session Viewer's native export uses a compound extension
 * (`rds-network-inspector.json`) specifically so it doesn't also match every
 * unrelated `.json` file on the system — this checks that distinction holds.
 *
 * Run from apps/roku-dev-studio: npx tsx scripts/verify-launch-file-argv.ts
 */
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  extractFilePathFromArgv,
  fileMatchesSuffixes,
  LOG_VIEWER_ASSOCIATED_EXTENSIONS,
  NETWORK_SESSION_ASSOCIATED_EXTENSIONS
} from '../main/launch-file-argv';

function main() {
  const dir = mkdtempSync(join(tmpdir(), 'verify-launch-file-argv-'));
  const logPath = join(dir, 'roku-console-logs.txt');
  const sessionPath = join(dir, 'capture.rds-network-inspector.json');
  const plainJsonPath = join(dir, 'package.json');
  const rtfPath = join(dir, 'doc.rtf');
  writeFileSync(logPath, 'hello\n');
  writeFileSync(sessionPath, '{}');
  writeFileSync(plainJsonPath, '{}');
  writeFileSync(rtfPath, 'not indexed by design\n');

  let failed = false;
  const check = (name: string, actual: unknown, expected: unknown): void => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    console.log(`${ok ? 'ok  ' : 'FAIL'} — ${name} → ${JSON.stringify(actual)}`);
    if (!ok) {
      console.error(`     expected ${JSON.stringify(expected)}`);
      failed = true;
    }
  };

  try {
    // extractFilePathFromArgv — log-viewer extensions
    check(
      'log: packaged launch [exe, file]',
      extractFilePathFromArgv(['/exe', logPath], LOG_VIEWER_ASSOCIATED_EXTENSIONS),
      logPath
    );
    check(
      'log: argv[0] itself matches but must be skipped',
      extractFilePathFromArgv([logPath], LOG_VIEWER_ASSOCIATED_EXTENSIONS),
      null
    );
    check(
      'log: unregistered extension (.rtf) is ignored',
      extractFilePathFromArgv(['/exe', rtfPath], LOG_VIEWER_ASSOCIATED_EXTENSIONS),
      null
    );
    check(
      'log: nonexistent path is ignored',
      extractFilePathFromArgv(['/exe', join(dir, 'missing.log')], LOG_VIEWER_ASSOCIATED_EXTENSIONS),
      null
    );
    check('log: empty argv', extractFilePathFromArgv([], LOG_VIEWER_ASSOCIATED_EXTENSIONS), null);

    // extractFilePathFromArgv — network-session extensions (the compound-extension case)
    check(
      'network session: compound extension matches',
      extractFilePathFromArgv(['/exe', sessionPath], NETWORK_SESSION_ASSOCIATED_EXTENSIONS),
      sessionPath
    );
    check(
      'network session: a LOG-registered file is not matched here',
      extractFilePathFromArgv(['/exe', logPath], NETWORK_SESSION_ASSOCIATED_EXTENSIONS),
      null
    );

    // fileMatchesSuffixes — the compound-extension / bare-.json distinction
    check(
      'fileMatchesSuffixes: compound session extension matches its own list',
      fileMatchesSuffixes(sessionPath, NETWORK_SESSION_ASSOCIATED_EXTENSIONS),
      true
    );
    check(
      'fileMatchesSuffixes: a plain .json file must NOT match (avoids claiming every .json on the system)',
      fileMatchesSuffixes(plainJsonPath, NETWORK_SESSION_ASSOCIATED_EXTENSIONS),
      false
    );
    check(
      'fileMatchesSuffixes: log extensions and network extensions do not cross-match',
      fileMatchesSuffixes(logPath, NETWORK_SESSION_ASSOCIATED_EXTENSIONS),
      false
    );

    if (failed) {
      console.error('FAIL: one or more cases did not match.');
      process.exit(1);
    }
    console.log('OK: launch-file-argv helpers route log/network-session files correctly.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main();
