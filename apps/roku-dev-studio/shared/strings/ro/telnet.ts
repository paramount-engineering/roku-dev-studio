/**
 * Romanian (ro) translation of the Telnet / BrightScript debug console panel
 * strings. Sibling of ../telnet.ts — same `telnet` shape, keys, order, and
 * function signatures.
 *
 * Parametrized strings are functions returning the composed text. The "--- … ---"
 * session markers keep their exact interpolation; count-driven text uses the
 * Romanian singular/plural + "de" rule. Only literal wording is translated.
 */
export const telnet = {
  // Connection status pill (right of the console header)
  statusConnecting: 'Se conectează...',
  connectionFailed: 'Conexiune eșuată',
  connectionLost: 'Conexiune pierdută',
  unknownError: 'Eroare necunoscută',
  errorStatusPrefix: (msg: string): string => `Eroare: ${msg}`,

  // Empty-state placeholder (shown before the first connect)
  placeholderTitle: 'Conectează-te pentru a vedea rezultatul de depanare BrightScript',
  placeholderHintDevMode: 'Necesită Developer Mode activat pe dispozitivul Roku.',
  placeholderHintSingleConn: 'O singură conexiune telnet la un dispozitiv Roku poate fi activă la un moment dat.',

  // Live line counter (left of the status pill) + its hover tooltip
  linesCount: (countLabel: string, n: number): string => {
    const word =
      n === 1 ? 'linie' :
      n % 100 === 0 || n % 100 >= 20 ? 'de linii' :
      'linii';
    return `${countLabel} ${word}`;
  },
  spillTooltip: (bufferedLabel: string, totalLabel: string, spilledLabel: string, capHit: boolean): string =>
    `${bufferedLabel} din ${totalLabel} linii — ${bufferedLabel} în memorie, ${spilledLabel} transferate pe disc` +
    (capHit ? ' (limita de disc atinsă — liniile mai vechi au fost eliminate)' : ''),

  // Session log lines the console prints into its own stream ("--- … ---")
  relayNoteSkipBuffer: ' (prin relay, se omite bufferul de jurnale existent)',
  relayNoteReplayBuffer: ' (prin relay, se reia bufferul)',
  lineConnectedTo: (ip: string, relayNote: string): string => `--- Conectat la ${ip}:8085${relayNote} ---`,
  lineConnectionFailed: (err: string): string => `--- Conexiune eșuată: ${err} ---`,
  lineConnectionError: (msg: string): string => `--- Eroare de conexiune: ${msg} ---`,
  lineDisconnected: '--- Deconectat ---',
  lineError: (err: string): string => `--- Eroare: ${err} ---`,
  lineConnectionClosed: (aliveStr: string | null, bytes: number): string => {
    let s = '--- Conexiune închisă';
    if (aliveStr !== null) s += ` (activă ${aliveStr}`;
    if (bytes >= 0) s += `${aliveStr !== null ? ', ' : ' ('}${bytes} octeți primiți`;
    if (aliveStr !== null || bytes >= 0) s += ')';
    s += ' ---';
    return s;
  },
  hintNoLogData:
    '--- Sugestie: Roku a închis rapid socketul fără date de jurnal. Verifică să nu fie conectat alt client telnet la acest dispozitiv pe portul 8085 (BrightScript IDE, o altă fereastră Dev Studio, o sesiune de terminal `telnet`, …) și ca un canal încărcat să ruleze momentan. ---',
  hintAbnormalClose:
    '--- Sugestie: închiderea socketului a fost anormală (TCP RST sau similar). Roku poate să fi repornit sau alt client a preluat legătura pe 8085. ---',

  // Copy button transient feedback (rendered next to a check icon — no ✓ prefix,
  // unlike common.copied, so the icon isn't doubled).
  copied: 'Copiat!',

  // Save button transient feedback + save dialog + saved-file header block
  saveNoLogs: 'Fără jurnale',
  saving: 'Se salvează...',
  saved: 'Salvat!',
  saveError: 'Eroare',
  saveDialogTitle: 'Salvează jurnalele consolei',
  saveHeaderTitle: 'Jurnale consolă Roku',
  saveHeaderUnknownDevice: 'Necunoscut',
  saveHeaderDevice: (device: string, ip: string): string => `Dispozitiv: ${device} (${ip})`,
  saveHeaderSaved: (when: string): string => `Salvat: ${when}`,
  saveHeaderTotalLines: (n: number): string => `Total linii: ${n}`,
};
