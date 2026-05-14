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
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PoseRepCounterService } from '@pu-stats/auto-count';

import { CameraService } from './camera.service';

export type AutoCountExerciseId = 'pushup' | 'squat' | 'pullup' | 'situp';

export interface AutoCountResult {
  readonly exerciseId: AutoCountExerciseId;
  readonly reps: number;
}

interface ExerciseOption {
  readonly id: AutoCountExerciseId;
  readonly icon: string;
  readonly label: string;
}

@Component({
  selector: 'app-auto-count-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  providers: [PoseRepCounterService],
  templateUrl: './auto-count-dialog.component.html',
  styleUrl: './auto-count-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoCountDialogComponent {
  private readonly camera = inject(CameraService);
  protected readonly counter = inject(PoseRepCounterService);
  private readonly dialogRef = inject(
    MatDialogRef<AutoCountDialogComponent, AutoCountResult | null>
  );
  private readonly destroyRef = inject(DestroyRef);

  protected readonly videoRef =
    viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly isStarting = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly switching = signal(false);
  protected readonly exerciseId = signal<AutoCountExerciseId>('pushup');

  protected readonly count = computed(() => this.counter.snapshot().count);
  protected readonly phase = computed(() => this.counter.snapshot().phase);

  protected readonly exercises: ReadonlyArray<ExerciseOption> = [
    {
      id: 'pushup',
      icon: 'fitness_center',
      label: $localize`:@@autoCount.exercise.pushup:Liegestütze`,
    },
    {
      id: 'squat',
      icon: 'airline_seat_legroom_reduced',
      label: $localize`:@@autoCount.exercise.squat:Kniebeugen`,
    },
    {
      id: 'pullup',
      icon: 'rowing',
      label: $localize`:@@autoCount.exercise.pullup:Klimmzüge`,
    },
    {
      id: 'situp',
      icon: 'self_improvement',
      label: $localize`:@@autoCount.exercise.situp:Sit-ups`,
    },
  ];

  private tornDown = false;

  constructor() {
    afterNextRender(async () => {
      const video = this.videoRef().nativeElement;
      try {
        await this.camera.open(video);
        this.counter.bindVideoElement(video);
        await this.counter.start({ exerciseId: this.exerciseId() });
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

  protected async onExerciseChange(next: AutoCountExerciseId): Promise<void> {
    if (next === this.exerciseId() || this.switching()) return;
    const previous = this.exerciseId();
    this.switching.set(true);
    this.error.set(null);
    try {
      await this.counter.stop();
      this.counter.reset();
      await this.counter.start({ exerciseId: next });
      // Only flip the active exercise once the counter is actually
      // running on the new profile — otherwise a failed start would
      // leave the UI claiming we are counting `next` while the
      // detector sits idle (or, worse, still running the previous
      // profile if start() threw mid-init).
      this.exerciseId.set(next);
    } catch (err) {
      this.exerciseId.set(previous);
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.switching.set(false);
    }
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
    this.counter.reset();
  }

  private async teardown(): Promise<void> {
    if (this.tornDown) return;
    this.tornDown = true;
    await this.counter.stop();
    await this.camera.close();
  }
}
