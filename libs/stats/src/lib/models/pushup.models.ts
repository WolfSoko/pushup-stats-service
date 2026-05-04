export interface PushupRecord {
  _id: string;
  timestamp: string;
  reps: number;
  sets?: number[];
  source: string;
  /**
   * Push-up variation. New writes use the language-agnostic catalog
   * `id` from `PUSHUP_TYPES` (e.g. `'diamond'`, `'one-arm'`); older docs
   * still carry the legacy English `entryLabel` (e.g. `'Diamond'`, `'One-Arm'`)
   * or a free-form custom string the user typed in the entry dialog.
   * Use `findPushupTypeByStoredValue`, `canonicalizePushupType`, or
   * `displayPushupType` from `pushup-type.models.ts` at every read site
   * so all three formats resolve to the same bucket / label.
   */
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PushupCreate {
  timestamp: string;
  reps: number;
  sets?: number[];
  source?: string;
  type?: string;
}

export interface PushupUpdate {
  timestamp?: string;
  reps?: number;
  sets?: number[];
  source?: string;
  type?: string;
}

/**
 * Plausibility caps for a single pushup entry. The Firestore rule mirrors
 * these constants — see `data-store/firestore.rules`. Any change here MUST
 * be reflected in the rule and vice versa, otherwise honest writes that
 * pass client validation will be rejected at the security layer (or worse:
 * cheats that pass the rule will silently break the UI).
 *
 * The ceiling matches the existing `QUICK_LOG_REPS_MAX` (500) so quick-log
 * notifications keep working unchanged.
 */
export const PUSHUP_REPS_MIN = 1;
export const PUSHUP_REPS_MAX = 500;

export type PushupRepsViolation = 'not-integer' | 'out-of-range';

/**
 * Returns null if the value is a valid pushup rep count; otherwise returns
 * the kind of violation. Pure — used by the data-access service to fail
 * fast before hitting Firestore, by form validators, and by tests.
 */
export function validatePushupReps(reps: unknown): PushupRepsViolation | null {
  if (
    typeof reps !== 'number' ||
    !Number.isFinite(reps) ||
    !Number.isInteger(reps)
  ) {
    return 'not-integer';
  }
  if (reps < PUSHUP_REPS_MIN || reps > PUSHUP_REPS_MAX) {
    return 'out-of-range';
  }
  return null;
}
