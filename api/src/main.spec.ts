import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aggregateDaily, aggregateHourly, buildStats, parseCsv, type PushupEntry } from './main';

describe('api stats core', () => {
  it('parses csv and skips invalid rows', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pushup-api-test-'));
    const csvPath = path.join(tmpDir, 'pushups.csv');
    fs.writeFileSync(
      csvPath,
      [
        'timestamp,reps,source',
        '2026-02-10T10:00:00.000Z,10,wa',
        '2026-02-10T11:00:00.000Z,abc,wa',
        '2026-02-10T12:00:00.000Z,5,wa',
      ].join('\n'),
      'utf8',
    );

    const rows = parseCsv(csvPath);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ timestamp: '2026-02-10T10:00:00.000Z', reps: 10, source: 'wa' });
    expect(rows[1]).toEqual({ timestamp: '2026-02-10T12:00:00.000Z', reps: 5, source: 'wa' });
  });

  it('aggregates daily totals', () => {
    const rows: PushupEntry[] = [
      { timestamp: '2026-02-10T10:00:00.000Z', reps: 10, source: 'wa' },
      { timestamp: '2026-02-10T12:00:00.000Z', reps: 5, source: 'wa' },
      { timestamp: '2026-02-11T08:00:00.000Z', reps: 12, source: 'wa' },
    ];

    expect(aggregateDaily(rows)).toEqual([
      { bucket: '2026-02-10', total: 15, dayIntegral: 15 },
      { bucket: '2026-02-11', total: 12, dayIntegral: 12 },
    ]);
  });

  it('aggregates hourly totals with running day integral', () => {
    const rows: PushupEntry[] = [
      { timestamp: '2026-02-10T10:05:00.000Z', reps: 10, source: 'wa' },
      { timestamp: '2026-02-10T10:45:00.000Z', reps: 5, source: 'wa' },
      { timestamp: '2026-02-10T11:05:00.000Z', reps: 7, source: 'wa' },
      { timestamp: '2026-02-11T09:10:00.000Z', reps: 3, source: 'wa' },
    ];

    expect(aggregateHourly(rows)).toEqual([
      { bucket: '2026-02-10T10:05', total: 10, dayIntegral: 10 },
      { bucket: '2026-02-10T10:45', total: 5, dayIntegral: 15 },
      { bucket: '2026-02-10T11:05', total: 7, dayIntegral: 22 },
      { bucket: '2026-02-11T09:10', total: 3, dayIntegral: 3 },
    ]);
  });

  it('uses hourly granularity for ranges below 7 distinct days', () => {
    const rows: PushupEntry[] = [
      { timestamp: '2026-02-10T10:00:00.000Z', reps: 10, source: 'wa' },
      { timestamp: '2026-02-10T11:00:00.000Z', reps: 5, source: 'wa' },
      { timestamp: '2026-02-11T09:00:00.000Z', reps: 12, source: 'wa' },
    ];

    const result = buildStats(rows, '2026-02-10', '2026-02-11');
    expect(result.meta.granularity).toBe('hourly');
    expect(result.meta.total).toBe(27);
    expect(result.meta.days).toBe(2);
    expect(result.meta.entries).toBe(3);
  });

  it('uses daily granularity for 7 or more distinct days', () => {
    const rows: PushupEntry[] = Array.from({ length: 7 }, (_, i) => ({
      timestamp: `2026-02-0${i + 1}T10:00:00.000Z`,
      reps: 10,
      source: 'wa',
    }));

    const result = buildStats(rows, null, null);
    expect(result.meta.granularity).toBe('daily');
    expect(result.series).toHaveLength(7);
    expect(result.meta.total).toBe(70);
  });
});
