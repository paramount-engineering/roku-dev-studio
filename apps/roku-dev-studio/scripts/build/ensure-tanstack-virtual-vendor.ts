#!/usr/bin/env node
/**
 * Ensures `renderer/vendor/tanstack-virtual-core.mjs` exists so `tsc --noEmit`
 * can resolve `'../../vendor/tanstack-virtual-core.mjs'` from
 * `renderer/modules/**` before a full transpile.
 */
import * as path from 'path';
import { copyTanstackVirtualVendor } from './transpile-renderer';

const appDir = path.resolve(__dirname, '../..');
const rendererRoot = path.join(appDir, 'renderer');
const rendererDist = path.join(rendererRoot, 'dist');
copyTanstackVirtualVendor(appDir, rendererRoot, rendererDist);
