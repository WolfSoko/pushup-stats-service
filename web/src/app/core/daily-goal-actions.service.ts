import { computed, inject, Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
import { firstValueFrom } from 'rxjs';

import { AppDataFacade } from './app-data.facade';
import {
  type DailyGoalItemView,
  dailyGoalFillPayload,
} from './daily-goal.helpers';
import { PlanGoalsService } from './plan-goals.service';
import { notifyEntrySaved, notifyError } from './quick-add-notify';

/** Outcome of a single check-off, for callers that report it. */
export type CompleteGoalResult =
  'logged' | 'already-reached' | 'noop' | 'error';

/**
 * Checking a daily goal off writes the entry that closes its gap — goals
 * have no completion flag of their own, they are scored from entries, so
 * "abhaken" has to mean "log what's missing". Shared by the dashboard
 * checklist and the Quick-Add goal submenu.
 */
@Injectable({ providedIn: 'root' })
export class DailyGoalActionsService {
  private readonly exerciseApi = inject(ExerciseFirestoreService, {
    optional: true,
  });
  private readonly userContext = inject(UserContextService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly appData = inject(AppDataFacade);
  private readonly planGoals = inject(PlanGoalsService);

  private readonly _pending = signal<ReadonlySet<string>>(new Set());

  /** Goal ids with an in-flight check-off write. */
  readonly pending = this._pending.asReadonly();
  readonly anyPending = computed(() => this._pending().size > 0);

  isPending(goalId: string): boolean {
    return this._pending().has(goalId);
  }

  /** Today's goals, ready to be rendered as a checklist. */
  readonly items = this.appData.dailyGoalBreakdown;

  async complete(item: DailyGoalItemView): Promise<CompleteGoalResult> {
    if (item.reached) return 'already-reached';
    if (this.isPending(item.id)) return 'noop';
    if (this.planGoals.isPlanGoal(item.id)) {
      return this.completePlanGoal(item.id);
    }
    const payload = dailyGoalFillPayload(item);
    if (!payload) {
      // Not a failure: the goal needs a companion value only a real entry
      // can carry, so point the user at the entry dialog instead of
      // flashing a generic error.
      this.snackBar.open(
        $localize`:@@dailyGoal.check.manual:Dieses Ziel braucht einen manuellen Eintrag`,
        '',
        { duration: 3000 }
      );
      return 'noop';
    }
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) {
      notifyError(this.snackBar);
      return 'error';
    }
    this.markPending(item.id, true);
    try {
      await firstValueFrom(
        this.exerciseApi.createEntry(userId, {
          exerciseId: payload.exerciseId,
          ...(payload.variantId ? { variantId: payload.variantId } : {}),
          timestamp: nowLocalIsoTimestamp(),
          [payload.valueField]: payload.value,
          [payload.breakdownField]: payload.breakdown,
          source: 'goal-fill',
        })
      );
      notifyEntrySaved(this.snackBar);
      this.appData.reloadAfterMutation();
      return 'logged';
    } catch (err) {
      notifyError(this.snackBar, err);
      return 'error';
    } finally {
      this.markPending(item.id, false);
    }
  }

  /**
   * Plan goals close through the plan's own action, which logs the
   * prescribed sets *and* ticks the exercise off. Writing a plain fill
   * entry instead would leave a `checkoff` day untouched — its progress
   * is decided by the tick alone.
   */
  private async completePlanGoal(goalId: string): Promise<CompleteGoalResult> {
    this.markPending(goalId, true);
    try {
      const result = await this.planGoals.complete(goalId);
      if (result === 'noop') return 'noop';
      if (result === 'logged') notifyEntrySaved(this.snackBar);
      this.appData.reloadAfterMutation();
      return result === 'logged' ? 'logged' : 'already-reached';
    } catch (err) {
      notifyError(this.snackBar, err);
      return 'error';
    } finally {
      this.markPending(goalId, false);
    }
  }

  private markPending(goalId: string, pending: boolean): void {
    const next = new Set(this._pending());
    if (pending) next.add(goalId);
    else next.delete(goalId);
    this._pending.set(next);
  }
}
