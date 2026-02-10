import {
  ɵsetAngularAppEngineManifest,
  ɵsetAngularAppManifest,
} from '@angular/ssr';
import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

type PushupEntry = {
  timestamp: string;
  reps: number;
  source: string;
};

type SeriesEntry = {
  bucket: string;
  total: number;
  dayIntegral: number;
};

const WORKSPACE = process.env['WORKSPACE_DIR'] || '/home/wolf/.openclaw/workspace';
const CSV_PATH = process.env['PUSHUPS_CSV_PATH'] || join(WORKSPACE, 'pushups.csv');

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

function parseCsv(): PushupEntry[] {
  if (!fs.existsSync(CSV_PATH)) return [];
  const raw = fs.readFileSync(CSV_PATH, 'utf8').trim();
  if (!raw) return [];

  const lines = raw.split(/\r?\n/).slice(1);
  const rows: PushupEntry[] = [];

  for (const line of lines) {
    const [timestamp, reps, source] = line.split(',');
    const n = Number(reps);
    if (!timestamp || Number.isNaN(n)) continue;
    rows.push({ timestamp, reps: n, source: source || '' });
  }

  rows.sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  return rows;
}

function aggregateDaily(rows: PushupEntry[]): SeriesEntry[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = r.timestamp.slice(0, 10);
    map.set(d, (map.get(d) || 0) + r.reps);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, total]) => ({ bucket, total, dayIntegral: total }));
}

function aggregateHourly(rows: PushupEntry[]): SeriesEntry[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const h = `${r.timestamp.slice(0, 13)}:00`;
    map.set(h, (map.get(h) || 0) + r.reps);
  }

  const base = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, total]) => ({ bucket, total }));

  let currentDay: string | null = null;
  let running = 0;

  return base.map((x) => {
    const day = x.bucket.slice(0, 10);
    if (day !== currentDay) {
      currentDay = day;
      running = 0;
    }
    running += x.total;
    return { ...x, dayIntegral: running };
  });
}

const angularAppManifest = (
  await import(new URL('./angular-app-manifest.mjs', import.meta.url).href)
).default;
const angularAppEngineManifest = (
  await import(new URL('./angular-app-engine-manifest.mjs', import.meta.url).href)
).default;

ɵsetAngularAppManifest(angularAppManifest);
ɵsetAngularAppEngineManifest(angularAppEngineManifest);

const app = express();
const angularApp = new AngularNodeAppEngine();

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  const rows = parseCsv();
  const from = typeof req.query['from'] === 'string' ? req.query['from'] : null;
  const to = typeof req.query['to'] === 'string' ? req.query['to'] : null;
  const inRange = (d: string): boolean => (!from || d >= from) && (!to || d <= to);

  const filteredRows = rows.filter((x) => inRange(x.timestamp.slice(0, 10)));
  const daily = aggregateDaily(filteredRows);
  const distinctDays = new Set(filteredRows.map((x) => x.timestamp.slice(0, 10))).size;
  const granularity = distinctDays > 0 && distinctDays < 7 ? 'hourly' : 'daily';
  const series = granularity === 'hourly' ? aggregateHourly(filteredRows) : daily;
  const total = daily.reduce((s, x) => s + x.total, 0);

  res.setHeader('Cache-Control', 'no-store');
  res.json({
    meta: {
      from,
      to,
      entries: filteredRows.length,
      days: distinctDays,
      total,
      granularity,
    },
    series,
    daily,
    entries: filteredRows,
  });
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node SSR server listening on http://localhost:${port}`);
    console.log(`CSV path: ${CSV_PATH}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
