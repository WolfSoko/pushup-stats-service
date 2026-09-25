import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import {
  findExerciseDefinition,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  type Friendship,
  type ProfileVisibilityUi,
} from '@pu-stats/models';

import { berlinDateParts } from './datetime';
import { db } from './firebase-app';
import {
  acceptedFriendUids,
  isFriendsBoardMetric,
  isFriendsLeaderboardPeriod,
  periodStartIso,
  rankFriends,
  xpStatsOf,
  type FriendStatsRow,
} from './friends';
import { readCheersToday } from './friends/cheers-read';
import { readTrainingDays } from './friends/training-days-read';
import { periodKeys } from './user-stats-delta';

/**
 * The friends board for one metric and period: training days (the
 * default — fair whatever everyone's favourite exercise is), the live
 * streak, one exercise's reps, or XP across all exercises.
 *
 * Not served from the public leaderboard snapshot: that one is a top-N
 * list, and friends are an arbitrary set of at most `MAX_FRIENDS` users
 * who will mostly not be in it. Their values come from the aggregates,
 * one `getAll` per collection; only training days within a week or
 * month are counted from the entries.
 */
export const getFriendsLeaderboard = onCall(
  { region: 'europe-west3', timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Nicht angemeldet.');
    }
    const uid = request.auth.uid;

    const exerciseId =
      typeof request.data?.exerciseId === 'string' &&
      findExerciseDefinition(request.data.exerciseId)
        ? (request.data.exerciseId as string)
        : PUSHUP_QUICK_ADD_EXERCISE_ID;
    const period = isFriendsLeaderboardPeriod(request.data?.period)
      ? request.data.period
      : 'week';
    const metric = isFriendsBoardMetric(request.data?.metric)
      ? request.data.metric
      : 'days';

    const friendsSnap = await db
      .collection('friendships')
      .where('users', 'array-contains', uid)
      .get();
    const friendUids = acceptedFriendUids(
      friendsSnap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Friendship),
      })),
      uid
    );

    const uids = [uid, ...friendUids];
    const today = berlinDateParts();
    const statsDoc = (id: string) => {
      if (metric === 'xp') return db.collection('userXp').doc(id);
      const root = db.collection('userStats').doc(id);
      return metric === 'reps'
        ? root.collection('perExercise').doc(exerciseId)
        : root;
    };
    const countDays =
      metric === 'days' && (period === 'week' || period === 'month');
    const [configs, stats, days] = await Promise.all([
      db.getAll(...uids.map((id) => db.collection('userConfigs').doc(id))),
      db.getAll(...uids.map(statsDoc)),
      countDays
        ? readTrainingDays(
            uids,
            periodStartIso(period, today.isoDate),
            today.isoDate
          )
        : new Map<string, number>(),
    ]);

    const rows: FriendStatsRow[] = uids.map((id, index) => {
      const config = configs[index]?.data();
      return {
        uid: id,
        displayName: String(config?.['displayName'] ?? '').trim() || null,
        stats:
          metric === 'xp'
            ? xpStatsOf(stats[index]?.data())
            : (stats[index]?.data() ?? null),
        days: days.get(id),
        ui: config?.['ui'] as ProfileVisibilityUi | undefined,
        isViewer: id === uid,
      };
    });

    const cheers = await readCheersToday(uid, uids, today.isoDate);
    const entries = rankFriends(
      rows,
      period,
      periodKeys(today),
      cheers,
      metric
    );
    logger.info('getFriendsLeaderboard', {
      uid,
      metric,
      exerciseId,
      period,
      friends: friendUids.length,
      shown: entries.length,
    });
    return { metric, exerciseId, period, entries };
  }
);
