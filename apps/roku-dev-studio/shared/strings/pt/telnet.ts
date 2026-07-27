/**
 * UI strings for the Telnet / BrightScript debug console panel
 * (renderer/modules/telnet/telnet-console-panel.ts).
 *
 * Parametrized strings are functions returning the composed text — the standard way
 * to keep interpolation translatable without a runtime format library. Several leaves
 * here are the "--- … ---" session markers the console prints into its own log stream;
 * the interpolation + wording is preserved exactly (only centralised here).
 *
 * pt-BR (Brazilian Portuguese) translation.
 */
export const telnet = {
  // Connection status pill (right of the console header)
  statusConnecting: 'Conectando...',
  connectionFailed: 'Falha na conexão',
  connectionLost: 'Conexão perdida',
  unknownError: 'Erro desconhecido',
  errorStatusPrefix: (msg: string): string => `Erro: ${msg}`,

  // Empty-state placeholder (shown before the first connect)
  placeholderTitle: 'Conecte-se para ver a saída de depuração do BrightScript',
  placeholderHintDevMode: 'Requer o Modo de desenvolvedor ativado no dispositivo Roku.',
  placeholderHintSingleConn: 'Apenas uma conexão telnet com um dispositivo Roku pode estar ativa por vez.',

  // Live line counter (left of the status pill) + its hover tooltip
  linesCount: (countLabel: string, n: number): string => `${countLabel} ${n === 1 ? 'linha' : 'linhas'}`,
  spillTooltip: (bufferedLabel: string, totalLabel: string, spilledLabel: string, capHit: boolean): string =>
    `${bufferedLabel} de ${totalLabel} linhas — ${bufferedLabel} na memória, ${spilledLabel} transferidas para o disco` +
    (capHit ? ' (limite de disco atingido — linhas mais antigas descartadas)' : ''),

  // Session log lines the console prints into its own stream ("--- … ---")
  relayNoteSkipBuffer: ' (via relay, ignora o buffer de logs existente)',
  relayNoteReplayBuffer: ' (via relay, reproduz o buffer)',
  lineConnectedTo: (ip: string, relayNote: string): string => `--- Conectado a ${ip}:8085${relayNote} ---`,
  lineConnectionFailed: (err: string): string => `--- Falha na conexão: ${err} ---`,
  lineConnectionError: (msg: string): string => `--- Erro de conexão: ${msg} ---`,
  lineDisconnected: '--- Desconectado ---',
  lineError: (err: string): string => `--- Erro: ${err} ---`,
  lineConnectionClosed: (aliveStr: string | null, bytes: number): string => {
    let s = '--- Conexão encerrada';
    if (aliveStr !== null) s += ` (ativa ${aliveStr}`;
    if (bytes >= 0) s += `${aliveStr !== null ? ', ' : ' ('}recebidos ${bytes} bytes`;
    if (aliveStr !== null || bytes >= 0) s += ')';
    s += ' ---';
    return s;
  },
  hintNoLogData:
    '--- Dica: o Roku fechou o socket rapidamente sem dados de log. Verifique se nenhum outro cliente telnet está conectado a este dispositivo na porta 8085 (BrightScript IDE, outra janela do Dev Studio, uma sessão de terminal `telnet`, …) e se um canal sideloaded está em execução no momento. ---',
  hintAbnormalClose:
    '--- Dica: o fechamento do socket foi anormal (TCP RST ou similar). O Roku pode ter reiniciado ou outro cliente assumiu o vínculo da porta 8085. ---',

  // Copy button transient feedback (rendered next to a check icon — no ✓ prefix,
  // unlike common.copied, so the icon isn't doubled).
  copied: 'Copiado!',

  // Save button transient feedback + save dialog + saved-file header block
  saveNoLogs: 'Nenhum log',
  saving: 'Salvando...',
  saved: 'Salvo!',
  saveError: 'Erro',
  saveDialogTitle: 'Salvar logs do console',
  saveHeaderTitle: 'Logs do console do Roku',
  saveHeaderUnknownDevice: 'Desconhecido',
  saveHeaderDevice: (device: string, ip: string): string => `Dispositivo: ${device} (${ip})`,
  saveHeaderSaved: (when: string): string => `Salvo: ${when}`,
  saveHeaderTotalLines: (n: number): string => `Total de linhas: ${n}`,
};
