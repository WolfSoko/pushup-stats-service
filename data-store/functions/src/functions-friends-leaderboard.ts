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
  rankFriends,
  trainingRowOf,
  xpStatsOf,
  type FriendStatsRow,
} from './friends';
import { readCheersToday } from './friends/cheers-read';
import { readTrainingStats } from './training/stats-read';
import { periodKeys } from './user-stats-delta';

/**
 * The friends board for one metric and period: training days (the
 * default — fair whatever everyone's favourite exercise is), the live
 * streak, one exercise's reps, or XP across all exercises.
 *
 * Not served from the public leaderboard snapshot: that one is a top-N
 * list, and friends are an arbitrary set of at most `MAX_FRIENDS` users
 * who will mostly not be in it. Their values come from the aggregates:
 * days and streak from the cross-exercise training aggregate, reps and
 * XP with one `getAll` each.
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
    const configsRead = db.getAll(
      ...uids.map((id) => db.collection('userConfigs').doc(id))
    );
    const statsRead: Promise<
      ReadonlyArray<Pick<FriendStatsRow, 'stats' | 'days'>>
    > =
      metric === 'days' || metric === 'streak'
        ? Promise.all(
            uids.map(async (id) =>
              trainingRowOf(
                await readTrainingStats(db, id),
                period,
                today.isoDate
              )
            )
          )
        : db
            .getAll(
              ...uids.map((id) =>
                metric === 'xp'
                  ? db.collection('userXp').doc(id)
                  : db
                      .collection('userStats')
                      .doc(id)
                      .collection('perExercise')
                      .doc(exerciseId)
              )
            )
            .then((snaps) =>
              snaps.map((snap) => ({
                stats:
                  metric === 'xp'
                    ? xpStatsOf(snap.data())
                    : (snap.data() ?? null),
              }))
            );
    const [configs, stats] = await Promise.all([configsRead, statsRead]);

    const rows: FriendStatsRow[] = uids.map((id, index) => {
      const config = configs[index]?.data();
      return {
        uid: id,
        displayName: String(config?.['displayName'] ?? '').trim() || null,
        ...stats[index],
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
