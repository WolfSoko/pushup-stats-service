import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import type { ExerciseToggle } from './plan-day-exercises.component';
import type { TestResultSubmit } from './plan-test-input.component';
import { LogPlanDayResult, TrainingPlanStore } from './training-plan.store';
import {
  messageForLogResult,
  messageForResetResult,
  messageForTestResult,
} from './training-plan-detail.helpers';

/**
 * The actions a plan day offers, each paired with the feedback it owes
 * the user. Bound straight from the detail page's template so the
 * component stays about resolving the plan and building rows.
 */
@Injectable({ providedIn: 'root' })
export class PlanDayActionsService {
  private readonly store = inject(TrainingPlanStore);
  private readonly snackbar = inject(MatSnackBar);

  async mark(dayIndex: number): Promise<void> {
    await this.store.markDayDone(dayIndex);
  }

  async unmark(dayIndex: number): Promise<void> {
    await this.store.unmarkDayDone(dayIndex);
  }

  async skip(dayIndex: number): Promise<void> {
    await this.store.skipDay(dayIndex);
    this.notify($localize`:@@trainingPlans.skipped:Tag übersprungen.`, 2000);
  }

  async unskip(dayIndex: number): Promise<void> {
    await this.store.unskipDay(dayIndex);
  }

  async jumpToDay(dayIndex: number): Promise<void> {
    await this.store.jumpToDay(dayIndex);
    this.notify(
      $localize`:@@trainingPlans.jumped:Auf Tag ${dayIndex}:INTERPOLATION: gesprungen.`,
      2500
    );
  }

  async logPlanDay(dayIndex: number): Promise<void> {
    this.report(messageForLogResult(await this.store.logPlanDay(dayIndex)));
  }

  async logExercise(dayIndex: number, itemIndex: number): Promise<void> {
    this.report(
      messageForLogResult(await this.store.logPlanExercise(dayIndex, itemIndex))
    );
  }

  async toggleExercise(dayIndex: number, event: ExerciseToggle): Promise<void> {
    await this.store.setItemDone(dayIndex, event.itemIndex, event.done);
  }

  async resetExercise(dayIndex: number, itemIndex: number): Promise<void> {
    this.report(
      messageForResetResult(
        await this.store.resetPlanExercise(dayIndex, itemIndex)
      )
    );
  }

  async recordTest(dayIndex: number, event: TestResultSubmit): Promise<void> {
    this.report(
      messageForTestResult(
        await this.store.recordTestResult(
          dayIndex,
          event.itemIndex,
          event.value
        )
      )
    );
  }

  async clearTest(dayIndex: number, itemIndex: number): Promise<void> {
    if (!(await this.store.clearTestResult(dayIndex, itemIndex))) return;
    this.notify(
      $localize`:@@trainingPlans.test.cleared:Wert verworfen — dafür gelten wieder die normalen Planwerte.`,
      3000
    );
  }

  /** Outcomes that warrant no message resolve to null and say nothing. */
  private report(message: string | null): void {
    if (message) this.notify(message, 3000);
  }

  private notify(message: string, duration: number): void {
    this.snackbar.open(message, undefined, { duration });
  }
}

export type { LogPlanDayResult };
