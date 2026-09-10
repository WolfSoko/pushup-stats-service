import {
  reminderActionFailedLabel,
  reminderGoalLine,
  reminderQuickLogDoneLabel,
  type ReminderGoalState,
  type ReminderLocale,
} from '@pu-stats/models';

import { buildReminderActions } from './reminders';

/**
 * The Web Push payload `dispatchPushReminders` ships, built here so the
 * notification's wording and data stay testable without the scheduler.
 */

/**
 * Where the push service worker completes a notification action. The SW is
 * a self-contained bundle without Firebase config, so the dispatcher tells
 * it the endpoint — and the project id keeps staging and prod apart.
 */
export function reminderActionUrl(): string {
  const project = process.env['GCLOUD_PROJECT'] ?? 'pushup-stats';
  return `https://europe-west3-${project}.cloudfunctions.net/reminderAction`;
}

/**
 * What the notification says: the open goal first, the motivational quote
 * below it. A reminder that only cheers leaves the user to open the app to
 * find out what is still missing.
 */
export function reminderBody(
  locale: ReminderLocale,
  quote: string,
  goal: ReminderGoalState | null
): string {
  const line = reminderGoalLine(locale, goal);
  return line ? `${line}\n${quote}` : quote;
}

export interface ReminderPayloadInput {
  readonly uid: string;
  readonly locale: ReminderLocale;
  readonly quote: string;
  readonly goal: ReminderGoalState | null;
  /** Already through `sanitizeQuickLogReps`; absent ⇒ generic log action. */
  readonly quickLogReps: number | undefined;
  readonly actionToken: string;
  readonly actionUrl: string;
}

export function buildReminderPushPayload(input: ReminderPayloadInput): string {
  const { locale, quickLogReps } = input;
  return JSON.stringify({
    title: 'PushUp Stats',
    body: reminderBody(locale, input.quote, input.goal),
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'reminder',
    renotify: true,
    data: {
      url: `/${locale}/app`,
      locale,
      reminderAction: {
        uid: input.uid,
        token: input.actionToken,
        url: input.actionUrl,
      },
      feedback: {
        ...(quickLogReps
          ? { logged: reminderQuickLogDoneLabel(locale, quickLogReps) }
          : {}),
        failed: reminderActionFailedLabel(locale),
      },
    },
    actions: buildReminderActions(locale, quickLogReps),
  });
}
