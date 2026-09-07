import { shouldShowModalFor, type AppInfo, type CapturedError } from './crash-report.js';
import { showCrashReportModal } from './crash-report-modal.js';

export type CrashCaptureOptions = {
  windowName: string;
  getSetting: (key: string) => Promise<{ success: boolean; value?: unknown }>;
  getAppInfo: () => Promise<AppInfo>;
  openExternal: (url: string) => unknown;
  /** Main window only — forwards uncaught errors from the main process. */
  onMainProcessError?: (
    callback: (payload: { message: string; stack: string; timestamp: number }) => void
  ) => () => void;
};

/** Installs uncaught-error/rejection capture for one window. Call once at startup. */
export function installCrashCapture(options: CrashCaptureOptions): void {
  let enabled = true;
  let appInfo: AppInfo | null = null;

  options
    .getSetting('crashReportingEnabled')
    .then((res) => {
      if (res?.success && typeof res.value === 'boolean') enabled = res.value;
    })
    .catch(() => {});

  options
    .getAppInfo()
    .then((info) => {
      appInfo = info;
    })
    .catch(() => {});

  function handle(err: CapturedError): void {
    if (!enabled) return;
    if (!shouldShowModalFor(err)) return;
    showCrashReportModal(err, appInfo, (url) => options.openExternal(url));
  }

  window.addEventListener('error', (event: ErrorEvent) => {
    const errorStack = event.error instanceof Error ? event.error.stack : undefined;
    handle({
      message: event.error instanceof Error ? event.error.message : event.message || 'Unknown error',
      stack: errorStack || `${event.message}\n  at ${event.filename}:${event.lineno}:${event.colno}`,
      source: 'renderer',
      windowName: options.windowName,
      timestamp: Date.now()
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    handle({
      message,
      stack: reason instanceof Error && reason.stack ? reason.stack : message,
      source: 'renderer',
      windowName: options.windowName,
      timestamp: Date.now()
    });
  });

  if (options.onMainProcessError) {
    options.onMainProcessError((payload) => {
      handle({
        message: payload.message,
        stack: payload.stack,
        source: 'main',
        windowName: options.windowName,
        timestamp: payload.timestamp
      });
    });
  }
}
