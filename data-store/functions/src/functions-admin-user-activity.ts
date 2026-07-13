import {
  FieldPath,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';

import { batchArray } from './admin';
import {
  aggregateEntryActivity,
  type EntryActivity,
  nextActivityAggregate,
  type UserActivityAggregate,
} from './admin/user-entry-activity';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';

// Per-user activity aggregate that keeps `adminListUsers` and the
// inactive-anonymous cleanup O(#users) instead of scanning the whole
// `exerciseEntries` collection. Written only by the Admin SDK (this trigger
// + the backfill callable); clients are denied at the Firestore-rule layer.
const ADMIN_USER_ACTIVITY_COLLECTION = 'adminUserActivity';
const BACKFILL_BATCH_SIZE = 500;
const BACKFILL_PAGE_SIZE = 5000;

function timestampField(
  data: Record<string, unknown> | undefined
): { timestamp: string | null } | null {
  if (!data) return null;
  return {
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : null,
  };
}

export const updateAdminUserActivityOnEntryWrite = onDocumentWritten(
  { document: 'exerciseEntries/{entryId}', region: 'europe-west3' },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    const userId = afterData?.userId ?? beforeData?.userId;
    if (typeof userId !== 'string' || !userId) {
      logger.warn('updateAdminUserActivityOnEntryWrite: no userId, skipping');
      return;
    }

    const before = timestampField(beforeData);
    const after = timestampField(afterData);
    const nowIso = new Date().toISOString();
    const ref = db.collection(ADMIN_USER_ACTIVITY_COLLECTION).doc(userId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = snap.exists
        ? (snap.data() as UserActivityAggregate)
        : null;

      const { aggregate, needsRecompute } = nextActivityAggregate(
        current,
        before,
        after
      );

      if (aggregate.entryCount <= 0) {
        // No entries remain — e.g. the user deleted their last entry, or a
        // hard-delete/bulk-cleanup purged them all. Drop the aggregate rather
        // than leave an orphaned zero doc. Converges to "deleted" even under
        // out-of-order batch-delete triggers, since the final entryCount is 0.
        tx.delete(ref);
        return;
      }

      let lastEntry = aggregate.lastEntry;
      if (needsRecompute) {
        // The deleted/moved entry was the running max — re-derive the true
        // latest timestamp from source. `orderBy(asc).limitToLast(1)` returns
        // the highest timestamp using the declared (userId, timestamp) ASC
        // composite index in its native direction.
        const maxSnap = await tx.get(
          db
            .collection('exerciseEntries')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'asc')
            .limitToLast(1)
        );
        const maxTs = maxSnap.empty
          ? null
          : (maxSnap.docs[0].data().timestamp as string | undefined);
        lastEntry = typeof maxTs === 'string' ? maxTs : null;
      }

      tx.set(ref, {
        entryCount: aggregate.entryCount,
        lastEntry,
        updatedAt: nowIso,
      });
    });

    logger.info('updateAdminUserActivityOnEntryWrite', {
      userId,
      entryId: event.params?.entryId,
    });
  }
);

// Admin-callable one-shot rebuild of `adminUserActivity/{userId}` from all
// `exerciseEntries`. Idempotent: recomputes the same docs. Fail-safe: defaults
// to a dry-run so an accidental call never writes.
export const backfillAdminUserActivity = onCall(
  { region: 'europe-west3', timeoutSeconds: 540 },
  async (request) => {
    assertAdmin(request);

    // Fail-safe: only an explicit `dryRun: false` writes; any other value
    // (including a missing/falsy-but-not-false one) stays a dry-run.
    const dryRun = request.data?.dryRun !== false;

    // Page through `exerciseEntries` by document id, folding each bounded
    // page into a single per-user map, so peak memory stays O(#users)
    // rather than materialising the whole collection at once. This backfill
    // is load-bearing (the admin dashboard reads the aggregate post-deploy),
    // so it must stay reliable as the collection grows.
    const activity = new Map<string, EntryActivity>();
    let entries = 0;
    let cursor: QueryDocumentSnapshot | undefined;
    for (;;) {
      let query = db
        .collection('exerciseEntries')
        .select('userId', 'timestamp')
        .orderBy(FieldPath.documentId())
        .limit(BACKFILL_PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      if (page.empty) break;
      aggregateEntryActivity(
        page.docs.map((doc) => doc.data()),
        undefined,
        activity
      );
      entries += page.size;
      cursor = page.docs[page.docs.length - 1];
      if (page.size < BACKFILL_PAGE_SIZE) break;
    }

    if (dryRun) {
      return { dryRun: true, wouldWriteUsers: activity.size, entries };
    }

    const nowIso = new Date().toISOString();
    let writtenUsers = 0;
    for (const chunk of batchArray(
      [...activity.entries()],
      BACKFILL_BATCH_SIZE
    )) {
      const batch = db.batch();
      for (const [userId, { count, lastTimestamp }] of chunk) {
        batch.set(db.collection(ADMIN_USER_ACTIVITY_COLLECTION).doc(userId), {
          entryCount: count,
          lastEntry: lastTimestamp,
          updatedAt: nowIso,
        });
        writtenUsers += 1;
      }
      await batch.commit();
    }

    logger.info('backfillAdminUserActivity', {
      writtenUsers,
      entries,
      by: request.auth?.uid,
    });

    return { writtenUsers, entries };
  }
);
