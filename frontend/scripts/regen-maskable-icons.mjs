/**
 * Regenerate maskable PWA icons from public/logo.png.
 *
 * The previous maskable icons had a dark navy (#1a1a2e) baked-in background,
 * which showed as a dark tile on Android home screens. Maskable icons must
 * fill the whole canvas (launcher masks to a circle/squircle) with the logo
 * kept inside the center ~80% "safe zone". We composite the trimmed logo mark
 * onto a clean white background so the installed icon matches the brand and
 * reads clearly on any launcher shape.
 */
import sharp from 'sharp';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(__dirname, '..', 'public');

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

async function buildMaskable(size, outName) {
  // Safe zone is the center 80%; keep the logo mark within it.
  const logoSize = Math.round(size * 0.72);

  // Trim the white border off the source logo so the mark is centered tightly,
  // then resize it to fit the safe zone.
  const logo = await sharp(path.join(pub, 'logo.png'))
    .trim({ threshold: 10 })
    .resize(logoSize, logoSize, { fit: 'contain', background: WHITE })
    .png()
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(pub, outName));

  console.log('wrote', outName, size + 'x' + size);
}

await buildMaskable(192, 'icon-maskable-192.png');
await buildMaskable(512, 'icon-maskable-512.png');
console.log('done');
