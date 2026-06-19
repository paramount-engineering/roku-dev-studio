// Reusable output area component with copy functionality
import { setSafeHTML } from '../utils/dom.js';
import { renderStructuredBody, type StructuredKind } from './structured-body.js';

/**
 * OutputArea - Manages an output display area with copy functionality
 */
export class OutputArea {
  container: HTMLElement | null;
  copyButton: HTMLElement | null;
  /** Notified whenever content is displayed (`true`) or cleared (`false`). Used to show/hide the
   *  attached find bar in lock-step with the output. */
  onContentChange: ((hasContent: boolean) => void) | null;
  private _originalContent = '';

  constructor(
    container: HTMLElement | null,
    copyButton: HTMLElement | null = null,
    onContentChange: ((hasContent: boolean) => void) | null = null
  ) {
    this.container = container;
    this.copyButton = copyButton;
    this.onContentChange = onContentChange;
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
    this.onContentChange?.(true);
  }

  /**
   * Display a raw response string as a collapsible JSON/XML tree (falling back to plain text).
   * Keeps `originalContent` as the raw source for Copy, and notifies `onContentChange`.
   */
  displayStructured(rawText: string): StructuredKind {
    if (!this.container) return 'text';
    this.originalContent = rawText;
    this.show();
    const kind = renderStructuredBody(this.container, rawText);
    if (this.copyButton) {
      this.copyButton.style.display = 'block';
    }
    this.onContentChange?.(true);
    return kind;
  }

  clear(): void {
    if (!this.container) return;

    this.container.innerHTML = '';
    this.originalContent = '';

    if (this.copyButton) {
      this.copyButton.style.display = 'none';
    }
    this.onContentChange?.(false);
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
}
