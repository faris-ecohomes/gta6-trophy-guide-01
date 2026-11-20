// take-shots.mjs — render Vice Ledger's four hand-in screenshots.
//
// What it does, in order:
//   1. Serves the app/ folder itself on a throwaway localhost port, so
//      the shots need no other server running.
//   2. Drives the Chrome Headless Shell (the full Chromium in this
//      environment is policy-blocked; the shell is the sanctioned
//      binary) through playwright-core, borrowed from the tools
//      install via createRequire — this repo carries no node_modules.
//   3. Seeds a believable mid-playthrough tracker record under the
//      app's own localStorage key before any page script runs, then
//      captures the checklist (with a guide open), the roadmap, the
//      missables page, and the checklist again with the spoiler
//      shield up and the Story filter on.
//   4. Proves every file before accepting it: the JPEG's own frame
//      header must say 1280x800 and the file must fit the bounty's
//      256 KiB screenshot cap, stepping the encoder quality down
//      until both hold.
//
// Run from the repo root:  node take-shots.mjs

import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const appDir = join(repoRoot, 'app');
const shotsDir = join(repoRoot, 'screenshots');
const STORAGE_KEY = 'vice-ledger-gta6-v1';
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const SIZE_CAP = 262_144;
const WIDTH = 1280;
const HEIGHT = 800;

if (!existsSync(SHELL)) throw new Error(`headless shell not found at ${SHELL}`);
const { chromium } = createRequire('/home/hatch/workspace/tools/pw-shots/package.json')('playwright-core');

/* ---------- a static server for app/ ---------- */

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
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://shot').pathname))
    .replace(/^(\.\.[/\\])+/, '');
  const file = join(appDir, rel === '/' || rel === '\\' ? 'index.html' : rel);
  try {
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;

/* ---------- the seeded tracker record ---------- */

// A player partway through: the first two chapters and a scatter of
// side content earned, the grind counters partway up, and a note left
// on Maximum Withdrawal — the guide shot 1 opens.
function seedRecord(settings) {
  return JSON.stringify({
    earned: [2, 3, 4, 5, 8, 9, 16, 20, 21, 22, 33, 44, 46, 51],
    counters: { 15: 87, 17: 19, 25: 3, 28: 6, 31: 34, 40: 3, 42: 21, 48: 212, 52: 96500, 53: 41200 },
    notes: { 40: 'Two vaults left — pair them with the gang-operations sweep so the heat dies down between runs.' },
    settings,
  });
}

/* ---------- JPEG proof: dimensions out of the frame header ---------- */

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('not a JPEG');
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  throw new Error('no frame header found');
}

async function snap(page, filename) {
  for (const quality of [88, 82, 76, 70, 64, 58]) {
    const buf = await page.screenshot({ type: 'jpeg', quality });
    const { width, height } = jpegSize(buf);
    if (width !== WIDTH || height !== HEIGHT) {
      throw new Error(`${filename}: frame is ${width}x${height}, expected ${WIDTH}x${HEIGHT}`);
    }
    if (buf.length <= SIZE_CAP) {
      await writeFile(join(shotsDir, filename), buf);
      console.log(`${filename}: ${buf.length} bytes at quality ${quality}, ${width}x${height}`);
      return;
    }
    console.log(`${filename}: ${buf.length} bytes at quality ${quality} — over the cap, retrying lower`);
  }
  throw new Error(`${filename}: no quality setting fit the ${SIZE_CAP}-byte cap`);
}

/* ---------- the four shots ---------- */

const browser = await chromium.launch({ executablePath: SHELL });
try {
  // Shots 1–3 share one record: shield off, hidden trophies revealed.
  let ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
  await ctx.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [STORAGE_KEY, seedRecord({ spoilerShield: false, revealHidden: true, unearnedOnly: false })],
  );
  let page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.trophy-row');

  // 1 — checklist with the Maximum Withdrawal guide open in the pane.
  await page.locator('.trophy-open[data-open="40"]').click();
  await page.waitForSelector('#guide-pane .sources-box');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await snap(page, '1-checklist.jpg');

  // 2 — the roadmap.
  await page.locator('#view-tabs .tab[data-view="roadmap"]').click();
  await page.waitForSelector('.stage-block');
  await page.waitForTimeout(200);
  await snap(page, '2-roadmap.jpg');

  // 3 — the missables page.
  await page.locator('#view-tabs .tab[data-view="missables"]').click();
  await page.waitForSelector('.missable-entry');
  await page.waitForTimeout(200);
  await snap(page, '3-missables.jpg');
  await ctx.close();

  // Shot 4 gets its own record: spoiler shield on, then the Story
  // filter, so the unearned story rows stand masked.
  ctx = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
  await ctx.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [STORAGE_KEY, seedRecord({ spoilerShield: true, revealHidden: true, unearnedOnly: false })],
  );
  page = await ctx.newPage();
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.trophy-row');
  await page.locator('#kind-filters .chip[data-kind="story"]').click();
  await page.waitForSelector('.masked-name');
  // The earned story rows come first, so the first masked row sits at
  // the fold — nudge it into frame so the shield is unmistakable.
  await page.locator('.masked-name').first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await snap(page, '4-spoilers.jpg');
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}
console.log('all four screenshots written');
