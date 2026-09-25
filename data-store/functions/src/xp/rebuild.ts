import type { UserXp, XpLedgerEntry } from '@pu-stats/models';
import type { Firestore } from 'firebase-admin/firestore';

import { rebuildUserXp } from './aggregate';

/**
 * Rebuilds `userXp/{uid}` from the ledger as it is inside the
 * transaction — never from a snapshot read earlier, which would drop XP
 * the live triggers booked in the meantime. The dedupe ids survive, so
 * a late-delivered event is still recognised afterwards.
 */
export async function rebuildUserAggregate(
  db: Firestore,
  userId: string,
  nowIso: string
): Promise<UserXp> {
  const ref = db.collection('userXp').doc(userId);
  return db.runTransaction(async (tx) => {
    const [snap, ledger] = await Promise.all([
      tx.get(ref),
      tx.get(
        ref.collection('xpLedger').select('exerciseId', 'timestamp', 'xp')
      ),
    ]);
    const next = rebuildUserXp(
      userId,
      ledger.docs.map((d) => d.data() as XpLedgerEntry),
      nowIso
    );
    const recentEventIds =
      (snap.data() as UserXp | undefined)?.recentEventIds ?? [];
    tx.set(ref, { ...next, recentEventIds, updatedAt: nowIso });
    return next;
  });
}

/** Runs `task` over `items` with at most `size` in flight. */
export async function inChunks<T, R>(
  items: ReadonlyArray<T>,
  size: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(task))));
  }
  return results;
}
