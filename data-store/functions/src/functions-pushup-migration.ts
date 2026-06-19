import { logger } from 'firebase-functions';
import { onCall } from 'firebase-functions/v2/https';

import { batchArray } from './admin';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';
import {
  type MigratedEntryDoc,
  planMigration,
  type PushupSourceDoc,
  rollbackTargets,
} from './pushup-unification';
import { rebuildFromEntries } from './user-stats-delta';

// Admin-only one-shot copy of `pushups/*` → `exerciseEntries/*` with
// `exerciseId:'pushup'`. STAGED: no write-path flip, no legacy deletion —
// the dashboard keeps reading `pushups`. The trigger guards above keep the
// copies out of per-exercise stats + leaderboards.
// All classification lives in the pure `pushup-unification` planners; these
// wrappers only do auth, Firestore IO and batched writes. Runbook:
// `docs/migrations/pushup-unification.md`.

const MIGRATION_BATCH_SIZE = 500;

export const migratePushupsToExerciseEntries = onCall(
  { region: 'europe-west3', timeoutSeconds: 540 },
  async (request) => {
    assertAdmin(request);

    // Fail-safe: default to a dry-run so an accidental call never writes.
    const dryRun = Boolean(request.data?.dryRun ?? true);

    const [pushupSnap, existingSnap] = await Promise.all([
      db.collection('pushups').get(),
      db
        .collection('exerciseEntries')
        .where('migratedFrom', '==', 'pushups')
        .get(),
    ]);

    const sources: PushupSourceDoc[] = pushupSnap.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<PushupSourceDoc, 'id'>),
    }));
    const existingDestIds = new Set(existingSnap.docs.map((doc) => doc.id));

    const { toWrite, skippedExisting, skippedInvalid } = planMigration(
      sources,
      existingDestIds,
      new Date().toISOString()
    );

    if (dryRun) {
      return {
        dryRun: true,
        wouldCopy: toWrite.length,
        wouldSkipExisting: skippedExisting.length,
        wouldSkipInvalid: skippedInvalid.length,
      };
    }

    for (const chunk of batchArray(toWrite, MIGRATION_BATCH_SIZE)) {
      const batch = db.batch();
      for (const { destId, data } of chunk) {
        batch.set(
          db.collection('exerciseEntries').doc(destId),
          data as MigratedEntryDoc
        );
      }
      await batch.commit();
    }

    logger.info('migratePushupsToExerciseEntries', {
      copied: toWrite.length,
      skippedExisting: skippedExisting.length,
      skippedInvalid: skippedInvalid.length,
      by: request.auth?.uid,
    });

    return {
      copied: toWrite.length,
      skippedExisting: skippedExisting.length,
      skippedInvalid: skippedInvalid.length,
    };
  }
);

export const rollbackPushupUnification = onCall(
  { region: 'europe-west3', timeoutSeconds: 540 },
  async (request) => {
    assertAdmin(request);

    const dryRun = Boolean(request.data?.dryRun ?? true);

    const migratedSnap = await db
      .collection('exerciseEntries')
      .where('migratedFrom', '==', 'pushups')
      .get();

    // Defense-in-depth: re-check the provenance marker before deleting so
    // a stray query result can never remove a natively-created entry.
    const ids = rollbackTargets(
      migratedSnap.docs.map((doc) => ({
        id: doc.id,
        migratedFrom: doc.data().migratedFrom as string | undefined,
      }))
    );

    if (dryRun) {
      return { dryRun: true, wouldDelete: ids.length };
    }

    for (const chunk of batchArray(ids, MIGRATION_BATCH_SIZE)) {
      const batch = db.batch();
      for (const id of chunk) {
        batch.delete(db.collection('exerciseEntries').doc(id));
      }
      await batch.commit();
    }

    logger.info('rollbackPushupUnification', {
      deleted: ids.length,
      by: request.auth?.uid,
    });

    return { deleted: ids.length };
  }
);

// Backfills `userStats/{userId}/perExercise/pushup` for every user with
// pushup `exerciseEntries`. The write-path flip + guard removal make new
// pushups aggregate going forward, but the per-exercise aggregate doesn't
// exist for a user until their first post-cutover write — so the dashboard
// (re-pointed to `perExercise/pushup`) would read empty until then. This
// one-shot rebuild (same `rebuildFromEntries` the live trigger uses) seeds
// the aggregate from the migrated history. Idempotent: re-running recomputes
// the same doc.
export const backfillPushupPerExerciseStats = onCall(
  { region: 'europe-west3', timeoutSeconds: 540 },
  async (request) => {
    assertAdmin(request);

    const dryRun = Boolean(request.data?.dryRun ?? true);

    const snap = await db
      .collection('exerciseEntries')
      .where('exerciseId', '==', 'pushup')
      .get();

    const byUser = new Map<
      string,
      { timestamp: string; reps: number; sets?: number[] }[]
    >();
    for (const doc of snap.docs) {
      const data = doc.data();
      const userId = data.userId as string | undefined;
      const timestamp = data.timestamp as string | undefined;
      if (!userId || !timestamp) continue;
      const list = byUser.get(userId) ?? [];
      list.push({
        timestamp,
        reps: Number(data.reps ?? 0),
        ...(Array.isArray(data.sets) ? { sets: data.sets as number[] } : {}),
      });
      byUser.set(userId, list);
    }

    if (dryRun) {
      return {
        dryRun: true,
        wouldRebuildUsers: byUser.size,
        entries: snap.size,
      };
    }

    const nowIso = new Date().toISOString();
    let rebuiltUsers = 0;
    for (const chunk of batchArray(
      [...byUser.entries()],
      MIGRATION_BATCH_SIZE
    )) {
      const batch = db.batch();
      for (const [userId, entries] of chunk) {
        const stats = rebuildFromEntries(userId, entries, nowIso);
        const ref = db
          .collection('userStats')
          .doc(userId)
          .collection('perExercise')
          .doc('pushup');
        batch.set(ref, stats);
        rebuiltUsers += 1;
      }
      await batch.commit();
    }

    logger.info('backfillPushupPerExerciseStats', {
      rebuiltUsers,
      entries: snap.size,
      by: request.auth?.uid,
    });

    return { rebuiltUsers, entries: snap.size };
  }
);
