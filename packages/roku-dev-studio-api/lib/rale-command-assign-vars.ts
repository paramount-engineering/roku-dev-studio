'use strict';

/**
 * RALE wire commands whose result may be stored in `assignToVar` (read/query ops).
 * Registry clear/edit commands do not expose a meaningful bound value for later {{vars}}.
 */

const RALE_COMMANDS_WITH_ASSIGN_TO_VAR = new Set(['getNodeById', 'getNodeByName', 'getRegistrySections']);

/**
 * @param {unknown} command - wire command name (e.g. getNodeById)
 * @returns {boolean}
 */
function raleCommandSupportsAssignToVar(command: unknown): boolean {
  return typeof command === 'string' && RALE_COMMANDS_WITH_ASSIGN_TO_VAR.has(command.trim());
}

module.exports = {
  RALE_COMMANDS_WITH_ASSIGN_TO_VAR,
  raleCommandSupportsAssignToVar
};
