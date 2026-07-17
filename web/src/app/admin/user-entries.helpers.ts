import {
  type ExerciseEntry,
  findExerciseDefinition,
  formatEntryDisplay,
  measurementValueField,
} from '@pu-stats/models';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';
import {
  type TrainingEntryDialogData,
  type TrainingEntryDialogResult,
} from '../stats/components/training-entry-dialog/training-entry-dialog.models';

type SortValue = string | number;

/**
 * Sort accessor for the admin per-user entry table. `timestamp` sorts
 * chronologically (ISO strings order lexicographically, but the numeric
 * epoch keeps parity with the user-list accessor), `exercise` by
 * localized name, `value` by the primary measurement number, `source`
 * alphabetically.
 */
export function adminEntrySortValue(
  entry: ExerciseEntry,
  property: string
): SortValue {
  switch (property) {
    case 'timestamp': {
      // Normalise a missing or malformed timestamp to 0 — `getTime()` returns
      // NaN for an unparseable value, and NaN comparisons make MatSort's order
      // unstable.
      const time = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
      return Number.isNaN(time) ? 0 : time;
    }
    case 'exercise':
      return entryExerciseName(entry).toLowerCase();
    case 'value':
      return primaryValue(entry);
    case 'source':
      return (entry.source ?? '').toLowerCase();
    default:
      return '';
  }
}

/** Localized exercise name, falling back to the raw id for stale entries. */
export function entryExerciseName(entry: ExerciseEntry): string {
  return exerciseDisplayName(entry.exerciseId);
}

/**
 * Human-readable value for a row (e.g. `30`, `5.00 km · 25:00 (5:00 /km)`).
 * Uses the catalog definition; falls back to the raw primary number when
 * the exercise id no longer resolves.
 */
export function entryValueDisplay(entry: ExerciseEntry): string {
  const def = findExerciseDefinition(entry.exerciseId);
  if (!def) return String(primaryValue(entry));
  return formatEntryDisplay(entry, def);
}

/**
 * Raw primary measurement value. For an unknown/stale exercise id (no
 * catalog definition) it falls back to the first present numeric field
 * (`reps` → `durationSec` → `distanceM`), or 0 when none is set.
 */
export function primaryValue(entry: ExerciseEntry): number {
  const def = findExerciseDefinition(entry.exerciseId);
  if (!def) return entry.reps ?? entry.durationSec ?? entry.distanceM ?? 0;
  const field = measurementValueField(def.measurement);
  return (entry[field] as number | undefined) ?? 0;
}

/**
 * Adapt a stored admin entry into the shared {@link TrainingEntryDialogData}
 * so the admin page opens the *same* editor the history page uses. Pushup
 * rows (`exerciseId === 'pushup'`) open in pushup mode; everything else in
 * exercise mode. Mirrors the history page's `toEditDialogData`.
 */
export function entryToDialogData(
  entry: ExerciseEntry
): TrainingEntryDialogData {
  if (entry.exerciseId === 'pushup') {
    return {
      kind: 'pushup',
      timestamp: entry.timestamp,
      reps: entry.reps,
      sets: entry.sets,
      source: entry.source,
      type: entry.variantId ?? undefined,
    };
  }
  return {
    kind: 'exercise',
    timestamp: entry.timestamp,
    reps: entry.reps,
    sets: entry.sets,
    intervals: entry.intervals,
    ...(entry.durationSec !== undefined
      ? { durationSec: entry.durationSec }
      : {}),
    ...(entry.distanceM !== undefined ? { distanceM: entry.distanceM } : {}),
    exerciseId: entry.exerciseId,
    variantId: entry.variantId,
  };
}

/**
 * Translate a shared-dialog result into the `adminUpdateUserEntry` patch.
 * The measurement branch mirrors the history page's `toUpdatePayload`, but
 * emits the plain field patch the admin callable expects (no `kind`/`id`,
 * `exerciseId` stays immutable). For exercise entries `source` is left
 * untouched; only pushup rows carry an editable source.
 */
export function dialogResultToPatch(
  entry: ExerciseEntry,
  result: TrainingEntryDialogResult
): Record<string, unknown> {
  const patch: Record<string, unknown> = { timestamp: result.timestamp };
  if (result.kind === 'pushup') {
    patch['reps'] = result.reps;
    patch['source'] = result.source;
    // A pushup's "type" is its variant; an empty type clears the variant.
    patch['variantId'] = result.type ? result.type : null;
    collapseBreakdown(patch, 'sets', result.sets, entry.sets);
    return patch;
  }

  const intervals = result.intervals ?? [];
  switch (result.measurement) {
    case 'time':
      patch['durationSec'] = result.durationSec ?? 0;
      collapseBreakdown(patch, 'intervals', intervals, entry.intervals);
      break;
    case 'distance-time':
      patch['distanceM'] = result.distanceM ?? 0;
      patch['durationSec'] = result.durationSec ?? 0;
      collapseBreakdown(patch, 'intervals', intervals, entry.intervals);
      break;
    case 'distance':
      patch['distanceM'] = result.distanceM ?? 0;
      collapseBreakdown(patch, 'intervals', intervals, entry.intervals);
      break;
    default:
      patch['reps'] = result.reps;
      collapseBreakdown(patch, 'sets', result.sets, entry.sets);
  }
  if (result.variantId !== undefined) patch['variantId'] = result.variantId;
  return patch;
}

// A multi-value breakdown collapses to a single value by clearing the stored
// array: emit `[]` (the callable maps it to `deleteField()`) only when the
// entry actually had one, so we never write a redundant empty array.
function collapseBreakdown(
  patch: Record<string, unknown>,
  field: 'sets' | 'intervals',
  next: number[],
  existing: number[] | undefined
): void {
  if (next.length > 1) patch[field] = next;
  else if (existing !== undefined) patch[field] = [];
}
