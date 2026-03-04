import { Component, input, OnChanges, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { parseIsoDate } from '../../../util/date/parse-iso-date';
import { RangeModes } from '../../../util/date/range-modes.type';
import { toLocalIsoDate } from '../../../util/date/to-local-iso-date';

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
        </mat-button-toggle-group>

        <div class="step-actions">
          <button
            type="button"
            mat-stroked-button
            (click)="shiftRange(-1)"
            i18n="@@rangeBack"
          >
            <mat-icon>chevron_left</mat-icon>
            Zurück
          </button>
          <button
            type="button"
            mat-stroked-button
            (click)="jumpToToday()"
            i18n="@@rangeToday"
          >
            Heute
          </button>
          <button
            type="button"
            mat-stroked-button
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

  private didInitializeMode = false;

  readonly fromChange = output<string>();
  readonly toChange = output<string>();
  readonly modeChange = output<RangeModes>();

  readonly mode = signal<RangeModes>('week');

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

    // Infer once from external initial inputs (URL/bootstrap). After that,
    // mode is user-driven and should not flip while from/to propagate.
    if (!this.didInitializeMode) {
      const inferred = this.inferMode(start, end);
      this.mode.set(inferred);
      this.didInitializeMode = true;
    }
  }

  setMode(value: RangeModes): void {
    if (!value) return;

    const previousStart = this.range.controls.start.value;
    const previousEnd = this.range.controls.end.value;
    const today = this.startOfDay(new Date());

    this.mode.set(value);
    this.modeChange.emit(value);

    let anchor: Date | undefined;
    if (
      (value === 'day' || value === 'week') &&
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

    return 'week';
  }

  shiftRange(direction: -1 | 1): void {
    const start = this.range.controls.start.value;
    const end = this.range.controls.end.value;
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
    } else {
      nextStart.setMonth(nextStart.getMonth() + direction);
      nextEnd.setMonth(nextEnd.getMonth() + direction);
      nextEnd.setDate(
        new Date(nextEnd.getFullYear(), nextEnd.getMonth() + 1, 0).getDate()
      );
    }

    this.range.patchValue({ start: nextStart, end: nextEnd });
  }

  private applyModeRange(anchorDate?: Date): void {
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
