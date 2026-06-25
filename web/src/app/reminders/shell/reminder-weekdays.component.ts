import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

interface WeekdayOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-reminder-weekdays',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonToggleModule],
  template: `
    <div>
      <p class="field-label" i18n="@@reminder.weekdays.label">Wochentage</p>
      <mat-button-toggle-group
        multiple
        [value]="weekdays()"
        [disabled]="saving()"
        (change)="weekdaysChange.emit($event.value)"
        aria-label="Wochentage"
        i18n-aria-label="@@reminder.weekdays.aria"
      >
        @for (day of days; track day.value) {
          <mat-button-toggle [value]="day.value">{{
            day.label
          }}</mat-button-toggle>
        }
      </mat-button-toggle-group>
      <p class="field-hint" i18n="@@reminder.weekdays.hint">
        Keine Auswahl = jeden Tag
      </p>
    </div>
  `,
  styles: `
    .field-label {
      margin: 0 0 6px;
      font-size: 0.85rem;
      opacity: 0.75;
    }
    .field-hint {
      margin: 6px 0 0;
      font-size: 0.8rem;
      opacity: 0.7;
    }
  `,
})
export class ReminderWeekdaysComponent {
  readonly weekdays = input.required<number[]>();
  readonly saving = input<boolean>(false);
  readonly weekdaysChange = output<number[]>();

  // 0 = Sunday … 6 = Saturday (matches ReminderConfig.weekdays); displayed
  // Monday-first per German convention.
  readonly days: WeekdayOption[] = [
    { value: 1, label: $localize`:@@reminder.weekday.mon:Mo` },
    { value: 2, label: $localize`:@@reminder.weekday.tue:Di` },
    { value: 3, label: $localize`:@@reminder.weekday.wed:Mi` },
    { value: 4, label: $localize`:@@reminder.weekday.thu:Do` },
    { value: 5, label: $localize`:@@reminder.weekday.fri:Fr` },
    { value: 6, label: $localize`:@@reminder.weekday.sat:Sa` },
    { value: 0, label: $localize`:@@reminder.weekday.sun:So` },
  ];
}
