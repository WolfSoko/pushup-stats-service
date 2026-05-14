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
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PoseRepCounterService } from '@pu-stats/auto-count';

import { CameraService } from './camera.service';

@Component({
  selector: 'app-auto-count-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
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
    MatDialogRef<AutoCountDialogComponent, number | null>
  );
  private readonly destroyRef = inject(DestroyRef);

  protected readonly videoRef =
    viewChild.required<ElementRef<HTMLVideoElement>>('video');

  protected readonly isStarting = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly count = computed(() => this.counter.snapshot().count);
  protected readonly phase = computed(() => this.counter.snapshot().phase);

  private tornDown = false;

  constructor() {
    afterNextRender(async () => {
      const video = this.videoRef().nativeElement;
      try {
        await this.camera.open(video);
        this.counter.bindVideoElement(video);
        await this.counter.start({ exerciseId: 'pushup' });
      } catch (err) {
        this.error.set(err instanceof Error ? err.message : String(err));
      } finally {
        this.isStarting.set(false);
      }
    });

    // `destroyRef.onDestroy` is enough to cover every close path
    // (button, ESC, backdrop) because the dialog component is destroyed
    // as part of the close sequence. The `tornDown` flag guards
    // against accidental re-entry if a future refactor adds a second
    // teardown trigger.
    this.destroyRef.onDestroy(() => {
      void this.teardown();
    });
  }

  protected save(): void {
    const reps = this.count();
    this.dialogRef.close(reps > 0 ? reps : null);
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
