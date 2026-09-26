/**
 * Berlin-local date parts of a stored timestamp — the one place that
 * decides which day and hour an entry belongs to. Shared by the server
 * aggregates and the dashboard, so both bucket an entry identically.
 */

const TZ = 'Europe/Berlin';

export interface BerlinDateParts {
  isoDate: string;
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
}

const WEEKDAY_MAP: Record<string, string> = {
  Sun: 'So',
  Mon: 'Mo',
  Tue: 'Di',
  Wed: 'Mi',
  Thu: 'Do',
  Fri: 'Fr',
  Sat: 'Sa',
};

/**
 * Check whether a timestamp string contains an explicit timezone indicator
 * (trailing 'Z', or a '+'/'-' offset after the time portion).
 * Older entries may be stored as Berlin local time without offset
 * (e.g. '2026-04-05T22:50'). Newer entries include the offset
 * (e.g. '2026-04-05T22:50+02:00'). Offset-less timestamps must NOT be
 * re-interpreted as UTC and then converted to Berlin.
 */
function hasTimezoneIndicator(ts: string): boolean {
  if (ts.endsWith('Z') || ts.endsWith('z')) return true;
  // Look for +HH:MM or -HH:MM after the 'T' separator
  const tIdx = ts.indexOf('T');
  if (tIdx === -1) return false;
  const timePart = ts.slice(tIdx + 1);
  return /[+-]\d{2}:?\d{2}$/.test(timePart);
}

/**
 * Extract Berlin-local date parts from a timestamp string.
 *
 * Two modes:
 * 1. Timestamp WITH timezone (e.g. '…Z' or '…+02:00'): convert to Berlin via Intl.
 * 2. Timestamp WITHOUT timezone (e.g. '2026-04-05T22:50'): already Berlin local time,
 *    parse date/time parts directly from the string to avoid UTC mis-interpretation.
 */
export function berlinParts(isoTimestamp: string): BerlinDateParts {
  if (!hasTimezoneIndicator(isoTimestamp)) {
    // Timestamp is already Berlin local time — parse directly.
    const [datePart, timePart] = isoTimestamp.split('T');
    const [yearStr, monthStr, dayStr] = datePart.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const hour = timePart ? Number(timePart.split(':')[0]) : 0;

    // Compute weekday from a UTC-safe date (noon avoids DST edge cases)
    const weekDate = new Date(Date.UTC(year, month - 1, day, 12));
    const dayOfWeek = new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      weekday: 'short',
    }).format(weekDate);

    return {
      isoDate: `${yearStr}-${monthStr}-${dayStr}`,
      year,
      month,
      day,
      weekday: WEEKDAY_MAP[dayOfWeek] ?? dayOfWeek,
      hour,
    };
  }

  // Timestamp has explicit timezone → convert to Berlin via Intl.
  const d = new Date(isoTimestamp);

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  const dayOfWeek = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
  }).format(d);

  return {
    isoDate: `${dateParts['year']}-${dateParts['month']}-${dateParts['day']}`,
    year: Number(dateParts['year']),
    month: Number(dateParts['month']),
    day: Number(dateParts['day']),
    weekday: WEEKDAY_MAP[dayOfWeek] ?? dayOfWeek,
    hour: Number(timeParts['hour']),
  };
}

/**
 * Build heatmap slot key from weekday + hour.
 */
export function heatmapSlot(weekday: string, hour: number): string {
  return `${weekday}-${String(hour).padStart(2, '0')}`;
}
