import { Injectable, inject } from '@angular/core';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';
import { UserStats } from '@pu-stats/models';
import { from, map, Observable } from 'rxjs';

const USER_STATS_COLLECTION = 'userStats';

@Injectable({ providedIn: 'root' })
export class UserStatsApiService {
  private readonly firestore = inject(Firestore);

  /**
   * Fetch precomputed user statistics from `userStats/{userId}`.
   * Returns null if the document does not exist yet (no backfill run).
   */
  getUserStats(userId: string): Observable<UserStats | null> {
    const docRef = doc(this.firestore, USER_STATS_COLLECTION, userId);
    return from(getDoc(docRef)).pipe(
      map((snap) => (snap.exists() ? (snap.data() as UserStats) : null))
    );
  }
}
