import { computed, type Signal, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  COMPANION_BOUNDS,
  entryBreakdownField,
  exercisesByCategory,
  ExerciseCategoryId,
  ExerciseDefinition,
  ExerciseVariant,
  findExerciseDefinition,
} from '@pu-stats/models';
import {
  exerciseDisplayName,
  variantDisplayName,
} from '../../i18n/exercise-display-names';
import {
  ExerciseOption,
  TrainingEntryDialogData,
  ExerciseEntryDialogResult,
} from './training-entry-dialog.models';
import {
  exerciseSeedFromData,
  formatKm,
  parseDurationFromParts,
  parseKmToMeters,
  SECONDS_MAX,
  syntheticDefinitionFor,
} from './training-entry-dialog.helpers';
import {
  exerciseWikiLink,
  exerciseWikiTooltip,
  formattedDurationMax,
  formattedExerciseMax,
} from './training-entry-dialog.display';
import {
  appendListEntry,
  buildExerciseResult,
  buildVariantPatch,
  canSubmitExercise,
  clampListValue,
  exerciseOverCapKind,
  removeListEntry,
} from './training-entry-dialog.submit';

/**
 * All exercise-mode form state + logic, extracted so the component stays a
 * thin shell. Inputs are supplied as signals so the state stays reactive.
 */
export class ExerciseFormState {
  readonly exerciseId = signal<string>('');

  readonly exerciseOptions = computed<ExerciseOption[]>(() => {
    const defs = exercisesByCategory().get(this.category()) ?? [];
    return defs.map((def) => ({
      value: def.id,
      label: this.exerciseLabel(def.id),
      definition: def,
    }));
  });

  readonly showExercisePicker = computed(
    () => this.exerciseOptions().length > 0
  );

  readonly currentDefinition = computed<ExerciseDefinition | null>(() => {
    const def = findExerciseDefinition(this.exerciseId());
    if (def) return def;
    // Stale-data fallback: in edit mode the catalog id may have been
    // renamed/removed since the entry was written — synthesize a permissive
    // definition so the form still renders and the user can fix the entry.
    const data = this.data();
    if (this.isEditMode() && data?.kind === 'exercise') {
      return syntheticDefinitionFor(data, this.category());
    }
    return null;
  });

  readonly sets = signal<number[]>([0]);
  readonly hasMultipleSets = computed(() => this.sets().length > 1);
  readonly totalReps = computed(() =>
    this.sets().reduce((sum, s) => sum + (s > 0 ? s : 0), 0)
  );

  // Per-interval value for endurance exercises. Strength exercises keep
  // `[0]` so a stale value can't leak through a measurement switch —
  // submit always picks `sets` vs `intervals`, never both.
  readonly intervals = signal<number[]>([0]);
  readonly hasMultipleIntervals = computed(() => this.intervals().length > 1);
  readonly breakdownField = computed<'sets' | 'intervals'>(() => {
    const def = this.currentDefinition();
    return def ? entryBreakdownField(def.measurement) : 'sets';
  });
  readonly repsMax = computed(
    () => this.currentDefinition()?.max ?? COMPANION_BOUNDS.reps.max
  );
  readonly durationMinutesInput = signal('');
  readonly durationSecondsInput = signal('');
  readonly durationSec = computed(() =>
    parseDurationFromParts(
      this.durationMinutesInput(),
      this.durationSecondsInput()
    )
  );
  readonly secondsMax = SECONDS_MAX;
  readonly distanceInput = signal('');
  readonly distanceM = computed(() => parseKmToMeters(this.distanceInput()));

  // Locale-aware km placeholder. The input is `type="text"` +
  // `inputmode="decimal"` (not `type="number"`) so users can type either
  // separator — `type="number"` silently rejects "," regardless of locale.
  readonly distancePlaceholder: string;
  readonly isTimeMeasurement = computed(
    () => this.currentDefinition()?.measurement === 'time'
  );
  readonly isDistanceTimeMeasurement = computed(
    () => this.currentDefinition()?.measurement === 'distance-time'
  );
  readonly variantControl = new FormControl<string>('', { nonNullable: true });
  readonly showVariantPicker = computed(
    () => (this.currentDefinition()?.variants?.length ?? 0) > 0
  );
  readonly exerciseWikiLink = computed(() =>
    exerciseWikiLink(this.exerciseId())
  );
  readonly exerciseWikiTooltip = computed(() =>
    exerciseWikiTooltip(this.exerciseId())
  );
  readonly formattedMax = computed(() =>
    formattedExerciseMax(this.currentDefinition(), this.repsMax())
  );
  readonly formattedDurationMax = computed(() => formattedDurationMax());
  readonly overCapKind = computed(() =>
    exerciseOverCapKind({
      measurement: this.currentDefinition()?.measurement ?? null,
      max: this.currentDefinition()?.max ?? this.repsMax(),
      distanceM: this.distanceM(),
      durationSec: this.durationSec(),
      totalReps: this.totalReps(),
    })
  );
  readonly overCap = computed(() => this.overCapKind() !== null);
  readonly canSubmit = computed(() =>
    canSubmitExercise({
      def: this.currentDefinition(),
      distanceM: this.distanceM(),
      durationSec: this.durationSec(),
      totalReps: this.totalReps(),
      overCap: this.overCap(),
    })
  );

  constructor(
    private readonly locale: string,
    private readonly category: Signal<ExerciseCategoryId>,
    private readonly data: Signal<TrainingEntryDialogData | null>,
    private readonly isEditMode: Signal<boolean>
  ) {
    this.distancePlaceholder = formatKm(5, locale);
  }

  buildResult(timestamp: string): ExerciseEntryDialogResult | null {
    const def = this.currentDefinition();
    if (!def) return null;
    const data = this.data();
    const initialVariantId =
      data?.kind === 'exercise' ? (data.variantId ?? '') : '';
    return buildExerciseResult({
      timestamp,
      def,
      variantPatch: buildVariantPatch(
        this.variantControl.value,
        initialVariantId
      ),
      sets: this.sets(),
      intervals: this.intervals(),
      durationSec: this.durationSec(),
      distanceM: this.distanceM(),
    });
  }

  // Resets variant + measurement inputs so a stale variant id can't survive
  // the switch and be rejected as `invalid-variant` by the submit validator.
  onExerciseChange(next: string): void {
    if (this.isEditMode()) return;
    this.selectExercise(next);
  }

  onCategorySync(cat: ExerciseCategoryId): void {
    if (this.isEditMode()) return;
    const defs = exercisesByCategory().get(cat) ?? [];
    this.selectExercise(defs[0]?.id ?? '');
  }

  seedFromData(
    data: TrainingEntryDialogData | null,
    cat: ExerciseCategoryId
  ): void {
    if (data?.kind !== 'exercise') {
      const defs = exercisesByCategory().get(cat) ?? [];
      this.exerciseId.set(defs[0]?.id ?? '');
      return;
    }
    this.exerciseId.set(data.exerciseId);
    const seed = exerciseSeedFromData(data, this.locale);
    if (seed.sets) this.sets.set(seed.sets);
    if (seed.intervals) this.intervals.set(seed.intervals);
    this.durationMinutesInput.set(seed.durationMinutes);
    this.durationSecondsInput.set(seed.durationSeconds);
    if (seed.distanceInput !== undefined) {
      this.distanceInput.set(seed.distanceInput);
    }
    this.variantControl.setValue(seed.variantId);
  }

  exerciseVariantLabel(variant: ExerciseVariant): string {
    return variantDisplayName(variant);
  }

  exerciseLabel(id: string): string {
    return exerciseDisplayName(id);
  }

  addSet(): void {
    this.sets.update(appendListEntry);
  }

  removeSet(index: number): void {
    this.sets.update((s) => removeListEntry(s, index));
  }

  updateSet(index: number, value: string): void {
    const clamped = clampListValue(value, this.repsMax());
    this.sets.update((s) => s.map((v, i) => (i === index ? clamped : v)));
  }

  addInterval(): void {
    this.intervals.update(appendListEntry);
  }

  removeInterval(index: number): void {
    this.intervals.update((s) => removeListEntry(s, index));
  }

  updateInterval(index: number, value: string): void {
    const finite = clampListValue(value);
    this.intervals.update((s) => s.map((v, i) => (i === index ? finite : v)));
  }

  private selectExercise(id: string): void {
    this.exerciseId.set(id);
    this.variantControl.setValue('');
    this.sets.set([0]);
    this.intervals.set([0]);
    this.durationMinutesInput.set('');
    this.durationSecondsInput.set('');
    this.distanceInput.set('');
  }
}
