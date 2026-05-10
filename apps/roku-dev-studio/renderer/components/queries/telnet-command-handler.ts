// Telnet command handler (plugins, free, etc.)

import { escapeHtml } from '../../modules/utils/index.js';
import {
  processTelnetSystemCommandOutput,
  runTelnetSystemCommandSession
} from '../../modules/utils/telnet-system-command-run.js';
import type { OutputArea } from '../../modules/ui/output-area.js';

export function setupTelnetCommands(
  panel: HTMLElement,
  api: QueriesDeviceApi,
  outputArea: OutputArea,
  removePluginSection: HTMLElement | null
): void {
  panel.querySelectorAll('.telnet-cmd-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const command = (btn as HTMLElement).dataset.telnetCmd;
      if (!command) return;

      (btn as HTMLButtonElement).disabled = true;
      const iconElement = btn.querySelector('.icon');
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

      outputArea.display('<span style="color: var(--accent-yellow);">Connecting to telnet (port 8080)...</span>', true);

      try {
        await api.telnetSystemDisconnect();
        await new Promise((resolve) => setTimeout(resolve, 200));

        const connectResult = await api.telnetSystemConnect();
        if (!connectResult.success) {
          const errorContent = `Error: Failed to connect to telnet (port 8080): ${connectResult.error}`;
          outputArea.display(
            `<span style="color: var(--accent-red);">Error: ${escapeHtml(connectResult.error || '')}</span>`,
            true
          );
          outputArea.originalContent = errorContent;
          (btn as HTMLButtonElement).disabled = false;
          if (iconElement) {
            iconElement.classList.remove('icon-loading');
          }
          return;
        }

        outputArea.display('<span style="color: var(--accent-yellow);">Connected. Setting up listener...</span>', true);

        const session = await runTelnetSystemCommandSession(api, command, {
          onStatus: (msg) =>
            outputArea.display(
              `<span style="color: var(--accent-yellow);">${escapeHtml(msg)}</span>`,
              true
            )
        });
        if (!session.ok) {
          const errorContent = `Error: ${session.error}`;
          outputArea.display(
            `<span style="color: var(--accent-red);">Error: ${escapeHtml(session.error)}</span>`,
            true
          );
          outputArea.originalContent = errorContent;
          (btn as HTMLButtonElement).disabled = false;
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
          console.warn('[Telnet] Output was empty after processing, showing raw data');
          outputArea.originalContent = output;
          outputArea.display(
            `<pre style="margin: 0; white-space: pre; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #e0e0e0; line-height: 1.5; overflow-x: auto;">${escapeHtml(output)}</pre>`,
            true
          );
        } else {
          outputArea.originalContent = 'No output received';
          outputArea.display(
            `<div style="color: var(--accent-yellow);">
            <p>No output received from command.</p>
          </div>`,
            true
          );
        }

        checkOutputExpansion(outputArea.container);
      } catch (error: unknown) {
        await api.telnetSystemDisconnect().catch(() => {});
        const msg = error instanceof Error ? error.message : String(error);
        const errorContent = `Error: ${msg}`;
        outputArea.display(`<span style="color: var(--accent-red);">Error: ${escapeHtml(msg)}</span>`, true);
        outputArea.originalContent = errorContent;
      }

      (btn as HTMLButtonElement).disabled = false;
      if (iconElement) {
        iconElement.classList.remove('icon-loading');
      }
    });
  });
}

function checkOutputExpansion(queryOutput: HTMLElement | null) {
  if (!queryOutput) return;
  if (queryOutput.scrollHeight > 200) {
    queryOutput.classList.add('expanded');
  } else {
    queryOutput.classList.remove('expanded');
  }
}
