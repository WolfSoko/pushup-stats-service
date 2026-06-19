import type { UserStats } from '@pu-stats/models';
import { USERSTATS_VERSION } from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall } from 'firebase-functions/v2/https';

import { sanitizeSetsArray } from './entry-sanitize';
import { db } from './firebase-app';
import { assertAdmin } from './functions-admin';
import { applyDelta, rebuildFromEntries } from './user-stats-delta';

// Admin-callable backfill: recomputes userStats/{userId} from all pushup
// entries. Accepts { userId?: string }. If userId is omitted, rebuilds for
// ALL users.
export const rebuildUserStats = onCall(
  { region: 'europe-west3', timeoutSeconds: 540 },
  async (request) => {
    assertAdmin(request);

    const targetUserId = request.data?.userId
      ? String(request.data.userId).trim()
      : null;
    const nowIso = new Date().toISOString();

    async function rebuildForUser(userId: string) {
      const snap = await db
        .collection('pushups')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'asc')
        .get();

      const entries = snap.docs.map((d) => {
        const data = d.data();
        return {
          timestamp: data.timestamp as string,
          reps: Number(data.reps ?? 0),
          ...(Array.isArray(data.sets) ? { sets: data.sets as number[] } : {}),
        };
      });

      const stats = rebuildFromEntries(userId, entries, nowIso);
      await db.collection('userStats').doc(userId).set(stats);
      return entries.length;
    }

    if (targetUserId) {
      const count = await rebuildForUser(targetUserId);
      logger.info('rebuildUserStats: single user', {
        userId: targetUserId,
        entries: count,
        by: request.auth?.uid,
      });
      return { rebuilt: 1, entries: count };
    }

    // Rebuild for ALL users
    const allPushups = await db.collection('pushups').get();
    const userIds = new Set<string>();
    for (const doc of allPushups.docs) {
      const uid = doc.data().userId;
      if (uid) userIds.add(uid);
    }

    let totalRebuilt = 0;
    for (const userId of userIds) {
      await rebuildForUser(userId);
      totalRebuilt++;
    }

    logger.info('rebuildUserStats: all users', {
      rebuilt: totalRebuilt,
      by: request.auth?.uid,
    });
    return { rebuilt: totalRebuilt };
  }
);

// Listens on `exerciseEntries` and writes per-exercise aggregates to
// `userStats/{userId}/perExercise/{exerciseId}`, leaving the existing
// `userStats/{userId}` doc untouched. Reuses `applyDelta`/`rebuildFromEntries`
// to avoid forking the streak/heatmap logic.
export const updateExerciseStatsOnEntryWrite = onDocumentWritten(
  {
    document: 'exerciseEntries/{entryId}',
    region: 'europe-west3',
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    const userId = (afterData?.userId ?? beforeData?.userId) as
      | string
      | undefined;
    if (!userId) {
      logger.warn('updateExerciseStatsOnEntryWrite: no userId found, skipping');
      return;
    }

    const exerciseId = (afterData?.exerciseId ?? beforeData?.exerciseId) as
      | string
      | undefined;
    if (!exerciseId) {
      logger.warn(
        'updateExerciseStatsOnEntryWrite: no exerciseId found, skipping'
      );
      return;
    }

    // Post-cutover pushups (`exerciseId:'pushup'`) aggregate into
    // `perExercise/pushup` like every other exercise — no guard.

    // The aggregation slot stays named `reps` for backwards
    // compatibility with the existing UserStats schema, but for
    // non-rep exercises we feed the primary measurement field
    // (`durationSec` for plank, `distanceM` for cardio.running) into
    // the same slot. The per-exercise stats doc is exercise-scoped,
    // so `total` carries seconds for plank, meters for a tracked run,
    // and rep counts for sit-ups — the display layer formats
    // accordingly. For composite measurements ('distance-time') the
    // companion duration is left to the live entries query in the
    // dashboard summary; the aggregated slot stays single-valued.
    //
    // Fallback ordering matters: `distanceM` MUST come before
    // `durationSec` because cardio.running entries carry both, and
    // the primary value (distance) needs to win the `??` chain.
    const oldReps = Number(
      beforeData?.reps ?? beforeData?.distanceM ?? beforeData?.durationSec ?? 0
    );
    const newReps = Number(
      afterData?.reps ?? afterData?.distanceM ?? afterData?.durationSec ?? 0
    );
    const oldTimestamp = beforeData?.timestamp as string | undefined;
    const newTimestamp = afterData?.timestamp as string | undefined;
    // Defensive sanitization: reduce over `sets` runs straight into
    // applyDelta()/rebuildFromEntries() and any non-numeric value would
    // poison the aggregate with NaN, which then causes the transaction
    // set() to reject and the Cloud Function to retry forever.
    // The Firestore rule enforces `is list` on writes, but documents
    // predating that rule (or admin SDK writes) can still carry
    // surprises.
    //
    // `intervals` (endurance per-segment breakdown) is intentionally
    // NOT extracted: UserStats has no symmetric aggregation for it
    // (no totalIntervals / bestSingleInterval yet) and the primary
    // measurement value is already folded into the `reps` slot above.
    // The Firestore rules enforce `sets` and `intervals` are mutex,
    // so a strength entry won't smuggle intervals through this path.
    const oldSets = sanitizeSetsArray(beforeData?.sets);
    const newSets = sanitizeSetsArray(afterData?.sets);

    const isCreate = !beforeData && !!afterData;
    const isDelete = !!beforeData && !afterData;
    const isUpdate = !!beforeData && !!afterData;
    const timestampChanged =
      isUpdate && oldTimestamp && newTimestamp && oldTimestamp !== newTimestamp;

    if (!newTimestamp && !oldTimestamp) {
      logger.warn(
        'updateExerciseStatsOnEntryWrite: no timestamp found, skipping'
      );
      return;
    }

    const nowIso = new Date().toISOString();
    const statsRef = db
      .collection('userStats')
      .doc(userId)
      .collection('perExercise')
      .doc(exerciseId);

    const statsSnap = await statsRef.get();
    const existingStats = statsSnap.exists
      ? (statsSnap.data() as UserStats)
      : null;

    let firstEntryAllEntries: Array<{
      timestamp: string;
      reps: number;
      sets?: number[];
    }> | null = null;
    let versionOutdated = false;

    if (
      existingStats &&
      (!existingStats.version || existingStats.version < USERSTATS_VERSION)
    ) {
      versionOutdated = true;
    }

    if ((isCreate && !existingStats) || versionOutdated) {
      // Equality filters on userId + exerciseId combined with
      // orderBy(timestamp) require a composite index over those three fields;
      // without it Firestore rejects the query and the aggregate below is
      // never written.
      const allEntriesSnap = await db
        .collection('exerciseEntries')
        .where('userId', '==', userId)
        .where('exerciseId', '==', exerciseId)
        .orderBy('timestamp', 'asc')
        .get();
      firstEntryAllEntries = allEntriesSnap.docs.map((d) => {
        const data = d.data();
        return {
          timestamp: data.timestamp as string,
          // Non-rep entries reuse the rebuild path's `reps` slot for
          // their primary measurement value: seconds for plank, meters
          // for cardio.running. The slot is exercise-scoped so it
          // never mixes units across exercises. `distanceM` precedes
          // `durationSec` so a cardio.running entry (both fields set)
          // aggregates the distance, not the companion duration.
          reps: Number(data.reps ?? data.distanceM ?? data.durationSec ?? 0),
          ...(Array.isArray(data.sets) ? { sets: data.sets as number[] } : {}),
        };
      });
    }

    await db.runTransaction(async (tx) => {
      const txSnap = await tx.get(statsRef);
      let current = txSnap.exists ? (txSnap.data() as UserStats) : null;

      let shouldRebuild = false;
      if (firstEntryAllEntries !== null && isCreate && !current) {
        shouldRebuild = true;
      } else if (
        firstEntryAllEntries !== null &&
        current &&
        (!current.version || current.version < USERSTATS_VERSION)
      ) {
        shouldRebuild = true;
      }

      if (shouldRebuild && firstEntryAllEntries) {
        // userId is intentionally re-used as the per-exercise stats key —
        // applyDelta/emptyUserStats only treat it as an opaque identifier.
        current = rebuildFromEntries(userId, firstEntryAllEntries, nowIso);
      } else if (current) {
        if (timestampChanged && oldTimestamp && newTimestamp) {
          current = applyDelta(current, {
            userId,
            repsDelta: -oldReps,
            entriesDelta: -1,
            timestamp: oldTimestamp,
            newReps: 0,
            nowIso,
            setsDelta: -(oldSets.length || 0),
            oldSets: oldSets.length ? oldSets : undefined,
          });
          current = applyDelta(current, {
            userId,
            repsDelta: newReps,
            entriesDelta: 1,
            timestamp: newTimestamp,
            newReps,
            nowIso,
            setsDelta: newSets.length || 0,
            newSets: newSets.length ? newSets : undefined,
          });
        } else {
          const repsDelta = newReps - oldReps;
          const entriesDelta = isCreate ? 1 : isDelete ? -1 : 0;
          const timestamp = newTimestamp ?? oldTimestamp;
          const setsDelta = (newSets.length || 0) - (oldSets.length || 0);
          if (!timestamp) return;
          current = applyDelta(current, {
            userId,
            repsDelta,
            entriesDelta,
            timestamp,
            newReps,
            nowIso,
            setsDelta,
            newSets: newSets.length ? newSets : undefined,
            oldSets: oldSets.length ? oldSets : undefined,
          });
        }
      } else {
        // Missing per-exercise stats on a non-first-create write.
        // Rebuild from source-of-truth so updates/deletes don't wipe totals.
        const userEntriesSnap = await tx.get(
          db
            .collection('exerciseEntries')
            .where('userId', '==', userId)
            .where('exerciseId', '==', exerciseId)
            .orderBy('timestamp', 'asc')
        );
        const userEntries = userEntriesSnap.docs.map((d) => {
          const data = d.data();
          return {
            timestamp: data.timestamp as string,
            // Non-rep entries fold their primary measurement into the
            // `reps` slot the rebuild expects: durationSec for plank,
            // distanceM for cardio.running. Same ordering as the live
            // trigger — distance wins over duration when both exist.
            reps: Number(data.reps ?? data.distanceM ?? data.durationSec ?? 0),
            ...(Array.isArray(data.sets)
              ? { sets: data.sets as number[] }
              : {}),
          };
        });
        current = rebuildFromEntries(userId, userEntries, nowIso);
      }

      tx.set(statsRef, current);
    });

    logger.info('updateExerciseStatsOnEntryWrite', {
      userId,
      exerciseId,
      oldReps,
      newReps,
      timestampChanged,
      entryId: event.params?.entryId,
    });
  }
);
