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
    DecimalPipe,
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
  protected readonly formCheckOpen = signal(true);

  protected readonly count = computed(() => this.counter.snapshot().count);
  protected readonly phase = computed(() => this.counter.snapshot().phase);
  protected readonly frame = computed(() => this.counter.formCheckFrame());
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
    // Update the active id immediately so the toggle, the error
    // overlay (if start fails), and a subsequent retry all agree on
    // which exercise the user just asked for. The previous counter is
    // stopped + reset before we kick off the new start, so the only
    // surprise on failure is "detector idle" — which the error
    // overlay communicates explicitly.
    this.exerciseId.set(next);
    this.switching.set(true);
    this.error.set(null);
    try {
      await this.counter.stop();
      this.counter.reset();
      await this.counter.start({ exerciseId: next });
    } catch (err) {
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

  protected toggleFormCheck(): void {
    this.formCheckOpen.update((open) => !open);
  }

  private async teardown(): Promise<void> {
    if (this.tornDown) return;
    this.tornDown = true;
    await this.counter.stop();
    await this.camera.close();
  }
}
