import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  LOCALE_ID,
  OnInit,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { PushSubscriptionService } from '@pu-push/push';
import {
  nextWorkoutReminderAt,
  WORKOUT_REMINDER_MAX_EVERY_DAYS,
  workoutReminderRejection,
} from '@pu-stats/models';
import { BusyDirective, createBusyState } from '@pu-stats/ui';

import {
  deviceTimezone,
  formFromReminder,
  inputFromForm,
  type WorkoutReminderForm,
} from './workout-reminder-form';
import { REMINDER_WEEKDAYS } from './workout-reminder-summary';
import { WorkoutRemindersStore } from './workout-reminders.store';

export interface WorkoutReminderDialogData {
  readonly workoutId: string;
  readonly title: string;
}

/**
 * Set, change or remove the reminder for one session. Saves on its own
 * and closes with `true` once the write went through.
 */
@Component({
  selector: 'app-workout-reminder-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BusyDirective,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
  ],
  templateUrl: './workout-reminder-dialog.component.html',
  styleUrl: './workout-reminder-dialog.component.css',
})
export class WorkoutReminderDialogComponent implements OnInit {
  protected readonly data = inject<WorkoutReminderDialogData>(MAT_DIALOG_DATA);
  protected readonly reminders = inject(WorkoutRemindersStore);
  protected readonly push = inject(PushSubscriptionService);
  private readonly dialogRef = inject(
    MatDialogRef<WorkoutReminderDialogComponent, boolean>
  );
  private readonly locale = inject(LOCALE_ID);
  private readonly timezone = deviceTimezone();

  protected readonly weekdayOptions = REMINDER_WEEKDAYS;
  protected readonly maxEveryDays = WORKOUT_REMINDER_MAX_EVERY_DAYS;
  protected readonly existing = this.reminders.reminderFor(this.data.workoutId);
  protected readonly form = signal<WorkoutReminderForm>(
    formFromReminder(this.existing, new Date(), this.timezone)
  );
  protected readonly failed = signal(false);
  protected readonly subscribing = createBusyState();

  private readonly input = computed(() =>
    inputFromForm(this.form(), this.timezone)
  );
  protected readonly valid = computed(
    () => workoutReminderRejection(this.input()) === null
  );

  private readonly nextFormat = new Intl.DateTimeFormat(this.locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  /** "Nächste Erinnerung: Fr., 25.09., 15:00" — proof the rhythm is what was meant. */
  protected readonly nextLabel = computed(() => {
    if (!this.valid() || !this.form().enabled) return null;
    const next = nextWorkoutReminderAt(this.input(), new Date());
    return next ? this.nextFormat.format(next) : null;
  });

  protected readonly pushOff = computed(
    () =>
      this.push.status() !== 'subscribed' && this.push.status() !== 'loading'
  );

  ngOnInit(): void {
    void this.push.init();
  }

  protected patch(changes: Partial<WorkoutReminderForm>): void {
    this.form.update((form) => ({ ...form, ...changes }));
  }

  protected numberFrom(event: Event): number {
    return Number((event.target as HTMLInputElement).value);
  }

  protected valueFrom(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected isBusy(action: 'save' | 'remove'): boolean {
    return this.reminders.busyKeys().has(`${action}:${this.data.workoutId}`);
  }

  protected enablePush(): void {
    void this.subscribing.run(() => this.push.subscribe());
  }

  protected async save(): Promise<void> {
    if (!this.valid()) return;
    this.failed.set(false);
    const ok = await this.reminders.save(this.data.workoutId, this.input());
    if (ok) this.dialogRef.close(true);
    else this.failed.set(true);
  }

  protected async remove(): Promise<void> {
    this.failed.set(false);
    const ok = await this.reminders.remove(this.data.workoutId);
    if (ok) this.dialogRef.close(true);
    else this.failed.set(true);
  }
}
