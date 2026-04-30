import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  doc,
  docData,
  DocumentReference,
  Firestore,
  setDoc,
} from '@angular/fire/firestore';
import { UserTrainingPlan, UserTrainingPlanUpdate } from '@pu-stats/models';
import { from, map, Observable, of } from 'rxjs';

const COLLECTION = 'userTrainingPlans';

/**
 * Single-document-per-user store for the active training plan.
 * Mirrors the pattern of `UserConfigApiService` (collection
 * `userTrainingPlans/{userId}` keyed on the auth uid). Always uses
 * `currentUser.uid` for the doc path so a forged `userId` parameter
 * cannot redirect reads/writes.
 */
@Injectable({ providedIn: 'root' })
export class UserTrainingPlanApiService {
  private readonly firestore = inject(Firestore, { optional: true });
  private readonly auth = inject(Auth, { optional: true });

  getActivePlan(userId: string): Observable<UserTrainingPlan | null> {
    const effectiveUserId = this.resolveUserId(userId);
    if (!effectiveUserId || !this.firestore) {
      return of(null);
    }
    const ref = this.docRef(effectiveUserId);
    return docData(ref).pipe(
      map((data) => (data as UserTrainingPlan | undefined) ?? null)
    );
  }

  updatePlan(
    userId: string,
    patch: UserTrainingPlanUpdate
  ): Observable<UserTrainingPlan> {
    const effectiveUserId = this.resolveUserId(userId);
    if (!effectiveUserId || !this.firestore) {
      return of({
        userId,
        planId: '',
        startDate: '',
        status: 'active',
        completedDays: [],
        ...patch,
      } as UserTrainingPlan);
    }
    const ref = this.docRef(effectiveUserId);
    const nowIso = new Date().toISOString();
    const payload: Partial<UserTrainingPlan> = {
      ...patch,
      userId: effectiveUserId,
      updatedAt: nowIso,
    };
    return from(setDoc(ref, payload, { merge: true })).pipe(
      map(
        () =>
          ({
            userId: effectiveUserId,
            planId: '',
            startDate: '',
            status: 'active',
            completedDays: [],
            ...patch,
          }) as UserTrainingPlan
      )
    );
  }

  /**
   * Replaces the doc atomically (used when starting a new plan so we
   * don't merge stale `completedDays` from a previous activation).
   */
  setPlan(
    userId: string,
    plan: Omit<UserTrainingPlan, 'userId'>
  ): Observable<UserTrainingPlan> {
    const effectiveUserId = this.resolveUserId(userId);
    if (!effectiveUserId || !this.firestore) {
      return of({ ...plan, userId } as UserTrainingPlan);
    }
    const ref = this.docRef(effectiveUserId);
    const nowIso = new Date().toISOString();
    const payload: UserTrainingPlan = {
      ...plan,
      userId: effectiveUserId,
      createdAt: plan.createdAt ?? nowIso,
      updatedAt: nowIso,
    };
    return from(setDoc(ref, payload)).pipe(map(() => payload));
  }

  private resolveUserId(fallbackUserId: string): string {
    return this.auth?.currentUser?.uid ?? fallbackUserId;
  }

  private docRef(userId: string): DocumentReference<UserTrainingPlan> {
    return doc(
      this.requireFirestore(),
      COLLECTION,
      userId
    ) as DocumentReference<UserTrainingPlan>;
  }

  private requireFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error('Firestore provider missing');
    }
    return this.firestore;
  }
}
