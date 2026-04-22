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
  toMillis?: () => number;
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
 * Default lease timeout: leases older than this are considered stale
 * (the Cloud Function crashed or timed out without releasing).
 */
export const STALE_LEASE_MS = 10 * 60 * 1000;

/**
 * Web Push send options used by `dispatchPushReminders`.
 *
 * Why `urgency: 'high'`: without this the push service treats the message as
 * low-priority and batches it during Android Doze/App-Standby, so messages
 * only arrive when the browser wakes up (e.g. on app-open).
 *
 * Why `TTL: 1800`: a reminder older than 30 minutes is no longer useful — drop
 * it rather than letting the default (4 weeks) pile up in the push-service
 * queue and deliver as a burst.
 *
 * Why `topic: 'reminder'`: tells FCM to collapse queued messages with the same
 * topic so at most one pending reminder exists per device.
 */
export const PUSH_SEND_OPTIONS = {
  urgency: 'high',
  TTL: 1800,
  topic: 'reminder',
} as const;

/**
 * Checks whether an existing dispatch lease is stale (stuck) and can be
 * reclaimed. A lease is stale when leaseAcquiredAt is either missing or
 * older than STALE_LEASE_MS.
 */
export function isLeaseStale(
  leaseAcquiredAt: FirestoreTimestamp | null | undefined,
  nowMs: number
): boolean {
  if (!leaseAcquiredAt) return true; // No timestamp → legacy/missing → treat as stale
  const leaseMs =
    typeof leaseAcquiredAt.toMillis === 'function'
      ? leaseAcquiredAt.toMillis()
      : new Date(leaseAcquiredAt as unknown as string).getTime();
  if (!leaseMs || isNaN(leaseMs)) return true;
  return nowMs - leaseMs >= STALE_LEASE_MS;
}

/**
 * Classifies a web-push send failure as an expired subscription that should
 * be deleted from Firestore.
 *
 * The previous heuristic only looked at HTTP statusCode 410/404. That misses
 * the zombie-subscription case on Chromium: once the push service invalidates
 * a subscription, Chrome/Edge rewrite the stored endpoint to a sentinel like
 * `https://permanently-removed.invalid/fcm/send/...`. The `.invalid` TLD is
 * guaranteed by RFC 6761 to fail DNS, so `web-push` throws a network-level
 * error (`ENOTFOUND` / `EAI_AGAIN`) with no `statusCode` — the old branch
 * logged a WARN and left the sub alive, causing endless failed sends every
 * 5 min until the client re-subscribed.
 */
export function isExpiredSubscriptionError(
  err: unknown,
  endpoint: string
): boolean {
  const e = (err ?? {}) as {
    statusCode?: number;
    code?: string;
    message?: string;
  };
  if (e.statusCode === 410 || e.statusCode === 404) return true;
  // If the endpoint itself is already on the `.invalid` TLD, it cannot ever
  // resolve — delete without waiting for a retry.
  let hostIsInvalidTld = false;
  try {
    if (endpoint) {
      hostIsInvalidTld = new URL(endpoint).hostname.endsWith('.invalid');
    }
  } catch {
    // Malformed endpoint — not something we classify as "expired"; keep sub
    // so a later fix can surface the real issue. statusCode-410 check above
    // still deletes on authoritative push-service responses.
  }
  if (hostIsInvalidTld) return true;
  // DNS-level failures against a zombie endpoint are effectively expired.
  // Gate on .invalid-TLD so we don't delete live subs during a network hiccup.
  const dnsFailure =
    e.code === 'ENOTFOUND' ||
    e.code === 'EAI_AGAIN' ||
    (typeof e.message === 'string' && e.message.includes('ENOTFOUND'));
  if (dnsFailure && hostIsInvalidTld) return true;
  // Also treat DNS failures surfaced without a recognisable code but with
  // ENOTFOUND in the message, regardless of endpoint: if DNS says "no such
  // host" we can never deliver, but only when the endpoint also fingerprints
  // as a zombie. For live FCM we keep the sub and retry.
  return false;
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
