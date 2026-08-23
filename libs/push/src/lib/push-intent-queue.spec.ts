import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IDBFactory } from 'fake-indexeddb';

import {
  drainPushIntents,
  PUSH_INTENT_DB,
  PUSH_INTENT_DB_VERSION,
  PUSH_INTENT_MAX_AGE_MS,
  PUSH_INTENT_STORE,
  type PushIntent,
} from './push-intent-queue';

const NOW = 1_760_000_000_000;

function intent(overrides: Partial<PushIntent> = {}): PushIntent {
  return {
    id: `id-${Math.random()}`,
    type: 'snooze',
    createdAt: NOW,
    snoozeMinutes: 30,
    ...overrides,
  };
}

/** Writes intents the way the service worker does, bypassing the app API. */
async function seed(factory: IDBFactory, intents: PushIntent[]): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open(PUSH_INTENT_DB, PUSH_INTENT_DB_VERSION);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(PUSH_INTENT_STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PUSH_INTENT_STORE, 'readwrite');
    for (const item of intents) tx.objectStore(PUSH_INTENT_STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

describe('drainPushIntents', () => {
  let factory: IDBFactory;
  const asGlobal = () => factory as unknown as globalThis.IDBFactory;

  beforeEach(() => {
    factory = new IDBFactory();
  });

  it('should return a fresh intent', async () => {
    // given a snooze tapped a minute ago
    const snooze = intent({ createdAt: NOW - 60_000 });
    await seed(factory, [snooze]);

    // when
    const drained = await drainPushIntents(asGlobal(), NOW);

    // then
    expect(drained).toEqual([snooze]);
  });

  // Regression: the reported bug. A quick-log tap that was never processed
  // must not surface hours later — production wrote a 20-rep entry at 02:05,
  // inside the user's quiet hours, on the back of an unrelated snooze tap.
  it('should discard an intent older than the push TTL', async () => {
    // given a quick-log from well beyond the dispatcher's TTL
    await seed(factory, [
      intent({
        type: 'quick-log',
        reps: 20,
        createdAt: NOW - PUSH_INTENT_MAX_AGE_MS - 1,
      }),
    ]);

    // when
    const drained = await drainPushIntents(asGlobal(), NOW);

    // then nothing is handed out
    expect(drained).toEqual([]);
  });

  it('should keep an intent exactly at the age limit', async () => {
    // given an intent on the boundary
    await seed(factory, [intent({ createdAt: NOW - PUSH_INTENT_MAX_AGE_MS })]);

    // when
    const drained = await drainPushIntents(asGlobal(), NOW);

    // then it still counts as actionable
    expect(drained).toHaveLength(1);
  });

  // Two triggers routinely overlap (SW nudge + visibilitychange), and an
  // intent handed out twice means a duplicate entry.
  it('should hand out each intent at most once', async () => {
    // given one stored intent
    await seed(factory, [intent({ type: 'quick-log', reps: 20 })]);

    // when it is drained twice
    const first = await drainPushIntents(asGlobal(), NOW);
    const second = await drainPushIntents(asGlobal(), NOW);

    // then the second drain finds nothing
    expect(first).toHaveLength(1);
    expect(second).toEqual([]);
  });

  it('should clear stale intents too, so they cannot pile up', async () => {
    // given only an expired intent
    await seed(factory, [
      intent({ createdAt: NOW - PUSH_INTENT_MAX_AGE_MS - 1 }),
    ]);

    // when drained, then re-checked with a clock where it would be fresh
    await drainPushIntents(asGlobal(), NOW);
    const later = await drainPushIntents(asGlobal(), NOW - 120_000);

    // then it is gone for good rather than lingering in the store
    expect(later).toEqual([]);
  });

  it('should return intents oldest first', async () => {
    // given intents recorded out of order
    await seed(factory, [
      intent({ id: 'b', createdAt: NOW - 1000 }),
      intent({ id: 'a', createdAt: NOW - 5000 }),
    ]);

    // when
    const drained = await drainPushIntents(asGlobal(), NOW);

    // then
    expect(drained.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('should resolve empty when the store was never written to', async () => {
    // given a browser that has never received a notification tap
    // when
    const drained = await drainPushIntents(asGlobal(), NOW);

    // then
    expect(drained).toEqual([]);
  });
});

/**
 * `sw-push` is an isolated service-worker bundle (eslint `scope:sw-push` →
 * `onlyDependOnLibsWithTags: []`), so the two sides of this store cannot
 * share a module. Read the SW source as text — no import edge for Nx to
 * infer — and fail CI if the copies drift apart, which would silently strand
 * every snooze and quick-log in a database nobody reads.
 */
describe('intent store drift guard', () => {
  const swSource = readFileSync(
    join(__dirname, '..', '..', '..', 'sw-push', 'src', 'intent-queue.ts'),
    'utf8'
  );

  function swConstant(name: string): string {
    const match = swSource.match(new RegExp(`${name}\\s*=\\s*([^;]+);`));
    expect(match).not.toBeNull();
    return (match?.[1] ?? '').trim();
  }

  it('should keep the database name, store and version in sync', () => {
    // given / when / then
    expect(swConstant('PUSH_INTENT_DB')).toBe(`'${PUSH_INTENT_DB}'`);
    expect(swConstant('PUSH_INTENT_STORE')).toBe(`'${PUSH_INTENT_STORE}'`);
    expect(swConstant('PUSH_INTENT_DB_VERSION')).toBe(
      String(PUSH_INTENT_DB_VERSION)
    );
  });

  it('should keep the max age in sync', () => {
    // given the SW writes the same expression the app filters on
    const raw = swConstant('PUSH_INTENT_MAX_AGE_MS');

    // when
    const value = Number(new Function(`return ${raw}`)());

    // then
    expect(value).toBe(PUSH_INTENT_MAX_AGE_MS);
  });
});
