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
