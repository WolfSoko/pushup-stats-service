import { toLocalIsoDate } from '@pu-stats/date';
import { TREND_MONTHS, TREND_WEEKS } from './trend-math';

export interface TrendWindow {
  from: string;
  to: string;
}

/**
 * The 8 ISO weeks ending with the week `monday` starts. Trends span a
 * fixed window ending today rather than the page filter — users read
 * them for recent momentum, not for a slice of an arbitrary range.
 */
export function weekTrendWindow(monday: Date): TrendWindow {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const from = new Date(monday);
  from.setDate(monday.getDate() - 7 * (TREND_WEEKS - 1));
  return { from: toLocalIsoDate(from), to: toLocalIsoDate(sunday) };
}

/** The 6 calendar months ending with the month `monthStart` opens. */
export function monthTrendWindow(monthStart: Date): TrendWindow {
  const from = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() - (TREND_MONTHS - 1),
    1
  );
  const to = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  return { from: toLocalIsoDate(from), to: toLocalIsoDate(to) };
}
