import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  LOCALE_ID,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { ExerciseCategoryId } from '@pu-stats/models';
import {
  TrainingEntryDialogData,
  ExerciseEntryDialogResult,
} from './training-entry-dialog.models';
import { ExerciseFormState } from './exercise-entry-fields.state';

/**
 * Exercise-mode fields: catalog exercise picker, variant picker,
 * measurement-aware inputs (reps/sets, mm:ss, km), intervals breakdown,
 * over-cap hint. All state lives in {@link ExerciseFormState}; this shell
 * wires inputs into it and seeds it once the inputs are bound.
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
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    RouterLink,
  ],
  styleUrl: './training-entry-dialog.component.scss',
  // Transparent host so the fields stay direct items of the dialog's
  // `mat-dialog-content` grid (preserves the 10px inter-field spacing).
  styles: ':host { display: contents; }',
  templateUrl: './exercise-entry-fields.component.html',
})
export class ExerciseEntryFieldsComponent {
  private readonly locale = inject(LOCALE_ID) as string;

  readonly category = input.required<ExerciseCategoryId>();
  readonly data = input<TrainingEntryDialogData | null>(null);
  readonly isEditMode = input<boolean>(false);

  readonly state = new ExerciseFormState(
    this.locale,
    this.category,
    this.data,
    this.isEditMode
  );

  private seeded = false;

  constructor() {
    // Seed from inputs once they are bound (post-construction), then keep
    // the create-mode picker in sync with the category. Edit mode locks
    // both pickers, so a later category change must never reset state.
    effect(() => {
      const cat = this.category();
      const data = this.data();
      if (!this.seeded) {
        this.seeded = true;
        this.state.seedFromData(data, cat);
        return;
      }
      this.state.onCategorySync(cat);
    });
  }

  buildResult(timestamp: string): ExerciseEntryDialogResult | null {
    return this.state.buildResult(timestamp);
  }

  canSubmit(): boolean {
    return this.state.canSubmit();
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
