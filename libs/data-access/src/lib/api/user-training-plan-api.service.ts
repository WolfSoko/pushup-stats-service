import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  arrayRemove,
  arrayUnion,
  doc,
  docData,
  DocumentReference,
  Firestore,
  runTransaction,
  setDoc,
  updateDoc,
} from '@angular/fire/firestore';
import { UserTrainingPlan, UserTrainingPlanUpdate } from '@pu-stats/models';
import { from, map, Observable, of } from 'rxjs';
import { nextSkippedDays } from './user-training-plan.jump';

const COLLECTION = 'userTrainingPlans';

/** Optimistic echo of an `updatePlan` write for callers that only need the
 *  patched fields back (and the shape returned when there is no Firestore). */
function patchedPlan(
  userId: string,
  patch: UserTrainingPlanUpdate
): UserTrainingPlan {
  return {
    userId,
    planId: '',
    startDate: '',
    status: 'active',
    completedDays: [],
    ...patch,
  };
}

/**
 * Single-document-per-user store for the active training plan.
 * Mirrors the pattern of `UserConfigApiService` (collection
 * `userTrainingPlans/{userId}` keyed on the auth uid).
 *
 * The doc path prefers `auth.currentUser.uid` over the `userId`
 * argument, so a forged argument cannot redirect reads/writes for an
 * authenticated session. When `auth.currentUser` is unavailable
 * (e.g. SSR before auth resolves, or the optional `Auth` provider is
 * missing in tests) we fall back to the passed-in `userId` so the
 * stub path matches what callers expect — Firestore rules still
 * reject any cross-user write.
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
      return of(patchedPlan(userId, patch));
    }
    const ref = this.docRef(effectiveUserId);
    const payload: Partial<UserTrainingPlan> = {
      ...patch,
      userId: effectiveUserId,
      updatedAt: new Date().toISOString(),
    };
    return from(setDoc(ref, payload, { merge: true })).pipe(
      map(() => patchedPlan(effectiveUserId, patch))
    );
  }

  /**
   * Atomic add/remove for `completedDays`. The default `updatePlan`
   * path overwrites the whole array via `setDoc({merge:true})`, so
   * two concurrent in-flight writes (e.g. auto-mark for today racing
   * with a manual `logPlanDay(yesterday)`) can drop a completion.
   * `arrayUnion`/`arrayRemove` work at the field-element level, so
   * concurrent writes to *different* day indexes are merged
   * correctly server-side.
   */
  addCompletedDay(userId: string, dayIndex: number): Observable<void> {
    // Marking done implicitly unskips: a day must be in at most one
    // of `completedDays` / `skippedDays`. The arrayRemove on a value
    // that isn't in the array is a no-op, so this is safe even when
    // the day was never skipped.
    return this.patch(userId, {
      completedDays: arrayUnion(dayIndex),
      skippedDays: arrayRemove(dayIndex),
    });
  }

  removeCompletedDay(userId: string, dayIndex: number): Observable<void> {
    return this.patch(userId, { completedDays: arrayRemove(dayIndex) });
  }

  /**
   * Atomic add/remove for `completedItems` — the per-exercise check-offs
   * inside a day, as `"<dayIndex>:<itemIndex>"` ids. Same `arrayUnion`
   * rationale as `addCompletedDay`: ticking two exercises of the same
   * day in quick succession must not drop either.
   */
  addCompletedItems(
    userId: string,
    itemIds: ReadonlyArray<string>
  ): Observable<void> {
    if (itemIds.length === 0) return of(void 0);
    return this.patch(userId, { completedItems: arrayUnion(...itemIds) });
  }

  removeCompletedItems(
    userId: string,
    itemIds: ReadonlyArray<string>
  ): Observable<void> {
    if (itemIds.length === 0) return of(void 0);
    return this.patch(userId, { completedItems: arrayRemove(...itemIds) });
  }

  /**
   * Atomic skip: add to `skippedDays` and remove from `completedDays`
   * in one write so a day index can never appear in both arrays.
   * Mixing `arrayUnion` and `arrayRemove` across two fields in a
   * single `updateDoc` is supported by Firestore.
   */
  addSkippedDay(userId: string, dayIndex: number): Observable<void> {
    return this.patch(userId, {
      skippedDays: arrayUnion(dayIndex),
      completedDays: arrayRemove(dayIndex),
    });
  }

  /**
   * Atomic re-anchor: write `startDate` and a recomputed `skippedDays`
   * inside a Firestore transaction so concurrent `arrayUnion` /
   * `arrayRemove` writes from another tab can't be silently
   * overwritten by the bulk-array replacement that this operation
   * needs to perform.
   *
   * `nonRestDaysBeforeTarget` is the set of plan-day indexes
   * `< targetDayIndex` whose `kind !== 'rest'`. The transaction reads
   * the current `completedDays` from server state and:
   * - keeps prior skips that still sit before the new cursor and
   *   aren't completed,
   * - bulk-skips every non-rest predecessor that isn't completed.
   *
   * Days already in `completedDays` are preserved as-is (even if they
   * end up in the future relative to the new `startDate`).
   */
  jumpToDay(
    userId: string,
    args: {
      newStartDate: string;
      targetDayIndex: number;
      nonRestDaysBeforeTarget: ReadonlyArray<number>;
    }
  ): Observable<void> {
    const effectiveUserId = this.resolveUserId(userId);
    if (!effectiveUserId || !this.firestore) return of(void 0);
    const ref = this.docRef(effectiveUserId);
    const firestore = this.firestore;
    return from(
      runTransaction(firestore, async (tx) => {
        const snap = await tx.get(ref);
        const data = (snap.data() as UserTrainingPlan | undefined) ?? null;
        tx.update(ref, {
          startDate: args.newStartDate,
          skippedDays: nextSkippedDays(data, args),
          updatedAt: new Date().toISOString(),
        });
      })
    ).pipe(map(() => void 0));
  }

  removeSkippedDay(userId: string, dayIndex: number): Observable<void> {
    return this.patch(userId, { skippedDays: arrayRemove(dayIndex) });
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

  /** Field-level `updateDoc` with the `updatedAt` stamp, or a no-op when
   *  there is no resolvable user / Firestore provider. */
  private patch(
    userId: string,
    fields: Record<string, unknown>
  ): Observable<void> {
    const effectiveUserId = this.resolveUserId(userId);
    if (!effectiveUserId || !this.firestore) return of(void 0);
    return from(
      updateDoc(this.docRef(effectiveUserId), {
        ...fields,
        updatedAt: new Date().toISOString(),
      })
    ).pipe(map(() => void 0));
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
