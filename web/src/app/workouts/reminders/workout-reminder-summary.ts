import type { WorkoutReminderSchedule } from '@pu-stats/models';

/** Monday first, the way the week reads in the app; values as in `Date.getDay()`. */
export const REMINDER_WEEKDAYS: ReadonlyArray<{
  readonly value: number;
  readonly label: string;
}> = [
  { value: 1, label: $localize`:@@reminder.weekday.mon:Mo` },
  { value: 2, label: $localize`:@@reminder.weekday.tue:Di` },
  { value: 3, label: $localize`:@@reminder.weekday.wed:Mi` },
  { value: 4, label: $localize`:@@reminder.weekday.thu:Do` },
  { value: 5, label: $localize`:@@reminder.weekday.fri:Fr` },
  { value: 6, label: $localize`:@@reminder.weekday.sat:Sa` },
  { value: 0, label: $localize`:@@reminder.weekday.sun:So` },
];

/** "Alle 2 Tage · 15:00", "Mo, Mi, Fr · 07:30", "Täglich · 18:00". */
export function workoutReminderSummary(
  schedule: WorkoutReminderSchedule
): string {
  const { repeat, time } = schedule;
  let rhythm: string;
  if (repeat.kind === 'interval') {
    rhythm =
      repeat.everyDays === 1
        ? $localize`:@@workouts.reminder.daily:Täglich`
        : $localize`:@@workouts.reminder.everyDays:Alle ${repeat.everyDays}:days: Tage`;
  } else if (repeat.weekdays.length === 7) {
    rhythm = $localize`:@@workouts.reminder.daily:Täglich`;
  } else {
    rhythm = REMINDER_WEEKDAYS.filter((d) => repeat.weekdays.includes(d.value))
      .map((d) => d.label)
      .join(', ');
  }
  return `${rhythm} · ${time}`;
}
