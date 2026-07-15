import {
  type ExerciseEntry,
  findExerciseDefinition,
  formatEntryDisplay,
  measurementCompanionValueField,
  measurementValueField,
} from '@pu-stats/models';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';

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
    case 'timestamp':
      return entry.timestamp ? new Date(entry.timestamp).getTime() : 0;
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

/** Companion value field for an entry, or `undefined` when it has none. */
export function companionField(
  entry: ExerciseEntry
): 'durationSec' | 'weightKg' | undefined {
  const def = findExerciseDefinition(entry.exerciseId);
  if (!def) return undefined;
  const companion = measurementCompanionValueField(def.measurement);
  if (companion === 'durationSec') return 'durationSec';
  if (def.measurement === 'weight') return 'weightKg';
  return undefined;
}

export interface AdminEntryEditForm {
  timestamp: string;
  value: number | null;
  companion: number | null;
}

/**
 * Diffs the edit-form values against the original entry and returns the
 * minimal patch of changed fields, or `null` when nothing changed. Keeps
 * the callable payload small and avoids no-op writes that would bump
 * `updatedAt` and re-trigger aggregates for nothing.
 */
export function buildEntryPatch(
  entry: ExerciseEntry,
  form: AdminEntryEditForm
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (form.timestamp && form.timestamp !== entry.timestamp) {
    patch['timestamp'] = form.timestamp;
  }
  const def = findExerciseDefinition(entry.exerciseId);
  if (def && form.value !== null) {
    const field = measurementValueField(def.measurement);
    if (form.value !== (entry[field] as number | undefined)) {
      patch[field] = form.value;
    }
  }
  const companion = companionField(entry);
  if (companion && form.companion !== null) {
    if (form.companion !== (entry[companion] as number | undefined)) {
      patch[companion] = form.companion;
    }
  }
  return Object.keys(patch).length > 0 ? patch : null;
}
