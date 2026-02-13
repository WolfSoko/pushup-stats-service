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
import { createServer } from 'node:http';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import Datastore from 'nedb-promises';
import { Server as SocketIOServer } from 'socket.io';

type PushupEntry = {
  _id?: string;
  timestamp: string;
  reps: number;
  source: string;
  type?: string;
};

type UserConfig = {
  userId: string;
  displayName?: string;
  dailyGoal?: number;
  ui?: {
    showSourceColumn?: boolean;
  };
};

type SeriesEntry = {
  bucket: string;
  total: number;
  dayIntegral: number;
};

const WORKSPACE =
  process.env['WORKSPACE_DIR'] || '/home/wolf/.openclaw/workspace';
const CSV_PATH =
  process.env['PUSHUPS_CSV_PATH'] || join(WORKSPACE, 'pushups.csv');
const DB_PATH =
  process.env['PUSHUPS_DB_PATH'] || join(process.cwd(), 'data', 'pushups.db');
const USER_CONFIG_DB_PATH =
  process.env['USER_CONFIG_DB_PATH'] ||
  join(process.cwd(), 'data', 'user-config.db');

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

const dbDir = dirname(DB_PATH);
fs.mkdirSync(dbDir, { recursive: true });
const db = Datastore.create({
  filename: DB_PATH,
  autoload: true,
  timestampData: true,
});

const userConfigDbDir = dirname(USER_CONFIG_DB_PATH);
fs.mkdirSync(userConfigDbDir, { recursive: true });
const userConfigDb = Datastore.create({
  filename: USER_CONFIG_DB_PATH,
  autoload: true,
  timestampData: true,
});
void userConfigDb.ensureIndex({ fieldName: 'userId', unique: true });

async function ensureSeededFromCsv() {
  const count = await db.count({});
  if (count > 0) return;

  const csvRows = parseCsv();
  if (!csvRows.length) return;

  await db.insert(
    csvRows.map((r) => ({
      timestamp: r.timestamp,
      reps: r.reps,
      source: r.source || 'csv',
    })),
  );
}

type DbDoc = {
  _id?: string;
  timestamp?: unknown;
  reps?: unknown;
  source?: unknown;
  type?: unknown;
};

async function allRows(): Promise<PushupEntry[]> {
  const docs = (await db.find({}).sort({ timestamp: 1 })) as DbDoc[];
  return docs
    .filter(
      (d) => typeof d.timestamp === 'string' && typeof d.reps === 'number',
    )
    .map((d) => ({
      _id: d._id,
      timestamp: d.timestamp as string,
      reps: d.reps as number,
      source: typeof d.source === 'string' ? d.source : 'api',
      type: typeof d.type === 'string' ? d.type : 'Standard',
    }));
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

const angularAppManifest = (
  await import(new URL('./angular-app-manifest.mjs', import.meta.url).href)
).default;
const angularAppEngineManifest = (
  await import(
    new URL('./angular-app-engine-manifest.mjs', import.meta.url).href
  )
).default;

ɵsetAngularAppManifest(angularAppManifest);
ɵsetAngularAppEngineManifest(angularAppEngineManifest);

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  path: '/socket.io',
  cors: { origin: true, credentials: true },
});

const angularApp = new AngularNodeAppEngine();

app.use(express.json());

// Minimal request logging to help diagnose memory spikes / traffic patterns.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const rssMb = Math.round(process.memoryUsage().rss / 1024 / 1024);

    const isApi = req.path.startsWith('/api/') || req.path === '/health';
    const isSsrPage =
      req.method === 'GET' &&
      !req.path.startsWith('/api/') &&
      !req.path.startsWith('/socket.io');

    if (isApi || isSsrPage) {
      console.log(
        `${new Date().toISOString()} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms, rss=${rssMb}MB)`,
      );
    }
  });

  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, storage: 'nedb' });
});

app.get('/api/stats', async (req, res) => {
  const rows = await allRows();
  const from = typeof req.query['from'] === 'string' ? req.query['from'] : null;
  const to = typeof req.query['to'] === 'string' ? req.query['to'] : null;
  const inRange = (d: string): boolean =>
    (!from || d >= from) && (!to || d <= to);

  const filteredRows = rows.filter((x) => inRange(x.timestamp.slice(0, 10)));
  const daily = aggregateDaily(filteredRows);
  const distinctDays = new Set(
    filteredRows.map((x) => x.timestamp.slice(0, 10)),
  ).size;
  const granularity = distinctDays > 0 && distinctDays < 7 ? 'hourly' : 'daily';
  const series =
    granularity === 'hourly' ? aggregateHourly(filteredRows) : daily;
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

app.get('/api/pushups', async (_req, res) => {
  res.json(await allRows());
});

app.get('/api/users/:userId/config', async (req, res) => {
  const userId = req.params['userId'];
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const doc = (await userConfigDb.findOne({ userId })) as UserConfig | null;
  res.setHeader('Cache-Control', 'no-store');
  res.json(
    doc || {
      userId,
      displayName: userId,
      dailyGoal: 100,
      ui: { showSourceColumn: false },
    },
  );
});

app.put('/api/users/:userId/config', async (req, res) => {
  const userId = req.params['userId'];
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }

  const body = (req.body || {}) as Partial<UserConfig>;
  const displayName =
    typeof body.displayName === 'string' ? body.displayName : undefined;
  const dailyGoal =
    typeof body.dailyGoal === 'number' ? body.dailyGoal : undefined;
  const showSourceColumn =
    typeof body.ui?.showSourceColumn === 'boolean'
      ? body.ui.showSourceColumn
      : undefined;

  const patch: UserConfig = {
    userId,
    ...(typeof displayName !== 'undefined' ? { displayName } : {}),
    ...(typeof dailyGoal !== 'undefined' ? { dailyGoal } : {}),
    ui:
      typeof showSourceColumn !== 'undefined'
        ? { showSourceColumn }
        : undefined,
  };

  try {
    await userConfigDb.update(
      { userId },
      {
        $set: {
          userId,
          ...(typeof displayName !== 'undefined' ? { displayName } : {}),
          ...(typeof dailyGoal !== 'undefined' ? { dailyGoal } : {}),
          ...(typeof showSourceColumn !== 'undefined'
            ? { ui: { showSourceColumn } }
            : {}),
        },
      },
      { upsert: true },
    );
  } catch (_e) {
    res.status(500).json({ error: 'failed to update user config' });
    return;
  }

  const updated = (await userConfigDb.findOne({ userId })) as UserConfig | null;
  res.json(updated || patch);
});

app.post('/api/pushups', async (req, res) => {
  const payload = req.body as {
    timestamp?: string;
    reps?: number;
    source?: string;
    type?: string;
  };
  if (!payload?.timestamp || Number(payload?.reps) <= 0) {
    res.status(400).json({ error: 'timestamp and positive reps are required' });
    return;
  }

  const created = await db.insert({
    timestamp: payload.timestamp,
    reps: Number(payload.reps),
    source: payload.source || 'api',
    type: payload.type || 'Standard',
  });

  io.emit('pushups:changed');
  res.status(201).json(created);
});

app.put('/api/pushups/:id', async (req, res) => {
  const id = req.params['id'];
  const payload = req.body as {
    timestamp?: string;
    reps?: number;
    source?: string;
    type?: string;
  };

  await db.update(
    { _id: id },
    {
      $set: {
        ...(payload.timestamp ? { timestamp: payload.timestamp } : {}),
        ...(typeof payload.reps !== 'undefined'
          ? { reps: Number(payload.reps) }
          : {}),
        ...(typeof payload.source !== 'undefined'
          ? { source: payload.source }
          : {}),
        ...(typeof payload.type !== 'undefined'
          ? { type: payload.type || 'Standard' }
          : {}),
      },
    },
  );

  const updated = await db.findOne({ _id: id });
  if (!updated) {
    res.status(404).json({ error: 'Pushup entry not found' });
    return;
  }

  io.emit('pushups:changed');
  res.json(updated);
});

app.delete('/api/pushups/:id', async (req, res) => {
  const id = req.params['id'];
  const removed = await db.remove({ _id: id }, {});
  if (!removed) {
    res.status(404).json({ error: 'Pushup entry not found' });
    return;
  }
  io.emit('pushups:changed');
  res.json({ ok: true });
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

// NOTE: Express does not treat '/**' as a catch-all route. Use '*' so deep links
// like '/analyse' and '/entries' are SSR-rendered.
app.get('*', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  void ensureSeededFromCsv();
  httpServer.listen(port, () => {
    console.log(`Node SSR server listening on http://localhost:${port}`);
    console.log(`CSV path: ${CSV_PATH}`);
    console.log(`DB path: ${DB_PATH}`);
  });
}

export const reqHandler = createNodeRequestHandler(app);
