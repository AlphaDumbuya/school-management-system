/**
 * Regenerate the native Android launcher icons from public/logo.png.
 *
 * Why: the Capacitor-generated icons had a near-all-white foreground (the navy
 * WiSkul mark was effectively invisible) and the legacy square/round icons were
 * white-on-white. On some launchers this showed as a blank/dark tile. We rebuild:
 *
 *   - ic_launcher_foreground.png : trimmed navy logo mark, transparent bg, kept
 *       inside the adaptive-icon safe zone (~66% of the 432dp canvas). The white
 *       adaptive background (@color/ic_launcher_background = #FFFFFF) shows behind it.
 *   - ic_launcher.png / ic_launcher_round.png : logo mark centered on a solid white
 *       tile (legacy pre-API-26 launchers that don't use adaptive icons).
 *
 * Densities follow Android's standard launcher sizes (48dp base):
 *   mdpi 48, hdpi 72, xhdpi 96, xxhdpi 144, xxxhdpi 192   (legacy square/round)
 * Adaptive foreground uses a 108dp canvas at each density:
 *   mdpi 108, hdpi 162, xhdpi 216, xxhdpi 324, xxxhdpi 432
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logoPath = path.resolve(__dirname, '..', 'public', 'logo.png');
const resDir = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Legacy launcher icon sizes (square / round) per density.
const legacy = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Adaptive foreground canvas sizes per density (108dp).
const foreground = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

async function trimmedLogo(targetPx) {
  return sharp(logoPath)
    .trim({ threshold: 10 })
    .resize(targetPx, targetPx, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
}

async function makeLegacySquare(size, out) {
  const inner = Math.round(size * 0.78);
  const logo = await trimmedLogo(inner);
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
}

async function makeLegacyRound(size, out) {
  const inner = Math.round(size * 0.68);
  const logo = await trimmedLogo(inner);
  // Circular white background mask.
  const r = size / 2;
  const circle = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#ffffff"/></svg>`,
  );
  const base = await sharp({ create: { width: size, height: size, channels: 4, background: TRANSPARENT } })
    .composite([{ input: circle, gravity: 'center' }])
    .png()
    .toBuffer();
  await sharp(base)
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
}

async function makeForeground(size, out) {
  // Safe zone for adaptive foreground is the center 66% of the canvas.
  const inner = Math.round(size * 0.6);
  const logo = await trimmedLogo(inner);
  await sharp({ create: { width: size, height: size, channels: 4, background: TRANSPARENT } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(out);
}

for (const [dir, size] of Object.entries(legacy)) {
  await makeLegacySquare(size, path.join(resDir, dir, 'ic_launcher.png'));
  await makeLegacyRound(size, path.join(resDir, dir, 'ic_launcher_round.png'));
  await makeForeground(foreground[dir], path.join(resDir, dir, 'ic_launcher_foreground.png'));
  console.log('wrote', dir, `(launcher ${size}, foreground ${foreground[dir]})`);
}
console.log('done');
