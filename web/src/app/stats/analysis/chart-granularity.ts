import { daysBetween, type RangeModes } from '@pu-stats/date';
import type { StatsGranularity } from '@pu-stats/models';

/**
 * Bucket size the chart uses for each named filter period. Every range
 * stays readable at a few dozen bars, so the longer the period the
 * coarser the bucket: a day splits into hours, a year into months.
 */
const GRANULARITY_BY_RANGE_MODE: Record<
  Exclude<RangeModes, 'custom'>,
  StatsGranularity
> = {
  day: 'hourly',
  week: 'daily',
  month: 'weekly',
  year: 'monthly',
};

/**
 * Longest custom span still drawn as daily bars, and as weekly ones.
 * Both keep the bar count in the same range the named periods produce
 * (a month is 4–6 weekly bars, a year 12 monthly ones): up to 5 weeks
 * of days, then up to 26 weeks, then months.
 */
const CUSTOM_DAILY_MAX_DAYS = 35;
const CUSTOM_WEEKLY_MAX_DAYS = 182;

/**
 * Bucket size for the active filter range. A custom range carries no
 * period to read the bucket off, so its span picks one — otherwise
 * dragging the date pickers across two years would ask the chart to
 * draw 700 daily bars.
 */
export function granularityForRange(
  mode: RangeModes,
  from: string | null,
  to: string | null
): StatsGranularity {
  if (mode !== 'custom') return GRANULARITY_BY_RANGE_MODE[mode];
  if (!from || !to) return 'daily';
  const spanDays = daysBetween(from, to) + 1;
  if (spanDays <= CUSTOM_DAILY_MAX_DAYS) return 'daily';
  if (spanDays <= CUSTOM_WEEKLY_MAX_DAYS) return 'weekly';
  return 'monthly';
}
