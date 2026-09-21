// Custom query handler

import { S } from '@shared/strings/index.js';

/** An ECP endpoint is a path (`/query/device-info`, `query/registry/dev`); a Roku 8080 console
 *  command never contains a slash (`free`, `plugins`, `sgnodes all`, `fps_display`). */
export function isEcpPath(text: string): boolean {
  return text.includes('/');
}

export function setupCustomQuery(
  customQueryInput: HTMLInputElement | HTMLTextAreaElement,
  runCustomQueryBtn: HTMLButtonElement,
  removePluginSection: HTMLElement | null,
  runQuery: (endpoint: string, btn?: HTMLButtonElement | null) => Promise<void>,
  runTelnetCommand: (command: string, btn?: HTMLButtonElement | null) => Promise<void>
): void {
  runCustomQueryBtn.addEventListener('click', async () => {
    let endpoint = customQueryInput.value.trim();
    if (!endpoint) return;

    // A bare console command goes to the 8080 session (reusing the Ports window's socket when it
    // holds one) — the same run the preset buttons use, remove-plugin row included.
    const isConsoleCommand = !isEcpPath(endpoint);

    if (removePluginSection && !isConsoleCommand) {
      removePluginSection.style.display = 'none';
    }

    if (!isConsoleCommand && !endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }

    runCustomQueryBtn.disabled = true;
    runCustomQueryBtn.textContent = S.queries.running;

    try {
      if (isConsoleCommand) await runTelnetCommand(endpoint);
      else await runQuery(endpoint);
    } finally {
      runCustomQueryBtn.disabled = false;
      runCustomQueryBtn.textContent = S.queries.runQuery;
    }
  });

  customQueryInput.addEventListener('keydown', (e: Event) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      runCustomQueryBtn.click();
    }
  });
}
