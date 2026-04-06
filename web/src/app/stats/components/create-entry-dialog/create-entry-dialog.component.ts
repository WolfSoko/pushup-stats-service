import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { appendLocalOffset } from '@pu-stats/models';

export interface CreateEntryResult {
  timestamp: string;
  reps: number;
  sets: number[];
  source: string;
  type: string;
}

@Component({
  selector: 'app-create-entry-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
    MatAutocompleteModule,
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
    `,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@createDialogTitle">Neuen Eintrag anlegen</h2>

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
              min="1"
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

      <mat-form-field appearance="outline">
        <mat-label i18n="@@typeLabel">Typ</mat-label>
        <input
          type="text"
          matInput
          [formControl]="typeControl"
          [matAutocomplete]="typeAuto"
          placeholder="Pick one / Custom"
          i18n-placeholder="@@typePlaceholder"
        />
        <mat-autocomplete #typeAuto="matAutocomplete">
          @for (option of filteredTypeOptions$ | async; track option) {
            <mat-option [value]="option">{{ option }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label i18n="@@sourceLabel">Quelle</mat-label>
        <input
          type="text"
          matInput
          [formControl]="sourceControl"
          [matAutocomplete]="sourceAuto"
          placeholder="web / whatsapp / Custom"
          i18n-placeholder="@@sourcePlaceholder"
        />
        <mat-autocomplete #sourceAuto="matAutocomplete">
          @for (option of filteredSourceOptions$ | async; track option) {
            <mat-option [value]="option">{{ option }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button type="button" mat-button mat-dialog-close i18n="@@cancel">
        Abbrechen
      </button>
      <button
        type="button"
        mat-flat-button
        (click)="submit()"
        i18n="@@saveEntry"
      >
        Speichern
      </button>
    </mat-dialog-actions>
  `,
})
export class CreateEntryDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<CreateEntryDialogComponent>);

  readonly timestamp = signal(this.defaultDateTimeLocal());
  readonly sets = signal<number[]>([0]);
  readonly hasMultipleSets = computed(() => this.sets().length > 1);
  readonly totalReps = computed(() =>
    this.sets().reduce((sum, s) => sum + (s > 0 ? s : 0), 0)
  );
  readonly typeControl = new FormControl<string>('Standard', {
    nonNullable: true,
  });
  readonly sourceControl = new FormControl<string>('web', {
    nonNullable: true,
  });

  private readonly typeOptions = [
    'Standard',
    'Diamond',
    'Wide',
    'Archer',
    'Decline',
    'Incline',
    'Pike',
    'Knuckle',
  ];
  private readonly sourceOptions = ['web', 'whatsapp'];

  readonly filteredTypeOptions$ = this.typeControl.valueChanges.pipe(
    startWith(this.typeControl.value),
    map((value) => this.filterOptions(value, this.typeOptions))
  );

  readonly filteredSourceOptions$ = this.sourceControl.valueChanges.pipe(
    startWith(this.sourceControl.value),
    map((value) => this.filterOptions(value, this.sourceOptions))
  );

  addSet(): void {
    const currentSets = this.sets();
    const lastValue = currentSets[currentSets.length - 1] ?? 0;
    const prefill = lastValue > 0 ? lastValue : 0;
    this.sets.update((s) => [...s, prefill]);
  }

  removeSet(index: number): void {
    this.sets.update((s) => {
      const next = s.filter((_, i) => i !== index);
      return next.length === 0 ? [0] : next;
    });
  }

  updateSet(index: number, value: string): void {
    const num = Number(value) || 0;
    this.sets.update((s) => s.map((v, i) => (i === index ? num : v)));
  }

  submit(): void {
    const validSets = this.sets().filter((s) => s > 0);
    const reps = validSets.reduce((sum, s) => sum + s, 0);
    if (!this.timestamp() || reps <= 0) return;

    const type = (this.typeControl.value || '').trim() || 'Standard';
    const source = this.normalizeSource(
      (this.sourceControl.value || '').trim() || 'web'
    );

    this.dialogRef.close({
      timestamp: appendLocalOffset(this.timestamp()),
      reps,
      sets: validSets,
      source,
      type,
    });
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private defaultDateTimeLocal(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }

  private normalizeSource(value: string): string {
    const v = (value || '').trim();
    if (!v) return 'web';
    if (v === 'wa') return 'whatsapp';
    return v;
  }

  private filterOptions(
    value: string | null | undefined,
    options: string[]
  ): string[] {
    const needle = (value ?? '').toLowerCase().trim();
    if (!needle) return options;
    if (options.some((opt) => opt.toLowerCase() === needle)) return options;
    return options.filter((opt) => opt.toLowerCase().includes(needle));
  }
}
