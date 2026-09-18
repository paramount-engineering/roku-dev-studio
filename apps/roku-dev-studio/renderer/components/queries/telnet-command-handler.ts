// Telnet command handler (plugins, free, etc.)

import { escapeHtml } from '../../modules/utils/index.js';
import { rendererWarn } from '../../modules/utils/logger.js';
import {
  processTelnetSystemCommandOutput,
  runTelnetSystemCommandSession
} from '../../modules/utils/telnet-system-command-run.js';
import type { OutputArea } from '../../modules/ui/output-area.js';
import { S } from '@shared/strings/index.js';

export function setupTelnetCommands(
  panel: HTMLElement,
  api: QueriesDeviceApi,
  outputArea: OutputArea,
  removePluginSection: HTMLElement | null
): { runTelnetCommand: (command: string, btn?: HTMLButtonElement | null) => Promise<void> } {
  /** One 8080 console command → the results area (the preset buttons and the Custom box's
   *  non-path input both land here; a held Ports-window socket is reused by the session runner). */
  async function runTelnetCommand(command: string, btn: HTMLButtonElement | null = null): Promise<void> {
      if (!command) return;

      if (btn) btn.disabled = true;
      const iconElement = btn?.querySelector('.icon') ?? null;
      if (iconElement) {
        iconElement.classList.add('icon-loading');
      }

      if (removePluginSection) {
        if (command === 'plugins') {
          removePluginSection.style.display = 'flex';
        } else {
          removePluginSection.style.display = 'none';
        }
      }

      outputArea.display(`<span style="color: var(--accent-yellow);">${S.queries.connectingToTelnet}</span>`, true);

      try {
        // `runTelnetSystemCommandSession` owns connect → send → disconnect (and reuses the Ports
        // window's socket when it holds 8080) — a pre-connect here would just dial twice per click.
        const session = await runTelnetSystemCommandSession(api, command, {
          onStatus: (msg) =>
            outputArea.display(
              `<span style="color: var(--accent-yellow);">${escapeHtml(msg)}</span>`,
              true
            )
        });
        if (!session.ok) {
          const errorContent = S.queries.errorText(session.error);
          outputArea.display(
            `<span style="color: var(--accent-red);">${S.queries.errorText(escapeHtml(session.error))}</span>`,
            true
          );
          outputArea.originalContent = errorContent;
          if (btn) btn.disabled = false;
          if (iconElement) {
            iconElement.classList.remove('icon-loading');
          }
          return;
        }
        const output = session.raw;

        const processedOutput = processTelnetSystemCommandOutput(output, command);

        outputArea.show();

        if (processedOutput && processedOutput.length > 0) {
          outputArea.originalContent = processedOutput;
          outputArea.display(
            `<pre style="margin: 0; white-space: pre; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #e0e0e0; line-height: 1.5; overflow-x: auto;">${escapeHtml(processedOutput)}</pre>`,
            true
          );
        } else if (output && output.length > 0) {
          rendererWarn('[Telnet] Output was empty after processing, showing raw data');
          outputArea.originalContent = output;
          outputArea.display(
            `<pre style="margin: 0; white-space: pre; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #e0e0e0; line-height: 1.5; overflow-x: auto;">${escapeHtml(output)}</pre>`,
            true
          );
        } else {
          outputArea.originalContent = S.queries.noOutputReceived;
          outputArea.display(
            `<div style="color: var(--accent-yellow);">
            <p>${S.queries.noOutputFromCommand}</p>
          </div>`,
            true
          );
        }

        checkOutputExpansion(outputArea.container);
      } catch (error: unknown) {
        await api.telnetSystemDisconnect().catch(() => {});
        const msg = error instanceof Error ? error.message : String(error);
        const errorContent = S.queries.errorText(msg);
        outputArea.display(`<span style="color: var(--accent-red);">${S.queries.errorText(escapeHtml(msg))}</span>`, true);
        outputArea.originalContent = errorContent;
      }

      if (btn) btn.disabled = false;
      if (iconElement) {
        iconElement.classList.remove('icon-loading');
      }
  }

  panel.querySelectorAll('.telnet-cmd-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const command = (btn as HTMLElement).dataset.telnetCmd;
      if (command) void runTelnetCommand(command, btn as HTMLButtonElement);
    });
  });

  return { runTelnetCommand };
}

function checkOutputExpansion(queryOutput: HTMLElement | null) {
  if (!queryOutput) return;
  if (queryOutput.scrollHeight > 200) {
    queryOutput.classList.add('expanded');
  } else {
    queryOutput.classList.remove('expanded');
  }
}
