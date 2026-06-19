/**
 * Whole calendar days from `a` to `b` (both `YYYY-MM-DD`), in local time.
 * Positive when `b` is after `a`, negative when before, `0` for the same
 * day. Each bound is anchored to local midnight, so DST transitions
 * (23h/25h days) still round to a whole-day count.
 */
export function daysBetween(a: string, b: string): number {
  const ad = new Date(`${a}T00:00:00`);
  const bd = new Date(`${b}T00:00:00`);
  ad.setHours(0, 0, 0, 0);
  bd.setHours(0, 0, 0, 0);
  return Math.round((bd.getTime() - ad.getTime()) / 86_400_000);
}
