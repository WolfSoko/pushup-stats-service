import {
  EXERCISE_CATALOG,
  type ExerciseDefinition,
  type MeasurementType,
} from '@pu-stats/models';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

import { berlinDateParts } from './datetime';
import {
  type ExerciseEntryRow,
  type ExerciseLeaderboardEntry,
  type ExerciseUserTotalRow,
  exerciseValueFieldFor,
  getExerciseLeaderboardQueryStartDate,
  rankExerciseAllTime,
  rankExerciseEntries,
  supportsExerciseLeaderboard,
} from './exercise-leaderboard';
import { db, DEMO_USER_ID, TZ } from './firebase-app';
import { type UserProfile } from './profile';

interface ExerciseLeaderboardSnapshot {
  measurement: MeasurementType;
  unit: string;
  periods: {
    daily: ReturnType<typeof rankExerciseEntries>;
    last7: ReturnType<typeof rankExerciseEntries>;
    last30: ReturnType<typeof rankExerciseEntries>;
    allTime: ReturnType<typeof rankExerciseAllTime>;
  };
}

async function rebuildExerciseLeaderboardsCore(opts: {
  /**
   * `true` only on the scheduled rebuild — recomputes `allTime` from
   * the lifetime `userStats/{uid}/perExercise/{exerciseId}.total`
   * aggregates. `false` for the entry-write trigger, which carries
   * forward the previous snapshot's `allTime` instead. Two reasons:
   *
   * 1. Race-safety: the write-driven trigger fires in parallel with
   *    `updateExerciseStatsOnEntryWrite`. Reading `perExercise.total`
   *    on every entry write can land on the pre-write value and
   *    publish a stale allTime that never self-corrects (no rebuild
   *    is scheduled in response to the later aggregate write). Letting
   *    the schedule own allTime moves the read to a point where the
   *    aggregate is guaranteed-consistent and matches the existing
   *    freshness contract (≤15 min lag).
   * 2. Read amplification: a collection-group scan over all lifetime
   *    aggregates is unbounded in the user base; we don't want to pay
   *    it on every `exerciseEntries` write.
   */
  includeAllTime: boolean;
}) {
  const now = new Date();
  const today = berlinDateParts(now);
  const queryStart = getExerciseLeaderboardQueryStartDate(today);

  // Single Firestore query over the trailing 30-day window across all
  // exercises. Per-exercise filtering happens in-memory afterwards —
  // cheaper than 40+ separate queries and small enough to fit in a
  // single function invocation.
  const snap = await db
    .collection('exerciseEntries')
    .where('timestamp', '>=', queryStart)
    .orderBy('timestamp', 'desc')
    .get();

  const rows = snap.docs
    .map((d) => d.data() as ExerciseEntryRow)
    .filter((r) => r.userId !== DEMO_USER_ID);

  // Lifetime cumulative totals per (user, exercise), sourced from the
  // `userStats/{userId}/perExercise/{exerciseId}` subcollection. Only
  // populated on the scheduled rebuild; the on-write path carries the
  // existing snapshot's allTime forward instead — see the `opts` doc
  // above for why. The collection-group read is unfiltered (no
  // orderBy) so it works against the default single-field index;
  // per-exercise ranking and top-N truncation happen in-memory.
  let allTimeByExercise: Map<string, ExerciseUserTotalRow[]> | null = null;
  const allTimeUserIds = new Set<string>();
  let totalAllTimeDocs = 0;
  if (opts.includeAllTime) {
    const allTimeSnap = await db.collectionGroup('perExercise').get();
    totalAllTimeDocs = allTimeSnap.size;
    allTimeByExercise = new Map<string, ExerciseUserTotalRow[]>();
    for (const docSnap of allTimeSnap.docs) {
      const userId = docSnap.ref.parent.parent?.id;
      const exerciseId = docSnap.id;
      if (!userId || !exerciseId) continue;
      if (userId === DEMO_USER_ID) continue;
      const data = docSnap.data() as { total?: unknown };
      const total = Number(data?.total ?? 0);
      if (!Number.isFinite(total) || total <= 0) continue;
      let bucket = allTimeByExercise.get(exerciseId);
      if (!bucket) {
        bucket = [];
        allTimeByExercise.set(exerciseId, bucket);
      }
      bucket.push({ userId, total });
      allTimeUserIds.add(userId);
    }
  }

  // On the write-driven path, carry forward the previous snapshot's
  // ranked allTime arrays per exercise. The scheduled rebuild will
  // refresh them at the next 15-min tick. Reads `byExercise[*].periods
  // .allTime` straight off the doc — no profile resolution needed
  // because the ranks were already filtered and aliased the last time
  // the schedule wrote them.
  const carryForwardAllTime: Record<string, ExerciseLeaderboardEntry[]> = {};
  if (!opts.includeAllTime) {
    const existing = await db.collection('leaderboards').doc('exercises').get();
    if (existing.exists) {
      const data = existing.data() as {
        byExercise?: Record<
          string,
          { periods?: { allTime?: ExerciseLeaderboardEntry[] } }
        >;
      };
      for (const [exerciseId, exSnap] of Object.entries(
        data.byExercise ?? {}
      )) {
        const allTime = exSnap?.periods?.allTime;
        if (Array.isArray(allTime) && allTime.length > 0) {
          carryForwardAllTime[exerciseId] = allTime;
        }
      }
    }
  }

  const userIds = [
    ...new Set([
      ...(rows.map((r) => r.userId).filter(Boolean) as string[]),
      ...allTimeUserIds,
    ]),
  ];
  const userProfiles = new Map<string, UserProfile>();
  if (userIds.length > 0) {
    const cfgSnaps = await Promise.all(
      userIds.map((userId) => db.collection('userConfigs').doc(userId).get())
    );
    for (const cfg of cfgSnaps) {
      userProfiles.set(
        cfg.id,
        cfg.exists ? (cfg.data() as UserProfile) || {} : {}
      );
    }
  }

  const rowsByExercise = new Map<string, ExerciseEntryRow[]>();
  for (const row of rows) {
    if (!row.exerciseId) continue;
    let bucket = rowsByExercise.get(row.exerciseId);
    if (!bucket) {
      bucket = [];
      rowsByExercise.set(row.exerciseId, bucket);
    }
    bucket.push(row);
  }

  const todayKey = today.isoDate;
  const byExercise: Record<string, ExerciseLeaderboardSnapshot> = {};

  for (const def of EXERCISE_CATALOG as readonly ExerciseDefinition[]) {
    if (!supportsExerciseLeaderboard(def.measurement)) continue;
    const exerciseRows = rowsByExercise.get(def.id) ?? [];
    const allTimeBucket: ExerciseLeaderboardEntry[] = opts.includeAllTime
      ? rankExerciseAllTime(allTimeByExercise?.get(def.id) ?? [], userProfiles)
      : (carryForwardAllTime[def.id] ?? []);
    // Drop the exercise from the snapshot only when neither the 30-day
    // window nor the lifetime aggregates carry anything for it. An
    // exercise with only old activity should still surface a populated
    // allTime bucket (with empty daily/last7/last30).
    if (exerciseRows.length === 0 && allTimeBucket.length === 0) continue;
    const valueField = exerciseValueFieldFor(def.measurement);

    byExercise[def.id] = {
      measurement: def.measurement,
      unit: def.unit,
      periods: {
        daily: rankExerciseEntries(
          exerciseRows,
          valueField,
          'daily',
          todayKey,
          userProfiles
        ),
        last7: rankExerciseEntries(
          exerciseRows,
          valueField,
          'last7',
          todayKey,
          userProfiles
        ),
        last30: rankExerciseEntries(
          exerciseRows,
          valueField,
          'last30',
          todayKey,
          userProfiles
        ),
        allTime: allTimeBucket,
      },
    };
  }

  // Overwrite (no merge) so an exercise that loses all its eligible
  // entries (every user opted out, or no recent activity) drops out
  // of the snapshot instead of lingering as a stale top.
  await db
    .collection('leaderboards')
    .doc('exercises')
    .set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timezone: TZ,
      keys: {
        daily: todayKey,
        last7: todayKey,
        last30: todayKey,
        allTime: todayKey,
      },
      byExercise,
    });

  logger.info('Exercise leaderboards rebuilt', {
    exercises: Object.keys(byExercise).length,
    totalRows: rows.length,
    allTimeRows: totalAllTimeDocs,
    includeAllTime: opts.includeAllTime,
  });
}

// Same shape as the pushup pair above: scheduled rebuild every 15 min +
// a write-driven refresh so the snapshot stays fresh between scheduled
// runs. The `exerciseEntries` write rate is comparable to `pushups`
// (per-user writes, not bulk) so the cost shape is the same.
export const rebuildExerciseLeaderboards = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: TZ,
    region: 'europe-west3',
    retryCount: 1,
  },
  async () => {
    await rebuildExerciseLeaderboardsCore({ includeAllTime: true });
  }
);

export const refreshExerciseLeaderboardsOnEntryWrite = onDocumentWritten(
  {
    document: 'exerciseEntries/{entryId}',
    region: 'europe-west3',
    retry: false,
  },
  async () => {
    // Post-cutover pushups (`exerciseId:'pushup'`) aggregate + rank like
    // every other exercise, so there is no exercise-id guard here.

    // Carry the previous snapshot's allTime forward and let the
    // scheduled rebuild refresh it. See `rebuildExerciseLeaderboardsCore`
    // for the race-safety + cost rationale.
    await rebuildExerciseLeaderboardsCore({ includeAllTime: false });
  }
);
