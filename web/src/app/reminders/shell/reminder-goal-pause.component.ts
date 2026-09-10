import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

@Component({
  selector: 'app-reminder-goal-pause',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatSlideToggleModule],
  template: `
    <div>
      <p class="field-label" i18n="@@reminder.goalPause.label">
        Erinnerungen und Ziel
      </p>
      <p class="muted" i18n="@@reminder.goalPause.desc">
        Erinnerungen zeigen, was heute noch offen ist – der Plan-Tag, wenn ein
        Trainingsplan läuft, sonst dein Tagesziel.
      </p>
      <mat-slide-toggle
        [checked]="enabled()"
        [disabled]="saving()"
        (change)="enabledToggle.emit($event.checked)"
        i18n="@@reminder.goalPause.toggle"
      >
        Erinnerungen pausieren, wenn das Ziel erreicht ist
      </mat-slide-toggle>
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
      margin: 0 0 12px;
    }
  `,
})
export class ReminderGoalPauseComponent {
  readonly enabled = input.required<boolean>();
  readonly saving = input<boolean>(false);
  readonly enabledToggle = output<boolean>();
}
