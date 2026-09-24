import {
  nextWorkoutReminderAt,
  normalizeWorkoutReminder,
  workoutReminderDue,
  type WorkoutReminder,
} from '@pu-stats/models';

/**
 * What one tick does with one due-looking reminder document. Pure, so the
 * scheduler only carries out the decision.
 *
 * - `send`: push now and move `nextAt` on.
 * - `advance`: the occurrence is too late to be useful — move on silently.
 * - `disable`: the document is broken or has no future occurrence.
 * - `wait`: the client rewrote it since the query; nothing is due.
 */
export type WorkoutReminderDecision =
  | {
      readonly action: 'send' | 'advance';
      readonly reminder: WorkoutReminder;
      readonly nextAt: string;
    }
  | { readonly action: 'disable' }
  | { readonly action: 'wait' };

export function decideWorkoutReminder(
  id: string,
  raw: unknown,
  now: Date
): WorkoutReminderDecision {
  const reminder = normalizeWorkoutReminder(id, raw);
  if (!reminder) return { action: 'disable' };
  if (!reminder.enabled) return { action: 'wait' };
  const due = workoutReminderDue(reminder.nextAt, now);
  if (due === 'not-yet') return { action: 'wait' };
  const next = nextWorkoutReminderAt(reminder, now);
  if (!next) return { action: 'disable' };
  return {
    action: due === 'send' ? 'send' : 'advance',
    reminder,
    nextAt: next.toISOString(),
  };
}
