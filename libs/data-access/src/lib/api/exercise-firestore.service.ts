import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  orderBy,
  query,
  QueryConstraint,
  setDoc,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import {
  ExerciseEntry,
  ExerciseEntryCreate,
  ExerciseEntryUpdate,
  ExerciseEntryViolation,
  StatsFilter,
  companionFields,
  findExerciseDefinition,
  measurementValueField,
  validateExerciseEntry,
} from '@pu-stats/models';
import { from, map, Observable, throwError } from 'rxjs';

const EXERCISE_ENTRIES_COLLECTION = 'exerciseEntries';

export class ExerciseValidationError extends Error {
  constructor(
    public readonly exerciseId: string | null,
    public readonly violation: ExerciseEntryViolation
  ) {
    super(
      `Invalid exercise entry${
        exerciseId ? ` for ${exerciseId}` : ''
      }: ${violation}`
    );
    this.name = 'ExerciseValidationError';
  }
}

/**
 * Wraps validation errors in a cold Observable so callers see them in
 * `subscribe({ error })` instead of as a synchronous throw — same pattern
 * as `PushupFirestoreService`.
 */
function violationObservable<T>(
  exerciseId: string,
  payload: Pick<
    ExerciseEntry,
    'reps' | 'durationSec' | 'distanceM' | 'weightKg' | 'variantId'
  >
): Observable<T> | null {
  const def = findExerciseDefinition(exerciseId);
  if (!def) {
    return throwError(
      () => new ExerciseValidationError(exerciseId, 'unknown-exercise')
    );
  }
  const violation = validateExerciseEntry(payload, def);
  if (!violation) return null;
  return throwError(
    () => new ExerciseValidationError(exerciseId, violation)
  );
}

@Injectable({ providedIn: 'root' })
export class ExerciseFirestoreService {
  private readonly firestore = inject(Firestore);

  /**
   * Lists entries for a user, optionally restricted to a single exercise.
   * Mirrors `PushupFirestoreService.listPushups` so the dashboard sections
   * can reuse the same date-window filtering.
   */
  listEntries(
    userId: string,
    options?: { exerciseId?: string; filter?: StatsFilter }
  ): Observable<ExerciseEntry[]> {
    const ref = collection(this.firestore, EXERCISE_ENTRIES_COLLECTION);
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      orderBy('timestamp', 'asc'),
    ];
    if (options?.exerciseId) {
      constraints.push(where('exerciseId', '==', options.exerciseId));
    }
    if (options?.filter?.from) {
      constraints.push(
        where('timestamp', '>=', `${options.filter.from}T00:00:00.000Z`)
      );
    }
    if (options?.filter?.to) {
      constraints.push(
        where('timestamp', '<=', `${options.filter.to}T23:59:59.999Z`)
      );
    }

    const q = query(ref, ...constraints);

    return from(getDocs(q)).pipe(
      map((snapshot) =>
        snapshot.docs
          .map((d) => {
            const data = d.data() as Omit<ExerciseEntry, '_id'>;
            return { _id: d.id, ...data } as ExerciseEntry;
          })
          .filter((entry) => {
            const date = entry.timestamp.slice(0, 10);
            return (
              (!options?.filter?.from || date >= options.filter.from) &&
              (!options?.filter?.to || date <= options.filter.to)
            );
          })
      )
    );
  }

  createEntry(
    userId: string,
    payload: ExerciseEntryCreate
  ): Observable<ExerciseEntry> {
    const violation = violationObservable<ExerciseEntry>(
      payload.exerciseId,
      payload
    );
    if (violation) return violation;
    const def = findExerciseDefinition(payload.exerciseId);
    // findExerciseDefinition is non-null because violationObservable
    // would have errored otherwise — narrow the type for TS.
    if (!def) {
      return throwError(
        () =>
          new ExerciseValidationError(payload.exerciseId, 'unknown-exercise')
      );
    }
    const valueField = measurementValueField(def.measurement);
    const ref = collection(this.firestore, EXERCISE_ENTRIES_COLLECTION);
    const newRef = doc(ref);
    const nowIso = new Date().toISOString();
    const valueFromPayload = payload[valueField];
    const allowedCompanions = companionFields(def.measurement);
    const companionPatch: Record<string, number> = {};
    for (const f of allowedCompanions) {
      const v = payload[f];
      if (typeof v === 'number') companionPatch[f] = v;
    }

    const record: ExerciseEntry = {
      _id: newRef.id,
      userId,
      exerciseId: payload.exerciseId,
      timestamp: payload.timestamp,
      [valueField]: valueFromPayload,
      ...(payload.variantId ? { variantId: payload.variantId } : {}),
      ...companionPatch,
      ...(payload.sets?.length ? { sets: payload.sets } : {}),
      source: payload.source ?? 'web',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const firestoreData: Record<string, unknown> = {
      userId,
      exerciseId: payload.exerciseId,
      timestamp: payload.timestamp,
      [valueField]: valueFromPayload,
      source: record.source,
      createdAt: nowIso,
      updatedAt: nowIso,
      ...companionPatch,
    };
    if (payload.variantId) firestoreData['variantId'] = payload.variantId;
    if (payload.sets?.length) firestoreData['sets'] = payload.sets;

    return from(setDoc(newRef, firestoreData)).pipe(map(() => record));
  }

  updateEntry(
    id: string,
    exerciseId: string,
    payload: ExerciseEntryUpdate
  ): Observable<void> {
    const valueChanges = (
      ['reps', 'durationSec', 'distanceM', 'weightKg', 'variantId'] as const
    ).some((k) => payload[k] !== undefined);
    if (valueChanges) {
      const violation = violationObservable<void>(exerciseId, payload);
      if (violation) return violation;
    }
    const rowRef = doc(this.firestore, EXERCISE_ENTRIES_COLLECTION, id);
    const cleanPayload = Object.fromEntries(
      Object.entries(payload).filter(
        ([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)
      )
    );
    return from(
      updateDoc(rowRef, {
        ...cleanPayload,
        updatedAt: new Date().toISOString(),
      })
    ).pipe(map(() => void 0));
  }

  deleteEntry(id: string): Observable<{ ok: true }> {
    const rowRef = doc(this.firestore, EXERCISE_ENTRIES_COLLECTION, id);
    return from(deleteDoc(rowRef)).pipe(map(() => ({ ok: true as const })));
  }
}
