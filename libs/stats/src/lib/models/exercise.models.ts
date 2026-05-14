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

export type MeasurementType =
  | 'reps'
  | 'time'
  | 'distance'
  | 'weight'
  | 'distance-time';

/**
 * Categories follow a movement-pattern taxonomy (Dan John / functional
 * fitness) rather than body-part labels, with one isolation bucket
 * (`cardio`, `mobility`, `strength`) per cross-pattern concern:
 *
 *   pushup — bodyweight pushup variants (legacy `pushups` collection)
 *   push   — other horizontal/vertical pressing (dips, handstand hold)
 *   pull   — vertical/horizontal pulling (pull-ups, rows)
 *   squat  — knee-dominant lower body (squat variants, calf raise)
 *   hinge  — hip-dominant lower body (glute bridge, hip thrust)
 *   lunge  — single-leg / split-stance (lunge variants, step-up)
 *   carry  — loaded carries (farmer's walk, suitcase carry)
 *   core   — anti-extension / -rotation / -lateral-flexion (plank, sit-up, …)
 *   cardio — sustained conditioning (run, bike, row, jump rope, burpee)
 *   mobility — flexibility, joint prep (stretching, yoga, foam roll)
 *   strength — barbell/dumbbell compound lifts measured in load × reps
 *
 * `pushup` is kept as a separate category from `push` because the app
 * is called "PushUps" — pushup variants are the headline workout and
 * deserve their own bucket on the dashboard. Other pressing movements
 * (dips, handstand) live in `push`.
 */
export type ExerciseCategoryId =
  | 'pushup'
  | 'push'
  | 'pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'carry'
  | 'core'
  | 'cardio'
  | 'mobility'
  | 'strength';

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
  /**
   * Primary value for `measurement = 'time'` (plank) and required
   * companion for `measurement = 'distance-time'` (a tracked run
   * carries both a distance and a duration).
   */
  durationSec?: number;
  /**
   * Primary value for `measurement = 'distance'` and
   * `measurement = 'distance-time'`. The catalog `min`/`max`
   * constrain this field; the duration companion has its own bounds.
   */
  distanceM?: number;
  /** Set when measurement = 'weight' (kg per rep). */
  weightKg?: number;
  /** Optional per-set breakdown, only meaningful for reps/weight. */
  sets?: number[];
  /**
   * Optional per-interval breakdown, only meaningful for endurance
   * measurements (`time`, `distance`, `distance-time`). Each entry is
   * one repetition of the primary measurement — e.g. for sprint
   * training a `time` exercise might record `intervals: [30, 30, 30]`
   * (three 30-second sprints), a `distance` interval workout might
   * record `intervals: [400, 400, 400]` (3 × 400 m). Mutually
   * exclusive with `sets` in practice: pick the field that matches
   * the exercise's measurement type via {@link entryBreakdownField}.
   */
  intervals?: number[];
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
  intervals?: number[];
  source?: string;
}

export interface ExerciseEntryUpdate {
  exerciseId?: string;
  /**
   * Variant id patch. A non-empty `string` sets the variant; `null` is
   * the sentinel for "explicitly clear" — the data-access layer
   * translates it into a Firestore `deleteField()` so the doc no
   * longer carries one. `undefined` means "no change" (omitted from
   * the patch). The empty string `''` is also accepted as a defensive
   * fallback and treated like `undefined` ("no variant"), matching the
   * raw value an unfilled mat-select control delivers.
   */
  variantId?: string | null;
  timestamp?: string;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  weightKg?: number;
  sets?: number[];
  intervals?: number[];
  source?: string;
}

export type ExerciseEntryViolation =
  | 'unknown-exercise'
  | 'measurement-value-missing'
  | 'measurement-value-not-integer'
  | 'measurement-value-out-of-range'
  | 'wrong-measurement-field'
  | 'invalid-variant'
  | 'companion-value-missing'
  | 'companion-value-invalid'
  | 'companion-value-out-of-range';

type MeasurementValueField = 'reps' | 'durationSec' | 'distanceM' | 'weightKg';

/**
 * Returns the value field expected for a measurement type. Pure helper —
 * lets the validator and UI form derive the active field name without a
 * scattered switch statement.
 */
export function measurementValueField(
  measurement: MeasurementType
): keyof Pick<
  ExerciseEntry,
  'reps' | 'durationSec' | 'distanceM' | 'weightKg'
> {
  switch (measurement) {
    case 'reps':
    case 'weight':
      return 'reps';
    case 'time':
      return 'durationSec';
    case 'distance':
    case 'distance-time':
      // For distance-time the primary value is the distance — that's what
      // the catalog `min`/`max` constrain, what Aggregations sum, and what
      // headline displays read. The duration is a required companion
      // (see {@link COMPANION_FIELDS}/{@link REQUIRED_COMPANIONS}).
      return 'distanceM';
  }
}

/**
 * Returns the secondary (companion) value field that carries equal
 * display weight to the primary value, or `undefined` when there isn't
 * one. Currently only `'distance-time'` qualifies — the duration is
 * just as important to display as the distance, and {@link
 * formatEntryDisplay} renders both.
 *
 * Distinct from {@link companionFields}, which lists *allowed* companions
 * for validation. A field can be a validation companion without being
 * a display companion (e.g. `'distance'` may carry an optional
 * duration but renders as distance-only).
 */
export function measurementCompanionValueField(
  measurement: MeasurementType
): MeasurementValueField | undefined {
  return measurement === 'distance-time' ? 'durationSec' : undefined;
}

/**
 * Returns the per-segment breakdown field that's meaningful for a
 * measurement type:
 *
 *   - `'sets'` for `reps` / `weight` — rep counts per set
 *     (e.g. 30 squats logged as `sets: [10, 10, 10]`).
 *   - `'intervals'` for `time` / `distance` / `distance-time` — per-interval
 *     primary values (e.g. sprint repeats `intervals: [400, 400, 400]` for a
 *     distance workout, or `intervals: [30, 30, 30]` for 30-second sprints
 *     on a time-measured exercise).
 *
 * Endurance training (sprint repeats, HIIT) doesn't use the strength term
 * "Sätze/Sets"; UI labels and entry shape pick the field via this helper.
 */
export function entryBreakdownField(
  measurement: MeasurementType
): 'sets' | 'intervals' {
  switch (measurement) {
    case 'reps':
    case 'weight':
      return 'sets';
    case 'time':
    case 'distance':
    case 'distance-time':
      return 'intervals';
  }
}

/**
 * Companion value fields allowed alongside the primary measurement value.
 *
 * - `distance`: an optional `durationSec` lets the entry record pace
 *   (e.g. a 5 km run in 27:30 stores `distanceM` AND `durationSec`).
 * - `weight`: a required `weightKg` companion turns the rep count into
 *   a weighted set (squats with 80 kg → `reps:5`, `weightKg:80`).
 *
 * Any field not declared here is rejected as `wrong-measurement-field`.
 */
const COMPANION_FIELDS: Readonly<
  Record<MeasurementType, ReadonlyArray<MeasurementValueField>>
> = {
  reps: [],
  time: [],
  distance: ['durationSec'],
  'distance-time': ['durationSec'],
  weight: ['weightKg'],
};

const REQUIRED_COMPANIONS: Readonly<
  Record<MeasurementType, ReadonlyArray<MeasurementValueField>>
> = {
  reps: [],
  time: [],
  distance: [],
  'distance-time': ['durationSec'],
  weight: ['weightKg'],
};

/**
 * Bounds and integer-ness for each value field when used as a companion.
 *
 * Why per-field instead of pulling from the {@link ExerciseDefinition}:
 * companion semantics (e.g. weightKg up to ~500 kg, durationSec up to
 * one day) are largely catalog-independent and not yet expressive enough
 * to warrant a per-definition cap. When custom user exercises land in
 * Phase 4 we can move these into `ExerciseDefinition`.
 */
export const COMPANION_BOUNDS: Readonly<
  Record<
    MeasurementValueField,
    { readonly min: number; readonly max: number; readonly integer: boolean }
  >
> = {
  reps: { min: 1, max: 500, integer: true },
  durationSec: { min: 1, max: 86_400, integer: true },
  distanceM: { min: 1, max: 100_000, integer: true },
  weightKg: { min: 0.25, max: 500, integer: false },
};

/**
 * Returns the companion fields a measurement type allows. Useful for UI
 * form builders that show/hide pace or weight inputs based on the
 * selected exercise.
 */
export function companionFields(
  measurement: MeasurementType
): ReadonlyArray<MeasurementValueField> {
  return COMPANION_FIELDS[measurement];
}

/**
 * Returns the companion fields a measurement type *requires* (vs. just
 * allows). Currently only `weight` requires `weightKg`.
 */
export function requiredCompanionFields(
  measurement: MeasurementType
): ReadonlyArray<MeasurementValueField> {
  return REQUIRED_COMPANIONS[measurement];
}

/**
 * Validates an entry payload against its exercise definition. Pure — used
 * by the data-access service to fail fast before hitting Firestore, by form
 * validators, and by the Cloud Function delta. Returns null when valid.
 *
 * Validation rules:
 *   - The value field expected by `def.measurement` must be present and a
 *     finite integer in `[def.min, def.max]` (skipped when `partial` is
 *     true, e.g. for an `updateEntry()` patch that only changes the variant).
 *   - Companion fields declared in {@link COMPANION_FIELDS} for the
 *     measurement may also be present (e.g. `durationSec` for distance,
 *     `weightKg` for weighted sets). All other measurement value fields
 *     are rejected as `wrong-measurement-field`.
 *   - Companions in {@link REQUIRED_COMPANIONS} must be present (skipped
 *     when `partial` is true).
 *   - Companion values, when present, are validated against their own
 *     per-field bounds in {@link COMPANION_BOUNDS}.
 *   - `variantId`, if set, must reference one of `def.variants[].id`.
 *
 * Why a `partial` mode: `ExerciseFirestoreService.updateEntry()` ships
 * patches that may only change a single field (e.g. `variantId`).
 * Requiring the primary measurement value on every patch would force the
 * caller to refetch the document just to satisfy the validator —
 * breaking the cheap-update contract.
 */
export function validateExerciseEntry(
  entry: Pick<
    ExerciseEntry,
    'reps' | 'durationSec' | 'distanceM' | 'weightKg' | 'sets' | 'intervals'
  > & {
    // `null` is the patch sentinel for "clear the variant"; the
    // persisted `ExerciseEntry.variantId` is `string | undefined`
    // because the Firestore doc never actually stores null (the
    // service translates the sentinel to `deleteField()`).
    variantId?: string | null;
  },
  def: Pick<ExerciseDefinition, 'measurement' | 'min' | 'max' | 'variants'>,
  options?: { partial?: boolean }
): ExerciseEntryViolation | null {
  const partial = options?.partial === true;
  const expectedField = measurementValueField(def.measurement);
  const allowedCompanions = COMPANION_FIELDS[def.measurement];
  const allFields: ReadonlyArray<MeasurementValueField> = [
    'reps',
    'durationSec',
    'distanceM',
    'weightKg',
  ];
  for (const f of allFields) {
    if (f === expectedField) continue;
    if (allowedCompanions.includes(f)) continue;
    if (entry[f] !== undefined) {
      return 'wrong-measurement-field';
    }
  }
  // Breakdown fields are mutually exclusive by measurement type:
  // strength entries use `sets` (rep counts), endurance entries use
  // `intervals` (per-segment durations/distances). The wrong field
  // on the wrong measurement type would corrupt aggregations — the
  // Firestore rules enforce this server-side, but failing fast here
  // gives callers a structured violation code before the round-trip.
  // An empty `[]` is the clear-breakdown sentinel and is allowed on
  // either side so existing entries can be wiped during a measurement
  // change-of-mind without a special-cased reset path.
  const wrongBreakdown =
    entryBreakdownField(def.measurement) === 'sets'
      ? entry.intervals
      : entry.sets;
  if (Array.isArray(wrongBreakdown) && wrongBreakdown.length > 0) {
    return 'wrong-measurement-field';
  }
  const value = entry[expectedField];
  if (value === undefined || value === null) {
    if (!partial) return 'measurement-value-missing';
  } else {
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
  }
  if (!partial) {
    for (const f of REQUIRED_COMPANIONS[def.measurement]) {
      if (entry[f] === undefined || entry[f] === null) {
        return 'companion-value-missing';
      }
    }
  }
  for (const f of allowedCompanions) {
    const v = entry[f];
    if (v === undefined || v === null) continue;
    const bounds = COMPANION_BOUNDS[f];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return 'companion-value-invalid';
    }
    if (bounds.integer && !Number.isInteger(v)) {
      return 'companion-value-invalid';
    }
    if (v < bounds.min || v > bounds.max) {
      return 'companion-value-out-of-range';
    }
  }
  // Empty string and explicit `null` both mean "no variant" — the
  // dialog uses `null` as the patch sentinel for "clear an existing
  // variant" and we must not reject that as an unknown variant.
  if (
    entry.variantId !== undefined &&
    entry.variantId !== null &&
    entry.variantId !== ''
  ) {
    const variants = def.variants ?? [];
    if (!variants.some((v) => v.id === entry.variantId)) {
      return 'invalid-variant';
    }
  }
  return null;
}
