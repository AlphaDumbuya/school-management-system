/**
 * Generate correctly-sized PWA icons from public/logo.png using sharp.
 * PWA installability requires real 192x192 and 512x512 PNGs whose declared
 * manifest sizes match the actual image dimensions. Also emits a maskable
 * icon (logo centered on a themed background with a safe zone) and an
 * apple-touch-icon.
 *
 * Run: node scripts/generate-pwa-icons.mjs
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');
const src = path.join(publicDir, 'logo.png');

const BG = '#1a1a2e'; // app background for maskable safe zone

async function contain(size, out) {
  await sharp(src)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(publicDir, out));
  console.log('  ✓', out, `(${size}x${size})`);
}

async function maskable(size, out) {
  // Logo occupies ~68% of the canvas (Android maskable safe zone ≈ 80%,
  // we keep extra breathing room), centered on the app background.
  const inner = Math.round(size * 0.68);
  const logo = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(publicDir, out));
  console.log('  ✓', out, `(${size}x${size} maskable)`);
}

console.log('Generating PWA icons from', src);
await contain(192, 'icon-192.png');
await contain(512, 'icon-512.png');
await contain(180, 'apple-touch-icon.png');
await maskable(512, 'icon-maskable-512.png');
await maskable(192, 'icon-maskable-192.png');
console.log('Done.');
