/**
 * IPC handlers for the Static Channel Analysis window — thin glue that delegates to the pure
 * `main/static-analysis/*` modules (same separation as `bs-fiddle-handlers.ts` delegating to
 * `roku-dev-studio-api`). No business logic lives here.
 */

import type { App, IpcMain, IpcMainInvokeEvent } from 'electron';
import { IPC } from '../../shared/ipc/channels';
import type {
  ScaCategory,
  ScaSeverity,
  ScaToolStatus,
  StaticAnalysisCancelRunPayload,
  StaticAnalysisRunPayload
} from '../../shared/ipc/payloads';
import { ensureScaToolReady, getScaLauncherPathSync } from '../static-analysis/sca-tool-manager';
import { checkJavaAvailable } from '../static-analysis/java-detect';
import { startScaRun, cancelScaRun } from '../static-analysis/sca-runner';
import { broadcastStaticAnalysis } from '../static-analysis-window';
import { S } from '../../shared/strings/index';
import { mainWarn } from '../log.js';

const { BrowserWindow, dialog } = require('electron') as typeof import('electron');

let registered = false;

export function registerStaticAnalysisIpc(ipcMain: IpcMain, app: App): void {
  if (registered) return;
  registered = true;

  ipcMain.handle(
    IPC.StaticAnalysisEnsureTool,
    async (_event: IpcMainInvokeEvent, payload: { force?: boolean } = {}): Promise<ScaToolStatus> =>
      ensureScaToolReady(app, {
        force: !!payload?.force,
        onStatus: (status) => broadcastStaticAnalysis(IPC.StaticAnalysisToolStatus, status)
      })
  );

  ipcMain.handle(IPC.StaticAnalysisCheckJava, async () => checkJavaAvailable());

  ipcMain.handle(
    IPC.StaticAnalysisChooseFile,
    async (event: IpcMainInvokeEvent): Promise<{ success: boolean; canceled?: boolean; path?: string; error?: string }> => {
      const win = BrowserWindow.fromWebContents(event.sender);
      const dialogOptions: Electron.OpenDialogOptions = {
        title: S.staticAnalysis.chooseFileDialogTitle,
        properties: ['openFile'],
        filters: [
          { name: S.staticAnalysis.filterChannelZip, extensions: ['zip'] },
          { name: S.menu.filterAllFiles, extensions: ['*'] }
        ]
      };
      try {
        const res = win ? await dialog.showOpenDialog(win, dialogOptions) : await dialog.showOpenDialog(dialogOptions);
        if (res.canceled || !res.filePaths?.length) return { success: true, canceled: true };
        return { success: true, path: res.filePaths[0] };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    IPC.StaticAnalysisRun,
    (event: IpcMainInvokeEvent, payload: StaticAnalysisRunPayload): { success: boolean; runId?: string; error?: string } => {
      const launcherPath = getScaLauncherPathSync(app);
      if (!launcherPath) {
        return { success: false, error: 'tool-not-ready' };
      }
      const inputPath = typeof payload?.inputPath === 'string' ? payload.inputPath : '';
      if (!inputPath) {
        return { success: false, error: 'invalid-input-path' };
      }
      const sender = event.sender;
      return startScaRun({
        app,
        launcherPath,
        inputPath,
        severity: payload?.severity as ScaSeverity | undefined,
        categories: payload?.categories as ScaCategory[] | undefined,
        senderId: sender.id,
        emit: (channel, data) => {
          if (sender.isDestroyed()) return;
          sender.send(channel === 'progress' ? IPC.StaticAnalysisProgress : IPC.StaticAnalysisRunResult, data);
        }
      });
    }
  );

  ipcMain.handle(IPC.StaticAnalysisCancelRun, (_event: IpcMainInvokeEvent, payload: StaticAnalysisCancelRunPayload) => {
    const ok = cancelScaRun(payload?.runId ?? '');
    if (!ok) mainWarn('[StaticAnalysis] cancel requested for unknown/finished run:', payload?.runId);
    return { success: ok };
  });
}
