import { Component, OnChanges, input, output, signal } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

type RangeMode = 'day' | 'week' | 'month';

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
        <h2>Zeitraum auswählen</h2>
      </div>

      <section class="quick-range" aria-label="Schnellwahl Zeitraum">
        <mat-button-toggle-group [value]="mode()" (valueChange)="setMode($event)">
          <mat-button-toggle value="day">Tag</mat-button-toggle>
          <mat-button-toggle value="week">Woche</mat-button-toggle>
          <mat-button-toggle value="month">Monat</mat-button-toggle>
        </mat-button-toggle-group>

        <div class="step-actions">
          <button type="button" mat-stroked-button (click)="shiftRange(-1)">
            <mat-icon>chevron_left</mat-icon>
            Zurück
          </button>
          <button type="button" mat-stroked-button (click)="jumpToToday()">
            Heute
          </button>
          <button type="button" mat-stroked-button (click)="shiftRange(1)">
            Vor
            <mat-icon>chevron_right</mat-icon>
          </button>
        </div>
      </section>

      <mat-form-field appearance="outline">
        <mat-label>Zeitraum</mat-label>
        <mat-date-range-input [formGroup]="range" [rangePicker]="picker">
          <input matStartDate formControlName="start" placeholder="Von" />
          <input matEndDate formControlName="end" placeholder="Bis" />
        </mat-date-range-input>
        <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
        <mat-date-range-picker #picker></mat-date-range-picker>
      </mat-form-field>
    </section>
  `,
  styleUrl: './filter-bar.component.scss',
})
export class FilterBarComponent implements OnChanges {
  readonly from = input('');
  readonly to = input('');

  readonly fromChange = output<string>();
  readonly toChange = output<string>();
  readonly modeChange = output<RangeMode>();

  readonly mode = signal<RangeMode>('week');

  readonly range = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  constructor() {
    this.range.controls.start.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.fromChange.emit(this.toIsoDate(value));
    });

    this.range.controls.end.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.toChange.emit(this.toIsoDate(value));
    });
  }

  ngOnChanges(): void {
    const start = this.parseIsoDate(this.from());
    const end = this.parseIsoDate(this.to());

    this.range.patchValue(
      {
        start,
        end,
      },
      { emitEvent: false },
    );

    // Keep toggle state in sync when range is changed from outside (e.g. initial URL params).
    const inferred = this.inferMode(start, end);
    this.mode.set(inferred);
  }

  setMode(value: RangeMode): void {
    if (!value) return;

    const previousStart = this.range.controls.start.value;
    const previousEnd = this.range.controls.end.value;
    const today = this.startOfDay(new Date());

    this.mode.set(value);
    this.modeChange.emit(value);

    // UX: when switching from week/month to day (or month to week), pick "today" if it's inside the current range.
    const shouldPreferToday =
      !!previousStart &&
      !!previousEnd &&
      today.getTime() >= this.startOfDay(previousStart).getTime() &&
      today.getTime() <= this.startOfDay(previousEnd).getTime() &&
      (value === 'day' || value === 'week');

    this.applyModeRange(shouldPreferToday ? today : undefined);
  }

  jumpToToday(): void {
    this.applyModeRange(new Date());
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
      nextEnd.setDate(new Date(nextEnd.getFullYear(), nextEnd.getMonth() + 1, 0).getDate());
    }

    this.range.patchValue({ start: nextStart, end: nextEnd });
  }

  private applyModeRange(anchorDate?: Date): void {
    const anchor = anchorDate ?? this.range.controls.end.value ?? this.range.controls.start.value ?? new Date();

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

  private inferMode(start: Date | null, end: Date | null): RangeMode {
    if (!start || !end) return 'week';
    const s = this.startOfDay(start);
    const e = this.startOfDay(end);
    if (s.getTime() === e.getTime()) return 'day';

    const diffDays = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
    if (diffDays === 7 && s.getDay() === 1) return 'week'; // Monday

    const isMonthStart = s.getDate() === 1;
    const lastDay = new Date(s.getFullYear(), s.getMonth() + 1, 0).getDate();
    const isMonthEnd = e.getFullYear() === s.getFullYear() && e.getMonth() === s.getMonth() && e.getDate() === lastDay;
    if (isMonthStart && isMonthEnd) return 'month';

    return 'week';
  }

  private parseIsoDate(value: string): Date | null {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }

  private toIsoDate(value: Date | null): string {
    if (!value) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
