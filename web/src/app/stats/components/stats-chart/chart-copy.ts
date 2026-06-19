import { ChartMeasurement } from './stats-chart.models';

export interface SubtitleVariants {
  reps: string;
  time: string;
  distance: string;
  weight: string;
  mixed: string;
}

export function selectSubtitle(
  measurement: ChartMeasurement,
  variants: SubtitleVariants
): string {
  switch (measurement) {
    case 'time':
      return variants.time;
    case 'distance':
    case 'distance-time':
      return variants.distance;
    case 'weight':
      return variants.weight;
    case 'mixed':
      return variants.mixed;
    case 'reps':
    case null:
    default:
      return variants.reps;
  }
}

/**
 * Unit suffix appended to the bar series label and matching legend
 * entries. Empty string for the legacy / unknown / mixed case so the
 * label reads exactly as before.
 */
export function unitSuffix(measurement: ChartMeasurement): string {
  switch (measurement) {
    case 'time':
      return ' (s)';
    case 'distance':
    case 'distance-time':
      return ' (km)';
    case 'weight':
      return ' (kg)';
    case 'reps':
      return ' (Reps)';
    default:
      return '';
  }
}

export function secondaryLegendText(
  paceMode: boolean,
  paceLabel: string,
  dayIntegralLabel: string,
  suffix: string
): string {
  return paceMode ? `${paceLabel} (min/km)` : `${dayIntegralLabel}${suffix}`;
}
