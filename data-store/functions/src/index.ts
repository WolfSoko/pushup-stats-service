import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UserStats } from '@pu-stats/models';
import {
  EXERCISE_CATALOG,
  type ExerciseDefinition,
  type MeasurementType,
  normalizeReminderLocale,
  USERSTATS_VERSION,
} from '@pu-stats/models';
import * as Sentry from '@sentry/node';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import webpush from 'web-push';
import {
  batchArray,
  buildGithubIssueBody,
  validateAdminAccess,
  validateFeedbackId,
  validateLeaderboardExclusionPayload,
  validateMarkFeedbackReadPayload,
  validateSetMigrationStatusPayload,
} from './admin';

// Module imports
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
import {
  getLeaderboardQueryStartDate,
  rankAllTime,
  rankEntries,
  type UserTotalRow,
} from './leaderboard';
import {
  flattenTiers,
  getFallbackTieredQuotes,
  QUOTE_CACHE_HOURS,
  QUOTE_TIERS,
  type TieredQuotes,
} from './motivation';
import {
  type MigratedEntryDoc,
  planMigration,
  type PushupSourceDoc,
  rollbackTargets,
  shouldAggregateExerciseEntry,
} from './pushup-unification';
import {
  buildPublicProfile,
  isValidUid,
  type UserConfigForPublicProfile,
  type UserStatsForPublicProfile,
  UserProfile,
} from './profile';
// `renderProfileOg` lives behind a dynamic `import()` call inside the
// `ogProfile` handler below — pulling satori + @resvg/resvg-wasm (~15 MB
// + WASM init) eagerly here would slow cold-start for every unrelated
// function in this bundle (leaderboards, motivation, push, …).
import type { ReminderConfig } from './push';
import {
  buildNotificationPayload,
  buildReminderActions,
  isExpiredSubscriptionError,
  isLeaseStale,
  pushSubscriptionId,
  PUSH_SEND_OPTIONS,
  sanitizeQuickLogReps,
  shouldSendReminder,
  STALE_LEASE_MS,
  validateSubscriptionPayload,
} from './push';
import { applyDelta, rebuildFromEntries } from './user-stats-delta';

Sentry.init({
  dsn: 'https://084cd4acd3e626148eba3a831d0e4bee@o1384048.ingest.us.sentry.io/4511089937219584',
  release: process.env['SENTRY_RELEASE'] || undefined,
  environment: process.env['SENTRY_ENVIRONMENT'] ?? 'production',
  tracesSampleRate: 0.1,
});

admin.initializeApp();

const db = admin.firestore();
const TZ = 'Europe/Berlin';
const DEMO_USER_ID = '9CrETSHzoKcPPw0ctHKM1OiyRrp2';
const GITHUB_TOKEN = defineSecret('GITHUB_TOKEN');

/**
 * Returns the input as a `number[]` of finite, non-negative integers.
 * Any non-array, non-numeric, or out-of-shape values become an empty
 * array so downstream `reduce()`s never see NaN. Used by the
 * exerciseEntries trigger; the legacy pushup trigger keeps its inline
 * `Array.isArray` guard for now.
 */
function sanitizeSetsArray(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  const out: number[] = [];
  for (const v of input) {
    if (typeof v !== 'number') continue;
    if (!Number.isFinite(v) || !Number.isInteger(v)) continue;
    if (v < 0) continue;
    out.push(v);
  }
  return out;
}

async function rebuildLeaderboardsCore() {
  const now = new Date();
  const today = berlinDateParts(now);
  const queryStart = getLeaderboardQueryStartDate(today);

  const snap = await db
    .collection('pushups')
    .where('timestamp', '>=', queryStart)
    .orderBy('timestamp', 'desc')
    .get();

  const rows = snap.docs
    .map((d) => d.data())
    .filter((r) => r.userId !== DEMO_USER_ID);

  // Pull the lifetime cumulative totals from `userStats` for the allTime
  // ranking. The 30-day pushups query above can't power this bucket — a
  // user whose last entry is older than 30 days would silently drop off
  // an "all time" leaderboard otherwise. `total` is a single-field
  // index that Firestore creates automatically; `limit(50)` over-fetches
  // so we can still produce TOP_N=10 after filtering opt-outs and the
  // demo user.
  const allTimeSnap = await db
    .collection('userStats')
    .orderBy('total', 'desc')
    .limit(50)
    .get();
  const allTimeRows: UserTotalRow[] = allTimeSnap.docs
    .map((d) => {
      const data = d.data() as { total?: unknown };
      const total = Number(data?.total ?? 0);
      return { userId: d.id, total: Number.isFinite(total) ? total : 0 };
    })
    .filter((r) => r.userId !== DEMO_USER_ID);

  const userIds = [
    ...new Set([
      ...rows.map((r) => r.userId).filter(Boolean),
      ...allTimeRows.map((r) => r.userId),
    ]),
  ] as string[];
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

  // Rolling windows always end on today's Berlin date, so the same isoDate
  // serves as the cache key for daily, last7, last30, and allTime.
  const todayKey = today.isoDate;

  const daily = rankEntries(rows, 'daily', todayKey, userProfiles);
  const last7 = rankEntries(rows, 'last7', todayKey, userProfiles);
  const last30 = rankEntries(rows, 'last30', todayKey, userProfiles);
  const allTime = rankAllTime(allTimeRows, userProfiles);

  // Overwrite (no merge) so stale weekly/monthly fields from the previous
  // schema get evicted instead of lingering in the document.
  await db
    .collection('leaderboards')
    .doc('current')
    .set({
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      timezone: TZ,
      keys: {
        daily: todayKey,
        last7: todayKey,
        last30: todayKey,
        allTime: todayKey,
      },
      periods: { daily, last7, last30, allTime },
    });

  logger.info('Leaderboards rebuilt', {
    daily: daily.length,
    last7: last7.length,
    last30: last30.length,
    allTime: allTime.length,
  });
}

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
  // single function invocation (Phase-0 catalog × active users).
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

// ─── Admin helpers ────────────────────────────────────────────────────────────

function assertAdmin(request: {
  auth?: { uid: string; token: Record<string, unknown> };
}) {
  const error = validateAdminAccess(request.auth);
  if (error) throw new HttpsError(error.code, error.message);
}

// ─── adminListUsers ────────────────────────────────────────────────────────────

export const adminListUsers = onCall(
  { region: 'europe-west3', timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request);

    const authUsers: admin.auth.UserRecord[] = [];
    let pageToken: string | undefined;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      authUsers.push(...result.users);
      pageToken = result.pageToken;
    } while (pageToken);

    const uids = authUsers.map((u) => u.uid);
    const configMap = new Map<string, Record<string, unknown>>();
    for (let i = 0; i < uids.length; i += 10) {
      const batch = uids.slice(i, i + 10);
      const snaps = await db
        .collection('userConfigs')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get();
      for (const snap of snaps.docs) {
        configMap.set(snap.id, snap.data());
      }
    }

    const pushupCountMap = new Map<string, number>();
    const lastPushupMap = new Map<string, string>();
    const pushupSnap = await db.collection('pushups').get();
    for (const doc of pushupSnap.docs) {
      const data = doc.data();
      if (!data.userId) continue;
      pushupCountMap.set(
        data.userId,
        (pushupCountMap.get(data.userId) || 0) + 1
      );
      const ts = data.timestamp as string;
      if (
        !lastPushupMap.has(data.userId) ||
        ts > (lastPushupMap.get(data.userId) ?? '')
      ) {
        lastPushupMap.set(data.userId, ts);
      }
    }

    return authUsers.map((user) => {
      const config = configMap.get(user.uid) || {};
      return {
        uid: user.uid,
        displayName:
          (config as Record<string, unknown>).displayName ||
          user.displayName ||
          null,
        email: (config as Record<string, unknown>).email || user.email || null,
        anonymous: user.providerData.length === 0,
        pushupCount: pushupCountMap.get(user.uid) || 0,
        lastEntry: lastPushupMap.get(user.uid) || null,
        createdAt: user.metadata.creationTime || null,
        role: user.customClaims?.admin === true ? 'admin' : null,
      };
    });
  }
);

// ─── adminDeleteUser ───────────────────────────────────────────────────────────

export const adminDeleteUser = onCall(
  { region: 'europe-west3', timeoutSeconds: 120 },
  async (request) => {
    assertAdmin(request);

    const uid = String(request.data?.uid || '').trim();
    const anonymize = Boolean(request.data?.anonymize ?? true);

    if (!uid) throw new HttpsError('invalid-argument', 'uid erforderlich.');
    if (uid === DEMO_USER_ID) {
      throw new HttpsError(
        'failed-precondition',
        'Demo-Benutzer kann nicht gelöscht werden.'
      );
    }

    await admin.auth().deleteUser(uid);

    if (anonymize) {
      await db
        .collection('userConfigs')
        .doc(uid)
        .set(
          {
            displayName: 'Gelöschter Benutzer',
            email: null,
            ui: { hideFromLeaderboard: true },
          },
          { merge: true }
        );
    } else {
      await db.collection('userConfigs').doc(uid).delete();

      const pushupSnap = await db
        .collection('pushups')
        .where('userId', '==', uid)
        .get();

      const BATCH_SIZE = 500;
      for (let i = 0; i < pushupSnap.docs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        for (const doc of pushupSnap.docs.slice(i, i + BATCH_SIZE)) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }

    await deleteAllPushSubscriptions(uid);

    logger.info('adminDeleteUser', { uid, anonymize, by: request.auth?.uid });
    return { ok: true };
  }
);

// ─── adminSetLeaderboardExclusion ─────────────────────────────────────────────
//
// Admin shadow-ban for the public leaderboard. Sets the top-level
// `leaderboardExcluded` flag on the user's `userConfigs` doc; the
// leaderboard rebuild filters them out at the next run. Reversible —
// passing `excluded: false` removes the ban without touching opt-in
// toggles or pushup history. Clients are blocked from writing this
// field at the Firestore-rule layer.

export const adminSetLeaderboardExclusion = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    assertAdmin(request);

    const result = validateLeaderboardExclusionPayload(request.data);
    if (!result.valid) {
      throw new HttpsError('invalid-argument', result.error);
    }
    const { uid, excluded } = result;

    if (uid === DEMO_USER_ID) {
      throw new HttpsError(
        'failed-precondition',
        'Demo-Benutzer kann nicht gesperrt werden.'
      );
    }

    await db
      .collection('userConfigs')
      .doc(uid)
      .set({ leaderboardExcluded: excluded }, { merge: true });

    logger.info('adminSetLeaderboardExclusion', {
      uid,
      excluded,
      by: request.auth?.uid,
    });
    return { ok: true, uid, excluded };
  }
);

// ─── adminBulkDeleteInactiveAnonymous ─────────────────────────────────────────

export const adminBulkDeleteInactiveAnonymous = onCall(
  { region: 'europe-west3', timeoutSeconds: 300 },
  async (request) => {
    assertAdmin(request);

    const inactiveDays = Number(request.data?.inactiveDays ?? 20);
    const cutoff = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const anonymousUsers: string[] = [];
    let pageToken: string | undefined;
    do {
      const result = await admin.auth().listUsers(1000, pageToken);
      for (const user of result.users) {
        if (user.providerData.length === 0 && user.uid !== DEMO_USER_ID) {
          anonymousUsers.push(user.uid);
        }
      }
      pageToken = result.pageToken;
    } while (pageToken);

    const lastPushupMap = new Map<string, string>();
    if (anonymousUsers.length > 0) {
      const pushupSnap = await db.collection('pushups').get();
      for (const doc of pushupSnap.docs) {
        const data = doc.data();
        if (!data.userId || !anonymousUsers.includes(data.userId)) continue;
        const ts = String(data.timestamp || '').slice(0, 10);
        if (
          !lastPushupMap.has(data.userId) ||
          ts > (lastPushupMap.get(data.userId) ?? '')
        ) {
          lastPushupMap.set(data.userId, ts);
        }
      }
    }

    let deleted = 0;
    let skipped = 0;

    for (const uid of anonymousUsers) {
      const lastTs = lastPushupMap.get(uid);
      if (lastTs && lastTs >= cutoff) {
        skipped++;
        continue;
      }

      await admin.auth().deleteUser(uid);
      await db.collection('userConfigs').doc(uid).delete();

      const pushupSnap = await db
        .collection('pushups')
        .where('userId', '==', uid)
        .get();

      if (!pushupSnap.empty) {
        const batch = db.batch();
        for (const doc of pushupSnap.docs) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }

      await deleteAllPushSubscriptions(uid);
      deleted++;
    }

    logger.info('adminBulkDeleteInactiveAnonymous', {
      inactiveDays,
      cutoff,
      deleted,
      skipped,
      by: request.auth?.uid,
    });
    return { deleted, skipped };
  }
);

// ─── adminListFeedback ────────────────────────────────────────────────────────

export const adminListFeedback = onCall(
  { region: 'europe-west3', timeoutSeconds: 60 },
  async (request) => {
    assertAdmin(request);

    const snap = await db
      .collection('feedback')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    return snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name ?? null,
        email: d.email ?? null,
        message: d.message ?? '',
        userId: d.userId ?? null,
        createdAt: d.createdAt?.toDate?.()?.toISOString?.() ?? null,
        userAgent: d.userAgent ?? null,
        read: d.read === true,
        githubIssueUrl: d.githubIssueUrl ?? null,
      };
    });
  }
);

// ─── adminMarkFeedbackRead ────────────────────────────────────────────────────

export const adminMarkFeedbackRead = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);

    const validation = validateMarkFeedbackReadPayload(request.data);
    if (!validation.valid) {
      throw new HttpsError('invalid-argument', validation.error);
    }

    const feedbackRef = db.collection('feedback').doc(validation.feedbackId);
    const feedbackSnap = await feedbackRef.get();
    if (!feedbackSnap.exists) {
      throw new HttpsError('not-found', 'Feedback nicht gefunden.');
    }

    await feedbackRef.update({ read: validation.read });

    return { ok: true };
  }
);

// ─── Migration status tracking ────────────────────────────────────────────────

const MIGRATION_STATUS_COLLECTION = 'migrationStatus';

export const getMigrationStatuses = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);
    const snap = await db.collection(MIGRATION_STATUS_COLLECTION).get();
    const statuses: Record<
      string,
      { completed: boolean; completedAt: string | null; completedBy: string }
    > = {};
    for (const doc of snap.docs) {
      const data = doc.data();
      statuses[doc.id] = {
        completed: Boolean(data.completed),
        completedAt: (data.completedAt as string | null) ?? null,
        completedBy: (data.completedBy as string) ?? '',
      };
    }
    return { statuses };
  }
);

export const setMigrationStatus = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);

    const validation = validateSetMigrationStatusPayload(request.data);
    if (!validation.valid || !validation.id) {
      throw new HttpsError('invalid-argument', validation.error ?? 'invalid');
    }

    const nowIso = new Date().toISOString();
    const completed = validation.completed === true;
    const doc = {
      completed,
      completedAt: completed ? nowIso : null,
      completedBy: completed ? (request.auth?.uid ?? '') : '',
    };
    await db
      .collection(MIGRATION_STATUS_COLLECTION)
      .doc(validation.id)
      .set(doc);

    logger.info('setMigrationStatus', {
      id: validation.id,
      completed,
      by: request.auth?.uid,
    });
    return { id: validation.id, ...doc };
  }
);

// ─── adminDeleteFeedback ──────────────────────────────────────────────────────

export const adminDeleteFeedback = onCall(
  { region: 'europe-west3' },
  async (request) => {
    assertAdmin(request);

    const validation = validateFeedbackId(request.data);
    if (!validation.valid) {
      throw new HttpsError('invalid-argument', validation.error);
    }

    await db.collection('feedback').doc(validation.feedbackId).delete();

    return { ok: true };
  }
);

// ─── adminCreateGithubIssue ───────────────────────────────────────────────────

const GITHUB_REPO_OWNER = 'wolfsoko';
const GITHUB_REPO_NAME = 'pushup-stats-service';

export const adminCreateGithubIssue = onCall(
  { region: 'europe-west3', secrets: [GITHUB_TOKEN] },
  async (request) => {
    assertAdmin(request);

    const validation = validateFeedbackId(request.data);
    if (!validation.valid) {
      throw new HttpsError('invalid-argument', validation.error);
    }

    const token = GITHUB_TOKEN.value();
    if (!token || token.startsWith('placeholder')) {
      throw new HttpsError(
        'failed-precondition',
        'GITHUB_TOKEN secret ist nicht konfiguriert.'
      );
    }

    const docRef = db.collection('feedback').doc(validation.feedbackId);
    const doc = await docRef.get();
    if (!doc.exists) {
      throw new HttpsError('not-found', 'Feedback nicht gefunden.');
    }

    const d = doc.data() ?? {};

    // Idempotency: return existing issue URL without creating a duplicate
    if (d.githubIssueUrl) {
      return { ok: true, issueUrl: d.githubIssueUrl as string };
    }

    const createdAt = d.createdAt?.toDate?.()?.toISOString?.() ?? null;
    const { title, body } = buildGithubIssueBody({
      name: (d.name as string) ?? null,
      message: (d.message as string) ?? '',
      createdAt,
      userId: (d.userId as string) ?? null,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ title, body, labels: ['feedback'] }),
          signal: controller.signal,
        }
      );
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new HttpsError('deadline-exceeded', 'GitHub API Timeout.');
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      logger.error('GitHub issue creation failed', {
        status: response.status,
        body: text,
      });
      throw new HttpsError(
        'internal',
        'GitHub-Issue konnte nicht erstellt werden.'
      );
    }

    const issueData = (await response.json()) as { html_url: string };
    const issueUrl = issueData.html_url;

    await docRef.update({ githubIssueUrl: issueUrl });

    return { ok: true, issueUrl };
  }
);

// ─── Leaderboard functions ────────────────────────────────────────────────────

export const rebuildLeaderboards = onSchedule(
  {
    schedule: 'every 15 minutes',
    timeZone: TZ,
    region: 'europe-west3',
    retryCount: 1,
  },
  async () => {
    await rebuildLeaderboardsCore();
  }
);

export const refreshLeaderboardsOnPushupWrite = onDocumentWritten(
  {
    document: 'pushups/{pushupId}',
    region: 'europe-west3',
    retry: false,
  },
  async () => {
    await rebuildLeaderboardsCore();
  }
);

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
  async (event) => {
    // Staged-migration guard: the pushup→exerciseEntries copies carry
    // `exerciseId:'pushup'` and must NOT refresh a pushup leaderboard
    // row before the Phase-7 cutover (the Pushup leaderboard is still
    // driven by `rebuildLeaderboardsCore` off the legacy `pushups`
    // collection). Derive the id from after-or-before so create, update
    // and delete are all covered.
    const exerciseId = (event.data?.after?.data()?.exerciseId ??
      event.data?.before?.data()?.exerciseId) as string | undefined;
    if (!shouldAggregateExerciseEntry(exerciseId)) return;

    // Carry the previous snapshot's allTime forward and let the
    // scheduled rebuild refresh it. See `rebuildExerciseLeaderboardsCore`
    // for the race-safety + cost rationale.
    await rebuildExerciseLeaderboardsCore({ includeAllTime: false });
  }
);

// ─── Shared lookup ────────────────────────────────────────────────────────────
// Both `getPublicProfile` (callable) and `ogProfile` (HTTP) need the same
// validation → Firestore reads → projection chain with identical privacy
// semantics. Centralising the lookup here keeps the 404-parity contract
// from drifting between the two wrappers and matches the project's "trigger
// functions in `index.ts` are thin wrappers" rule.
async function fetchPublicProfileProjection(uid: string) {
  if (!isValidUid(uid)) return null;
  const db = admin.firestore();
  const [cfgSnap, statsSnap] = await Promise.all([
    db.collection('userConfigs').doc(uid).get(),
    db.collection('userStats').doc(uid).get(),
  ]);
  const config = cfgSnap.exists
    ? (cfgSnap.data() as UserConfigForPublicProfile)
    : null;
  const stats = statsSnap.exists
    ? (statsSnap.data() as UserStatsForPublicProfile)
    : null;
  return buildPublicProfile(uid, config, stats);
}

// ─── getPublicProfile (anonymous-callable, opt-in only) ──────────────────────
// Returns a sanitized projection of `userConfigs/{uid}` + `userStats/{uid}`
// for users who explicitly set `ui.publicProfile = true`. Anyone else returns
// `not-found` so existence of a private user can't be probed by walking UIDs.
//
// This callable runs UNAUTHENTICATED on purpose — it backs the `/u/:uid`
// public route and the dynamic OG image endpoint. Do NOT add side effects
// here; only sanctioned read-only projection.

export const getPublicProfile = onCall(
  { region: 'europe-west3', invoker: 'public' },
  async (request) => {
    const uid = String(request.data?.uid ?? '').trim();
    const projection = await fetchPublicProfileProjection(uid);
    if (!projection) {
      // Same response for "malformed UID", "user does not exist", and
      // "user is private" so an attacker can't enumerate accounts.
      throw new HttpsError('not-found', 'Profile not available');
    }
    return projection;
  }
);

// ─── ogProfile (HTTP, dynamic OpenGraph card) ────────────────────────────────
// `GET /ogProfile?uid=<uid>&lang=<de|en>` — renders a 1200×630 PNG via
// satori + resvg for the profile's current stats. Returns a 404 with the
// plain-text body `Profile not available` for users who haven't opted in
// (or for malformed UIDs), matching `getPublicProfile`'s privacy guarantee.
//
// Cache headers let Firebase Hosting / the function's own CDN do most of
// the work — full re-render is amortised across hours per user.

export const ogProfile = onRequest(
  {
    region: 'europe-west3',
    invoker: 'public',
    cors: true,
    memory: '512MiB',
    timeoutSeconds: 30,
  },
  async (req, res) => {
    const uidRaw = String(req.query['uid'] ?? '').trim();
    const lang = String(req.query['lang'] ?? 'de').toLowerCase();
    const locale = lang === 'en' ? 'en' : 'de';

    try {
      const projection = await fetchPublicProfileProjection(uidRaw);
      if (!projection) {
        // Same fingerprint as a non-existent UID. Cache the 404 briefly so
        // a hot-linked card from a private user doesn't hammer Firestore.
        res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
        res.status(404).send('Profile not available');
        return;
      }

      // Lazy-load the renderer so satori + @resvg/resvg-wasm only initialise
      // on the first OG request (and stay cached in module scope across warm
      // invocations) — keeps cold-start of unrelated functions in this
      // bundle unaffected by the heavy renderer deps.
      const { renderProfileOg } = await import('./profile/og-render');
      const png = await renderProfileOg(projection, locale);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Length', String(png.byteLength));
      // 5 min browser, 1 h CDN, 1 day stale-while-revalidate so a slow
      // delta-aggregation pipeline behind userStats doesn't stall a request.
      res.setHeader(
        'Cache-Control',
        'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
      );
      res.status(200).send(png);
    } catch (err) {
      Sentry.captureException(err);
      logger.error('ogProfile render failed', {
        uid: uidRaw,
        err: err instanceof Error ? err.message : String(err),
      });
      res.status(500).send('OG render failed');
    }
  }
);

// ─── generateMotivationQuotes ─────────────────────────────────────────────────

/**
 * Per-tier prompt instruction (tone) — appended to the language-agnostic
 * prompt so the model produces tiered output in a single Gemini call.
 * Keeping it in English (no German wording) lets the same map drive every
 * supported locale; the model is told the *output* language separately.
 */
const TIER_INSTRUCTIONS: Record<(typeof QUOTE_TIERS)[number], string> = {
  general: 'general motivation, fitness vibe',
  belowGoal: 'encouraging "let’s start" / "you can do it" tone',
  nearGoal: 'push-through tone, halfway-there energy',
  goalReached: 'celebration + "next-level" challenge tone',
};

const QUOTES_PER_TIER = 6;

/**
 * BCP-47 display names used in the Gemini prompt so the model produces
 * quotes in the requested locale even for tags without obvious instruction
 * (la, no, zh, …). Falls back to the locale code itself.
 */
const LANGUAGE_PROMPT_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  it: 'Italian',
  nl: 'Dutch',
  el: 'Greek',
  la: 'Latin',
  no: 'Norwegian',
  zh: 'Simplified Chinese',
};

function buildTieredPrompt(
  language: string,
  totalToday: number,
  dailyGoal: number,
  displayName: string
): string {
  const langName = LANGUAGE_PROMPT_NAMES[language] ?? language;
  const tierLines = QUOTE_TIERS.map(
    (tier) =>
      `  "${tier}": ${QUOTES_PER_TIER} short sentences — ${TIER_INSTRUCTIONS[tier]}`
  ).join('\n');
  return [
    `Generate motivational push-up quotes in ${langName} for ${displayName}, who has done ${totalToday} of ${dailyGoal} push-ups today.`,
    'Each quote must be ≤ 120 characters. Vary tone (sporty, funny, serious).',
    'Return ONLY a JSON object with these keys (no markdown, no commentary):',
    tierLines,
    'Example shape: {"general":["..."],"belowGoal":["..."],"nearGoal":["..."],"goalReached":["..."]}',
  ].join('\n');
}

function extractTieredQuotes(text: string): TieredQuotes | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;

  const result: TieredQuotes = {
    general: [],
    belowGoal: [],
    nearGoal: [],
    goalReached: [],
  };
  let hasAny = false;
  for (const tier of QUOTE_TIERS) {
    const raw = obj[tier];
    if (Array.isArray(raw)) {
      const cleaned = raw
        .map((q) => (typeof q === 'string' ? q : String(q ?? '')))
        .map((q) => q.trim())
        .filter((q) => q.length > 0);
      if (cleaned.length > 0) hasAny = true;
      result[tier] = cleaned;
    }
  }
  return hasAny ? result : null;
}

interface CachedTiered {
  uid: string;
  lang: string;
  generatedAt: string;
  tiers: TieredQuotes;
  /** Flat array kept for legacy clients that only read `quotes`. */
  quotes: string[];
  totalToday: number;
  dailyGoal: number;
}

export const generateMotivationQuotes = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }

    const uid = request.auth.uid;
    const language = normalizeReminderLocale(request.data?.language);
    const totalToday = Number(request.data?.totalToday ?? 0);
    const dailyGoal = Number(request.data?.dailyGoal ?? 100);
    const rawName = String(request.data?.displayName || '').trim();
    const displayName =
      rawName
        .replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF .,'!?-]/g, '')
        .slice(0, 50)
        .trim() || 'Champ';

    const cacheRef = db
      .collection('motivationQuotes')
      .doc(`${uid}__${language}`);
    const cacheSnap = await cacheRef.get();
    if (cacheSnap.exists) {
      const cached = (cacheSnap.data() ?? {}) as {
        generatedAt?: string;
        tiers?: TieredQuotes;
        quotes?: ReadonlyArray<unknown>;
      };
      const generatedAt = cached.generatedAt
        ? new Date(cached.generatedAt)
        : null;
      if (generatedAt) {
        const ageHours =
          (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
        if (ageHours < QUOTE_CACHE_HOURS) {
          // Prefer the tiered shape; fall back to legacy flat `quotes`
          // so older cache docs keep working until the next refresh.
          if (cached.tiers) {
            return {
              quotes: flattenTiers(cached.tiers),
              tiers: cached.tiers,
            };
          }
          const flat = (cached.quotes ?? []).map((q) =>
            typeof q === 'string'
              ? q
              : typeof q === 'object' && q !== null && 'text' in q
                ? String((q as { text?: unknown }).text ?? '')
                : String(q ?? '')
          );
          return { quotes: flat };
        }
      }
    }

    let tiers: TieredQuotes = getFallbackTieredQuotes(language);

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash-lite',
      });

      const prompt = buildTieredPrompt(
        language,
        totalToday,
        dailyGoal,
        displayName
      );
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const parsed = extractTieredQuotes(text);
      if (parsed) tiers = parsed;
    } catch (err) {
      logger.warn(
        'generateMotivationQuotes: Gemini call failed, using fallback',
        { err }
      );
    }

    const flat = flattenTiers(tiers);
    const generatedAt = new Date().toISOString();
    const docPayload: CachedTiered = {
      uid,
      lang: language,
      tiers,
      quotes: flat,
      generatedAt,
      totalToday,
      dailyGoal,
    };
    await cacheRef.set(docPayload);

    return { quotes: flat, tiers };
  }
);

// ─── helpers ──────────────────────────────────────────────────────────────

async function deleteAllPushSubscriptions(uid: string) {
  const userRef = db.collection('pushSubscriptions').doc(uid);
  const subs = await userRef.collection('subs').listDocuments();
  const batch = db.batch();
  subs.forEach((doc) => batch.delete(doc));
  batch.delete(userRef);
  await batch.commit();
  logger.info('deleteAllPushSubscriptions: cleaned up', {
    uid,
    count: subs.length,
  });
}

// ─── savePushSubscription ──────────────────────────────────────────────────

export const savePushSubscription = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }

    const uid = request.auth.uid;
    const { endpoint, keys, userAgent, locale } = request.data ?? {};

    const validation = validateSubscriptionPayload(request.data);
    if (!validation.valid) {
      logger.warn('savePushSubscription: rejected', {
        uid,
        reason: validation.error,
      });
      throw new HttpsError(
        'invalid-argument',
        validation.error ?? 'subscription invalid'
      );
    }

    const subId = pushSubscriptionId(endpoint);

    const now = new Date().toISOString();
    const ref = db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .doc(subId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      tx.set(
        ref,
        {
          endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
          userAgent: userAgent || null,
          locale: locale || null,
          updatedAt: now,
          ...(snap.data()?.createdAt ? {} : { createdAt: now }),
        },
        { merge: true }
      );
    });

    const allSubs = await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .count()
      .get();
    const deviceCount = allSubs.data().count;

    logger.info('savePushSubscription: saved', { uid, subId, deviceCount });
    return { ok: true, subId, deviceCount };
  }
);

// ─── deletePushSubscription ────────────────────────────────────────────────

export const deletePushSubscription = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }

    const uid = request.auth.uid;
    const { endpoint } = request.data ?? {};

    if (!endpoint || typeof endpoint !== 'string') {
      throw new HttpsError('invalid-argument', 'endpoint fehlt.');
    }

    const subId = pushSubscriptionId(endpoint);

    await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .doc(subId)
      .delete();

    const remainingSubs = await db
      .collection('pushSubscriptions')
      .doc(uid)
      .collection('subs')
      .count()
      .get();
    const deviceCount = remainingSubs.data().count;

    logger.info('deletePushSubscription: removed', { uid, subId, deviceCount });
    return { ok: true, deviceCount };
  }
);

// ─── unsubscribeAllPushDevices ────────────────────────────────────────────
// Removes every push subscription registered against the caller's UID (across
// all devices). The caller stays signed in — this only wipes push records so
// no further Web Push notifications are delivered to any device.

async function handleUnsubscribeAllPushDevices(
  auth: { uid?: string } | undefined,
  callableName: string
): Promise<{ ok: true }> {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
  }
  const uid = auth.uid;
  await deleteAllPushSubscriptions(uid);
  logger.info(`${callableName}: cleaned up`, { uid });
  return { ok: true };
}

export const unsubscribeAllPushDevices = onCall(
  { region: 'europe-west3' },
  (request) =>
    handleUnsubscribeAllPushDevices(request.auth, 'unsubscribeAllPushDevices')
);

// ─── revokeAllSessions (deprecated alias) ─────────────────────────────────
// Earlier versions of this callable also called `auth().revokeRefreshTokens`,
// which logged the user out of every device. That behavior was wrong for the
// reminder-page action (users just wanted to drop push subs). The callable is
// kept here purely as a backwards-compatible alias for clients that still
// have the old handler name bundled (cached browser builds pre-refactor); it
// now performs the same safe push-only cleanup as `unsubscribeAllPushDevices`
// and no longer revokes tokens. Can be removed once those clients are gone.

export const revokeAllSessions = onCall({ region: 'europe-west3' }, (request) =>
  handleUnsubscribeAllPushDevices(request.auth, 'revokeAllSessions')
);

// ─── Web Push Reminder Dispatch ───────────────────────────────────────────────

const VAPID_PRIVATE_KEY = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = defineSecret('VAPID_PUBLIC_KEY');

/**
 * Reads the cached motivation pool a user has for `lang` and returns a
 * flat list of quote strings. Tolerant of legacy doc shapes (flat
 * `quotes: string[]` / `quotes: {text}[]`) and the new tiered shape.
 * Returns an empty array on any error so the caller falls back to the
 * built-in localised messages.
 */
async function loadMotivationPool(
  uid: string,
  lang: string
): Promise<string[]> {
  try {
    const snap = await db
      .collection('motivationQuotes')
      .doc(`${uid}__${lang}`)
      .get();
    if (!snap.exists) return [];
    const data = snap.data() as
      | {
          tiers?: TieredQuotes;
          quotes?: ReadonlyArray<unknown>;
        }
      | undefined;
    if (!data) return [];
    if (data.tiers) return flattenTiers(data.tiers);
    if (Array.isArray(data.quotes)) {
      return data.quotes
        .map((q) =>
          typeof q === 'string'
            ? q
            : typeof q === 'object' && q !== null && 'text' in q
              ? String((q as { text?: unknown }).text ?? '')
              : String(q ?? '')
        )
        .filter((q) => q.trim().length > 0);
    }
    return [];
  } catch (err) {
    // Defensive against non-Error throws (string, null, etc.) — we don't
    // want the logger itself to throw and surface as an unhandled
    // rejection in the dispatch loop.
    logger.warn('loadMotivationPool: failed', {
      uid,
      lang,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export const dispatchPushReminders = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: TZ,
    region: 'europe-west3',
    secrets: [VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY],
  },
  async () => {
    const vapidPrivate = VAPID_PRIVATE_KEY.value().trim();
    const vapidPublic = VAPID_PUBLIC_KEY.value().trim();

    if (!vapidPrivate || !vapidPublic) {
      logger.warn('dispatchPushReminders: VAPID secrets not set, skipping');
      return;
    }

    webpush.setVapidDetails(
      'mailto:einstein-openclaw@gmail.com',
      vapidPublic,
      vapidPrivate
    );

    const nowMs = Date.now();

    const subsSnap = await db.collection('pushSubscriptions').listDocuments();
    logger.info('dispatchPushReminders: checking users', {
      count: subsSnap.length,
    });

    const results = { sent: 0, skipped: 0, errors: 0, expired: 0 };

    for (const userRef of subsSnap) {
      const uid = userRef.id;

      try {
        const userConfigSnap = await db
          .collection('userConfigs')
          .doc(uid)
          .get();
        const userConfigData = userConfigSnap.data() ?? {};
        const reminder = userConfigData.reminder as ReminderConfig | undefined;
        // Prefer the explicit top-level `locale` written by recent clients.
        // Fall back to the legacy `reminder.language` field on docs created
        // before that field migrated up — without this, a user who set
        // English reminders and never re-saved settings would silently
        // start receiving German push body / actions / URLs after deploy.
        // Final fallback (`undefined`) lands on the default locale via
        // `normalizeReminderLocale`.
        const legacyLanguage = (reminder as { language?: unknown } | undefined)
          ?.language;
        const userLocale = normalizeReminderLocale(
          userConfigData.locale ?? legacyLanguage
        );

        const dispatchRef = db.collection('reminderDispatchState').doc(uid);
        let leaseAcquired = false;

        await db.runTransaction(async (tx) => {
          const dispatchSnap = await tx.get(dispatchRef);
          const lastSentAt = dispatchSnap.data()?.lastSentAt || null;
          const snoozedUntil = dispatchSnap.data()?.snoozedUntil || null;
          const alreadyInProgress = dispatchSnap.data()?.inProgress === true;

          if (alreadyInProgress) {
            const leaseAcquiredAt =
              dispatchSnap.data()?.leaseAcquiredAt ?? null;
            if (!isLeaseStale(leaseAcquiredAt, nowMs)) {
              return; // Lease is fresh — another invocation is actively sending
            }
            logger.warn(
              'dispatchPushReminders: stale lease detected, resetting',
              {
                uid,
                staleLimitMinutes: STALE_LEASE_MS / 60_000,
              }
            );
            // Clear the stale lease so it doesn't repeat the warning every tick
            // even when shouldSendReminder returns false (quiet hours, etc.)
            tx.set(
              dispatchRef,
              {
                inProgress: false,
                leaseAcquiredAt: admin.firestore.FieldValue.delete(),
              },
              { merge: true }
            );
          }
          if (!shouldSendReminder(reminder, lastSentAt, nowMs, snoozedUntil))
            return;

          tx.set(
            dispatchRef,
            {
              uid,
              inProgress: true,
              leaseAcquiredAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          leaseAcquired = true;
        });

        if (!leaseAcquired) {
          results.skipped++;
          continue;
        }

        let sentToUser = false;
        try {
          const subsCol = await userRef.collection('subs').get();
          if (subsCol.empty) {
            results.skipped++;
            continue;
          }

          // Pull the body from the user's pre-generated motivation pool —
          // that pool is locale-aware (`generateMotivationQuotes` writes
          // `motivationQuotes/{uid}__{lang}`) and the Gemini cost is
          // already paid when the user opens the dashboard, so we get
          // fresh, personalised quotes on push without spending any new
          // tokens. Fallback to the per-locale built-in list if the cache
          // is empty (user hasn't opened the app yet today).
          const pool = await loadMotivationPool(uid, userLocale);
          const body = buildNotificationPayload(userLocale, pool);
          // Single source of truth: sanitize once, then use the same value for
          // both the action title and the data payload. Computing them
          // independently caused the title to clamp to 500 while the payload
          // shipped the raw (potentially absurd) Firestore value, so the SW
          // logged a different count than the user saw on the button.
          const quickLogReps = sanitizeQuickLogReps(reminder?.quickLogReps);
          const actions = buildReminderActions(userLocale, quickLogReps);
          const payload = JSON.stringify({
            title: 'PushUp Stats',
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            tag: 'reminder',
            renotify: true,
            data: {
              url: `/${userLocale}/app`,
              locale: userLocale,
              ...(quickLogReps ? { quickLogReps } : {}),
            },
            actions,
          });

          const expiredSubs: FirebaseFirestore.DocumentReference[] = [];

          for (const subDoc of subsCol.docs) {
            const { endpoint, keys } = subDoc.data();
            if (!endpoint || !keys?.p256dh || !keys?.auth) continue;

            const pushSub = {
              endpoint,
              keys: { p256dh: keys.p256dh, auth: keys.auth },
            };

            try {
              await webpush.sendNotification(
                pushSub,
                payload,
                PUSH_SEND_OPTIONS
              );
              sentToUser = true;
            } catch (err: unknown) {
              const pushErr = err as {
                statusCode?: number;
                code?: string;
                message?: string;
              };
              if (isExpiredSubscriptionError(pushErr, endpoint)) {
                expiredSubs.push(subDoc.ref);
                results.expired++;
              } else {
                // Log message+code alongside status so the next unknown
                // failure mode (e.g. the zombie `.invalid` endpoints that
                // silently DNS-failed for weeks) is diagnosable in one
                // dispatch cycle instead of needing a separate investigation.
                logger.warn('dispatchPushReminders: send failed', {
                  uid,
                  endpoint: endpoint.slice(-20),
                  status: pushErr.statusCode,
                  code: pushErr.code,
                  message: pushErr.message,
                });
                results.errors++;
              }
            }
          }

          if (expiredSubs.length > 0) {
            const batch = db.batch();
            expiredSubs.forEach((ref) => batch.delete(ref));
            await batch.commit();
          }

          if (sentToUser) {
            results.sent++;
          }
        } finally {
          // Release lease and update lastSentAt atomically so a failed
          // lastSentAt write can't leave the lease open for duplicate sends.
          const releaseData: Record<string, unknown> = {
            inProgress: false,
            leaseAcquiredAt: admin.firestore.FieldValue.delete(),
          };
          if (sentToUser) {
            releaseData['lastSentAt'] =
              admin.firestore.FieldValue.serverTimestamp();
          }
          await dispatchRef
            .set(releaseData, { merge: true })
            .catch((e: Error) =>
              logger.warn('dispatchPushReminders: failed to release lease', {
                uid,
                err: e.message,
              })
            );
        }
      } catch (err: unknown) {
        const error = err as Error;
        logger.error('dispatchPushReminders: error for user', {
          uid,
          err: error.message,
        });
        results.errors++;
      }
    }

    logger.info('dispatchPushReminders: done', results);
  }
);

// ─── snoozeReminder ────────────────────────────────────────────────────────

export const snoozeReminder = onCall(
  { region: 'europe-west3' },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', 'Auth required.');

    const uid = request.auth.uid;
    const snoozeMinutes = request.data?.snoozeMinutes ?? 30;

    if (
      typeof snoozeMinutes !== 'number' ||
      snoozeMinutes < 1 ||
      snoozeMinutes > 1440
    ) {
      throw new HttpsError('invalid-argument', 'snoozeMinutes must be 1–1440.');
    }

    const snoozeMs = snoozeMinutes * 60 * 1000;
    const snoozeUntil = admin.firestore.Timestamp.fromMillis(
      Date.now() + snoozeMs
    );

    const dispatchRef = db.collection('reminderDispatchState').doc(uid);
    await dispatchRef.set(
      {
        snoozedUntil: snoozeUntil,
        uid,
        snoozedAt: admin.firestore.FieldValue.serverTimestamp(),
        snoozeMinutes,
        inProgress: false,
      },
      { merge: true }
    );

    logger.info('snoozeReminder', { uid, snoozeMinutes });
    return { ok: true, snoozeUntil: snoozeUntil.toDate().toISOString() };
  }
);

// ─── updateUserStatsOnPushupWrite ─────────────────────────────────────────────
// Delta-based user statistics: atomically updates userStats/{userId} on every
// pushup create/update/delete.

export const updateUserStatsOnPushupWrite = onDocumentWritten(
  {
    document: 'pushups/{pushupId}',
    region: 'europe-west3',
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    const userId = (afterData?.userId ?? beforeData?.userId) as
      | string
      | undefined;
    if (!userId) {
      logger.warn('updateUserStatsOnPushupWrite: no userId found, skipping');
      return;
    }

    const oldReps = (beforeData?.reps ?? 0) as number;
    const newReps = (afterData?.reps ?? 0) as number;
    const oldTimestamp = beforeData?.timestamp as string | undefined;
    const newTimestamp = afterData?.timestamp as string | undefined;
    const oldSets = Array.isArray(beforeData?.sets)
      ? (beforeData.sets as number[])
      : [];
    const newSets = Array.isArray(afterData?.sets)
      ? (afterData.sets as number[])
      : [];

    const isCreate = !beforeData && !!afterData;
    const isDelete = !!beforeData && !afterData;
    const isUpdate = !!beforeData && !!afterData;
    const timestampChanged =
      isUpdate && oldTimestamp && newTimestamp && oldTimestamp !== newTimestamp;

    if (!newTimestamp && !oldTimestamp) {
      logger.warn('updateUserStatsOnPushupWrite: no timestamp found, skipping');
      return;
    }

    const nowIso = new Date().toISOString();
    const statsRef = db.collection('userStats').doc(userId);

    // IMPORTANT: Check if this is the first entry (no userStats yet)
    // OR if version is outdated (calculation logic changed)
    // If so, we'll do a full rebuild to ensure correct initialization
    let firstEntryAllEntries: Array<{
      timestamp: string;
      reps: number;
      sets?: number[];
    }> | null = null;
    let versionOutdated = false;

    const statsSnap = await statsRef.get();
    const existingStats = statsSnap.exists
      ? (statsSnap.data() as UserStats)
      : null;

    // Check version: if stored version < current version, trigger rebuild
    if (
      existingStats &&
      (!existingStats.version || existingStats.version < USERSTATS_VERSION)
    ) {
      versionOutdated = true;
      logger.info('updateUserStatsOnPushupWrite: version upgrade detected', {
        userId,
        oldVersion: existingStats.version ?? 1,
        newVersion: USERSTATS_VERSION,
      });
    }

    // Collect entries for rebuild if needed
    if ((isCreate && !existingStats) || versionOutdated) {
      const allEntriesSnap = await db
        .collection('pushups')
        .where('userId', '==', userId)
        .orderBy('timestamp', 'asc')
        .get();

      firstEntryAllEntries = allEntriesSnap.docs.map((d) => {
        const data = d.data();
        return {
          timestamp: data.timestamp as string,
          reps: Number(data.reps ?? 0),
          ...(Array.isArray(data.sets) ? { sets: data.sets as number[] } : {}),
        };
      });
    }

    await db.runTransaction(async (tx) => {
      const statsSnap = await tx.get(statsRef);
      let current = statsSnap.exists ? (statsSnap.data() as UserStats) : null;

      // BUG FIX P1: Re-check version in transaction to avoid double-counting
      // The snapshot outside transaction may be stale; transaction sees latest state
      let shouldRebuild = false;
      if (firstEntryAllEntries !== null && isCreate && !current) {
        // First entry case: confirmed by transaction read
        shouldRebuild = true;
      } else if (
        firstEntryAllEntries !== null &&
        current &&
        (!current.version || current.version < USERSTATS_VERSION)
      ) {
        // Version upgrade case: confirmed by transaction read
        shouldRebuild = true;
      }

      if (shouldRebuild && firstEntryAllEntries) {
        // Full rebuild: ensures atomicity and prevents double-counting from concurrent triggers
        current = rebuildFromEntries(userId, firstEntryAllEntries, nowIso);
        const reason =
          isCreate && !statsSnap.exists ? 'first entry' : 'version upgrade';
        logger.info(
          'updateUserStatsOnPushupWrite: full rebuild (transaction-confirmed)',
          {
            userId,
            reason,
            entries: firstEntryAllEntries.length,
            newVersion: USERSTATS_VERSION,
          }
        );
      } else if (current) {
        // Existing userStats with current version: use delta for efficiency
        if (timestampChanged) {
          // Timestamp changed: undo old entry, then apply new entry
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

          if (timestamp) {
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
        }
      } else {
        // Missing userStats on a non-first-create write: rebuild from source of truth
        // Writing empty stats here would permanently wipe totals for update/delete events
        const userPushupsQuery = db
          .collection('pushups')
          .where('userId', '==', userId);
        const userPushupsSnap = await tx.get(userPushupsQuery);
        const userEntries = userPushupsSnap.docs.map((doc) =>
          doc.data()
        ) as Parameters<typeof rebuildFromEntries>[1];

        logger.warn(
          'updateUserStatsOnPushupWrite: missing userStats, rebuilding from entries',
          {
            userId,
            isCreate,
            entries: userEntries.length,
          }
        );
        current = rebuildFromEntries(userId, userEntries, nowIso);
      }

      tx.set(statsRef, current);
    });

    logger.info('updateUserStatsOnPushupWrite', {
      userId,
      oldReps,
      newReps,
      timestampChanged,
      pushupId: event.params?.pushupId,
    });
  }
);

// ─── rebuildUserStats ─────────────────────────────────────────────────────────
// Admin-callable backfill: recomputes userStats/{userId} from all pushup entries.
// Accepts { userId?: string }. If userId is omitted, rebuilds for ALL users.

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

// ─── updateExerciseStatsOnEntryWrite ──────────────────────────────────────────
// Phase-0 of the multi-exercise migration. Mirrors
// `updateUserStatsOnPushupWrite` but for entries written to the new
// `exerciseEntries` collection. Aggregates land in
// `userStats/{userId}/perExercise/{exerciseId}` so the existing
// `userStats/{userId}` doc — which still serves the Pushup dashboard —
// stays untouched.
//
// We deliberately reuse `applyDelta`/`rebuildFromEntries` from
// `user-stats-delta.ts` to avoid forking the streak/heatmap logic. The
// per-exercise doc carries the same UserStats shape; downstream consumers
// can decide which fields to surface (heatmap and sets are over-spec
// for a Phase-0 sit-ups counter but cost nothing).

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

    // Staged-migration guard: the pushup→exerciseEntries copies carry
    // `exerciseId:'pushup'` and must NOT create a `perExercise/pushup`
    // aggregate before the Phase-7 cutover (the Pushup dashboard is still
    // served by `userStats/{userId}` off the legacy `pushups` collection).
    // `exerciseId` is already resolved from after-or-before above, so this
    // covers create, update and delete. Removing this guard at cutover
    // re-enables aggregation.
    if (!shouldAggregateExerciseEntry(exerciseId)) return;

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

// ─── Pushup unification (staged, reversible) ──────────────────────────────────
//
// Admin-only one-shot copy of `pushups/*` → `exerciseEntries/*` with
// `exerciseId:'pushup'`. STAGED: no write-path flip, no legacy deletion —
// the dashboard keeps reading `pushups`. The trigger guards above keep the
// copies out of per-exercise stats + leaderboards until Phase-7 cutover.
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
