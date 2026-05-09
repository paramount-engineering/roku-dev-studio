#!/usr/bin/env npx tsx
/**
 * DOM verification: JSON vs JSON+ pills each open the correct structured payload.
 * Run from apps/roku-dev-studio:
 *   npx tsx scripts/verify-structured-pills.ts [path-to-log.txt]
 *
 * Default log path: ~/Desktop/roku-console-logs-1776263437005.txt (if present).
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';

async function main() {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const g = globalThis as typeof globalThis & {
    window: Window & typeof globalThis;
    document: Document;
    navigator: Navigator;
  };
  g.window = window as unknown as Window & typeof globalThis;
  g.document = window.document;
  g.navigator = window.navigator;

  Object.assign(globalThis, {
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    Text: window.Text,
    SVGElement: window.SVGElement,
    MouseEvent: window.MouseEvent,
    DocumentFragment: window.DocumentFragment,
    Document: window.Document,
    CustomEvent: window.CustomEvent,
    Event: window.Event
  });

  window.matchMedia = () =>
    ({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    }) as unknown as MediaQueryList;

  const rafHandles = new Map<number, ReturnType<typeof setTimeout>>();
  let rafNext = 1;
  (globalThis as typeof globalThis & { requestAnimationFrame: typeof window.requestAnimationFrame }).requestAnimationFrame =
    (cb: FrameRequestCallback) => {
      const id = rafNext++;
      const t = setTimeout(() => {
        rafHandles.delete(id);
        cb(0);
      }, 0);
      rafHandles.set(id, t);
      return id;
    };
  (globalThis as typeof globalThis & { cancelAnimationFrame: typeof window.cancelAnimationFrame }).cancelAnimationFrame =
    (id: number) => {
      const t = rafHandles.get(id);
      if (t) clearTimeout(t);
      rafHandles.delete(id);
    };
  (globalThis as typeof globalThis & { getComputedStyle: typeof window.getComputedStyle }).getComputedStyle =
    window.getComputedStyle.bind(window);

  (window as unknown as { roku: unknown }).roku = {
    copyToClipboard: async () => {},
    openExternal: async () => {}
  };

  const svg = window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('style', 'display:none');
  const sym = window.document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
  sym.id = 'icon-x';
  svg.appendChild(sym);
  window.document.head.appendChild(svg);

  const { attachStructuredPillsToLine } = await import(
    '../renderer/modules/telnet/telnet-structured-view-modal.js'
  );
  const { rawLogFileTextToEntries } = await import(
    '../renderer/modules/telnet/console-log-file-view.js'
  );

  const argPath = process.argv[2];
  const defaults = [
    argPath,
    join(homedir(), 'Desktop', 'roku-console-logs-1776263437005.txt'),
    '/Users/hdona0418/Desktop/roku-console-logs-1776263437005.txt'
  ].filter(Boolean) as string[];

  let raw = '';
  for (const p of defaults) {
    if (p && existsSync(p)) {
      raw = readFileSync(p, 'utf8');
      console.log('Using log file:', p);
      break;
    }
  }
  if (!raw) {
    console.error('No log file found. Pass path as argv[1] or place sample on Desktop.');
    process.exit(1);
  }

  const entries = rawLogFileTextToEntries(raw, false);
  const entry = entries.find((e) => e.text.includes('com.adobe.event.response'));
  if (!entry?.structuredTargets || entry.structuredTargets.length < 2) {
    console.error(
      'Expected an Adobe response line with 2 structured targets, got:',
      entry?.structuredTargets?.length ?? 0
    );
    process.exit(1);
  }

  const [outer, inner] = entry.structuredTargets;
  if (!outer || !inner || !inner.fromEscapedString) {
    console.error('Bad target shape', { outer: !!outer, inner: !!inner, nested: inner?.fromEscapedString });
    process.exit(1);
  }

  const line = window.document.createElement('div');
  line.className = 'telnet-log-line';
  const content = window.document.createElement('span');
  content.className = 'telnet-log-content';
  content.textContent = entry.text.slice(0, 200) + '…';
  line.appendChild(content);
  window.document.body.appendChild(line);

  attachStructuredPillsToLine(line, content, entry.structuredTargets);

  const pills = Array.from(line.querySelectorAll('.telnet-structured-view-pill')) as HTMLElement[];
  if (pills.length !== 2) {
    console.error('Expected 2 pill buttons, got', pills.length);
    process.exit(1);
  }

  const readModalFormatted = (): string | null => {
    const pre = window.document.querySelector('.telnet-structured-view-pre');
    return pre instanceof window.HTMLElement ? pre.dataset.formatted ?? null : null;
  };

  pills[0]!.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const after0 = readModalFormatted();
  if (after0 !== outer.formatted) {
    console.error('First pill should show outer JSON formatted text.');
    console.error('Expected length', outer.formatted.length, 'got', after0?.length ?? 0);
    process.exit(1);
  }

  pills[1]!.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  const after1 = readModalFormatted();
  if (after1 !== inner.formatted) {
    console.error('JSON+ pill should show inner (message) JSON formatted text.');
    console.error('Expected length', inner.formatted.length, 'got', after1?.length ?? 0);
    process.exit(1);
  }

  if (after0 === after1) {
    console.error('Outer and inner formatted bodies should differ.');
    process.exit(1);
  }

  let delegatedPayload: string | null = null;
  const output = window.document.createElement('div');
  output.className = 'telnet-output';
  const line2 = window.document.createElement('div');
  line2.className = 'telnet-log-line';
  line2.dataset.lineIndex = '0';
  const content2 = window.document.createElement('span');
  content2.className = 'telnet-log-content';
  content2.textContent = 'x';
  line2.appendChild(content2);
  attachStructuredPillsToLine(line2, content2, entry.structuredTargets);
  output.appendChild(line2);
  window.document.body.appendChild(output);

  const logLines = [entry];
  output.addEventListener('click', (e) => {
    const t = e.target;
    const el = t instanceof window.Element ? t : t instanceof window.Text ? t.parentElement : null;
    if (!el) return;
    const urlHit = el.closest('.telnet-log-url');
    if (urlHit) return;
    if (!el.closest('.telnet-log-content')) return;
    const ln = el.closest('.telnet-log-line');
    if (!(ln instanceof window.HTMLElement)) return;
    const idx = parseInt(ln.dataset.lineIndex || '-1', 10);
    const ent = idx >= 0 ? logLines[idx] : undefined;
    if (!ent?.structuredTargets?.length) return;
    e.preventDefault();
    delegatedPayload = ent.structuredTargets[0]!.formatted;
  });

  content2.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  if (delegatedPayload !== outer.formatted) {
    console.error('Delegated content click should open outer JSON only.');
    process.exit(1);
  }

  console.log('verify-structured-pills: OK (pill0=outer, pill1=inner, content=outer).');
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
