import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ExerciseFormState } from './exercise-entry-fields.state';

/**
 * The endurance breakdown: one row per interval, entered with the same
 * field shape as the exercise's main measurement. Each row heads its own
 * fields with an "Intervall N" label and keeps add/remove on that header
 * line — a phone-width dialog has no room for three fields plus two icon
 * buttons side by side.
 */
@Component({
  selector: 'app-interval-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  styleUrl: './training-entry-dialog.component.scss',
  // Transparent host so the rows stay direct items of the dialog's
  // `mat-dialog-content` grid (preserves the inter-field spacing).
  styles: ':host { display: contents; }',
  templateUrl: './interval-fields.component.html',
})
export class IntervalFieldsComponent {
  readonly state = input.required<ExerciseFormState>();

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
