import { normalizeReminderLocale, type ReminderLocale } from '@pu-stats/models';

/**
 * The locale a user's push notifications are written in.
 *
 * Prefers the explicit top-level `locale` recent clients write. Falls back
 * to the legacy `reminder.language` on docs created before that field
 * migrated up — without it, a user who set English reminders and never
 * re-saved settings would silently receive German push after a deploy.
 */
export function pushLocaleFromConfig(
  config: Record<string, unknown> | undefined
): ReminderLocale {
  const reminder = config?.['reminder'] as { language?: unknown } | undefined;
  return normalizeReminderLocale(config?.['locale'] ?? reminder?.language);
}
