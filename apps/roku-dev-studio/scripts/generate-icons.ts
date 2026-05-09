import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { resolveUnderBase } from '../../../lib/path-safe';

const assetsDir = resolveUnderBase(__dirname, '..', 'assets') || path.join(__dirname, '..', 'assets');
const svgPath = resolveUnderBase(assetsDir, 'icon.svg') || path.join(assetsDir, 'icon.svg');
const iconsetDir = resolveUnderBase(assetsDir, 'icon.iconset') || path.join(assetsDir, 'icon.iconset');

const macSizes = [16, 32, 64, 128, 256, 512, 1024];
const winSizes = [16, 24, 32, 48, 64, 128, 256];

async function generateIcons(): Promise<void> {
  console.log('🎨 Generating icons from SVG...');

  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(svgPath);

  console.log('\n📱 Generating macOS iconset...');
  for (const size of macSizes) {
    const filename = `icon_${size}x${size}.png`;
    const filepath = resolveUnderBase(iconsetDir, filename) || path.join(iconsetDir, filename);

    await sharp(svgBuffer).resize(size, size).png().toFile(filepath);

    console.log(`  ✓ ${filename}`);

    if (size <= 512) {
      const filename2x = `icon_${size}x${size}@2x.png`;
      const filepath2x = resolveUnderBase(iconsetDir, filename2x) || path.join(iconsetDir, filename2x);

      await sharp(svgBuffer).resize(size * 2, size * 2).png().toFile(filepath2x);

      console.log(`  ✓ ${filename2x}`);
    }
  }

  console.log('\n🪟 Generating Windows icon base...');
  const pngPath = resolveUnderBase(assetsDir, 'icon.png') || path.join(assetsDir, 'icon.png');
  await sharp(svgBuffer).resize(256, 256).png().toFile(pngPath);
  console.log(`  ✓ icon.png (256x256)`);

  const icoDir = resolveUnderBase(assetsDir, 'ico-parts') || path.join(assetsDir, 'ico-parts');
  if (!fs.existsSync(icoDir)) {
    fs.mkdirSync(icoDir, { recursive: true });
  }

  for (const size of winSizes) {
    const filename = `icon-${size}.png`;
    const filepath = resolveUnderBase(icoDir, filename) || path.join(icoDir, filename);

    await sharp(svgBuffer).resize(size, size).png().toFile(filepath);
  }

  console.log('\n🍎 Creating macOS .icns...');
  try {
    const icnsPath = resolveUnderBase(assetsDir, 'icon.icns') || path.join(assetsDir, 'icon.icns');
    execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`, { stdio: 'inherit' });
    console.log('  ✓ icon.icns created');
  } catch {
    console.log('  ⚠ Could not create .icns (iconutil may not be available)');
    console.log('    Run: iconutil -c icns assets/icon.iconset -o assets/icon.icns');
  }

  console.log('\n🪟 Creating Windows .ico...');
  try {
    const icoPath = resolveUnderBase(assetsDir, 'icon.ico') || path.join(assetsDir, 'icon.ico');
    await sharp(svgBuffer).resize(256, 256).png().toFile(icoPath.replace('.ico', '-256.png'));

    try {
      execSync(`npx --yes png-to-ico "${icoDir}/icon-256.png" > "${icoPath}"`, { stdio: 'pipe' });
      console.log('  ✓ icon.ico created');
    } catch {
      fs.copyFileSync(
        resolveUnderBase(icoDir, 'icon-256.png') || path.join(icoDir, 'icon-256.png'),
        icoPath
      );
      console.log('  ⚠ Created icon.ico (single size - consider using png-to-ico for multi-size)');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log('  ⚠ Could not create .ico:', msg);
  }

  console.log('\n✅ Icon generation complete!');
  console.log('\nGenerated files:');
  console.log('  - assets/icon.png (256x256 PNG)');
  console.log('  - assets/icon.icns (macOS)');
  console.log('  - assets/icon.ico (Windows)');
  console.log('  - assets/icon.iconset/ (PNG sizes for macOS)');
}

void generateIcons().catch(console.error);
