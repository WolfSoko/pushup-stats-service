/**
 * App-side reader for the intent store the push service worker writes
 * (`libs/sw-push/src/intent-queue.ts` — see there for why the hand-off has to
 * be durable instead of a `postMessage` or a `?quickLog=` query param).
 *
 * The constants are duplicated rather than imported: `sw-push` is an isolated
 * bundle (eslint `scope:sw-push` → `onlyDependOnLibsWithTags: []`) and must
 * not become a dependency of the Angular app. `push-intent-queue.drift.spec`
 * fails CI if the two copies diverge, the same way the SW's inlined
 * quick-log cap is pinned to the model.
 */

export const PUSH_INTENT_DB = 'pu-push-intents';
export const PUSH_INTENT_DB_VERSION = 1;
export const PUSH_INTENT_STORE = 'intents';
export const PUSH_INTENT_MAX_AGE_MS = 30 * 60 * 1000;

export type PushIntentType = 'snooze' | 'quick-log';

export interface PushIntent {
  id: string;
  type: PushIntentType;
  createdAt: number;
  snoozeMinutes?: number;
  reps?: number;
}

function openIntentDb(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(PUSH_INTENT_DB, PUSH_INTENT_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PUSH_INTENT_STORE)) {
        db.createObjectStore(PUSH_INTENT_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Removes every stored intent and returns the ones still worth acting on,
 * oldest first.
 *
 * Read and clear share one transaction, so an intent can be handed out at
 * most once even if two drains race (app start and `visibilitychange` fire
 * close together). At-most-once is deliberate: a dropped snooze costs one
 * reminder, while a replayed quick-log writes a push-up entry the user never
 * asked for — which is the bug this store exists to kill.
 *
 * Intents older than `PUSH_INTENT_MAX_AGE_MS` are dropped: they outlived the
 * dispatcher's push TTL, so the notification behind them is gone too.
 */
export async function drainPushIntents(
  factory: IDBFactory,
  now: number = Date.now()
): Promise<PushIntent[]> {
  const db = await openIntentDb(factory);
  try {
    const stored = await new Promise<PushIntent[]>((resolve, reject) => {
      const tx = db.transaction(PUSH_INTENT_STORE, 'readwrite');
      const store = tx.objectStore(PUSH_INTENT_STORE);
      const request = store.getAll();
      request.onsuccess = () => {
        store.clear();
      };
      tx.oncomplete = () =>
        resolve((request.result ?? []) as unknown as PushIntent[]);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return stored
      .filter((intent) => now - intent.createdAt <= PUSH_INTENT_MAX_AGE_MS)
      .sort((a, b) => a.createdAt - b.createdAt);
  } finally {
    db.close();
  }
}
