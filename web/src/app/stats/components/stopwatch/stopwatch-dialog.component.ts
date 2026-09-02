import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { findExerciseDefinition } from '@pu-stats/models';

import { exerciseDisplayName } from '../../i18n/exercise-display-names';
import { StopwatchComponent } from './stopwatch.component';
import { StopwatchState } from './stopwatch.state';

export interface StopwatchDialogData {
  /** Catalog id of the timed exercise the seconds are for. */
  readonly exerciseId: string;
  /** Prescribed seconds, rendered as the target; absent or 0 for none. */
  readonly targetSec?: number;
}

export interface StopwatchResult {
  readonly exerciseId: string;
  /** Stopped time in whole seconds. */
  readonly durationSec: number;
}

/**
 * Stopwatch for time-measured exercises that have no pose profile
 * (mountain climbers, wall sit, high knees, mobility holds). Unlike the
 * hold timer it never touches the camera, so it stays a small chunk. The
 * timer never stops itself at the target — the seconds actually managed
 * are what gets saved.
 */
@Component({
  selector: 'app-stopwatch-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    StopwatchComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stopwatch-dialog.component.html',
  styleUrl: './stopwatch-dialog.component.css',
})
export class StopwatchDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<StopwatchDialogComponent, StopwatchResult | null>
  );
  private readonly data = inject<StopwatchDialogData>(MAT_DIALOG_DATA);

  protected readonly stopwatch = new StopwatchState(
    isPlatformBrowser(inject(PLATFORM_ID))
  );
  protected readonly targetSec = Math.max(0, this.data.targetSec ?? 0);
  protected readonly exerciseName = exerciseDisplayName(this.data.exerciseId);
  protected readonly exerciseIcon =
    findExerciseDefinition(this.data.exerciseId)?.icon ?? 'timer';
  protected readonly canSave = computed(() => this.stopwatch.elapsedSec() > 0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopwatch.destroy());
  }

  protected save(): void {
    const durationSec = this.stopwatch.elapsedSec();
    if (durationSec <= 0) {
      this.dialogRef.close(null);
      return;
    }
    this.dialogRef.close({ exerciseId: this.data.exerciseId, durationSec });
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}
