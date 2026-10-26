// Deterministic crops of the owner-supplied Bawaslu key visual; no redrawing, no new dependencies.
const path = require('node:path');
const { createRequire } = require('node:module');
const requireImageUtils = createRequire(require.resolve('@expo/image-utils'));
const Jimp = requireImageUtils('jimp-compact');

const brandDir = path.join(path.dirname(require.resolve('../app.json')), 'assets/brand');
const out = (name) => path.join(brandDir, name);



// GIMP-style "colour to alpha": removes the navy key colour so the graphic blends
// over any similar navy, keeping glows and thin lines as partial transparency.
function colorToAlpha(image, key) {
  image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, offset) => {
    const d = image.bitmap.data;
    let alpha = 0;
    for (let c = 0; c < 3; c++) {
      const p = d[offset + c];
      const k = key[c];
      const a = p > k ? (p - k) / (255 - k) : p < k ? (k - p) / k : 0;
      alpha = Math.max(alpha, a);
    }
    if (alpha < 0.05) {
      d[offset + 3] = 0;
      return;
    }
    for (let c = 0; c < 3; c++) d[offset + c] = Math.max(0, Math.min(255, Math.round((d[offset + c] - key[c]) / alpha + key[c])));
    d[offset + 3] = Math.round(alpha * 255);
  });
  return image;
}

// Key colour: the darker end (20th percentile per channel) of the border pixels.
function borderKey(image) {
  const { width, height, data } = image.bitmap;
  const channels = [[], [], []];
  const sample = (x, y) => {
    const i = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) channels[c].push(data[i + c]);
  };
  for (let x = 0; x < width; x += 4) { sample(x, 0); sample(x, height - 1); }
  for (let y = 0; y < height; y += 4) { sample(0, y); }
  return channels.map((values) => values.sort((a, b) => a - b)[Math.floor(values.length * 0.2)]);
}

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
  await logoSource.clone().resize(800, Jimp.AUTO, Jimp.RESIZE_BICUBIC).writeAsync(out('bawaslu-logo.png'));

  // Sphere illustration: cropped from KV Bawaslu-01 (x 10553–13833, y 69–3495 of 13833 × 4819)
  // into bawaslu-sphere-source.png; the web copy has a transparent background.
  const sphere = await Jimp.read(out('bawaslu-sphere-source.png'));
  const key = borderKey(sphere);
  const spherePng = path.join(require('node:os').tmpdir(), 'bawaslu-sphere.png');
  await colorToAlpha(sphere.clone().resize(480, Jimp.AUTO, Jimp.RESIZE_BICUBIC), key).writeAsync(spherePng);
  // WebP keeps the transparency at a fraction of the PNG size (needs cwebp: brew install webp).
  require('node:child_process').execFileSync('cwebp', ['-quiet', '-q', '80', '-alpha_q', '80', spherePng, '-o', out('bawaslu-sphere.webp')]);
  console.log(`sphere key colour: rgb(${key.join(", ")})`);

  // Background: below the logo pill and left of the network sphere (the sphere is shown
  // separately beside the logo), 1400 px wide JPEG under 120 KB.
  const background = source.clone().crop(0, 400, 2880, 2152).resize(1400, Jimp.AUTO, Jimp.RESIZE_BICUBIC);
  for (let quality = 82; quality >= 40; quality -= 6) {
    const buffer = await background.clone().quality(quality).getBufferAsync(Jimp.MIME_JPEG);
    if (buffer.length <= 120 * 1024 || quality <= 40) {
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
  for (const name of ['bawaslu-logo.png', 'bawaslu-sphere.webp', 'bawaslu-background.jpg', 'app-icon.png', 'adaptive-icon.png', 'favicon.png']) {
    console.log(`${name}: ${require('node:fs').statSync(out(name)).size} bytes`);
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
