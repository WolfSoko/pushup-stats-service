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
 * Uses formatToParts to guarantee YYYY-MM-DD format regardless of
 * locale/ICU fallback behavior.
 *
 * This MUST be used when comparing against server-side period keys
 * (dailyKey, weeklyKey, monthlyKey) which are always computed in Berlin time.
 */
export function toBerlinIsoDate(date: Date): string {
  const parts = berlinDateFmt
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts['year']}-${parts['month']}-${parts['day']}`;
}
