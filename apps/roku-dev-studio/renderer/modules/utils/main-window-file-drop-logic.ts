/**
 * Pure decision logic behind the main-window file drop-zone
 * (`main-window-file-drop.ts`): which supported/unsupported/mixed state a
 * drag resolves to, what the overlay should say, and what the post-drop
 * toast should say. No DOM — split out purely so it's plain-Node testable
 * (see `scripts/verify-main-window-file-drop.ts`), same reason
 * `console-find-helpers.ts` is split from `console-find-bar.ts`.
 */
import { S } from '@shared/strings/index.js';
import { classifyAssociatedFile, type AssociatedFileKind } from '@shared/file-associations.js';

export type DragState = 'unknown' | 'supported' | 'unsupported' | 'mixed';

export type OpenDroppedFilesResult = {
  opened?: Array<{ name: string; kind: AssociatedFileKind }>;
  unsupported?: string[];
};

export function viewerLabelFor(kind: AssociatedFileKind): string {
  return kind === 'log' ? S.app.fileDropLogViewerLabel : S.app.fileDropNetworkSessionViewerLabel;
}

/** Classify a drag by the names of the files in it (best-effort — see
 *  main-window-file-drop.ts's module doc on pre-drop name availability).
 *  Empty `names` (e.g. the browser didn't expose any pre-drop) → 'unknown'. */
export function classifyDragNames(names: string[]): DragState {
  if (names.length === 0) return 'unknown';
  let sawSupported = false;
  let sawUnsupported = false;
  for (const name of names) {
    if (classifyAssociatedFile(name)) sawSupported = true;
    else sawUnsupported = true;
  }
  if (sawSupported && sawUnsupported) return 'mixed';
  return sawSupported ? 'supported' : 'unsupported';
}

/** Overlay copy for a given drag state. A single supported file names its
 *  viewer; multiple supported files stay generic since they could span both
 *  viewers. */
export function overlayText(state: DragState, names: string[]): string {
  if (state === 'unsupported') return S.app.fileDropOverlayUnsupported;
  if (state === 'mixed') return S.app.fileDropOverlayGeneric;
  if (state === 'supported') {
    if (names.length !== 1) return S.app.fileDropOverlayReadyMany;
    const kind = classifyAssociatedFile(names[0]!);
    return kind ? S.app.fileDropOverlayReadyOne(viewerLabelFor(kind)) : S.app.fileDropOverlayReadyMany;
  }
  return S.app.fileDropOverlayGeneric;
}

/** Decide the post-drop toast from main's `OpenDroppedFiles` reply. `null`
 *  means nothing was dropped — no toast. */
export function describeDropResult(
  result: OpenDroppedFilesResult | undefined
): { message: string; tone: 'success' | 'warning' } | null {
  const opened = result?.opened ?? [];
  const unsupported = result?.unsupported ?? [];
  if (opened.length === 0 && unsupported.length === 0) return null;
  if (unsupported.length === 0) {
    return {
      message: opened.length === 1 ? S.app.fileDropOpenedOne(opened[0]!.name, viewerLabelFor(opened[0]!.kind)) : S.app.fileDropOpenedMany(opened.length),
      tone: 'success'
    };
  }
  if (opened.length > 0) {
    return { message: S.app.fileDropOpenedWithSkipped(opened.length, unsupported.length), tone: 'success' };
  }
  return {
    message: unsupported.length === 1 ? S.app.fileDropUnsupportedOne(unsupported[0]!) : S.app.fileDropUnsupportedMany(unsupported.length),
    tone: 'warning'
  };
}
