import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

import { berlinDateParts } from '../datetime';
import {
  type ExerciseEntryRow,
  type ExerciseLeaderboardEntry,
  getExerciseLeaderboardQueryStartDate,
  rankExerciseAllTime,
  rankExerciseEntries,
} from '../exercise-leaderboard/logic';
import { DEMO_USER_ID, TZ } from '../firebase-app';
import type { UserProfile } from '../profile';

/**
 * Per-user, per-Berlin-day XP ceiling for the windowed boards — the XP
 * counterpart of the per-exercise caps. Roughly 2000 pushups or a long
 * cycling day; anything above is truncated, not rejected.
 */
export const XP_DAILY_CAP = 5000;

export const XP_LEADERBOARD_DOC = 'leaderboards/xp';

/**
 * Rebuilds `leaderboards/xp`. Windowed periods come from the ledger (the
 * frozen per-entry XP), all-time from the `userXp` totals. Like the
 * exercise boards, the write-driven path carries the previous all-time
 * ranking forward and leaves its refresh to the schedule.
 */
export async function rebuildXpLeaderboardCore(
  db: Firestore,
  opts: { includeAllTime: boolean }
): Promise<void> {
  const today = berlinDateParts(new Date());
  const queryStart = getExerciseLeaderboardQueryStartDate(today);

  const ledgerSnap = await db
    .collectionGroup('xpLedger')
    .where('timestamp', '>=', queryStart)
    .get();
  const rows: ExerciseEntryRow[] = ledgerSnap.docs
    .map((d) => d.data())
    .filter((d) => d['userId'] !== DEMO_USER_ID)
    .map((d) => ({
      userId: d['userId'] as string,
      timestamp: d['timestamp'] as string,
      reps: Number(d['xp'] ?? 0),
    }));

  let allTimeRows: { userId: string; total: number }[] = [];
  let carryForward: ExerciseLeaderboardEntry[] = [];
  if (opts.includeAllTime) {
    const totals = await db.collection('userXp').select('total').get();
    allTimeRows = totals.docs
      .filter((d) => d.id !== DEMO_USER_ID)
      .map((d) => ({ userId: d.id, total: Number(d.get('total') ?? 0) }));
  } else {
    const existing = await db.doc(XP_LEADERBOARD_DOC).get();
    const allTime = existing.get('periods.allTime');
    carryForward = Array.isArray(allTime) ? allTime : [];
  }

  const userIds = [
    ...new Set([
      ...rows.map((r) => r.userId as string),
      ...allTimeRows.map((r) => r.userId),
    ]),
  ].filter(Boolean);
  const profiles = new Map<string, UserProfile>();
  if (userIds.length > 0) {
    const snaps = await db.getAll(
      ...userIds.map((uid) => db.collection('userConfigs').doc(uid))
    );
    for (const snap of snaps) {
      profiles.set(snap.id, (snap.data() as UserProfile | undefined) ?? {});
    }
  }

  const todayKey = today.isoDate;
  const rank = (period: 'daily' | 'last7' | 'last30') =>
    rankExerciseEntries(rows, 'reps', period, todayKey, profiles, XP_DAILY_CAP);

  await db.doc(XP_LEADERBOARD_DOC).set({
    updatedAt: FieldValue.serverTimestamp(),
    timezone: TZ,
    keys: {
      daily: todayKey,
      last7: todayKey,
      last30: todayKey,
      allTime: todayKey,
    },
    periods: {
      daily: rank('daily'),
      last7: rank('last7'),
      last30: rank('last30'),
      allTime: opts.includeAllTime
        ? rankExerciseAllTime(allTimeRows, profiles)
        : carryForward,
    },
  });

  logger.info('XP leaderboard rebuilt', {
    ledgerRows: rows.length,
    allTimeRows: allTimeRows.length,
    includeAllTime: opts.includeAllTime,
  });
}
