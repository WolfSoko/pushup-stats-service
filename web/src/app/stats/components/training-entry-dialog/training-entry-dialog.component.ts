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
import { MatSelectModule } from '@angular/material/select';
import { ExerciseCategoryId, findExerciseDefinition } from '@pu-stats/models';
import { appendLocalOffset } from '@pu-stats/date';
import {
  CategoryOption,
  TrainingEntryDialogData,
} from './training-entry-dialog.models';
import {
  buildCategoryOptions,
  inferExerciseCategory,
} from './training-entry-dialog.helpers';
import { PushupEntryFieldsComponent } from './pushup-entry-fields.component';
import { ExerciseEntryFieldsComponent } from './exercise-entry-fields.component';

/**
 * Single dialog for entering / editing every training type the app
 * supports. Two execution modes:
 *
 *   - **Pushup mode** (category = `'pushup'`): variant autocomplete +
 *     source field + reps/sets list. Submits with `kind: 'pushup'` for
 *     the legacy `pushups` Firestore collection.
 *
 *   - **Exercise mode** (every other category): exercise picker driven
 *     by the catalog, then measurement-aware fields. Submits with
 *     `kind: 'exercise'` for the `exerciseEntries` collection.
 *
 * The parent owns category + timestamp selection and delegates all
 * mode-specific state to the active child component; on submit it
 * resolves the timestamp and asks the child to build the result.
 *
 * Edit mode (caller passes `data`) locks the category and exercise
 * pickers — moving an entry between collections is not supported.
 */
@Component({
  selector: 'app-training-entry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
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
  readonly data = inject<TrainingEntryDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });

  readonly isEditMode = !!this.data;

  readonly categoryOptions: ReadonlyArray<CategoryOption> =
    buildCategoryOptions();

  readonly category = signal<ExerciseCategoryId>(this.initialCategory());

  readonly mode = computed<'pushup' | 'exercise'>(() =>
    this.category() === 'pushup' ? 'pushup' : 'exercise'
  );

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

  onCategoryChange(next: ExerciseCategoryId): void {
    if (this.isEditMode) return;
    this.category.set(next);
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

  private initialCategory(): ExerciseCategoryId {
    if (!this.data) return 'pushup';
    if (this.data.kind === 'pushup') return 'pushup';
    const def = findExerciseDefinition(this.data.exerciseId);
    if (def) return def.categoryId;
    // Stale exerciseId (renamed/removed in the catalog): stay in
    // exercise mode so the dialog doesn't silently flip to pushup,
    // which would also corrupt the emitted payload shape on submit.
    return inferExerciseCategory(this.data.exerciseId);
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}
