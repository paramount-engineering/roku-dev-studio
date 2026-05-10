import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

/**
 * Solid + Vite + TypeScript renderer (alternate shell).
 * Default app UI: renderer/index.html (npm start).
 *
 * Dev:  npm run dev:solid   (Vite + Electron → http://127.0.0.1:5173)
 * Build: npm run renderer:solid:build → renderer-vite-dist/
 * Test built shell: RDS_SOLID_RENDERER=dist npm start (after build)
 *
 * To use Svelte instead: swap vite-plugin-solid for @sveltejs/vite-plugin-svelte
 * and point `root` at a Svelte index.html entry.
 */
export default defineConfig({
  plugins: [solid()],
  root: resolve(__dirname, 'src/renderer-vite'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'renderer-vite-dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    // Avoid auto-opening a system/IDE browser; Electron loads this URL via main process.
    open: false,
    fs: {
      allow: [resolve(__dirname), resolve(__dirname, 'src', 'renderer-vite')],
    },
  },
});
