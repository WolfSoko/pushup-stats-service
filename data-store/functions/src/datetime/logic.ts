/**
 * Date and time utilities for Berlin timezone (Europe/Berlin)
 * Pure logic, no Firebase dependencies
 */

const TZ = 'Europe/Berlin';

export interface BerlinDateParts {
  year: number;
  month: number;
  day: number;
  isoDate: string;
}

export interface IsoWeekParts {
  year: number;
  week: number;
}

/**
 * Converts a Date to Berlin timezone date parts
 * @param date Date to convert (defaults to current date)
 * @returns Object with year, month, day, and isoDate (YYYY-MM-DD)
 */
export function berlinDateParts(date = new Date()): BerlinDateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  return {
    year: Number(parts['year']),
    month: Number(parts['month']),
    day: Number(parts['day']),
    isoDate: `${parts['year']}-${parts['month']}-${parts['day']}`,
  };
}

/**
 * Calculates ISO week number from year, month, day (in UTC)
 * @param year Year (e.g., 2024)
 * @param month Month 1-12
 * @param day Day of month
 * @returns Object with ISO year and week number (1-53)
 */
export function isoWeekFromYmd(year: number, month: number, day: number): IsoWeekParts {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return { year: d.getUTCFullYear(), week };
}
