#!/usr/bin/env node
// Generates the channel icons/splash for the Roku Dev Studio Showcase demo
// channel. No real artwork needed — every image is an SVG rasterized by
// Sharp (already installed at the repo root via apps/roku-dev-studio's
// devDependency), modeled on the pattern in
// apps/roku-dev-studio/scripts/generate-icons.ts. The icon/splash treatment
// (dark badge + glowing gradient wordmark) matches roku-components/fiddle/'s
// existing art so the two bundled companion channels read as one family.
import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

const BG_COLOR = '#0a0a12';

// Dark rounded "app icon" badge (Roku / Dev / Studio, 3 lines) plus a big
// glowing gradient wordmark underneath — the same composition family as
// roku-components/fiddle/images/channel_icon_*.png, just with a different
// wordmark ("Showcase" instead of "Fiddle").
function badgeAndWordmarkSvg(width, height, wordmark) {
  const badgeSize = Math.round(Math.min(width, height) * 0.42);
  const badgeX = Math.round((width - badgeSize) / 2);
  const badgeY = Math.round(height * 0.09);
  const badgeRadius = Math.round(badgeSize * 0.22);
  const badgeFontSize = Math.round(badgeSize * 0.155);
  const lineHeight = Math.round(badgeFontSize * 1.05);
  const badgeCenterY = badgeY + badgeSize / 2;
  const firstLineY = Math.round(badgeCenterY - lineHeight + badgeFontSize * 0.42);

  const wordmarkFontSize = Math.round(height * 0.24);
  const wordmarkY = Math.round(badgeY + badgeSize + height * 0.24);
  const glowStd = Math.max(2, Math.round(height * 0.012));

  const badgeLines = ['Roku', 'Dev', 'Studio']
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${firstLineY + i * lineHeight}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="${badgeFontSize}" fill="url(#grad)">${line}</text>`
    )
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#a855f7" />
        <stop offset="100%" stop-color="#22d3ee" />
      </linearGradient>
      <linearGradient id="badgeFill" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1c1c26" />
        <stop offset="100%" stop-color="#0f0f16" />
      </linearGradient>
      <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="${glowStd}" />
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="${BG_COLOR}" />
    <rect x="${badgeX}" y="${badgeY}" width="${badgeSize}" height="${badgeSize}" rx="${badgeRadius}"
          fill="url(#badgeFill)" stroke="#ffffff1f" stroke-width="2" />
    ${badgeLines}
    <text x="${width / 2}" y="${wordmarkY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
          font-weight="800" font-size="${wordmarkFontSize}" fill="url(#grad)" filter="url(#glow)" opacity="0.55">${wordmark}</text>
    <text x="${width / 2}" y="${wordmarkY}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
          font-weight="800" font-size="${wordmarkFontSize}" fill="url(#grad)">${wordmark}</text>
  </svg>`;
}

async function render(svg, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log('  ✓', outPath.replace(repoRoot + '/', ''));
}

async function main() {
  const iconDir = join(__dirname, 'images');

  console.log('Channel icons + splash:');
  await render(badgeAndWordmarkSvg(290, 218, 'Showcase'), join(iconDir, 'channel_icon_hd.png'));
  await render(badgeAndWordmarkSvg(540, 405, 'Showcase'), join(iconDir, 'channel_icon_fhd.png'));
  await render(badgeAndWordmarkSvg(320, 180, 'Showcase'), join(iconDir, 'channel_icon_wide.png'));
  await render(badgeAndWordmarkSvg(1920, 1080, 'Showcase'), join(iconDir, 'splash.png'));

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
