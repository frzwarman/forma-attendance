// Gate for the public page weight budget. Measures what a browser actually downloads
// on a first visit to "/" from the built site: gzipped JavaScript and images.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const zlib = require('node:zlib');
const { chromium } = require('@playwright/test');

const JS_LIMIT = 512000;
const IMAGE_LIMIT = 307200;
const PORT = 4174;
const root = path.resolve('dist');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.ico': 'image/x-icon' };
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
  const images = new Map();
  page.on('response', async (response) => {
    const url = new URL(response.url());
    if (url.hostname !== '127.0.0.1') return;
    try {
      const body = await response.body();
      if (url.pathname.endsWith('.js')) scripts.set(url.pathname, zlib.gzipSync(body, { level: 9 }).length);
      else if ((response.headers()['content-type'] || '').startsWith('image/')) images.set(url.pathname, body.length);
    } catch { /* aborted */ }
  });
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle' });
  await browser.close();
  server.close();
  const report = (title, entries) => {
    let total = 0;
    console.log(title);
    for (const [name, size] of [...entries].sort()) {
      total += size;
      console.log(`  ${kb(size).padStart(10)}  ${path.basename(name)}`);
    }
    return total;
  };
  const js = report('JavaScript downloaded for / (gzipped)', scripts);
  const img = report('Images downloaded for /', images);
  console.log(`Public JavaScript: ${kb(js)} (limit ${kb(JS_LIMIT)})`);
  console.log(`Images: ${kb(img)} (limit ${kb(IMAGE_LIMIT)})`);
  if (js > JS_LIMIT || img > IMAGE_LIMIT) {
    console.error('Weight budget exceeded.');
    process.exit(1);
  }
}
main().catch((error) => { console.error(error); process.exit(1); });
