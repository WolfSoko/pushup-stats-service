/**
 * Render an exercise's primary value as a localized-ish display string,
 * driven by `ExerciseDefinition.unit`. The shape is:
 *
 *   - `'reps'`  → bare number (`"30"`)
 *   - `'s'`     → `m:ss` so a 90 s plank reads `"1:30"`
 *   - `'kg'`    → `"<n> kg"` (Phase 5 strength)
 *   - `'m'`     → `"<n> m"` for short distances; ≥1000 m render as
 *                 `"<n.nn> km"` so a 5 km run reads cleanly (Phase 3)
 *   - any other → bare number, unit-suffixed if non-empty
 *
 * Why unit and not `measurement`: a single measurement type can have
 * multiple display units later (kg vs lb, km vs mi), so rendering
 * decisions live with the unit. `measurement` keeps driving which
 * data field on an entry actually carries the value (see
 * {@link measurementValueField}).
 */
export function formatExerciseValue(value: number, unit: string): string {
  if (!Number.isFinite(value)) return '';
  switch (unit) {
    case 'reps':
      return String(value);
    case 's':
      return formatSecondsAsMmSs(value);
    case 'kg':
      return `${roundForDisplay(value)} kg`;
    case 'm':
      return value >= 1000
        ? `${(value / 1000).toFixed(2)} km`
        : `${Math.round(value)} m`;
    default:
      return unit ? `${roundForDisplay(value)} ${unit}` : String(value);
  }
}

function formatSecondsAsMmSs(totalSec: number): string {
  if (!Number.isFinite(totalSec) || totalSec < 0) return '';
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function roundForDisplay(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}
