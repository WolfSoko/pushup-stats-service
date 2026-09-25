import type { EarnedAchievement, UserXp } from '@pu-stats/models';
import type { Firestore } from 'firebase-admin/firestore';

import { notifyAchievementsAwarded } from '../achievements/notify';
import { newXpBadges } from './badges';

/**
 * Appends the level/variety badges `xp` newly entitles the user to.
 * The rest of `userAchievements/{uid}` (plan progress, other badges) is
 * carried over untouched: the doc is rewritten whole, never merged,
 * because `set({merge:true})` clobbers nested maps.
 */
export async function awardXpBadges(
  db: Firestore,
  userId: string,
  xp: Pick<UserXp, 'total' | 'byExercise'>,
  opts: { notify: boolean }
): Promise<string[]> {
  const ref = db.collection('userAchievements').doc(userId);
  const awarded = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const earned = (data['earned'] as EarnedAchievement[] | undefined) ?? [];
    const additions = newXpBadges(xp, earned);
    if (additions.length === 0) return [];
    const awardedAt = new Date().toISOString();
    tx.set(ref, {
      ...data,
      userId,
      earned: [...earned, ...additions.map((id) => ({ id, awardedAt }))],
      updatedAt: awardedAt,
    });
    return additions;
  });

  if (opts.notify && awarded.length > 0) {
    await notifyAchievementsAwarded(userId, awarded);
  }
  return awarded;
}
