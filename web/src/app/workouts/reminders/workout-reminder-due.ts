import {
  previousWorkoutReminderAt,
  WORKOUT_REMINDER_GRACE_MS,
  type WorkoutReminder,
} from '@pu-stats/models';

/**
 * The occurrence the open app should show now, or `null`. The in-app
 * tier computes its own occurrence rather than reading `nextAt`: the
 * dispatcher moves `nextAt` on whether or not the device had push, so
 * by the time the app looks, it may already point at the next one.
 *
 * - within the grace window, like the server;
 * - after the reminder was saved — setting "daily 15:00" at 15:10 must
 *   not fire for the 15:00 that just passed, the server would not either;
 * - not the one this device already showed (`shownAt`).
 */
export function dueInAppOccurrence(
  reminder: WorkoutReminder,
  now: Date,
  shownAt: string | null
): Date | null {
  if (!reminder.enabled) return null;
  const at = previousWorkoutReminderAt(reminder, now);
  if (!at) return null;
  if (now.getTime() - at.getTime() > WORKOUT_REMINDER_GRACE_MS) return null;
  const savedAt = Date.parse(reminder.updatedAt);
  if (Number.isFinite(savedAt) && at.getTime() <= savedAt) return null;
  if (shownAt === at.toISOString()) return null;
  return at;
}
