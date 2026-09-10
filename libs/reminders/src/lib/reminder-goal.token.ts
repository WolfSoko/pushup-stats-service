import { InjectionToken } from '@angular/core';
import type { ReminderGoalState } from '@pu-stats/models';

/**
 * The goal the in-app reminder should talk about — today's plan day or the
 * configured daily goal. Read on every tick so the notification names what
 * is still open, and so a reached goal can pause the reminder.
 *
 * Default is "no goal known", which keeps the tier working without the app
 * wiring; the app overrides it with the live plan/goal state. A token
 * rather than a direct dependency because the reminders lib has no
 * compile-time knowledge of training plans.
 */
export const REMINDER_GOAL_STATE = new InjectionToken<
  () => ReminderGoalState | null
>('REMINDER_GOAL_STATE', {
  providedIn: 'root',
  factory: () => () => null,
});
