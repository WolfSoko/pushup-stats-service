export interface ReminderConfig {
  enabled: boolean;
  intervalMinutes: number;
  quietHours: {
    from: string;
    to: string;
  }[];
  timezone: string;
  lastQuoteFetchAt?: string;
  /**
   * One-tap pushup count surfaced as a notification action button. When set
   * (and > 0), reminders show "✅ N eintragen" instead of the generic log
   * action — tapping it logs the entry without the user opening the app.
   */
  quickLogReps?: number;
}

export const QUICK_LOG_REPS_MIN = 1;
export const QUICK_LOG_REPS_MAX = 500;

/**
 * Canonical fallback timezone for reminder scheduling. Used by every tier
 * (in-app `ReminderService`, server-side `dispatchPushReminders`) whenever a
 * config has no explicit `timezone`, so quiet-hours are evaluated against the
 * same zone everywhere. The app is German-first, matching the store default.
 */
export const DEFAULT_REMINDER_TIMEZONE = 'Europe/Berlin';

function zonedParts(timezone: string, now: Date): Intl.DateTimeFormatPart[] {
  // `formatToParts` gives structured hour/minute parts, so we never depend on a
  // locale's string layout.
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
}

function minutesInZone(timezone: string, now: Date): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = zonedParts(timezone, now);
  } catch {
    // An invalid IANA zone (legacy/partial/user-edited Firestore docs) makes
    // `Intl.DateTimeFormat` throw a RangeError — never let a bad timezone
    // string crash scheduling; fall back to the default zone.
    parts = zonedParts(DEFAULT_REMINDER_TIMEZONE, now);
  }
  // `% 24` collapses the midnight "24" some engines emit under hour12:false.
  const hour = Number(parts.find((p) => p.type === 'hour')?.value) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);
  return hour * 60 + minute;
}

function toMinutes(hhmm: string): number {
  const segments = hhmm.split(':');
  if (segments.length !== 2) return Number.NaN;
  const [h, m] = segments.map(Number);
  if (!Number.isInteger(h) || !Number.isInteger(m)) return Number.NaN;
  if (h < 0 || h > 23 || m < 0 || m > 59) return Number.NaN;
  return h * 60 + m;
}

/**
 * Single source of truth for "is the given moment inside a quiet-hours window".
 * Shared by the in-app reminder tier and the Cloud Function dispatcher so both
 * agree on timezone defaulting, time parsing, and boundary handling.
 *
 * - `from`/`to` are "HH:MM" 24h strings; parsing is numeric so non-padded
 *   values like "7:00" work.
 * - `from === to` (or a malformed window) is treated as disabled.
 * - `from < to` is a same-day window `[from, to)`; otherwise it wraps midnight.
 */
export function isInQuietHours(
  quietHours: ReadonlyArray<{ from: string; to: string }>,
  timezone: string = DEFAULT_REMINDER_TIMEZONE,
  now: Date = new Date()
): boolean {
  if (!quietHours?.length) return false;

  const current = minutesInZone(timezone || DEFAULT_REMINDER_TIMEZONE, now);

  return quietHours.some(({ from, to }) => {
    const fromMin = toMinutes(from);
    const toMin = toMinutes(to);
    if (Number.isNaN(fromMin) || Number.isNaN(toMin) || fromMin === toMin) {
      return false;
    }
    if (fromMin < toMin) {
      return current >= fromMin && current < toMin;
    }
    return current >= fromMin || current < toMin;
  });
}
