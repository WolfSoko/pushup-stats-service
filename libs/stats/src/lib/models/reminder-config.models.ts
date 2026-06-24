export interface ReminderConfig {
  enabled: boolean;
  intervalMinutes: number;
  quietHours: {
    from: string;
    to: string;
  }[];
  timezone: string;
  /**
   * Weekdays the reminder is active on, `0` = Sunday … `6` = Saturday (same
   * convention as `ComplexGoalEntry.weekdays`). Empty or undefined means the
   * reminder fires every day.
   */
  weekdays?: number[];
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
  const [rawH, rawM] = segments;
  // Require 1–2 plain decimal digits per segment. `Number()` alone would
  // accept '' / ' ' (→ 0), '1e1', '0x10' and negatives, letting malformed
  // windows slip through as real ranges.
  if (!/^\d{1,2}$/.test(rawH) || !/^\d{1,2}$/.test(rawM)) return Number.NaN;
  const h = Number(rawH);
  const m = Number(rawM);
  if (h > 23 || m > 59) return Number.NaN;
  return h * 60 + m;
}

const WEEKDAY_SHORT_TO_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Single source of truth for "is the reminder active on the current weekday".
 * Shared by the in-app tier and the Cloud Function dispatcher so both resolve
 * the weekday in the same timezone.
 *
 * - `weekdays` uses `0` = Sunday … `6` = Saturday.
 * - An empty or undefined list means "every day" (no restriction).
 */
export function isReminderDayActive(
  weekdays: ReadonlyArray<number> | undefined,
  timezone: string = DEFAULT_REMINDER_TIMEZONE,
  now: Date = new Date()
): boolean {
  if (!weekdays?.length) return true;

  const tz = timezone || DEFAULT_REMINDER_TIMEZONE;
  let short: string;
  try {
    short = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    }).format(now);
  } catch {
    short = new Intl.DateTimeFormat('en-US', {
      timeZone: DEFAULT_REMINDER_TIMEZONE,
      weekday: 'short',
    }).format(now);
  }

  const index = WEEKDAY_SHORT_TO_INDEX[short];
  return index !== undefined && weekdays.includes(index);
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
