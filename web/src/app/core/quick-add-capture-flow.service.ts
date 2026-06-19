import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UserContextService } from '@pu-auth/auth';
import { ExerciseFirestoreService } from '@pu-stats/data-access';
import { nowLocalIsoTimestamp } from '@pu-stats/date';
import { firstValueFrom } from 'rxjs';

import { AppDataFacade } from './app-data.facade';
import {
  buildAutoCountPrefill,
  buildConfirmedEntryPayload,
  catalogIdForHoldTimerProfile,
} from './quick-add-orchestration.helpers';
import { notifyEntrySaved, notifyError } from './quick-add-notify';
import {
  AUTO_COUNT_DIALOG_CONFIG,
  EXERCISE_TIMER_DIALOG_CONFIG,
  TRAINING_ENTRY_DIALOG_CONFIG,
} from './quick-add-orchestration.models';

import type { AutoCountDialogComponent } from '../auto-count/auto-count-dialog.component';
import type { ExerciseTimerDialogComponent } from '../auto-count/exercise-timer-dialog.component';
import type { TrainingEntryDialogComponent } from '../stats/components/training-entry-dialog/training-entry-dialog.component';
import type {
  AutoCountExerciseId,
  AutoCountResult,
  ExerciseEntryDialogData,
  ExerciseTimerResult,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from './quick-add-orchestration.models';

/**
 * Camera / timer capture flow: opens a pose-detection dialog, then chains
 * into the training-entry dialog so the counted reps or held duration can be
 * confirmed before they are written. Split out of
 * `QuickAddOrchestrationService` so each owns one concern.
 */
@Injectable({ providedIn: 'root' })
export class QuickAddCaptureFlowService {
  private readonly exerciseApi = inject(ExerciseFirestoreService, {
    optional: true,
  });
  private readonly userContext = inject(UserContextService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly appData = inject(AppDataFacade);
  private readonly dialog = inject(MatDialog);

  /**
   * Admin-gated auto-counter flow. Goes through `MatDialog` directly (no
   * bridge) because both dialogs are self-contained — the dashboard isn't a
   * required host. Both dialog components are dynamic-imported so
   * MediaPipe-adjacent code stays out of the initial bundle until an admin
   * opens the camera.
   */
  async openAutoCount(preselect?: AutoCountExerciseId): Promise<void> {
    const { AutoCountDialogComponent } =
      await import('../auto-count/auto-count-dialog.component');
    this.dialog
      .open<
        AutoCountDialogComponent,
        { initialExerciseId?: AutoCountExerciseId } | undefined,
        AutoCountResult | null
      >(AutoCountDialogComponent, {
        ...AUTO_COUNT_DIALOG_CONFIG,
        ...(preselect ? { data: { initialExerciseId: preselect } } : {}),
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result || result.reps <= 0) return;
        void this.confirmAutoCount(result);
      });
  }

  /**
   * Timer dialog for isometric-hold exercises (plank, hollow hold), with an
   * optional pose-detection toggle that mirrors the rep-counter flow.
   */
  async openExerciseTimer(): Promise<void> {
    const { ExerciseTimerDialogComponent } =
      await import('../auto-count/exercise-timer-dialog.component');
    this.dialog
      .open<ExerciseTimerDialogComponent, void, ExerciseTimerResult | null>(
        ExerciseTimerDialogComponent,
        EXERCISE_TIMER_DIALOG_CONFIG
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result || result.durationSec <= 0) return;
        void this.confirmExerciseTimer(result);
      });
  }

  private async confirmExerciseTimer(
    result: ExerciseTimerResult
  ): Promise<void> {
    const exerciseId = catalogIdForHoldTimerProfile(result.exerciseId);
    if (!exerciseId) {
      notifyError(this.snackBar);
      return;
    }
    const data: ExerciseEntryDialogData = {
      kind: 'exercise',
      timestamp: nowLocalIsoTimestamp(),
      exerciseId,
      durationSec: result.durationSec,
    };
    await this.openTrainingEntryDialog(data, 'exercise-timer');
  }

  private async confirmAutoCount(result: AutoCountResult): Promise<void> {
    const data = buildAutoCountPrefill(result);
    if (!data) {
      notifyError(this.snackBar);
      return;
    }
    await this.openTrainingEntryDialog(data, 'auto-count');
  }

  private async openTrainingEntryDialog(
    data: TrainingEntryDialogData,
    exerciseSource: string
  ): Promise<void> {
    const { TrainingEntryDialogComponent } =
      await import('../stats/components/training-entry-dialog/training-entry-dialog.component');
    this.dialog
      .open<
        TrainingEntryDialogComponent,
        TrainingEntryDialogData,
        TrainingEntryDialogResult
      >(TrainingEntryDialogComponent, { data, ...TRAINING_ENTRY_DIALOG_CONFIG })
      .afterClosed()
      .subscribe((dialogResult) => {
        if (!dialogResult) return;
        void this.persistConfirmed(dialogResult, exerciseSource);
      });
  }

  private async persistConfirmed(
    result: TrainingEntryDialogResult,
    exerciseSource = 'web'
  ): Promise<void> {
    const userId = this.userContext.userIdSafe();
    if (!userId || !this.exerciseApi) {
      notifyError(this.snackBar);
      return;
    }
    try {
      await firstValueFrom(
        this.exerciseApi.createEntry(
          userId,
          buildConfirmedEntryPayload(result, exerciseSource)
        )
      );
      notifyEntrySaved(this.snackBar);
      this.appData.reloadAfterMutation();
    } catch (err) {
      notifyError(this.snackBar, err);
    }
  }
}
