const TZ = 'Europe/Berlin';

const berlinDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Return the ISO date string (YYYY-MM-DD) in Europe/Berlin timezone.
 *
 * This MUST be used when comparing against server-side period keys
 * (dailyKey, weeklyKey, monthlyKey) which are always computed in Berlin time.
 */
export function toBerlinIsoDate(date: Date): string {
  return berlinDateFmt.format(date);
}
