import { DEFAULT_REMINDER_TIMEZONE } from './reminder-config.models';

/**
 * When a session reminder fires: a wall-clock time in the owner's zone,
 * repeated every N days from a start date or on fixed weekdays.
 *
 * All day arithmetic runs on calendar dates (`YYYY-MM-DD`, handled as UTC
 * midnights) and only the final step converts date + time into an instant
 * in the reminder's zone. So "every 2 days at 15:00" stays at 15:00 local
 * across a DST switch instead of drifting by the hour a 48 h step would.
 */
export type WorkoutReminderRepeat =
  | {
      readonly kind: 'interval';
      readonly everyDays: number;
      /** First day the reminder fires; every `everyDays`-th day after it. */
      readonly startDate: string;
    }
  | {
      readonly kind: 'weekdays';
      /** `0` = Sunday … `6` = Saturday, as in `ReminderConfig.weekdays`. */
      readonly weekdays: ReadonlyArray<number>;
    };

export interface WorkoutReminderSchedule {
  /** `HH:MM`, 24 h. */
  readonly time: string;
  readonly repeat: WorkoutReminderRepeat;
  /** IANA zone the time is meant in. */
  readonly timezone: string;
}

const DAY_MS = 86_400_000;
/** Longest gap between two occurrences a valid schedule can have, plus slack. */
const SEARCH_DAYS = 40;

export function isoDateToUtcMs(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  // Rejects dates like 2026-02-30, which Date.UTC silently rolls over.
  return back.getUTCMonth() === m - 1 && back.getUTCDate() === d ? ms : null;
}

function utcMsToIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidTimezone(timezone: unknown): timezone is string {
  if (typeof timezone !== 'string' || timezone === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function safeZone(timezone: string): string {
  return isValidTimezone(timezone) ? timezone : DEFAULT_REMINDER_TIMEZONE;
}

function wallClockMs(timezone: string, instantMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  );
}

/** The calendar date `instant` falls on in `timezone`. */
export function localIsoDate(timezone: string, instant: Date): string {
  return utcMsToIsoDate(wallClockMs(safeZone(timezone), instant.getTime()));
}

/**
 * The instant at which the wall clock in `timezone` shows `date` `time`.
 * A time skipped by a spring-forward lands just after the gap; a time
 * that occurs twice in autumn resolves to one of the two.
 */
export function zonedTimeToInstant(
  date: string,
  time: string,
  timezone: string
): Date | null {
  const day = isoDateToUtcMs(date);
  const minutes = timeToMinutes(time);
  if (day === null || minutes === null) return null;
  const zone = safeZone(timezone);
  const naive = day + minutes * 60_000;
  const firstGuess = naive - (wallClockMs(zone, naive) - naive);
  return new Date(naive - (wallClockMs(zone, firstGuess) - firstGuess));
}

export function timeToMinutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function firesOn(repeat: WorkoutReminderRepeat, dayMs: number): boolean {
  if (repeat.kind === 'weekdays') {
    return repeat.weekdays.includes(new Date(dayMs).getUTCDay());
  }
  const start = isoDateToUtcMs(repeat.startDate);
  if (start === null || repeat.everyDays < 1) return false;
  const diff = Math.round((dayMs - start) / DAY_MS);
  return diff >= 0 && diff % repeat.everyDays === 0;
}

function occurrenceOn(
  schedule: WorkoutReminderSchedule,
  dayMs: number
): Date | null {
  if (!firesOn(schedule.repeat, dayMs)) return null;
  return zonedTimeToInstant(
    utcMsToIsoDate(dayMs),
    schedule.time,
    schedule.timezone
  );
}

/** The first occurrence strictly after `after`, or `null` if none exists. */
export function nextWorkoutReminderAt(
  schedule: WorkoutReminderSchedule,
  after: Date
): Date | null {
  let from = isoDateToUtcMs(localIsoDate(schedule.timezone, after)) as number;
  if (schedule.repeat.kind === 'interval') {
    const start = isoDateToUtcMs(schedule.repeat.startDate);
    if (start !== null) from = Math.max(from, start);
  }
  for (let i = -1; i <= SEARCH_DAYS; i++) {
    const at = occurrenceOn(schedule, from + i * DAY_MS);
    if (at && at.getTime() > after.getTime()) return at;
  }
  return null;
}

/** The latest occurrence at or before `atOrBefore`, or `null`. */
export function previousWorkoutReminderAt(
  schedule: WorkoutReminderSchedule,
  atOrBefore: Date
): Date | null {
  const from = isoDateToUtcMs(
    localIsoDate(schedule.timezone, atOrBefore)
  ) as number;
  for (let i = 1; i >= -SEARCH_DAYS; i--) {
    const at = occurrenceOn(schedule, from + i * DAY_MS);
    if (at && at.getTime() <= atOrBefore.getTime()) return at;
  }
  return null;
}
