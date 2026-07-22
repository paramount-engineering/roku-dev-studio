// Remove plugin handler
//
// The telnet-session mechanics (connect, send, wait-for-complete, disconnect)
// live in `modules/utils/telnet-system-command-run.ts`. This file is
// responsible only for the Query tab UI: prompting, rendering the response,
// and deciding success/error coloring.

import { escapeHtml } from '../../modules/utils/index.js';
import {
  runTelnetSystemCommandSession,
  processTelnetSystemCommandOutput
} from '../../modules/utils/telnet-system-command-run.js';
import type { OutputArea } from '../../modules/ui/output-area.js';
import { S } from '@shared/strings/index.js';

/** `remove_plugin` responses are short, so we wrap up faster than the default
 *  Query-tab thresholds that are tuned for verbose commands like `plugins`. */
const REMOVE_PLUGIN_COMPLETE = {
  substantialDataThreshold: 20,
  minDataAfterWait: 5,
  maxDataLength: 500
} as const;

export function setupRemovePlugin(panel: HTMLElement, api: QueriesDeviceApi, outputArea: OutputArea): void {
  const removePluginInput = panel.querySelector<HTMLInputElement>('.remove-plugin-input');
  const removePluginBtn = panel.querySelector<HTMLButtonElement>('.remove-plugin-btn');

  if (!removePluginBtn || !removePluginInput) {
    return;
  }

  removePluginBtn.addEventListener('click', async () => {
    const appId = removePluginInput.value.trim();

    if (!appId) {
      outputArea.display(`<span style="color: var(--accent-yellow);">${S.queries.enterAppId}</span>`, true);
      removePluginInput.focus();
      return;
    }

    if (!confirm(S.queries.confirmRemovePlugin(appId))) {
      return;
    }

    removePluginBtn.disabled = true;
    const iconElement = removePluginBtn.querySelector('.icon');
    if (iconElement) {
      iconElement.classList.add('icon-loading');
    }

    outputArea.display(
      `<span style="color: var(--accent-yellow);">${S.queries.connectingToTelnet}</span>`,
      true
    );

    const command = `remove_plugin ${appId}`;
    const result = await runTelnetSystemCommandSession(api, command, {
      completeThresholds: REMOVE_PLUGIN_COMPLETE,
      onStatus: (msg) => {
        outputArea.display(
          `<span style="color: var(--accent-yellow);">${escapeHtml(msg)}</span>`,
          true
        );
      }
    });

    if (!result.ok) {
      outputArea.display(
        `<span style="color: var(--accent-red);">${S.queries.errorText(escapeHtml(result.error))}</span>`,
        true
      );
      outputArea.originalContent = S.queries.errorText(result.error);
      removePluginBtn.disabled = false;
      if (iconElement) iconElement.classList.remove('icon-loading');
      return;
    }

    const raw = result.raw;
    const processedOutput = processTelnetSystemCommandOutput(raw, command);

    outputArea.show();

    if (processedOutput && processedOutput.length > 0) {
      outputArea.originalContent = processedOutput;
      const isError =
        processedOutput.toLowerCase().includes('error') ||
        processedOutput.toLowerCase().includes('failed');
      const isSuccess =
        processedOutput.toLowerCase().includes('success') ||
        processedOutput.toLowerCase().includes('removed');
      const color = isError
        ? 'var(--accent-red)'
        : isSuccess
          ? 'var(--accent-green)'
          : '#e0e0e0';
      outputArea.display(
        `<pre style="margin: 0; white-space: pre; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: ${color}; line-height: 1.5; overflow-x: auto;">${escapeHtml(processedOutput)}</pre>`,
        true
      );

      if (!isError) {
        removePluginInput.value = '';
      }
    } else if (raw && raw.length > 0) {
      outputArea.originalContent = raw;
      outputArea.display(
        `<pre style="margin: 0; white-space: pre; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #e0e0e0; line-height: 1.5; overflow-x: auto;">${escapeHtml(raw)}</pre>`,
        true
      );
    } else {
      outputArea.originalContent = S.queries.noResponseReceived;
      outputArea.display(
        `<span style="color: var(--accent-yellow);">${S.queries.noResponseFromCommand}</span>`,
        true
      );
    }

    checkOutputExpansion(outputArea.container);

    removePluginBtn.disabled = false;
    if (iconElement) iconElement.classList.remove('icon-loading');
  });

  removePluginInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      removePluginBtn.click();
    }
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
