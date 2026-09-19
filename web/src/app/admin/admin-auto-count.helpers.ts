import type { AdminAutoCountReport } from './admin-page.models';

/**
 * Renders a threshold set for a table cell. Keeps the raw keys: they are
 * the field names in `exercise-angle-profile.ts`, and the point of the
 * table is to be able to copy a winning set straight into the catalog.
 */
export function formatThresholds(thresholds: Record<string, number>): string {
  const keys = Object.keys(thresholds).sort();
  if (keys.length === 0) return '—';
  return keys.map((key) => `${key} ${thresholds[key]}`).join(' · ');
}

/**
 * Signed error with an explicit sign, so undercounting (`+`) and
 * overcounting (`−`) are distinguishable at a glance. Uses a real minus
 * sign rather than a hyphen so the column lines up in tabular numerals.
 */
export function formatSignedDelta(value: number): string {
  if (value === 0) return '0';
  const rounded = Math.round(value * 100) / 100;
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}

/** `actual - detected` for a single report: positive means reps were missed. */
export function reportDelta(report: AdminAutoCountReport): number {
  return report.actualReps - report.detectedReps;
}
