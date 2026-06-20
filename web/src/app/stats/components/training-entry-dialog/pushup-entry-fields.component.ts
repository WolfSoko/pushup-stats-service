import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  LOCALE_ID,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { AsyncPipe } from '@angular/common';
import { map, startWith } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import {
  findPushupTypeByLocalizedName,
  findPushupTypeByStoredValue,
  localizePushupType,
  PUSHUP_TYPES,
  PushupTypeInfo,
} from '@pu-stats/models';
import {
  PushupTypeOption,
  TrainingEntryDialogData,
  PushupEntryDialogResult,
} from './training-entry-dialog.models';
import {
  appendListEntry,
  buildPushupResult,
  canSubmitPushup,
  clampListValue,
  filterPushupTypeOptions,
  filterStringOptions,
  normalizeSource,
  PUSHUP_REPS_MAX,
  pushupOverCap,
  removeListEntry,
} from './training-entry-dialog.submit';

/**
 * Pushup-mode fields: variant autocomplete + wiki link, reps/sets list,
 * over-cap hint, and the source autocomplete. Owns all pushup state; the
 * parent reads {@link canSubmit} and {@link buildResult}.
 */
@Component({
  selector: 'app-pushup-entry-fields',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AsyncPipe,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatAutocompleteModule,
    MatTooltipModule,
    RouterLink,
  ],
  styleUrl: './training-entry-dialog.component.scss',
  templateUrl: './pushup-entry-fields.component.html',
})
export class PushupEntryFieldsComponent {
  private readonly locale = inject(LOCALE_ID) as string;

  readonly data = input<TrainingEntryDialogData | null>(null);

  /**
   * Display name for the synthetic pushup row. The pushup picker itself
   * is never rendered (the parent shows the picker only in exercise
   * mode), but keeping this `$localize` reference alive pins the
   * `@@trainingEntryDialog.pushup.exercise` message so the extracted
   * XLIFF id set stays stable.
   */
  readonly exerciseLabel = $localize`:@@trainingEntryDialog.pushup.exercise:Liegestütze`;

  readonly repsMax = PUSHUP_REPS_MAX;

  readonly sets = signal<number[]>([0]);

  readonly hasMultipleSets = computed(() => this.sets().length > 1);

  readonly totalReps = computed(() =>
    this.sets().reduce((sum, s) => sum + (s > 0 ? s : 0), 0)
  );

  readonly overCap = computed(() => pushupOverCap(this.totalReps()));

  readonly pushupTypeControl = new FormControl<string>('standard', {
    nonNullable: true,
  });

  readonly sourceControl = new FormControl<string>('web', {
    nonNullable: true,
  });

  private readonly pushupTypeOptions: ReadonlyArray<PushupTypeOption> =
    PUSHUP_TYPES.map((t) => ({
      value: t.id,
      label: localizePushupType(t, this.locale).name,
    }));

  private readonly sourceOptions = ['web', 'whatsapp'];

  readonly filteredPushupTypeOptions$ =
    this.pushupTypeControl.valueChanges.pipe(
      startWith(this.pushupTypeControl.value),
      map((value) => filterPushupTypeOptions(value, this.pushupTypeOptions))
    );

  readonly filteredSourceOptions$ = this.sourceControl.valueChanges.pipe(
    startWith(this.sourceControl.value),
    map((value) => filterStringOptions(value, this.sourceOptions))
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

  // The parent re-gates on its own timestamp signal, so this only checks
  // the pushup-specific reps + cap predicate.
  readonly canSubmit = computed(() => canSubmitPushup(this.totalReps()));

  private seeded = false;

  constructor() {
    // Signal inputs are bound after construction, so seed from `data` in
    // an effect rather than field initializers (which would see `null`).
    effect(() => {
      const data = this.data();
      if (this.seeded) return;
      this.seeded = true;
      this.sets.set(this.initialSets(data));
      if (data?.kind === 'pushup') {
        this.pushupTypeControl.setValue(data.type || 'standard');
        this.sourceControl.setValue(normalizeSource(data.source || 'web'));
      }
    });
  }

  buildResult(timestamp: string): PushupEntryDialogResult | null {
    const rawType = (this.pushupTypeControl.value || '').trim() || 'standard';
    const matched = this.resolvePushupType(rawType);
    const type = matched ? matched.id : rawType;
    const source = normalizeSource(
      (this.sourceControl.value || '').trim() || 'web'
    );
    return buildPushupResult({
      timestamp,
      sets: this.sets(),
      type,
      source,
    });
  }

  addSet(): void {
    this.sets.update(appendListEntry);
  }

  removeSet(index: number): void {
    this.sets.update((s) => removeListEntry(s, index));
  }

  updateSet(index: number, value: string): void {
    const clamped = clampListValue(value, this.repsMax);
    this.sets.update((s) => s.map((v, i) => (i === index ? clamped : v)));
  }

  asValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private initialSets(data: TrainingEntryDialogData | null): number[] {
    if (!data) return [0];
    if (data.sets?.length) return [...data.sets];
    if (data.reps !== undefined && data.reps > 0) return [data.reps];
    return [0];
  }

  private resolvePushupType(
    value: string | null | undefined
  ): PushupTypeInfo | null {
    return findPushupTypeByLocalizedName(value, this.locale);
  }
}
