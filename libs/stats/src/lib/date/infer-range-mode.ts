import { parseIsoDate } from './parse-iso-date';
import { RangeModes } from './range-modes.type';

export function inferRangeMode(from: string, to: string): RangeModes {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return 'week';
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  if (s.getTime() === e.getTime()) return 'day';

  const diffDays = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
  if (diffDays === 7 && s.getDay() === 1) return 'week';

  const isMonthStart = s.getDate() === 1;
  const lastDayOfMonth = new Date(
    s.getFullYear(),
    s.getMonth() + 1,
    0
  ).getDate();
  const isMonthEnd =
    e.getFullYear() === s.getFullYear() &&
    e.getMonth() === s.getMonth() &&
    e.getDate() === lastDayOfMonth;

  if (isMonthStart && isMonthEnd) return 'month';

  const isYearStart = s.getMonth() === 0 && isMonthStart;
  const isYearEnd =
    e.getFullYear() === s.getFullYear() &&
    e.getMonth() === 11 &&
    e.getDate() === 31;

  if (isYearStart && isYearEnd) return 'year';
  return 'custom';
}
