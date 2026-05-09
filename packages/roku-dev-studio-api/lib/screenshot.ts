import type { ExecOptions } from 'child_process';

const { isValidIp, validateDevPassword } = require('./validate-input');
const { errorMessage } = require('./err-util');

type ExecFn = typeof import('child_process').exec;

interface CaptureRokuScreenshotOptions {
  ip: string;
  password: string;
  exec?: ExecFn;
  waitAfterTriggerMs?: number;
  retryWaitMs?: number;
  maxRetries?: number;
  minValidBytes?: number;
  log?: (msg: string) => void;
}

/**
 * Single implementation for capturing a screenshot from a Roku device.
 * Used by both the Electron main process (Dev App + Action Executor) and the
 * remote server, so behavior and error messages stay consistent.
 *
 * @param {Object} options
 * @param {string} options.ip - Roku device IP
 * @param {string} options.password - Developer password
 * @param {Object} [options.exec] - Optional child_process.exec (defaults to require('child_process').exec)
 * @param {number} [options.waitAfterTriggerMs=1500] - Ms to wait after trigger before first download (increase if image is truncated)
 * @param {number} [options.retryWaitMs=1500] - Ms to wait before each retry if file too small (longer when UI is updating e.g. HUD)
 * @param {number} [options.maxRetries=4] - Number of retries after first failed download (4 = 5 attempts total per cycle)
 * @param {number} [options.minValidBytes=1000] - Minimum size for a valid image
 * @param {Function} [options.log] - Optional log(msg) for debug
 * @returns {Promise<{ success: true, imageBuffer: Buffer } | { success: false, error: string, authFailed?: boolean }>}
 */
async function captureRokuScreenshot(options: CaptureRokuScreenshotOptions) {
  const {
    ip,
    password,
    exec = require('child_process').exec,
    waitAfterTriggerMs = 1500,
    retryWaitMs = 1500,
    maxRetries = 4,
    minValidBytes = 1000,
    log = (_m: string) => undefined
  } = options;

  if (!isValidIp(ip)) {
    return { success: false, error: 'Invalid device IP address' };
  }
  const pwdCheck = validateDevPassword(password);
  if (!pwdCheck.valid) {
    return { success: false, error: pwdCheck.error || 'Invalid developer password' };
  }

  const auth = `rokudev:${password}`;
  const captureCommand = `curl -s -S --digest -u "${auth}" -F "mysubmit=Screenshot" -F "passwd=" http://${ip}/plugin_inspect`;
  const downloadCommand = `curl -s -S --digest -u "${auth}" "http://${ip}/pkgs/dev.jpg"`;

  const run = (cmd: string, opts: ExecOptions = {}) =>
    new Promise<string | Buffer>((resolve, reject) => {
      exec(cmd, { timeout: 30000, ...opts }, (err: Error | null, stdout: string | Buffer, _stderr: string | Buffer) => {
        if (err) reject(err);
        else resolve(stdout);
      });
    });

  const downloadToBuffer = () =>
    new Promise<Buffer>((resolve, reject) => {
      exec(
        downloadCommand,
        { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 30000 },
        (err: Error | null, stdout: string | Buffer) => {
          if (err) return reject(err);
          resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.alloc(0));
        }
      );
    });

  const waitThenDownload = async (afterTriggerWait: number): Promise<Buffer> => {
    await new Promise((r) => setTimeout(r, afterTriggerWait));
    let buf = await downloadToBuffer();
    log(`Screenshot: download length ${buf?.length || 0} bytes`);
    for (let attempt = 0; buf.length < minValidBytes && attempt < maxRetries; attempt++) {
      await new Promise((r) => setTimeout(r, retryWaitMs));
      buf = await downloadToBuffer();
      log(`Screenshot: retry ${attempt + 1} download length ${buf?.length || 0} bytes`);
    }
    return buf;
  };

  try {
    log('Screenshot: triggering capture');
    let captureStdout = await run(captureCommand);
    log(`Screenshot: capture response length ${captureStdout?.length || 0}`);

    if (typeof captureStdout === 'string' && (captureStdout.includes('401') || captureStdout.includes('Authentication'))) {
      return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
    }

    let imageBuffer = await waitThenDownload(waitAfterTriggerMs);

    if (imageBuffer.length < minValidBytes) {
      log('Screenshot: first cycle failed, re-triggering and waiting longer');
      captureStdout = await run(captureCommand);
      const longerWait = Math.max(waitAfterTriggerMs + 1000, 2500);
      imageBuffer = await waitThenDownload(longerWait);
    }

    if (imageBuffer.length < minValidBytes) {
      return {
        success: false,
        error: 'Screenshot file is empty or invalid. Make sure a sideloaded channel is running. If this step follows a keypress or UI change (e.g. opening HUD), increase "Wait before capture" to 3000–4000 ms for this screenshot step. If the image appears truncated (cut off), increase "Wait before capture" as well.'
      };
    }

    return { success: true, imageBuffer };
  } catch (err: unknown) {
    const msg = errorMessage(err);
    log(`Screenshot error: ${msg}`);
    return { success: false, error: `Screenshot failed: ${msg}` };
  }
}

module.exports = { captureRokuScreenshot };
