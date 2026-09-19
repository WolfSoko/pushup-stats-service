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
  profileFor,
  PROXIMITY_REP_COUNTER,
  REP_COUNTER,
} from '@pu-stats/auto-count';

import { WakeLockService } from '../core/wake-lock.service';
import type {
  AutoCountDialogData,
  AutoCountMode,
  AutoCountResult,
} from './auto-count-dialog.models';
import {
  buildExerciseOptions,
  detectorExerciseId,
  type ExerciseOption,
  initialExerciseId,
  phaseLabelFor,
  proximityPercent,
  resolveMode,
} from './auto-count-dialog.options';
import { AutoCountConfirmComponent } from './auto-count-confirm.component';
import {
  AutoCountFeedbackFlow,
  type AutoCountRunContext,
} from './auto-count-feedback.flow';
import { AutoCountTuningPanelComponent } from './auto-count-tuning-panel.component';
import {
  isTuningPanelOpen,
  setTuningPanelOpen,
} from './auto-count-tuning.models';
import { AutoCountTuningStore } from './auto-count-tuning.store';
import { CameraService } from './camera.service';
import { PoseOverlayComponent } from './pose-overlay.component';

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
    AutoCountConfirmComponent,
    AutoCountTuningPanelComponent,
    PoseOverlayComponent,
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
  private readonly tuning = inject(AutoCountTuningStore);
  private readonly feedback = inject(AutoCountFeedbackFlow);
  private readonly dialogData = inject<AutoCountDialogData | null>(
    MAT_DIALOG_DATA,
    { optional: true }
  );

  protected readonly videoRef =
    viewChild.required<ElementRef<HTMLVideoElement>>('video');
  /**
   * Set once the camera is live. The overlay needs the element itself
   * (for `videoWidth`/`videoHeight`), and binding the `viewChild`
   * directly would read it before the view exists.
   */
  protected readonly videoEl = signal<HTMLVideoElement | null>(null);

  protected readonly exercises: ReadonlyArray<ExerciseOption> =
    buildExerciseOptions();

  protected readonly isStarting = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly switching = signal(false);
  protected readonly exerciseId = signal<string>(
    initialExerciseId(this.dialogData?.initialExerciseId, this.exercises)
  );
  protected readonly formCheckOpen = signal(true);
  /**
   * The count as it stood when the user pressed save, or null while
   * still counting. Frozen on purpose: the detector is stopped at that
   * moment, but an in-flight frame or a stray movement must not be able
   * to change the number the user is being asked about — answering
   * "Passt" would then book a different count than the one on screen,
   * and file it as an exact run.
   */
  protected readonly submittedReps = signal<number | null>(null);
  protected readonly confirming = computed(() => this.submittedReps() !== null);
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
  protected readonly proximityPercent = computed(() =>
    proximityPercent(this.frame())
  );
  protected readonly phaseLabel = computed(() => phaseLabelFor(this.phase()));
  /** Admins get the threshold sliders; pose mode only — proximity has no profile. */
  protected readonly canTune = computed(
    () => this.tuning.isAdmin() && !this.isProximity()
  );
  protected readonly tuningOpen = signal(isTuningPanelOpen());
  protected readonly showTuning = computed(
    () => this.canTune() && this.tuningOpen()
  );
  protected readonly tuningDefaults = computed<Record<string, number>>(
    () =>
      (profileFor(this.detectorExerciseId()) ?? {}) as unknown as Record<
        string,
        number
      >
  );
  /** Null in proximity mode (no landmarks) and while the overlay is off. */
  protected readonly skeleton = computed(() =>
    this.formCheckOpen() ? (this.frame()?.pose ?? null) : null
  );

  private tornDown = false;

  constructor() {
    inject(WakeLockService).keepAwakeWhile(() => this.counter().isActive());
    afterNextRender(async () => {
      const video = this.videoRef().nativeElement;
      this.videoEl.set(video);
      try {
        // Before `start()`: the detector reads its thresholds once, when
        // the state machine is built.
        await this.tuning.ensureLoaded();
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
    if (!this.feedback.shouldAsk()) {
      this.closeWith(reps);
      return;
    }
    // The set is over; keep the camera from counting the walk back.
    void this.counter().stop();
    this.submittedReps.set(reps);
  }

  /** The user's answer decides the entry, not just the telemetry. */
  protected onConfirmed(actualReps: number): void {
    const detectedReps = this.submittedReps();
    if (detectedReps === null) return;
    void this.feedback.record(this.runContext(detectedReps), actualReps);
    this.closeWith(actualReps);
  }

  protected onFeedbackDismissed(): void {
    this.feedback.disable();
    this.closeWith(this.submittedReps() ?? this.count());
  }

  private closeWith(reps: number): void {
    this.dialogRef.close({ exerciseId: this.exerciseId(), reps });
  }

  private runContext(detectedReps: number): AutoCountRunContext {
    return {
      exerciseId: this.exerciseId(),
      profileId: this.detectorExerciseId(),
      mode: this.mode(),
      detectedReps,
    };
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }

  protected reset(): void {
    this.counter().reset();
  }

  protected toggleTuning(): void {
    const open = !this.tuningOpen();
    this.tuningOpen.set(open);
    setTuningPanelOpen(open);
  }

  /** A tuned threshold only takes hold on the next detector start. */
  protected async onTuningChanged(): Promise<void> {
    await this.restart(this.counter());
  }

  protected toggleFormCheck(): void {
    this.formCheckOpen.update((open) => !open);
  }

  protected detectorExerciseId(): string {
    return detectorExerciseId(this.option(), this.isProximity());
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
