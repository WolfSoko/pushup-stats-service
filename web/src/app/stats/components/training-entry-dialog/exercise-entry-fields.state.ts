import { computed, type Signal, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  COMPANION_BOUNDS,
  entryBreakdownField,
  ExerciseCategoryId,
  ExerciseDefinition,
  ExerciseVariant,
  findExerciseDefinition,
} from '@pu-stats/models';
import { variantDisplayName } from '../../i18n/exercise-display-names';
import {
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

// All exercise-mode form state + logic, extracted so the component stays a thin
// shell. Inputs are supplied as signals so the state stays reactive.
export class ExerciseFormState {
  readonly currentDefinition = computed<ExerciseDefinition | null>(() => {
    const def = findExerciseDefinition(this.exerciseId());
    if (def) return def;
    // Stale-data fallback: in edit mode a renamed/removed catalog id gets a
    // synthetic permissive definition so the user can still fix the entry.
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

  // Endurance per-interval value; strength keeps `[0]` so a stale value can't
  // leak through a measurement switch (submit picks `sets` xor `intervals`).
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

  // Locale-aware km placeholder; the input is text + inputmode=decimal so both
  // decimal separators work (`type="number"` rejects "," regardless of locale).
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
    private readonly exerciseId: Signal<string>,
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

  /**
   * Clears variant + measurement inputs after the parent switched the
   * exercise, so a stale variant id can't survive the switch and be
   * rejected as `invalid-variant` by the submit validator, and a rep
   * count can't leak into a time-measured exercise.
   */
  resetForExercise(): void {
    this.variantControl.setValue('');
    this.sets.set([0]);
    this.intervals.set([0]);
    this.durationMinutesInput.set('');
    this.durationSecondsInput.set('');
    this.distanceInput.set('');
  }

  seedFromData(data: TrainingEntryDialogData | null): void {
    if (data?.kind !== 'exercise') return;
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
}
