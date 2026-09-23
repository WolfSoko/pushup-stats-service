import {
  isoDateToUtcMs,
  isValidTimezone,
  nextWorkoutReminderAt,
  timeToMinutes,
  type WorkoutReminderRepeat,
  type WorkoutReminderSchedule,
} from './workout-reminder-schedule';

/**
 * A reminder to do one of the user's own sessions, at
 * `workoutReminders/{workoutId}` — one per workout, owner-only. It lives
 * beside the workout rather than inside it, so copies, the profile
 * projection and the workout's own rules never see it.
 *
 * `nextAt` is the next occurrence as an ISO instant. The client sets it
 * on save, `dispatchWorkoutReminders` advances it after each send and
 * queries `enabled == true && nextAt <= now` — so a tick reads only the
 * reminders that are due, not every reminder there is.
 */
export interface WorkoutReminder extends WorkoutReminderSchedule {
  readonly workoutId: string;
  readonly ownerId: string;
  readonly enabled: boolean;
  readonly nextAt: string;
  readonly updatedAt: string;
}

/** What the reminder dialog edits. */
export interface WorkoutReminderInput extends WorkoutReminderSchedule {
  readonly enabled: boolean;
}

export const WORKOUT_REMINDER_MAX_EVERY_DAYS = 30;

/**
 * How late a reminder may still go out. A dispatcher outage or a device
 * that was off should not deliver "time for your session" hours after
 * the time the user picked; past this, the occurrence is skipped.
 */
export const WORKOUT_REMINDER_GRACE_MS = 30 * 60 * 1000;

export type WorkoutReminderRejection =
  | 'time'
  | 'repeat'
  | 'every-days'
  | 'start-date'
  | 'weekdays'
  | 'timezone';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function repeatRejection(value: unknown): WorkoutReminderRejection | null {
  if (!isPlainObject(value)) return 'repeat';
  if (value['kind'] === 'interval') {
    const everyDays = value['everyDays'];
    if (
      typeof everyDays !== 'number' ||
      !Number.isInteger(everyDays) ||
      everyDays < 1 ||
      everyDays > WORKOUT_REMINDER_MAX_EVERY_DAYS
    ) {
      return 'every-days';
    }
    const startDate = value['startDate'];
    if (typeof startDate !== 'string' || isoDateToUtcMs(startDate) === null) {
      return 'start-date';
    }
    return null;
  }
  if (value['kind'] === 'weekdays') {
    const weekdays = value['weekdays'];
    if (
      !Array.isArray(weekdays) ||
      weekdays.length === 0 ||
      weekdays.length > 7 ||
      new Set(weekdays).size !== weekdays.length ||
      !weekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    ) {
      return 'weekdays';
    }
    return null;
  }
  return 'repeat';
}

/** Why this is not a schedule, or `null` when it is one. */
export function workoutReminderRejection(
  value: unknown
): WorkoutReminderRejection | null {
  if (!isPlainObject(value)) return 'time';
  const time = value['time'];
  if (typeof time !== 'string' || timeToMinutes(time) === null) return 'time';
  const repeat = repeatRejection(value['repeat']);
  if (repeat) return repeat;
  if (!isValidTimezone(value['timezone'])) return 'timezone';
  return null;
}

function normalizeRepeat(repeat: WorkoutReminderRepeat): WorkoutReminderRepeat {
  return repeat.kind === 'interval'
    ? {
        kind: 'interval',
        everyDays: repeat.everyDays,
        startDate: repeat.startDate,
      }
    : {
        kind: 'weekdays',
        weekdays: [...repeat.weekdays].sort((a, b) => a - b),
      };
}

/** A reminder document as read back, or `null` when it is not one. */
export function normalizeWorkoutReminder(
  workoutId: string,
  raw: unknown
): WorkoutReminder | null {
  if (!isPlainObject(raw) || workoutReminderRejection(raw)) return null;
  const ownerId = raw['ownerId'];
  if (typeof ownerId !== 'string' || ownerId === '') return null;
  return {
    workoutId,
    ownerId,
    enabled: raw['enabled'] === true,
    time: raw['time'] as string,
    repeat: normalizeRepeat(raw['repeat'] as WorkoutReminderRepeat),
    timezone: raw['timezone'] as string,
    nextAt: typeof raw['nextAt'] === 'string' ? raw['nextAt'] : '',
    updatedAt: typeof raw['updatedAt'] === 'string' ? raw['updatedAt'] : '',
  };
}

/**
 * The document the client writes, `nextAt` resolved from `now`. The
 * caller has already checked the input with `workoutReminderRejection`.
 */
export function workoutReminderDocument(
  ownerId: string,
  workoutId: string,
  input: WorkoutReminderInput,
  now: Date
): WorkoutReminder {
  const schedule: WorkoutReminderSchedule = {
    time: input.time,
    repeat: normalizeRepeat(input.repeat),
    timezone: input.timezone,
  };
  const next = nextWorkoutReminderAt(schedule, now);
  return {
    ownerId,
    workoutId,
    enabled: input.enabled && next !== null,
    ...schedule,
    nextAt: next?.toISOString() ?? '',
    updatedAt: now.toISOString(),
  };
}

export type WorkoutReminderDue = 'send' | 'late' | 'not-yet';

/**
 * What a dispatcher tick does with a reminder: send it, skip an
 * occurrence that is too far gone, or leave it alone.
 */
export function workoutReminderDue(
  nextAt: string,
  now: Date
): WorkoutReminderDue {
  const at = Date.parse(nextAt);
  // An unreadable `nextAt` is repaired like a missed one, not left to sit.
  if (!Number.isFinite(at)) return 'late';
  if (at > now.getTime()) return 'not-yet';
  return now.getTime() - at <= WORKOUT_REMINDER_GRACE_MS ? 'send' : 'late';
}
