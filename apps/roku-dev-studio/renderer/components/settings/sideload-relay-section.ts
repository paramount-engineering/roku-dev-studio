/**
 * Sideload Relay settings section (Settings window).
 *
 * Owns the entire "Sideload Relay" UI: the gate + listen port + relay Dev
 * Password + fan-out flags, a discovery-seeded targets list (with a
 * single-select "debug device" for the VS Code Debug: Launch path), and a live
 * per-device results view fed by the relay's push channels. Everything renders
 * into `#sideloadRelayRoot`; config is persisted through the dedicated
 * `sideloadRelay*` IPC (passwords go to the encrypted secret store, never to
 * app-settings.json).
 */

type StepState = 'pending' | 'running' | 'ok' | 'error' | 'skipped';
interface StepResult {
  state: StepState;
  message?: string;
  durationMs?: number;
}
interface DeviceResult {
  targetId: string;
  ip: string;
  name: string;
  primary: boolean;
  install: StepResult;
  launch: StepResult;
  console: StepResult;
  done: boolean;
}
interface Target {
  id: string;
  ip: string;
  name: string;
  enabled: boolean;
  primary: boolean;
}

const api = (window as any).settingsApi;

let targets: Target[] = [];
const results = new Map<string, DeviceResult>();
let lastRunLabel = '';

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

function stepBadge(step: StepResult): HTMLElement {
  const label =
    step.state === 'ok'
      ? 'OK'
      : step.state === 'error'
        ? 'Fail'
        : step.state === 'running'
          ? '…'
          : step.state === 'skipped'
            ? '—'
            : '·';
  const badge = h('span', { class: `sr-badge sr-badge-${step.state}`, title: step.message || '' }, [label]);
  return badge;
}

function renderResults(): void {
  const root = document.getElementById('sideloadRelayResults');
  if (!root) return;
  root.textContent = '';
  const arr = Array.from(results.values());
  if (arr.length === 0) {
    root.append(h('div', { class: 'sr-empty' }, [lastRunLabel ? 'No device results for the last run.' : 'No sideload received yet. Point your IDE’s host at this machine and sideload.']));
    return;
  }
  if (lastRunLabel) root.append(h('div', { class: 'sr-run-label' }, [lastRunLabel]));
  const table = h('div', { class: 'sr-results-table' });
  table.append(
    h('div', { class: 'sr-results-head' }, [
      h('span', {}, ['Device']),
      h('span', {}, ['Install']),
      h('span', {}, ['Launch']),
      h('span', {}, ['Console'])
    ])
  );
  for (const r of arr) {
    const name = h('span', { class: 'sr-dev-name' }, [
      `${r.name}${r.primary ? ' ★' : ''}`,
      h('span', { class: 'sr-dev-ip' }, [r.ip])
    ]);
    table.append(h('div', { class: 'sr-results-row' }, [name, stepBadge(r.install), stepBadge(r.launch), stepBadge(r.console)]));
  }
  root.append(table);
}

function primaryPickable(): boolean {
  // A primary/debug device only matters when the debug proxy is on.
  const dp = document.getElementById('optSrDebugProxy') as HTMLInputElement | null;
  return !!dp && dp.checked;
}

function renderTargets(): void {
  const root = document.getElementById('sideloadRelayTargets');
  if (!root) return;
  root.textContent = '';
  if (targets.length === 0) {
    root.append(h('div', { class: 'sr-empty' }, ['No targets yet. Click “Seed from discovery” to find devices on your network.']));
    return;
  }
  for (const t of targets) {
    const enabled = h('input', { type: 'checkbox', class: 'sr-t-enabled', 'aria-label': `Enable ${t.name}` }) as HTMLInputElement;
    enabled.checked = t.enabled;
    enabled.addEventListener('change', () => {
      t.enabled = enabled.checked;
    });

    const primary = h('input', {
      type: 'radio',
      name: 'sr-primary',
      class: 'sr-t-primary',
      'aria-label': `Set ${t.name} as debug device`
    }) as HTMLInputElement;
    primary.checked = t.primary;
    primary.disabled = !primaryPickable();
    primary.addEventListener('change', () => {
      targets.forEach((x) => (x.primary = x.id === t.id));
    });

    const pwd = h('input', {
      type: 'password',
      class: 'sr-t-pwd settings-text-input',
      placeholder: 'Dev password (optional — uses relay default)',
      'data-target-id': t.id,
      'aria-label': `${t.name} developer password`
    }) as HTMLInputElement;

    const remove = h('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, ['Remove']);
    remove.addEventListener('click', () => {
      targets = targets.filter((x) => x.id !== t.id);
      renderTargets();
    });

    root.append(
      h('div', { class: 'sr-target-row' }, [
        h('label', { class: 'sr-t-cell sr-t-check', title: 'Include in fan-out' }, [enabled]),
        h('label', { class: 'sr-t-cell sr-t-check', title: 'Debug (primary) device' }, [primary]),
        h('span', { class: 'sr-t-cell sr-t-name' }, [t.name, h('span', { class: 'sr-dev-ip' }, [t.ip])]),
        h('span', { class: 'sr-t-cell sr-t-pwd-cell' }, [pwd]),
        h('span', { class: 'sr-t-cell sr-t-actions' }, [remove])
      ])
    );
  }
}

function collectTargetPasswords(): Record<string, string> {
  const out: Record<string, string> = {};
  document.querySelectorAll('.sr-t-pwd').forEach((node) => {
    const input = node as HTMLInputElement;
    const id = input.getAttribute('data-target-id') || '';
    if (id && input.value) out[id] = input.value;
  });
  return out;
}

function setStatusLine(status: any): void {
  const line = document.getElementById('sideloadRelayStatusLine');
  if (!line) return;
  if (!status) {
    line.textContent = '';
    return;
  }
  if (!status.enabled) {
    line.textContent = 'Relay is disabled.';
    return;
  }
  if (!status.listening) {
    line.textContent = status.lastError ? `Not listening — ${status.lastError}` : 'Enabling…';
    return;
  }
  const addr = (status.addresses && status.addresses[0]) || 'this-machine-ip';
  const portHint = status.boundPort === 80 ? '' : `, packagePort=${status.boundPort}`;
  const parts = [`Listening on :${status.boundPort}.`, `In your IDE set host=${addr}${portHint} (user rokudev).`];
  if (status.boundPort !== status.requestedPort) {
    parts.push(`(Port ${status.requestedPort} was unavailable; fell back to ${status.boundPort}.)`);
  }
  if (status.debugProxyListening) parts.push('Debug proxy active (8060/8081/8085 → primary).');
  if (status.ssdpAdvertising) parts.push('Advertising as a Roku — pick “Roku Dev Studio Relay” in VS Code (or host=${promptForHost}).');
  line.textContent = parts.join(' ');
}

function applyLastRun(lastRun: any): void {
  results.clear();
  if (lastRun && lastRun.run) {
    const kb = Math.round((lastRun.run.bytes || 0) / 1024);
    lastRunLabel = `Last run: ${lastRun.run.filename} (${kb} KB)${lastRun.run.debugLaunch ? ' · debug launch' : ''}`;
  }
  if (lastRun && Array.isArray(lastRun.results)) {
    for (const r of lastRun.results) results.set(r.targetId, r);
  }
  renderResults();
}

function buildDom(root: HTMLElement): void {
  const style = h('style', {}, [
    `#sideloadRelayRoot .sr-intro{color:var(--text-secondary,#9aa);font-size:12px;margin-bottom:10px}
     #sideloadRelayRoot .sr-warn{background:rgba(240,180,40,.12);border:1px solid rgba(240,180,40,.4);border-radius:6px;padding:8px 10px;font-size:12px;margin-bottom:12px}
     #sideloadRelayRoot .sr-status{font-size:12px;color:var(--text-secondary,#9aa);margin:6px 0 12px;min-height:16px}
     #sideloadRelayRoot .sr-subhead{font-weight:600;margin:16px 0 6px}
     #sideloadRelayRoot .sr-target-row,#sideloadRelayRoot .sr-results-row,#sideloadRelayRoot .sr-results-head{display:grid;align-items:center;gap:8px}
     #sideloadRelayRoot .sr-target-row{grid-template-columns:32px 32px 1fr 1.4fr auto;padding:6px 0;border-bottom:1px solid var(--border,#333)}
     #sideloadRelayRoot .sr-results-head,#sideloadRelayRoot .sr-results-row{grid-template-columns:1fr 70px 70px 70px;padding:5px 0;border-bottom:1px solid var(--border,#333)}
     #sideloadRelayRoot .sr-results-head{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary,#9aa)}
     #sideloadRelayRoot .sr-dev-name,#sideloadRelayRoot .sr-t-name{display:flex;flex-direction:column}
     #sideloadRelayRoot .sr-dev-ip{font-size:11px;color:var(--text-secondary,#9aa)}
     #sideloadRelayRoot .sr-badge{display:inline-block;min-width:34px;text-align:center;border-radius:4px;padding:2px 6px;font-size:11px;font-weight:600}
     #sideloadRelayRoot .sr-badge-ok{background:rgba(60,190,110,.18);color:#4cc27a}
     #sideloadRelayRoot .sr-badge-error{background:rgba(230,80,80,.18);color:#e56a6a}
     #sideloadRelayRoot .sr-badge-running{background:rgba(90,150,230,.18);color:#6aa0e6}
     #sideloadRelayRoot .sr-badge-skipped,#sideloadRelayRoot .sr-badge-pending{background:rgba(150,150,150,.15);color:#9aa}
     #sideloadRelayRoot .sr-empty{color:var(--text-secondary,#9aa);font-size:12px;padding:8px 0}
     #sideloadRelayRoot .sr-run-label{font-size:12px;margin-bottom:8px}
     #sideloadRelayRoot .sr-target-tools{display:flex;gap:8px;margin:8px 0}`
  ]);
  root.append(style);

  root.append(
    h('div', { class: 'sr-intro' }, [
      'Point your IDE (roku-deploy, VS Code BrightScript, Eclipse) at this machine instead of a single Roku. RDS accepts the sideload once and installs it on every enabled target — then launches the dev app and opens each console.'
    ])
  );
  root.append(
    h('div', { class: 'sr-warn' }, [
      '⚠ Enabling exposes an install endpoint on your local network. It is Digest-authenticated with the relay Dev Password below, but only enable it on trusted networks.'
    ])
  );

  const toggleRow = (id: string, title: string, desc: string) =>
    h('div', { class: 'settings-row-toggle' }, [
      h('div', { class: 'settings-row-text' }, [h('strong', {}, [title]), h('span', { class: 'settings-row-desc' }, [desc])]),
      h('label', { class: 'settings-toggle-wrap', for: id }, [
        h('input', { type: 'checkbox', id, class: 'settings-toggle-input', role: 'switch', 'aria-label': title }),
        h('span', { class: 'settings-toggle-ui', 'aria-hidden': 'true' }, [])
      ])
    ]);

  const inputRow = (id: string, title: string, desc: string, type: string, extra: Record<string, string>) =>
    h('div', { class: 'settings-row-input' }, [
      h('div', { class: 'settings-row-text' }, [h('strong', {}, [title]), h('span', { class: 'settings-row-desc' }, [desc])]),
      h('input', { type, id, class: 'settings-text-input', 'aria-label': title, ...extra })
    ]);

  root.append(toggleRow('optSideloadRelay', 'Enable Sideload Relay', 'Bind the “fake Roku” HTTP server so IDEs can sideload through RDS. Off by default.'));
  root.append(inputRow('srPort', 'Listen Port', 'Port the relay listens on. 80 matches roku-deploy’s default; if 80 needs root it falls back to 8888 automatically.', 'number', { min: '1', max: '65535', value: '80' }));
  root.append(inputRow('srPassword', 'Relay Dev Password', 'The developer password your IDE authenticates with (user rokudev). Stored encrypted; leave blank to keep the saved one.', 'password', { placeholder: '••••••••', autocomplete: 'off' }));
  root.append(toggleRow('optSrAutoLaunch', 'Auto-launch Dev App', 'After install, launch the “dev” channel on each device.'));
  root.append(toggleRow('optSrAutoConsole', 'Auto-connect Console', 'After install, open the BrightScript debug console (telnet 8085) for each device.'));
  root.append(toggleRow('optSrDebugProxy', 'VS Code “Debug: Launch” proxy', 'Bind ECP 8060 + debug ports 8081/8085 and proxy them to the chosen debug device, so the VS Code debugger attaches while the build still fans out to the fleet. Also advertises RDS over SSDP as “Roku Dev Studio Relay” so it appears in VS Code’s device picker.'));
  root.append(toggleRow('optSrRetry', 'Retry once on failure', 'If an install fails, retry it one time before reporting failure.'));

  root.append(h('div', { class: 'sr-status', id: 'sideloadRelayStatusLine', 'aria-live': 'polite' }, []));

  // Targets
  root.append(h('div', { class: 'sr-subhead' }, ['Targets']));
  const tools = h('div', { class: 'sr-target-tools' });
  const seedBtn = h('button', { type: 'button', class: 'btn btn-secondary btn-sm', id: 'srSeedBtn' }, ['Seed from discovery']);
  const seedStatus = h('span', { class: 'section-save-status', id: 'srSeedStatus', 'aria-live': 'polite' }, []);
  tools.append(seedBtn, seedStatus);
  root.append(tools);
  root.append(h('div', { id: 'sideloadRelayTargets' }, []));

  // Results
  root.append(h('div', { class: 'sr-subhead' }, ['Last fan-out results']));
  root.append(h('div', { id: 'sideloadRelayResults' }, []));

  // Save dock
  root.append(
    h('div', { class: 'section-save-dock' }, [
      h('span', { class: 'section-save-status', id: 'srSaveStatus', 'aria-live': 'polite' }, []),
      h('button', { type: 'button', class: 'btn btn-primary', id: 'srSaveBtn' }, ['Save'])
    ])
  );
}

function setToggle(id: string, on: boolean): void {
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (!input) return;
  input.checked = on;
  input.setAttribute('aria-checked', on ? 'true' : 'false');
  input.addEventListener('change', () => input.setAttribute('aria-checked', input.checked ? 'true' : 'false'));
}

function boolOf(id: string): boolean {
  const input = document.getElementById(id) as HTMLInputElement | null;
  return !!input && input.checked;
}

async function save(): Promise<void> {
  const status = document.getElementById('srSaveStatus');
  const btn = document.getElementById('srSaveBtn') as HTMLButtonElement | null;
  const portInput = document.getElementById('srPort') as HTMLInputElement | null;
  const pwdInput = document.getElementById('srPassword') as HTMLInputElement | null;
  const port = portInput ? parseInt(portInput.value, 10) : 80;

  const payload: Record<string, unknown> = {
    enabled: boolOf('optSideloadRelay'),
    requestedPort: isFinite(port) && port > 0 && port < 65536 ? port : 80,
    autoLaunch: boolOf('optSrAutoLaunch'),
    autoConsole: boolOf('optSrAutoConsole'),
    debugProxyEnabled: boolOf('optSrDebugProxy'),
    retryOnFailure: boolOf('optSrRetry'),
    targets: targets.map((t) => ({ id: t.id, ip: t.ip, name: t.name, enabled: t.enabled, primary: t.primary })),
    targetPasswords: collectTargetPasswords()
  };
  // Only send the relay password when the user typed one, so an empty field
  // doesn't wipe the saved secret.
  if (pwdInput && pwdInput.value) payload.password = pwdInput.value;

  if (btn) btn.disabled = true;
  if (status) {
    status.textContent = 'Saving…';
    status.classList.remove('is-error');
  }
  try {
    const res = await api.sideloadRelayApply(payload);
    if (res && res.success) {
      if (status) status.textContent = 'Saved.';
      if (pwdInput) pwdInput.value = '';
      // Clear typed per-target passwords now that they're stored.
      document.querySelectorAll('.sr-t-pwd').forEach((n) => ((n as HTMLInputElement).value = ''));
      if (res.status) setStatusLine(res.status);
    } else if (status) {
      status.textContent = (res && res.error) || 'Save failed';
      status.classList.add('is-error');
    }
  } catch (e) {
    if (status) {
      status.textContent = 'Save failed';
      status.classList.add('is-error');
    }
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function seed(): Promise<void> {
  const btn = document.getElementById('srSeedBtn') as HTMLButtonElement | null;
  const status = document.getElementById('srSeedStatus');
  if (btn) btn.disabled = true;
  if (status) status.textContent = 'Scanning…';
  try {
    const res = await api.sideloadRelaySeedTargets(false);
    const candidates: Target[] = (res && res.candidates) || [];
    let added = 0;
    for (const c of candidates) {
      if (!targets.some((t) => t.id === c.id || t.ip === c.ip)) {
        targets.push({ id: c.id, ip: c.ip, name: c.name, enabled: true, primary: false });
        added += 1;
      }
    }
    renderTargets();
    if (status) status.textContent = added > 0 ? `Added ${added} device${added === 1 ? '' : 's'}.` : 'No new devices found.';
  } catch (e) {
    if (status) status.textContent = 'Discovery failed.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** Entry point — called once from settings.ts after the DOM is ready. */
export function initSideloadRelaySection(): void {
  const root = document.getElementById('sideloadRelayRoot');
  if (!root || !api || !api.sideloadRelayGetConfig) return;
  buildDom(root);

  document.getElementById('srSaveBtn')?.addEventListener('click', () => void save());
  document.getElementById('srSeedBtn')?.addEventListener('click', () => void seed());
  document.getElementById('optSrDebugProxy')?.addEventListener('change', () => renderTargets());

  api.sideloadRelayGetConfig().then((res: any) => {
    const cfg = res && res.config;
    if (!cfg) return;
    setToggle('optSideloadRelay', cfg.enabled === true);
    setToggle('optSrAutoLaunch', cfg.autoLaunch !== false);
    setToggle('optSrAutoConsole', cfg.autoConsole !== false);
    setToggle('optSrDebugProxy', cfg.debugProxyEnabled === true);
    setToggle('optSrRetry', cfg.retryOnFailure === true);
    const portInput = document.getElementById('srPort') as HTMLInputElement | null;
    if (portInput) portInput.value = String(cfg.requestedPort || 80);
    const pwdInput = document.getElementById('srPassword') as HTMLInputElement | null;
    if (pwdInput && cfg.hasPassword) pwdInput.placeholder = '•••••••• (saved)';
    targets = Array.isArray(cfg.targets)
      ? cfg.targets.map((t: any) => ({ id: t.id, ip: t.ip, name: t.name || t.ip, enabled: t.enabled !== false, primary: t.primary === true }))
      : [];
    renderTargets();
  });

  api.sideloadRelayGetStatus().then((res: any) => {
    if (res && res.status) setStatusLine(res.status);
    if (res && res.lastRun) applyLastRun(res.lastRun);
  });

  if (api.onSideloadRelayStatus) api.onSideloadRelayStatus((s: any) => setStatusLine(s));
  if (api.onSideloadRelayRunStarted) {
    api.onSideloadRelayRunStarted((run: any) => {
      results.clear();
      const kb = Math.round((run.bytes || 0) / 1024);
      lastRunLabel = `Last run: ${run.filename} (${kb} KB)${run.debugLaunch ? ' · debug launch' : ''}`;
      renderResults();
    });
  }
  if (api.onSideloadRelayResult) {
    api.onSideloadRelayResult((r: DeviceResult) => {
      results.set(r.targetId, r);
      renderResults();
    });
  }
}
