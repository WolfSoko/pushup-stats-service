import { findExerciseDefinition } from './exercise.catalog';
import type {
  ExerciseCategoryId,
  ExerciseDefinition,
  ExerciseEntry,
  MeasurementType,
} from './exercise.models';

export interface UnifiedEntryBase {
  _id: string;
  timestamp: string;
  reps: number;
  sets?: number[];
  /** Per-interval breakdown for endurance exercises (sprints, HIIT). See
   *  `ExerciseEntry.intervals`. */
  intervals?: number[];
  source: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UnifiedExerciseEntry extends UnifiedEntryBase {
  kind: 'exercise';
  exerciseId: string;
  variantId?: string;
  durationSec?: number;
  distanceM?: number;
  weightKg?: number;
}

export type UnifiedEntry = UnifiedExerciseEntry;

/**
 * Logical filter key for the History/Analysis exercise multi-select.
 * For pushup entries (`exerciseId:'pushup'`) this resolves to `'pushup'`,
 * matching the dedicated category. Any other value is an `ExerciseDefinition.id`
 * from the catalog.
 *
 * The `string & {}` half is the standard TypeScript trick to keep
 * `'pushup'` as an autocomplete hint without widening the union all
 * the way to `string` (which is what `'pushup' | string` collapses to).
 */
export type UnifiedEntryFilterKey = 'pushup' | (string & {});

export function exerciseEntryToUnified(e: ExerciseEntry): UnifiedExerciseEntry {
  return {
    kind: 'exercise',
    _id: e._id,
    timestamp: e.timestamp,
    // For `time` / `distance` exercises `reps` is undefined on the
    // source doc — surface 0 here so the table cell stays numeric and
    // sortable. The kind discriminator + measurement-specific fields
    // tell consumers what value is actually meaningful.
    reps: e.reps ?? 0,
    ...(e.sets ? { sets: e.sets } : {}),
    ...(e.intervals ? { intervals: e.intervals } : {}),
    source: e.source,
    exerciseId: e.exerciseId,
    ...(e.variantId ? { variantId: e.variantId } : {}),
    ...(e.durationSec !== undefined ? { durationSec: e.durationSec } : {}),
    ...(e.distanceM !== undefined ? { distanceM: e.distanceM } : {}),
    ...(e.weightKg !== undefined ? { weightKg: e.weightKg } : {}),
    ...(e.createdAt ? { createdAt: e.createdAt } : {}),
    ...(e.updatedAt ? { updatedAt: e.updatedAt } : {}),
  };
}

/**
 * Returns the filter key a UnifiedEntry contributes to the multi-select
 * filter on the history page. Pushup entries (`exerciseId:'pushup'`)
 * collapse into the `'pushup'` bucket; every other exercise uses its
 * catalog id.
 */
export function unifiedEntryFilterKey(
  entry: UnifiedEntry
): UnifiedEntryFilterKey {
  return entry.exerciseId;
}

/**
 * Maps a UnifiedEntry to the exercise category it belongs to. Entries
 * are resolved via the catalog — `resolveDefinition` defaults to
 * {@link findExerciseDefinition} but can be overridden when the analysis
 * page needs to resolve custom user exercises that live outside the
 * standard catalog. Returns `null` when the exercise id is not resolvable,
 * so callers can decide whether to bucket the entry into an "unknown"
 * group or drop it.
 */
export function unifiedEntryCategoryId(
  entry: UnifiedEntry,
  resolveDefinition: (
    id: string
  ) => ExerciseDefinition | null = findExerciseDefinition
): ExerciseCategoryId | null {
  return resolveDefinition(entry.exerciseId)?.categoryId ?? null;
}

/**
 * Returns the measurement type for an entry — the dimension its primary
 * value lives on. Entries resolve through the catalog; an unknown
 * `exerciseId` yields `null` so callers can decide whether to drop the
 * row or fall back to a default.
 */
export function unifiedEntryMeasurement(
  entry: UnifiedEntry,
  resolveDefinition: (
    id: string
  ) => ExerciseDefinition | null = findExerciseDefinition
): MeasurementType | null {
  return resolveDefinition(entry.exerciseId)?.measurement ?? null;
}

/**
 * Volume value for time-bucket aggregations (analysis chart, week/month
 * trends). The chart bar height per day/hour is `sum(primaryValue)`
 * across the bucket's entries — so each entry must contribute on the
 * dimension its measurement type lives on:
 *
 *   - `reps` / `weight` → `reps`
 *   - `time`            → `durationSec`
 *   - `distance` / `distance-time` → `distanceM`
 *
 * Unknown exerciseIds (custom user exercises whose catalog entry the
 * caller didn't resolve) fall back to the first populated
 * volume-meaningful field in the order `reps` → `durationSec` →
 * `distanceM` so they still contribute a visible bar rather than
 * vanishing. `weightKg` is intentionally excluded: it expresses load
 * per rep rather than a volume, and summing it across entries has no
 * sensible meaning for a chart bar height.
 */
export function unifiedEntryPrimaryValue(
  entry: UnifiedEntry,
  resolveDefinition: (
    id: string
  ) => ExerciseDefinition | null = findExerciseDefinition
): number {
  const measurement = resolveDefinition(entry.exerciseId)?.measurement;
  switch (measurement) {
    case 'reps':
    case 'weight':
      return entry.reps;
    case 'time':
      return entry.durationSec ?? 0;
    case 'distance':
    case 'distance-time':
      return entry.distanceM ?? 0;
    default:
      return entry.reps || entry.durationSec || entry.distanceM || 0;
  }
}
