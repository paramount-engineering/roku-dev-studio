/**
 * "Start device" modal — the Start button's split-button caret on an RCE device card opens this to
 * set `POST /devices/{id}/start`'s optional `max_runtime`/`snapshot_id` instead of the plain-click
 * defaults (see `rce-handlers.ts`'s `resolveStartParams`). Snapshot names come from a separate
 * `GET /devices/{id}/snapshots` call (`RceListSnapshots`) kicked off the moment this modal opens,
 * racing its own entrance animation — the rest of the form (Max Run Time, Cancel/Start Device) must
 * stay usable the whole time that's in flight, since "start with whatever's already loaded/default"
 * never actually needs the snapshot list at all (only picking a *specific* snapshot does).
 *
 * The "use a snapshot" checkbox and its `<select>` are one integrated row (not a toggle above a
 * separate field) — checking it enables the dropdown, which always lands on the "Select Snapshot"
 * placeholder rather than auto-picking one (that placeholder's empty value is what makes `useSnapshot`
 * below treat it as "no override", identical to leaving the box unchecked). Picking a real snapshot
 * expands the modal (`animateHeight`) to show its details underneath.
 */

import { escapeHtml, setSafeHTML, icon, animateHeight } from '../utils/dom.js';
import { openModalOverlayActiveFromOpener, closeModalWithOriginMotion } from '../utils/modal-origin-motion.js';
import { attachBackdropClickToClose, attachEscToClose } from '../utils/modal-backdrop-click.js';
import { parseRceUtcTimestamp } from './rce-time.js';
import { S } from '@shared/strings/index.js';

/** Just the fields the picker needs — kept local rather than importing `RceSnapshot` from the
 *  main-process-only `roku-dev-studio-rce` package into the renderer. */
export interface RceStartDeviceSnapshotOption {
  id: number;
  name: string;
  createdAt: string;
  /** Last time a device was actually started from this snapshot, or null if never used. The
   *  `live` snapshot is created once (at device-creation time, alongside `base`) and its content
   *  just updates in place on every stop — so its `createdAt` is old even when it's the most
   *  recently relevant snapshot; `startedAt` is what actually reflects that recency. */
  startedAt: string | null;
  base: boolean;
  live: boolean;
  ready: boolean;
  firmwareVersionDisplayName: string | null;
  note: string | null;
}

export interface RceStartDeviceModalDevice {
  name: string;
  /** Raw device-type value ('tv' | 'stb' | 'streambar') — filters the firmware dropdown to only
   *  the versions applicable to this device (see RceListFirmwareVersions). */
  deviceType: string;
  /** The device's currently-recorded firmware (`GET /devices`'s own `firmware_version_id`) —
   *  pre-selected in the dropdown when it's still in the fetched list; left on the placeholder
   *  (with a blocking error on confirm) when Roku has retired it entirely, which is what actually
   *  causes "Build validation failed" for an old device — see rce-handlers.ts's
   *  `resolveStartParams` doc comment. */
  firmwareVersionId: string | null;
}

/** One firmware version from the account-wide `RceListFirmwareVersions` list — fetched once per
 *  location on connect (app.ts's `refreshRceLocation`), not per modal open like snapshots, so it's
 *  passed in as a plain array rather than an async getter. */
export interface RceStartDeviceFirmwareOption {
  firmwareVersionId: string;
  deviceType: string;
  displayName: string;
}

export interface RceStartDeviceOptions {
  /** Explicit snapshot pick — omitted entirely when "Use this Snapshot" is unchecked (or the list
   *  never loaded), so the main process falls back to its own default resolution. */
  snapshotId?: number;
  /** Explicit firmware pick from the always-shown firmware dropdown — omitted only when the
   *  fetched list had zero options for this device type (main process then falls back to deriving
   *  one from the chosen snapshot, same as before this dropdown existed). */
  firmwareVersionId?: string;
  maxRuntimeSeconds: number;
}

const MAX_RUNTIME_HOURS_CAP = 48;

function formatSnapshotLabel(s: RceStartDeviceSnapshotOption): string {
  return s.base ? S.app.rceSnapshotInitialOption : s.name;
}

function yesNo(v: boolean): string {
  return v ? S.common.yes : S.common.no;
}

/**
 * Rows for the expand-on-select details panel — reuses the `.rce-info-row` pill look
 * (short label left, short value right). The note is a free-text sentence, not a short value, so
 * it gets its own stacked block (label above, wrapped text below) at the end instead of a row —
 * inline label-left/value-right with `justify-content: space-between` overlapped once the value
 * wrapped to 2+ lines.
 */
function snapshotDetailsRowsHtml(s: RceStartDeviceSnapshotOption): string {
  const rows: Array<{ label: string; value: string }> = [
    { label: S.app.rceDeviceInfoCreated, value: escapeHtml(parseRceUtcTimestamp(s.createdAt).toLocaleString()) },
    {
      label: S.app.rceSnapshotStarted,
      value: s.startedAt ? escapeHtml(parseRceUtcTimestamp(s.startedAt).toLocaleString()) : S.app.notAvailable
    },
    { label: S.app.labelFirmware, value: escapeHtml(s.firmwareVersionDisplayName || S.app.notAvailable) },
    { label: S.app.rceSnapshotReady, value: yesNo(s.ready) },
    { label: S.app.rceSnapshotLive, value: yesNo(s.live) },
    { label: S.app.rceSnapshotBase, value: yesNo(s.base) }
  ];
  const rowsHtml = rows
    .map(
      (r) =>
        `<div class="rce-info-row"><span class="rce-info-label">${r.label}</span><span class="rce-info-value">${r.value}</span></div>`
    )
    .join('');
  const noteHtml = s.note
    ? `<div class="rce-start-modal-snapshot-note">
        <span class="rce-start-modal-snapshot-note-label">${S.app.rceDeviceInfoNote}</span>
        <p class="rce-start-modal-snapshot-note-text">${escapeHtml(s.note)}</p>
      </div>`
    : '';
  return rowsHtml + noteHtml;
}

/**
 * @param opener The caret button that triggered this — used for the shared open/close scale
 * animation (`modal-origin-motion.ts`).
 */
export function openRceStartDeviceModal(
  device: RceStartDeviceModalDevice,
  firmwareVersions: RceStartDeviceFirmwareOption[],
  listSnapshots: () => Promise<{ success: boolean; snapshots?: RceStartDeviceSnapshotOption[]; error?: string }>,
  onConfirm: (opts: RceStartDeviceOptions) => Promise<{ success?: boolean; error?: string }>,
  opener?: HTMLElement | null
): void {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay rce-start-modal-overlay';
  setSafeHTML(
    overlay,
    `
    <div class="rce-start-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(
      S.app.rceStartDeviceModalTitle(device.name)
    )}">
      <div class="rce-start-modal-header">
        <h3 class="rce-start-modal-title">${escapeHtml(S.app.rceStartDeviceModalTitle(device.name))}</h3>
        <button type="button" class="modal-close rce-start-modal-close" title="${S.common.close}" aria-label="${S.common.close}">${icon('x', 'icon-sm')}</button>
      </div>
      <div class="rce-start-modal-body">
        <div class="rce-start-modal-field-group">
          <span class="rce-start-modal-label">${S.app.rceMaxRunTime}</span>
          <div class="rce-start-modal-runtime-row">
            <label class="rce-start-modal-runtime-field">
              <input type="number" class="rce-start-modal-hour" min="0" max="${MAX_RUNTIME_HOURS_CAP}" step="1" value="1" aria-label="${S.app.rceMaxRunTimeHour}">
              <span class="rce-start-modal-unit">${S.app.rceMaxRunTimeHour}</span>
            </label>
            <label class="rce-start-modal-runtime-field">
              <input type="number" class="rce-start-modal-min" min="0" max="59" step="1" value="0" aria-label="${S.app.rceMaxRunTimeMin}">
              <span class="rce-start-modal-unit">${S.app.rceMaxRunTimeMin}</span>
            </label>
          </div>
          <p class="rce-start-modal-hint">${S.app.rceMaxRunTimeHint}</p>
        </div>
        <div class="rce-start-modal-field-group">
          <span class="rce-start-modal-label">${S.app.rceFirmwareVersion}</span>
          <select class="rce-start-modal-firmware-select" aria-label="${S.app.rceFirmwareVersion}">
            <option value="">${S.app.rceFirmwareSelectPlaceholder}</option>
          </select>
          <p class="rce-start-modal-firmware-error" hidden></p>
        </div>
        <div class="rce-start-modal-field-group">
          <span class="rce-start-modal-label">${S.app.rceSnapshotAria}</span>
          <div class="rce-start-modal-snapshot-row">
            <div class="rce-start-modal-snapshot-checkbox-cell">
              <input type="checkbox" class="rce-start-modal-use-snapshot" aria-label="${S.app.rceUseThisSnapshot}">
            </div>
            <select class="rce-start-modal-snapshot-select" aria-label="${S.app.rceSnapshotAria}" disabled>
              <option value="">${S.app.rceSnapshotSelectPlaceholder}</option>
            </select>
            <span class="rce-start-modal-snapshot-spinner" hidden aria-hidden="true"></span>
          </div>
          <p class="rce-start-modal-snapshot-error" hidden></p>
          <div class="rce-start-modal-snapshot-details" hidden></div>
        </div>
      </div>
      <div class="rce-start-modal-footer">
        <span class="rce-start-modal-status" aria-live="polite"></span>
        <button type="button" class="btn btn-secondary rce-start-modal-cancel">${S.common.cancel}</button>
        <button type="button" class="btn btn-primary rce-start-modal-confirm">${S.app.rceStartDevice}</button>
      </div>
    </div>`
  );

  document.body.appendChild(overlay);
  openModalOverlayActiveFromOpener(overlay, opener ?? null);

  const hourInput = overlay.querySelector('.rce-start-modal-hour') as HTMLInputElement;
  const minInput = overlay.querySelector('.rce-start-modal-min') as HTMLInputElement;
  const firmwareSelect = overlay.querySelector('.rce-start-modal-firmware-select') as HTMLSelectElement;
  const firmwareError = overlay.querySelector('.rce-start-modal-firmware-error') as HTMLElement;
  const useSnapshotCb = overlay.querySelector('.rce-start-modal-use-snapshot') as HTMLInputElement;
  const snapshotSelect = overlay.querySelector('.rce-start-modal-snapshot-select') as HTMLSelectElement;
  const snapshotSpinner = overlay.querySelector('.rce-start-modal-snapshot-spinner') as HTMLElement;
  const snapshotError = overlay.querySelector('.rce-start-modal-snapshot-error') as HTMLElement;
  const snapshotDetails = overlay.querySelector('.rce-start-modal-snapshot-details') as HTMLElement;
  const modalBody = overlay.querySelector('.rce-start-modal-body') as HTMLElement;
  const statusEl = overlay.querySelector('.rce-start-modal-status') as HTMLElement;
  const cancelBtn = overlay.querySelector('.rce-start-modal-cancel') as HTMLButtonElement;
  const confirmBtn = overlay.querySelector('.rce-start-modal-confirm') as HTMLButtonElement;
  const closeBtn = overlay.querySelector('.rce-start-modal-close') as HTMLButtonElement;

  // Firmware is synchronous (fetched once per location on connect, not per modal open like
  // snapshots) — populate immediately rather than racing an async load like the snapshot picker.
  const firmwareOptionsForType = firmwareVersions.filter((f) => f.deviceType === device.deviceType);
  const currentFirmwareAvailable =
    !!device.firmwareVersionId && firmwareOptionsForType.some((f) => f.firmwareVersionId === device.firmwareVersionId);
  if (firmwareOptionsForType.length === 0) {
    // No data at all for this device type (list still loading/failed, or a brand-new location) —
    // don't block Start on missing data; the main process falls back to deriving firmware from the
    // chosen snapshot, exactly like before this dropdown existed.
    setSafeHTML(firmwareSelect, `<option value="">${S.app.rceFirmwareNoData}</option>`);
    firmwareSelect.disabled = true;
  } else {
    setSafeHTML(
      firmwareSelect,
      `<option value="">${S.app.rceFirmwareSelectPlaceholder}</option>` +
        firmwareOptionsForType
          .map(
            (f) =>
              `<option value="${escapeHtml(f.firmwareVersionId)}"${f.firmwareVersionId === device.firmwareVersionId ? ' selected' : ''}>${escapeHtml(f.displayName)}</option>`
          )
          .join('')
    );
  }
  firmwareSelect.addEventListener('change', () => {
    firmwareError.hidden = true;
  });

  let snapshotState: 'loading' | 'loaded' | 'error' = 'loading';
  let snapshots: RceStartDeviceSnapshotOption[] = [];

  const finalize = (): void => {
    overlay.remove();
    detachEsc();
  };
  const close = (): void => {
    if (!overlay.isConnected) return;
    closeModalWithOriginMotion(overlay, finalize);
  };
  const detachEsc = attachEscToClose(close);
  attachBackdropClickToClose(overlay, close);
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  // Reflects `snapshotState` + the checkbox into the select/spinner/error UI and whether Start
  // Device can proceed. The checkbox itself is never disabled — unchecking it always falls back
  // to the default (no snapshot override), regardless of how the fetch above went.
  function syncSnapshotUi(): void {
    const wantsSnapshot = useSnapshotCb.checked;
    snapshotSelect.disabled = !wantsSnapshot || snapshotState !== 'loaded';
    snapshotSpinner.hidden = !(wantsSnapshot && snapshotState === 'loading');
    snapshotError.hidden = snapshotState !== 'error';
    if (snapshotError.hidden === false) snapshotError.textContent = S.app.rceSnapshotLoadFailed;
    // Only block Start Device while genuinely waiting on a list the user actually asked to pick
    // from — an unchecked box (or an already-settled fetch, success or failure) never blocks it.
    confirmBtn.disabled = wantsSnapshot && snapshotState === 'loading';
  }

  // Expands/collapses the details panel for whatever's currently selected — nothing shows while
  // the box is unchecked (select disabled) or the placeholder "Select Snapshot" option is picked,
  // which is deliberately not a real snapshot (value `""`).
  function updateSnapshotDetails(): void {
    const selected =
      !snapshotSelect.disabled && snapshotSelect.value
        ? snapshots.find((s) => String(s.id) === snapshotSelect.value)
        : undefined;
    animateHeight(modalBody, () => {
      if (selected) {
        setSafeHTML(snapshotDetails, snapshotDetailsRowsHtml(selected));
        snapshotDetails.hidden = false;
      } else {
        setSafeHTML(snapshotDetails, '');
        snapshotDetails.hidden = true;
      }
    });
  }

  useSnapshotCb.addEventListener('change', () => {
    syncSnapshotUi();
    updateSnapshotDetails();
  });
  snapshotSelect.addEventListener('change', updateSnapshotDetails);
  syncSnapshotUi();

  void listSnapshots()
    .then((result) => {
      if (!overlay.isConnected) return;
      if (!result.success || !result.snapshots) {
        snapshotState = 'error';
        syncSnapshotUi();
        return;
      }
      // Most-recently-relevant first, by `startedAt` (falling back to `createdAt` for a snapshot
      // that's never been started from). Plain `createdAt` alone misorders the `live` snapshot —
      // it's created once up front and its content just updates in place on every device stop, so
      // its `createdAt` looks old even when it's actually the most current state.
      const sortKey = (s: RceStartDeviceSnapshotOption): number => parseRceUtcTimestamp(s.startedAt ?? s.createdAt).getTime();
      snapshots = [...result.snapshots].sort((a, b) => sortKey(b) - sortKey(a));
      snapshotState = 'loaded';
      // The placeholder stays first and is left selected — enabling the dropdown never auto-picks
      // a real snapshot, it lands on "Select Snapshot" (an ineligible, non-real value) until the
      // user actually chooses one, same as leaving the checkbox unchecked.
      setSafeHTML(
        snapshotSelect,
        `<option value="">${S.app.rceSnapshotSelectPlaceholder}</option>` +
          snapshots.map((s) => `<option value="${s.id}">${escapeHtml(formatSnapshotLabel(s))}</option>`).join('')
      );
      syncSnapshotUi();
    })
    .catch(() => {
      if (!overlay.isConnected) return;
      snapshotState = 'error';
      syncSnapshotUi();
    });

  function maxRuntimeSecondsFromInputs(): number {
    const h = Math.max(0, Math.min(MAX_RUNTIME_HOURS_CAP, Math.floor(Number(hourInput.value)) || 0));
    const m = Math.max(0, Math.min(59, Math.floor(Number(minInput.value)) || 0));
    const seconds = h * 3600 + m * 60;
    // The API rejects 0 (`exclusiveMinimum: 0`) — floor to 1 minute rather than surfacing a
    // validation error for what's almost certainly a stray "0 / 0" left in the fields.
    return Math.min(MAX_RUNTIME_HOURS_CAP * 3600, seconds || 60);
  }

  confirmBtn.addEventListener('click', () => {
    void (async () => {
      // Firmware is required whenever there ARE options to choose from — an empty selection here
      // means either the user hasn't picked one yet, or (the real-world case this exists for) the
      // device's original firmware has been retired by Roku entirely and nothing could be
      // pre-selected for them. Surfaced here, on intent to start, not proactively on modal open.
      if (!firmwareSelect.disabled && !firmwareSelect.value) {
        firmwareError.textContent =
          device.firmwareVersionId && !currentFirmwareAvailable
            ? S.app.rceFirmwareRetired(device.firmwareVersionId)
            : S.app.rceFirmwareRequired;
        firmwareError.hidden = false;
        return;
      }
      confirmBtn.disabled = true;
      cancelBtn.disabled = true;
      statusEl.textContent = '';
      const useSnapshot = useSnapshotCb.checked && snapshotState === 'loaded' && snapshotSelect.value !== '';
      const result = await onConfirm({
        ...(useSnapshot ? { snapshotId: Number(snapshotSelect.value) } : {}),
        ...(firmwareSelect.value ? { firmwareVersionId: firmwareSelect.value } : {}),
        maxRuntimeSeconds: maxRuntimeSecondsFromInputs()
      });
      if (!result || !result.success) {
        statusEl.textContent = result?.error || S.app.actionFailed(S.app.rceStartDevice);
        cancelBtn.disabled = false;
        syncSnapshotUi();
        return;
      }
      close();
    })();
  });
}
