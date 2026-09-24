import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  LOCALE_ID,
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
import { MeasurementType } from '@pu-stats/models';
import {
  exerciseRefTooltip,
  resolveExerciseRef,
} from '../../../core/exercise-ref/exercise-ref.model';
import { XpStore } from '@pu-stats/data-access-state';
import { xpRateLabelFor } from '../../../core/xp/xp-rate-label';
import { exerciseDisplayName } from '../../i18n/exercise-display-names';
import {
  buildExercisePickerGroups,
  filterExercisePickerGroups,
} from './exercise-picker.groups';
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
  styles: `
    :host {
      display: contents;
    }
    .picker-option {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
    }
    .picker-option-xp {
      flex: none;
      font: var(--mat-sys-label-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  templateUrl: './exercise-picker.component.html',
})
export class ExercisePickerComponent {
  private readonly locale = inject(LOCALE_ID) as string;
  private readonly xpStore = inject(XpStore);

  readonly exerciseId = input.required<string>();
  readonly suggestions = input<ExerciseSuggestions>({});
  /** Only exercises of these measurement types are offered; absent = all. */
  readonly measurements = input<readonly MeasurementType[] | undefined>(
    undefined
  );
  /** Edit mode: the entry's exercise is fixed, so the field is read-only. */
  readonly locked = input<boolean>(false);
  /**
   * The trailing wiki link closes the surrounding dialog on the way out.
   * Hosts outside a dialog turn it off and offer their own help instead.
   */
  readonly wikiLink = input<boolean>(true);

  readonly exerciseIdChange = output<string>();

  readonly control = new FormControl<string>('', { nonNullable: true });

  /** Raw input text while typing; empty once a row has been picked. */
  private readonly query = signal('');

  private readonly groups = computed(() =>
    buildExercisePickerGroups(this.suggestions(), this.measurements())
  );

  readonly filteredGroups = computed(() =>
    filterExercisePickerGroups(this.query(), this.groups())
  );

  readonly hasMatches = computed(() => this.filteredGroups().length > 0);

  /** Pushup entries get their type-specific wiki link from the type row. */
  readonly showWikiLink = computed(
    () => this.wikiLink() && this.exerciseId() !== PUSHUP_EXERCISE_ID
  );
  private readonly exerciseRef = computed(() =>
    resolveExerciseRef(this.exerciseId(), undefined, this.locale)
  );
  readonly wikiRoute = computed(() => this.exerciseRef().wikiLink);
  readonly wikiTooltip = computed(() => exerciseRefTooltip(this.exerciseRef()));

  /** "3 XP / Wdh." beside each option — the exercise's worth at a glance. */
  rateLabel(exerciseId: string): string | null {
    return xpRateLabelFor(exerciseId, this.xpStore.config(), this.locale);
  }

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
