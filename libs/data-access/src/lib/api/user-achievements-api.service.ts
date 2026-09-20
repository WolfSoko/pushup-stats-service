import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import type { EarnedAchievement } from '@pu-stats/models';
import { map, Observable, of } from 'rxjs';

const COLLECTION = 'userAchievements';

interface UserAchievementsDoc {
  earned?: EarnedAchievement[];
  planDayTotal?: number;
  completedPlanIds?: string[];
}

/**
 * Everything the badge collection needs: what was earned, and how far
 * along the counters that unlock the rest are.
 */
export interface UserAchievementsProgress {
  readonly earned: ReadonlyArray<EarnedAchievement>;
  readonly planDayTotal: number;
  readonly completedPlanIds: ReadonlyArray<string>;
}

const EMPTY: UserAchievementsProgress = {
  earned: [],
  planDayTotal: 0,
  completedPlanIds: [],
};

/**
 * Read-only view of `userAchievements/{uid}`.
 *
 * Read-only by design, not by omission: the document is written solely
 * by the `awardAchievementsOnPlanWrite` trigger and Firestore rules deny
 * client writes (`allow write: if false`). Badges appear on a public
 * profile, so a write method here would be a foot-gun with no valid use.
 *
 * Mirrors `UserTrainingPlanApiService`: prefer `auth.currentUser.uid`
 * over the argument so a forged id cannot redirect the read, and fall
 * back to the argument when auth is unavailable (SSR, tests).
 */
@Injectable({ providedIn: 'root' })
export class UserAchievementsApiService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });

  watchEarned(userId: string): Observable<ReadonlyArray<EarnedAchievement>> {
    return this.watchProgress(userId).pipe(map((p) => p.earned));
  }

  watchProgress(userId: string): Observable<UserAchievementsProgress> {
    const uid = this.auth?.currentUser?.uid ?? userId;
    if (!this.firestore || !uid) return of(EMPTY);
    const ref = doc(this.firestore, `${COLLECTION}/${uid}`);
    return docData(ref).pipe(
      map((raw) => {
        const data = raw as UserAchievementsDoc | undefined;
        return {
          earned: data?.earned ?? [],
          planDayTotal: data?.planDayTotal ?? 0,
          completedPlanIds: data?.completedPlanIds ?? [],
        };
      })
    );
  }
}
