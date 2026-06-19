import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import { PUSHUP_QUICK_ADD_EXERCISE_ID } from '@pu-stats/models';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
import {
  QuickAddBridgeService,
  type QuickAddSuggestion,
} from '@pu-stats/quick-add';
import { firstValueFrom } from 'rxjs';

import { AppDataFacade } from './app-data.facade';
import { QuickAddCaptureFlowService } from './quick-add-capture-flow.service';
import {
  notifyEntrySaved,
  notifyError,
  notifyGoalReached,
} from './quick-add-notify';

import type { AutoCountExerciseId } from './quick-add-orchestration.models';

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

  private readonly _fillToGoalInFlight = signal(false);
  readonly fillToGoalInFlight = this._fillToGoalInFlight.asReadonly();

  /**
   * Pushup rows flow through the legacy `pushups` collection; every other
   * catalog id is written to `exerciseEntries`, so the two paths diverge here.
   */
  addSuggestion(suggestion: QuickAddSuggestion): void {
    if (suggestion.exerciseId === PUSHUP_QUICK_ADD_EXERCISE_ID) {
      this.add(suggestion.reps);
      return;
    }
    void this.addExerciseQuickEntry(suggestion);
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

  add(reps: number): void {
    const entry$ = this.createPushupEntry(reps, 'quick-add');
    if (!entry$) return;
    entry$.subscribe({
      next: () => {
        notifyEntrySaved(this.snackBar);
        this.appData.reloadAfterMutation();
      },
      error: (err) => notifyError(this.snackBar, err),
    });
  }

  fillToGoal(): void {
    if (this._fillToGoalInFlight()) return;
    const gap = this.appData.remainingToGoal();
    if (gap <= 0) return;
    const entry$ = this.createPushupEntry(gap, 'goal-fill');
    if (!entry$) return;

    this._fillToGoalInFlight.set(true);
    entry$.subscribe({
      next: () => {
        notifyGoalReached(this.snackBar);
        this.appData.reloadAfterMutation();
        this._fillToGoalInFlight.set(false);
      },
      error: (err) => {
        notifyError(this.snackBar, err);
        this._fillToGoalInFlight.set(false);
      },
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

  openDialog(): void {
    const currentPath = this.router.url.split('?')[0];
    if (currentPath === '/app' || currentPath.startsWith('/app/')) {
      this.quickAddBridge.requestOpenDialog();
    } else {
      void this.router.navigate(['/app']).then(
        (navigated) => {
          if (navigated) {
            this.quickAddBridge.requestOpenDialog();
          }
        },
        () => {
          // Navigation failed or was cancelled; do not open the dialog.
        }
      );
    }
  }

  openAutoCount(preselect?: AutoCountExerciseId): Promise<void> {
    return this.captureFlow.openAutoCount(preselect);
  }

  openExerciseTimer(): Promise<void> {
    return this.captureFlow.openExerciseTimer();
  }
}
