import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { TrainingPlan } from '@pu-stats/models';

import { PlanSwitchDialogService } from './plan-switch-dialog.service';
import { StartPlanOutcome, TrainingPlanStore } from './training-plan.store';

/** `'cancelled'` when the user backed out of the switch prompt. */
export type PlanStartResult = StartPlanOutcome | 'cancelled';

/**
 * Activating a plan, including what happens to the one it replaces.
 *
 * Only one plan is active at a time and activating another overwrites the
 * user's plan document, so a switch has to decide the fate of the
 * outgoing plan's progress before anything is written. That decision, the
 * prompt behind it and the feedback afterwards live here rather than in
 * the detail page, which only needs to know whether to clean up its
 * `autoStart` query param.
 */
@Injectable({ providedIn: 'root' })
export class PlanStartService {
  private readonly store = inject(TrainingPlanStore);
  private readonly snackbar = inject(MatSnackBar);
  private readonly switchDialog = inject(PlanSwitchDialogService);

  /**
   * Whether replacing the active plan would cost the user progress.
   * Re-starting the plan already running is not a switch, and a plan with
   * nothing recorded has nothing at stake worth a dialog.
   */
  private switchWouldCostProgress(planId: string): boolean {
    const active = this.store.activePlan();
    return (
      this.store.hasActivePlan() &&
      active !== null &&
      active.planId !== planId &&
      this.store.activePlanHasProgress()
    );
  }

  /** Start `plan`, asking about the outgoing plan's progress if any. */
  async start(
    plan: Pick<TrainingPlan, 'id' | 'title'>
  ): Promise<PlanStartResult> {
    let keepCurrentProgress = true;
    if (this.switchWouldCostProgress(plan.id)) {
      const active = this.store.activePlan();
      const choice = await this.switchDialog.confirmSwitch({
        currentPlanTitle: this.store.activeCatalog()?.title ?? '',
        nextPlanTitle: plan.title,
        currentDayIndex: this.store.currentDayIndex() ?? 1,
        completedDays: active?.completedDays.length ?? 0,
      });
      if (choice === null) return 'cancelled';
      keepCurrentProgress = choice === 'keep';
    }
    const outcome = await this.store.start(plan.id, { keepCurrentProgress });
    if (outcome !== 'noop') this.report(outcome, plan.id);
    return outcome;
  }

  /**
   * A resumed plan reopens at the day the user left rather than at day 1,
   * which is a surprise worth naming — with a way straight back out of it.
   */
  private report(outcome: StartPlanOutcome, planId: string): void {
    if (outcome !== 'resumed') {
      this.snackbar.open(
        $localize`:@@trainingPlans.started:Plan gestartet — viel Erfolg!`,
        undefined,
        { duration: 3000 }
      );
      return;
    }
    const day = this.store.currentDayIndex() ?? 1;
    this.snackbar
      .open(
        $localize`:@@trainingPlans.resumed:Plan bei Tag ${day}:INTERPOLATION: fortgesetzt.`,
        $localize`:@@trainingPlans.resumeUndo:Von vorn beginnen`,
        { duration: 8000 }
      )
      .onAction()
      .subscribe(() => void this.restart(planId));
  }

  /** Start a resumed plan over, discarding what was picked back up. */
  private async restart(planId: string): Promise<void> {
    await this.store.start(planId, {
      keepCurrentProgress: false,
      restart: true,
    });
    this.snackbar.open(
      $localize`:@@trainingPlans.restarted:Plan von vorn begonnen.`,
      undefined,
      { duration: 3000 }
    );
  }
}
