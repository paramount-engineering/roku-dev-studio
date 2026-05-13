#!/usr/bin/env npx tsx
/**
 * DOM verification: structured-view modal's fold scaffold builds and toggles correctly.
 *
 * Two passes:
 *   1. JSON — pretty-printed object with nested object + array; check group counts,
 *      that empty `{}` / `[]` are *not* foldable, that nesting recurses, and that
 *      toggling collapses + expands.
 *   2. XML — same fixture shape ported to elements; same checks plus a self-closing
 *      tag should NOT receive a fold group.
 *
 * Run:
 *   cd apps/roku-dev-studio && npx tsx scripts/verify-structured-fold.ts
 */
import { JSDOM } from 'jsdom';

async function main() {
  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true
  });
  const { window } = dom;
  const g = globalThis as typeof globalThis & {
    window: Window & typeof globalThis;
    document: Document;
  };
  g.window = window as unknown as Window & typeof globalThis;
  g.document = window.document;
  Object.assign(globalThis, {
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Node: window.Node,
    Text: window.Text,
    MouseEvent: window.MouseEvent,
    DocumentFragment: window.DocumentFragment
  });

  const {
    applyJsonSyntaxHighlight,
    applyJsonFoldStructure,
    applyXmlSyntaxHighlight,
    applyXmlFoldStructure,
    toggleFoldGroup
  } = await import('../renderer/modules/telnet/telnet-structured-syntax.js');

  /* ── JSON pass ─────────────────────────────────────────────────────────── */
  const jsonPretty = `{
  "outer": {
    "nested": {
      "k": "v"
    },
    "arr": [
      1,
      2
    ],
    "empty_obj": {},
    "empty_arr": []
  }
}`;

  const codeJson = window.document.createElement('code');
  applyJsonSyntaxHighlight(codeJson, jsonPretty);
  applyJsonFoldStructure(codeJson);

  // Expected foldable groups: outermost {…}, outer.{…}, outer.nested.{…}, outer.arr.[…].
  // empty_obj {} and empty_arr [] should NOT be foldable.
  const groups = Array.from(codeJson.querySelectorAll('.telnet-fold-group')) as HTMLElement[];
  if (groups.length !== 4) {
    console.error(`JSON: expected 4 fold groups, got ${groups.length}`);
    for (const g of groups) console.error('  kind=', g.dataset.kind, 'text=', g.textContent?.slice(0, 60));
    process.exit(1);
  }

  // Every group has exactly one twisty (its own, not descendants').
  for (const grp of groups) {
    const twistyChildren = Array.from(grp.children).filter((c) =>
      c.classList.contains('telnet-fold-twisty')
    );
    if (twistyChildren.length !== 1) {
      console.error('JSON: group missing or extra twisty', grp.dataset.kind, twistyChildren.length);
      process.exit(1);
    }
  }

  // Confirm the close `}` is *inside* the body (so it hides when collapsed).
  const outermost = groups[0]!;
  const body = outermost.querySelector(':scope > .telnet-fold-body');
  if (!(body instanceof window.HTMLElement)) {
    console.error('JSON: outermost group missing .telnet-fold-body');
    process.exit(1);
  }
  const closingBraceInBody = Array.from(body.children).some(
    (el) => el.classList.contains('telnet-hl-json-punct') && el.textContent === '}'
  );
  if (!closingBraceInBody) {
    console.error('JSON: outermost group body does not contain its own closing }');
    process.exit(1);
  }

  // Toggle outermost: should add .telnet-fold-collapsed; toggle again removes it.
  toggleFoldGroup(outermost);
  if (!outermost.classList.contains('telnet-fold-collapsed')) {
    console.error('JSON: first toggle did not add collapsed class');
    process.exit(1);
  }
  if (outermost.querySelector(':scope > .telnet-fold-twisty')?.getAttribute('aria-expanded') !== 'false') {
    console.error('JSON: twisty aria-expanded not flipped after collapse');
    process.exit(1);
  }
  toggleFoldGroup(outermost);
  if (outermost.classList.contains('telnet-fold-collapsed')) {
    console.error('JSON: second toggle did not remove collapsed class');
    process.exit(1);
  }

  // Empty {} / [] check via DOM text — both pairs should appear OUTSIDE any fold group.
  const allEmptyPuncts = Array.from(codeJson.querySelectorAll('.telnet-hl-json-punct'))
    .filter((el) => el.textContent === '{' || el.textContent === '[')
    .filter((el) => {
      const next = el.nextSibling;
      return (
        next instanceof window.HTMLElement &&
        next.classList.contains('telnet-hl-json-punct') &&
        (next.textContent === '}' || next.textContent === ']')
      );
    });
  const emptyInsideFoldGroup = allEmptyPuncts.some((el) => el.parentElement?.closest('.telnet-fold-group'));
  // It's fine for them to *live inside* an outer fold group's body (they do — under outer.{…}),
  // but they themselves should not BE wrapped as a group.
  const emptyWrappedAsGroup = allEmptyPuncts.some((el) =>
    el.parentElement?.classList.contains('telnet-fold-group')
  );
  if (emptyWrappedAsGroup) {
    console.error('JSON: an empty {} / [] was wrapped as its own fold group');
    process.exit(1);
  }
  void emptyInsideFoldGroup; // silence unused-var warning; assertion above is the real check.

  console.log('JSON fold: OK (4 groups, twisties unique, close-token inside body, toggle works, empties skipped).');

  /* ── XML pass ──────────────────────────────────────────────────────────── */
  const xmlPretty = `<?xml version="1.0"?>
<root>
  <child>
    <leaf>v</leaf>
    <selfclose attr="x"/>
    <empty></empty>
  </child>
</root>`;

  const codeXml = window.document.createElement('code');
  applyXmlSyntaxHighlight(codeXml, xmlPretty);
  applyXmlFoldStructure(codeXml);

  // Expected fold groups: <root>, <child>, <leaf>. <empty></empty> is empty body (close
  // is open's immediate next sibling) so NOT foldable. <selfclose/> never qualifies.
  const xmlGroups = Array.from(codeXml.querySelectorAll('.telnet-fold-group')) as HTMLElement[];
  if (xmlGroups.length !== 3) {
    console.error(`XML: expected 3 fold groups, got ${xmlGroups.length}`);
    for (const grp of xmlGroups) {
      const opener = grp.querySelector('.telnet-xml-tag');
      console.error('  group dataset.tagname=', opener instanceof window.HTMLElement ? opener.dataset.tagname : '?');
    }
    process.exit(1);
  }

  // Self-closing tag must not be wrapped.
  const sc = codeXml.querySelector('.telnet-xml-tag[data-kind="self-closing"]');
  if (!(sc instanceof window.HTMLElement)) {
    console.error('XML: self-closing tag wrapper not found at all');
    process.exit(1);
  }
  if (sc.parentElement?.classList.contains('telnet-fold-group') && sc.previousElementSibling?.classList.contains('telnet-fold-twisty')) {
    console.error('XML: self-closing tag became the opener of a fold group');
    process.exit(1);
  }

  // Empty <empty></empty>: open should NOT be wrapped (its next sibling is the matching close).
  const emptyOpener = Array.from(codeXml.querySelectorAll('.telnet-xml-tag[data-kind="open"][data-tagname="empty"]'))[0];
  if (!(emptyOpener instanceof window.HTMLElement)) {
    console.error('XML: empty element opener not found');
    process.exit(1);
  }
  if (emptyOpener.parentElement?.classList.contains('telnet-fold-group') && emptyOpener.previousElementSibling?.classList.contains('telnet-fold-twisty')) {
    console.error('XML: empty <empty></empty> became its own fold group');
    process.exit(1);
  }

  // Toggle the outer <root> group and verify aria.
  const rootGroup = xmlGroups[0]!;
  toggleFoldGroup(rootGroup);
  if (!rootGroup.classList.contains('telnet-fold-collapsed')) {
    console.error('XML: outer <root> did not collapse');
    process.exit(1);
  }
  toggleFoldGroup(rootGroup);
  if (rootGroup.classList.contains('telnet-fold-collapsed')) {
    console.error('XML: outer <root> did not expand back');
    process.exit(1);
  }

  console.log('XML fold: OK (3 groups, self-closing & empty skipped, toggle works).');
  console.log('verify-structured-fold: ALL OK');
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
