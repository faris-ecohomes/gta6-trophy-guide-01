// take-shots.mjs — renders the four dossier screenshots of the Vice
// Ledger trophy guide for the make.fun hand-in.
//
// The guide is a static site, so this script serves app/ itself on a
// scratch port, drives it with the Chrome Headless Shell through
// playwright-core (borrowed from the shared tools install — this repo
// carries no node_modules of its own), seeds a half-finished tracker
// state so the pages show real progress, and writes 1280x800 JPEGs
// into screenshots/. Every file is kept under the gate's 256 KiB
// ceiling by re-encoding at a lower quality until it fits, and the
// pixel size of each finished file is read back out of the JPEG
// markers and printed, so the dimensions are proven, not assumed.
//
//   node take-shots.mjs

import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(repoDir, 'app');
const shotsDir = join(repoDir, 'screenshots');
const PORT = 8937;
const PAGE = `http://127.0.0.1:${PORT}/`;
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const MAX_BYTES = 262_144;
const STORE_KEY = 'vice-ledger-gta6-v1';

// playwright-core lives in the tools install, not in this repo.
const require = createRequire('/home/hatch/workspace/tools/pw-shots/package.json');
const { chromium } = require('playwright-core');

// --- a small static server for app/, same job as serve.ts but owned
// by this script so the render run is one command -------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  const clean = normalize(decodeURIComponent(new URL(req.url, PAGE).pathname))
    .replace(/^(\.\.[/\\])+/, '');
  const target = join(appDir, clean === '/' || clean === '\\' ? 'index.html' : clean);
  try {
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

// --- the seeded tracker state: a player part-way through the list --
// Earned and counter numbers are chosen against the targets in
// app/data/trophies.json so progress bars land mid-travel.
function seededState(settings) {
  return JSON.stringify({
    earned: [2, 3, 4, 5, 6, 8, 10, 12, 16, 21, 24, 33, 44, 51],
    counters: { 15: 132, 17: 23, 28: 7, 31: 47, 40: 3, 42: 29, 48: 264, 52: 137_500 },
    notes: { 40: 'Three vaults down. Save the last two for a night when the wanted level system is calm.' },
    settings,
  });
}

// --- helpers ---------------------------------------------------------

// Read the frame size out of a JPEG's start-of-frame marker.
function jpegDimensions(buf) {
  let i = 2; // skip the SOI marker
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('no start-of-frame marker found');
}

// Screenshot that shrinks its own quality until the gate cap is met.
async function snap(page, file) {
  const path = join(shotsDir, file);
  for (let quality = 88; quality >= 40; quality -= 8) {
    await page.screenshot({ path, type: 'jpeg', quality });
    const { size } = await stat(path);
    if (size <= MAX_BYTES) {
      const dims = jpegDimensions(await readFile(path));
      console.log(`${file}: ${dims.width}x${dims.height}, ${size} bytes (quality ${quality})`);
      return;
    }
  }
  throw new Error(`${file} still over ${MAX_BYTES} bytes at minimum quality`);
}

async function openSeededPage(browser, settings) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORE_KEY, seededState(settings)],
  );
  const page = await context.newPage();
  await page.goto(PAGE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.trophy-row');
  return { context, page };
}

// --- the four views ----------------------------------------------------
const browser = await chromium.launch({ executablePath: SHELL });

// Views 1–3: shield off and hidden trophies revealed, so names,
// guides and sources all show.
{
  const { context, page } = await openSeededPage(browser, {
    spoilerShield: false, revealHidden: true, unearnedOnly: false,
  });

  const vaultRow = page.locator('.trophy-row', { hasText: 'Maximum Withdrawal' }).first();
  await vaultRow.locator('.trophy-open').click();
  await page.waitForSelector('#guide-pane .sources-box');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await snap(page, '1-checklist.jpg');

  await page.locator('#view-tabs .tab[data-view="roadmap"]').click();
  await page.waitForSelector('.stage-block');
  await page.waitForTimeout(200);
  await snap(page, '2-roadmap.jpg');

  await page.locator('#view-tabs .tab[data-view="missables"]').click();
  await page.waitForSelector('.missable-entry');
  await page.waitForTimeout(200);
  await snap(page, '3-missables.jpg');

  await context.close();
}

// View 4: the spoiler shield doing its job on the Story filter.
{
  const { context, page } = await openSeededPage(browser, {
    spoilerShield: true, revealHidden: true, unearnedOnly: false,
  });
  await page.locator('#kind-filters .chip[data-kind="story"]').click();
  await page.waitForSelector('.masked-name');
  await page.waitForTimeout(200);
  await snap(page, '4-spoilers.jpg');
  await context.close();
}

await browser.close();
server.close();
console.log('all four screenshots written');
