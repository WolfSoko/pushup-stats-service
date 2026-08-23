import {
  type ComplexGoalEntry,
  entryBreakdownField,
  type ExerciseEntry,
  findExerciseDefinition,
  formatExerciseValue,
  type MeasurementType,
  measurementValueField,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  requiredCompanionFields,
} from '@pu-stats/models';
import { exerciseDisplayName } from '../stats/i18n/exercise-display-names';

/**
 * Per-exercise view of a single daily goal — exercise name, formatted
 * target and progress in the goal's native unit, and the completion share.
 * Shared by the dashboard goal checklist, the toolbar pill dropdown and
 * the Quick-Add goal submenu so all three render the same numbers.
 */
export interface DailyGoalItemView {
  readonly id: string;
  readonly exerciseId: string;
  readonly variantId?: string;
  readonly exerciseName: string;
  readonly measurement: MeasurementType;
  readonly unit: string;
  readonly target: number;
  readonly value: number;
  /** Missing amount in the goal's native unit; 0 once the goal is reached. */
  readonly remaining: number;
  readonly targetDisplay: string;
  readonly progressDisplay: string;
  readonly remainingDisplay: string;
  readonly percent: number;
  readonly reached: boolean;
  /**
   * Whether a one-click check-off can write a filling entry. False for
   * measurements whose entries need a companion value the goal doesn't
   * carry (`weight` needs a load, `distance-time` needs a duration) —
   * those stay manual-entry only.
   */
  readonly fillable: boolean;
}

/** Entry payload that closes the gap of a single daily goal. */
export interface DailyGoalFillPayload {
  readonly exerciseId: string;
  readonly variantId?: string;
  readonly valueField: ReturnType<typeof measurementValueField>;
  readonly value: number;
  readonly breakdownField: 'sets' | 'intervals';
  readonly breakdown: number[];
}

function goalExerciseName(exerciseId: string): string {
  // The pushup sentinel predates the display-name registry's catalog
  // coverage; resolve it to the same label the analysis page uses.
  return exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID
    ? $localize`:@@exercise.category.pushup:Liegestütze`
    : exerciseDisplayName(exerciseId);
}

/**
 * Per-exercise breakdown of the given goals with today's progress folded
 * in. `progress` is positional — index `i` is the amount logged for
 * `entries[i]`, in that entry's native unit.
 */
export function dailyGoalItemViews(
  entries: readonly ComplexGoalEntry[],
  progress: readonly number[]
): readonly DailyGoalItemView[] {
  return entries.map((entry, i) => {
    const value = progress[i] ?? 0;
    const target = entry.target;
    const hasTarget = target > 0;
    const remaining = hasTarget ? Math.max(0, target - value) : 0;
    return {
      id: entry.id,
      exerciseId: entry.exerciseId,
      ...(entry.variantId ? { variantId: entry.variantId } : {}),
      exerciseName: goalExerciseName(entry.exerciseId),
      measurement: entry.measurement,
      unit: entry.unit,
      target,
      value,
      remaining,
      targetDisplay: formatExerciseValue(target, entry.unit),
      progressDisplay: formatExerciseValue(value, entry.unit),
      remainingDisplay: formatExerciseValue(remaining, entry.unit),
      percent: hasTarget
        ? Math.min(100, Math.round((value / target) * 100))
        : 0,
      reached: hasTarget && value >= target,
      fillable: goalIsFillable(entry),
    };
  });
}

/**
 * Whether a one-click check-off is unavailable for this goal: already
 * reached, not fillable at all, or a write is still in flight. Shared so
 * the dashboard checklist and the Quick-Add submenu can never disagree
 * about which rows are actionable.
 */
export function goalCheckDisabled(
  item: Pick<DailyGoalItemView, 'id' | 'reached' | 'fillable'>,
  isPending: (goalId: string) => boolean
): boolean {
  return item.reached || !item.fillable || isPending(item.id);
}

function goalIsFillable(entry: ComplexGoalEntry): boolean {
  if (entry.target <= 0) return false;
  const def = findExerciseDefinition(entry.exerciseId);
  if (!def) return false;
  return requiredCompanionFields(def.measurement).length === 0;
}

/** Minimal shape of a logged entry needed to score a goal. */
export type GoalProgressEntry = Pick<ExerciseEntry, 'exerciseId'> &
  Partial<
    Pick<ExerciseEntry, 'variantId' | 'reps' | 'durationSec' | 'distanceM'>
  >;

/**
 * Amount logged towards each goal, positionally aligned with `entries`
 * and expressed in each goal's native unit. `todaysEntries` must already
 * be narrowed to the day the goals are scored against.
 *
 * When a goal pins a variant only that variant counts; otherwise every
 * entry for the exercise does — the goals page has no variant picker, so
 * "decline sit-ups" must still fill a generic "Sit-ups" goal.
 */
export function goalProgressValues(
  entries: readonly ComplexGoalEntry[],
  todaysEntries: readonly GoalProgressEntry[]
): readonly number[] {
  return entries.map((entry) => {
    const matching = todaysEntries.filter((e) => {
      if (e.exerciseId !== entry.exerciseId) return false;
      if (!entry.variantId) return true;
      return e.variantId === entry.variantId;
    });
    switch (entry.measurement) {
      case 'reps':
      case 'weight':
        return matching.reduce((sum, e) => sum + (e.reps ?? 0), 0);
      case 'time':
        return matching.reduce((sum, e) => sum + (e.durationSec ?? 0), 0);
      case 'distance':
      case 'distance-time':
        return matching.reduce((sum, e) => sum + (e.distanceM ?? 0), 0);
    }
  });
}

/**
 * Aggregated 0–100 completion across all goals (averaged, capped per
 * entry at 100% so one blown-out goal can't mask the others). Returns 0
 * when nothing with a positive target applies.
 */
export function aggregateGoalPercent(
  entries: readonly ComplexGoalEntry[],
  progress: readonly number[]
): number {
  let pctSum = 0;
  let counted = 0;
  for (let i = 0; i < entries.length; i++) {
    const target = entries[i].target;
    if (!target || target <= 0) continue;
    pctSum += Math.min(1, (progress[i] ?? 0) / target) * 100;
    counted += 1;
  }
  if (counted === 0) return 0;
  return Math.round(pctSum / counted);
}

/** True iff every goal with a positive target is covered. Empty ⇒ false. */
export function allGoalsReached(
  entries: readonly ComplexGoalEntry[],
  progress: readonly number[]
): boolean {
  if (entries.length === 0) return false;
  for (let i = 0; i < entries.length; i++) {
    if (entries[i].target <= 0) continue;
    if ((progress[i] ?? 0) < entries[i].target) return false;
  }
  return true;
}

/**
 * Entry payload that brings a goal up to its target, or null when the
 * goal is already covered or can't be written in one shot (unknown
 * exercise, or a measurement needing a companion value).
 *
 * The written amount is clamped into the exercise's catalog bounds:
 * a gap larger than `def.max` closes over several check-offs rather
 * than being rejected by validation, and a sub-minimum gap rounds up to
 * `def.min` (the smallest entry the catalog allows at all).
 */
export function dailyGoalFillPayload(
  item: Pick<
    DailyGoalItemView,
    'exerciseId' | 'variantId' | 'remaining' | 'fillable'
  >
): DailyGoalFillPayload | null {
  if (!item.fillable || item.remaining <= 0) return null;
  const def = findExerciseDefinition(item.exerciseId);
  if (!def) return null;
  const value = Math.max(
    def.min,
    Math.min(def.max, Math.round(item.remaining))
  );
  return {
    exerciseId: item.exerciseId,
    ...(item.variantId ? { variantId: item.variantId } : {}),
    valueField: measurementValueField(def.measurement),
    value,
    breakdownField: entryBreakdownField(def.measurement),
    breakdown: [value],
  };
}
