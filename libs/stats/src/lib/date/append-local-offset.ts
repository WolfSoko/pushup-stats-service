/**
 * Compute the local timezone offset string (e.g. '+02:00', '-05:00')
 * for a given Date object.
 */
function localOffsetString(date: Date): string {
  const offsetMin = -date.getTimezoneOffset(); // positive = east of UTC
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `${sign}${h}:${m}`;
}

/**
 * Append the browser's local timezone offset to a datetime-local string.
 *
 * `<input type="datetime-local">` returns values like '2026-04-05T22:50'
 * without timezone info. This function appends the correct local offset
 * (e.g. '+02:00') so the Cloud Function can unambiguously determine the
 * intended wall-clock time.
 *
 * The offset is computed for the specific date/time to handle DST correctly.
 *
 * @example
 * // Browser in Europe/Berlin (CEST = UTC+2)
 * appendLocalOffset('2026-04-05T22:50') // → '2026-04-05T22:50+02:00'
 *
 * // Browser in Europe/Berlin (CET = UTC+1)
 * appendLocalOffset('2026-01-15T10:00') // → '2026-01-15T10:00+01:00'
 */
export function appendLocalOffset(dtLocal: string): string {
  if (!dtLocal) return dtLocal;
  // Already has offset or Z — return as-is
  if (/[Zz]$/.test(dtLocal) || /[+-]\d{2}:?\d{2}$/.test(dtLocal)) {
    return dtLocal;
  }
  const d = new Date(dtLocal); // parsed as browser local time
  return `${dtLocal}${localOffsetString(d)}`;
}
