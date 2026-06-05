import { Injectable } from '@angular/core';
import { PUSHUP_REPS_MAX, PUSHUP_REPS_MIN } from '@pu-stats/models';

export class PushupValidationError extends Error {
  constructor(
    public readonly field: 'reps',
    public readonly violation: 'not-integer' | 'out-of-range'
  ) {
    super(`Invalid pushup ${field}: ${violation}`);
    this.name = 'PushupValidationError';
  }
}

/**
 * Map a failed pushup reps validation to a human-readable, localized
 * snack-bar message.
 */
export function pushupValidationMessage(err: unknown): string {
  if (err instanceof PushupValidationError && err.field === 'reps') {
    if (err.violation === 'out-of-range') {
      return $localize`:@@pushup.validation.reps.outOfRange:Reps müssen zwischen ${PUSHUP_REPS_MIN}:min: und ${PUSHUP_REPS_MAX}:max: liegen.`;
    }
    if (err.violation === 'not-integer') {
      return $localize`:@@pushup.validation.reps.notInteger:Reps muss eine ganze Zahl sein.`;
    }
  }
  return $localize`:@@pushup.validation.generic:Eintrag konnte nicht gespeichert werden.`;
}

/** Re-exported so callers can read the cap without importing from `@pu-stats/models`. */
export { PUSHUP_REPS_MAX, PUSHUP_REPS_MIN };

/**
 * Legacy pushup Firestore service. All read/write operations have been
 * removed post-Phase-7 cutover. Pushup entries now live in
 * `exerciseEntries` with `exerciseId:'pushup'` and are managed by
 * `ExerciseFirestoreService`.
 *
 * Client-side migration of pushup documents between different userIds is
 * intentionally disabled. Any cross-user migration must be performed in a
 * trusted backend (e.g. Cloud Function / Admin SDK).
 */
@Injectable({ providedIn: 'root' })
export class PushupFirestoreService {
  async migrateUserData(_fromUserId: string, _toUserId: string): Promise<void> {
    // No-op by design. See class comment.
  }
}
