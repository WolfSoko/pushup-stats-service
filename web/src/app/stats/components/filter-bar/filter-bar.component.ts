import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-filter-bar',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <section class="controls">
      <mat-form-field appearance="outline">
        <mat-label>Von</mat-label>
        <input matInput type="date" [ngModel]="from" (ngModelChange)="fromChange.emit($event)" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Bis</mat-label>
        <input matInput type="date" [ngModel]="to" (ngModelChange)="toChange.emit($event)" />
      </mat-form-field>
      <button mat-flat-button color="primary" (click)="refresh.emit()">Aktualisieren</button>
      <button mat-stroked-button (click)="clearFilters.emit()">Alles</button>
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
}
