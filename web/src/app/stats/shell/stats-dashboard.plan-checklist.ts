import { computed, Signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { isPlanDayFulfilled, PlanExerciseProgress } from '@pu-stats/models';
import { buildExerciseRows } from '../../training-plans/training-plan-detail.exercises';
import {
  messageForLogResult,
  messageForResetResult,
} from '../../training-plans/training-plan-detail.helpers';
import { DayExerciseRow } from '../../training-plans/training-plan-detail.models';
import { ExerciseToggle } from '../../training-plans/plan-day-exercises.component';
import { TrainingPlanStore } from '../../training-plans/training-plan.store';

type Store = InstanceType<typeof TrainingPlanStore>;

/**
 * Today's plan-day checklist, derived from the active `TrainingPlanStore` —
 * one row per prescribed exercise rather than the single pushup-equivalent
 * figure `dailyGoal`/`planTodayTarget` mirror. Shared by the dashboard's
 * "Zielfortschritt" card, which renders `exerciseRows` through the same
 * `<app-plan-day-exercises>` component the plan detail page uses.
 */
export interface PlanTodayView {
  readonly dayIndex: Signal<number | null>;
  readonly exerciseRows: Signal<DayExerciseRow[]>;
  /** True once every exercise of today's plan day is done. */
  readonly fulfilled: Signal<boolean>;
}

export function planTodayView(trainingPlans: Store): PlanTodayView {
  const dayIndex = computed(() => trainingPlans.currentDayIndex());
  const progress = computed<ReadonlyArray<PlanExerciseProgress>>(() => {
    const idx = dayIndex();
    return idx === null ? [] : trainingPlans.dayProgress(idx);
  });
  return {
    dayIndex,
    exerciseRows: computed(() => buildExerciseRows(progress())),
    fulfilled: computed(() => isPlanDayFulfilled(progress())),
  };
}

function report(snackbar: MatSnackBar, message: string | null): void {
  if (message) snackbar.open(message, undefined, { duration: 3000 });
}

/** Logs every exercise today's plan day still prescribes and marks it done —
 *  the plan-aware counterpart of the legacy pushup-only "fill to goal". */
export async function logPlanToday(
  trainingPlans: Store,
  snackbar: MatSnackBar
): Promise<void> {
  report(snackbar, messageForLogResult(await trainingPlans.logTodayPlanDay()));
}

/** One-click log for a single exercise of today's plan day. */
export async function logPlanTodayExercise(
  trainingPlans: Store,
  snackbar: MatSnackBar,
  dayIndex: number | null,
  itemIndex: number
): Promise<void> {
  if (dayIndex === null) return;
  report(
    snackbar,
    messageForLogResult(
      await trainingPlans.logPlanExercise(dayIndex, itemIndex)
    )
  );
}

/** Manual check-off (or un-check) of a single plan exercise. */
export async function togglePlanTodayExercise(
  trainingPlans: Store,
  dayIndex: number | null,
  event: ExerciseToggle
): Promise<void> {
  if (dayIndex === null) return;
  await trainingPlans.setItemDone(dayIndex, event.itemIndex, event.done);
}

/** Re-opens a single plan exercise, dropping the entries it wrote. */
export async function resetPlanTodayExercise(
  trainingPlans: Store,
  snackbar: MatSnackBar,
  dayIndex: number | null,
  itemIndex: number
): Promise<void> {
  if (dayIndex === null) return;
  report(
    snackbar,
    messageForResetResult(
      await trainingPlans.resetPlanExercise(dayIndex, itemIndex)
    )
  );
}
