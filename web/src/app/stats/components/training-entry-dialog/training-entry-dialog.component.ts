import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AsyncPipe } from '@angular/common';
import { map, startWith } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  COMPANION_BOUNDS,
  entryBreakdownField,
  exercisesByCategory,
  ExerciseCategoryId,
  ExerciseDefinition,
  ExerciseVariant,
  findExerciseDefinition,
  findExerciseWikiEntry,
  findPushupTypeByLocalizedName,
  findPushupTypeByStoredValue,
  formatExerciseValue,
  localizePushupType,
  PUSHUP_TYPES,
  PushupTypeInfo,
} from '@pu-stats/models';
import { appendLocalOffset } from '@pu-stats/date';
import {
  exerciseDisplayName,
  variantDisplayName,
} from '../../i18n/exercise-display-names';
import {
  CategoryOption,
  ExerciseOption,
  PushupTypeOption,
  PUSHUP_EXERCISE_ID,
  TrainingEntryDialogData,
  PushupEntryDialogResult,
  ExerciseEntryDialogResult,
} from './training-entry-dialog.models';
import {
  buildCategoryOptions,
  formatKm,
  formatKmInput,
  inferExerciseCategory,
  parseDurationFromParts,
  parseKmToMeters,
  SECONDS_MAX,
  splitDurationParts,
  syntheticDefinitionFor,
} from './training-entry-dialog.helpers';

/**
 * Single dialog for entering / editing every training type the app
 * supports. Two execution modes:
 *
 *   - **Pushup mode** (category = `'pushup'`): variant autocomplete +
 *     source field + reps/sets list. Submits with `kind: 'pushup'` for
 *     the legacy `pushups` Firestore collection.
 *
 *   - **Exercise mode** (every other category): exercise picker driven
 *     by the catalog, then measurement-aware fields (reps/sets,
 *     mm:ss, km + mm:ss). Submits with `kind: 'exercise'` for the
 *     `exerciseEntries` collection.
 *
 * Edit mode (caller passes `data`) locks the category and exercise
 * pickers — moving an entry between collections is not supported.
 */
@Component({
  selector: 'app-training-entry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatTooltipModule,
    RouterLink,
  ],
  styleUrl: './training-entry-dialog.component.scss',
  templateUrl: './training-entry-dialog.component.html',
})
export class TrainingEntryDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<TrainingEntryDialogComponent>
  );
  private readonly data = inject<TrainingEntryDialogData | null>(
    MAT_DIALOG_DATA,
    {
      optional: true,
    }
  );
  private readonly locale = inject(LOCALE_ID) as string;

  readonly isEditMode = !!this.data;

  /**
   * Cap pushup reps at the same per-entry ceiling other catalog
   * exercises use. Pushups currently have no per-record schema cap,
   * but {@link COMPANION_BOUNDS}.reps gives us a reasonable shared
   * upper bound (500) that prevents typo-driven absurd entries.
   */
  private readonly pushupRepsMax = COMPANION_BOUNDS.reps.max;

  readonly categoryOptions: ReadonlyArray<CategoryOption> =
    buildCategoryOptions();

  // ----- selection state ---------------------------------------------------

  readonly category = signal<ExerciseCategoryId>(this.initialCategory());

  /**
   * Catalog exercise id when category !== 'pushup'. Defaults to the
   * first exercise of the chosen category. For the `pushup` category
   * (Liegestütze) the value is the synthetic {@link PUSHUP_EXERCISE_ID}
   * so the picker can show a single entry without a real catalog row —
   * the legacy `pushups` Firestore collection has no
   * `ExerciseDefinition`. Other push exercises (dips, handstand) live
   * in the separate `push` category as normal catalog entries.
   */
  readonly exerciseId = signal<string>(this.initialExerciseId());

  readonly mode = computed<'pushup' | 'exercise'>(() =>
    this.category() === 'pushup' ? 'pushup' : 'exercise'
  );

  readonly exerciseOptions = computed<ExerciseOption[]>(() => {
    const cat = this.category();
    if (cat === 'pushup') {
      return [
        {
          value: PUSHUP_EXERCISE_ID,
          label: $localize`:@@trainingEntryDialog.pushup.exercise:Liegestütze`,
        },
      ];
    }
    const defs = exercisesByCategory().get(cat) ?? [];
    return defs.map((def) => ({
      value: def.id,
      label: this.exerciseLabel(def.id),
      definition: def,
    }));
  });

  readonly showExercisePicker = computed(
    () => this.mode() === 'exercise' && this.exerciseOptions().length > 0
  );

  readonly currentDefinition = computed<ExerciseDefinition | null>(() => {
    if (this.mode() !== 'exercise') return null;
    const def = findExerciseDefinition(this.exerciseId());
    if (def) return def;
    // Stale-data fallback: in edit mode, the catalog id may have been
    // renamed or removed since the entry was written. Synthesize a
    // permissive `ExerciseDefinition` so the form still renders against
    // the original measurement and the user can fix the entry instead
    // of staring at a frozen, never-submittable dialog.
    if (this.isEditMode && this.data?.kind === 'exercise') {
      return syntheticDefinitionFor(this.data, this.category());
    }
    return null;
  });

  // ----- timestamp & set state --------------------------------------------

  private readonly originalTimestamp = this.data?.timestamp ?? null;

  readonly timestamp = signal(
    this.data ? this.data.timestamp.slice(0, 16) : this.defaultDateTimeLocal()
  );

  readonly sets = signal<number[]>(this.initialSets());

  readonly hasMultipleSets = computed(() => this.sets().length > 1);

  readonly totalReps = computed(() =>
    this.sets().reduce((sum, s) => sum + (s > 0 ? s : 0), 0)
  );

  /**
   * Per-interval primary value for endurance exercises (seconds for
   * `time`, meters for `distance` / `distance-time`). Only rendered
   * when the current measurement maps to `'intervals'` via
   * {@link entryBreakdownField}. Strength exercises keep this at the
   * initial `[0]` so a stale value can't leak through a measurement
   * switch — the submit path always picks `sets` vs `intervals` based
   * on the active measurement, never both.
   */
  readonly intervals = signal<number[]>(this.initialIntervals());

  readonly hasMultipleIntervals = computed(() => this.intervals().length > 1);

  readonly breakdownField = computed<'sets' | 'intervals'>(() => {
    const def = this.currentDefinition();
    return def ? entryBreakdownField(def.measurement) : 'sets';
  });

  /** Active reps cap — catalog `def.max` for exercise mode, fixed for pushup. */
  readonly repsMax = computed(() => {
    if (this.mode() === 'pushup') return this.pushupRepsMax;
    return this.currentDefinition()?.max ?? this.pushupRepsMax;
  });

  // ----- duration / distance ----------------------------------------------

  /**
   * Split duration input — minutes + seconds — for time-measurement
   * exercises (plank) and the duration companion of distance-time
   * exercises (cardio.running). Stored as strings so an empty field is
   * representable; combined into integer seconds via {@link durationSec}.
   */
  private readonly initialDurationParts = splitDurationParts(
    this.data?.kind === 'exercise' ? this.data.durationSec : undefined
  );

  readonly durationMinutesInput = signal(this.initialDurationParts.minutes);
  readonly durationSecondsInput = signal(this.initialDurationParts.seconds);

  readonly durationSec = computed(() =>
    parseDurationFromParts(
      this.durationMinutesInput(),
      this.durationSecondsInput()
    )
  );

  readonly secondsMax = SECONDS_MAX;

  readonly distanceInput = signal(
    this.data?.kind === 'exercise' && this.data.distanceM !== undefined
      ? formatKmInput(this.data.distanceM, this.locale)
      : ''
  );

  readonly distanceM = computed(() => parseKmToMeters(this.distanceInput()));

  /**
   * Locale-aware placeholder for the km input. The input is `type="text"` +
   * `inputmode="decimal"` (not `type="number"`) so users can type either the
   * dot- or comma-separated form their locale uses — `<input type="number">`
   * silently rejects "," in most browsers regardless of `LOCALE_ID`.
   */
  readonly distancePlaceholder = formatKm(5, this.locale);

  readonly isTimeMeasurement = computed(
    () => this.currentDefinition()?.measurement === 'time'
  );

  readonly isDistanceTimeMeasurement = computed(
    () => this.currentDefinition()?.measurement === 'distance-time'
  );

  // ----- exercise variant picker ------------------------------------------

  readonly variantControl = new FormControl<string>(
    this.data?.kind === 'exercise' ? (this.data.variantId ?? '') : '',
    { nonNullable: true }
  );

  readonly showVariantPicker = computed(() => {
    if (this.mode() !== 'exercise') return false;
    return (this.currentDefinition()?.variants?.length ?? 0) > 0;
  });

  // ----- pushup type & source ---------------------------------------------

  readonly pushupTypeControl = new FormControl<string>(
    this.data?.kind === 'pushup' ? this.data.type || 'standard' : 'standard',
    { nonNullable: true }
  );

  readonly sourceControl = new FormControl<string>(
    this.normalizeSource(
      this.data?.kind === 'pushup' ? this.data.source || 'web' : 'web'
    ),
    { nonNullable: true }
  );

  private readonly pushupTypeOptions: ReadonlyArray<PushupTypeOption> =
    PUSHUP_TYPES.map((t) => ({
      value: t.id,
      label: localizePushupType(t, this.locale).name,
    }));

  private readonly sourceOptions = ['web', 'whatsapp'];

  readonly filteredPushupTypeOptions$ =
    this.pushupTypeControl.valueChanges.pipe(
      startWith(this.pushupTypeControl.value),
      map((value) => this.filterPushupTypeOptions(value))
    );

  readonly filteredSourceOptions$ = this.sourceControl.valueChanges.pipe(
    startWith(this.sourceControl.value),
    map((value) => this.filterOptions(value, this.sourceOptions))
  );

  readonly displayPushupType = (value: string | null | undefined): string => {
    if (!value) return '';
    const match = findPushupTypeByStoredValue(value);
    return match ? localizePushupType(match, this.locale).name : value;
  };

  private readonly pushupTypeValue = toSignal(
    this.pushupTypeControl.valueChanges.pipe(
      startWith(this.pushupTypeControl.value)
    ),
    { initialValue: this.pushupTypeControl.value }
  );

  readonly pushupWikiQueryParams = computed(() => {
    const match = this.resolvePushupType(this.pushupTypeValue());
    return match ? { type: match.slug } : {};
  });

  /**
   * Wiki-link target for the currently selected exercise. Returns the
   * detail-page route if the exercise has a wiki entry, else the list
   * page so the icon never becomes a dead-end. Mirrors the pushup help
   * icon's behaviour for non-pushup categories.
   */
  readonly exerciseWikiLink = computed<string[]>(() => {
    const entry = findExerciseWikiEntry(this.exerciseId());
    return entry ? ['/wiki/uebungen', entry.slug] : ['/wiki/uebungen'];
  });

  readonly exerciseWikiTooltip = computed(() => {
    const entry = findExerciseWikiEntry(this.exerciseId());
    if (!entry) {
      return $localize`:@@exerciseWikiLinkTooltip.generic:Anleitung zu Übungen öffnen`;
    }
    const template = $localize`:@@exerciseWikiLinkTooltip.specific:Anleitung öffnen`;
    return `${template}: ${this.exerciseLabel(entry.id)}`;
  });

  readonly pushupWikiTooltip = computed(() => {
    const match = this.resolvePushupType(this.pushupTypeValue());
    if (!match) {
      return $localize`:@@typeWikiLinkTooltip.generic:Anleitung zu Liegestütztypen öffnen`;
    }
    const template = $localize`:@@typeWikiLinkTooltip.specific:Anleitung öffnen`;
    return `${template}: ${localizePushupType(match, this.locale).name}`;
  });

  pushupTooltipFor(label: string): string {
    const type = this.resolvePushupType(label);
    return type ? localizePushupType(type, this.locale).summary : '';
  }

  // ----- caps & submit gating ---------------------------------------------

  readonly formattedMax = computed(() => {
    const def = this.currentDefinition();
    if (!def) return String(this.repsMax());
    return formatExerciseValue(def.max, def.unit);
  });

  readonly formattedDurationMax = computed(() =>
    formatExerciseValue(COMPANION_BOUNDS.durationSec.max, 's')
  );

  readonly overCapKind = computed<'distance' | 'duration' | 'value' | null>(
    () => {
      if (this.isDistanceTimeMeasurement()) {
        const def = this.currentDefinition();
        if (!def) return null;
        const m = this.distanceM();
        const sec = this.durationSec();
        if (m !== null && m > def.max) return 'distance';
        if (sec !== null && sec > COMPANION_BOUNDS.durationSec.max)
          return 'duration';
        return null;
      }
      if (this.isTimeMeasurement()) {
        const def = this.currentDefinition();
        if (!def) return null;
        const sec = this.durationSec();
        return sec !== null && sec > def.max ? 'value' : null;
      }
      return this.totalReps() > this.repsMax() ? 'value' : null;
    }
  );

  readonly overCap = computed(() => this.overCapKind() !== null);

  readonly canSubmit = computed(() => {
    if (this.timestamp().length === 0) return false;
    if (this.mode() === 'pushup') {
      return this.totalReps() > 0 && !this.overCap();
    }
    const def = this.currentDefinition();
    if (!def) return false;
    if (this.isDistanceTimeMeasurement()) {
      const m = this.distanceM();
      const sec = this.durationSec();
      return (
        m !== null && m >= def.min && sec !== null && sec > 0 && !this.overCap()
      );
    }
    if (this.isTimeMeasurement()) {
      const sec = this.durationSec();
      return sec !== null && sec > 0 && sec >= def.min && !this.overCap();
    }
    return this.totalReps() >= def.min && !this.overCap();
  });

  // ----- handlers ---------------------------------------------------------

  onCategoryChange(next: ExerciseCategoryId): void {
    if (this.isEditMode) return;
    this.category.set(next);
    // Reset exercise to the first option of the new category. Reset
    // measurement-specific inputs so a stale value from a previously
    // selected exercise can't leak through to the new one.
    if (next === 'pushup') {
      this.exerciseId.set(PUSHUP_EXERCISE_ID);
    } else {
      const defs = exercisesByCategory().get(next) ?? [];
      this.exerciseId.set(defs[0]?.id ?? '');
    }
    this.sets.set([0]);
    this.intervals.set([0]);
    this.durationMinutesInput.set('');
    this.durationSecondsInput.set('');
    this.distanceInput.set('');
    this.variantControl.setValue('');
  }

  /**
   * Exercise picker change. Resets the variant control and the
   * measurement-specific inputs so a stale variant id from the previous
   * exercise can't survive the switch and be rejected as
   * `invalid-variant` by the data-access validator on submit.
   */
  onExerciseChange(next: string): void {
    if (this.isEditMode) return;
    this.exerciseId.set(next);
    this.variantControl.setValue('');
    this.sets.set([0]);
    this.intervals.set([0]);
    this.durationMinutesInput.set('');
    this.durationSecondsInput.set('');
    this.distanceInput.set('');
  }

  exerciseVariantLabel(variant: ExerciseVariant): string {
    return variantDisplayName(variant);
  }

  exerciseLabel(id: string): string {
    return exerciseDisplayName(id);
  }

  addSet(): void {
    const last = this.sets()[this.sets().length - 1] ?? 0;
    this.sets.update((s) => [...s, last > 0 ? last : 0]);
  }

  removeSet(index: number): void {
    this.sets.update((s) => {
      const next = s.filter((_, i) => i !== index);
      return next.length === 0 ? [0] : next;
    });
  }

  updateSet(index: number, value: string): void {
    const parsed = Number(value);
    const finite = Number.isFinite(parsed)
      ? Math.max(0, Math.floor(parsed))
      : 0;
    const clamped = Math.min(finite, this.repsMax());
    this.sets.update((s) => s.map((v, i) => (i === index ? clamped : v)));
  }

  addInterval(): void {
    const last = this.intervals()[this.intervals().length - 1] ?? 0;
    this.intervals.update((s) => [...s, last > 0 ? last : 0]);
  }

  removeInterval(index: number): void {
    this.intervals.update((s) => {
      const next = s.filter((_, i) => i !== index);
      return next.length === 0 ? [0] : next;
    });
  }

  updateInterval(index: number, value: string): void {
    const parsed = Number(value);
    const finite = Number.isFinite(parsed)
      ? Math.max(0, Math.floor(parsed))
      : 0;
    this.intervals.update((s) => s.map((v, i) => (i === index ? finite : v)));
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

    if (this.mode() === 'pushup') {
      const validSets = this.sets().filter((s) => s > 0);
      const reps = validSets.reduce((sum, s) => sum + s, 0);
      if (reps <= 0) return;

      const rawType = (this.pushupTypeControl.value || '').trim() || 'standard';
      const matched = this.resolvePushupType(rawType);
      const type = matched ? matched.id : rawType;
      const source = this.normalizeSource(
        (this.sourceControl.value || '').trim() || 'web'
      );

      const result: PushupEntryDialogResult = {
        kind: 'pushup',
        timestamp,
        reps,
        sets: validSets,
        source,
        type,
      };
      this.dialogRef.close(result);
      return;
    }

    const def = this.currentDefinition();
    if (!def) return;

    // Variant tri-state preservation — only emit when changed so we
    // don't race against concurrent edits with stale data.
    const variantId = this.variantControl.value.trim();
    const initialVariantId =
      this.data?.kind === 'exercise' ? (this.data.variantId ?? '') : '';
    const variantPatch: { variantId?: string | null } =
      variantId === initialVariantId
        ? {}
        : variantId
          ? { variantId }
          : initialVariantId
            ? { variantId: null }
            : {};

    const measurement = def.measurement;
    const validIntervals = this.intervals().filter((s) => s > 0);

    if (measurement === 'time') {
      const sec = this.durationSec();
      if (sec === null || sec <= 0) return;
      const result: ExerciseEntryDialogResult = {
        kind: 'exercise',
        exerciseId: def.id,
        measurement,
        ...variantPatch,
        timestamp,
        reps: 0,
        sets: [],
        intervals: validIntervals,
        durationSec: sec,
      };
      this.dialogRef.close(result);
      return;
    }

    if (measurement === 'distance-time') {
      const m = this.distanceM();
      const sec = this.durationSec();
      if (m === null || m <= 0 || sec === null || sec <= 0) return;
      const result: ExerciseEntryDialogResult = {
        kind: 'exercise',
        exerciseId: def.id,
        measurement,
        ...variantPatch,
        timestamp,
        reps: 0,
        sets: [],
        intervals: validIntervals,
        distanceM: m,
        durationSec: sec,
      };
      this.dialogRef.close(result);
      return;
    }

    if (measurement === 'distance') {
      // No pure-`distance` exercise ships in the catalog yet (cardio
      // entries use `distance-time`), so this branch is dead today.
      // Kept in lockstep with the data model so a future
      // distance-only exercise (e.g. a sprint-repeats workout
      // measured purely by metres) emits `intervals` instead of
      // silently dropping them through the strength fallback.
      const m = this.distanceM();
      if (m === null || m <= 0) return;
      const result: ExerciseEntryDialogResult = {
        kind: 'exercise',
        exerciseId: def.id,
        measurement,
        ...variantPatch,
        timestamp,
        reps: 0,
        sets: [],
        intervals: validIntervals,
        distanceM: m,
      };
      this.dialogRef.close(result);
      return;
    }

    const validSets = this.sets().filter((s) => s > 0);
    const reps = validSets.reduce((sum, s) => sum + s, 0);
    if (reps <= 0) return;

    const result: ExerciseEntryDialogResult = {
      kind: 'exercise',
      exerciseId: def.id,
      measurement,
      ...variantPatch,
      timestamp,
      reps,
      sets: validSets,
      intervals: [],
    };
    this.dialogRef.close(result);
  }

  // ----- helpers ----------------------------------------------------------

  private initialCategory(): ExerciseCategoryId {
    if (!this.data) return 'pushup';
    if (this.data.kind === 'pushup') return 'pushup';
    const def = findExerciseDefinition(this.data.exerciseId);
    if (def) return def.categoryId;
    // Stale exerciseId (renamed/removed in the catalog): stay in
    // exercise mode so the dialog doesn't silently flip to pushup,
    // which would also corrupt the emitted payload shape on submit.
    // Pick the category the id is prefixed with when it follows the
    // dotted catalog convention (e.g. `'abs.weighted-situps'` → `core`),
    // otherwise default to the first non-push catalog category.
    return inferExerciseCategory(this.data.exerciseId);
  }

  private initialExerciseId(): string {
    if (!this.data) return PUSHUP_EXERCISE_ID;
    if (this.data.kind === 'pushup') return PUSHUP_EXERCISE_ID;
    return this.data.exerciseId;
  }

  private initialSets(): number[] {
    if (!this.data) return [0];
    if (this.data.sets?.length) return [...this.data.sets];
    if (this.data.reps !== undefined && this.data.reps > 0)
      return [this.data.reps];
    return [0];
  }

  private initialIntervals(): number[] {
    if (this.data?.kind !== 'exercise') return [0];
    if (this.data.intervals?.length) return [...this.data.intervals];
    return [0];
  }

  private resolvePushupType(
    value: string | null | undefined
  ): PushupTypeInfo | null {
    return findPushupTypeByLocalizedName(value, this.locale);
  }

  private normalizeSource(value: string): string {
    const v = (value || '').trim();
    if (!v) return 'web';
    if (v === 'wa') return 'whatsapp';
    return v;
  }

  private filterOptions(
    value: string | null | undefined,
    options: ReadonlyArray<string>
  ): string[] {
    const needle = (value ?? '').toLowerCase().trim();
    if (!needle) return [...options];
    if (options.some((opt) => opt.toLowerCase() === needle))
      return [...options];
    return options.filter((opt) => opt.toLowerCase().includes(needle));
  }

  private filterPushupTypeOptions(
    value: string | null | undefined
  ): PushupTypeOption[] {
    const needle = (value ?? '').toLowerCase().trim();
    if (!needle) return [...this.pushupTypeOptions];
    const exact = this.pushupTypeOptions.some(
      (opt) =>
        opt.value.toLowerCase() === needle || opt.label.toLowerCase() === needle
    );
    if (exact) return [...this.pushupTypeOptions];
    return this.pushupTypeOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(needle) ||
        opt.value.toLowerCase().includes(needle)
    );
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}
