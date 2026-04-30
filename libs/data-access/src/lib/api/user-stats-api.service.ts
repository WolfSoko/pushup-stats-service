import { Injectable, inject } from '@angular/core';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import { UserStats } from '@pu-stats/models';
import { map, Observable } from 'rxjs';

const USER_STATS_COLLECTION = 'userStats';

@Injectable({ providedIn: 'root' })
export class UserStatsApiService {
  private readonly firestore = inject(Firestore);

  /**
   * Subscribe to precomputed user statistics at `userStats/{userId}`.
   * Emits null while the document is missing (no backfill run yet) and
   * re-emits whenever the Cloud Function aggregator rewrites the doc, so the
   * dashboard updates without a manual reload.
   */
  getUserStats(userId: string): Observable<UserStats | null> {
    const docRef = doc(this.firestore, USER_STATS_COLLECTION, userId);
    return docData(docRef).pipe(
      map((data) => (data ? (data as UserStats) : null))
    );
  }
}
