import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  appendLocalOffset,
  findPushupTypeByEntryLabel,
  findPushupTypeByLocalizedName,
  localizePushupType,
  PUSHUP_TYPES,
  PushupTypeInfo,
} from '@pu-stats/models';

export interface EntryDialogData {
  timestamp: string;
  reps: number;
  sets?: number[];
  source?: string;
  type?: string;
}

export interface CreateEntryResult {
  timestamp: string;
  reps: number;
  sets: number[];
  source: string;
  type: string;
}

interface TypeOption {
  /** Canonical English `entryLabel` persisted to Firestore. */
  value: string;
  /** Locale-aware display name shown in the autocomplete. */
  label: string;
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
    `,
  ],
  template: `
    <h2 mat-dialog-title>
      @if (isEditMode) {
        <span i18n="@@editDialogTitle">Eintrag bearbeiten</span>
      } @else {
        <span i18n="@@createDialogTitle">Neuen Eintrag anlegen</span>
      }
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

      <div class="type-row">
        <mat-form-field appearance="outline">
          <mat-label i18n="@@typeLabel">Typ</mat-label>
          <input
            type="text"
            matInput
            [formControl]="typeControl"
            [matAutocomplete]="typeAuto"
            placeholder="Auswählen oder eintippen"
            i18n-placeholder="@@typePlaceholder"
          />
          <mat-autocomplete
            #typeAuto="matAutocomplete"
            [displayWith]="displayType"
          >
            @for (option of filteredTypeOptions$ | async; track option.value) {
              <mat-option
                [value]="option.value"
                [matTooltip]="tooltipFor(option.value)"
                matTooltipPosition="right"
                >{{ option.label }}</mat-option
              >
            }
          </mat-autocomplete>
        </mat-form-field>
        <a
          mat-icon-button
          class="type-help"
          [routerLink]="['/wiki/liegestuetz-typen']"
          [queryParams]="wikiQueryParams()"
          [matTooltip]="wikiTooltip()"
          matTooltipPosition="left"
          mat-dialog-close
          i18n-aria-label="@@typeWikiLinkAria"
          aria-label="Anleitung zum Liegestütztyp öffnen"
        >
          <mat-icon>help_outline</mat-icon>
        </a>
      </div>

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
  private readonly data = inject<EntryDialogData | null>(MAT_DIALOG_DATA, {
    optional: true,
  });
  private readonly locale = inject(LOCALE_ID) as string;

  readonly isEditMode = !!this.data;
  private readonly originalTimestamp = this.data?.timestamp ?? null;
  readonly timestamp = signal(
    this.data ? this.data.timestamp.slice(0, 16) : this.defaultDateTimeLocal()
  );
  readonly sets = signal<number[]>(
    this.data?.sets?.length
      ? [...this.data.sets]
      : this.data
        ? [this.data.reps]
        : [0]
  );
  readonly hasMultipleSets = computed(() => this.sets().length > 1);
  readonly totalReps = computed(() =>
    this.sets().reduce((sum, s) => sum + (s > 0 ? s : 0), 0)
  );
  readonly typeControl = new FormControl<string>(
    this.data?.type || 'Standard',
    { nonNullable: true }
  );
  readonly sourceControl = new FormControl<string>(
    this.normalizeSource(this.data?.source || 'web'),
    { nonNullable: true }
  );

  // Single source of truth: derive the dropdown options from the
  // wiki catalog so adding a new variation in
  // `pushup-type.models.ts` automatically surfaces it here. The
  // dropdown shows the localized `label` (e.g. "Diamant-Liegestütze")
  // while `value` keeps the canonical English `entryLabel` that gets
  // persisted to Firestore — see `submit()`.
  private readonly typeOptions: ReadonlyArray<TypeOption> = PUSHUP_TYPES.map(
    (t) => ({
      value: t.entryLabel,
      label: localizePushupType(t, this.locale).name,
    })
  );
  private readonly sourceOptions = ['web', 'whatsapp'];

  readonly filteredTypeOptions$ = this.typeControl.valueChanges.pipe(
    startWith(this.typeControl.value),
    map((value) => this.filterTypeOptions(value))
  );

  readonly filteredSourceOptions$ = this.sourceControl.valueChanges.pipe(
    startWith(this.sourceControl.value),
    map((value) => this.filterOptions(value, this.sourceOptions))
  );

  readonly displayType = (value: string | null | undefined): string => {
    if (!value) return '';
    const match = findPushupTypeByEntryLabel(value);
    return match ? localizePushupType(match, this.locale).name : value;
  };

  // Track the live type-control value so the wiki deep-link updates as
  // the user types, without needing manual change detection.
  private readonly typeValue = toSignal(
    this.typeControl.valueChanges.pipe(startWith(this.typeControl.value)),
    { initialValue: this.typeControl.value }
  );

  readonly wikiQueryParams = computed(() => {
    const match = this.resolveType(this.typeValue());
    return match ? { type: match.slug } : {};
  });

  readonly wikiTooltip = computed(() => {
    const match = this.resolveType(this.typeValue());
    if (!match) {
      return $localize`:@@typeWikiLinkTooltip.generic:Anleitung zu Liegestütztypen öffnen`;
    }
    // Build the specific tooltip from a static template + the localized
    // type name. The name is locale-dependent so we read it via
    // `localizePushupType` rather than the canonical `entryLabel`, which
    // is always English and would feel out of place in a translated UI.
    const template = $localize`:@@typeWikiLinkTooltip.specific:Anleitung öffnen`;
    return `${template}: ${localizePushupType(match, this.locale).name}`;
  });

  tooltipFor(label: string): string {
    const type = this.resolveType(label);
    return type ? localizePushupType(type, this.locale).summary : '';
  }

  private resolveType(value: string | null | undefined): PushupTypeInfo | null {
    return findPushupTypeByLocalizedName(value, this.locale);
  }

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
    const num = Math.max(0, Number(value) || 0);
    this.sets.update((s) => s.map((v, i) => (i === index ? num : v)));
  }

  submit(): void {
    const validSets = this.sets().filter((s) => s > 0);
    const reps = validSets.reduce((sum, s) => sum + s, 0);
    if (!this.timestamp() || reps <= 0) return;

    const rawType = (this.typeControl.value || '').trim() || 'Standard';
    // Keep Firestore on canonical English entryLabels — when the user
    // selected a localized option (or typed one verbatim) we map it back
    // to the catalog. Custom typed values pass through unchanged.
    const matchedType = this.resolveType(rawType);
    const type = matchedType ? matchedType.entryLabel : rawType;
    const source = this.normalizeSource(
      (this.sourceControl.value || '').trim() || 'web'
    );

    // Preserve original timestamp when unchanged in edit mode to avoid
    // silently altering timezone/seconds format.
    const defaultLocal = this.originalTimestamp?.slice(0, 16) ?? '';
    const timestamp =
      this.originalTimestamp && this.timestamp() === defaultLocal
        ? this.originalTimestamp
        : appendLocalOffset(this.timestamp());

    this.dialogRef.close({
      timestamp,
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
    options: ReadonlyArray<string>
  ): string[] {
    const needle = (value ?? '').toLowerCase().trim();
    if (!needle) return [...options];
    if (options.some((opt) => opt.toLowerCase() === needle))
      return [...options];
    return options.filter((opt) => opt.toLowerCase().includes(needle));
  }

  private filterTypeOptions(value: string | null | undefined): TypeOption[] {
    const needle = (value ?? '').toLowerCase().trim();
    if (!needle) return [...this.typeOptions];
    // The form control holds the canonical entryLabel after a selection;
    // an exact match on either side means "user already picked one", so
    // keep the full list visible instead of filtering down to one row.
    const exact = this.typeOptions.some(
      (opt) =>
        opt.value.toLowerCase() === needle || opt.label.toLowerCase() === needle
    );
    if (exact) return [...this.typeOptions];
    return this.typeOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(needle) ||
        opt.value.toLowerCase().includes(needle)
    );
  }
}
