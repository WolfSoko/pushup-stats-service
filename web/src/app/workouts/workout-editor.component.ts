import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  WORKOUT_DESCRIPTION_MAX,
  WORKOUT_MAX_EXERCISES,
  WORKOUT_TITLE_MAX,
} from '@pu-stats/models';
import { BusyDirective, SkeletonComponent } from '@pu-stats/ui';

import { ExerciseGuideService } from '../core/exercise-ref/exercise-guide.service';
import { PageHeaderComponent } from '../core/page-header/page-header.component';
import { ExercisePickerComponent } from '../stats/components/training-entry-dialog/exercise-picker.component';
import {
  emptyLine,
  formForExercise,
  formFromWorkout,
  formToInput,
  setsTotal,
  targetUnitLabel,
  variantOptions,
  WORKOUT_MEASUREMENTS,
  type WorkoutFormLine,
  type WorkoutFormState,
} from './workout-form';
import { workoutRejectionMessage } from './workouts-messages';
import { WorkoutsStore } from './workouts.store';

/**
 * Create or edit one workout. Form state is a plain signal; the pure
 * helpers in `workout-form.ts` turn it into the input the store
 * validates and persists.
 */
@Component({
  selector: 'app-workout-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BusyDirective,
    ExercisePickerComponent,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    PageHeaderComponent,
    RouterLink,
    SkeletonComponent,
  ],
  templateUrl: './workout-editor.component.html',
  styleUrl: './workout-editor.component.css',
})
export class WorkoutEditorComponent {
  protected readonly store = inject(WorkoutsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly guide = inject(ExerciseGuideService);

  protected readonly titleMax = WORKOUT_TITLE_MAX;
  protected readonly descriptionMax = WORKOUT_DESCRIPTION_MAX;
  protected readonly maxLines = WORKOUT_MAX_EXERCISES;
  protected readonly measurements = WORKOUT_MEASUREMENTS;
  protected readonly variantsFor = variantOptions;
  protected readonly unitFor = targetUnitLabel;

  /** A new workout opened from the wiki starts on that exercise. */
  protected readonly form = signal<WorkoutFormState>(
    formForExercise(
      this.route.snapshot.queryParamMap.get('exercise'),
      this.route.snapshot.queryParamMap.get('variant')
    )
  );

  protected readonly moveUpLabel = $localize`:@@workouts.editor.moveUp:Nach oben`;
  protected readonly moveDownLabel = $localize`:@@workouts.editor.moveDown:Nach unten`;
  protected readonly removeLabel = $localize`:@@workouts.editor.removeExercise:Übung entfernen`;
  protected readonly guideLabel = $localize`:@@workouts.editor.guide:Anleitung ansehen`;

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  /** The workout being edited, or `null` on `/workouts/new`. */
  protected readonly editingId = computed(() => this.params().get('id'));
  protected readonly isEdit = computed(() => this.editingId() !== null);

  /**
   * True on the edit route until the list has delivered — the form must
   * not offer an empty workout for a document that just hasn't arrived.
   */
  protected readonly loading = computed(
    () => this.isEdit() && !this.store.loaded()
  );
  protected readonly missing = computed(() => {
    const id = this.editingId();
    return id !== null && this.store.loaded() && !this.store.workoutById(id);
  });

  protected readonly rejection = computed(() =>
    workoutRejectionMessage(this.store.lastRejection())
  );

  protected readonly saving = computed(() => {
    const id = this.editingId();
    return this.store.isBusy(id === null ? 'create' : `update:${id}`);
  });

  protected readonly canAddLine = computed(
    () => this.form().lines.length < this.maxLines
  );

  /** The id the form was last seeded for, so a later echo of the user's
   *  own save doesn't overwrite what they are typing — while a route
   *  change to another workout, on a reused component, seeds afresh. */
  private seededFor: string | null = null;

  constructor() {
    effect(() => {
      const id = this.editingId();
      if (id === null || this.seededFor === id) return;
      const workout = this.store.workoutById(id);
      if (!workout) return;
      this.seededFor = id;
      this.form.set(formFromWorkout(workout));
    });
  }

  protected patch(patch: Partial<WorkoutFormState>): void {
    this.form.update((form) => ({ ...form, ...patch }));
  }

  protected patchLine(index: number, patch: Partial<WorkoutFormLine>): void {
    this.form.update((form) => ({
      ...form,
      lines: form.lines.map((line, i) =>
        i === index ? { ...line, ...patch } : line
      ),
    }));
  }

  /** A new exercise drops the variant — it belonged to the old one. */
  protected changeExercise(index: number, exerciseId: string): void {
    // Re-picking the same exercise must not throw its variant away.
    if (this.form().lines[index]?.exerciseId === exerciseId) return;
    const fresh = emptyLine(exerciseId);
    this.patchLine(index, {
      exerciseId,
      variantId: '',
      target: this.form().lines[index]?.target || fresh.target,
    });
  }

  /** Typing sets fills the target so the two never disagree. */
  protected changeSets(index: number, sets: string): void {
    const total = setsTotal(sets);
    this.patchLine(index, total === null ? { sets } : { sets, target: total });
  }

  protected addLine(): void {
    if (!this.canAddLine()) return;
    const last = this.form().lines.at(-1);
    this.form.update((form) => ({
      ...form,
      lines: [...form.lines, emptyLine(last?.exerciseId)],
    }));
  }

  protected removeLine(index: number): void {
    this.form.update((form) => ({
      ...form,
      lines: form.lines.filter((_, i) => i !== index),
    }));
  }

  protected moveLine(index: number, delta: -1 | 1): void {
    const lines = [...this.form().lines];
    const target = index + delta;
    if (target < 0 || target >= lines.length) return;
    [lines[index], lines[target]] = [lines[target], lines[index]];
    this.patch({ lines });
  }

  protected openGuide(line: WorkoutFormLine): void {
    void this.guide.open(line.exerciseId, line.variantId || null);
  }

  protected toNumber(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  protected toText(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async save(): Promise<void> {
    const input = formToInput(this.form());
    const id = this.editingId();
    const ok =
      id === null
        ? (await this.store.create(input)) !== null
        : await this.store.update(id, input);
    if (ok) void this.router.navigateByUrl('/workouts');
  }
}
