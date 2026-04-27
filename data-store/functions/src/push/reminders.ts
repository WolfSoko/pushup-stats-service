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
  /** One-tap pushup count surfaced as a notification action. */
  quickLogReps?: number;
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
 *
 * 401/403 are also permanent: both mean the push service rejected the VAPID
 * pair for this endpoint (401: signature invalid; 403: applicationServerKey
 * at subscribe-time does not match current VAPID public key). No amount of
 * retrying recovers — the client has to re-subscribe, which produces a new
 * endpoint. Keeping the old one just hammers the push service every 5 min.
 *
 * Operational note: a VAPID misconfiguration that affects *all* subs (wrong
 * secret rolled out, prod/staging key cross-wire) will bulk-delete every
 * push sub on the next 5-min dispatch tick. Roll back the config before the
 * next tick, or accept that every user must re-subscribe after recovery.
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
  if (
    e.statusCode === 410 ||
    e.statusCode === 404 ||
    e.statusCode === 401 ||
    e.statusCode === 403
  )
    return true;
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
  // Any error against a .invalid endpoint is treated as expired — RFC 6761
  // guarantees the hostname never resolves, so delivery is impossible
  // regardless of the specific error code (DNS, TLS, 5xx, whatever).
  // Live-FCM endpoints that network-fail stay as-is: we keep the sub and
  // the next 5-min tick retries.
  if (hostIsInvalidTld) return true;
  return false;
}

/**
 * Maximum sane quick-log count surfaced from a notification button.
 * Mirrors `QUICK_LOG_REPS_MAX` in the shared model — guards against absurd
 * values written client-side bypassing the form.
 */
export const QUICK_LOG_REPS_MAX = 500;

export interface NotificationAction {
  action: string;
  title: string;
}

/**
 * Builds the notification `actions` array. When `quickLogReps` is configured,
 * the second slot becomes a one-tap "Log N" button (action `quick-log`)
 * carrying the count via `data.quickLogReps`. Otherwise the existing generic
 * "log" action that opens the create-entry dialog is used.
 */
export function buildReminderActions(
  language: string | undefined,
  quickLogReps: number | undefined
): NotificationAction[] {
  const lang = language === 'en' ? 'en' : 'de';
  const snooze: NotificationAction =
    lang === 'en'
      ? { action: 'snooze', title: '⏰ Snooze 30 min' }
      : { action: 'snooze', title: '⏰ 30 Min snoozen' };

  const reps = sanitizeQuickLogReps(quickLogReps);
  if (reps) {
    const title =
      lang === 'en' ? `✅ Log ${reps}` : `✅ ${reps} eintragen`;
    return [snooze, { action: 'quick-log', title }];
  }

  const log: NotificationAction =
    lang === 'en'
      ? { action: 'log', title: '✅ Log push-ups' }
      : { action: 'log', title: '✅ Eintragen' };
  return [snooze, log];
}

/**
 * Returns a clean integer in [1, QUICK_LOG_REPS_MAX] or `undefined` when the
 * input is missing/invalid. Used to gate inclusion of the quick-log action.
 */
export function sanitizeQuickLogReps(
  raw: number | undefined
): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return undefined;
  const intVal = Math.floor(raw);
  if (intVal < 1) return undefined;
  return Math.min(intVal, QUICK_LOG_REPS_MAX);
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
