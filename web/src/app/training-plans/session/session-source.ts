import { computed, inject, InjectionToken, type Signal } from '@angular/core';
import type { PlanExerciseProgress, TrainingPlanDay } from '@pu-stats/models';

import { TrainingPlanStore } from '../training-plan.store';

/**
 * What a guided session walks. The session store and its selectors read
 * only this, so the same state machine drives today's plan day and a
 * workout the user composed — the two differ only in where the day and
 * its fulfillment come from.
 */
export interface SessionSource {
  /** 1-based index of the day being walked, `null` when there is none. */
  readonly dayIndex: Signal<number | null>;
  readonly day: Signal<TrainingPlanDay | null>;
  /** Per-exercise fulfillment of that day; reactive when called inside a `computed`. */
  dayProgress(dayIndex: number): ReadonlyArray<PlanExerciseProgress>;
}

/** The active training plan's current day, as the plan session walks it. */
export function planSessionSource(
  plan: Pick<
    InstanceType<typeof TrainingPlanStore>,
    'currentDayIndex' | 'todayDay' | 'dayProgress'
  >
): SessionSource {
  return {
    dayIndex: computed(() => plan.currentDayIndex()),
    day: computed(() => plan.todayDay()),
    dayProgress: (dayIndex) => plan.dayProgress(dayIndex),
  };
}

/**
 * Defaults to the training plan, so the plan session page needs no
 * provider; a workout session overrides it at component level.
 */
export const SESSION_SOURCE = new InjectionToken<SessionSource>(
  'SESSION_SOURCE',
  {
    providedIn: 'root',
    factory: () => planSessionSource(inject(TrainingPlanStore)),
  }
);
