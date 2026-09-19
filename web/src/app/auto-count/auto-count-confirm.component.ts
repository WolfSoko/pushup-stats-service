import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * The one question asked after a counted set: was the number right?
 *
 * Confirming is a single tap and is the common case, so it gets the
 * primary button; correcting opens a stepper rather than a keyboard,
 * because the true count is almost always within a rep or two of what
 * the detector reported. The corrected number is what gets booked —
 * answering honestly must never cost the user a wrong entry.
 */
@Component({
  selector: 'app-auto-count-confirm',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './auto-count-confirm.component.html',
  styleUrl: './auto-count-confirm.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutoCountConfirmComponent {
  readonly detectedReps = input.required<number>();
  /** Emits the count to book: the detected one, or the user's correction. */
  readonly confirmed = output<number>();
  /** Emitted when the user wants the question gone for good. */
  readonly dismissed = output<void>();

  protected readonly correcting = signal(false);
  protected readonly corrected = signal(0);
  protected readonly canDecrement = computed(() => this.corrected() > 0);

  protected startCorrection(): void {
    this.corrected.set(this.detectedReps());
    this.correcting.set(true);
  }

  protected step(delta: number): void {
    this.corrected.update((value) => Math.max(0, value + delta));
  }

  protected confirmDetected(): void {
    this.confirmed.emit(this.detectedReps());
  }

  protected confirmCorrected(): void {
    this.confirmed.emit(this.corrected());
  }

  protected dismiss(): void {
    this.dismissed.emit();
  }
}
