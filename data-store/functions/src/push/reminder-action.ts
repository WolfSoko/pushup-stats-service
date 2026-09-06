/**
 * Server-side completion of the reminder notification's action buttons.
 *
 * Every dispatched reminder carries a fresh single-use token; the push
 * service worker presents it to the `reminderAction` callable and the
 * server performs the snooze / quick-log itself. The app window is never
 * involved, so nothing can be replayed when Android resumes a frozen PWA —
 * the failure mode behind every earlier "snooze logged push-ups" report.
 *
 * Pure decision logic lives here; `functions-reminder-action.ts` wraps it in
 * a Firestore transaction so verify + consume + write commit atomically.
 */

import crypto from 'node:crypto';
import { DEFAULT_REMINDER_TIMEZONE } from '@pu-stats/models';

import type { FirestoreTimestamp } from './reminders';
import { sanitizeQuickLogReps } from './reminders';

/** Mirrors `PUSH_SEND_OPTIONS.TTL` — an undeliverable reminder is not actionable either. */
export const REMINDER_ACTION_MAX_AGE_MS = 30 * 60 * 1000;

export const SNOOZE_MINUTES_DEFAULT = 30;
export const SNOOZE_MINUTES_MIN = 1;
export const SNOOZE_MINUTES_MAX = 1440;

export type ReminderActionType = 'snooze' | 'quick-log';

export interface ReminderActionRequest {
  uid: string;
  token: string;
  action: ReminderActionType;
  snoozeMinutes: number;
}

/** Stored on `reminderDispatchState/{uid}.pendingAction` by the dispatcher. */
export interface PendingReminderAction {
  token: string;
  issuedAt: FirestoreTimestamp | number | null;
  quickLogReps?: number;
}

export type ReminderActionRejection =
  'no-pending-action' | 'token-mismatch' | 'expired' | 'quick-log-not-offered';

export type ReminderActionDecision =
  | {
      ok: true;
      action: 'snooze';
      snoozeMinutes: number;
      snoozedUntilMs: number;
    }
  | { ok: true; action: 'quick-log'; reps: number; entry: QuickLogEntryData }
  | { ok: false; reason: ReminderActionRejection };

export interface QuickLogEntryData {
  userId: string;
  exerciseId: 'pushup';
  timestamp: string;
  reps: number;
  sets: number[];
  source: 'reminder';
  createdAt: string;
  updatedAt: string;
}

export function newReminderActionToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function parseReminderActionRequest(
  raw: unknown
): ReminderActionRequest | null {
  if (!raw || typeof raw !== 'object') return null;
  const { uid, token, action, snoozeMinutes } = raw as Record<string, unknown>;
  if (typeof uid !== 'string' || uid.length < 1 || uid.length > 128)
    return null;
  if (typeof token !== 'string' || token.length < 1 || token.length > 256)
    return null;
  if (action !== 'snooze' && action !== 'quick-log') return null;
  const minutes =
    snoozeMinutes === undefined ? SNOOZE_MINUTES_DEFAULT : snoozeMinutes;
  if (
    typeof minutes !== 'number' ||
    !Number.isInteger(minutes) ||
    minutes < SNOOZE_MINUTES_MIN ||
    minutes > SNOOZE_MINUTES_MAX
  )
    return null;
  return { uid, token, action, snoozeMinutes: minutes };
}

function tokensMatch(stored: string, presented: string): boolean {
  const a = Buffer.from(stored);
  const b = Buffer.from(presented);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function issuedAtMs(raw: PendingReminderAction['issuedAt']): number | null {
  if (typeof raw === 'number') return raw;
  if (raw && typeof raw.toMillis === 'function') return raw.toMillis();
  return null;
}

export function decideReminderAction(
  request: ReminderActionRequest,
  pending: PendingReminderAction | null | undefined,
  timezone: string | undefined,
  nowMs: number
): ReminderActionDecision {
  if (!pending || typeof pending.token !== 'string')
    return { ok: false, reason: 'no-pending-action' };
  if (!tokensMatch(pending.token, request.token))
    return { ok: false, reason: 'token-mismatch' };
  const issued = issuedAtMs(pending.issuedAt);
  if (issued === null || nowMs - issued > REMINDER_ACTION_MAX_AGE_MS)
    return { ok: false, reason: 'expired' };

  if (request.action === 'snooze') {
    return {
      ok: true,
      action: 'snooze',
      snoozeMinutes: request.snoozeMinutes,
      snoozedUntilMs: nowMs + request.snoozeMinutes * 60 * 1000,
    };
  }

  const reps = sanitizeQuickLogReps(pending.quickLogReps);
  if (!reps) return { ok: false, reason: 'quick-log-not-offered' };
  return {
    ok: true,
    action: 'quick-log',
    reps,
    entry: buildQuickLogEntry(request.uid, reps, timezone, new Date(nowMs)),
  };
}

/**
 * Same document shape the web client writes for a push-up entry, with the
 * wall-clock timestamp resolved in the user's reminder timezone — the
 * server has no browser clock to lean on.
 */
export function buildQuickLogEntry(
  uid: string,
  reps: number,
  timezone: string | undefined,
  now: Date
): QuickLogEntryData {
  const nowIso = now.toISOString();
  return {
    userId: uid,
    exerciseId: 'pushup',
    timestamp: zonedLocalTimestamp(now, timezone),
    reps,
    sets: [reps],
    source: 'reminder',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

/** `YYYY-MM-DDTHH:mm±HH:MM` — what `appendLocalOffset` produces in the browser. */
export function zonedLocalTimestamp(
  now: Date,
  timezone: string | undefined
): string {
  const parts = zonedParts(now, timezone ?? DEFAULT_REMINDER_TIMEZONE);
  const wallClockAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const offsetMin = Math.round(
    (wallClockAsUtc - Math.floor(now.getTime() / 1000) * 1000) / 60_000
  );
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return (
    `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` +
    `T${pad(parts.hour)}:${pad(parts.minute)}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function zonedParts(now: Date, timezone: string): ZonedParts {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = zonedFormatter(timezone);
  } catch {
    formatter = zonedFormatter(DEFAULT_REMINDER_TIMEZONE);
  }
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(now)) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }
  return {
    year: values['year'],
    month: values['month'],
    day: values['day'],
    hour: values['hour'],
    minute: values['minute'],
    second: values['second'],
  };
}

function zonedFormatter(timezone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
