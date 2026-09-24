import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  query,
  setDoc,
  where,
} from '@angular/fire/firestore';
import {
  normalizeWorkoutReminder,
  workoutReminderDocument,
  type WorkoutReminder,
  type WorkoutReminderInput,
} from '@pu-stats/models';
import { map, Observable, of } from 'rxjs';
import { PendingRequestsService } from '../pending-requests.service';

const COLLECTION = 'workoutReminders';

/**
 * Session reminders at `workoutReminders/{workoutId}`. A save replaces the
 * whole document with `nextAt` resolved from now, which is what makes the
 * dispatcher's query pick it up at the right tick.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutRemindersApiService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });
  private readonly pending = inject(PendingRequestsService);

  listReminders(userId: string): Observable<ReadonlyArray<WorkoutReminder>> {
    const uid = this.resolveUserId(userId);
    if (!uid || !this.firestore) return of([]);
    const q = query(
      collection(this.firestore, COLLECTION),
      where('ownerId', '==', uid)
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((docs) =>
        docs
          .map((data) => {
            const { id, ...rest } = data as { id: string };
            return normalizeWorkoutReminder(id, rest);
          })
          .filter((r): r is WorkoutReminder => r !== null)
      )
    );
  }

  async saveReminder(
    userId: string,
    workoutId: string,
    input: WorkoutReminderInput
  ): Promise<void> {
    const uid = this.resolveUserId(userId);
    if (!uid || !this.firestore || !workoutId) return;
    const payload = workoutReminderDocument(uid, workoutId, input, new Date());
    await this.pending.track(
      setDoc(doc(this.firestore, COLLECTION, workoutId), payload)
    );
  }

  async deleteReminder(userId: string, workoutId: string): Promise<void> {
    const uid = this.resolveUserId(userId);
    if (!uid || !this.firestore || !workoutId) return;
    await this.pending.track(
      deleteDoc(doc(this.firestore, COLLECTION, workoutId))
    );
  }

  private resolveUserId(fallbackUserId: string): string {
    return this.auth?.currentUser?.uid ?? fallbackUserId;
  }
}
