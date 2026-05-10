// Formatting utility functions
import { escapeHtml } from './dom.js';

/**
 * Format XML query result with syntax highlighting
 */
export function formatQueryResult(text: string | null | undefined): string {
  if (!text) return '';

  let formatted = text.replace(/></g, '>\n<');
  formatted = formatted.replace(/\n\s*\n\s*\n/g, '\n\n');

  const lines = formatted.split('\n');
  const highlightedLines = lines.map((line) => highlightXmlLine(line));

  return highlightedLines.join('\n');
}

function highlightXmlLine(line: string): string {
  let result = escapeHtml(line);

  result = result.replace(
    /&lt;\?(.+?)\?&gt;/g,
    '<span class="xml-header">&lt;?$1?&gt;</span>'
  );

  result = result.replace(
    /&lt;([\w][\w.-]*)(\s+[^/]*?)?\s*\/&gt;/g,
    (_match, tag: string, attrs: string) => {
      const highlightedAttrs = attrs ? highlightAttributes(attrs) : '';
      return `<span class="xml-bracket">&lt;</span><span class="xml-tag">${tag}</span>${highlightedAttrs}<span class="xml-bracket">/&gt;</span>`;
    }
  );

  result = result.replace(
    /&lt;([\w][\w.-]*)(\s+[^/&]*?)?&gt;/g,
    (_match, tag: string, attrs: string) => {
      const highlightedAttrs = attrs ? highlightAttributes(attrs) : '';
      return `<span class="xml-bracket">&lt;</span><span class="xml-tag">${tag}</span>${highlightedAttrs}<span class="xml-bracket">&gt;</span>`;
    }
  );

  result = result.replace(
    /&lt;\/([\w][\w.-]*)&gt;/g,
    '<span class="xml-bracket">&lt;/</span><span class="xml-tag">$1</span><span class="xml-bracket">&gt;</span>'
  );

  result = result.replace(
    /(<span class="xml-bracket">&gt;<\/span>)([^<]+)/g,
    (match, bracket: string, content: string) => {
      if (content.trim()) {
        return `${bracket}<span class="xml-content">${content}</span>`;
      }
      return match;
    }
  );

  return result;
}

function highlightAttributes(attrsString: string): string {
  if (!attrsString) return '';

  return attrsString.replace(
    /(\w[\w-]*)=&quot;([^&]*)&quot;/g,
    '<span class="xml-attr">$1</span><span class="xml-bracket">=&quot;</span><span class="xml-value">$2</span><span class="xml-bracket">&quot;</span>'
  );
}
