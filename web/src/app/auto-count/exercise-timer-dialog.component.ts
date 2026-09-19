import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
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
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { HOLD_TIMER, holdProfileFor } from '@pu-stats/auto-count';

import { WakeLockService } from '../core/wake-lock.service';
import { StopwatchSignalService } from '../stats/components/stopwatch/stopwatch-signal.service';
import {
  formatStopwatch,
  StopwatchState,
  TargetSignal,
} from '../stats/components/stopwatch/stopwatch.state';
import { AutoCountTuningPanelComponent } from './auto-count-tuning-panel.component';
import { AutoCountTuningStore } from './auto-count-tuning.store';
import { CameraService } from './camera.service';
import {
  buildHoldExerciseOptions,
  holdPhaseLabel,
  type ExerciseTimerDialogData,
  type ExerciseTimerExerciseId,
  type ExerciseTimerOption,
  type ExerciseTimerResult,
} from './exercise-timer-dialog.models';
import { PoseOverlayComponent } from './pose-overlay.component';

@Component({
  selector: 'app-exercise-timer-dialog',
  standalone: true,
  imports: [
    DecimalPipe,
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    AutoCountTuningPanelComponent,
    PoseOverlayComponent,
  ],
  templateUrl: './exercise-timer-dialog.component.html',
  styleUrl: './exercise-timer-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseTimerDialogComponent {
  private readonly camera = inject(CameraService);
  protected readonly timer = inject(HOLD_TIMER);
  private readonly dialogRef = inject(
    MatDialogRef<ExerciseTimerDialogComponent, ExerciseTimerResult | null>
  );
  private readonly destroyRef = inject(DestroyRef);
  private readonly tuning = inject(AutoCountTuningStore);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialogData = inject<ExerciseTimerDialogData | null>(
    MAT_DIALOG_DATA,
    { optional: true }
  );

  protected readonly videoRef =
    viewChild<ElementRef<HTMLVideoElement>>('video');
  /** Set once the camera session is live; the overlay reads its size. */
  protected readonly videoEl = signal<HTMLVideoElement | null>(null);

  protected readonly exerciseId = signal<ExerciseTimerExerciseId>(
    this.dialogData?.initialExerciseId ?? 'plank'
  );
  /** Prescribed hold in seconds, or 0 when the caller named no target. */
  protected readonly targetSec = Math.max(0, this.dialogData?.targetSec ?? 0);
  protected readonly cameraMode = signal(false);
  protected readonly isStarting = signal(false);
  protected readonly switching = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formCheckOpen = signal(true);

  /** Manual mode: the same stopwatch the session and entry dialog use. */
  private readonly stopwatch = new StopwatchState(
    isPlatformBrowser(this.platformId)
  );

  protected readonly totalSec = computed(() =>
    this.cameraMode()
      ? Math.floor(this.timer.snapshot().totalMs / 1000)
      : this.stopwatch.elapsedSec()
  );
  protected readonly totalMmSs = computed(() =>
    formatStopwatch(this.totalSec())
  );
  protected readonly targetMmSs = formatStopwatch(this.targetSec);
  protected readonly targetReached = computed(
    () => this.targetSec > 0 && this.totalSec() >= this.targetSec
  );
  protected readonly running = computed(() =>
    this.cameraMode()
      ? this.timer.snapshot().phase === 'holding'
      : this.stopwatch.running()
  );
  protected readonly phaseLabel = computed(() =>
    holdPhaseLabel(
      this.cameraMode()
        ? this.timer.snapshot().phase
        : this.stopwatch.running()
          ? 'holding'
          : 'idle'
    )
  );
  protected readonly frame = computed(() => this.timer.formCheckFrame());
  /** Admins get the hold thresholds; only meaningful with the camera on. */
  protected readonly showTuning = computed(
    () => this.tuning.isAdmin() && this.cameraMode()
  );
  protected readonly tuningDefaults = computed<Record<string, number>>(
    () =>
      (holdProfileFor(this.exerciseId()) ?? {}) as unknown as Record<
        string,
        number
      >
  );
  /** Null while the camera is off or the form check is collapsed. */
  protected readonly skeleton = computed(() =>
    this.cameraMode() && this.formCheckOpen()
      ? (this.frame()?.pose ?? null)
      : null
  );

  protected readonly exercises: ReadonlyArray<ExerciseTimerOption> =
    buildHoldExerciseOptions();

  private tornDown = false;

  constructor() {
    const signals = inject(StopwatchSignalService);
    const target = new TargetSignal(() => signals.play());
    effect(() => target.update(this.targetReached()));
    inject(WakeLockService).keepAwakeWhile(
      () => this.cameraMode() || this.stopwatch.running()
    );
    this.destroyRef.onDestroy(() => {
      void this.teardown();
    });
  }

  protected async onModeToggle(useCamera: boolean): Promise<void> {
    if (useCamera === this.cameraMode()) return;
    // Pause whichever path was active so the user always returns to a
    // clean "press to start" state after switching modes — keeps the
    // mental model symmetric between the two.
    this.stopwatch.pause();
    if (this.cameraMode()) {
      // Stop the timer first (it owns the frame subscription), then
      // close the underlying MediaStream. Without the `camera.close()`
      // call the webcam track keeps running in the background after the
      // user flipped the toggle off — privacy indicator stays on, extra
      // battery drain, and potentially blocks other tabs from accessing
      // the camera until the dialog is destroyed.
      await this.timer.stop();
      await this.camera.close();
    }
    this.cameraMode.set(useCamera);
    this.error.set(null);
    if (useCamera) {
      await this.startCameraSession();
    }
  }

  protected async onExerciseChange(
    next: ExerciseTimerExerciseId
  ): Promise<void> {
    if (next === this.exerciseId() || this.switching()) return;
    this.exerciseId.set(next);
    if (!this.cameraMode()) return;
    this.switching.set(true);
    this.error.set(null);
    try {
      await this.timer.stop();
      this.timer.reset();
      await this.timer.start({ exerciseId: next });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.switching.set(false);
    }
  }

  protected toggleManual(): void {
    if (this.cameraMode()) return;
    this.stopwatch.toggle();
  }

  protected reset(): void {
    if (this.cameraMode()) {
      this.timer.reset();
    } else {
      this.stopwatch.reset();
    }
  }

  protected save(): void {
    const seconds = this.totalSec();
    if (seconds <= 0) {
      this.dialogRef.close(null);
      return;
    }
    this.dialogRef.close({
      exerciseId: this.exerciseId(),
      durationSec: seconds,
    });
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }

  /** A tuned threshold only takes hold on the next timer start. */
  protected async onTuningChanged(): Promise<void> {
    if (!this.cameraMode() || this.switching()) return;
    this.switching.set(true);
    try {
      await this.timer.stop();
      await this.timer.start({ exerciseId: this.exerciseId() });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.switching.set(false);
    }
  }

  protected toggleFormCheck(): void {
    this.formCheckOpen.update((open) => !open);
  }

  /**
   * Wires the camera + pose detector. The `<video>` element is always
   * rendered (just hidden when cameraMode is off), so `viewChild` is
   * populated as soon as the dialog mounts and we can read it
   * synchronously here.
   */
  private async startCameraSession(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const ref = this.videoRef();
    if (!ref) {
      this.error.set('Video element not available');
      return;
    }
    this.isStarting.set(true);
    try {
      const video = ref.nativeElement;
      this.videoEl.set(video);
      // Before `start()`: the timer reads its thresholds once, when the
      // state machine is built.
      await this.tuning.ensureLoaded();
      await this.camera.open(video);
      this.timer.bindVideoElement(video);
      await this.timer.start({ exerciseId: this.exerciseId() });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      // Release any partial resources the partial start grabbed: the
      // camera may have already been opened (granting webcam access)
      // before the detector failed to initialise. Without this both the
      // MediaStream and a half-initialised detector would survive until
      // dialog teardown, blocking other camera consumers and leaking
      // detector resources.
      await this.timer.stop().catch(() => undefined);
      await this.camera.close().catch(() => undefined);
    } finally {
      this.isStarting.set(false);
    }
  }

  private async teardown(): Promise<void> {
    if (this.tornDown) return;
    this.tornDown = true;
    this.stopwatch.destroy();
    await this.timer.stop();
    await this.camera.close();
  }
}
