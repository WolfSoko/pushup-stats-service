/**
 * Turns the raw app screens into the assets Play expects: eight captioned
 * 1080×1920 screenshots and the 1024×500 feature graphic.
 *
 * Composed in Chromium rather than an image library because the captions
 * are typography, not pixels — and because the repo already carries a
 * browser for e2e, while `sharp` is only ever pulled transiently.
 */
import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const SHOTS = resolve(ROOT, 'tmp/store-graphics/shots');
const OUT = resolve(ROOT, 'store/graphics/de-DE');

/** Caption per screenshot. Each states a feature, not a mood. */
export const CAPTIONS = [
  [
    '01-dashboard',
    'Jede Wiederholung zählt',
    'Gesamtzahl, Schnitt und Bestwerte auf einen Blick',
  ],
  [
    '02-plantag',
    'Der Plan sagt, was heute dran ist',
    'Tagesziel, Sätze und Fortschritt — hakt sich selbst ab',
  ],
  [
    '03-letzte',
    'Erfassen in zwei Sekunden',
    '42 Übungen, jede in ihrer eigenen Einheit',
  ],
  [
    '04-freunde',
    'Challenges mit Freunden',
    '500 Liegestütze in 7 Tagen — jeder mit eigenem Fortschritt',
  ],
  [
    '05-profil',
    'Dein Profil, deine Regeln',
    'Jede Kachel: aus, nur für Freunde oder öffentlich',
  ],
  [
    '06-plan',
    '10 Trainingspläne',
    'Fünf rechnen jede Vorgabe auf deinen Maximaltest um',
  ],
  [
    '07-bestenliste',
    'Miss dich mit anderen',
    'Heute, 7 Tage, 30 Tage oder seit Beginn',
  ],
  [
    '08-analyse',
    'Sieh, was sich verändert',
    'Verlauf, Kategorien und Bestwerte je Zeitraum',
  ],
];

export const FEATURE_CLAIM = {
  lines: ['Die Kamera zählt.', 'Der Plan führt.'],
  accent: 'Die Freunde treiben an.',
  sub: '42 Übungen · 10 Trainingspläne · ohne Abo',
};

const BACKDROP = `
  radial-gradient(120% 80% at 20% 0%, rgba(79,124,255,.28) 0%, rgba(13,18,32,0) 60%),
  radial-gradient(100% 70% at 90% 15%, rgba(150,90,255,.22) 0%, rgba(13,18,32,0) 55%),
  linear-gradient(170deg, #121a30 0%, #0d1220 55%, #0a0e1a 100%)`;

const framesHtml = () => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#000;font-family:'Noto Sans','DejaVu Sans',system-ui,sans-serif}
  .frame{width:1080px;height:1920px;position:relative;overflow:hidden;background:${BACKDROP};display:flex;flex-direction:column;align-items:center}
  .cap{padding:96px 84px 0;text-align:center;width:100%}
  .cap h2{font-size:68px;line-height:1.12;font-weight:800;color:#fff;letter-spacing:-1.5px}
  .cap p{margin-top:22px;font-size:34px;line-height:1.35;color:#9db0d6;font-weight:500}
  .shot{margin-top:54px;width:858px;border-radius:44px;overflow:hidden;border:2px solid rgba(255,255,255,.14);
        box-shadow:0 40px 90px rgba(0,0,0,.55),0 0 0 10px rgba(255,255,255,.03)}
  .shot img{width:100%;display:block}
</style><body>${CAPTIONS.map(
  ([id, head, sub]) =>
    `<div class="frame" id="f-${id}"><div class="cap"><h2>${head}</h2><p>${sub}</p></div><div class="shot"><img src="${id}.png"></div></div>`
).join('')}</body>`;

const featureHtml = () => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#000;font-family:'Noto Sans','DejaVu Sans',system-ui,sans-serif}
  .fg{width:1024px;height:500px;position:relative;overflow:hidden;display:flex;align-items:center;background:
      radial-gradient(90% 120% at 12% 20%, rgba(79,124,255,.38) 0%, rgba(13,18,32,0) 60%),
      radial-gradient(80% 120% at 78% 85%, rgba(150,90,255,.32) 0%, rgba(13,18,32,0) 60%),
      linear-gradient(120deg,#14203c 0%,#0d1220 60%,#0a0e1a 100%)}
  .left{padding:0 0 0 72px;width:640px}
  .brandrow{display:flex;align-items:center;gap:22px;margin-bottom:26px}
  .brandrow img{width:92px;height:92px;border-radius:22px}
  .brandrow .name{font-size:52px;font-weight:800;color:#fff;letter-spacing:-1px}
  .claim{font-size:38px;line-height:1.25;font-weight:700;color:#fff;letter-spacing:-.5px}
  .claim span{color:#8fb4ff}
  .sub{margin-top:20px;font-size:25px;line-height:1.4;color:#9db0d6;font-weight:500}
  .phone{position:absolute;right:58px;top:34px;width:300px;border-radius:30px;overflow:hidden;
         border:2px solid rgba(255,255,255,.16);box-shadow:0 30px 70px rgba(0,0,0,.6)}
  .phone img{width:100%;display:block}
</style><body><div class="fg" id="fg">
  <div class="left">
    <div class="brandrow"><img src="icon.png"><div class="name">Pushup Tracker</div></div>
    <div class="claim">${FEATURE_CLAIM.lines.join('<br>')}<br><span>${FEATURE_CLAIM.accent}</span></div>
    <div class="sub">${FEATURE_CLAIM.sub}</div>
  </div>
  <div class="phone"><img src="01-dashboard.png"></div>
</div></body>`;

mkdirSync(OUT, { recursive: true });
copyFileSync(
  resolve(ROOT, 'web/public/icons/icon-512x512.png'),
  `${SHOTS}/icon.png`
);
copyFileSync(
  resolve(ROOT, 'web/public/icons/icon-512x512.png'),
  resolve(ROOT, 'store/graphics/store-icon.png')
);
writeFileSync(`${SHOTS}/frames.html`, framesHtml());
writeFileSync(`${SHOTS}/feature.html`, featureHtml());

const browser = await chromium.launch();

const framePage = await (
  await browser.newContext({ viewport: { width: 1080, height: 1920 } })
).newPage();
await framePage.goto(`file://${SHOTS}/frames.html`, {
  waitUntil: 'networkidle',
});
await framePage.waitForTimeout(1200);
for (const [id] of CAPTIONS) {
  await framePage
    .locator(`[id="f-${id}"]`)
    .screenshot({ path: `${OUT}/screenshot-${id}.png` });
  console.log('→', `screenshot-${id}.png`);
}

const fgPage = await (
  await browser.newContext({ viewport: { width: 1024, height: 500 } })
).newPage();
await fgPage.goto(`file://${SHOTS}/feature.html`, { waitUntil: 'networkidle' });
await fgPage.waitForTimeout(900);
await fgPage.locator('#fg').screenshot({ path: `${OUT}/feature-graphic.png` });
console.log('→ feature-graphic.png');

await browser.close();
