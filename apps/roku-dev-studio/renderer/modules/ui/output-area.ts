// Reusable output area component with copy functionality
import { setSafeHTML } from '../utils/dom.js';

/**
 * OutputArea - Manages an output display area with copy functionality
 */
export class OutputArea {
  container: HTMLElement | null;
  copyButton: HTMLElement | null;
  /** Optional toolbar row (e.g. query search) — shown/hidden with copyButton */
  queryToolbarRow: HTMLElement | null;
  private _originalContent = '';

  constructor(
    container: HTMLElement | null,
    copyButton: HTMLElement | null = null,
    queryToolbarRow: HTMLElement | null = null
  ) {
    this.container = container;
    this.copyButton = copyButton;
    this.queryToolbarRow = queryToolbarRow;
  }

  get originalContent(): string {
    return this._originalContent;
  }

  set originalContent(value: string) {
    this._originalContent = value;
  }

  display(content: string, isFormatted = false): void {
    if (!this.container) return;

    this.originalContent = content;
    this.container.classList.remove('hidden');
    this.container.classList.add('visible');
    this.container.style.display = 'block';

    if (isFormatted) {
      setSafeHTML(this.container, content);
    } else {
      this.container.textContent = content;
    }

    if (this.copyButton) {
      this.copyButton.style.display = 'block';
    }
    if (this.queryToolbarRow) {
      this.queryToolbarRow.style.display = 'flex';
    }
  }

  clear(): void {
    if (!this.container) return;

    this.container.innerHTML = '';
    this.originalContent = '';

    if (this.copyButton) {
      this.copyButton.style.display = 'none';
    }
    if (this.queryToolbarRow) {
      this.queryToolbarRow.style.display = 'none';
    }
  }

  show(): void {
    if (!this.container) return;
    this.container.classList.remove('hidden');
    this.container.classList.add('visible');
    this.container.style.display = 'block';
  }

  hide(): void {
    if (!this.container) return;
    this.container.classList.add('hidden');
    this.container.classList.remove('visible');
    this.container.style.display = 'none';
  }

  getText(): string {
    if (!this.container) return '';
    return this.container.textContent || (this.container as HTMLElement & { innerText?: string }).innerText || '';
  }

  getOriginalContent(): string {
    return this._originalContent;
  }

  setOriginalContent(content: string): void {
    this._originalContent = content;
  }
}
