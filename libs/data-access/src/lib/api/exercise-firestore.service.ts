import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  deleteField,
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
  >,
  options?: { partial?: boolean }
): Observable<T> | null {
  const def = findExerciseDefinition(exerciseId);
  if (!def) {
    return throwError(
      () => new ExerciseValidationError(exerciseId, 'unknown-exercise')
    );
  }
  const violation = validateExerciseEntry(payload, def, options);
  if (!violation) return null;
  return throwError(
    () => new ExerciseValidationError(exerciseId, violation)
  );
}

@Injectable({ providedIn: 'root' })
export class ExerciseFirestoreService {
  private readonly firestore = inject(Firestore);

  /**
   * Lists entries for a user, optionally restricted to a single exercise
   * or a small set of catalog exercises (Firestore `in` queries are
   * capped at 30 — fine for the Phase-0 catalog and any realistic
   * category size). Mirrors `PushupFirestoreService.listPushups` so the
   * dashboard sections can reuse the same date-window filtering.
   */
  listEntries(
    userId: string,
    options?: {
      exerciseId?: string;
      exerciseIds?: ReadonlyArray<string>;
      filter?: StatsFilter;
    }
  ): Observable<ExerciseEntry[]> {
    const ref = collection(this.firestore, EXERCISE_ENTRIES_COLLECTION);
    const constraints: QueryConstraint[] = [
      where('userId', '==', userId),
      orderBy('timestamp', 'asc'),
    ];
    if (options?.exerciseId) {
      constraints.push(where('exerciseId', '==', options.exerciseId));
    } else if (options?.exerciseIds && options.exerciseIds.length > 0) {
      // Firestore's `in` operator caps the value list at 30. Phase-0
      // categories are far below that, but guarding here keeps the
      // failure mode predictable for future larger catalogs (and
      // avoids a cryptic Firestore error to the caller).
      if (options.exerciseIds.length > 30) {
        return throwError(
          () =>
            new Error(
              `listEntries: exerciseIds supports at most 30 ids, got ${options.exerciseIds!.length}`
            )
        );
      }
      constraints.push(where('exerciseId', 'in', [...options.exerciseIds]));
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

  /**
   * Patches an existing entry. `exerciseId` is the **stored** value of the
   * doc (used to look up the catalog entry for validation) and is treated
   * as immutable: a different exercise must be modelled as delete + create
   * so the per-exercise stats trigger can decrement the old aggregate.
   * Attempting to change `exerciseId` via the patch payload errors with
   * an {@link ExerciseValidationError} carrying the `'unknown-exercise'`
   * violation code — there is no dedicated immutability code yet, so
   * callers wanting to distinguish "typo in stored id" from "tried to
   * move exercise" need to compare the patch and the stored value
   * themselves.
   *
   * Validation is **partial** — only the fields actually being patched
   * are checked. So a variant-only update doesn't need to round-trip the
   * primary measurement value, and a no-op update (only `source` changing)
   * skips validation entirely.
   */
  updateEntry(
    id: string,
    exerciseId: string,
    payload: ExerciseEntryUpdate
  ): Observable<void> {
    if (
      payload.exerciseId !== undefined &&
      payload.exerciseId !== exerciseId
    ) {
      return throwError(
        () => new ExerciseValidationError(exerciseId, 'unknown-exercise')
      );
    }
    const valueChanges = (
      ['reps', 'durationSec', 'distanceM', 'weightKg', 'variantId'] as const
    ).some((k) => payload[k] !== undefined);
    if (valueChanges) {
      const violation = violationObservable<void>(exerciseId, payload, {
        partial: true,
      });
      if (violation) return violation;
    }
    const rowRef = doc(this.firestore, EXERCISE_ENTRIES_COLLECTION, id);
    // Strip exerciseId so an explicit pass-through doesn't sneak past the
    // immutability check above (e.g. caller forwards the original entry
    // verbatim). updatedAt is overwritten below with a client-side
    // ISO timestamp — Firestore `serverTimestamp()` would be safer
    // against clock skew, but the create path also writes client time
    // and switching one without the other would produce mixed shapes.
    const { exerciseId: _ignored, ...patchable } = payload;
    void _ignored;
    // An explicit `sets: []` is the contract for "drop the per-set
    // breakdown" (e.g. user goes from 3×10 back to a single 30-rep entry).
    // Dropping that key entirely would silently keep the stale array on
    // the doc; mapping it to `deleteField()` clears the field as expected.
    const cleanPayload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patchable)) {
      if (v === undefined) continue;
      if (k === 'sets' && Array.isArray(v) && v.length === 0) {
        cleanPayload[k] = deleteField();
        continue;
      }
      cleanPayload[k] = v;
    }
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
