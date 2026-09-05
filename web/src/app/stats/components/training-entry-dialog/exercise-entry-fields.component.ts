import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  LOCALE_ID,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ExerciseCategoryId } from '@pu-stats/models';
import {
  TrainingEntryDialogData,
  ExerciseEntryDialogResult,
} from './training-entry-dialog.models';
import { StopwatchComponent } from '../stopwatch/stopwatch.component';
import { StopwatchState } from '../stopwatch/stopwatch.state';
import { ExerciseFormState } from './exercise-entry-fields.state';
import { IntervalFieldsComponent } from './interval-fields.component';

/**
 * Exercise-mode fields for the exercise the parent's picker selected:
 * variant picker, measurement-aware inputs (reps/sets, mm:ss, km),
 * intervals breakdown, over-cap hint. All state lives in
 * {@link ExerciseFormState}; this shell wires inputs into it and seeds it
 * once the inputs are bound.
 *
 * Signal inputs are only populated after construction, so `data`-derived
 * seeding happens in the constructor effect, never in field initializers
 * (which would see the default `null`).
 */
@Component({
  selector: 'app-exercise-entry-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    IntervalFieldsComponent,
    StopwatchComponent,
  ],
  styleUrl: './training-entry-dialog.component.scss',
  // Transparent host so the fields stay direct items of the dialog's
  // `mat-dialog-content` grid (preserves the inter-field spacing).
  styles: ':host { display: contents; }',
  templateUrl: './exercise-entry-fields.component.html',
})
export class ExerciseEntryFieldsComponent {
  private readonly locale = inject(LOCALE_ID) as string;

  /**
   * Empty until the parent's binding lands: the dialog reads
   * {@link canSubmit} through a `viewChild` in the same change-detection
   * pass that creates this component, which is one tick before inputs are
   * bound — a required input would throw NG0950 there.
   */
  readonly exerciseId = input<string>('');
  readonly category = input.required<ExerciseCategoryId>();
  readonly data = input<TrainingEntryDialogData | null>(null);
  readonly isEditMode = input<boolean>(false);
  /**
   * Create-mode seconds (a stopped stopwatch) written into the duration
   * row on first render and again after every exercise switch, so picking
   * the exercise after timing it never throws the time away.
   */
  readonly durationPrefillSec = input<number | undefined>(undefined);

  readonly state = new ExerciseFormState(
    this.locale,
    this.exerciseId,
    this.category,
    this.data,
    this.isEditMode
  );

  /**
   * Stopwatch behind the duration row, so a hold or a run can be timed
   * right in the dialog instead of typed from memory.
   */
  readonly stopwatch = new StopwatchState(
    isPlatformBrowser(inject(PLATFORM_ID))
  );
  readonly stopwatchOpen = signal(false);
  protected readonly stopwatchLabel = $localize`:@@entryDialog.stopwatch:Stoppuhr`;

  private seededFor: string | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopwatch.destroy());
    // Seed from inputs once they are bound (post-construction), then drop
    // the measurement inputs whenever the parent switches the exercise —
    // reps entered for squats must not carry over to a plank hold. Edit
    // mode keeps the exercise fixed, so this only ever fires in create mode.
    effect(() => {
      const id = this.exerciseId();
      if (!id) return;
      if (this.seededFor === null) {
        this.seededFor = id;
        this.state.seedFromData(this.data());
        this.applyDurationPrefill();
        return;
      }
      if (this.seededFor === id) return;
      this.seededFor = id;
      this.stopwatch.reset();
      this.stopwatchOpen.set(false);
      this.state.resetForExercise();
      this.applyDurationPrefill();
    });
  }

  buildResult(timestamp: string): ExerciseEntryDialogResult | null {
    return this.state.buildResult(timestamp);
  }

  canSubmit(): boolean {
    return this.state.canSubmit();
  }

  private applyDurationPrefill(): void {
    const seconds = this.durationPrefillSec();
    if (seconds && seconds > 0) this.state.setDurationSeconds(seconds);
  }

  toggleStopwatch(): void {
    this.stopwatchOpen.update((open) => !open);
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
