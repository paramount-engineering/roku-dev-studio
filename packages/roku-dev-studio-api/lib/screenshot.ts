const { isValidIp, validateDevPassword } = require('./validate-input');
const {
  buildMultipartBody,
  httpDigestRequest,
  mapDeviceHttpError,
  responseLooksLikeAuthFailure
} = require('./http-digest');

interface CaptureRokuScreenshotOptions {
  ip: string;
  password: string;
  waitAfterTriggerMs?: number;
  retryWaitMs?: number;
  maxRetries?: number;
  minValidBytes?: number;
  log?: (msg: string) => void;
}

const SCREENSHOT_TIMEOUT_MS = 30000;

/**
 * Single implementation for capturing a screenshot from a Roku device.
 * Used by both the Electron main process (Dev App + Action Executor) and the
 * remote server, so behavior and error messages stay consistent.
 */
async function captureRokuScreenshot(options: CaptureRokuScreenshotOptions) {
  const {
    ip,
    password,
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

  const triggerCapture = async (): Promise<void> => {
    const { body, contentType } = buildMultipartBody(
      [
        { name: 'mysubmit', value: 'Screenshot' },
        { name: 'passwd', value: '' }
      ],
      []
    );
    log('Screenshot: triggering capture');
    const { statusCode, body: responseBody } = await httpDigestRequest({
      ip,
      password,
      path: '/plugin_inspect',
      method: 'POST',
      body,
      headers: { 'Content-Type': contentType },
      timeoutMs: SCREENSHOT_TIMEOUT_MS
    });
    const text = responseBody.toString('utf8');
    log(`Screenshot: capture response length ${text.length}`);
    if (statusCode === 401 || responseLooksLikeAuthFailure(statusCode, text)) {
      throw Object.assign(new Error('auth'), { authFailed: true });
    }
  };

  const downloadToBuffer = async (): Promise<Buffer> => {
    const { statusCode, body } = await httpDigestRequest({
      ip,
      password,
      path: '/pkgs/dev.jpg',
      method: 'GET',
      timeoutMs: SCREENSHOT_TIMEOUT_MS
    });
    if (statusCode === 401) {
      throw Object.assign(new Error('auth'), { authFailed: true });
    }
    return body;
  };

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
    await triggerCapture();
    let imageBuffer = await waitThenDownload(waitAfterTriggerMs);

    if (imageBuffer.length < minValidBytes) {
      log('Screenshot: first cycle failed, re-triggering and waiting longer');
      await triggerCapture();
      const longerWait = Math.max(waitAfterTriggerMs + 1000, 2500);
      imageBuffer = await waitThenDownload(longerWait);
    }

    if (imageBuffer.length < minValidBytes) {
      return {
        success: false,
        error:
          'Screenshot file is empty or invalid. Make sure a sideloaded channel is running. If this step follows a keypress or UI change (e.g. opening HUD), increase "Wait before capture" to 3000–4000 ms for this screenshot step. If the image appears truncated (cut off), increase "Wait before capture" as well.'
      };
    }

    return { success: true, imageBuffer };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { authFailed?: boolean }).authFailed) {
      return { success: false, error: 'Authentication failed. Check your developer password.', authFailed: true };
    }
    const mapped = mapDeviceHttpError(err, 'Screenshot');
    log(`Screenshot error: ${mapped.error}`);
    return mapped;
  }
}

module.exports = { captureRokuScreenshot };
