import type { TrainingStats } from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';

import { db, DEMO_USER_ID } from './firebase-app';
import { assertAdmin } from './functions-admin';
import { pendingTrainingUsers } from './training/backfill-plan';
import {
  buildTrainingStats,
  isCurrentTrainingStats,
  trainingStatsRef,
} from './training/stats-read';
import { readXpConfig } from './xp/config-read';
import { inChunks } from './xp/rebuild';

/** Users rebuilt per live run; the rest waits for the next run. */
export const TRAINING_BACKFILL_USER_LIMIT = 200;

const BACKFILL_CONCURRENCY = 20;

// Builds the cross-exercise training aggregate for every user who has not
// trained since it shipped, so read paths stop computing it from all
// entries on each request. Uniform `{ dryRun }` migration contract;
// idempotent, so the admin repeats it until `remaining` is 0.
export const backfillTrainingStats = onCall(
  { region: 'europe-west3', timeoutSeconds: 540, memory: '1GiB' },
  async (request) => {
    assertAdmin(request);
    const dryRun = request.data?.dryRun !== false;

    const [entriesSnap, aggregatesSnap, config] = await Promise.all([
      db.collection('exerciseEntries').select('userId').get(),
      db.collectionGroup('aggregates').select('version').get(),
      readXpConfig(db),
    ]);
    const current = new Set(
      aggregatesSnap.docs
        .filter((d) => d.id === 'training' && isCurrentTrainingStats(d.data()))
        .map((d) => d.ref.parent.parent?.id ?? '')
    );
    const pending = pendingTrainingUsers(
      entriesSnap.docs.map((d) => d.get('userId')),
      current,
      new Set([DEMO_USER_ID])
    );

    if (dryRun) {
      return { dryRun: true, pendingUsers: pending.length };
    }

    const batch = pending.slice(0, TRAINING_BACKFILL_USER_LIMIT);
    const nowIso = new Date().toISOString();
    await inChunks(batch, BACKFILL_CONCURRENCY, (uid) =>
      db.runTransaction(async (tx) => {
        const ref = trainingStatsRef(db, uid);
        const snap = await tx.get(ref);
        // A live trigger may have built it since the scan; keep that one.
        if (isCurrentTrainingStats(snap.data())) return;
        const stats = await buildTrainingStats(db, uid, config, tx);
        tx.set(ref, {
          ...stats,
          recentEventIds:
            (snap.data() as TrainingStats | undefined)?.recentEventIds ?? [],
          updatedAt: nowIso,
        });
      })
    );

    logger.info('backfillTrainingStats', {
      users: batch.length,
      by: request.auth?.uid,
    });
    return {
      dryRun: false,
      rebuiltUsers: batch.length,
      remaining: pending.length - batch.length,
    };
  }
);
