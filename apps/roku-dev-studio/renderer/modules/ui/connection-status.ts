// Reusable connection status display component
import { icon, escapeHtml, setSafeHTML } from '../utils/dom.js';
import { S } from '@shared/strings/index.js';

/**
 * ConnectionStatus - Manages connection status display
 */
export class ConnectionStatus {
  element: HTMLElement | null;

  constructor(element: HTMLElement | null) {
    this.element = element;
  }

  setConnected(): void {
    if (!this.element) return;
    setSafeHTML(this.element, icon('circle', 'icon-xs', 'icon-green') + ' ' + S.common.connected);
    this.element.className = 'rale-connection-status connected';
  }

  setDisconnected(): void {
    if (!this.element) return;
    setSafeHTML(this.element, icon('circle', 'icon-xs', 'icon-muted') + ' ' + S.common.disconnected);
    this.element.className = 'rale-connection-status disconnected';
  }

  setError(message: string): void {
    if (!this.element) return;
    setSafeHTML(
      this.element,
      icon('circle', 'icon-xs', 'icon-red') + ' ' + escapeHtml(String(message || S.ui.statusError))
    );
    this.element.className = 'rale-connection-status error';
  }

  setCustom(text: string, className = ''): void {
    if (!this.element) return;
    this.element.textContent = text;
    this.element.className = `rale-connection-status ${className}`.trim();
  }
}
