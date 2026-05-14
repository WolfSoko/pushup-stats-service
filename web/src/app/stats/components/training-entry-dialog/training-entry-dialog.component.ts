import { AsyncPipe, formatNumber } from '@angular/common';
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
  appendLocalOffset,
  COMPANION_BOUNDS,
  EXERCISE_CATEGORIES,
  exercisesByCategory,
  ExerciseCategoryId,
  ExerciseDefinition,
  ExerciseVariant,
  findExerciseDefinition,
  findPushupTypeByLocalizedName,
  findPushupTypeByStoredValue,
  formatExerciseValue,
  localizePushupType,
  MeasurementType,
  PUSHUP_TYPES,
  PushupTypeInfo,
} from '@pu-stats/models';
import {
  exerciseDisplayName,
  variantDisplayName,
} from '../../i18n/exercise-display-names';

/**
 * Synthetic id for the implicit "Liegestütze (Standard)" exercise inside
 * the pushup category. Pushups live in their own Firestore collection
 * (`pushups`) and don't have a catalog `ExerciseDefinition`, so the
 * exercise picker uses this stable sentinel to identify the row.
 */
const PUSHUP_EXERCISE_ID = 'pushup';

const SECONDS_MAX = 59;

/**
 * Initial / edit-mode payload for {@link TrainingEntryDialogComponent}.
 *
 * Discriminated by `kind` — pushup entries live in the legacy
 * `pushups` collection, exercise entries in `exerciseEntries`. In edit
 * mode the picker rows for category and exercise are disabled — users
 * cannot move an entry between collections after the fact.
 */
export interface PushupEntryDialogData {
  kind: 'pushup';
  timestamp: string;
  /** Total reps. */
  reps?: number;
  sets?: number[];
  /** Source label (web / whatsapp / …). */
  source?: string;
  /** Variant id (e.g. `'standard'`, `'diamond'`). */
  type?: string;
}

export interface ExerciseEntryDialogData {
  kind: 'exercise';
  timestamp: string;
  /** Catalog id (e.g. `'plank.standard'`). May reference a stale id
   *  whose catalog entry was renamed/removed; the dialog falls back to
   *  a synthetic definition in that case. */
  exerciseId: string;
  /** For reps-measurement exercises: total reps. */
  reps?: number;
  sets?: number[];
  /** For `'time'` and `'distance-time'` measurements. */
  durationSec?: number;
  /** For `'distance-time'` measurement (meters). */
  distanceM?: number;
  /** Variant id within the catalog definition. */
  variantId?: string;
}

export type TrainingEntryDialogData =
  | PushupEntryDialogData
  | ExerciseEntryDialogData;

export interface PushupEntryDialogResult {
  kind: 'pushup';
  timestamp: string;
  /** Total reps. */
  reps: number;
  /** Per-set breakdown — `[reps]` for a single set. */
  sets: number[];
  /** Source label. Always populated. */
  source: string;
  /** Variant id. Always populated (defaults to `'standard'`). */
  type: string;
}

export interface ExerciseEntryDialogResult {
  kind: 'exercise';
  timestamp: string;
  /** Catalog id the entry was logged against. */
  exerciseId: string;
  /** Catalog measurement — drives the consumer's payload shape. */
  measurement: MeasurementType;
  /** Total reps for reps-measurements; `0` otherwise. */
  reps: number;
  /** Per-set breakdown for reps-measurements; `[]` otherwise. */
  sets: number[];
  /** Set for `'time'` and `'distance-time'`. */
  durationSec?: number;
  /** Set for `'distance-time'`. */
  distanceM?: number;
  /**
   * Variant id tri-state:
   *   - non-empty `string`: set or keep this variant.
   *   - `null`: clear an existing variant (caller maps to `deleteField()`).
   *   - `undefined`: no change / no variant in create mode.
   */
  variantId?: string | null;
}

export type TrainingEntryDialogResult =
  | PushupEntryDialogResult
  | ExerciseEntryDialogResult;

interface CategoryOption {
  value: ExerciseCategoryId;
  label: string;
}

interface ExerciseOption {
  /** Catalog id, or {@link PUSHUP_EXERCISE_ID} for the pushup row. */
  value: string;
  label: string;
  definition?: ExerciseDefinition;
}

interface PushupTypeOption {
  value: string;
  label: string;
}

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
  styles: [
    `
      mat-dialog-content {
        display: grid;
        gap: 10px;
      }
      mat-form-field:first-of-type {
        margin-top: 8px;
      }
      .set-row {
        display: flex;
        align-items: center;
        gap: 8px;
        animation: clone-set 300ms cubic-bezier(0.4, 0, 0.2, 1) both;
        transform-origin: top center;
      }
      .set-row mat-form-field {
        flex: 1;
      }
      .duration-row {
        display: flex;
        gap: 8px;
      }
      .duration-row mat-form-field {
        flex: 1 1 0;
        min-width: 0;
      }
      @keyframes clone-set {
        from {
          opacity: 0;
          max-height: 0;
          transform: scaleY(0.3) translateY(-8px);
        }
        to {
          opacity: 1;
          max-height: 80px;
          transform: scaleY(1) translateY(0);
        }
      }
      .total-reps {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant);
        text-align: end;
      }
      .type-row {
        display: flex;
        align-items: flex-start;
        gap: 4px;
      }
      .type-row mat-form-field {
        flex: 1;
      }
      .type-help {
        margin-top: 12px;
      }
      .type-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        width: 100%;
      }
      .type-option-info {
        font-size: 18px;
        width: 18px;
        height: 18px;
        line-height: 18px;
        color: var(--mat-sys-on-surface-variant);
        cursor: help;
        flex: 0 0 auto;
      }
    `,
  ],
  template: `
    <h2 mat-dialog-title>
      @if (isEditMode) {
        <span i18n="@@editDialogTitle">Eintrag bearbeiten</span>
      } @else {
        <span i18n="@@trainingEntryDialog.title">Trainingseintrag anlegen</span>
      }
    </h2>

    <mat-dialog-content>
      <mat-form-field appearance="outline">
        <mat-label i18n="@@trainingEntryDialog.category">Kategorie</mat-label>
        <mat-select
          [value]="category()"
          (valueChange)="onCategoryChange($event)"
          [disabled]="isEditMode"
          data-testid="training-entry-category"
        >
          @for (option of categoryOptions; track option.value) {
            <mat-option [value]="option.value">{{ option.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (showExercisePicker()) {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@trainingEntryDialog.exercise">Übung</mat-label>
          <mat-select
            [value]="exerciseId()"
            (valueChange)="onExerciseChange($event)"
            [disabled]="isEditMode"
            data-testid="training-entry-exercise"
          >
            @for (option of exerciseOptions(); track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      <mat-form-field appearance="outline">
        <mat-label i18n="@@timestampLabel">Zeitpunkt</mat-label>
        <input
          matInput
          type="datetime-local"
          [value]="timestamp()"
          (input)="timestamp.set(asValue($event))"
          required
        />
      </mat-form-field>

      @if (mode() === 'pushup') {
        <div class="type-row">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@typeLabel">Typ</mat-label>
            <input
              type="text"
              matInput
              [formControl]="pushupTypeControl"
              [matAutocomplete]="typeAuto"
              placeholder="Auswählen oder eintippen"
              i18n-placeholder="@@typePlaceholder"
            />
            <mat-autocomplete
              #typeAuto="matAutocomplete"
              [displayWith]="displayPushupType"
            >
              @for (
                option of filteredPushupTypeOptions$ | async;
                track option.value
              ) {
                <mat-option [value]="option.value">
                  <span class="type-option">
                    <span>{{ option.label }}</span>
                    @if (pushupTooltipFor(option.value); as info) {
                      <mat-icon
                        class="type-option-info"
                        [matTooltip]="info"
                        matTooltipPosition="right"
                        [attr.aria-label]="info"
                        role="img"
                        (click)="$event.stopPropagation()"
                        >info_outline</mat-icon
                      >
                    }
                  </span>
                </mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
          <a
            mat-icon-button
            class="type-help"
            [routerLink]="['/wiki/liegestuetz-typen']"
            [queryParams]="pushupWikiQueryParams()"
            [matTooltip]="pushupWikiTooltip()"
            matTooltipPosition="left"
            mat-dialog-close
            i18n-aria-label="@@typeWikiLinkAria"
            aria-label="Anleitung zum Liegestütztyp öffnen"
          >
            <mat-icon>help_outline</mat-icon>
          </a>
        </div>
      } @else if (showVariantPicker()) {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@entryDialog.variant">Variante</mat-label>
          <mat-select [formControl]="variantControl">
            <mat-option [value]="''" i18n="@@entryDialog.variantNone"
              >—</mat-option
            >
            @for (variant of currentDefinition()?.variants; track variant.id) {
              <mat-option [value]="variant.id">{{
                exerciseVariantLabel(variant)
              }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      @if (isDistanceTimeMeasurement()) {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@entryDialog.distance">Distanz (km)</mat-label>
          <input
            matInput
            type="text"
            inputmode="decimal"
            [placeholder]="distancePlaceholder"
            [value]="distanceInput()"
            (input)="distanceInput.set(asValue($event))"
            data-testid="training-entry-distance"
            required
          />
        </mat-form-field>
        <div class="duration-row">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@entryDialog.durationMinutes">Minuten</mat-label>
            <input
              matInput
              type="number"
              inputmode="numeric"
              placeholder="25"
              min="0"
              step="1"
              [value]="durationMinutesInput()"
              (input)="durationMinutesInput.set(asValue($event))"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@entryDialog.durationSeconds">Sekunden</mat-label>
            <input
              matInput
              type="number"
              inputmode="numeric"
              placeholder="0"
              min="0"
              [max]="secondsMax"
              step="1"
              [value]="durationSecondsInput()"
              (input)="durationSecondsInput.set(asValue($event))"
            />
          </mat-form-field>
        </div>
      } @else if (isTimeMeasurement()) {
        <div class="duration-row">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@entryDialog.durationMinutes">Minuten</mat-label>
            <input
              matInput
              type="number"
              inputmode="numeric"
              placeholder="1"
              min="0"
              step="1"
              [value]="durationMinutesInput()"
              (input)="durationMinutesInput.set(asValue($event))"
            />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label i18n="@@entryDialog.durationSeconds">Sekunden</mat-label>
            <input
              matInput
              type="number"
              inputmode="numeric"
              placeholder="30"
              min="0"
              [max]="secondsMax"
              step="1"
              [value]="durationSecondsInput()"
              (input)="durationSecondsInput.set(asValue($event))"
            />
          </mat-form-field>
        </div>
      } @else {
        @for (set of sets(); track $index) {
          <div class="set-row">
            <mat-form-field appearance="outline">
              @if (hasMultipleSets()) {
                <mat-label i18n="@@setLabel">Set {{ $index + 1 }}</mat-label>
              } @else {
                <mat-label i18n="@@repsLabel">Reps</mat-label>
              }
              <input
                matInput
                type="number"
                [min]="0"
                [max]="repsMax()"
                step="1"
                [value]="set"
                (input)="updateSet($index, asValue($event))"
                required
              />
            </mat-form-field>
            @if (hasMultipleSets()) {
              <button
                type="button"
                mat-icon-button
                (click)="removeSet($index)"
                i18n-aria-label="@@removeSetAria"
                aria-label="Set entfernen"
              >
                <mat-icon>remove_circle_outline</mat-icon>
              </button>
            }
            @if ($last) {
              <button
                type="button"
                mat-icon-button
                (click)="addSet()"
                i18n-aria-label="@@addSetAria"
                aria-label="Set hinzufügen"
                i18n-matTooltip="@@addSetTooltip"
                matTooltip="Weiteres Set hinzufügen"
              >
                <mat-icon>add_circle_outline</mat-icon>
              </button>
            }
          </div>
        }
        @if (hasMultipleSets()) {
          <div class="total-reps" i18n="@@totalReps">
            Gesamt: {{ totalReps() }} Reps
          </div>
        }
      }

      @if (overCap()) {
        <div class="total-reps">
          @if (overCapKind() === 'duration') {
            <span i18n="@@entryDialog.overCapDuration"
              >Maximum-Dauer: {{ formattedDurationMax() }}</span
            >
          } @else if (overCapKind() === 'distance' || isTimeMeasurement()) {
            <span i18n="@@entryDialog.overCapTime"
              >Maximum: {{ formattedMax() }}</span
            >
          } @else {
            <span i18n="@@entryDialog.overCap"
              >Maximum: {{ repsMax() }} pro Eintrag</span
            >
          }
        </div>
      }

      @if (mode() === 'pushup') {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@sourceLabel">Quelle</mat-label>
          <input
            type="text"
            matInput
            [formControl]="sourceControl"
            [matAutocomplete]="sourceAuto"
            placeholder="web / whatsapp / eigene Quelle"
            i18n-placeholder="@@sourcePlaceholder"
          />
          <mat-autocomplete #sourceAuto="matAutocomplete">
            @for (option of filteredSourceOptions$ | async; track option) {
              <mat-option [value]="option">{{ option }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" mat-button mat-dialog-close i18n="@@cancel">
        Abbrechen
      </button>
      <button
        type="button"
        mat-flat-button
        [disabled]="!canSubmit()"
        (click)="submit()"
        i18n="@@saveEntry"
        data-testid="training-entry-submit"
      >
        Speichern
      </button>
    </mat-dialog-actions>
  `,
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
        distanceM: m,
        durationSec: sec,
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

const CATEGORY_NAMES: Record<ExerciseCategoryId, () => string> = {
  pushup: () => $localize`:@@exercise.category.pushup:Liegestütze`,
  push: () => $localize`:@@exercise.category.push:Drücken`,
  pull: () => $localize`:@@exercise.category.pull:Ziehen`,
  squat: () => $localize`:@@exercise.category.squat:Kniebeuge`,
  hinge: () => $localize`:@@exercise.category.hinge:Hüftstreckung`,
  lunge: () => $localize`:@@exercise.category.lunge:Ausfallschritt`,
  carry: () => $localize`:@@exercise.category.carry:Tragen`,
  core: () => $localize`:@@exercise.category.core:Rumpf`,
  cardio: () => $localize`:@@exercise.category.cardio:Ausdauer`,
  mobility: () => $localize`:@@exercise.category.mobility:Mobilität`,
  strength: () => $localize`:@@exercise.category.strength:Krafttraining`,
};

function buildCategoryOptions(): ReadonlyArray<CategoryOption> {
  // Filter to categories that actually have something to log in this
  // dialog: push (always — legacy pushups handled separately) plus
  // any catalog category with at least one ExerciseDefinition.
  const byCategory = exercisesByCategory();
  return EXERCISE_CATEGORIES.filter(
    (cat) => cat.id === 'pushup' || (byCategory.get(cat.id)?.length ?? 0) > 0
  ).map((cat) => ({
    value: cat.id,
    label: (CATEGORY_NAMES[cat.id] ?? (() => cat.id))(),
  }));
}

/**
 * Combine the two number-input parts into total integer seconds.
 * Returns `null` when both parts are empty or any field is invalid, so
 * the caller can disable submit instead of writing `NaN`/`0` to
 * Firestore. Either part empty is treated as 0 — typing only minutes or
 * only seconds is a valid shortcut.
 */
function parseDurationFromParts(
  minutesInput: string,
  secondsInput: string
): number | null {
  const minTrim = minutesInput.trim();
  const secTrim = secondsInput.trim();
  if (minTrim === '' && secTrim === '') return null;

  const minutes = minTrim === '' ? 0 : Number(minTrim);
  const seconds = secTrim === '' ? 0 : Number(secTrim);
  // Reject fractional input (e.g. "1.9") so a paste-into-the-number-field
  // doesn't silently truncate to a shorter saved duration.
  if (!Number.isInteger(minutes) || !Number.isInteger(seconds)) return null;
  if (minutes < 0 || seconds < 0) return null;
  if (seconds > SECONDS_MAX) return null;

  return minutes * 60 + seconds;
}

/**
 * Split a stored total-seconds value into the two strings shown in the
 * minutes / seconds inputs. Empty strings when no initial value, so the
 * fields render blank in create mode.
 */
function splitDurationParts(totalSec: number | undefined): {
  minutes: string;
  seconds: string;
} {
  if (totalSec === undefined || !Number.isFinite(totalSec) || totalSec <= 0) {
    return { minutes: '', seconds: '' };
  }
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return { minutes: String(m), seconds: String(s) };
}

/**
 * Parse a user-typed km value back to integer metres. The dialog accepts
 * either decimal separator (locale-aware) and tolerates the grouping
 * separator that `formatNumber('1.2-2')` emits for 1000+ km values —
 * `.` / `,` for de/en, narrow no-break space (U+202F) or no-break space
 * (U+00A0) for fr / no.
 *
 * Strategy: strip all whitespace (covers the space-grouped locales),
 * then take the rightmost `.` or `,` as the decimal separator. The
 * integer part must be plain digits or a properly-grouped sequence
 * (`1.234`, `1,234,567`); typos like `1.2.3` or `1,2,3` are rejected
 * so they don't silently coerce to `12.3`.
 */
const KM_GROUPED_INT = /^\d{1,3}(?:[.,]\d{3})+$/;
const KM_DIGITS = /^\d+$/;

function parseKmToMeters(input: string): number | null {
  const trimmed = input.replace(/\s/g, '');
  if (!trimmed) return null;
  const decimalAt = Math.max(
    trimmed.lastIndexOf('.'),
    trimmed.lastIndexOf(',')
  );
  const intPart = decimalAt < 0 ? trimmed : trimmed.slice(0, decimalAt);
  const fracPart = decimalAt < 0 ? '' : trimmed.slice(decimalAt + 1);
  if (intPart === '' && fracPart === '') return null;
  if (
    intPart !== '' &&
    !KM_DIGITS.test(intPart) &&
    !KM_GROUPED_INT.test(intPart)
  ) {
    return null;
  }
  if (fracPart !== '' && !KM_DIGITS.test(fracPart)) return null;
  const normalized = `${intPart.replace(/[.,]/g, '') || '0'}.${fracPart || '0'}`;
  const km = Number(normalized);
  if (!Number.isFinite(km) || km <= 0) return null;
  return Math.round(km * 1000);
}

function formatKm(km: number, locale: string): string {
  return formatNumber(km, locale, '1.2-2');
}

function formatKmInput(distanceM: number, locale: string): string {
  if (!Number.isFinite(distanceM) || distanceM <= 0) return '';
  return formatKm(distanceM / 1000, locale);
}

/**
 * Infer the catalog category for a stale `exerciseId` whose catalog
 * entry has been renamed or removed. Catalog ids follow the dotted
 * convention `'<category>.<exercise>'`, so the prefix is enough to
 * recover the right dashboard mode without a registry lookup. Falls
 * back to the first non-pushup category that has at least one catalog
 * exercise so the dialog never opens in pushup mode for an
 * exercise-kind entry.
 */
function inferExerciseCategory(
  exerciseId: string | undefined
): ExerciseCategoryId {
  const prefix = exerciseId?.split('.')[0];
  // Legacy id prefixes from before the movement-pattern restructure
  // still appear in Firestore docs — map them onto the new categories.
  const LEGACY_PREFIX_MAP: Record<string, ExerciseCategoryId> = {
    abs: 'core',
    plank: 'core',
    legs: 'squat',
  };
  if (prefix && prefix in LEGACY_PREFIX_MAP) {
    return LEGACY_PREFIX_MAP[prefix];
  }
  const known = EXERCISE_CATEGORIES.find((c) => c.id === prefix);
  if (known && known.id !== 'pushup') return known.id;
  const byCategory = exercisesByCategory();
  const fallback = EXERCISE_CATEGORIES.find(
    (c) => c.id !== 'pushup' && (byCategory.get(c.id)?.length ?? 0) > 0
  );
  return fallback?.id ?? 'core';
}

/**
 * Build a permissive `ExerciseDefinition` for a stale catalog id so
 * the edit dialog can still render an entry whose original definition
 * has been renamed or removed. Picks the measurement off the existing
 * payload (durationSec → time, distanceM+durationSec → distance-time,
 * else reps) and uses {@link COMPANION_BOUNDS} for the cap so the
 * over-cap hint and submit gate keep working.
 */
function syntheticDefinitionFor(
  data: ExerciseEntryDialogData,
  categoryId: ExerciseCategoryId
): ExerciseDefinition {
  const measurement: MeasurementType =
    data.distanceM !== undefined && data.durationSec !== undefined
      ? 'distance-time'
      : data.durationSec !== undefined
        ? 'time'
        : 'reps';
  const bounds =
    measurement === 'reps'
      ? COMPANION_BOUNDS.reps
      : measurement === 'time'
        ? COMPANION_BOUNDS.durationSec
        : COMPANION_BOUNDS.distanceM;
  const unit =
    measurement === 'reps' ? 'reps' : measurement === 'time' ? 's' : 'm';
  return {
    id: data.exerciseId,
    categoryId,
    measurement,
    min: bounds.min,
    max: bounds.max,
    unit,
  };
}
