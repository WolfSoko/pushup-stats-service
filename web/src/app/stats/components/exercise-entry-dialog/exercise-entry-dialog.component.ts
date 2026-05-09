import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { appendLocalOffset } from '@pu-stats/models';

export interface ExerciseEntryDialogData {
  /** Catalog id, e.g. `'abs.situps'` or `'legs.squats'`. */
  exerciseId: string;
  /** Localized exercise name shown in the dialog title. */
  exerciseName: string;
  /**
   * Optional pre-fill for edit mode. When omitted, the dialog opens in
   * create mode with an empty set + the current local time. When set,
   * the form binds to the entry's timestamp/reps/sets so a user can
   * adjust an existing record without re-typing it from scratch.
   */
  initial?: {
    timestamp: string;
    reps: number;
    sets?: number[];
  };
}

export interface ExerciseEntryDialogResult {
  exerciseId: string;
  timestamp: string;
  reps: number;
  sets: number[];
}

/**
 * Lightweight entry dialog for the Phase-0 multi-exercise flow.
 *
 * Deliberately NOT extending {@link CreateEntryDialogComponent} because
 * that one is wired up to the pushup-only catalog (autocomplete, wiki
 * deep-link, legacy-id resolution). Reusing it here would force every
 * non-pushup entry through the pushup type picker; building a separate,
 * minimal dialog keeps the existing flow untouched.
 */
@Component({
  selector: 'app-exercise-entry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
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
      <span i18n="@@exerciseEntryDialog.title">Eintrag hinzufügen</span>
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
              min="0"
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
export class ExerciseEntryDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<ExerciseEntryDialogComponent>
  );
  readonly data = inject<ExerciseEntryDialogData>(MAT_DIALOG_DATA);

  // Edit-mode pre-fill: the parent passes the original ISO timestamp;
  // the datetime-local input binds to the first 16 chars (no seconds,
  // no offset). The original is held in `originalTimestamp` so submit
  // can preserve it byte-for-byte when the user didn't touch the field.
  private readonly originalTimestamp = this.data.initial?.timestamp ?? null;

  readonly timestamp = signal(
    this.data.initial
      ? this.data.initial.timestamp.slice(0, 16)
      : this.defaultDateTimeLocal()
  );
  readonly sets = signal<number[]>(this.computeInitialSets());
  readonly hasMultipleSets = computed(() => this.sets().length > 1);
  readonly totalReps = computed(() =>
    this.sets().reduce((sum, s) => sum + (s > 0 ? s : 0), 0)
  );
  readonly canSubmit = computed(
    () => this.timestamp().length > 0 && this.totalReps() > 0
  );

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
    // Clamp to a non-negative integer up front. The downstream
    // `validateExerciseEntry` rejects fractional reps as
    // `measurement-value-not-integer`; flooring here keeps the UI in
    // sync with that contract instead of letting `canSubmit()` go true
    // on `5.5` reps and then failing at submit time.
    const parsed = Number(value);
    const num = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    this.sets.update((s) => s.map((v, i) => (i === index ? num : v)));
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  submit(): void {
    const validSets = this.sets().filter((s) => s > 0);
    const reps = validSets.reduce((sum, s) => sum + s, 0);
    if (!this.timestamp() || reps <= 0) return;
    // Preserve the original ISO timestamp when the user didn't touch
    // the field in edit mode. Without this, an unedited save would
    // silently rewrite the offset and drop seconds.
    const defaultLocal = this.originalTimestamp?.slice(0, 16) ?? '';
    const timestamp =
      this.originalTimestamp && this.timestamp() === defaultLocal
        ? this.originalTimestamp
        : appendLocalOffset(this.timestamp());
    const result: ExerciseEntryDialogResult = {
      exerciseId: this.data.exerciseId,
      timestamp,
      reps,
      sets: validSets,
    };
    this.dialogRef.close(result);
  }

  private computeInitialSets(): number[] {
    const initial = this.data.initial;
    if (initial?.sets?.length) return [...initial.sets];
    if (initial && initial.reps > 0) return [initial.reps];
    return [0];
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
      now.getDate()
    )}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}
