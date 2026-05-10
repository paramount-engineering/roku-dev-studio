'use strict';
/**
 * electron-builder loads hooks via require(); register tsx then load the TypeScript hook.
 */
require('tsx/cjs/api').register();
const mod = require('./build-hooks.ts');
module.exports = mod?.default ?? mod;
