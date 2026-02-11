import { Component, OnChanges, input, output } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-filter-bar',
  imports: [MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule, ReactiveFormsModule],
  template: `
    <section class="controls">
      <div class="heading">
        <h2>Zeitraum auswählen</h2>
      </div>

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
    this.range.patchValue(
      {
        start: this.parseIsoDate(this.from()),
        end: this.parseIsoDate(this.to()),
      },
      { emitEvent: false },
    );
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
