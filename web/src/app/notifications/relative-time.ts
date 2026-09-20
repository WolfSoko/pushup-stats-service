export interface RelativeTimeParts {
  readonly value: number;
  readonly unit: Intl.RelativeTimeFormatUnit;
}

const THRESHOLDS: ReadonlyArray<
  [seconds: number, unit: Intl.RelativeTimeFormatUnit]
> = [
  [60, 'second'],
  [3600, 'minute'],
  [86400, 'hour'],
  [604800, 'day'],
  [2629800, 'week'],
  [31557600, 'month'],
];

/**
 * Picks the coarsest unit that still reads as a number, so an entry from
 * this morning says "vor 4 Stunden" and not "vor 14400 Sekunden".
 *
 * Returns `null` for a missing or unparseable timestamp: an entry written
 * by an older schema should render without a time, not with "NaN".
 */
export function relativeTimeParts(
  iso: string | null | undefined,
  nowMs: number
): RelativeTimeParts | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;

  const elapsed = Math.round((then - nowMs) / 1000);
  const magnitude = Math.abs(elapsed);

  for (const [limit, unit] of THRESHOLDS) {
    if (magnitude < limit) {
      const divisor = unit === 'second' ? 1 : previousLimit(limit);
      return { value: Math.round(elapsed / divisor), unit };
    }
  }
  return { value: Math.round(elapsed / 31557600), unit: 'year' };
}

function previousLimit(limit: number): number {
  const index = THRESHOLDS.findIndex(([seconds]) => seconds === limit);
  return THRESHOLDS[index - 1]?.[0] ?? 1;
}
