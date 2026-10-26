// Gate for the public page weight budget. Measures what a browser actually downloads
// for "/" from the built site (gzipped JavaScript) plus the bundled brand images.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const zlib = require('node:zlib');
const { chromium } = require('@playwright/test');

const JS_LIMIT = 512000;
const IMAGE_LIMIT = 307200;
const PORT = 4174;
const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon' };
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

async function main() {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const scripts = new Map();
  page.on('response', async (response) => {
    const url = new URL(response.url());
    if (url.hostname !== '127.0.0.1' || !url.pathname.endsWith('.js')) return;
    try { scripts.set(url.pathname, zlib.gzipSync(await response.body(), { level: 9 }).length); } catch { /* aborted */ }
  });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await browser.close();
  server.close();
  let publicJs = 0;
  console.log('JavaScript downloaded for / (gzipped)');
  for (const [name, size] of [...scripts].sort()) {
    publicJs += size;
    console.log(`  ${kb(size).padStart(10)}  ${path.basename(name)}`);
  }
  let images = 0;
  console.log('Bundled images');
  for (const name of ['bawaslu-background.jpg', 'bawaslu-logo.png']) {
    const size = fs.statSync(path.join('assets', 'brand', name)).size;
    images += size;
    console.log(`  ${kb(size).padStart(10)}  ${name}`);
  }
  console.log(`Public JavaScript: ${kb(publicJs)} (limit ${kb(JS_LIMIT)})`);
  console.log(`Images: ${kb(images)} (limit ${kb(IMAGE_LIMIT)})`);
  if (publicJs > JS_LIMIT || images > IMAGE_LIMIT) {
    console.error('Weight budget exceeded.');
    process.exit(1);
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
