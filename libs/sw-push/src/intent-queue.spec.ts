import { IDBFactory } from 'fake-indexeddb';

import {
  newIntentId,
  openIntentDb,
  PUSH_INTENT_STORE,
  savePushIntent,
  type PushIntent,
} from './intent-queue';

function intent(overrides: Partial<PushIntent> = {}): PushIntent {
  return {
    id: newIntentId(),
    type: 'snooze',
    createdAt: Date.now(),
    snoozeMinutes: 30,
    ...overrides,
  };
}

async function readAll(factory: IDBFactory): Promise<PushIntent[]> {
  const db = await openIntentDb(factory as unknown as globalThis.IDBFactory);
  try {
    return await new Promise<PushIntent[]>((resolve, reject) => {
      const tx = db.transaction(PUSH_INTENT_STORE, 'readonly');
      const request = tx.objectStore(PUSH_INTENT_STORE).getAll();
      tx.oncomplete = () => resolve(request.result as PushIntent[]);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

describe('savePushIntent', () => {
  let factory: IDBFactory;

  beforeEach(() => {
    factory = new IDBFactory();
  });

  it('should persist an intent so a later app start can find it', async () => {
    // given a snooze the user tapped while the app was closed
    const snooze = intent();

    // when
    await savePushIntent(snooze, factory as unknown as globalThis.IDBFactory);

    // then it outlives the service worker that wrote it
    expect(await readAll(factory)).toEqual([snooze]);
  });

  it('should keep intents of both kinds side by side', async () => {
    // given a quick-log and a snooze from two notifications
    const quickLog = intent({ type: 'quick-log', reps: 20 });
    const snooze = intent();

    // when
    await savePushIntent(quickLog, factory as unknown as globalThis.IDBFactory);
    await savePushIntent(snooze, factory as unknown as globalThis.IDBFactory);

    // then neither overwrites the other — the id is the key
    expect(await readAll(factory)).toHaveLength(2);
  });

  it('should overwrite an intent replayed under the same id', async () => {
    // given the same intent written twice (retried notificationclick)
    const snooze = intent();

    // when
    await savePushIntent(snooze, factory as unknown as globalThis.IDBFactory);
    await savePushIntent(snooze, factory as unknown as globalThis.IDBFactory);

    // then the store holds one record, so the drain acts once
    expect(await readAll(factory)).toHaveLength(1);
  });
});

describe('newIntentId', () => {
  it('should produce a distinct id per call', () => {
    // given / when
    const ids = new Set([newIntentId(), newIntentId(), newIntentId()]);

    // then
    expect(ids.size).toBe(3);
  });
});
