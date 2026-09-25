import type { AchievementId } from '@pu-stats/models';

import { writeNotification } from '../notifications';

/**
 * Files one inbox entry per newly earned badge. Called outside the award
 * transaction: a retry would otherwise re-file every entry.
 */
export async function notifyAchievementsAwarded(
  userId: string,
  achievementIds: ReadonlyArray<AchievementId>
): Promise<void> {
  const createdAt = new Date().toISOString();
  await Promise.all(
    achievementIds.map((achievementId) =>
      writeNotification(
        userId,
        { type: 'achievement', achievementId },
        {
          type: 'achievement',
          createdAt,
          readAt: null,
          actorUid: null,
          actorName: null,
          url: '/abzeichen',
          payload: { achievementId },
        }
      )
    )
  );
}
