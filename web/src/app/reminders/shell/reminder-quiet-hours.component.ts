import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { parseInputValue } from './reminders-page.helpers';

type QuietHour = { from: string; to: string };

export type QuietHourUpdate = {
  index: number;
  field: 'from' | 'to';
  value: string;
};

@Component({
  selector: 'app-reminder-quiet-hours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <div class="quiet-hours-section">
      <p class="field-label" i18n="@@reminder.quietHours.label">Ruhezeiten</p>
      @for (qh of quietHours(); track $index) {
        <div class="quiet-hour-row">
          <mat-form-field appearance="outline" class="time-field">
            <mat-label i18n="@@reminder.quietHours.from">Von</mat-label>
            <input
              matInput
              type="time"
              [disabled]="saving()"
              [value]="qh.from"
              (change)="
                quietHourUpdate.emit({
                  index: $index,
                  field: 'from',
                  value: asValue($event),
                })
              "
            />
          </mat-form-field>
          <mat-form-field appearance="outline" class="time-field">
            <mat-label i18n="@@reminder.quietHours.to">Bis</mat-label>
            <input
              matInput
              type="time"
              [disabled]="saving()"
              [value]="qh.to"
              (change)="
                quietHourUpdate.emit({
                  index: $index,
                  field: 'to',
                  value: asValue($event),
                })
              "
            />
          </mat-form-field>
          <button
            type="button"
            mat-icon-button
            [disabled]="saving()"
            (click)="quietHourRemove.emit($index)"
            aria-label="Ruhezeit entfernen"
            i18n-aria-label="@@reminder.quietHours.remove.aria"
          >
            <mat-icon>remove_circle_outline</mat-icon>
          </button>
        </div>
      }
      <button
        type="button"
        mat-stroked-button
        [disabled]="saving()"
        (click)="quietHourAdd.emit()"
        i18n="@@reminder.quietHours.add"
      >
        <mat-icon>add</mat-icon>
        Ruhezeit hinzufügen
      </button>
    </div>
  `,
  styles: `
    .quiet-hours-section {
      display: grid;
      gap: 8px;
    }
    .quiet-hour-row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .time-field {
      max-width: 130px;
    }
    .field-label {
      margin: 0 0 6px;
      font-size: 0.85rem;
      opacity: 0.75;
    }
  `,
})
export class ReminderQuietHoursComponent {
  readonly quietHours = input.required<readonly QuietHour[]>();
  readonly saving = input<boolean>(false);
  readonly quietHourAdd = output<void>();
  readonly quietHourRemove = output<number>();
  readonly quietHourUpdate = output<QuietHourUpdate>();

  asValue = parseInputValue;
}
