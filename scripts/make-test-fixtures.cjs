// Generates deterministic image fixtures for the browser tests.
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const requireImageUtils = createRequire(require.resolve('@expo/image-utils'));
const Jimp = requireImageUtils('jimp-compact');

async function main() {
  // A smooth gradient with a soft grid: large as PNG, much smaller once re-encoded as JPEG.
  const width = 2400;
  const height = 1800;
  const image = new Jimp(width, height, 0xffffffff);
  let seed = 7;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 3) - 1;
  image.scan(0, 0, width, height, (x, y, offset) => {
    const d = image.bitmap.data;
    d[offset] = Math.max(0, Math.min(255, Math.round((x / width) * 255) + noise()));
    d[offset + 1] = Math.round((y / height) * 255);
    d[offset + 2] = (x % 200 < 4 || y % 200 < 4) ? 20 : 120;
    d[offset + 3] = 255;
  });
  const target = path.resolve('tests', 'fixtures', 'sample-2400.png');
  await image.writeAsync(target);
  const jpeg = await image.clone().resize(1600, Jimp.AUTO).quality(82).getBufferAsync(Jimp.MIME_JPEG);
  console.log(`${target}: ${fs.statSync(target).size} bytes (1600px JPEG would be ${jpeg.length} bytes)`);
}
main().catch((error) => { console.error(error); process.exit(1); });
