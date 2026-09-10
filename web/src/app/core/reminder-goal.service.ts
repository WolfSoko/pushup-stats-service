import { computed, inject, Injectable } from '@angular/core';
import { LiveDataStore } from '@pu-stats/data-access-state';
import {
  dailyReminderGoal,
  planReminderGoal,
  PUSHUP_QUICK_ADD_EXERCISE_ID,
  type ReminderGoalState,
} from '@pu-stats/models';
import { toBerlinIsoDate } from '@pu-stats/date';

import { TrainingPlanStore } from '../training-plans/training-plan.store';
import { UserConfigStore } from './user-config.store';

/**
 * What the in-app reminder is about: today's training-plan day while a plan
 * is running, otherwise the configured daily goal. Wired into the reminders
 * lib through `REMINDER_GOAL_STATE`, which has no compile-time knowledge of
 * plans — and kept out of `GoalReachedNotificationService`, which answers a
 * different question (has a goal just been crossed).
 *
 * The plan wins over the daily goal, matching the toolbar pill: while a plan
 * is active, its day is what the user is working toward today.
 */
@Injectable({ providedIn: 'root' })
export class ReminderGoalService {
  private readonly plan = inject(TrainingPlanStore);
  private readonly userConfig = inject(UserConfigStore);
  private readonly live = inject(LiveDataStore);

  private readonly pushupsToday = computed(() => {
    const today = toBerlinIsoDate(new Date());
    return this.live
      .exerciseEntries()
      .filter(
        (e) =>
          e.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID &&
          e.timestamp.slice(0, 10) === today
      )
      .reduce((sum, e) => sum + (e.reps ?? 0), 0);
  });

  readonly goal = computed<ReminderGoalState | null>(() => {
    if (this.plan.hasActivePlan()) {
      const dayIndex = this.plan.currentDayIndex();
      if (dayIndex !== null) {
        const planGoal = planReminderGoal(
          this.plan.dayProgress(dayIndex),
          dayIndex
        );
        if (planGoal) return planGoal;
      }
    }
    // Before the config resource has emitted, `dailyGoal()` is 0 — which is
    // indistinguishable from "no goal configured", so never pause on it.
    if (!this.userConfig.loaded()) return null;
    return dailyReminderGoal(this.pushupsToday(), this.userConfig.dailyGoal());
  });
}
