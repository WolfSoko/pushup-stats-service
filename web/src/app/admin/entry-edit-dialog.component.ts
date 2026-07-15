import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { appendLocalOffset } from '@pu-stats/date';
import {
  type ExerciseDefinition,
  type ExerciseEntry,
  findExerciseDefinition,
  measurementValueField,
  validateExerciseEntry,
} from '@pu-stats/models';
import {
  type AdminEntryEditForm,
  buildEntryPatch,
  companionField,
  entryExerciseName,
} from './user-entries.helpers';

/**
 * Admin edit dialog for a single exercise entry. Scope is intentionally
 * narrow — timestamp, the primary measurement value and (where the
 * measurement has one) the companion value. `exerciseId` is immutable
 * (a different exercise is a delete + create, see
 * {@link ExerciseFirestoreService.updateEntry}), so it is shown read-only.
 * Closes with the minimal change patch. When the exercise id no longer
 * resolves in the catalog only the timestamp stays editable (the value
 * fields are hidden), so the patch is timestamp-only in that case.
 */
@Component({
  selector: 'app-admin-entry-edit-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@admin.entry.edit.title">Eintrag bearbeiten</h2>
    <mat-dialog-content class="edit-content">
      <p class="exercise-name">{{ exerciseName }}</p>

      <mat-form-field appearance="outline">
        <mat-label i18n="@@admin.entry.edit.timestamp">Zeitpunkt</mat-label>
        <input
          matInput
          type="datetime-local"
          [value]="timestamp()"
          (input)="timestamp.set(asValue($event))"
        />
      </mat-form-field>

      @if (def) {
        <mat-form-field appearance="outline">
          <mat-label i18n="@@admin.entry.edit.value">Wert</mat-label>
          <input
            matInput
            type="number"
            [value]="value() ?? ''"
            (input)="value.set(asNumber($event))"
          />
          <span matTextSuffix>{{ def.unit }}</span>
        </mat-form-field>

        @if (companion) {
          <mat-form-field appearance="outline">
            <mat-label>{{ companionLabel }}</mat-label>
            <input
              matInput
              type="number"
              [value]="companionValue() ?? ''"
              (input)="companionValue.set(asNumber($event))"
            />
          </mat-form-field>
        }
      } @else {
        <p class="stale-hint" i18n="@@admin.entry.edit.staleExercise">
          Unbekannte Übung – nur der Zeitpunkt kann bearbeitet werden.
        </p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close i18n="@@admin.entry.edit.cancel">
        Abbrechen
      </button>
      <button
        mat-flat-button
        color="primary"
        [disabled]="!canSave()"
        (click)="save()"
        i18n="@@admin.entry.edit.save"
      >
        Speichern
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .edit-content {
      min-width: min(92vw, 360px);
      display: grid;
      gap: 4px;
      padding-top: 8px;
    }
    .exercise-name {
      font-weight: 600;
      margin: 0 0 8px;
    }
    mat-form-field {
      width: 100%;
    }
    .stale-hint {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.85em;
    }
  `,
})
export class AdminEntryEditDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<AdminEntryEditDialogComponent>>(MatDialogRef);
  readonly entry = inject<ExerciseEntry>(MAT_DIALOG_DATA);

  readonly def: ExerciseDefinition | null = findExerciseDefinition(
    this.entry.exerciseId
  );
  readonly exerciseName = entryExerciseName(this.entry);
  readonly companion = companionField(this.entry);
  readonly companionLabel =
    this.companion === 'durationSec'
      ? $localize`:@@admin.entry.edit.duration:Dauer (s)`
      : $localize`:@@admin.entry.edit.weight:Gewicht (kg)`;

  private readonly originalLocal = this.isoToLocalInput(this.entry.timestamp);
  readonly timestamp = signal(this.originalLocal);
  readonly value = signal<number | null>(this.initialPrimaryValue());
  readonly companionValue = signal<number | null>(
    this.companion ? (this.entry[this.companion] ?? null) : null
  );

  readonly canSave = computed(() => {
    if (this.timestamp().length === 0) return false;
    const patch = this.patch();
    return patch !== null;
  });

  private patch(): Record<string, unknown> | null {
    const built = buildEntryPatch(this.entry, this.formValue());
    if (!built) return null;
    if (this.def) {
      const violation = validateExerciseEntry(built, this.def, {
        partial: true,
      });
      if (violation) return null;
    }
    return built;
  }

  private formValue(): AdminEntryEditForm {
    return {
      timestamp: this.resolvedTimestamp(),
      value: this.value(),
      companion: this.companionValue(),
    };
  }

  private resolvedTimestamp(): string {
    return this.timestamp() === this.originalLocal
      ? this.entry.timestamp
      : appendLocalOffset(this.timestamp());
  }

  // Render a stored instant as a `YYYY-MM-DDTHH:mm` string in the *viewer's*
  // local timezone for the `datetime-local` input. Slicing the raw ISO
  // prefix would misread entries stored in UTC (`…Z`) or another user's
  // offset — an admin edits any user's entries, so their local tz may
  // differ from the entry's. `appendLocalOffset` converts back on save.
  private isoToLocalInput(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private initialPrimaryValue(): number | null {
    if (!this.def) return null;
    const field = measurementValueField(this.def.measurement);
    return (this.entry[field] as number | undefined) ?? null;
  }

  save(): void {
    const patch = this.patch();
    if (!patch) return;
    this.dialogRef.close(patch);
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  asNumber(event: Event): number | null {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '') return null;
    const num = Number(raw);
    return Number.isNaN(num) ? null : num;
  }
}
