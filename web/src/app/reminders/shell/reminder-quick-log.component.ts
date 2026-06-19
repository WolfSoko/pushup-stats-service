import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { parseInputNumber } from './reminders-page.helpers';

@Component({
  selector: 'app-reminder-quick-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSlideToggleModule,
  ],
  template: `
    <div>
      <p class="field-label" i18n="@@reminder.quickLog.label">
        Direkt-Eintrag aus der Benachrichtigung
      </p>
      <p class="muted" i18n="@@reminder.quickLog.desc">
        Zeigt einen "Eintragen"-Button auf der Push-Benachrichtigung. Wenn die
        App schon geöffnet ist, wird der Eintrag im Hintergrund gespeichert;
        ansonsten öffnet sich kurz ein Tab, der den Eintrag automatisch anlegt.
      </p>
      <div class="reminder-row">
        <mat-slide-toggle
          [checked]="enabled()"
          [disabled]="saving()"
          (change)="enabledToggle.emit($event.checked)"
          i18n="@@reminder.quickLog.toggle"
        >
          Schnell-Eintrag aktivieren
        </mat-slide-toggle>
        @if (enabled()) {
          <mat-form-field appearance="outline" class="quick-log-field">
            <mat-label i18n="@@reminder.quickLog.reps.label"
              >Anzahl Liegestütze</mat-label
            >
            <input
              matInput
              type="number"
              min="1"
              max="500"
              [disabled]="saving()"
              [value]="reps()"
              (input)="repsInput.emit(asNumber($event))"
              (blur)="repsBlur.emit()"
            />
            <mat-hint i18n="@@reminder.quickLog.reps.hint"
              >1–500 Wiederholungen</mat-hint
            >
          </mat-form-field>
        }
      </div>
    </div>
  `,
  styles: `
    .field-label {
      margin: 0 0 6px;
      font-size: 0.85rem;
      opacity: 0.75;
    }
    .muted {
      opacity: 0.8;
      font-size: 0.9rem;
      margin: 0;
    }
    .reminder-row {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .quick-log-field {
      max-width: 180px;
    }
  `,
})
export class ReminderQuickLogComponent {
  readonly enabled = input.required<boolean>();
  readonly reps = input.required<number>();
  readonly saving = input<boolean>(false);
  readonly enabledToggle = output<boolean>();
  readonly repsInput = output<number>();
  readonly repsBlur = output<void>();

  asNumber = parseInputNumber;
}
