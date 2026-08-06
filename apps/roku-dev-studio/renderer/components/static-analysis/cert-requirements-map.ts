/**
 * Maps sca-cmd `certRequirements` codes (e.g. "1.1", "RAF 1.2", "ADS 2.1", "RP 3.4") to the Roku
 * developer doc section they belong to. sca-cmd's own JSON report never includes a URL for these
 * codes (unlike its `documentationUrls`, which point at specific BrightScript API pages) — this is
 * built by reading the actual doc pages sca-cmd's codes come from.
 *
 * Important limitation, true across ALL three source pages, not just isolated codes: none of the
 * numbered sub-requirements (the ".Y" in "X.Y") have their own heading/anchor anywhere in Roku's
 * docs — they're rendered as bullets or table rows inside their parent section. So every code can
 * only link to its PARENT section anchor (e.g. "6.5" -> `#6-ui-and-graphics`, the whole "6. UI and
 * Graphics" section, same as "6.1" or "6.4" would). There is no finer-grained anchor to fall back
 * to; this isn't a gap specific to one code, it's how every one of these docs is structured.
 *
 * Section-heading anchors below follow the standard slugify pattern (lowercase, strip punctuation,
 * spaces -> hyphens) confirmed against `#6-ui-and-graphics`; applied uniformly to every other
 * heading. If Roku ever renumbers/retitles a section, its slug (and this table) needs updating.
 */

interface CertSection {
  /** '' for the main certification page's bare "X.Y" codes, else the code's letter prefix. */
  prefix: string;
  /** The leading integer before the first dot, e.g. 6 in "6.5" or 1 in "RAF 1.2". */
  section: number;
  url: string;
}

const CERT_SECTIONS: readonly CertSection[] = [
  // Main certification page — developer.roku.com/dev/docs/certification
  { prefix: '', section: 1, url: 'https://developer.roku.com/dev/docs/certification#1-advertising' },
  { prefix: '', section: 2, url: 'https://developer.roku.com/dev/docs/certification#2-accounts-and-purchases' },
  { prefix: '', section: 3, url: 'https://developer.roku.com/dev/docs/certification#3-performance' },
  { prefix: '', section: 4, url: 'https://developer.roku.com/dev/docs/certification#4-app-operation' },
  { prefix: '', section: 5, url: 'https://developer.roku.com/dev/docs/certification#5-deep-linking' },
  { prefix: '', section: 6, url: 'https://developer.roku.com/dev/docs/certification#6-ui-and-graphics' },

  // Ad requirements page — developer.roku.com/dev/docs/ad-requirements. This single page covers
  // both the Roku Advertising Framework integration codes ("RAF X.Y") and the separate general
  // advertising codes ("ADS X.Y"); the main cert page's "1. Advertising" section links here.
  { prefix: 'RAF', section: 1, url: 'https://developer.roku.com/dev/docs/ad-requirements#raf-1-integration-requirements' },
  { prefix: 'ADS', section: 1, url: 'https://developer.roku.com/dev/docs/ad-requirements#ads-1-general-integration-requirements' },
  { prefix: 'ADS', section: 2, url: 'https://developer.roku.com/dev/docs/ad-requirements#ads-2-privacy-requirements' },
  { prefix: 'ADS', section: 3, url: 'https://developer.roku.com/dev/docs/ad-requirements#ads-3-ad-request-requirements' },
  { prefix: 'ADS', section: 4, url: 'https://developer.roku.com/dev/docs/ad-requirements#ads-4-ad-break-playback-requirements' },

  // Roku Pay requirements page — developer.roku.com/dev/docs/roku-pay-requirements ("RP X.Y").
  // The main cert page's "2. Accounts and purchases" section (Roku Pay integration, 2.1) links here.
  { prefix: 'RP', section: 1, url: 'https://developer.roku.com/dev/docs/roku-pay-requirements#rp-1-channel-setup-requirements' },
  { prefix: 'RP', section: 2, url: 'https://developer.roku.com/dev/docs/roku-pay-requirements#rp-2-sign-up-and-sign-in-requirements' },
  { prefix: 'RP', section: 3, url: 'https://developer.roku.com/dev/docs/roku-pay-requirements#rp-3-payment-requirements' },
  { prefix: 'RP', section: 4, url: 'https://developer.roku.com/dev/docs/roku-pay-requirements#rp-4-authentication-and-entitlement-requirements' }
];

/** Parses "1.1", "RAF 1.2", "ADS 2.1", "6" (no sub-item), etc. into a section lookup key. */
function parseCertCode(code: string): { prefix: string; section: number } | null {
  const match = /^\s*([A-Za-z]+)?\s*(\d+)(?:\.\d+)*\s*$/.exec(code);
  if (!match) return null;
  const section = Number(match[2]);
  if (!Number.isFinite(section)) return null;
  return { prefix: (match[1] ?? '').toUpperCase(), section };
}

/** Resolves a cert requirement code to its parent section's doc URL, or `undefined` if the code
 *  doesn't match any known prefix/section (e.g. a future sca-cmd code this map hasn't seen yet). */
export function resolveCertRequirementUrl(code: string): string | undefined {
  const parsed = parseCertCode(code);
  if (!parsed) return undefined;
  return CERT_SECTIONS.find((s) => s.prefix === parsed.prefix && s.section === parsed.section)?.url;
}
