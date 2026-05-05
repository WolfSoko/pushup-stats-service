/**
 * Generic exercise model — phase 0 of the multi-exercise migration.
 *
 * The legacy Pushup-only model in `pushup.models.ts` stays untouched: existing
 * Firestore docs in the `pushups` collection are still read/written through
 * `PushupRecord`. New exercises (sit-ups, squats, …) live in a separate
 * Firestore collection `exerciseEntries` and use {@link ExerciseEntry} below.
 *
 * Migration plan and roadmap: see `plans/multi-exercise-roadmap.md`.
 */

export type MeasurementType = 'reps' | 'time' | 'distance' | 'weight';

export type ExerciseCategoryId =
  | 'pushup'
  | 'abs'
  | 'legs'
  | 'plank'
  | 'cardio'
  | 'strength'
  | 'mobility';

export interface ExerciseCategoryInfo {
  id: ExerciseCategoryId;
  /** XLIFF i18n id (e.g. `'@@exercise.category.abs'`). */
  nameKey: string;
  icon: string;
  /** Display order on the dashboard — lower = higher up. */
  order: number;
}

export interface ExerciseVariant {
  id: string;
  /** XLIFF i18n id. */
  nameKey: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface ExerciseDefinition {
  /**
   * Globally unique exercise id. Standard catalog uses dotted segments
   * (`'abs.situps'`, `'legs.squats'`); custom user exercises use a uuid.
   */
  id: string;
  categoryId: ExerciseCategoryId;
  /** `undefined` for catalog entries; `userId` for custom user exercises. */
  ownerId?: string;
  measurement: MeasurementType;
  /** Inclusive minimum value for the measurement (e.g. 1 rep). */
  min: number;
  /** Inclusive maximum value for the measurement (e.g. 500 reps). */
  max: number;
  unit: string;
  /** XLIFF i18n id for catalog exercises (e.g. `'@@exercise.abs.situps.name'`). */
  nameKey?: string;
  /** Plain string for user-defined exercises. */
  customName?: string;
  /** Optional Material icon name. */
  icon?: string;
  variants?: readonly ExerciseVariant[];
}

export interface ExerciseEntry {
  _id: string;
  userId: string;
  exerciseId: string;
  variantId?: string;
  timestamp: string;
  /** Set when measurement = 'reps' or 'weight'. */
  reps?: number;
  /** Set when measurement = 'time'. */
  durationSec?: number;
  /** Set when measurement = 'distance'. */
  distanceM?: number;
  /** Set when measurement = 'weight' (kg per rep). */
  weightKg?: number;
  /** Optional per-set breakdown, only meaningful for reps/weight. */
  sets?: number[];
  source: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExerciseEntryCreate {
  exerciseId: string;
  variantId?: string;
  timestamp: string;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  weightKg?: number;
  sets?: number[];
  source?: string;
}

export interface ExerciseEntryUpdate {
  exerciseId?: string;
  variantId?: string;
  timestamp?: string;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  weightKg?: number;
  sets?: number[];
  source?: string;
}

export type ExerciseEntryViolation =
  | 'unknown-exercise'
  | 'measurement-value-missing'
  | 'measurement-value-not-integer'
  | 'measurement-value-out-of-range'
  | 'wrong-measurement-field'
  | 'invalid-variant';

/**
 * Returns the value field expected for a measurement type. Pure helper —
 * lets the validator and UI form derive the active field name without a
 * scattered switch statement.
 */
export function measurementValueField(
  measurement: MeasurementType
): keyof Pick<ExerciseEntry, 'reps' | 'durationSec' | 'distanceM' | 'weightKg'> {
  switch (measurement) {
    case 'reps':
    case 'weight':
      return 'reps';
    case 'time':
      return 'durationSec';
    case 'distance':
      return 'distanceM';
  }
}

/**
 * Validates an entry payload against its exercise definition. Pure — used
 * by the data-access service to fail fast before hitting Firestore, by form
 * validators, and by the Cloud Function delta. Returns null when valid.
 *
 * Validation rules:
 *   - The value field expected by `def.measurement` must be present and a
 *     finite integer in `[def.min, def.max]`.
 *   - No other measurement value field may be set (so a 'reps' entry must
 *     not also carry `durationSec`, etc. — keeps the aggregation honest).
 *   - `variantId`, if set, must reference one of `def.variants[].id`.
 */
export function validateExerciseEntry(
  entry: Pick<
    ExerciseEntry,
    'reps' | 'durationSec' | 'distanceM' | 'weightKg' | 'variantId'
  >,
  def: Pick<ExerciseDefinition, 'measurement' | 'min' | 'max' | 'variants'>
): ExerciseEntryViolation | null {
  const expectedField = measurementValueField(def.measurement);
  const otherFields = (
    ['reps', 'durationSec', 'distanceM', 'weightKg'] as const
  ).filter((f) => f !== expectedField);
  for (const f of otherFields) {
    if (entry[f] !== undefined) {
      return 'wrong-measurement-field';
    }
  }
  const value = entry[expectedField];
  if (value === undefined || value === null) {
    return 'measurement-value-missing';
  }
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    return 'measurement-value-not-integer';
  }
  if (value < def.min || value > def.max) {
    return 'measurement-value-out-of-range';
  }
  if (entry.variantId !== undefined && entry.variantId !== '') {
    const variants = def.variants ?? [];
    if (!variants.some((v) => v.id === entry.variantId)) {
      return 'invalid-variant';
    }
  }
  return null;
}
