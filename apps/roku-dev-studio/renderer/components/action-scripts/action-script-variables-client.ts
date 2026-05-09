/**
 * Action Script variables helpers from roku-dev-studio-api (via preload bridge).
 * The package file is CommonJS for Node/script-runner; renderer loads it through preload.
 */

function getApi(): any {
  const a = typeof window !== 'undefined' && window.actionScriptVariables;
  if (!a) {
    throw new Error(
      'actionScriptVariables missing: preload must expose roku-dev-studio-api/lib/action-script-variables.js'
    );
  }
  return a;
}

export function validateOutputFields(script) {
  return getApi().validateOutputFields(script);
}

export function getAssignToVarName(step) {
  return getApi().getAssignToVarName(step);
}

export function resolveStepWithVariables(step, variables) {
  return getApi().resolveStepWithVariables(step, variables);
}

/** @param {string} command */
export function raleCommandSupportsAssignToVar(command) {
  return getApi().raleCommandSupportsAssignToVar(command);
}

/** @param {string} pathStr */
export function parseVariableDotPath(pathStr) {
  return getApi().parseVariableDotPath(pathStr);
}
