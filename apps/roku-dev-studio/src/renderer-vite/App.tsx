import type { Component } from 'solid-js';
import { createSignal, onMount } from 'solid-js';
import pkg from '../../package.json';

const App: Component = () => {
  const [hasPreload, setHasPreload] = createSignal(false);

  onMount(() => {
    const probe = () => setHasPreload(typeof window.roku !== 'undefined');
    probe();
    // Preload runs before first paint; a microtask/raf covers edge cases during fast HMR.
    queueMicrotask(probe);
    requestAnimationFrame(probe);
  });

  return (
    <main
      style={{
        'box-sizing': 'border-box',
        'min-height': '100vh',
        margin: '0',
        padding: '2rem',
        'font-family': "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
        'font-size': '13px',
        color: '#e0e0e0',
        background: '#0a0a12',
      }}
    >
      <h1 style={{ 'font-size': '1.25rem', 'font-weight': '600', margin: '0 0 0.5rem' }}>
        Roku Dev Studio
      </h1>
      <p style={{ margin: '0 0 1rem', opacity: '0.85' }}>
        Solid + Vite + TypeScript shell (v{pkg.version}) — migrate features here from{' '}
        <code style={{ color: '#74c0fc' }}>renderer/index.html</code> +{' '}
        <code style={{ color: '#74c0fc' }}>renderer/dist/app.js</code>.
      </p>
      <ul style={{ 'line-height': 1.7, margin: '0 0 1.25rem', padding: '0 0 0 1.25rem' }}>
        <li>
          <strong>Default UI:</strong> from repo root run <code>npm start</code> (HTML renderer + Electron).
        </li>
        <li>
          <strong>This UI (dev):</strong> <code>npm run dev:solid</code> in{' '}
          <code>apps/roku-dev-studio</code>, or <code>npm run start:solid</code> from repo root.
        </li>
        <li>
          <strong>Production build of this shell:</strong>{' '}
          <code>npm run renderer:solid:build</code> then{' '}
          <code>RDS_SOLID_RENDERER=dist npm start</code>.
        </li>
      </ul>
      <p style={{ margin: '0 0 0.75rem', opacity: '0.7', 'line-height': 1.6 }}>
        If you see <strong>two</strong> windows or tabs: Cursor (or another tool) may open a{' '}
        <strong>browser preview</strong> on port <code>5173</code>. That view is{' '}
        <em>not</em> this Electron app — it will not load <code>preload.bundled.cjs</code>, so{' '}
        <code>window.roku</code> stays undefined. Use the separate <strong>Roku Dev Studio</strong>{' '}
        window from your dock/taskbar for the real preload bridge.
      </p>
      <p style={{ margin: 0, opacity: '0.75' }}>
        Preload bridge (<code>window.roku</code>):{' '}
        <span style={{ color: hasPreload() ? '#51cf66' : '#ff6b6b' }}>
          {hasPreload() ? 'yes' : 'no'}
        </span>
      </p>
    </main>
  );
};

export default App;
