import type { PublicProfileExercise } from '@pu-stats/models';

/**
 * Formats a per-exercise total in its own unit.
 *
 * The stored number is not unit-homogeneous: the stats trigger writes
 * reps, seconds or metres into the same field depending on the exercise.
 * Rendering it raw would label 3600 seconds of plank as "3.600" next to
 * "3.600" push-ups.
 */
export function formatExerciseTotal(
  total: number,
  measurement: PublicProfileExercise['measurement'],
  locale: string
): string {
  const nf = (value: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);

  switch (measurement) {
    case 'time': {
      const minutes = Math.round(total / 60);
      if (minutes < 60) return `${nf(minutes)} min`;
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest === 0 ? `${nf(hours)} h` : `${nf(hours)} h ${nf(rest)} min`;
    }
    case 'distance':
    case 'distance-time':
      return total >= 1000 ? `${nf(total / 1000, 1)} km` : `${nf(total)} m`;
    default:
      return nf(total);
  }
}

/**
 * Formats one logged workout in its own unit.
 *
 * Differs from {@link formatExerciseTotal} in the time case only: a
 * lifetime of planks reads better in whole minutes, but a single 90-second
 * hold rounded to "2 min" would be wrong in the one place the user can
 * check it against their own memory.
 */
export function formatExerciseValue(
  value: number,
  measurement: PublicProfileExercise['measurement'],
  locale: string
): string {
  if (measurement !== 'time') {
    return formatExerciseTotal(value, measurement, locale);
  }
  const seconds = Math.max(0, Math.round(value));
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, '0');
  return `${minutes}:${rest} min`;
}
