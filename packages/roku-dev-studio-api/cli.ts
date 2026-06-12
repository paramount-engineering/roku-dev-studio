#!/usr/bin/env node
/**
 * Roku Dev Studio CLI — `rds`
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const readline = require('readline');
const { Command } = require('commander');
const raleDirect = require('./lib/rale-direct');
const { DEFAULT_RALE_PORT } = raleDirect;
const api = require('./index');
const { runActionScript, validateScriptStructure, validateScriptStructureRich } = require('./lib/script-runner');
const { parseGetExternalControlFunctionsResponse } = require('./lib/rale-functions-normalize');
const { errorMessage } = require('./lib/err-util');

function collectGlobals(program) {
  const root = program.opts();
  const password = root.password || process.env.ROKU_DEV_PASSWORD || '';
  const raleT = root.raleTimeout != null ? parseInt(String(root.raleTimeout), 10) : 60000;
  return {
    json: !!root.json,
    quiet: !!root.quiet,
    ip: root.ip || '',
    relay: root.relay || '',
    password,
    timeout: root.timeout != null ? parseInt(String(root.timeout), 10) : undefined,
    raleTimeoutMs: Number.isFinite(raleT) && raleT > 0 ? raleT : 60000
  };
}

/** After a RALE TCP timeout, suggest common fixes (direct LAN). */
function maybePrintRaleTimeoutHint(ctx, errMsg, ralePort) {
  if (ctx.quiet || errMsg == null) return;
  if (!/timed out|timeout/i.test(String(errMsg))) return;
  const p = ralePort != null && Number.isFinite(ralePort) ? ralePort : DEFAULT_RALE_PORT;
  console.error('');
  console.error(`RALE did not return a complete [start]…[end] message before the timeout (TCP port ${p}).`);
  console.error(`  • --rale-port must match TrackerTask / App Connector in your channel (default ${DEFAULT_RALE_PORT} in Dev Studio).`);
  console.error('  • The sideloaded dev app should be in the foreground with TrackerTask running.');
  console.error(`  • Try: rds rale wake --ip ${ctx.ip || '<ip>'} --rale-port ${p}`);
  console.error('  • Increase wait: --rale-timeout 120000');
}

function requireIp(ctx) {
  if (!ctx.ip || !api.isValidIp(ctx.ip)) {
    console.error('Error: --ip <ipv4> is required and must be a valid IPv4 address.');
    process.exit(2);
  }
}

function requirePassword(ctx) {
  const check = api.validateDevPassword(ctx.password);
  if (!check.valid) {
    console.error(`Error: ${check.error || 'Developer password required (--password or ROKU_DEV_PASSWORD).'}`);
    process.exit(2);
  }
}

async function warnRelayApiVersionMismatch(client: { health?: () => Promise<Record<string, unknown>> }, ctx: { quiet?: boolean }) {
  if (ctx.quiet || typeof client.health !== 'function') return;
  try {
    const health = await client.health();
    const remoteVer = health && typeof health.apiVersion === 'string' ? health.apiVersion : '';
    if (remoteVer && remoteVer !== api.PACKAGE_VERSION) {
      console.error(
        `Warning: relay apiVersion ${remoteVer} differs from this CLI (${api.PACKAGE_VERSION}). Update the remote server for matching sideload/screenshot behavior.`
      );
    }
  } catch {
    // Non-fatal — relay may not expose /health yet.
  }
}

function getTransport(ctx) {
  if (ctx.relay) {
    try {
      const client = api.createRelayClient({ baseUrl: ctx.relay });
      return { mode: 'relay', client };
    } catch (e: unknown) {
      console.error(`Error: ${errorMessage(e)}`);
      process.exit(2);
    }
  }
  return { mode: 'direct' };
}

function tipUnknownChannel404(appId, ctx) {
  if (ctx.quiet) return;
  const id = String(appId || '');
  if (id === '12') {
    console.error(
      'Tip: "12" is just an example in some docs — it is not your dev channel. For the sideloaded developer app use: rds launch dev --ip <ip>'
    );
    return;
  }
  console.error(
    'Tip: List installed channel ids: rds ecp query /query/apps --ip <ip>   Sideloaded developer channel is usually id "dev".'
  );
}

function exitFromSuccess(ctx, result, humanOk) {
  if (result && result.success === false) {
    if (!ctx.quiet) console.error(result.error || 'Operation failed');
    if (ctx.json) console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (ctx.json) {
    console.log(JSON.stringify(result != null ? result : { success: true }, null, 2));
  } else if (typeof humanOk === 'function') {
    humanOk(result);
  }
}

function dataUrlToBuffer(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return Buffer.from(m[2], 'base64');
}

/**
 * iTerm2 OSC 1337 inline image (also supported by WezTerm and several other terminals).
 * @see https://iterm2.com/documentation-images.html
 */
function writeTerminalInlineImage(buf, { width = 'auto' } = {}) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) return;
  const size = buf.length;
  const header = `\x1b]1337;File=inline=1;size=${size};width=${width};height=auto;preserveAspectRatio=1:`;
  process.stdout.write(header + buf.toString('base64') + '\x07\n');
}

/** Terminals known to render iTerm2 OSC 1337 inline images. */
function terminalSupportsOsc1337Inline() {
  if (process.env.RDS_FORCE_INLINE === '1') return true;
  if (process.env.ITERM_SESSION_ID) return true;
  if (process.env.TERM_PROGRAM === 'iTerm.app') return true;
  if (process.env.WEZTERM_EXECUTABLE) return true;
  if (process.env.KITTY_PID) return true;
  if (process.env.TERM === 'xterm-kitty') return true;
  return false;
}

function canAutoOpenPreview() {
  if (process.env.CI) return false;
  if (process.env.RDS_INLINE_NO_PREVIEW === '1') return false;
  return process.stdout.isTTY === true;
}

function openImageInDefaultApp(filePath) {
  try {
    if (process.platform === 'darwin') {
      execFileSync('open', [filePath], { stdio: 'ignore' });
    } else if (process.platform === 'win32') {
      execFileSync('cmd', ['/c', 'start', '', filePath], { stdio: 'ignore', windowsHide: true });
    } else {
      execFileSync('xdg-open', [filePath], { stdio: 'ignore' });
    }
  } catch (e: unknown) {
    console.error('Could not open image:', errorMessage(e));
  }
}

/** ECP GET path for /query/... */
function normalizeEcpQueryPath(endpoint) {
  let ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (ep.startsWith('/query/')) return ep;
  return `/query${ep}`;
}

/** Relay post() expects ECP path *without* /post prefix (client adds /post). */
function normalizeEcpPostPathForRelay(endpoint) {
  let ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (ep.startsWith('/post/')) return ep.replace(/^\/post/, '') || '/';
  return ep;
}

async function main() {
  const program = new Command();

  program
    .name('rds')
    .version(api.PACKAGE_VERSION, '-V, --version', 'Print rds (roku-dev-studio-api) version and exit')
    .description('Roku Dev Studio CLI — discovery, ECP, sideload, screenshot (direct or relay)')
    .option('--json', 'Print structured JSON to stdout')
    .option('--quiet', 'Suppress stderr messages')
    .option('--ip <ipv4>', 'Target device IPv4')
    .option('--relay <url>', 'Relay base URL (Roku Dev Studio Remote Server)')
    .option('--password <pwd>', 'Developer password (or set ROKU_DEV_PASSWORD)')
    .option('--timeout <ms>', 'Request timeout in ms (direct ECP)')
    .option(
      '--rale-timeout <ms>',
      'Max wait per RALE command for a complete [start]…[end] response from the device',
      '60000'
    )
    .configureHelp({ helpWidth: 88 });

  program
    .command('discover')
    .description('Discover Roku devices (SSDP, subnet, or relay list)')
    .option('--method <mode>', 'ssdp | subnet | both (direct only)', 'ssdp')
    .action(async (options) => {
      const ctx = collectGlobals(program);
      const t = getTransport(ctx);
      try {
        if (t.mode === 'relay') {
          const devices = await t.client.discover();
          if (ctx.json) {
            console.log(JSON.stringify(devices, null, 2));
          } else if (!devices.length) {
            console.log('No devices reported by relay.');
          } else {
            devices.forEach((d) => {
              const ip = d.ip || d.deviceIp || '?';
              const name = d.deviceName || d.friendlyDeviceName || '';
              console.log(`${ip}\t${name}`);
            });
          }
          return;
        }
        const method = (options.method || 'ssdp').toLowerCase();
        let devices: unknown[] = [];
        if (method === 'subnet') {
          devices = await api.subnetScan({});
        } else if (method === 'both') {
          const [a, b] = await Promise.all([api.ssdpDiscover({}), api.subnetScan({})]);
          const seen = new Set();
          devices = [];
          for (const d of [...a, ...b]) {
            if (d.ip && !seen.has(d.ip)) {
              seen.add(d.ip);
              devices.push(d);
            }
          }
        } else {
          devices = await api.ssdpDiscover({});
        }
        if (ctx.json) {
          console.log(JSON.stringify(devices, null, 2));
        } else if (!devices.length) {
          console.log('No devices found.');
        } else {
          devices.forEach((d: unknown) => {
            const o = d as Record<string, unknown>;
            const name = String(o.deviceName || o['friendly-device-name'] || '');
            console.log(`${o.ip}\t${name}`);
          });
        }
      } catch (e: unknown) {
        if (!ctx.quiet) console.error(errorMessage(e));
        process.exit(1);
      }
    });

  const deviceCmd = program.command('device').description('Device information');
  deviceCmd
    .command('info')
    .description('Fetch /query/device-info (parsed object)')
    .action(async () => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const t = getTransport(ctx);
      try {
        if (t.mode === 'relay') {
          const info = await t.client.getDeviceInfo(ctx.ip);
          if (ctx.json) console.log(JSON.stringify(info, null, 2));
          else console.log(JSON.stringify(info, null, 2));
          return;
        }
        const info = await api.getDeviceInfo(ctx.ip, {
          timeout: ctx.timeout,
          includeSameSubnet: true
        });
        if (ctx.json) console.log(JSON.stringify(info, null, 2));
        else console.log(JSON.stringify(info, null, 2));
      } catch (e: unknown) {
        if (!ctx.quiet) console.error(errorMessage(e));
        process.exit(1);
      }
    });

  const ecpCmd = program.command('ecp').description('ECP HTTP requests');
  ecpCmd
    .command('query <endpoint>')
    .description('GET ECP path (e.g. /query/device-info or query/apps)')
    .action(async (endpoint) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const pathEcp = normalizeEcpQueryPath(endpoint);
      const t = getTransport(ctx);
      if (t.mode === 'relay') {
        const result = await t.client.query(ctx.ip, pathEcp);
        exitFromSuccess(ctx, result, () => {
          if (result && result.data != null) process.stdout.write(String(result.data));
        });
        return;
      }
      const result = await api.query(ctx.ip, pathEcp, { timeout: ctx.timeout });
      exitFromSuccess(ctx, result, () => {
        if (result && result.data != null) process.stdout.write(String(result.data));
      });
    });

  ecpCmd
    .command('post <endpoint>')
    .description('POST to ECP path (direct: optional --body; relay: body not supported)')
    .option('--body <string>', 'Request body (direct mode only)')
    .action(async (endpoint, options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      let ep = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const t = getTransport(ctx);
      if (t.mode === 'relay') {
        if (options.body) {
          console.error('Error: ecp post --body is only supported in direct mode.');
          process.exit(2);
        }
        const relayPath = normalizeEcpPostPathForRelay(endpoint);
        const result = await t.client.post(ctx.ip, relayPath);
        exitFromSuccess(ctx, result, () => {
          if (result && result.data != null) process.stdout.write(String(result.data));
          else if (!ctx.quiet) console.log(JSON.stringify(result, null, 2));
        });
        return;
      }
      const result = await api.ecpRequest(
        ctx.ip,
        { path: ep, method: 'POST', body: options.body || undefined },
        { timeout: ctx.timeout }
      );
      exitFromSuccess(ctx, result, () => {
        if (result && result.data != null) process.stdout.write(String(result.data));
      });
    });

  program
    .command('keypress <key>')
    .description('Send remote key (e.g. Home, Select, Left)')
    .action(async (key) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const t = getTransport(ctx);
      if (t.mode === 'relay') {
        const result = await t.client.keypress(ctx.ip, key);
        exitFromSuccess(ctx, result, () => console.log('OK'));
        return;
      }
      const result = await api.keypress(ctx.ip, key, { timeout: ctx.timeout });
      exitFromSuccess(ctx, result, () => console.log('OK'));
    });

  program
    .command('launch <appId>')
    .description(
      'Launch channel by ECP app id (e.g. dev = sideloaded developer channel; list: ecp query /query/apps)'
    )
    .option('--params <query>', 'Query string, e.g. contentID=123')
    .action(async (appId, options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const t = getTransport(ctx);
      const params = options.params && String(options.params).trim() ? options.params : undefined;
      if (t.mode === 'relay') {
        const result = await t.client.launch(ctx.ip, appId, { params: params || '' });
        if (result && result.success === false && result.statusCode === 404) tipUnknownChannel404(appId, ctx);
        exitFromSuccess(ctx, result, () => console.log('OK'));
        return;
      }
      const result = await api.launch(ctx.ip, appId, params, { timeout: ctx.timeout });
      if (result && result.success === false && result.statusCode === 404) tipUnknownChannel404(appId, ctx);
      exitFromSuccess(ctx, result, () => console.log('OK'));
    });

  program
    .command('input-text <text>')
    .description(
      'Send text via Lit_ keypress per character (same as RDS Tool Send Text); field/keyboard must have focus'
    )
    .option('--key-delay <ms>', 'Milliseconds between keys (default 100)', '100')
    .action(async (text, options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const delayParsed = parseInt(String(options.keyDelay), 10);
      const inputKeyDelayMs = Number.isFinite(delayParsed) && delayParsed >= 0 ? delayParsed : 100;
      const keyTimeout = ctx.timeout != null ? ctx.timeout : 2000;
      const t = getTransport(ctx);
      if (t.mode === 'relay') {
        const result = await t.client.inputText(ctx.ip, text);
        exitFromSuccess(ctx, result, () => console.log('OK'));
        return;
      }
      const result = await api.inputText(ctx.ip, text, {
        timeout: keyTimeout,
        inputKeyDelayMs
      });
      exitFromSuccess(ctx, result, () => console.log('OK'));
    });

  program
    .command('deeplink <appId>')
    .description('Launch with contentID / mediaType')
    .option('--content-id <id>', 'contentID')
    .option('--media-type <type>', 'mediaType')
    .action(async (appId, options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const t = getTransport(ctx);
      if (t.mode === 'relay') {
        const result = await t.client.deeplink(ctx.ip, appId, options.contentId, options.mediaType);
        if (result && result.success === false && result.statusCode === 404) tipUnknownChannel404(appId, ctx);
        exitFromSuccess(ctx, result, () => console.log('OK'));
        return;
      }
      const result = await api.deeplink(ctx.ip, appId, options.contentId, options.mediaType, {
        timeout: ctx.timeout
      });
      if (result && result.success === false && result.statusCode === 404) tipUnknownChannel404(appId, ctx);
      exitFromSuccess(ctx, result, () => console.log('OK'));
    });

  program
    .command('test-connection')
    .description('Ping device via device-info')
    .action(async () => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const t = getTransport(ctx);
      if (t.mode === 'relay') {
        try {
          const info = await t.client.getDeviceInfo(ctx.ip);
          if (ctx.json) console.log(JSON.stringify({ success: true, deviceInfo: info }, null, 2));
          else console.log('OK', ctx.ip);
        } catch (e: unknown) {
          if (!ctx.quiet) console.error(errorMessage(e));
          process.exit(1);
        }
        return;
      }
      const result = await api.testConnection(ctx.ip, { timeout: ctx.timeout });
      exitFromSuccess(ctx, result, () => console.log('OK', ctx.ip));
    });

  program
    .command('sideload [path]')
    .description('Install channel package (.zip / .pkg), or: rds sideload delete')
    .action(async (filePath) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      if (filePath === 'delete') {
        requirePassword(ctx);
        const t = getTransport(ctx);
        if (t.mode === 'relay') {
          await warnRelayApiVersionMismatch(t.client, ctx);
          const result = await t.client.deleteSideload(ctx.ip, ctx.password);
          exitFromSuccess(ctx, result, () => console.log(result.message || 'Deleted'));
          return;
        }
        const result = await api.deleteSideload({ ip: ctx.ip, password: ctx.password });
        exitFromSuccess(ctx, result, () => console.log(result.message || 'Deleted'));
        return;
      }
      if (!filePath) {
        console.error('Usage: rds sideload <package.zip|pkg>   or   rds sideload delete');
        process.exit(2);
      }
      requirePassword(ctx);
      const abs = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(abs)) {
        console.error(`Error: file not found: ${abs}`);
        process.exit(2);
      }
      const t = getTransport(ctx);
      if (t.mode === 'relay') {
        await warnRelayApiVersionMismatch(t.client, ctx);
        const result = await t.client.sideload(ctx.ip, {
          file: abs,
          password: ctx.password
        });
        exitFromSuccess(ctx, result, () => console.log(result.message || 'Sideload complete'));
        return;
      }
      const result = await api.sideloadChannel({
        ip: ctx.ip,
        filePath: abs,
        password: ctx.password
      });
      exitFromSuccess(ctx, result, () => console.log(result.message || 'Sideload complete'));
    });

  program
    .command('screenshot [outfile]')
    .description(
      'Capture dev screenshot to JPEG. --inline uses OSC 1337 (iTerm2/WezTerm); Cursor/VS Code get --preview instead.'
    )
    .option('--wait-after-trigger <ms>', 'Ms after trigger before download', '1500')
    .option('--inline', 'Show image in terminal (OSC 1337) if supported; else open default viewer')
    .option('--inline-width <w>', 'Display width for --inline (auto, Npx, or N percent of the terminal)', 'auto')
    .option('--preview', 'Open the JPEG in the default app (after save, or from a temp file if no outfile)')
    .action(async (outfile, options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      requirePassword(ctx);
      const wantInlineFlag = !!options.inline;
      const wantPreviewFlag = !!options.preview;
      if (!outfile && !wantInlineFlag && !wantPreviewFlag) {
        console.error(
          'Error: provide [outfile] and/or --inline / --preview (e.g. rds screenshot --inline --ip …).'
        );
        process.exit(2);
      }
      if (ctx.json && wantInlineFlag && !ctx.quiet) {
        console.error('Note: --inline display is disabled when --json is set.');
      }
      if (ctx.json && wantPreviewFlag && !ctx.quiet) {
        console.error('Note: --preview is disabled when --json is set.');
      }

      const supportsOsc = terminalSupportsOsc1337Inline();
      const wantInlineOsc = wantInlineFlag && !ctx.json && supportsOsc;
      const inlineFallbackPreview =
        wantInlineFlag && !ctx.json && !supportsOsc && canAutoOpenPreview();
      const wantPreview = wantPreviewFlag && !ctx.json;
      const shouldOpen =
        wantPreview || inlineFallbackPreview;

      const waitMs = parseInt(String(options.waitAfterTrigger), 10);
      const waitAfterTriggerMs = Number.isFinite(waitMs) && waitMs >= 0 ? waitMs : 1500;
      const t = getTransport(ctx);
      const outAbs = outfile ? path.resolve(process.cwd(), outfile) : null;

      let buf;
      if (t.mode === 'relay') {
        await warnRelayApiVersionMismatch(t.client, ctx);
        const result = await t.client.screenshot(ctx.ip, {
          password: ctx.password,
          waitAfterTriggerMs
        });
        if (!result.success) {
          if (!ctx.quiet) console.error(result.error || 'Screenshot failed');
          if (ctx.json) console.log(JSON.stringify(result, null, 2));
          process.exit(1);
        }
        buf = dataUrlToBuffer(result.url);
        if (!buf || buf.length < 100) {
          if (!ctx.quiet) console.error('Invalid image data from relay');
          process.exit(1);
        }
      } else {
        const result = await api.captureRokuScreenshot({
          ip: ctx.ip,
          password: ctx.password,
          waitAfterTriggerMs
        });
        if (!result.success) {
          if (!ctx.quiet) console.error(result.error || 'Screenshot failed');
          if (ctx.json) console.log(JSON.stringify(result, null, 2));
          process.exit(1);
        }
        buf = result.imageBuffer;
      }

      if (outAbs) {
        fs.writeFileSync(outAbs, buf);
      }

      let tmpPath = null;
      let pathToOpen = null;
      if (shouldOpen) {
        pathToOpen = outAbs || (tmpPath = path.join(os.tmpdir(), `rds-screenshot-${Date.now()}.jpg`));
        if (!outAbs) {
          fs.writeFileSync(tmpPath, buf);
          pathToOpen = tmpPath;
        }
      }

      if (wantInlineOsc) {
        writeTerminalInlineImage(buf, { width: options.inlineWidth || 'auto' });
      }

      const inlineUnsupportedNoOpen =
        wantInlineFlag && !ctx.json && !supportsOsc && !shouldOpen;

      if (inlineFallbackPreview && !ctx.quiet) {
        const tp = process.env.TERM_PROGRAM || '(unknown)';
        console.error(
          `Note: Inline images are not supported in this terminal (${tp}). Opening the screenshot in your default viewer instead.`
        );
        console.error('Tip: Use iTerm 2 or WezTerm for true inline images, or set RDS_INLINE_NO_PREVIEW=1 to skip auto-open.');
      } else if (inlineUnsupportedNoOpen && !ctx.quiet) {
        console.error(
          'Note: This terminal does not draw inline images (e.g. Cursor, VS Code, Terminal.app). Save a file: rds screenshot ./out.jpg --ip …   or run: rds screenshot --preview --ip …'
        );
      }

      if (shouldOpen) {
        openImageInDefaultApp(pathToOpen);
      }

      if (ctx.json) {
        console.log(
          JSON.stringify(
            {
              success: true,
              path: outAbs || tmpPath || null,
              bytes: buf.length,
              inlineOsc: wantInlineOsc,
              previewOpened: shouldOpen
            },
            null,
            2
          )
        );
      } else if (wantInlineOsc) {
        if (outAbs && !ctx.quiet) {
          console.error(`Saved: ${outAbs}`);
        }
      } else if (outAbs && !shouldOpen) {
        console.log(outAbs);
      } else if (shouldOpen && !ctx.quiet && pathToOpen) {
        console.error(`Opened: ${pathToOpen}`);
      }
    });

  async function raleRunOneShot(ctx, port, command, cmdArgs) {
    const t = getTransport(ctx);
    if (t.mode === 'relay') {
      await t.client.raleWake(ctx.ip, port);
      const conn = await t.client.raleConnect(ctx.ip, port);
      if (!conn || conn.success === false) {
        return { success: false, error: (conn && conn.error) || 'RALE connect failed' };
      }
      const cid = conn.connectionId;
    try {
      return await t.client.raleCommand(ctx.ip, {
        connectionId: cid,
        command,
        args: cmdArgs || {},
        timeoutMs: ctx.raleTimeoutMs
      });
    } finally {
        await t.client.raleDisconnect(ctx.ip, { connectionId: cid });
      }
    }
    await raleDirect.raleWake(ctx.ip, port);
    const conn = await raleDirect.raleConnect(ctx.ip, port);
    if (!conn.success) {
      return { success: false, error: conn.error || 'RALE connect failed' };
    }
    try {
      return await raleDirect.raleCommand(conn.connectionId, command, cmdArgs || {}, {
        timeoutMs: ctx.raleTimeoutMs
      });
    } finally {
      raleDirect.raleDisconnect(conn.connectionId);
    }
  }

  const scriptCmd = program.command('script').description('Action Script JSON (Roku Dev Studio format)');
  scriptCmd
    .command('validate <file>')
    .description('Validate JSON structure (offline; no device)')
    .action((file) => {
      const ctx = collectGlobals(program);
      const abs = path.resolve(process.cwd(), file);
      if (!fs.existsSync(abs)) {
        console.error(`Error: file not found: ${abs}`);
        process.exit(2);
      }
      let script;
      try {
        script = JSON.parse(fs.readFileSync(abs, 'utf8'));
      } catch (e: unknown) {
        console.error(`Error: ${errorMessage(e)}`);
        process.exit(2);
      }
      if (ctx.json) {
        // Rich structured shape (path / code / expected / stepIndex) for
        // tooling to consume — mirrors the MCP `validate_script` output.
        const rich = validateScriptStructureRich(script);
        console.log(
          JSON.stringify({ valid: rich.ok, errors: rich.errors, stepCounts: rich.stepCounts }, null, 2)
        );
        if (!rich.ok) process.exit(2);
        return;
      }
      const v = validateScriptStructure(script);
      if (v.valid) {
        console.log('OK', abs);
      } else {
        v.errors.forEach((e) => console.error(e));
        process.exit(1);
      }
    });

  scriptCmd
    .command('run <file>')
    .description('Run script on device (RALE steps auto-connect; rale-node-field wait not supported)')
    .option('--screenshot-dir <dir>', 'Directory for screenshot steps')
    .option('--rale-port <n>', 'App Connector TCP port', String(DEFAULT_RALE_PORT))
    .action(async (file, options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const abs = path.resolve(process.cwd(), file);
      if (!fs.existsSync(abs)) {
        console.error(`Error: file not found: ${abs}`);
        process.exit(2);
      }
      let script;
      try {
        script = JSON.parse(fs.readFileSync(abs, 'utf8'));
      } catch (e: unknown) {
        console.error(`Error: ${errorMessage(e)}`);
        process.exit(2);
      }
      const v = validateScriptStructure(script);
      if (!v.valid) {
        v.errors.forEach((e) => console.error(e));
        process.exit(2);
      }
      const ralePort = parseInt(String(options.ralePort), 10);
      const port = Number.isFinite(ralePort) && ralePort > 0 ? ralePort : DEFAULT_RALE_PORT;
      const t = getTransport(ctx);
      const relayClient = t.mode === 'relay' ? t.client : null;

      const stepsOut: Array<{ index: number; success: boolean; error: unknown }> = [];
      const result = await runActionScript(script, {
        ip: ctx.ip,
        password: ctx.password,
        relayClient,
        ecpTimeout: ctx.timeout,
        ralePort: port,
        raleCommandTimeoutMs: ctx.raleTimeoutMs,
        screenshotDir: options.screenshotDir || null,
        onLog: (msg) => {
          if (!ctx.quiet && !ctx.json) console.error(msg);
        },
        onStepStart: (i, step) => {
          if (!ctx.json && !ctx.quiet) {
            console.error(`— Step ${i + 1}: ${step && step.type ? step.type : '?'}`);
          }
        },
        onStepEnd: (i, r) => {
          stepsOut.push({ index: i, success: !!(r && r.success), error: r && r.error });
        }
      });

      if (ctx.json) {
        console.log(JSON.stringify({ ...result, steps: stepsOut }, null, 2));
        if (!result.success) process.exit(1);
        return;
      }
      if (result.success) {
        console.log('OK', abs, `(${script.steps.length} steps)`);
      } else {
        console.error(result.error || 'Script failed', result.stepIndex != null ? `(step ${result.stepIndex + 1})` : '');
        process.exit(1);
      }
    });

  const raleCmd = program.command('rale').description('App Connector (RALE / TrackerTask)');
  raleCmd
    .command('wake')
    .description('Wake RALE via ECP (/input?rale=true&port=…)')
    .option('--rale-port <n>', 'RALE TCP port', String(DEFAULT_RALE_PORT))
    .action(async (options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const port = parseInt(String(options.ralePort), 10);
      const p = Number.isFinite(port) && port > 0 ? port : DEFAULT_RALE_PORT;
      const t = getTransport(ctx);
      let result;
      if (t.mode === 'relay') {
        result = await t.client.raleWake(ctx.ip, p);
      } else {
        result = await raleDirect.raleWake(ctx.ip, p);
      }
      if (ctx.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result && result.success !== false) {
        console.log('OK');
      } else {
        console.error((result && result.error) || 'Wake failed');
        process.exit(1);
      }
    });

  raleCmd
    .command('run <command>')
    .description('One-shot: wake → connect → command → disconnect (direct or relay)')
    .option('--args <json>', 'JSON object for command args', '{}')
    .option('--rale-port <n>', 'RALE TCP port', String(DEFAULT_RALE_PORT))
    .action(async (command, options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      let cmdArgs = {};
      try {
        cmdArgs = JSON.parse(options.args || '{}');
        if (cmdArgs !== null && typeof cmdArgs !== 'object') {
          throw new Error('args must be a JSON object');
        }
      } catch (e: unknown) {
        console.error(`Error: invalid --args JSON: ${errorMessage(e)}`);
        process.exit(2);
      }
      const port = parseInt(String(options.ralePort), 10);
      const p = Number.isFinite(port) && port > 0 ? port : DEFAULT_RALE_PORT;
      const result = await raleRunOneShot(ctx, p, command, cmdArgs || {});
      if (ctx.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result && result.success !== false) {
        if (result.data !== undefined) {
          console.log(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
        } else {
          console.log('OK');
        }
      } else {
        console.error((result && result.error) || 'Command failed');
        maybePrintRaleTimeoutHint(ctx, result && result.error, p);
        process.exit(1);
      }
    });

  raleCmd
    .command('repl')
    .description(
      'Interactive session on one TCP connection (direct or relay); type JSON lines, or exit / Ctrl+D'
    )
    .option('--rale-port <n>', 'RALE TCP port', String(DEFAULT_RALE_PORT))
    .action(async (options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      if (!process.stdin.isTTY) {
        console.error('Error: rale repl needs an interactive terminal (TTY).');
        process.exit(2);
      }
      const port = parseInt(String(options.ralePort), 10);
      const p = Number.isFinite(port) && port > 0 ? port : DEFAULT_RALE_PORT;
      const t = getTransport(ctx);
      let connectionId;

      if (t.mode === 'relay') {
        await t.client.raleWake(ctx.ip, p);
        const conn = await t.client.raleConnect(ctx.ip, p);
        if (!conn || conn.success === false) {
          console.error((conn && conn.error) || 'RALE connect failed');
          process.exit(1);
        }
        connectionId = conn.connectionId;
      } else {
        await raleDirect.raleWake(ctx.ip, p);
        const conn = await raleDirect.raleConnect(ctx.ip, p);
        if (!conn.success) {
          console.error(conn.error || 'RALE connect failed');
          process.exit(1);
        }
        connectionId = conn.connectionId;
      }

      if (!ctx.quiet) {
        console.error(`Connected ${connectionId}. One JSON object per line (or: exit, quit, Ctrl+D).`);
        console.error('Example: {"command":"getNodeById","args":{"path":[],"id":"root"}}');
      }

      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      let shuttingDown = false;

      async function doDisconnect() {
        if (t.mode === 'relay') {
          await t.client.raleDisconnect(ctx.ip, { connectionId });
        } else {
          raleDirect.raleDisconnect(connectionId);
        }
      }

      async function shutdown() {
        if (shuttingDown) return;
        shuttingDown = true;
        rl.close();
        try {
          await doDisconnect();
        } catch (_) {}
        process.exit(0);
      }

      function runPrompt() {
        if (shuttingDown) return;
        rl.question('rale> ', (line) => {
          void (async () => {
            if (shuttingDown) return;
            const trimmed = (line || '').trim();
            if (trimmed === 'exit' || trimmed === 'quit') {
              await shutdown();
              return;
            }
            if (!trimmed) {
              runPrompt();
              return;
            }
            let msg;
            try {
              msg = JSON.parse(trimmed);
            } catch (e: unknown) {
              console.error('Invalid JSON:', errorMessage(e));
              runPrompt();
              return;
            }
            if (!msg || typeof msg !== 'object' || !msg.command) {
              console.error('JSON must include a string "command" (and optional "args" object).');
              runPrompt();
              return;
            }
            const args = msg.args != null && typeof msg.args === 'object' ? msg.args : {};
            let result;
            try {
              if (t.mode === 'relay') {
                result = await t.client.raleCommand(ctx.ip, {
                  connectionId,
                  command: msg.command,
                  args,
                  timeoutMs: ctx.raleTimeoutMs
                });
              } else {
                result = await raleDirect.raleCommand(connectionId, msg.command, args, {
                  timeoutMs: ctx.raleTimeoutMs
                });
              }
            } catch (e: unknown) {
              console.error(errorMessage(e));
              runPrompt();
              return;
            }
            if (ctx.json) {
              console.log(JSON.stringify(result, null, 2));
            } else if (result && result.success !== false) {
              if (result.data !== undefined) {
                console.log(
                  typeof result.data === 'string'
                    ? result.data
                    : JSON.stringify(result.data, null, 2)
                );
              } else {
                console.log(JSON.stringify(result, null, 2));
              }
            } else {
              console.error((result && result.error) || 'Command failed');
            }
            runPrompt();
          })();
        });
      }

      rl.on('close', () => {
        if (!shuttingDown) void shutdown();
      });

      runPrompt();
    });

  raleCmd
    .command('connect')
    .description('Open RALE session on relay only (socket kept on server; use repl for direct LAN)')
    .option('--rale-port <n>', 'RALE TCP port', String(DEFAULT_RALE_PORT))
    .action(async (options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      if (!ctx.relay) {
        console.error(
          'Error: "connect" only works with --relay (the relay server holds the TCP socket).'
        );
        console.error('On direct LAN, use one of:');
        console.error('  rds rale repl --ip …          # interactive, same terminal keeps the connection');
        console.error('  rds rale run <cmd> --args \'…\' --ip …   # single command');
        process.exit(2);
      }
      const port = parseInt(String(options.ralePort), 10);
      const p = Number.isFinite(port) && port > 0 ? port : DEFAULT_RALE_PORT;
      const t = getTransport(ctx);
      await t.client.raleWake(ctx.ip, p);
      const conn = await t.client.raleConnect(ctx.ip, p);
      if (ctx.json) {
        console.log(JSON.stringify(conn, null, 2));
      } else if (conn && conn.success) {
        console.log(conn.connectionId);
      } else {
        console.error((conn && conn.error) || 'Connect failed');
        process.exit(1);
      }
    });

  raleCmd
    .command('send <command>')
    .description('Send RALE command using an existing connection (--relay only)')
    .requiredOption('--connection-id <id>', 'From rds rale connect')
    .option('--args <json>', 'JSON object', '{}')
    .action(async (command, options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      if (!ctx.relay) {
        console.error('Error: send requires --relay (or use: rds rale repl / rds rale run …)');
        process.exit(2);
      }
      let cmdArgs = {};
      try {
        cmdArgs = JSON.parse(options.args || '{}');
      } catch (e: unknown) {
        console.error(`Error: invalid --args: ${errorMessage(e)}`);
        process.exit(2);
      }
      const t = getTransport(ctx);
      const result = await t.client.raleCommand(ctx.ip, {
        connectionId: options.connectionId,
        command,
        args: cmdArgs,
        timeoutMs: ctx.raleTimeoutMs
      });
      if (ctx.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result && result.success !== false) {
        if (result.data !== undefined) {
          console.log(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
        } else {
          console.log('OK');
        }
      } else {
        console.error((result && result.error) || 'Send failed');
        process.exit(1);
      }
    });

  raleCmd
    .command('disconnect')
    .description('Close RALE session on relay (--relay only)')
    .requiredOption('--connection-id <id>', 'Connection id from connect')
    .action(async (options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      if (!ctx.relay) {
        console.error('Error: disconnect requires --relay');
        process.exit(2);
      }
      const t = getTransport(ctx);
      const result = await t.client.raleDisconnect(ctx.ip, { connectionId: options.connectionId });
      if (ctx.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('OK');
      }
    });

  const appConnectorCmd = program
    .command('app-connector')
    .alias('appconnector')
    .description('App Connector — list functions from the running channel (getExternalControlFunctions)');
  appConnectorCmd
    .command('connect')
    .description(
      'Wake RALE, connect, fetch getExternalControlFunctions, disconnect (direct or --relay)'
    )
    .option('--rale-port <n>', 'RALE / TrackerTask TCP port', String(DEFAULT_RALE_PORT))
    .action(async (options) => {
      const ctx = collectGlobals(program);
      requireIp(ctx);
      const port = parseInt(String(options.ralePort), 10);
      const p = Number.isFinite(port) && port > 0 ? port : DEFAULT_RALE_PORT;
      const raw = await raleRunOneShot(ctx, p, 'getExternalControlFunctions', {});
      const parsed = parseGetExternalControlFunctionsResponse(raw);
      if (!parsed.ok) {
        if (ctx.json) {
          console.log(JSON.stringify({ ok: false, error: parsed.error, raw: parsed.raw }, null, 2));
        } else {
          console.error(parsed.error);
          maybePrintRaleTimeoutHint(ctx, parsed.error, p);
        }
        process.exit(1);
      }
      if (ctx.json) {
        console.log(JSON.stringify({ ok: true, functions: parsed.functions }, null, 2));
        return;
      }
      if (!parsed.functions.length) {
        console.log('No functions reported (empty list). Implement GetExternalControlFunctions in your channel.');
        return;
      }
      for (const f of parsed.functions) {
        const params = (f.params || [])
          .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
          .join(', ');
        console.log(params ? `${f.name}(${params})` : `${f.name}()`);
      }
    });

  program.showHelpAfterError();
  await program.parseAsync(process.argv);
}

main().catch((e: unknown) => {
  console.error(errorMessage(e));
  process.exit(1);
});
