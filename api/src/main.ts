import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

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

const WORKSPACE = process.env.WORKSPACE_DIR || '/home/wolf/.openclaw/workspace';
const CSV_PATH = process.env.PUSHUPS_CSV_PATH || path.join(WORKSPACE, 'pushups.csv');
const PORT = Number(process.env.PORT || 8787);
const STATIC_DIR =
  process.env.WEB_DIST_PATH || path.join(process.cwd(), 'dist', 'web', 'browser');

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

function contentType(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.js' || ext === '.mjs') return 'application/javascript; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.ico') return 'image/x-icon';
  return 'application/octet-stream';
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function safeStaticPath(urlPath: string): string {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const rel = clean.replace(/^\/+/, '');
  const resolved = path.resolve(STATIC_DIR, rel);
  if (!resolved.startsWith(path.resolve(STATIC_DIR))) return '';
  return resolved;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (u.pathname === '/api/stats') {
    const rows = parseCsv();
    const from = u.searchParams.get('from');
    const to = u.searchParams.get('to');
    const inRange = (d: string): boolean => (!from || d >= from) && (!to || d <= to);

    const filteredRows = rows.filter((x) => inRange(x.timestamp.slice(0, 10)));
    const daily = aggregateDaily(filteredRows);
    const distinctDays = new Set(filteredRows.map((x) => x.timestamp.slice(0, 10))).size;
    const granularity = distinctDays > 0 && distinctDays < 7 ? 'hourly' : 'daily';
    const series = granularity === 'hourly' ? aggregateHourly(filteredRows) : daily;
    const total = daily.reduce((s, x) => s + x.total, 0);

    sendJson(res, 200, {
      meta: {
        from: from || null,
        to: to || null,
        entries: filteredRows.length,
        days: distinctDays,
        total,
        granularity,
      },
      series,
      daily,
      entries: filteredRows,
    });
    return;
  }

  // Static app serving
  let target = safeStaticPath(u.pathname === '/' ? '/index.html' : u.pathname);
  if (target && fs.existsSync(target) && fs.statSync(target).isFile()) {
    res.writeHead(200, { 'Content-Type': contentType(target) });
    fs.createReadStream(target).pipe(res);
    return;
  }

  // SPA fallback
  target = path.join(STATIC_DIR, 'index.html');
  if (fs.existsSync(target)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(target).pipe(res);
    return;
  }

  sendJson(res, 404, { error: 'Not found', detail: 'Web build fehlt. Bitte `npx nx build web --configuration=production` ausführen.' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`pushup service listening on http://127.0.0.1:${PORT}`);
  console.log(`CSV path: ${CSV_PATH}`);
  console.log(`Static path: ${STATIC_DIR}`);
});
