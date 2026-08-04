/**
 * Portuguese (Brazil) catalog — same shape as the English base (`../index.ts`), composed
 * from per-area sibling modules. Registered as the 'pt' locale in the parent index.
 */
import { common } from './common.js';
import { sideloadRelay } from './sideload-relay.js';
import { settings } from './settings.js';
import { devApp } from './dev-app.js';
import { queries } from './queries.js';
import { modals } from './modals.js';
import { networkSessionViewer } from './network-session-viewer.js';
import { inspector } from './inspector.js';
import { networkInspector } from './network-inspector.js';
import { actionScripts } from './action-scripts.js';
import { consoleLog } from './console-log.js';
import { ui } from './ui.js';
import { app } from './app.js';
import { telnet } from './telnet.js';
import { fiddle } from './fiddle.js';
import { floatingRemote } from './floating-remote.js';
import { about } from './about.js';
import { deeplink } from './deeplink.js';
import { utils } from './utils.js';
import { logFileViewer } from './log-file-viewer.js';
import { menu } from './menu.js';
import { staticAnalysis } from './static-analysis.js';
// Placeholder: reuse the English Debugger strings until a Portuguese translation exists.
import { debuggerStrings } from '../debugger.js';

export const pt = {
  common,
  sideloadRelay,
  settings,
  devApp,
  queries,
  modals,
  networkSessionViewer,
  inspector,
  networkInspector,
  actionScripts,
  consoleLog,
  ui,
  app,
  telnet,
  fiddle,
  floatingRemote,
  about,
  deeplink,
  utils,
  logFileViewer,
  menu,
  debugger: debuggerStrings,
  staticAnalysis,
};
