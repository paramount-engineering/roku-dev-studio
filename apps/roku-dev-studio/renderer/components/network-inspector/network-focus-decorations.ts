/**
 * Focus-decoration glue shared by the two Network Inspector surfaces — the LIVE tab (`network-tab.ts`)
 * and the standalone Session Viewer (`network-session-viewer.ts`). "Focus" is a per-tab triage lens: a
 * Set of lowercased hostnames the user has marked. Non-focused rows dim (`ni-dimmed`); focused
 * rows/groups get emphasis (`ni-focused`). Focus is driven entirely by the right-click context menu.
 *
 * It's a pure, post-paint DOM class toggler (mirrors network-find-decorations.ts) so it never touches
 * `buildSessions`/`filterSessions` or the incremental row-patch paths — those count rendered DOM rows
 * and would break if focus removed rows from the rendered set. Each caller passes in its own list
 * element + focus state and re-runs this after every repaint.
 */

export interface ApplyFocusDecorationsOpts {
  /** The session-list container whose host rows / group headers get decorated. */
  listEl: HTMLElement;
  /** Lowercased hostnames currently focused. */
  focusedHosts: Set<string>;
}

/**
 * Stamp focus classes on sequence rows (`.ni-sidebar-row[data-host]`) and group headers
 * (`.ni-struct-host[data-struct-host]`). Dimming the whole `.ni-struct-host` cascades to its
 * header + leaves, so leaves need no per-element handling.
 *
 * The toggles are idempotent (`classList.toggle(name, cond)`), so a repaint that re-runs this leaves an
 * already-correct row untouched. When no host is focused (`active === false`) both classes clear.
 */
/**
 * Distinct emphasis colors auto-assigned to focused hosts, cycled in focus order so each focused host
 * reads as its own thing. Deliberately chosen to NOT share a hex with the Find-term palette
 * (network-find-modal.ts `PALETTE`) or the timing-waterfall phase colors (index.html `.ni-wf-*`), so
 * the three color-coded features stay visually distinct by default. (Those two already span most of
 * the wheel — red is the only fully-unused family — so the rest are shifted shades; the guarantee is
 * "no identical default color," not maximal hue separation. Find terms remain user-overridable.)
 */
const FOCUS_PALETTE = [
  '#f87171', // red
  '#fb923c', // orange
  '#facc15', // yellow
  '#a3e635', // lime
  '#5eead4', // teal
  '#818cf8', // indigo
  '#e879f9' // fuchsia
];

export function applyFocusDecorations({ listEl, focusedHosts }: ApplyFocusDecorationsOpts): void {
  const active = focusedHosts.size > 0;
  // Assign each focused host a palette color (cycled) in focus order, handed to CSS via a per-element
  // `--focus-color` custom property. The `.ni-focused` color rule reads `var(--focus-color, …cyan)`;
  // the property cascades from the focused row/host element down to its host-name child.
  const colorFor = new Map<string, string>();
  let ci = 0;
  for (const host of focusedHosts) {
    colorFor.set(host, FOCUS_PALETTE[ci % FOCUS_PALETTE.length]);
    ci++;
  }
  const decorate = (el: HTMLElement, key: string | undefined): void => {
    const focused = active && !!key && focusedHosts.has(key);
    el.classList.toggle('ni-focused', focused);
    el.classList.toggle('ni-dimmed', active && !focused);
    if (focused && key) el.style.setProperty('--focus-color', colorFor.get(key) ?? '');
    else el.style.removeProperty('--focus-color');
  };
  listEl.querySelectorAll('.ni-sidebar-row[data-host]').forEach((row) => {
    const el = row as HTMLElement;
    decorate(el, el.dataset.host);
  });
  listEl.querySelectorAll('.ni-struct-host[data-struct-host]').forEach((host) => {
    const el = host as HTMLElement;
    decorate(el, el.dataset.structHost);
  });
}
