/**
 * Latin American Spanish (neutral) translation of the Telnet / BrightScript
 * debug console panel strings. Sibling of ../telnet.ts — same `telnet` shape,
 * keys, order, and function signatures.
 *
 * Parametrized strings are functions returning the composed text. The "--- … ---"
 * session markers keep their exact interpolation; only literal wording is
 * translated.
 */
export const telnet = {
  // Connection status pill (right of the console header)
  statusConnecting: 'Conectando...',
  connectionFailed: 'La conexión falló',
  connectionLost: 'Se perdió la conexión',
  unknownError: 'Error desconocido',
  errorStatusPrefix: (msg: string): string => `Error: ${msg}`,

  // Empty-state placeholder (shown before the first connect)
  placeholderTitle: 'Conéctese para ver la salida de depuración de BrightScript',
  placeholderHintDevMode: 'Requiere que el Modo de desarrollador esté habilitado en el dispositivo Roku.',
  placeholderHintSingleConn: 'Solo puede estar activa una conexión telnet a un dispositivo Roku a la vez.',

  // Live line counter (left of the status pill) + its hover tooltip
  linesCount: (countLabel: string, n: number): string => `${countLabel} ${n === 1 ? 'línea' : 'líneas'}`,
  spillTooltip: (bufferedLabel: string, totalLabel: string, spilledLabel: string, capHit: boolean): string =>
    `${bufferedLabel} de ${totalLabel} líneas — ${bufferedLabel} en memoria, ${spilledLabel} volcadas a disco` +
    (capHit ? ' (se alcanzó el límite de disco — se descartaron las líneas más antiguas)' : ''),

  // Session log lines the console prints into its own stream ("--- … ---")
  relayNoteSkipBuffer: ' (mediante relay, omitir el búfer de registros existente)',
  relayNoteReplayBuffer: ' (mediante relay, reproducir el búfer)',
  lineConnectedTo: (ip: string, relayNote: string): string => `--- Conectado a ${ip}:8085${relayNote} ---`,
  lineConnectionFailed: (err: string): string => `--- La conexión falló: ${err} ---`,
  lineConnectionError: (msg: string): string => `--- Error de conexión: ${msg} ---`,
  lineDisconnected: '--- Desconectado ---',
  lineError: (err: string): string => `--- Error: ${err} ---`,
  lineConnectionClosed: (aliveStr: string | null, bytes: number): string => {
    let s = '--- Conexión cerrada';
    if (aliveStr !== null) s += ` (activa ${aliveStr}`;
    if (bytes >= 0) s += `${aliveStr !== null ? ', ' : ' ('}se recibieron ${bytes} bytes`;
    if (aliveStr !== null || bytes >= 0) s += ')';
    s += ' ---';
    return s;
  },
  hintNoLogData:
    '--- Sugerencia: Roku cerró el socket rápidamente sin datos de registro. Verifique que ningún otro cliente telnet esté conectado a este dispositivo en el puerto 8085 (BrightScript IDE, otra ventana de Dev Studio, una sesión de terminal `telnet`, …) y que actualmente se esté ejecutando un canal cargado con sideload. ---',
  hintAbnormalClose:
    '--- Sugerencia: el cierre del socket fue anormal (TCP RST o similar). Es posible que Roku se haya reiniciado o que otro cliente haya tomado el enlace 8085. ---',

  // Copy button transient feedback (rendered next to a check icon — no ✓ prefix,
  // unlike common.copied, so the icon isn't doubled).
  copied: '¡Copiado!',

  // Save button transient feedback + save dialog + saved-file header block
  saveNoLogs: 'Sin registros',
  saving: 'Guardando...',
  saved: '¡Guardado!',
  saveError: 'Error',
  saveDialogTitle: 'Guardar registros de la consola',
  saveHeaderTitle: 'Registros de la consola de Roku',
  saveHeaderUnknownDevice: 'Desconocido',
  saveHeaderDevice: (device: string, ip: string): string => `Dispositivo: ${device} (${ip})`,
  saveHeaderSaved: (when: string): string => `Guardado: ${when}`,
  saveHeaderTotalLines: (n: number): string => `Total de líneas: ${n}`,
};
