import {
  Component,
  input,
  linkedSignal,
  OnChanges,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { parseIsoDate, RangeModes, toLocalIsoDate } from '@pu-stats/models';

@Component({
  selector: 'app-filter-bar',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatIconModule,
    ReactiveFormsModule,
  ],
  template: `
    <section class="controls">
      <div class="heading">
        <h2 i18n="@@selectRangeTitle">Zeitraum auswählen</h2>
      </div>

      <section
        class="quick-range"
        aria-label="Schnellwahl Zeitraum"
        i18n-aria-label="@@quickRangeAria"
      >
        <mat-button-toggle-group
          [value]="mode()"
          (valueChange)="setMode($event)"
        >
          <mat-button-toggle value="day" i18n="@@rangeModeDay"
            >Tag</mat-button-toggle
          >
          <mat-button-toggle value="week" i18n="@@rangeModeWeek"
            >Woche</mat-button-toggle
          >
          <mat-button-toggle value="month" i18n="@@rangeModeMonth"
            >Monat</mat-button-toggle
          >
          <mat-button-toggle value="year" i18n="@@rangeModeYear"
            >Jahr</mat-button-toggle
          >
        </mat-button-toggle-group>

        <div class="step-actions">
          <button
            type="button"
            mat-stroked-button
            [disabled]="mode() === 'custom'"
            (click)="shiftRange(-1)"
            i18n="@@rangeBack"
          >
            <mat-icon>chevron_left</mat-icon>
            Zurück
          </button>
          <button
            type="button"
            mat-stroked-button
            [disabled]="mode() === 'custom'"
            (click)="jumpToToday()"
            i18n="@@rangeToday"
          >
            Heute
          </button>
          <button
            type="button"
            mat-stroked-button
            [disabled]="mode() === 'custom'"
            (click)="shiftRange(1)"
            i18n="@@rangeForward"
          >
            Vor
            <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
      </section>

      <mat-form-field appearance="outline">
        <mat-label i18n="@@rangeLabel">Zeitraum</mat-label>
        <mat-date-range-input [formGroup]="range" [rangePicker]="picker">
          <input
            matStartDate
            formControlName="start"
            placeholder="Von"
            i18n-placeholder="@@rangeFrom"
          />
          <input
            matEndDate
            formControlName="end"
            placeholder="Bis"
            i18n-placeholder="@@rangeTo"
          />
        </mat-date-range-input>
        <mat-datepicker-toggle
          matIconSuffix
          [for]="picker"
        ></mat-datepicker-toggle>
        <mat-date-range-picker #picker></mat-date-range-picker>
      </mat-form-field>
    </section>
  `,
  styleUrl: './filter-bar.component.scss',
})
export class FilterBarComponent implements OnChanges {
  readonly from = input('');
  readonly to = input('');

  private readonly hasUserModeOverride = signal(false);
  private readonly inferredModeSource = signal<RangeModes>('week');

  readonly fromChange = output<string>();
  readonly toChange = output<string>();
  readonly modeChange = output<RangeModes>();

  readonly mode = linkedSignal<RangeModes, RangeModes>({
    source: () => this.inferredModeSource(),
    computation: (inferred, previous) => {
      if (!this.hasUserModeOverride()) return inferred;
      return previous?.value ?? inferred;
    },
  });

  readonly range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  constructor() {
    this.range.controls.start.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.fromChange.emit(this.toIsoDate(value));
      });

    this.range.controls.end.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => {
        this.toChange.emit(this.toIsoDate(value));
      });

    // Re-infer mode whenever the range changes so the toggle highlight stays
    // in sync with the actual selection. If the user edits the picker to a
    // range that doesn't fit the current mode, no toggle is highlighted
    // (inferred mode is 'custom', for which there is no toggle button).
    this.range.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      const inferred = this.inferMode(
        this.range.controls.start.value,
        this.range.controls.end.value
      );
      if (inferred === this.mode()) return;
      this.hasUserModeOverride.set(false);
      this.inferredModeSource.set(inferred);
    });
  }

  ngOnChanges(): void {
    const start = parseIsoDate(this.from());
    const end = parseIsoDate(this.to());

    this.range.patchValue(
      {
        start,
        end,
      },
      { emitEvent: false }
    );

    // Update inferred mode source when inputs change (only if user hasn't overridden)
    if (!this.hasUserModeOverride()) {
      const inferred = this.inferMode(start, end);
      this.inferredModeSource.set(inferred);
    }
  }

  setMode(value: RangeModes): void {
    if (!value) return;

    this.hasUserModeOverride.set(true);
    this.mode.set(value);
    this.modeChange.emit(value);

    const previousStart = this.range.controls.start.value;
    const previousEnd = this.range.controls.end.value;
    const today = this.startOfDay(new Date());

    let anchor: Date | undefined;
    if (
      previousStart &&
      previousEnd &&
      today.getTime() >= this.startOfDay(previousStart).getTime() &&
      today.getTime() <= this.startOfDay(previousEnd).getTime()
    ) {
      // If today is inside current selection, use it as anchor.
      anchor = today;
    } else if (previousStart) {
      // Otherwise use the first day of current selection (never the end day).
      anchor = this.startOfDay(previousStart);
    }

    this.applyModeRange(anchor);
  }

  jumpToToday(): void {
    if (this.mode() === 'custom') return;
    this.applyModeRange(new Date());
  }

  private inferMode(start: Date | null, end: Date | null): RangeModes {
    if (!start || !end) return 'week';
    const s = this.startOfDay(start);
    const e = this.startOfDay(end);
    if (s.getTime() === e.getTime()) return 'day';

    const diffDays = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
    if (diffDays === 7 && s.getDay() === 1) return 'week'; // Monday

    const isMonthStart = s.getDate() === 1;
    const lastDay = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
    const isMonthEnd =
      e.getFullYear() === s.getFullYear() &&
      e.getMonth() === s.getMonth() &&
      e.getDate() === lastDay;
    if (isMonthStart && isMonthEnd) return 'month';

    const isYearStart = s.getMonth() === 0 && s.getDate() === 1;
    const isYearEnd =
      e.getFullYear() === s.getFullYear() &&
      e.getMonth() === 11 &&
      e.getDate() === 31;
    if (isYearStart && isYearEnd) return 'year';

    return 'custom';
  }

  shiftRange(direction: -1 | 1): void {
    const start = this.range.controls.start.value;
    const end = this.range.controls.end.value;
    if (this.mode() === 'custom') return;
    if (!start || !end) {
      this.applyModeRange();
      return;
    }

    const nextStart = new Date(start);
    const nextEnd = new Date(end);

    if (this.mode() === 'day') {
      nextStart.setDate(nextStart.getDate() + direction);
      nextEnd.setDate(nextEnd.getDate() + direction);
    } else if (this.mode() === 'week') {
      nextStart.setDate(nextStart.getDate() + direction * 7);
      nextEnd.setDate(nextEnd.getDate() + direction * 7);
    } else if (this.mode() === 'year') {
      const year = start.getFullYear() + direction;
      nextStart.setFullYear(year, 0, 1);
      nextEnd.setFullYear(year, 11, 31);
    } else {
      // Always keep full month boundaries and avoid JS date overflow
      // (e.g. Jan 31 + 1 month becoming March).
      const anchor = new Date(
        start.getFullYear(),
        start.getMonth() + direction,
        1
      );
      nextStart.setFullYear(anchor.getFullYear(), anchor.getMonth(), 1);
      nextEnd.setFullYear(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    }

    this.range.patchValue({ start: nextStart, end: nextEnd });
  }

  private applyModeRange(anchorDate?: Date): void {
    if (this.mode() === 'custom') return;

    const anchor =
      anchorDate ??
      this.range.controls.end.value ??
      this.range.controls.start.value ??
      new Date();

    if (this.mode() === 'day') {
      const day = this.startOfDay(anchor);
      this.range.patchValue({ start: day, end: day });
      return;
    }

    if (this.mode() === 'week') {
      const start = this.startOfWeek(anchor);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      this.range.patchValue({ start, end });
      return;
    }

    if (this.mode() === 'year') {
      const start = new Date(anchor.getFullYear(), 0, 1);
      const end = new Date(anchor.getFullYear(), 11, 31);
      this.range.patchValue({ start, end });
      return;
    }

    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    this.range.patchValue({ start, end });
  }

  private startOfWeek(value: Date): Date {
    const d = this.startOfDay(value);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    return d;
  }

  private startOfDay(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private toIsoDate(value: Date | null): string {
    if (!value) return '';
    return toLocalIsoDate(value);
  }
}
