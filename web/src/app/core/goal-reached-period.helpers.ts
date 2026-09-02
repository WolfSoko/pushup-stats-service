import { toBerlinIsoDate } from '@pu-stats/date';

export const STORAGE_PREFIX = 'pus_goal_reached_';

/**
 * Convert a Firestore-stored ISO timestamp to its Berlin-localised date key.
 *
 * Two timestamp shapes appear in production:
 *   - Naive (`YYYY-MM-DDTHH:mm[:ss]`) — written by older quick-add entries
 *     that the backend treats as Berlin local time. We must NOT round-trip
 *     these through `new Date()`, because that parses them in the device's
 *     local timezone and shifts the day on devices not in `Europe/Berlin`.
 *     The Cloud Function's bucketing logic also uses the literal date prefix.
 *   - TZ-aware (`...Z` or `...±HH:mm`) — written by the entry-create path
 *     via `new Date().toISOString()`. We convert these via the Berlin formatter
 *     so that an entry made at 00:30 Berlin (== 22:30 UTC the prior day)
 *     counts toward today and not yesterday.
 */
export function entryBerlinDate(timestamp: string): string {
  if (HAS_TIMEZONE.test(timestamp)) {
    return toBerlinIsoDate(new Date(timestamp));
  }
  return timestamp.slice(0, 10);
}

const HAS_TIMEZONE = /(Z|[+-]\d{2}:?\d{2})$/;

export function pruneStalePeriodFlags(todayBerlin: string): void {
  // Touching `globalThis.localStorage` itself can throw `SecurityError` in
  // sandboxed/opaque origins or with storage disabled (Safari private mode,
  // some embedded webviews). Wrap the whole access — not just the read loop —
  // so cleanup stays best-effort and never breaks app startup.
  try {
    const ls = globalThis.localStorage;
    if (!ls) return;
    const validKeys = new Set([
      `${STORAGE_PREFIX}daily_${todayBerlin}`,
      `${STORAGE_PREFIX}weekly_${isoWeekKey(todayBerlin)}`,
      `${STORAGE_PREFIX}monthly_${todayBerlin.slice(0, 7)}`,
      `${STORAGE_PREFIX}plan_${todayBerlin}`,
    ]);
    const stale: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i);
      if (key && key.startsWith(STORAGE_PREFIX) && !validKeys.has(key)) {
        stale.push(key);
      }
    }
    for (const key of stale) ls.removeItem(key);
  } catch {
    // localStorage unavailable / SecurityError — best-effort cleanup only.
  }
}

export function readFlag(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: string): void {
  try {
    globalThis.localStorage?.setItem(key, '1');
  } catch {
    // localStorage unavailable — best-effort; in-memory `opened` set still
    // suppresses repeat triggers for the lifetime of the session.
  }
}

export function clearFlag(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // localStorage unavailable — nothing to clear.
  }
}

export function isoWeekKey(berlinDate: string): string {
  const [y, m, day] = berlinDate.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  d.setHours(0, 0, 0, 0);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + 3 - weekday);
  const isoYear = d.getFullYear();
  const firstThursday = new Date(isoYear, 0, 4);
  firstThursday.setHours(0, 0, 0, 0);
  const ftDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() + 3 - ftDay);
  const week =
    1 +
    Math.round(
      (d.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function weekRange(berlinDate: string): { from: string; to: string } {
  const [y, m, day] = berlinDate.split('-').map(Number);
  const todayDate = new Date(y, m - 1, day);
  const dayOfWeek = (todayDate.getDay() + 6) % 7;
  const monday = new Date(todayDate);
  monday.setDate(todayDate.getDate() - dayOfWeek);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: ymd(monday), to: ymd(sunday) };
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
