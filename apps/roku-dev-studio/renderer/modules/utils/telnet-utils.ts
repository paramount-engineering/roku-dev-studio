// Telnet utility functions

export interface TelnetOutputCompleteOptions {
  substantialDataThreshold?: number;
  minWaitTime?: number;
  minDataAfterWait?: number;
  maxDataLength?: number;
}

/**
 * Detects if telnet output contains a command prompt
 */
function hasTelnetPrompt(trimmedNewData: string): boolean {
  return (
    trimmedNewData.endsWith('>') ||
    (trimmedNewData.includes('\n>') &&
      trimmedNewData.lastIndexOf('\n>') > trimmedNewData.indexOf('\n'))
  );
}

/**
 * Determines if telnet command output is complete
 */
export function isTelnetOutputComplete(
  newData: string,
  trimmedNewData: string,
  timeSinceCommand: number,
  options: TelnetOutputCompleteOptions = {}
): boolean {
  const {
    substantialDataThreshold = 20,
    minWaitTime = 3000,
    minDataAfterWait = 5,
    maxDataLength = 500
  } = options;

  const hasPrompt = hasTelnetPrompt(trimmedNewData);
  const hasSubstantialNewData = newData.length > substantialDataThreshold;
  const waitedEnough = timeSinceCommand > minWaitTime && newData.length > minDataAfterWait;

  return (hasPrompt && hasSubstantialNewData) || waitedEnough || newData.length > maxDataLength;
}
