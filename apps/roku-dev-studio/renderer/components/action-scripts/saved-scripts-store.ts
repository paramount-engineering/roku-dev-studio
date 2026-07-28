/**
 * App-managed store for Action Scripts saved BY NAME (the default in-app "Save" path). Backed by a
 * per-file library under userData (NOT app-settings.json — scripts can be large, so keeping them
 * inline would bloat every settings read/write):
 *   <userData>/action-scripts/index.json        — tiny: [{ id, name, savedAt }]
 *   <userData>/action-scripts/scripts/<id>.json  — one file per script: { version, steps }
 * via the `actionScriptsList` / `actionScriptsRead` / `actionScriptsSave` preload bridge
 * (main handlers in `main/ipc/system-handlers.ts`).
 *
 * This renderer keeps only the small index in memory ({@link listSavedScripts}); a script's actual
 * content is fetched on demand ({@link loadSavedScript}).
 */
import { rendererError } from '../../modules/utils/logger.js';

/** Index entry — name-only metadata for the picker + duplicate check (no script body). */
export type SavedScriptMeta = { id: string; name: string; savedAt: number };
/** A script's on-disk content — the same `{ version, steps }` shape the builder exports. */
export type ActionScriptContent = { version?: string; steps: unknown[] };

let index: SavedScriptMeta[] = [];
let loadPromise: Promise<void> | null = null;

function genId(): string {
  const buf = new Uint8Array(6);
  window.crypto.getRandomValues(buf);
  const rand = Array.from(buf)
    .map((n) => (n % 36).toString(36))
    .join('');
  return `as-${Date.now()}-${rand}`;
}

function normalizeIndex(list: unknown): SavedScriptMeta[] {
  if (!Array.isArray(list)) return [];
  const out: SavedScriptMeta[] = [];
  for (const e of list) {
    if (e && typeof e === 'object' && typeof (e as SavedScriptMeta).id === 'string' && typeof (e as SavedScriptMeta).name === 'string') {
      const m = e as SavedScriptMeta;
      out.push({ id: m.id, name: m.name, savedAt: typeof m.savedAt === 'number' ? m.savedAt : 0 });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return out;
}

/** Load the saved-scripts index once (idempotent; concurrent callers share one request). */
export function ensureSavedScriptsLoaded(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const res = await window.roku?.actionScriptsList?.();
        if (res?.success) index = normalizeIndex(res.scripts);
      } catch (e) {
        rendererError('[Action Scripts] Failed to list saved scripts:', e);
      }
    })();
  }
  return loadPromise;
}

/** In-memory snapshot of the saved-script index (call {@link ensureSavedScriptsLoaded} first). */
export function listSavedScripts(): SavedScriptMeta[] {
  return [...index];
}

/** Fetch one saved script's content by id (reads its file). Returns null if missing/invalid. */
export async function loadSavedScript(id: string): Promise<ActionScriptContent | null> {
  try {
    const res = await window.roku?.actionScriptsRead?.(id);
    if (res?.success && res.script && typeof res.script === 'object' && Array.isArray(res.script.steps)) {
      return res.script as ActionScriptContent;
    }
  } catch (e) {
    rendererError('[Action Scripts] Failed to read saved script:', e);
  }
  return null;
}

/** Delete a saved script by id (removes its file + index entry). Refreshes the in-memory index. */
export async function deleteSavedScript(id: string): Promise<boolean> {
  try {
    const res = await window.roku?.actionScriptsDelete?.(id);
    if (!res?.success) return false;
    if (Array.isArray(res.scripts)) index = normalizeIndex(res.scripts);
    return true;
  } catch (e) {
    rendererError('[Action Scripts] Failed to delete saved script:', e);
    return false;
  }
}

/**
 * Upsert a script by name (case-insensitive match reuses the same id/file, else a new one) and
 * persist. Returns whether an existing entry was overwritten. Throws if the persist fails.
 */
export async function saveScriptToApp(
  name: string,
  script: ActionScriptContent
): Promise<{ overwritten: boolean }> {
  await ensureSavedScriptsLoaded();
  const trimmed = name.trim();
  const key = trimmed.toLowerCase();
  const existing = index.find((s) => s.name.trim().toLowerCase() === key);
  const id = existing?.id ?? genId();
  try {
    const res = await window.roku?.actionScriptsSave?.({ id, name: trimmed, script });
    if (!res?.success) throw new Error((res && res.error) || 'save failed');
    if (Array.isArray(res.scripts)) index = normalizeIndex(res.scripts);
  } catch (e) {
    rendererError('[Action Scripts] Failed to save script:', e);
    throw e;
  }
  return { overwritten: !!existing };
}
