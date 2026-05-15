import { DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PoseHoldTimerService } from '@pu-stats/auto-count';

import { CameraService } from './camera.service';

export type ExerciseTimerExerciseId = 'plank' | 'hollowhold';

export interface ExerciseTimerResult {
  readonly exerciseId: ExerciseTimerExerciseId;
  /** Final hold time in whole seconds. */
  readonly durationSec: number;
}

interface ExerciseOption {
  readonly id: ExerciseTimerExerciseId;
  readonly icon: string;
  readonly label: string;
}

/** How often the manual stopwatch ticks the elapsed display. */
const STOPWATCH_TICK_MS = 100;

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
  ],
  providers: [PoseHoldTimerService],
  templateUrl: './exercise-timer-dialog.component.html',
  styleUrl: './exercise-timer-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExerciseTimerDialogComponent {
  private readonly camera = inject(CameraService);
  protected readonly timer = inject(PoseHoldTimerService);
  private readonly dialogRef = inject(
    MatDialogRef<ExerciseTimerDialogComponent, ExerciseTimerResult | null>
  );
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  protected readonly videoRef =
    viewChild<ElementRef<HTMLVideoElement>>('video');

  protected readonly exerciseId = signal<ExerciseTimerExerciseId>('plank');
  protected readonly cameraMode = signal(false);
  protected readonly isStarting = signal(false);
  protected readonly switching = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formCheckOpen = signal(true);

  /** Wall-clock millisecond total for manual mode. */
  private readonly manualMs = signal(0);
  private readonly manualRunning = signal(false);
  private manualSegmentStartedAt: number | null = null;
  /**
   * Snapshot of `manualMs` at the moment the current segment started. The
   * interval below sets `manualMs = manualSegmentBaseMs + delta` on every
   * tick, so when we stop we re-compute the same expression instead of
   * adding `delta` on top of an already-updated `manualMs`.
   */
  private manualSegmentBaseMs = 0;
  private stopwatchHandle: ReturnType<typeof setInterval> | null = null;

  protected readonly totalSec = computed(() =>
    this.cameraMode()
      ? Math.floor(this.timer.snapshot().totalMs / 1000)
      : Math.floor(this.manualMs() / 1000)
  );
  protected readonly totalMmSs = computed(() => {
    const sec = this.totalSec();
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  });
  protected readonly running = computed(() =>
    this.cameraMode()
      ? this.timer.snapshot().phase === 'holding'
      : this.manualRunning()
  );
  protected readonly phaseLabel = computed(() => {
    if (this.cameraMode()) {
      switch (this.timer.snapshot().phase) {
        case 'holding':
          return $localize`:@@exerciseTimer.phase.holding:Halten`;
        case 'paused':
          return $localize`:@@exerciseTimer.phase.paused:Pause`;
        default:
          return $localize`:@@exerciseTimer.phase.ready:Bereit`;
      }
    }
    return this.manualRunning()
      ? $localize`:@@exerciseTimer.phase.holding:Halten`
      : $localize`:@@exerciseTimer.phase.ready:Bereit`;
  });
  protected readonly frame = computed(() => this.timer.formCheckFrame());

  protected readonly exercises: ReadonlyArray<ExerciseOption> = [
    {
      id: 'plank',
      icon: 'horizontal_rule',
      label: $localize`:@@exerciseTimer.exercise.plank:Plank`,
    },
    {
      id: 'hollowhold',
      icon: 'self_improvement',
      label: $localize`:@@exerciseTimer.exercise.hollowhold:Hollow Hold`,
    },
  ];

  private tornDown = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      void this.teardown();
    });
  }

  protected async onModeToggle(useCamera: boolean): Promise<void> {
    if (useCamera === this.cameraMode()) return;
    // Pause whichever path was active so the user always returns to a
    // clean "press to start" state after switching modes — keeps the
    // mental model symmetric between the two.
    this.stopManualStopwatch();
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
    if (this.manualRunning()) {
      this.stopManualStopwatch();
    } else {
      this.startManualStopwatch();
    }
  }

  protected reset(): void {
    if (this.cameraMode()) {
      this.timer.reset();
    } else {
      this.stopManualStopwatch();
      this.manualMs.set(0);
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

  protected toggleFormCheck(): void {
    this.formCheckOpen.update((open) => !open);
  }

  private startManualStopwatch(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.manualRunning() || this.stopwatchHandle !== null) return;
    this.manualSegmentStartedAt = performance.now();
    this.manualSegmentBaseMs = this.manualMs();
    this.manualRunning.set(true);
    this.stopwatchHandle = setInterval(() => {
      if (this.manualSegmentStartedAt === null) return;
      const delta = performance.now() - this.manualSegmentStartedAt;
      this.manualMs.set(this.manualSegmentBaseMs + delta);
    }, STOPWATCH_TICK_MS);
  }

  private stopManualStopwatch(): void {
    if (this.stopwatchHandle !== null) {
      clearInterval(this.stopwatchHandle);
      this.stopwatchHandle = null;
    }
    if (this.manualSegmentStartedAt !== null && this.manualRunning()) {
      const delta = performance.now() - this.manualSegmentStartedAt;
      this.manualMs.set(this.manualSegmentBaseMs + delta);
    }
    this.manualSegmentStartedAt = null;
    this.manualRunning.set(false);
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
    this.stopManualStopwatch();
    await this.timer.stop();
    await this.camera.close();
  }
}
