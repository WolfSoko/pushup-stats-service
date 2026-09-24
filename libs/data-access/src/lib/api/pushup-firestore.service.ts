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
