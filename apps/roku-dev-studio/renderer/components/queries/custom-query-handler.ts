// Custom query handler

export function setupCustomQuery(
  customQueryInput: HTMLInputElement | HTMLTextAreaElement,
  runCustomQueryBtn: HTMLButtonElement,
  removePluginSection: HTMLElement | null,
  runQuery: (endpoint: string, btn?: HTMLButtonElement | null) => Promise<void>
): void {
  runCustomQueryBtn.addEventListener('click', async () => {
    let endpoint = customQueryInput.value.trim();
    if (!endpoint) return;

    if (removePluginSection) {
      removePluginSection.style.display = 'none';
    }

    if (!endpoint.startsWith('/')) {
      endpoint = '/' + endpoint;
    }

    runCustomQueryBtn.disabled = true;
    runCustomQueryBtn.textContent = 'Running...';

    try {
      await runQuery(endpoint);
    } finally {
      runCustomQueryBtn.disabled = false;
      runCustomQueryBtn.textContent = 'Run Query';
    }
  });

  customQueryInput.addEventListener('keydown', (e: Event) => {
    if ((e as KeyboardEvent).key === 'Enter') {
      runCustomQueryBtn.click();
    }
  });
}
