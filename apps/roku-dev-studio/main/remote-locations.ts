/**
 * Shared reader for the persisted `remote-locations` setting (connected remote
 * RDS servers). One implementation used by the Settings window and the Sideload
 * Relay device discovery.
 */

export interface RemoteLocationInfo {
  id: string;
  name: string;
  serverUrl: string;
  host: string;
}

export function readRemoteLocations(settings: Record<string, unknown>): RemoteLocationInfo[] {
  const raw = settings['remote-locations'];
  if (!Array.isArray(raw)) return [];
  const out: RemoteLocationInfo[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const serverUrl = typeof o.serverUrl === 'string' ? o.serverUrl : '';
    if (!serverUrl) continue;
    let host = typeof o.host === 'string' && o.host.trim() ? o.host.trim() : '';
    if (!host) {
      try {
        host = new URL(serverUrl).hostname;
      } catch {
        host = '';
      }
    }
    out.push({
      id: typeof o.id === 'string' ? o.id : serverUrl,
      name: typeof o.name === 'string' && o.name.trim() ? o.name : serverUrl,
      serverUrl,
      host
    });
  }
  return out;
}
