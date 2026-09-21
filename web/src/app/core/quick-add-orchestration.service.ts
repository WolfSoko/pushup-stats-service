import { computed, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import { PUSHUP_QUICK_ADD_EXERCISE_ID } from '@pu-stats/models';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
import {
  QuickAddBridgeService,
  type QuickAddSuggestion,
  suggestionBusyKey,
} from '@pu-stats/quick-add';
import { createKeyedBusyState } from '@pu-stats/ui';
import { firstValueFrom } from 'rxjs';

import { AppDataFacade } from './app-data.facade';
import { QuickAddCaptureFlowService } from './quick-add-capture-flow.service';
import {
  notifyEntrySaved,
  notifyError,
  notifyGoalReached,
} from './quick-add-notify';

@Injectable({ providedIn: 'root' })
export class QuickAddOrchestrationService {
  private readonly exerciseApi = inject(ExerciseFirestoreService, {
    optional: true,
  });
  private readonly userContext = inject(UserContextService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly router = inject(Router);
  private readonly quickAddBridge = inject(QuickAddBridgeService);
  private readonly appData = inject(AppDataFacade);
  private readonly captureFlow = inject(QuickAddCaptureFlowService);

  /**
   * One key per speed-dial action (`fillToGoal`, `autoCount`,
   * `exerciseTimer`, `stopwatch`, `customDialog`, `suggestionBusyKey()`),
   * rendered by the FAB as a spinner on the pressed button. The capture
   * flows are busy only until their dialog is open, not until it closes.
   */
  private readonly busy = createKeyedBusyState<string>();
  readonly busyKeys = this.busy.busyKeys;
  readonly fillToGoalInFlight = computed(() => this.busy.isBusy('fillToGoal'));

  /**
   * Pushup rows flow through the legacy `pushups` collection; every other
   * catalog id is written to `exerciseEntries`, so the two paths diverge here.
   */
  addSuggestion(suggestion: QuickAddSuggestion): Promise<void> {
    return this.busy.run(suggestionBusyKey(suggestion), () =>
      suggestion.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID
        ? this.add(suggestion.reps)
        : this.addExerciseQuickEntry(suggestion)
    );
  }

  private async addExerciseQuickEntry(
    suggestion: QuickAddSuggestion
  ): Promise<void> {
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) {
      notifyError(this.snackBar);
      return;
    }
    try {
      await firstValueFrom(
        this.exerciseApi.createEntry(userId, {
          exerciseId: suggestion.exerciseId,
          timestamp: nowLocalIsoTimestamp(),
          reps: suggestion.reps,
          source: 'quick-add',
        })
      );
      notifyEntrySaved(this.snackBar);
      this.appData.reloadAfterMutation();
    } catch (err) {
      notifyError(this.snackBar, err);
    }
  }

  async add(reps: number): Promise<void> {
    const entry$ = this.createPushupEntry(reps, 'quick-add');
    if (!entry$) return;
    try {
      await firstValueFrom(entry$);
      notifyEntrySaved(this.snackBar);
      this.appData.reloadAfterMutation();
    } catch (err) {
      notifyError(this.snackBar, err);
    }
  }

  async fillToGoal(): Promise<void> {
    if (this.busy.isBusy('fillToGoal')) return;
    const gap = this.appData.remainingToGoal();
    if (gap <= 0) return;
    const entry$ = this.createPushupEntry(gap, 'goal-fill');
    if (!entry$) return;

    await this.busy.run('fillToGoal', async () => {
      try {
        await firstValueFrom(entry$);
        notifyGoalReached(this.snackBar);
        this.appData.reloadAfterMutation();
      } catch (err) {
        notifyError(this.snackBar, err);
      }
    });
  }

  /**
   * Builds the legacy-pushup `createEntry` observable, or opens the error
   * snackbar and returns `null` when there is no signed-in user or the
   * Firestore API is unavailable (SSR / unauthenticated). Returning `null`
   * lets callers bail before flipping any in-flight state.
   */
  private createPushupEntry(
    reps: number,
    source: string
  ): ReturnType<ExerciseFirestoreService['createEntry']> | null {
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) {
      notifyError(this.snackBar);
      return null;
    }
    return this.exerciseApi.createEntry(userId, {
      exerciseId: 'pushup',
      timestamp: nowLocalIsoTimestamp(),
      reps,
      sets: [reps],
      source,
    });
  }

  openDialog(): Promise<void> {
    const currentPath = this.router.url.split('?')[0];
    if (currentPath === '/app' || currentPath.startsWith('/app/')) {
      this.quickAddBridge.requestOpenDialog();
      return Promise.resolve();
    }
    return this.busy.run('customDialog', () =>
      this.router.navigate(['/app']).then(
        (navigated) => {
          if (navigated) {
            this.quickAddBridge.requestOpenDialog();
          }
        },
        () => {
          // Navigation failed or was cancelled; do not open the dialog.
        }
      )
    );
  }

  /** `preselect` is a catalog id (or the pushup sentinel). */
  openAutoCount(preselect?: string): Promise<void> {
    return this.busy.run('autoCount', () =>
      this.captureFlow.openAutoCount(preselect)
    );
  }

  openExerciseTimer(): Promise<void> {
    return this.busy.run('exerciseTimer', () =>
      this.captureFlow.openExerciseTimer()
    );
  }

  openStopwatch(): Promise<void> {
    return this.busy.run('stopwatch', () => this.captureFlow.openStopwatch());
  }
}
