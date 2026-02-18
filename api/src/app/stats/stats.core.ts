import fs from 'node:fs';
import path from 'node:path';

export type PushupEntry = {
  timestamp: string;
  reps: number;
  source: string;
};

export type SeriesEntry = {
  bucket: string;
  total: number;
  dayIntegral: number;
};

export const WORKSPACE = process.env.WORKSPACE_DIR || '/home/wolf/.openclaw/workspace';
export const CSV_PATH = process.env.PUSHUPS_CSV_PATH || path.join(WORKSPACE, 'pushups.csv');

export function parseCsv(csvPath = CSV_PATH): PushupEntry[] {
  if (!fs.existsSync(csvPath)) return [];
  const raw = fs.readFileSync(csvPath, 'utf8').trim();
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

export function aggregateDaily(rows: PushupEntry[]): SeriesEntry[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const d = r.timestamp.slice(0, 10);
    map.set(d, (map.get(d) || 0) + r.reps);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, total]) => ({ bucket, total, dayIntegral: total }));
}

export function aggregateHourly(rows: PushupEntry[]): SeriesEntry[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const minuteBucket = r.timestamp.slice(0, 16);
    map.set(minuteBucket, (map.get(minuteBucket) || 0) + r.reps);
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

export function buildStats(rows: PushupEntry[], from: string | null, to: string | null) {
  const inRange = (d: string): boolean => (!from || d >= from) && (!to || d <= to);
  const filteredRows = rows.filter((x) => inRange(x.timestamp.slice(0, 10)));
  const daily = aggregateDaily(filteredRows);
  const distinctDays = new Set(filteredRows.map((x) => x.timestamp.slice(0, 10))).size;
  const granularity = distinctDays > 0 && distinctDays < 7 ? 'hourly' : 'daily';
  const series = granularity === 'hourly' ? aggregateHourly(filteredRows) : daily;
  const total = daily.reduce((s, x) => s + x.total, 0);

  return {
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
  };
}
