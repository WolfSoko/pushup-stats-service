import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import {
  normalizeWorkout,
  type TrainingPlanExercise,
  type Workout,
  type WorkoutInput,
  type WorkoutSource,
} from '@pu-stats/models';
import { map, Observable, of } from 'rxjs';
import { PendingRequestsService } from '../pending-requests.service';

const COLLECTION = 'workouts';

/**
 * Firestore may not store `undefined`, and a workout line carries two
 * optional fields, so the persisted shape is rebuilt key by key.
 */
function exercisePayload(exercise: TrainingPlanExercise): TrainingPlanExercise {
  return {
    exerciseId: exercise.exerciseId,
    target: exercise.target,
    ...(exercise.variantId ? { variantId: exercise.variantId } : {}),
    ...(exercise.sets ? { sets: [...exercise.sets] } : {}),
  };
}

function inputPayload(input: WorkoutInput): WorkoutInput {
  return {
    title: input.title.trim(),
    description: input.description,
    exercises: input.exercises.map(exercisePayload),
    onProfile: input.onProfile,
  };
}

/**
 * The user's own workouts at `workouts/{id}`, one document each. Copies
 * that friends send arrive through the `shareWorkout` callable, which is
 * the only writer other than the owner; the rules keep every document
 * owner-only.
 *
 * As in `UserTrainingPlanApiService`, `auth.currentUser.uid` wins over
 * the `userId` argument so a forged argument cannot redirect a write.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutsApiService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });
  private readonly pending = inject(PendingRequestsService);

  /** Live list, newest change first. Documents that do not validate are dropped. */
  listWorkouts(userId: string): Observable<ReadonlyArray<Workout>> {
    const uid = this.resolveUserId(userId);
    if (!uid || !this.firestore) return of([]);
    const q = query(
      collection(this.firestore, COLLECTION),
      where('ownerId', '==', uid),
      orderBy('updatedAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }).pipe(
      map((docs) =>
        docs
          .map((data) => {
            const { id, ...rest } = data as { id: string };
            return normalizeWorkout(id, rest);
          })
          .filter((w): w is Workout => w !== null)
      )
    );
  }

  /** Returns the new document's id. */
  async createWorkout(
    userId: string,
    input: WorkoutInput,
    sharedBy?: WorkoutSource
  ): Promise<string> {
    const uid = this.resolveUserId(userId);
    if (!uid || !this.firestore) return '';
    const ref = doc(collection(this.firestore, COLLECTION));
    const now = new Date().toISOString();
    const payload: Omit<Workout, 'id'> = {
      ownerId: uid,
      ...inputPayload(input),
      ...(sharedBy ? { sharedBy } : {}),
      createdAt: now,
      updatedAt: now,
    };
    await this.pending.track(setDoc(ref, payload));
    return ref.id;
  }

  async updateWorkout(
    userId: string,
    id: string,
    input: WorkoutInput
  ): Promise<void> {
    const ref = this.docRef(userId, id);
    if (!ref) return;
    await this.pending.track(
      updateDoc(ref, {
        ...inputPayload(input),
        updatedAt: new Date().toISOString(),
      })
    );
  }

  async setOnProfile(
    userId: string,
    id: string,
    onProfile: boolean
  ): Promise<void> {
    const ref = this.docRef(userId, id);
    if (!ref) return;
    await this.pending.track(
      updateDoc(ref, { onProfile, updatedAt: new Date().toISOString() })
    );
  }

  async deleteWorkout(userId: string, id: string): Promise<void> {
    const ref = this.docRef(userId, id);
    if (!ref) return;
    await this.pending.track(deleteDoc(ref));
  }

  private docRef(userId: string, id: string) {
    const uid = this.resolveUserId(userId);
    if (!uid || !this.firestore || !id) return null;
    return doc(this.firestore, COLLECTION, id);
  }

  private resolveUserId(fallbackUserId: string): string {
    return this.auth?.currentUser?.uid ?? fallbackUserId;
  }
}
