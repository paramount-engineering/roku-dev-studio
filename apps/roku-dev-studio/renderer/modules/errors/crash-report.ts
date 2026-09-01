import { S } from '@shared/strings/index.js';
import { redactSensitive } from './redact.js';

const REPO_URL = 'https://github.com/paramount-engineering/roku-dev-studio';
/** Conservative ceiling so the encoded `issues/new` URL stays well under browsers'/GitHub's
 *  practical query-length limits. */
const MAX_URL_LENGTH = 8000;

export type CapturedError = {
  message: string;
  stack: string;
  source: 'renderer' | 'main';
  windowName: string;
  timestamp: number;
};

export type AppInfo = {
  version: string;
  platform: string;
  osRelease: string;
};

const shownSignatures = new Set<string>();

/** True the first time this exact message+stack is seen this session; marks it seen either way.
 *  Keeps a looping error from reopening the modal on every occurrence. */
export function shouldShowModalFor(err: CapturedError): boolean {
  const signature = `${err.message}::${err.stack}`;
  if (shownSignatures.has(signature)) return false;
  shownSignatures.add(signature);
  return true;
}

function errorType(stack: string): string {
  const firstLine = stack.split('\n', 1)[0] ?? '';
  const match = /^([A-Za-z][\w.]*Error)\b/.exec(firstLine);
  return match ? match[1] : 'Error';
}

export function buildIssueTitle(err: CapturedError): string {
  const message = redactSensitive(err.message).slice(0, 80);
  return S.crashReport.issueTitle(errorType(err.stack), message);
}

function environmentLines(err: CapturedError, appInfo: AppInfo | null): string[] {
  return [
    `${S.crashReport.appVersionLabel}: ${appInfo?.version ?? 'unknown'}`,
    `${S.crashReport.platformLabel}: ${`${appInfo?.platform ?? 'unknown'} ${appInfo?.osRelease ?? ''}`.trim()}`,
    `${S.crashReport.windowLabel}: ${err.windowName}`
  ];
}

export function buildIssueBody(err: CapturedError, appInfo: AppInfo | null): string {
  const message = redactSensitive(err.message);
  const stack = redactSensitive(err.stack);

  return [
    `### ${S.crashReport.description}`,
    message,
    '',
    `### ${S.crashReport.errorSection}`,
    '```',
    stack,
    '```',
    '',
    `### ${S.crashReport.environmentSection}`,
    environmentLines(err, appInfo).map((line) => `- ${line}`).join('\n'),
    '',
    `### ${S.crashReport.stepsToReproduce}`,
    `_${S.crashReport.stepsToReproducePlaceholder}_`
  ].join('\n');
}

/** Plain-text (non-markdown) serialization for the default "Copy Crash Info" action. */
export function buildPlainCrashInfo(err: CapturedError, appInfo: AppInfo | null): string {
  const message = redactSensitive(err.message);
  const stack = redactSensitive(err.stack);

  return [
    S.crashReport.title,
    '',
    `${S.crashReport.description}:`,
    message,
    '',
    `${S.crashReport.errorSection}:`,
    stack,
    '',
    `${S.crashReport.environmentSection}:`,
    ...environmentLines(err, appInfo),
    '',
    `${S.crashReport.stepsToReproduce}:`,
    S.crashReport.stepsToReproducePlaceholder
  ].join('\n');
}

export function buildGithubIssueUrl(title: string, body: string): string {
  const encode = (t: string, b: string): string =>
    `${REPO_URL}/issues/new?title=${encodeURIComponent(t)}&body=${encodeURIComponent(b)}`;

  let url = encode(title, body);
  if (url.length <= MAX_URL_LENGTH) return url;

  const truncationMarker = '\n\n…(truncated)';
  const overBy = url.length - MAX_URL_LENGTH + encodeURIComponent(truncationMarker).length;
  const truncatedBody = body.slice(0, Math.max(0, body.length - overBy)) + truncationMarker;
  return encode(title, truncatedBody);
}
