import { appendLocalOffset } from './append-local-offset';

/**
 * Browser-local timestamp at minute granularity with the current offset
 * appended — e.g. `'2026-04-05T22:50+02:00'`. Used by every quick-add
 * code path (dashboard buttons, orchestrator FAB, auto-count confirm)
 * so the Cloud Function receives an unambiguous wall-clock time.
 *
 * Truncates seconds because quick-add UIs round to the minute and the
 * legacy `datetime-local` input has no seconds component — keeping the
 * resolution coarser avoids re-rendering surprises ("entries at 22:50:34"
 * vs displayed "22:50").
 */
export function nowLocalIsoTimestamp(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return appendLocalOffset(`${y}-${m}-${d}T${hh}:${mm}`);
}
