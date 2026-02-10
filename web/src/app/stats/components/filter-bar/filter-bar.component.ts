import { Component, OnChanges, SimpleChanges, computed, input, output, signal } from '@angular/core';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-filter-bar',
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule],
  template: `
    <section class="controls">
      <div class="heading">
        <h2>Zeitraum</h2>
        <p>Datumsbereich auswählen (wie im Material-Range-Picker)</p>
      </div>

      <mat-form-field appearance="outline">
        <mat-label>Zeitraum</mat-label>
        <mat-date-range-input
          [rangePicker]="picker"
          [comparisonStart]="comparisonStart()"
          [comparisonEnd]="comparisonEnd()"
        >
          <input
            matStartDate
            placeholder="Von"
            [value]="fromDateValue()"
            (dateChange)="onFromDateChange($event)"
          />
          <input matEndDate placeholder="Bis" [value]="toDateValue()" (dateChange)="onToDateChange($event)" />
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

  readonly fromDateValue = signal<Date | null>(null);
  readonly toDateValue = signal<Date | null>(null);

  readonly comparisonStart = computed(() => {
    const from = this.fromDateValue();
    const to = this.toDateValue();
    if (!from || !to) return null;

    const spanDays = this.dayDiffInclusive(from, to);
    const comparisonEnd = this.addDays(this.startOfDay(from), -1);
    return this.addDays(comparisonEnd, -(spanDays - 1));
  });

  readonly comparisonEnd = computed(() => {
    const from = this.fromDateValue();
    if (!from) return null;
    return this.addDays(this.startOfDay(from), -1);
  });

  ngOnChanges(_changes: SimpleChanges): void {
    this.fromDateValue.set(this.parseIsoDate(this.from()));
    this.toDateValue.set(this.parseIsoDate(this.to()));
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

  private startOfDay(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private addDays(value: Date, delta: number): Date {
    const d = new Date(value);
    d.setDate(d.getDate() + delta);
    return d;
  }

  private dayDiffInclusive(from: Date, to: Date): number {
    const start = this.startOfDay(from);
    const end = this.startOfDay(to);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.max(1, Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1);
  }

  onFromDateChange(event: MatDatepickerInputEvent<Date>): void {
    this.fromDateValue.set(event.value ?? null);
    this.fromChange.emit(this.toIsoDate(this.fromDateValue()));
  }

  onToDateChange(event: MatDatepickerInputEvent<Date>): void {
    this.toDateValue.set(event.value ?? null);
    this.toChange.emit(this.toIsoDate(this.toDateValue()));
  }
}
