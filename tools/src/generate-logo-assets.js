#!/usr/bin/env node
/**
 * Regenerates PWA icons, favicons, and in-app logo PNG from a single square
 * source image. Designed for one-off re-brands — run transiently via dlx:
 *
 *   pnpm dlx -p sharp -p png-to-ico \
 *     node tools/src/generate-logo-assets.js <source.png>
 *
 * Defaults: source = ./pushup-stats-logo.png
 *
 * Outputs (relative to repo root):
 *   web/public/icons/icon-{72,96,128,144,152,192,384,512}x*.png
 *   web/public/icons/badge-72x72.png
 *   web/public/favicon.ico        (multi-res: 16, 32, 48)
 *   web/public/favicon.png        (180 - apple-touch compatible)
 *   web/public/assets/pushup-logo.png (in-app toolbar/header logo)
 *   web/public/assets/pushup-logo.webp (LCP-optimised, ~95% smaller)
 */

const { resolve } = require('node:path');
const { writeFileSync } = require('node:fs');

const sharp = require('sharp');
// png-to-ico v3 ships as ESM/interop — `.default` is the function, `.imagesToIco` is its named export.
const pngToIco = require('png-to-ico').default ?? require('png-to-ico');

const ROOT = resolve(__dirname, '../..');
const SOURCE = resolve(ROOT, process.argv[2] ?? 'pushup-stats-logo.png');

const PWA_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const FAVICON_ICO_SIZES = [16, 32, 48];
const FAVICON_PNG_SIZE = 180;
const LOGO_PNG_SIZE = 512;
// WebP rendition served to the page. Displayed at ≤160px (hero), so 384px
// covers retina everywhere while staying a fraction of the PNG's size.
const LOGO_WEBP_SIZE = 384;
const BADGE_SIZE = 72;

async function resizeTo(size, outPath) {
  await sharp(SOURCE)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(resolve(ROOT, outPath));
  console.log(`  ${size}x${size}  →  ${outPath}`);
}

async function main() {
  console.log(`source: ${SOURCE}`);
  const meta = await sharp(SOURCE).metadata();
  if (meta.width !== meta.height) {
    console.warn(
      `⚠  source is not square (${meta.width}x${meta.height}) — icons will be letterboxed`
    );
  }

  console.log('\nPWA icons:');
  for (const size of PWA_SIZES) {
    await resizeTo(size, `web/public/icons/icon-${size}x${size}.png`);
  }

  console.log('\nNotification badge (Android tints it white via alpha):');
  await resizeTo(
    BADGE_SIZE,
    `web/public/icons/badge-${BADGE_SIZE}x${BADGE_SIZE}.png`
  );

  console.log('\nIn-app logo (toolbar + dashboard header):');
  await resizeTo(LOGO_PNG_SIZE, 'web/public/assets/pushup-logo.png');

  console.log('\nIn-app logo WebP (LCP-optimised):');
  await sharp(SOURCE)
    .resize(LOGO_WEBP_SIZE, LOGO_WEBP_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 82 })
    .toFile(resolve(ROOT, 'web/public/assets/pushup-logo.webp'));
  console.log(
    `  ${LOGO_WEBP_SIZE}x${LOGO_WEBP_SIZE}  →  web/public/assets/pushup-logo.webp`
  );

  console.log('\nFavicon PNG (modern browsers, apple-touch):');
  await resizeTo(FAVICON_PNG_SIZE, 'web/public/favicon.png');

  console.log('\nFavicon ICO (legacy browsers, multi-res):');
  const buffers = await Promise.all(
    FAVICON_ICO_SIZES.map((size) =>
      sharp(SOURCE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
    )
  );
  const icoBuffer = await pngToIco(buffers);
  const icoPath = resolve(ROOT, 'web/public/favicon.ico');
  writeFileSync(icoPath, icoBuffer);
  console.log(`  ${FAVICON_ICO_SIZES.join(', ')}  →  web/public/favicon.ico`);

  console.log('\n✓ done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
