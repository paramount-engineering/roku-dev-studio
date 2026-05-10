#!/usr/bin/env node
/**
 * Ensures `renderer/vendor/modern-screenshot.mjs` exists so `tsc --noEmit` can resolve
 * `../../vendor/modern-screenshot.mjs` from `renderer/components/**` before a full transpile.
 */
import * as path from 'path';
import { copyModernScreenshotVendor } from './transpile-renderer.ts';

const appDir = path.resolve(__dirname, '../..');
const rendererRoot = path.join(appDir, 'renderer');
const rendererDist = path.join(rendererRoot, 'dist');
copyModernScreenshotVendor(appDir, rendererRoot, rendererDist);
