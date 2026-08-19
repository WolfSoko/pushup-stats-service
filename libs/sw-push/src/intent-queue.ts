/**
 * Durable hand-off from the push service worker to the app.
 *
 * Neither of the two channels the SW has to an app window is delivery:
 *
 *   - `client.postMessage()` — a backgrounded PWA on Android is frozen. The
 *     message stays queued and is processed whenever the tab thaws, which can
 *     be hours later on an unrelated notification tap. Production showed four
 *     `source: 'reminder'` entries created this way, one at 02:05 inside the
 *     user's own quiet hours, when no reminder had been sent at all.
 *   - `openWindow('/app?quickLog=N')` — Android resumes an existing PWA task
 *     instead of navigating, so the param never arrives; and when it does, it
 *     stays in the task's committed URL and replays on every later resume.
 *
 * So the SW records what the user asked for here, and the app drains it
 * exactly once (`@pu-push/push` clears the store in the same transaction it
 * reads it). Waking a window stays a best-effort nudge — losing the nudge now
 * only delays the action to the next app resume instead of dropping it.
 */

/** Shared with `@pu-push/push`; pinned by a drift guard on both sides. */
export const PUSH_INTENT_DB = 'pu-push-intents';
export const PUSH_INTENT_DB_VERSION = 1;
export const PUSH_INTENT_STORE = 'intents';

/**
 * Mirrors the dispatcher's `TTL: 1800` — a reminder the push service would no
 * longer deliver must not be actionable either. This is what makes a late
 * drain safe: a stale intent is discarded instead of writing a phantom entry.
 */
export const PUSH_INTENT_MAX_AGE_MS = 30 * 60 * 1000;

export type PushIntentType = 'snooze' | 'quick-log';

export interface PushIntent {
  id: string;
  type: PushIntentType;
  /** Epoch ms at notification-tap time — the drain's freshness check. */
  createdAt: number;
  snoozeMinutes?: number;
  reps?: number;
}

export function newIntentId(): string {
  const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
  if (typeof cryptoApi?.randomUUID === 'function')
    return cryptoApi.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function openIntentDb(factory: IDBFactory): Promise<IDBDatabase> {
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

export async function savePushIntent(
  intent: PushIntent,
  factory: IDBFactory
): Promise<void> {
  const db = await openIntentDb(factory);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PUSH_INTENT_STORE, 'readwrite');
      tx.objectStore(PUSH_INTENT_STORE).put(intent);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
