// Deterministic exports of the supplied logo; no redrawing or new dependencies.
const path = require('node:path');
const { createRequire } = require('node:module');
const requireImageUtils = createRequire(require.resolve('@expo/image-utils'));
const Jimp = requireImageUtils('jimp-compact');

const brandDir = path.join(path.dirname(require.resolve('../app.json')), 'assets/brand');

async function main() {
  const source = await Jimp.read(path.join(brandDir, 'nusantara-logo.png'));
  // The original emblem occupies rows 0–695; the separate wordmark starts at 804.
  let left = source.bitmap.width;
  let right = 0;
  source.scan(0, 0, source.bitmap.width, 696, (x, _y, offset) => {
    if (source.bitmap.data[offset + 3] > 0) {
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  });
  const emblem = source.clone().crop(left, 0, right - left + 1, 696);

  async function writeIcon(filename, size, height, background) {
    const mark = emblem.clone().resize(Jimp.AUTO, height, Jimp.RESIZE_BICUBIC);
    const canvas = new Jimp(size, size, background);
    canvas.composite(mark, Math.round((size - mark.bitmap.width) / 2), Math.round((size - height) / 2));
    // Jimp's alpha blending can round opaque pixels to 254; iOS requires 255.
    if (background !== 0x00000000) {
      for (let offset = 3; offset < canvas.bitmap.data.length; offset += 4) {
        canvas.bitmap.data[offset] = 255;
      }
    }
    await canvas.writeAsync(path.join(brandDir, filename));
  }

  // iOS and legacy Android: opaque square, with corners applied by the OS.
  await writeIcon('app-icon.png', 1024, 728, '#1D1B1A');
  // Android: the whole emblem fits inside the central adaptive-icon safe zone.
  await writeIcon('adaptive-icon.png', 1024, 608, 0x00000000);
  await writeIcon('favicon.png', 64, 52, '#1D1B1A');
  console.log('Generated Nusantara app, adaptive, and favicon assets.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
