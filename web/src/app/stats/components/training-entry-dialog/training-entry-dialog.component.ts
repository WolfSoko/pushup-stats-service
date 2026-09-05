import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  ExerciseCategoryId,
  findExerciseDefinition,
  MeasurementType,
} from '@pu-stats/models';
import { appendLocalOffset } from '@pu-stats/date';
import {
  ExerciseSuggestions,
  isEntryPrefill,
  PUSHUP_EXERCISE_ID,
  TrainingEntryDialogData,
  TrainingEntryDialogInput,
} from './training-entry-dialog.models';
import { inferExerciseCategory } from './training-entry-dialog.helpers';
import { initialSuggestedExerciseId } from './exercise-picker.groups';
import { ExercisePickerComponent } from './exercise-picker.component';
import { PushupEntryFieldsComponent } from './pushup-entry-fields.component';
import { ExerciseEntryFieldsComponent } from './exercise-entry-fields.component';

/**
 * Single dialog for entering / editing every training type the app
 * supports. The exercise is the entry point: one type-ahead picker over
 * the whole catalog selects it, and everything else — the category and
 * which set of fields is rendered — follows from that choice.
 *
 * Two execution modes:
 *
 *   - **Pushup mode** (exercise = `'pushup'`): variant autocomplete +
 *     source field + reps/sets list. Submits with `kind: 'pushup'` for
 *     the legacy `pushups` Firestore collection.
 *
 *   - **Exercise mode** (every other exercise): measurement-aware fields
 *     driven by the catalog definition. Submits with `kind: 'exercise'`
 *     for the `exerciseEntries` collection.
 *
 * The parent owns exercise + timestamp selection and delegates all
 * mode-specific state to the active child component; on submit it
 * resolves the timestamp and asks the child to build the result.
 *
 * Edit mode (caller passes an entry) locks the picker — moving an entry
 * between collections is not supported. Create mode may carry
 * {@link ExerciseSuggestions} that rank the picker's first rows and
 * decide which exercise the dialog opens on.
 */
@Component({
  selector: 'app-training-entry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ExercisePickerComponent,
    PushupEntryFieldsComponent,
    ExerciseEntryFieldsComponent,
  ],
  styleUrl: './training-entry-dialog.component.scss',
  templateUrl: './training-entry-dialog.component.html',
})
export class TrainingEntryDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<TrainingEntryDialogComponent>
  );

  private readonly dialogInput =
    inject<TrainingEntryDialogInput>(MAT_DIALOG_DATA, { optional: true }) ??
    null;

  /** The entry being edited / prefilled; `null` in plain create mode. */
  readonly data: TrainingEntryDialogData | null = isEntryPrefill(
    this.dialogInput
  )
    ? this.dialogInput
    : null;

  readonly isEditMode = !!this.data;

  readonly suggestions: ExerciseSuggestions =
    this.dialogInput?.kind === 'create' ? this.dialogInput.suggestions : {};

  /** Create-mode picker restriction, e.g. timed exercises after a stopwatch. */
  readonly measurements: readonly MeasurementType[] | undefined =
    this.dialogInput?.kind === 'create'
      ? this.dialogInput.measurements
      : undefined;

  /** Create-mode duration prefill that survives switching the exercise. */
  readonly durationPrefillSec: number | undefined =
    this.dialogInput?.kind === 'create'
      ? this.dialogInput.durationSec
      : undefined;

  readonly exerciseId = signal<string>(this.initialExerciseId());

  readonly mode = computed<'pushup' | 'exercise'>(() =>
    this.exerciseId() === PUSHUP_EXERCISE_ID ? 'pushup' : 'exercise'
  );

  /** Derived from the picked exercise; only exercise mode consumes it. */
  readonly category = computed<ExerciseCategoryId>(() => {
    const id = this.exerciseId();
    return (
      findExerciseDefinition(id)?.categoryId ??
      // Stale id (renamed/removed in the catalog): recover the category
      // from the id prefix so the fields still render sensible bounds.
      inferExerciseCategory(id)
    );
  });

  private readonly originalTimestamp = this.data?.timestamp ?? null;

  readonly timestamp = signal(
    this.data ? this.data.timestamp.slice(0, 16) : this.defaultDateTimeLocal()
  );

  private readonly pushupFields = viewChild(PushupEntryFieldsComponent);
  private readonly exerciseFields = viewChild(ExerciseEntryFieldsComponent);

  readonly canSubmit = computed(() => {
    if (this.timestamp().length === 0) return false;
    const child =
      this.mode() === 'pushup' ? this.pushupFields() : this.exerciseFields();
    return child?.canSubmit() ?? false;
  });

  onExerciseChange(next: string): void {
    if (this.isEditMode) return;
    this.exerciseId.set(next);
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  submit(): void {
    if (!this.canSubmit()) return;

    const defaultLocal = this.originalTimestamp?.slice(0, 16) ?? '';
    const timestamp =
      this.originalTimestamp && this.timestamp() === defaultLocal
        ? this.originalTimestamp
        : appendLocalOffset(this.timestamp());

    const child =
      this.mode() === 'pushup' ? this.pushupFields() : this.exerciseFields();
    const result = child?.buildResult(timestamp);
    if (result) this.dialogRef.close(result);
  }

  private initialExerciseId(): string {
    const data = this.data;
    if (!data) {
      return initialSuggestedExerciseId(this.suggestions, this.measurements);
    }
    return data.kind === 'pushup' ? PUSHUP_EXERCISE_ID : data.exerciseId;
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}
