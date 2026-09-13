/**
 * Captures the raw app screens the Play screenshots are built from.
 *
 * Runs against the local dev server wired to the emulators
 * (`nx run web:serve-local`) and the demo account from
 * `seed-demo-data.mjs` — never against production, where a screenshot
 * session would write real entries under a real account.
 *
 * Viewport 432×768 at DPR 2.5 = 1080×1920, the 9:16 size Play asks for.
 * The app scrolls `mat-sidenav-content`, not the window, and each shot is
 * anchored to a heading rather than a pixel offset so a layout change
 * shifts the frame instead of silently cropping the wrong thing.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = resolve(ROOT, 'tmp/store-graphics/shots');
const BASE = process.env.SCREENSHOT_BASE_URL ?? 'http://localhost:4200';
const SCROLLER = 'mat-sidenav-content';

/** [name, route, anchor text, gap below the app bar] */
export const SHOTS = [
  ['01-dashboard', '/app', 'Alle Liegestütze', 78],
  ['02-plantag', '/app', 'Zielfortschritt', 78],
  ['03-letzte', '/app', 'Letzte Übungen', 78],
  ['04-freunde', '/freunde', 'Euer Vergleich', 78],
  ['05-profil', '/u/demo-hero', null, 760],
  ['06-plan', '/training-plans/challenge-30d', 'Fortschritt', 78],
  ['07-bestenliste', '/leaderboard', 'Zuletzt aktualisiert', 220],
  ['08-analyse', '/analysis', 'Verglichen wird', 150],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 432, height: 768 },
  deviceScaleFactor: 2.5,
  isMobile: true,
  hasTouch: true,
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  colorScheme: 'dark',
});
const page = await ctx.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await page.getByLabel(/e-mail/i).fill('wolf@demo.local');
await page
  .getByLabel(/passwort/i)
  .first()
  .fill('demo-screenshots-2026');
await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
await page.waitForTimeout(6000);
if (!page.url().includes('/app'))
  throw new Error(`Login failed, landed on ${page.url()}`);

for (const [name, route, anchor, gap] of SHOTS) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3600);
  const result = await page.evaluate(
    ([sel, text, offset]) => {
      const scroller = document.querySelector(sel);
      if (!scroller) return 'no scroller';
      if (!text) {
        scroller.scrollTo({ top: offset, behavior: 'instant' });
        return 'fixed';
      }
      const el = [
        ...scroller.querySelectorAll('h1,h2,h3,h4,div,span,p,button'),
      ].find(
        (node) =>
          node.textContent?.trim().startsWith(text) &&
          node.offsetHeight > 0 &&
          node.offsetHeight < 160
      );
      if (!el) return `anchor missing: ${text}`;
      const top =
        el.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      scroller.scrollTo({
        top: Math.max(0, top - offset),
        behavior: 'instant',
      });
      return 'ok';
    },
    [SCROLLER, anchor, gap]
  );
  if (result.startsWith('anchor missing') || result === 'no scroller')
    throw new Error(`${name}: ${result}`);
  await page.waitForTimeout(1300);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('→', name);
}

await browser.close();
console.log(`raw shots in ${OUT}`);
