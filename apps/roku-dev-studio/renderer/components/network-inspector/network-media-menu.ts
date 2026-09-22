/**
 * Native right-click menu for a media preview (<img>/<video>/<audio>) in the detail panes: Copy Image
 * (images) + Save File… Shared by the live Network tab and the Session Viewer. The raw bytes/base64 are
 * available via the Raw format view, so there's no Copy-as-Data-URL item.
 */
import { S } from '@shared/strings/index.js';

export interface MediaMenuApi {
  showContextMenu?: (items: unknown) => Promise<unknown>;
  copyImage?: (opts: { dataUrl: string }) => Promise<unknown>;
  saveBinaryFile?: (opts: { base64: string; defaultName?: string; dialogTitle?: string }) => Promise<unknown>;
}

/** Map a media MIME to a sensible download extension. */
export function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/wav': 'wav',
    'audio/ogg': 'ogg'
  };
  return map[mime] || mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
}

export async function showMediaContextMenu(api: MediaMenuApi | undefined, dataUrl: string, isImage: boolean): Promise<void> {
  if (!api?.showContextMenu) return;
  const match = /^data:([^;,]*)[^,]*,(.*)$/s.exec(dataUrl);
  const mime = match?.[1] || 'application/octet-stream';
  const base64 = match?.[2] || '';
  const items: Array<Record<string, unknown>> = [];
  if (isImage) items.push({ label: S.networkInspector.copyImage, action: 'ni-copy-image' });
  items.push({ label: isImage ? S.networkInspector.saveImageAs : S.networkInspector.saveFile, action: 'ni-save-media' });
  let res: { action?: string } | null = null;
  try {
    res = (await api.showContextMenu(items)) as { action?: string } | null;
  } catch {
    return;
  }
  if (!res) return;
  if (res.action === 'ni-copy-image') {
    await api.copyImage?.({ dataUrl });
  } else if (res.action === 'ni-save-media') {
    await api.saveBinaryFile?.({
      base64,
      defaultName: `response-${Date.now()}.${mimeToExt(mime)}`,
      dialogTitle: isImage ? S.networkInspector.saveImageDialog : S.networkInspector.saveFileDialog
    });
  }
}

/** Right-click on a data-URL media preview inside `detailPane` opens the menu (delegated). */
export function bindMediaContextMenu(
  detailPane: HTMLElement,
  api: () => MediaMenuApi | undefined,
  listenerOptions?: AddEventListenerOptions
): void {
  detailPane.addEventListener(
    'contextmenu',
    (e) => {
      const target = e.target as HTMLElement | null;
      const mediaEl = target?.closest('.ni-media-img, .ni-media-el, .ni-media-audio') as
        | HTMLImageElement
        | HTMLMediaElement
        | null;
      const dataUrl = mediaEl?.getAttribute('src') || '';
      if (!dataUrl.startsWith('data:')) return;
      e.preventDefault();
      void showMediaContextMenu(api(), dataUrl, mediaEl instanceof HTMLImageElement);
    },
    listenerOptions
  );
}
