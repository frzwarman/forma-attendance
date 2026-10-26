// Deterministic crops of the owner-supplied Bawaslu key visual; no redrawing, no new dependencies.
const path = require('node:path');
const { createRequire } = require('node:module');
const requireImageUtils = createRequire(require.resolve('@expo/image-utils'));
const Jimp = requireImageUtils('jimp-compact');

const brandDir = path.join(path.dirname(require.resolve('../app.json')), 'assets/brand');
const out = (name) => path.join(brandDir, name);


async function writeIcon(mark, filename, size, height, background) {
  const scaled = mark.clone().resize(Jimp.AUTO, height, Jimp.RESIZE_BICUBIC);
  const canvas = new Jimp(size, size, background);
  canvas.composite(scaled, Math.round((size - scaled.bitmap.width) / 2), Math.round((size - height) / 2));
  if (background !== 0x00000000) {
    for (let offset = 3; offset < canvas.bitmap.data.length; offset += 4) canvas.bitmap.data[offset] = 255;
  }
  await canvas.writeAsync(out(filename));
}

async function main() {
  const source = await Jimp.read(out('bawaslu-kv.png'));
  if (source.bitmap.width !== 4536 || source.bitmap.height !== 2552) throw new Error('Unexpected key visual size');

  // Logo: the official transparent logo from bawaslu.go.id, resized for the web.
  const logoSource = await Jimp.read(out('bawaslu-logo-source.png'));
  await logoSource.clone().resize(1200, Jimp.AUTO, Jimp.RESIZE_BICUBIC).writeAsync(out('bawaslu-logo.png'));

  // Background: everything below the pill, 1600 px wide JPEG under 240 KB.
  const background = source.clone().crop(0, 400, 4536, 2152).resize(1600, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
  for (let quality = 82; quality >= 40; quality -= 6) {
    const buffer = await background.clone().quality(quality).getBufferAsync(Jimp.MIME_JPEG);
    if (buffer.length <= 240 * 1024 || quality <= 40) {
      await background.quality(quality).writeAsync(out('bawaslu-background.jpg'));
      console.log(`bawaslu-background.jpg: quality ${quality}, ${buffer.length} bytes`);
      break;
    }
  }

  // Icons: the ballot-box mark from the transparent logo.
  const mark = logoSource.clone().crop(0, 0, 560, 720);
  await writeIcon(mark, 'app-icon.png', 1024, 640, '#ffffff');
  await writeIcon(mark, 'adaptive-icon.png', 1024, 560, 0x00000000);
  await writeIcon(mark, 'favicon.png', 64, 48, '#ffffff');
  for (const name of ['bawaslu-logo.png', 'bawaslu-background.jpg', 'app-icon.png', 'adaptive-icon.png', 'favicon.png']) {
    console.log(`${name}: ${require('node:fs').statSync(out(name)).size} bytes`);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
