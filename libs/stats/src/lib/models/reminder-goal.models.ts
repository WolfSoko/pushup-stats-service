import type { ReminderConfig } from './reminder-config.models';
import type { PlanExerciseProgress } from './training-plan-exercise.models';

/**
 * What a reminder points the user at: the active plan's day, or — with no
 * plan running — the configured daily goal. Shared by both reminder tiers
 * (in-app `ReminderService`, `dispatchPushReminders`) so the notification
 * body and the "pause once reached" gate agree on one notion of progress.
 *
 * The plan wins over the daily goal, matching the toolbar pill: while a
 * plan is active, its day *is* the user's target for today.
 */

export type ReminderGoalKind = 'plan' | 'daily';

/**
 * Progress toward the goal a reminder is about.
 *
 * `counts` says what `done`/`target` are measured in, because a plan day
 * prescribing several exercises has no single unit to add up:
 * - `'value'` — the exercise's own measurement (reps, or seconds for holds).
 * - `'items'` — finished exercises out of the day's list.
 */
export interface ReminderGoalState {
  readonly kind: ReminderGoalKind;
  /** 1-based plan day. Only set for `kind: 'plan'`. */
  readonly dayIndex?: number;
  readonly counts: 'value' | 'items';
  readonly done: number;
  readonly target: number;
  readonly reached: boolean;
}

/**
 * Goal state for a plan day from its per-exercise fulfillment. Returns
 * `null` when the day prescribes nothing trackable (rest day, or a day
 * whose exercises can't be measured) — there is no goal to report then.
 *
 * A single-exercise day reports the exercise's own numbers, which is what
 * the user recognises ("60/100"); only a day with several exercises falls
 * back to counting finished items.
 */
export function planReminderGoal(
  progress: ReadonlyArray<PlanExerciseProgress>,
  dayIndex: number
): ReminderGoalState | null {
  if (progress.length === 0) return null;
  if (progress.length === 1) {
    const [item] = progress;
    const target = item.exercise.target;
    if (target <= 0) return null;
    return {
      kind: 'plan',
      dayIndex,
      counts: 'value',
      done: Math.min(item.logged, target),
      target,
      reached: item.done,
    };
  }
  const done = progress.filter((p) => p.done).length;
  return {
    kind: 'plan',
    dayIndex,
    counts: 'items',
    done,
    target: progress.length,
    reached: done === progress.length,
  };
}

/**
 * Goal state for the configured daily pushup goal. Returns `null` when no
 * goal is configured — the reminder then carries no goal line and nothing
 * can pause it.
 */
export function dailyReminderGoal(
  doneReps: number,
  goalReps: number
): ReminderGoalState | null {
  if (!Number.isFinite(goalReps) || goalReps <= 0) return null;
  const done = Number.isFinite(doneReps) ? Math.max(0, doneReps) : 0;
  return {
    kind: 'daily',
    counts: 'value',
    done: Math.min(done, goalReps),
    target: goalReps,
    reached: done >= goalReps,
  };
}

/** Absent ⇒ on, so existing configs pause too (see `ReminderConfig`). */
export function isGoalPauseEnabled(
  config: Pick<ReminderConfig, 'pauseWhenGoalReached'> | undefined
): boolean {
  return config?.pauseWhenGoalReached !== false;
}

/** Whether this reminder should be held back because the goal is done. */
export function shouldPauseForReachedGoal(
  config: Pick<ReminderConfig, 'pauseWhenGoalReached'> | undefined,
  goal: ReminderGoalState | null
): boolean {
  return goal !== null && goal.reached && isGoalPauseEnabled(config);
}
