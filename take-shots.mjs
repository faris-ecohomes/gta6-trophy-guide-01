// Take this entry's screenshots: real renders of app/ in the Chrome
// Headless Shell, 1280x800 JPEGs, written to screenshots/ beside this
// file. Progress is seeded the way a player part-way to the platinum
// would leave it (13 of 55 earned, counters part way, one note), so
// the shots show the tracker at work, not an empty page.
//
//   node serve.ts          (in another shell; serves app/ on :8080)
//   node take-shots.mjs
import { chromium } from '/home/hatch/workspace/tools/pw-shots/node_modules/playwright-core/index.mjs';
import { mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:8080';
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');
const KEY = 'vice-ledger-gta6-v1';
const SHELL = '/home/hatch/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/headless_shell';

const seed = (settings) => JSON.stringify({
  earned: [2, 3, 4, 5, 8, 9, 16, 20, 21, 22, 33, 46, 51],
  counters: { 15: 87, 17: 19, 28: 6, 31: 34, 40: 3, 42: 21, 48: 212, 52: 96500 },
  notes: { 40: 'Two vaults left — do them on the same run as the gang-operations sweep.' },
  settings,
});

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: SHELL });

// Shots 1–3: spoilers off, hidden trophies revealed.
let context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(([k, v]) => localStorage.setItem(k, v),
  [KEY, seed({ spoilerShield: false, revealHidden: true, unearnedOnly: false })]);
let page = await context.newPage();

await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForSelector('.trophy-row');
await page.locator('.trophy-row', { hasText: 'Maximum Withdrawal' }).first()
  .locator('.trophy-open').click();
await page.waitForSelector('#guide-pane .sources-box');
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(350);
await page.screenshot({ path: join(OUT, '1-checklist.jpg'), type: 'jpeg', quality: 82 });
console.log('shot 1 done');

await page.locator('#view-tabs .tab[data-view="roadmap"]').click();
await page.waitForSelector('.stage-block');
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '2-roadmap.jpg'), type: 'jpeg', quality: 82 });
console.log('shot 2 done');

await page.locator('#view-tabs .tab[data-view="missables"]').click();
await page.waitForSelector('.missable-entry');
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '3-missables.jpg'), type: 'jpeg', quality: 82 });
console.log('shot 3 done');
await context.close();

// Shot 4: spoiler shield on, Story filter active — story names masked.
context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await context.addInitScript(([k, v]) => localStorage.setItem(k, v),
  [KEY, seed({ spoilerShield: true, revealHidden: true, unearnedOnly: false })]);
page = await context.newPage();
await page.goto(BASE + '/', { waitUntil: 'networkidle' });
await page.waitForSelector('.trophy-row');
await page.locator('#kind-filters .chip[data-kind="story"]').click();
await page.waitForSelector('.masked-name');
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '4-spoilers.jpg'), type: 'jpeg', quality: 82 });
console.log('shot 4 done');
await context.close();

await browser.close();
for (const f of ['1-checklist.jpg', '2-roadmap.jpg', '3-missables.jpg', '4-spoilers.jpg']) {
  console.log(f, statSync(join(OUT, f)).size, 'bytes');
}
