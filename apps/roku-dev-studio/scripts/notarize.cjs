/* eslint-disable */
const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;

  if (process.env.SKIP_NOTARIZE === '1') {
    console.log('[notarize] SKIP_NOTARIZE=1 — skipping notarization.');
    return;
  }

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn(
      '[notarize] Skipping notarization. Set APPLE_ID, APPLE_ID_PASSWORD (app-specific password), and APPLE_TEAM_ID to enable.'
    );
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`[notarize] Notarizing ${appPath} for team ${teamId} ...`);
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
  console.log('[notarize] Done.');
};
