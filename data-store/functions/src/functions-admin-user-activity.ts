import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';

import { batchArray } from './admin';
import {
  aggregateEntryActivity,
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

    const userId = (afterData?.userId ?? beforeData?.userId) as
      | string
      | undefined;
    if (!userId) {
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

      let lastEntry = aggregate.lastEntry;
      if (needsRecompute) {
        // The deleted/moved entry was the running max — re-derive the true
        // latest timestamp from source. The (userId, timestamp) composite
        // index serves this reversed.
        const maxSnap = await tx.get(
          db
            .collection('exerciseEntries')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(1)
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

    const dryRun = Boolean(request.data?.dryRun ?? true);

    const snap = await db
      .collection('exerciseEntries')
      .select('userId', 'timestamp')
      .get();
    const activity = aggregateEntryActivity(snap.docs.map((doc) => doc.data()));

    if (dryRun) {
      return {
        dryRun: true,
        wouldWriteUsers: activity.size,
        entries: snap.size,
      };
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
      entries: snap.size,
      by: request.auth?.uid,
    });

    return { writtenUsers, entries: snap.size };
  }
);
