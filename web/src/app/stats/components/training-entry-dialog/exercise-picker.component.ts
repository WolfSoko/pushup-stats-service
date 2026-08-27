import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { exerciseDisplayName } from '../../i18n/exercise-display-names';
import {
  buildExercisePickerGroups,
  filterExercisePickerGroups,
} from './exercise-picker.groups';
import {
  exerciseWikiLink,
  exerciseWikiTooltip,
} from './training-entry-dialog.display';
import {
  ExerciseSuggestions,
  PUSHUP_EXERCISE_ID,
} from './training-entry-dialog.models';

/**
 * The dialog's primary field: one type-ahead over the whole exercise
 * catalog instead of a category select followed by an exercise select.
 * Sections rank what today prescribes and what was logged recently above
 * the category listing (see {@link buildExercisePickerGroups}).
 *
 * The control holds the exercise **id**; `displayWith` renders the name.
 * `requireSelection` makes a half-typed query fall back to the last valid
 * pick on blur, so the dialog can never end up with a non-catalog id.
 */
@Component({
  selector: 'app-exercise-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    RouterLink,
  ],
  styleUrl: './training-entry-dialog.component.scss',
  // Transparent host so the field stays a direct item of the dialog's
  // `mat-dialog-content` grid — an inline-flex form field in a block host
  // would size to its content instead of the dialog width.
  styles: ':host { display: contents; }',
  templateUrl: './exercise-picker.component.html',
})
export class ExercisePickerComponent {
  readonly exerciseId = input.required<string>();
  readonly suggestions = input<ExerciseSuggestions>({});
  /** Edit mode: the entry's exercise is fixed, so the field is read-only. */
  readonly locked = input<boolean>(false);

  readonly exerciseIdChange = output<string>();

  readonly control = new FormControl<string>('', { nonNullable: true });

  /** Raw input text while typing; empty once a row has been picked. */
  private readonly query = signal('');

  private readonly groups = computed(() =>
    buildExercisePickerGroups(this.suggestions())
  );

  readonly filteredGroups = computed(() =>
    filterExercisePickerGroups(this.query(), this.groups())
  );

  readonly hasMatches = computed(() => this.filteredGroups().length > 0);

  /** Pushup entries get their type-specific wiki link from the type row. */
  readonly showWikiLink = computed(
    () => this.exerciseId() !== PUSHUP_EXERCISE_ID
  );
  readonly wikiLink = computed(() => exerciseWikiLink(this.exerciseId()));
  readonly wikiTooltip = computed(() => exerciseWikiTooltip(this.exerciseId()));

  readonly displayExercise = (id: string | null | undefined): string =>
    id ? exerciseDisplayName(id) : '';

  constructor() {
    // The parent owns the selection, so mirror it into the control (and
    // drop any half-typed query) whenever it changes — including the
    // seeding pass in edit mode, where the control also has to lock.
    effect(() => {
      const id = this.exerciseId();
      this.query.set('');
      if (this.control.value !== id) this.control.setValue(id);
      if (this.locked() === this.control.disabled) return;
      if (this.locked()) this.control.disable();
      else this.control.enable();
    });
  }

  onSelect(id: string): void {
    this.query.set('');
    this.exerciseIdChange.emit(id);
  }

  onInput(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /**
   * Focus clears the query so the full list opens even after a pick, and
   * selects the text so typing replaces the current exercise name.
   */
  onFocus(event: FocusEvent): void {
    this.query.set('');
    (event.target as HTMLInputElement).select();
  }
}
