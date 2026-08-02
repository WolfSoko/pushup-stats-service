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
    const payload = dailyGoalFillPayload(item);
    const userId = this.userContext.userIdSafe();
    if (!payload || !userId || !this.exerciseApi) {
      notifyError(this.snackBar);
      return payload ? 'error' : 'noop';
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

  private markPending(goalId: string, pending: boolean): void {
    const next = new Set(this._pending());
    if (pending) next.add(goalId);
    else next.delete(goalId);
    this._pending.set(next);
  }
}
