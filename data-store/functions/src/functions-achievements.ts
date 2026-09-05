import type { EarnedAchievement, TrainingPlan } from '@pu-stats/models';
import { TRAINING_PLANS } from '@pu-stats/models';
import { logger } from 'firebase-functions';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';

import {
  EMPTY_PROGRESS,
  advanceProgress,
  newlyEarned,
  type AchievementProgress,
} from './achievements/logic';
import { db } from './firebase-app';

const COLLECTION = 'userAchievements';

function findPlan(planId: string): Pick<TrainingPlan, 'days'> | null {
  return TRAINING_PLANS.find((p) => p.id === planId) ?? null;
}

function readProgress(data: FirebaseFirestore.DocumentData | undefined): {
  progress: AchievementProgress;
  earned: EarnedAchievement[];
} {
  if (!data) return { progress: EMPTY_PROGRESS, earned: [] };
  return {
    progress: {
      planDayTotal: Number(data['planDayTotal'] ?? 0),
      currentPlanId: (data['currentPlanId'] as string | null) ?? null,
      currentPlanDays: Number(data['currentPlanDays'] ?? 0),
      completedPlanIds:
        (data['completedPlanIds'] as string[] | undefined) ?? [],
    },
    earned: (data['earned'] as EarnedAchievement[] | undefined) ?? [],
  };
}

/**
 * Awards achievements when a user's training-plan progress changes.
 *
 * Server-side on purpose: achievements are shown on the public profile,
 * and `userAchievements` is `allow write: if false`, so a client cannot
 * mint its own badges. The user still controls the underlying plan
 * document — exactly the same trust model as `currentStreak`, which is
 * likewise derived server-side from user-written entries.
 *
 * The whole document is rewritten inside a transaction rather than
 * merged: the trigger is its sole writer, and `setDoc({merge:true})`
 * clobbers nested maps (see docs/gotchas/firestore.md).
 */
export const awardAchievementsOnPlanWrite = onDocumentWritten(
  {
    document: 'userTrainingPlans/{userId}',
    region: 'europe-west3',
  },
  async (event) => {
    const after = event.data?.after?.data();
    const userId = event.params['userId'];
    if (!after || !userId) return;

    const planId = after['planId'] as string | undefined;
    if (!planId) {
      logger.warn('awardAchievementsOnPlanWrite: no planId, skipping', {
        userId,
      });
      return;
    }

    const snapshot = {
      planId,
      completedDays: (after['completedDays'] as number[] | undefined) ?? [],
      skippedDays: (after['skippedDays'] as number[] | undefined) ?? [],
    };

    const ref = db.collection(COLLECTION).doc(userId);
    const awarded = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      const { progress, earned } = readProgress(doc.data());
      const next = advanceProgress(progress, snapshot, findPlan(planId));
      const additions = newlyEarned(
        next,
        earned.map((e) => e.id)
      );

      const awardedAt = new Date().toISOString();
      const allEarned: EarnedAchievement[] = [
        ...earned,
        ...additions.map((id) => ({ id, awardedAt })),
      ];

      tx.set(ref, {
        userId,
        planDayTotal: next.planDayTotal,
        currentPlanId: next.currentPlanId,
        currentPlanDays: next.currentPlanDays,
        completedPlanIds: next.completedPlanIds,
        earned: allEarned,
        updatedAt: awardedAt,
      });
      return additions;
    });

    if (awarded.length > 0) {
      logger.info('awardAchievementsOnPlanWrite: awarded', {
        userId,
        achievements: awarded,
      });
    }
  }
);
