import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import type { EarnedAchievement } from '@pu-stats/models';
import { map, Observable, of } from 'rxjs';

const COLLECTION = 'userAchievements';

interface UserAchievementsDoc {
  earned?: EarnedAchievement[];
}

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
    const uid = this.auth?.currentUser?.uid ?? userId;
    if (!this.firestore || !uid) return of([]);
    const ref = doc(this.firestore, `${COLLECTION}/${uid}`);
    return docData(ref).pipe(
      map((data) => (data as UserAchievementsDoc | undefined)?.earned ?? [])
    );
  }
}
