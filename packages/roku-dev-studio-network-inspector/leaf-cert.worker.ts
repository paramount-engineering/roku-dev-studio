/**
 * Worker entry for per-hostname MITM leaf-certificate signing — see
 * `.discussion-docs/worker-pool-threading-design.md` (Wiring §2). Keeps the synchronous RSA-sign call
 * in `createLeafCert` off the caller's thread (Electron main, or the remote server's own process —
 * this proxy runs in both). Built as its own standalone bundle by both `transpile-main-process.ts`
 * (desktop app) and `roku-dev-studio-remote-server/build.mjs` (remote server) — a worker_threads
 * entry needs a real file, not a symbol inside their respective bundles.
 */
import { workerData } from 'node:worker_threads';
import { runWorkerLoop } from 'roku-dev-studio-platform/worker-pool';
import { createLeafCert, type CaMaterial } from './ca-store';

// The CA's key/cert material is static for the proxy instance's lifetime — passed once via
// `workerData` at pool creation, not re-sent per task.
const ca = workerData as CaMaterial;

runWorkerLoop<string, { certPem: string; keyPem: string }>((hostname) => createLeafCert(hostname, ca));
