/** Preload bridge (see preload.js) — extend as you migrate features. */
export interface RokuPreloadApi {
  copyToClipboard?: (text: string) => void;
}

declare global {
  interface Window {
    roku?: RokuPreloadApi;
    rdsShell?: {
      platform: string;
      minimizeWindow: () => void;
      toggleMaximizeWindow: () => void;
      closeWindow: () => void;
      isMainWindowMaximized?: () => Promise<{ maximized?: boolean }>;
      onMainWindowMaximizeChanged?: (callback: (maximized: boolean) => void) => () => void;
      onAppZoomChanged?: (callback: (factor: number) => void) => () => void;
      zoomIn?: () => void;
      zoomOut?: () => void;
      zoomReset?: () => void;
    };
  }
}

export {};
