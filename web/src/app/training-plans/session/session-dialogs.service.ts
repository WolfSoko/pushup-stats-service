import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import {
  AUTO_COUNT_DIALOG_CONFIG,
  EXERCISE_TIMER_DIALOG_CONFIG,
  STOPWATCH_DIALOG_CONFIG,
  TRAINING_ENTRY_DIALOG_CONFIG,
} from '../../core/quick-add-orchestration.models';

import type {
  AutoCountResult,
  ExerciseTimerExerciseId,
  ExerciseTimerResult,
  StopwatchResult,
  TrainingEntryDialogData,
  TrainingEntryDialogResult,
} from '../../core/quick-add-orchestration.models';

/**
 * Opens the capture tools a session step can hand off to.
 *
 * A service rather than plain functions so tests can substitute it
 * through Angular DI — the Angular unit-test system rejects module-level
 * mocking of relative imports, and the alternative (driving real dialogs)
 * would pull MediaPipe into every session test.
 *
 * Each dialog component is dynamic-imported at call time so the camera
 * code stays out of the session page's chunk until a tool is opened.
 * Every method resolves to `null` when the user dismissed the dialog.
 */
@Injectable({ providedIn: 'root' })
export class SessionDialogsService {
  private readonly dialog = inject(MatDialog);

  async openAutoCount(
    initialExerciseId: string
  ): Promise<AutoCountResult | null> {
    const { AutoCountDialogComponent } =
      await import('../../auto-count/auto-count-dialog.component');
    const ref = this.dialog.open(AutoCountDialogComponent, {
      ...AUTO_COUNT_DIALOG_CONFIG,
      data: { initialExerciseId },
    });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }

  async openHoldTimer(
    initialExerciseId: ExerciseTimerExerciseId,
    targetSec: number
  ): Promise<ExerciseTimerResult | null> {
    const { ExerciseTimerDialogComponent } =
      await import('../../auto-count/exercise-timer-dialog.component');
    const ref = this.dialog.open(ExerciseTimerDialogComponent, {
      ...EXERCISE_TIMER_DIALOG_CONFIG,
      data: { initialExerciseId, targetSec },
    });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }

  async openStopwatch(
    exerciseId: string,
    targetSec: number
  ): Promise<StopwatchResult | null> {
    const { StopwatchDialogComponent } =
      await import('../../stats/components/stopwatch/stopwatch-dialog.component');
    const ref = this.dialog.open(StopwatchDialogComponent, {
      ...STOPWATCH_DIALOG_CONFIG,
      data: { exerciseId, targetSec },
    });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }

  async openEntryDialog(
    data: TrainingEntryDialogData
  ): Promise<TrainingEntryDialogResult | null> {
    const { TrainingEntryDialogComponent } =
      await import('../../stats/components/training-entry-dialog/training-entry-dialog.component');
    const ref = this.dialog.open(TrainingEntryDialogComponent, {
      ...TRAINING_ENTRY_DIALOG_CONFIG,
      data,
    });
    return (await firstValueFrom(ref.afterClosed())) ?? null;
  }
}
