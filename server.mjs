import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKSPACE = '/home/wolf/.openclaw/workspace';
const CSV_PATH = path.join(WORKSPACE, 'pushups.csv');
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = Number(process.env.PORT || 8787);

function parseCsv() {
  if (!fs.existsSync(CSV_PATH)) return [];
  const raw = fs.readFileSync(CSV_PATH, 'utf8').trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).slice(1);
  const rows = [];
  for (const line of lines) {
    const [timestamp, reps, source] = line.split(',');
    const n = Number(reps);
    if (!timestamp || Number.isNaN(n)) continue;
    rows.push({ timestamp, reps: n, source: source || '' });
  }
  rows.sort((a,b)=> new Date(a.timestamp) - new Date(b.timestamp));
  return rows;
}

function aggregateDaily(rows) {
  const map = new Map();
  for (const r of rows) {
    const d = r.timestamp.slice(0,10);
    map.set(d, (map.get(d) || 0) + r.reps);
  }
  return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,total])=>({date,total}));
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function serveFile(res, p) {
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end('Not found'); }
  const ext = path.extname(p).toLowerCase();
  const type = ext === '.html' ? 'text/html; charset=utf-8'
    : ext === '.css' ? 'text/css; charset=utf-8'
    : ext === '.js' ? 'application/javascript; charset=utf-8'
    : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(p).pipe(res);
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, `http://${req.headers.host}`);

  if (u.pathname === '/api/stats') {
    const rows = parseCsv();
    const daily = aggregateDaily(rows);
    const from = u.searchParams.get('from');
    const to = u.searchParams.get('to');
    const inRange = (d) => (!from || d >= from) && (!to || d <= to);
    const filteredDaily = daily.filter(x => inRange(x.date));
    const filteredRows = rows.filter(x => inRange(x.timestamp.slice(0,10)));
    const total = filteredDaily.reduce((s,x)=>s+x.total,0);
    return sendJson(res, 200, {
      meta: { from: from || null, to: to || null, entries: filteredRows.length, days: filteredDaily.length, total },
      daily: filteredDaily,
      entries: filteredRows
    });
  }

  if (u.pathname === '/' || u.pathname === '/index.html') {
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`pushup-service listening on http://127.0.0.1:${PORT}`);
});
