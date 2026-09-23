import {
  DEFAULT_REMINDER_TIMEZONE,
  localIsoDate,
  type WorkoutReminder,
  type WorkoutReminderInput,
} from '@pu-stats/models';

/** The dialog's editable state — both rhythms kept, so switching loses nothing. */
export interface WorkoutReminderForm {
  readonly enabled: boolean;
  readonly kind: 'interval' | 'weekdays';
  readonly time: string;
  readonly everyDays: number;
  readonly startDate: string;
  readonly weekdays: ReadonlyArray<number>;
}

export const DEFAULT_REMINDER_TIME = '18:00';

/** The zone the device is in now; a reminder follows its owner's clock. */
export function deviceTimezone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone ||
      DEFAULT_REMINDER_TIMEZONE
    );
  } catch {
    return DEFAULT_REMINDER_TIMEZONE;
  }
}

export function formFromReminder(
  reminder: WorkoutReminder | null,
  now: Date,
  timezone: string
): WorkoutReminderForm {
  const today = localIsoDate(timezone, now);
  const blank: WorkoutReminderForm = {
    enabled: true,
    kind: 'interval',
    time: DEFAULT_REMINDER_TIME,
    everyDays: 2,
    startDate: today,
    weekdays: [],
  };
  if (!reminder) return blank;
  const { repeat } = reminder;
  return {
    ...blank,
    enabled: reminder.enabled,
    time: reminder.time,
    kind: repeat.kind,
    ...(repeat.kind === 'interval'
      ? { everyDays: repeat.everyDays, startDate: repeat.startDate }
      : { weekdays: [...repeat.weekdays] }),
  };
}

export function inputFromForm(
  form: WorkoutReminderForm,
  timezone: string
): WorkoutReminderInput {
  return {
    enabled: form.enabled,
    time: form.time,
    timezone,
    repeat:
      form.kind === 'interval'
        ? {
            kind: 'interval',
            everyDays: form.everyDays,
            startDate: form.startDate,
          }
        : { kind: 'weekdays', weekdays: [...form.weekdays] },
  };
}
