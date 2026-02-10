import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerInputEvent, MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-filter-bar',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  template: `
    <section class="controls">
      <div class="heading">
        <h2>Filter</h2>
        <p>Zeitraum auswählen und Daten aktualisieren</p>
      </div>

      <div class="inputs">
        <mat-form-field appearance="outline">
          <mat-label>Von</mat-label>
          <input
            matInput
            [matDatepicker]="fromPicker"
            [ngModel]="toDate(from)"
            (dateChange)="onFromDateChange($event)"
          />
          <mat-datepicker-toggle matIconSuffix [for]="fromPicker"></mat-datepicker-toggle>
          <mat-datepicker #fromPicker></mat-datepicker>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Bis</mat-label>
          <input
            matInput
            [matDatepicker]="toPicker"
            [ngModel]="toDate(to)"
            (dateChange)="onToDateChange($event)"
          />
          <mat-datepicker-toggle matIconSuffix [for]="toPicker"></mat-datepicker-toggle>
          <mat-datepicker #toPicker></mat-datepicker>
        </mat-form-field>
      </div>

      <div class="actions">
        <button mat-flat-button color="primary" (click)="refresh.emit()">Aktualisieren</button>
        <button mat-stroked-button (click)="clearFilters.emit()">Zurücksetzen</button>
      </div>
    </section>
  `,
  styleUrl: './filter-bar.component.scss',
})
export class FilterBarComponent {
  @Input() from = '';
  @Input() to = '';
  @Output() fromChange = new EventEmitter<string>();
  @Output() toChange = new EventEmitter<string>();
  @Output() refresh = new EventEmitter<void>();
  @Output() clearFilters = new EventEmitter<void>();

  toDate(value: string): Date | null {
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

  onFromDateChange(event: MatDatepickerInputEvent<Date>): void {
    this.fromChange.emit(this.toIsoDate(event.value ?? null));
  }

  onToDateChange(event: MatDatepickerInputEvent<Date>): void {
    this.toChange.emit(this.toIsoDate(event.value ?? null));
  }
}
