import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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
import {
  appendLocalOffset,
  ExerciseDefinition,
  MeasurementType,
} from '@pu-stats/models';

export interface EntryDialogData {
  /** Catalog definition the dialog parameters its form against. */
  definition: ExerciseDefinition;
  /** Localized name shown in the dialog title. Built by the caller
   *  because `$localize` keys live in the consuming components today;
   *  Track-ARCH will move them into a shared service. */
  exerciseName: string;
  /** Optional pre-fill for edit mode. The dialog only reads fields
   *  matching `definition.measurement` — reps + sets for reps-measured
   *  exercises, durationSec for time-measured ones. */
  initial?: {
    timestamp: string;
    reps: number;
    sets?: number[];
    durationSec?: number;
    variantId?: string;
  };
}

export interface EntryDialogResult {
  exerciseId: string;
  /** Discriminator the caller switches on when shaping the create /
   *  update payload — saves a second `findExerciseDefinition` lookup
   *  on the consumer side. */
  measurement: MeasurementType;
  /**
   * Variant id, if the user picked one. Tri-state semantics so callers
   * can distinguish "no change" from "explicitly clear":
   *   - `string` (non-empty): set or keep this variant.
   *   - `null`: user cleared a previously-set variant — callers should
   *     translate this to a Firestore `deleteField()` on update.
   *   - `undefined`: user never engaged with the picker (no change in
   *     edit mode, no variant in create mode).
   */
  variantId?: string | null;
  timestamp: string;
  /** Populated for `'reps'` and `'weight'` measurement; `0` otherwise. */
  reps: number;
  /** Populated for `'reps'` and `'weight'` measurement; `[]` otherwise. */
  sets: number[];
  /** Populated for `'time'` measurement; `undefined` otherwise. */
  durationSec?: number;
}

/**
 * Generic entry dialog parameterized by an `ExerciseDefinition`. Drives
 * its form fields off the catalog definition so any new exercise drops
 * in without component-level changes.
 *
 * Two measurement paths are wired:
 *   - `'reps'` — reps + sets list, sums into the entry total.
 *   - `'time'` — single mm:ss duration input.
 *
 * `'weight'` and `'distance'` measurements still need their own
 * companion fields (weightKg / distanceM + optional pace) — the form
 * branches off `def.measurement` so adding them is additive.
 *
 * Caps come from `def.min` / `def.max` so the input clamps and
 * `canSubmit()` locks at the ceiling — closes the "validator rejects
 * after canSubmit() said yes" gap that the pushup-only
 * `CreateEntryDialogComponent` had.
 */
@Component({
  selector: 'app-entry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  styles: [
    `
      mat-dialog-content {
        display: grid;
        gap: 10px;
      }
      .set-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .set-row mat-form-field {
        flex: 1;
      }
      .total-reps {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant);
        text-align: end;
      }
    `,
  ],
  template: `
    <h2 mat-dialog-title>
      @if (data.initial) {
        <span i18n="@@editDialogTitle">Eintrag bearbeiten</span>
      } @else {
        <span i18n="@@exerciseEntryDialog.title">Eintrag hinzufügen</span>
      }
      — {{ data.exerciseName }}
    </h2>

    <mat-dialog-content>
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

      @if (showVariantPicker()) {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@entryDialog.variant">Variante</mat-label>
          <mat-select [formControl]="variantControl">
            <mat-option [value]="''" i18n="@@entryDialog.variantNone"
              >—</mat-option
            >
            @for (variant of data.definition.variants; track variant.id) {
              <mat-option [value]="variant.id">{{
                variantLabel(variant.id)
              }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      }

      @if (isTimeMeasurement()) {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@entryDialog.duration">Dauer (mm:ss)</mat-label>
          <input
            matInput
            type="text"
            inputmode="numeric"
            placeholder="01:30"
            pattern="^[0-9]+:[0-5][0-9]$"
            [value]="durationInput()"
            (input)="durationInput.set(asValue($event))"
            required
          />
        </mat-form-field>
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
                [max]="data.definition.max"
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
          @if (isTimeMeasurement()) {
            <span i18n="@@entryDialog.overCapTime"
              >Maximum: {{ formattedMax() }}</span
            >
          } @else {
            <span i18n="@@entryDialog.overCap"
              >Maximum: {{ data.definition.max }} pro Eintrag</span
            >
          }
        </div>
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
      >
        Speichern
      </button>
    </mat-dialog-actions>
  `,
})
export class EntryDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<EntryDialogComponent>);
  readonly data = inject<EntryDialogData>(MAT_DIALOG_DATA);

  private readonly originalTimestamp = this.data.initial?.timestamp ?? null;

  readonly timestamp = signal(
    this.data.initial
      ? this.data.initial.timestamp.slice(0, 16)
      : this.defaultDateTimeLocal()
  );

  readonly isTimeMeasurement = computed(
    () => this.data.definition.measurement === 'time'
  );

  readonly sets = signal<number[]>(
    this.data.initial?.sets?.length
      ? [...this.data.initial.sets]
      : this.data.initial && this.data.initial.reps > 0
        ? [this.data.initial.reps]
        : [0]
  );

  /**
   * Free-text mm:ss input for time-measurement exercises (plank).
   * Pre-filled from `initial.durationSec` in edit mode.
   */
  readonly durationInput = signal(
    this.data.initial?.durationSec !== undefined
      ? formatSecondsAsMmSs(this.data.initial.durationSec)
      : ''
  );

  readonly durationSec = computed(() =>
    parseDurationToSeconds(this.durationInput())
  );

  readonly variantControl = new FormControl<string>(
    this.data.initial?.variantId ?? '',
    { nonNullable: true }
  );

  readonly hasMultipleSets = computed(() => this.sets().length > 1);

  readonly totalReps = computed(() =>
    this.sets().reduce((sum, s) => sum + (s > 0 ? s : 0), 0)
  );

  /** Localized form of `def.max` for the over-cap hint when the
   *  measurement is `'time'` — surfaces "5:00" instead of "300". */
  readonly formattedMax = computed(() =>
    formatSecondsAsMmSs(this.data.definition.max)
  );

  readonly overCap = computed(() =>
    this.isTimeMeasurement()
      ? this.durationSec() !== null &&
        this.durationSec()! > this.data.definition.max
      : this.totalReps() > this.data.definition.max
  );

  readonly canSubmit = computed(() => {
    if (this.timestamp().length === 0) return false;
    if (this.isTimeMeasurement()) {
      const sec = this.durationSec();
      return (
        sec !== null && sec >= this.data.definition.min && !this.overCap()
      );
    }
    return (
      this.totalReps() >= this.data.definition.min && !this.overCap()
    );
  });

  readonly showVariantPicker = computed(
    () => (this.data.definition.variants?.length ?? 0) > 0
  );

  variantLabel(variantId: string): string {
    return VARIANT_LABELS[variantId] ?? variantId;
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
    // Cap to the definition's max so a single mistyped value can't push
    // the entry above the validator's range and produce a silent reject
    // on submit.
    const clamped = Math.min(finite, this.data.definition.max);
    this.sets.update((s) => s.map((v, i) => (i === index ? clamped : v)));
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  submit(): void {
    if (!this.canSubmit()) return;

    // Preserve the original ISO timestamp when the user didn't touch
    // the field in edit mode, mirroring CreateEntryDialogComponent's
    // behaviour so we don't silently drop seconds or rewrite the
    // offset.
    const defaultLocal = this.originalTimestamp?.slice(0, 16) ?? '';
    const timestamp =
      this.originalTimestamp && this.timestamp() === defaultLocal
        ? this.originalTimestamp
        : appendLocalOffset(this.timestamp());

    // Variant tri-state: emit a non-empty string to set/keep, `null` to
    // clear an existing variant in edit mode (so callers know to issue
    // a Firestore `deleteField()` rather than skip the field), and
    // `undefined` when the user never engaged with the picker.
    const variantId = this.variantControl.value.trim();
    const initialVariantId = this.data.initial?.variantId ?? '';
    // Tri-state with no-change preservation: emit variantId only if it
    // actually changed, otherwise omit so the update doesn't race
    // against concurrent variant edits with stale data.
    const variantPatch: { variantId?: string | null } =
      variantId === initialVariantId
        ? {}
        : variantId
          ? { variantId }
          : initialVariantId
            ? { variantId: null }
            : {};

    const measurement = this.data.definition.measurement;

    if (measurement === 'time') {
      const sec = this.durationSec();
      if (sec === null || sec <= 0) return;
      const result: EntryDialogResult = {
        exerciseId: this.data.definition.id,
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

    const validSets = this.sets().filter((s) => s > 0);
    const reps = validSets.reduce((sum, s) => sum + s, 0);
    if (reps <= 0) return;

    const result: EntryDialogResult = {
      exerciseId: this.data.definition.id,
      measurement,
      ...variantPatch,
      timestamp,
      reps,
      sets: validSets,
    };
    this.dialogRef.close(result);
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}

const VARIANT_LABELS: Record<string, string> = {};

/**
 * Parse mm:ss (or m:ss / hh:mm:ss with the leading "h" parsed as
 * minutes — single colon is the contract for plank's typical hold
 * range) into integer seconds. Returns null for malformed input so the
 * caller can disable submit instead of writing NaN to Firestore.
 */
function parseDurationToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = /^(\d+):([0-5]\d)$/.exec(trimmed);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
  return minutes * 60 + seconds;
}

/**
 * Inverse of {@link parseDurationToSeconds}: formats seconds back into
 * the `mm:ss` string the input field expects. Pads seconds to two
 * digits; minutes are not padded so a 30-second hold renders as
 * `0:30` and a 12-minute one as `12:00`.
 */
function formatSecondsAsMmSs(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return '0:00';
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
