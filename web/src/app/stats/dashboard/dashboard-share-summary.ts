import {
  findExerciseDefinition,
  formatExerciseValue,
  measurementValueField,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  type ExerciseEntry,
} from '@pu-stats/models';

import { exerciseDisplayName } from '../i18n/exercise-display-names';

/**
 * What the user actually trained today, as the line the share text leads
 * with.
 *
 * The share copy used to claim push-ups whatever the entries said, so a day
 * of nothing but squats went out as "0 Liegestütze geschafft". A multi-
 * exercise app has to share the multi-exercise day.
 */

/** One exercise's total for the day, in that exercise's own unit. */
export interface DayExerciseTotal {
  readonly exerciseId: string;
  readonly value: number;
  readonly unit: string;
}

/** How many exercises the share line names before it summarises the rest. */
export const SHARE_SUMMARY_MAX_EXERCISES = 3;

/**
 * Per-exercise totals for `dateIso`, push-ups first and everything else in
 * the order it was first logged — a workout read back in the order it
 * happened, rather than sorted by numbers that aren't comparable across
 * reps, seconds and meters.
 */
export function dayExerciseTotals(
  entries: ReadonlyArray<ExerciseEntry>,
  dateIso: string
): DayExerciseTotal[] {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.timestamp.slice(0, 10) !== dateIso) continue;
    const definition = findExerciseDefinition(entry.exerciseId);
    if (!definition) continue;
    const field = measurementValueField(definition.measurement);
    const value = Number(entry[field] ?? 0);
    if (!Number.isFinite(value) || value <= 0) continue;
    totals.set(entry.exerciseId, (totals.get(entry.exerciseId) ?? 0) + value);
  }
  const rows: DayExerciseTotal[] = [];
  for (const [exerciseId, value] of totals) {
    rows.push({
      exerciseId,
      value,
      unit: findExerciseDefinition(exerciseId)?.unit ?? '',
    });
  }
  return rows.sort((a, b) => {
    const aPushup = a.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID ? 0 : 1;
    const bPushup = b.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID ? 0 : 1;
    return aPushup - bPushup;
  });
}

/**
 * The day as one human line: `"40 Liegestütze, 60 Kniebeugen, 2:00 Plank"`.
 * Empty when nothing was logged — callers take that as "nothing to share".
 *
 * Beyond {@link SHARE_SUMMARY_MAX_EXERCISES} exercises the rest is counted
 * rather than listed, so the share text stays readable in a chat preview.
 */
export function formatDaySummary(
  totals: ReadonlyArray<DayExerciseTotal>,
  max: number = SHARE_SUMMARY_MAX_EXERCISES
): string {
  if (totals.length === 0) return '';
  const named = totals
    .slice(0, max)
    .map(
      (total) =>
        `${formatExerciseValue(total.value, total.unit)} ${exerciseDisplayName(
          total.exerciseId
        )}`
    )
    .join(', ');
  const rest = totals.length - Math.min(max, totals.length);
  if (rest === 0) return named;
  return `${named} ${$localize`:@@dashboard.share.moreExercises:+${rest}:count: weitere`}`;
}
