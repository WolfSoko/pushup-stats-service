/**
 * Push reminder logic and notification utilities
 * Pure logic for reminder scheduling and notification content
 */

const TZ = 'Europe/Berlin';

export interface ReminderConfig {
  enabled?: boolean;
  timezone?: string;
  quietHours?: Array<{ from: string; to: string }>;
  intervalMinutes?: number;
  language?: string;
}

export interface FirestoreTimestamp {
  toMillis(): number;
}

/**
 * Determines if a push reminder should be sent now
 * Checks: enabled status, quiet hours, snooze state, and interval elapsed
 * @param reminder Reminder configuration
 * @param lastSentAt Last time reminder was sent
 * @param nowMs Current time in milliseconds
 * @param snoozedUntil When the snooze ends
 * @returns true if reminder should be sent
 */
export function shouldSendReminder(
  reminder: ReminderConfig | undefined,
  lastSentAt: FirestoreTimestamp | null,
  nowMs: number,
  snoozedUntil: FirestoreTimestamp | null
): boolean {
  // Reminder must be enabled
  if (!reminder?.enabled) return false;

  // Check quiet hours
  const tz = reminder.timezone || TZ;
  const nowDate = new Date(nowMs);

  const timeStr = nowDate.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
    hour12: false,
  });
  const [hh, mm] = timeStr.split(':').map(Number);
  const currentMinutes = hh * 60 + mm;

  const quietHours = reminder.quietHours || [];
  for (const { from, to } of quietHours) {
    const [fh, fm] = from.split(':').map(Number);
    const [th, tm] = to.split(':').map(Number);
    const fromMin = fh * 60 + fm;
    const toMin = th * 60 + tm;

    // Handle ranges that don't cross midnight
    if (fromMin <= toMin) {
      if (currentMinutes >= fromMin && currentMinutes < toMin) return false;
    } else {
      // Handle ranges that cross midnight (e.g., 22:00 - 06:00)
      if (currentMinutes >= fromMin || currentMinutes < toMin) return false;
    }
  }

  // Check if snoozed
  if (snoozedUntil) {
    const snoozeMs = snoozedUntil.toMillis
      ? snoozedUntil.toMillis()
      : new Date(snoozedUntil as unknown as string).getTime();
    if (nowMs < snoozeMs) return false;
  }

  // Check interval has elapsed since last send
  if (lastSentAt) {
    const lastMs = lastSentAt.toMillis
      ? lastSentAt.toMillis()
      : new Date(lastSentAt as unknown as string).getTime();
    const intervalMs = (reminder.intervalMinutes || 60) * 60 * 1000;
    if (nowMs - lastMs < intervalMs) return false;
  }

  return true;
}

/**
 * Builds a random motivational push notification message
 * @param language Language code ('en' or 'de', defaults to 'de')
 * @returns Random notification message for the language
 */
export function buildNotificationPayload(language?: string): string {
  const messages: Record<string, string[]> = {
    de: [
      'Zeit für Liegestütze! 💪',
      'Kurze Pause? Perfekt für Liegestütze!',
      'Du schaffst das – ein paar Liegestütze!',
      'Beweg dich! Liegestütze warten auf dich. 🔥',
      'Dein Körper ruft: Liegestütze, los!',
    ],
    en: [
      'Time for push-ups! 💪',
      'Quick break? Perfect for push-ups!',
      'You got this – a few push-ups!',
      'Move it! Push-ups are waiting for you. 🔥',
      'Your body calls: push-ups, go!',
    ],
  };

  const lang = language === 'en' ? 'en' : 'de';
  const list = messages[lang];
  return list[Math.floor(Math.random() * list.length)];
}
