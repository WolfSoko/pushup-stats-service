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
  isFriendsLeaderboardPeriod,
  rankFriends,
  type FriendStatsRow,
} from './friends';
import { periodKeys } from './user-stats-delta';

/**
 * The friends board for one exercise and period.
 *
 * Not served from the public leaderboard snapshot: that one is a top-N
 * list, and friends are an arbitrary set of at most `MAX_FRIENDS` users
 * who will mostly not be in it. Their values come from the per-exercise
 * aggregates, one `getAll` per collection.
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
    const [configs, stats] = await Promise.all([
      db.getAll(...uids.map((id) => db.collection('userConfigs').doc(id))),
      db.getAll(
        ...uids.map((id) =>
          db
            .collection('userStats')
            .doc(id)
            .collection('perExercise')
            .doc(exerciseId)
        )
      ),
    ]);

    const rows: FriendStatsRow[] = uids.map((id, index) => {
      const config = configs[index]?.data();
      return {
        uid: id,
        displayName: String(config?.['displayName'] ?? '').trim() || null,
        stats: stats[index]?.data() ?? null,
        ui: config?.['ui'] as ProfileVisibilityUi | undefined,
        isViewer: id === uid,
      };
    });

    const entries = rankFriends(rows, period, periodKeys(berlinDateParts()));
    logger.info('getFriendsLeaderboard', {
      uid,
      exerciseId,
      period,
      friends: friendUids.length,
      shown: entries.length,
    });
    return { exerciseId, period, entries };
  }
);
