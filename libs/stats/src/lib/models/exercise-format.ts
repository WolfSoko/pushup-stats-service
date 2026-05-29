import type { ExerciseDefinition, ExerciseEntry } from './exercise.models';
import { measurementValueField } from './exercise.models';

/**
 * Render an exercise's primary value as a localized-ish display string,
 * driven by `ExerciseDefinition.unit`. The shape is:
 *
 *   - `'reps'`  → bare number (`"30"`)
 *   - `'s'`     → `m:ss` so a 90 s plank reads `"1:30"`; once the
 *                 duration reaches an hour it grows an hours field
 *                 (`h:mm:ss`) so aggregated time-exercise totals don't
 *                 read as a runaway minute count (28 h → `"28:00:00"`,
 *                 not `"1680:00"`)
 *   - `'kg'`    → `"<n> kg"`
 *   - `'m'`     → `"<n> m"` for short distances; ≥1000 m render as
 *                 `"<n.nn> km"` so a 5 km run reads cleanly
 *   - any other → bare number, unit-suffixed if non-empty
 *
 * Why unit and not `measurement`: a single measurement type can have
 * multiple display units later (kg vs lb, km vs mi), so rendering
 * decisions live with the unit. `measurement` keeps driving which
 * data field on an entry actually carries the value (see
 * {@link measurementValueField}).
 *
 * Negative values return `''` rather than a unit-suffixed nonsense
 * string ("-100 m"). The validator already enforces `>= def.min` for
 * persisted entries, but this helper is also called from form
 * previews where a half-typed input could briefly be negative.
 */
export function formatExerciseValue(value: number, unit: string): string {
  if (!Number.isFinite(value) || value < 0) return '';
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
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function roundForDisplay(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

/**
 * Pace as `m:ss /km` for the given distance/duration pair, or empty
 * string when either input is non-positive (pace is meaningless for a
 * 0 m or 0 s entry — and dividing by zero would produce `Infinity`).
 *
 * The result is rounded to whole seconds; sub-second precision would
 * be noise on a hand-stopped run timer.
 */
export function formatPaceMinPerKm(
  distanceM: number,
  durationSec: number
): string {
  if (
    !Number.isFinite(distanceM) ||
    !Number.isFinite(durationSec) ||
    distanceM <= 0 ||
    durationSec <= 0
  ) {
    return '';
  }
  const secPerKm = Math.round((durationSec * 1000) / distanceM);
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/**
 * Render a distance + duration pair as `"<distance> · <time> (<pace>)"`,
 * dropping the pace suffix when either value is missing. Used for
 * `'distance-time'` exercises like a tracked run, where both values
 * carry equal display weight.
 */
export function formatDistanceTime(
  distanceM: number,
  durationSec: number
): string {
  // Check the raw values, not the formatted strings: a 0 m / 0 s
  // entry formats to "0 m" / "0:00" (which are valid display strings
  // for non-cardio contexts), but in a composite they're noise.
  const hasDistance = Number.isFinite(distanceM) && distanceM > 0;
  const hasDuration = Number.isFinite(durationSec) && durationSec > 0;
  if (!hasDistance && !hasDuration) return '';
  if (!hasDistance) return formatExerciseValue(durationSec, 's');
  if (!hasDuration) return formatExerciseValue(distanceM, 'm');
  const distance = formatExerciseValue(distanceM, 'm');
  const time = formatExerciseValue(durationSec, 's');
  // Both inputs are positive and finite at this point, so
  // `formatPaceMinPerKm` will always return a non-empty string.
  const pace = formatPaceMinPerKm(distanceM, durationSec);
  return `${distance} · ${time} (${pace})`;
}

/**
 * High-level "what does this entry read as on a card or row" helper.
 * Routes through the right formatter based on `def.measurement`:
 *
 *   - `'distance-time'`: composite (`5.00 km · 25:00 (5:00 /km)`)
 *   - everything else: single value via {@link formatExerciseValue} +
 *     `def.unit`, reading the field that {@link measurementValueField}
 *     designates.
 *
 * Components should call this instead of branching on measurement
 * themselves — keeps the composite/single switch in one place.
 */
export function formatEntryDisplay(
  entry: Pick<ExerciseEntry, 'reps' | 'durationSec' | 'distanceM' | 'weightKg'>,
  def: Pick<ExerciseDefinition, 'measurement' | 'unit'>
): string {
  if (def.measurement === 'distance-time') {
    return formatDistanceTime(entry.distanceM ?? 0, entry.durationSec ?? 0);
  }
  const valueField = measurementValueField(def.measurement);
  const raw = (entry[valueField] as number | undefined) ?? 0;
  return formatExerciseValue(raw, def.unit);
}

/**
 * Same shape as {@link formatEntryDisplay} but for an aggregated total
 * (e.g. 30-day sum). For composite measurements the caller passes both
 * the distance total and the duration total; for single measurements
 * only the primary total is read.
 */
export function formatEntryTotal(
  totals: { primary: number; companion?: number },
  def: Pick<ExerciseDefinition, 'measurement' | 'unit'>
): string {
  if (def.measurement === 'distance-time') {
    return formatDistanceTime(totals.primary, totals.companion ?? 0);
  }
  return formatExerciseValue(totals.primary, def.unit);
}
