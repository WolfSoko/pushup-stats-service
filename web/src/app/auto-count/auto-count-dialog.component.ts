import { DecimalPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  PROXIMITY_ANGLE_SPAN_DEG,
  PROXIMITY_REP_COUNTER,
  REP_COUNTER,
} from '@pu-stats/auto-count';
import { PUSHUP_QUICK_ADD_EXERCISE_ID } from '@pu-stats/models';

import { WakeLockService } from '../core/wake-lock.service';
import {
  buildExerciseOptions,
  type ExerciseOption,
  resolveMode,
} from './auto-count-dialog.options';
import { CameraService } from './camera.service';

/**
 * How reps are detected: `pose` reads joint angles with the camera
 * facing the user, `proximity` reads the brightness swing with the
 * phone lying face-up beneath the user. Which of the two an exercise
 * offers comes from the catalog (`captureMethodsFor`).
 */
export type AutoCountMode = 'pose' | 'proximity';

export interface AutoCountResult {
  /** Catalog id (or the `'pushup'` sentinel) the reps were counted for. */
  readonly exerciseId: string;
  readonly reps: number;
}

/**
 * Optional dialog data: `initialExerciseId` (a catalog id) selects which
 * exercise is active when the dialog opens, `initialMode` the detector —
 * both fall back to what the exercise supports.
 */
export interface AutoCountDialogData {
  readonly initialExerciseId?: string;
  readonly initialMode?: AutoCountMode;
}

@Component({
  selector: 'app-auto-count-dialog',
  standalone: true,
  imports: [
    DecimalPipe,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './auto-count-dialog.component.html',
  styleUrl: './auto-count-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoCountDialogComponent {
  private readonly camera = inject(CameraService);
  private readonly poseCounter = inject(REP_COUNTER);
  private readonly proximityCounter = inject(PROXIMITY_REP_COUNTER);
  private readonly dialogRef = inject(
    MatDialogRef<AutoCountDialogComponent, AutoCountResult | null>
  );
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogData = inject<AutoCountDialogData | null>(
    MAT_DIALOG_DATA,
    { optional: true }
  );

  protected readonly videoRef =
    viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly exercises: ReadonlyArray<ExerciseOption> =
    buildExerciseOptions();

  protected readonly isStarting = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly switching = signal(false);
  protected readonly exerciseId = signal<string>(
    this.initialExerciseId(this.dialogData?.initialExerciseId)
  );
  protected readonly formCheckOpen = signal(true);
  protected readonly option = computed(
    () =>
      this.exercises.find((o) => o.id === this.exerciseId()) ??
      this.exercises[0]
  );
  protected readonly poseSupported = computed(
    () => this.option().poseProfile !== null
  );
  protected readonly proximitySupported = computed(
    () => this.option().proximity
  );
  protected readonly mode = signal<AutoCountMode>(
    resolveMode(this.dialogData?.initialMode ?? 'pose', this.option())
  );
  protected readonly isProximity = computed(() => this.mode() === 'proximity');
  /** The detector behind the active mode; the template never sees the other. */
  protected readonly counter = computed(() =>
    this.isProximity() ? this.proximityCounter : this.poseCounter
  );

  protected readonly count = computed(() => this.counter().snapshot().count);
  protected readonly phase = computed(() => this.counter().snapshot().phase);
  protected readonly frame = computed(() => this.counter().formCheckFrame());
  /** Near/far position as a percentage, from the proximity counter's angle. */
  protected readonly proximityPercent = computed(() => {
    const f = this.frame();
    if (!f) return null;
    return (1 - f.angleDeg / PROXIMITY_ANGLE_SPAN_DEG) * 100;
  });
  protected readonly phaseLabel = computed(() => {
    switch (this.phase()) {
      case 'up':
        return $localize`:@@autoCount.formCheck.phase.up:Oben`;
      case 'down':
        return $localize`:@@autoCount.formCheck.phase.down:Unten`;
      default:
        return $localize`:@@autoCount.formCheck.phase.waiting:Bereit`;
    }
  });

  private tornDown = false;

  constructor() {
    inject(WakeLockService).keepAwakeWhile(() => this.counter().isActive());
    afterNextRender(async () => {
      const video = this.videoRef().nativeElement;
      try {
        await this.camera.open(video);
        this.counter().bindVideoElement(video);
        await this.counter().start({ exerciseId: this.detectorExerciseId() });
      } catch (err) {
        this.error.set(err instanceof Error ? err.message : String(err));
      } finally {
        this.isStarting.set(false);
      }
    });

    this.destroyRef.onDestroy(() => {
      void this.teardown();
    });
  }

  /**
   * Switch exercise on the same camera stream. The mode follows what the
   * new exercise supports, so a proximity-only exercise (burpees) lands
   * on the proximity detector and a pose-only one (sit-ups) on the pose
   * detector; the previous counter is stopped + reset before the next one
   * starts so a count never leaks across.
   */
  protected async onExerciseChange(next: string): Promise<void> {
    if (next === this.exerciseId() || this.switching()) return;
    if (!this.exercises.some((o) => o.id === next)) return;
    const previous = this.counter();
    this.exerciseId.set(next);
    this.mode.set(resolveMode(this.mode(), this.option()));
    await this.restart(previous);
  }

  protected async onModeChange(next: AutoCountMode): Promise<void> {
    if (next === this.mode() || this.switching()) return;
    if (resolveMode(next, this.option()) !== next) return;
    const previous = this.counter();
    this.mode.set(next);
    await this.restart(previous);
  }

  protected save(): void {
    const reps = this.count();
    if (reps <= 0) {
      this.dialogRef.close(null);
      return;
    }
    this.dialogRef.close({ exerciseId: this.exerciseId(), reps });
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }

  protected reset(): void {
    this.counter().reset();
  }

  protected toggleFormCheck(): void {
    this.formCheckOpen.update((open) => !open);
  }

  /** Pose profile id for the pose detector, catalog id for the proximity one. */
  private detectorExerciseId(): string {
    return this.isProximity()
      ? this.option().id
      : (this.option().poseProfile ?? this.option().id);
  }

  private initialExerciseId(requested: string | undefined): string {
    if (requested && this.exercises.some((o) => o.id === requested)) {
      return requested;
    }
    return (
      this.exercises.find((o) => o.id === PUSHUP_QUICK_ADD_EXERCISE_ID)?.id ??
      this.exercises[0].id
    );
  }

  private async restart(previous: {
    stop(): Promise<void>;
    reset(): void;
  }): Promise<void> {
    this.switching.set(true);
    this.error.set(null);
    try {
      await previous.stop();
      previous.reset();
      const current = this.counter();
      if (current !== previous) {
        current.bindVideoElement(this.videoRef().nativeElement);
      }
      await current.start({ exerciseId: this.detectorExerciseId() });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.switching.set(false);
    }
  }

  private async teardown(): Promise<void> {
    if (this.tornDown) return;
    this.tornDown = true;
    await this.counter().stop();
    await this.camera.close();
  }
}
