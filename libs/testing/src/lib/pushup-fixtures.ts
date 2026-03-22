/**
 * Pushup domain fixture factories for tests across the monorepo.
 *
 * Usage:
 *   import { makePushupRecord, makePushupList } from '@pu-stats/testing';
 *
 * @example
 * const record = makePushupRecord({ reps: 20 });
 * const records = makePushupList(5);
 * const records = makePushupList(3, { source: 'mobile' });
 */

import { PushupRecord } from '@pu-stats/models';

let _counter = 0;

function nextId(): string {
  return `pushup-${++_counter}`;
}

/**
 * Creates a single PushupRecord with sensible defaults.
 * Each call generates a unique `_id`.
 */
export function makePushupRecord(overrides: Partial<PushupRecord> = {}): PushupRecord {
  return {
    _id: nextId(),
    timestamp: '2024-01-15T10:00:00.000Z',
    reps: 10,
    source: 'web',
    ...overrides,
  };
}

/**
 * Creates a list of PushupRecords with unique IDs and incrementing timestamps.
 *
 * @param count   - number of records to generate (default: 3)
 * @param overrides - shared overrides applied to every record
 */
export function makePushupList(
  count = 3,
  overrides: Partial<PushupRecord> = {}
): PushupRecord[] {
  return Array.from({ length: count }, (_, i) =>
    makePushupRecord({
      timestamp: new Date(2024, 0, 15, 10 + i).toISOString(),
      reps: 10 + i,
      ...overrides,
    })
  );
}
