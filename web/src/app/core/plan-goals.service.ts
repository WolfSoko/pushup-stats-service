import { computed, inject, Injectable } from '@angular/core';
import type { ComplexGoalEntry } from '@pu-stats/models';

import { TrainingPlanStore } from '../training-plans/training-plan.store';
import { type PlanDayGoal, planDayGoals } from './plan-goal-entries';

/** What a check-off of a plan goal did, mapped from the plan actions. */
export type PlanGoalCompleteResult = 'logged' | 'already-logged' | 'noop';

/**
 * Today's training-plan day as daily goals: the entries the toolbar and
 * dashboard render, their progress, and the write that closes them.
 *
 * Progress comes from the plan store's own `dayProgress` rather than
 * being re-derived from entries, so the toolbar can never disagree with
 * the plan page — manual tick-offs count, a `checkoff` day (HIIT, EMOM)
 * is scored by its ticks alone, and the activation cutoff that keeps
 * yesterday's reps out of today's day applies here too.
 */
@Injectable({ providedIn: 'root' })
export class PlanGoalsService {
  private readonly trainingPlan = inject(TrainingPlanStore);

  /** Today's plan day when a plan is active and today is no rest day. */
  readonly todayDay = computed(() => {
    if (!this.trainingPlan.hasActivePlan()) return null;
    const day = this.trainingPlan.todayDay();
    if (!day || day.kind === 'rest') return null;
    return day;
  });

  private readonly goals = computed<PlanDayGoal[]>(() =>
    planDayGoals(this.todayDay())
  );

  /** Today's plan goals — empty when no plan day applies. */
  readonly entries = computed<ComplexGoalEntry[]>(() =>
    this.goals().map((goal) => goal.entry)
  );

  /** Today's prescribed reps, as the legacy single-figure goal. */
  readonly targetReps = computed(() => this.todayDay()?.targetReps ?? 0);

  /** Progress per goal, in its unit, positionally aligned with `entries`. */
  readonly progress = computed<readonly number[]>(() => {
    const goals = this.goals();
    if (goals.length === 0) return [];
    const dayIndex = this.trainingPlan.currentDayIndex();
    if (dayIndex === null) return goals.map(() => 0);
    const items = this.trainingPlan.dayProgress(dayIndex);
    return goals.map((goal) =>
      goal.itemIndexes.reduce(
        (sum, itemIndex) => sum + (items[itemIndex]?.logged ?? 0),
        0
      )
    );
  });

  /** Whether `goalId` belongs to today's plan day. */
  isPlanGoal(goalId: string): boolean {
    return this.goals().some((goal) => goal.entry.id === goalId);
  }

  /**
   * Close a plan goal by logging and ticking off every item behind it.
   * Routed through `logPlanExercise` rather than a plain goal-fill entry
   * so the day's prescribed set breakdown is written, the item is ticked
   * (the only thing that closes a `checkoff` day), and the day itself is
   * marked done once its last exercise lands.
   */
  async complete(goalId: string): Promise<PlanGoalCompleteResult> {
    const goal = this.goals().find((g) => g.entry.id === goalId);
    const dayIndex = this.trainingPlan.currentDayIndex();
    if (!goal || dayIndex === null) return 'noop';
    const items = this.trainingPlan.dayProgress(dayIndex);
    let logged = false;
    let rejected = false;
    // Sequential: each write takes the plan day's lock, so a parallel
    // second item would just bounce off it as 'in-flight'.
    for (const itemIndex of goal.itemIndexes) {
      if (items[itemIndex]?.done) continue;
      const result = await this.trainingPlan.logPlanExercise(
        dayIndex,
        itemIndex
      );
      logged ||= result === 'logged';
      rejected ||= result !== 'logged' && result !== 'already-logged';
    }
    if (logged) return 'logged';
    // A rejected write (live data not synced yet, a concurrent write)
    // must not read as "was already done" — the goal is still open.
    return rejected ? 'noop' : 'already-logged';
  }
}
