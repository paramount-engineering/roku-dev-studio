/**
 * Shim: the Network Inspector contract now lives in the `roku-dev-studio-network-inspector`
 * package so the engine can be shared by the desktop app and the remote server. This re-export
 * keeps the historical `shared/network-inspector/types` import path working across the app
 * (renderer + main) with zero churn.
 */
export * from 'roku-dev-studio-network-inspector/types';
