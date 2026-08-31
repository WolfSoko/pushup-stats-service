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

/**
 * Bare unit for the y-axis title — the same units as
 * {@link unitSuffix} without its parentheses. `''` for mixed/unknown
 * views, where no single unit describes the bars.
 */
export function axisUnit(measurement: ChartMeasurement): string {
  return unitSuffix(measurement).replace(/^ \(|\)$/g, '');
}

/**
 * Unit of the right-hand line: pace in `min/km`, otherwise the running
 * total of the bars — same unit, prefixed with a sigma so the two axes
 * stay distinguishable.
 */
export function secondaryAxisUnit(
  paceMode: boolean,
  measurement: ChartMeasurement
): string {
  if (paceMode) return 'min/km';
  const unit = axisUnit(measurement);
  return unit ? `Σ ${unit}` : '';
}

export function secondaryLegendText(
  paceMode: boolean,
  paceLabel: string,
  dayIntegralLabel: string,
  suffix: string
): string {
  return paceMode ? `${paceLabel} (min/km)` : `${dayIntegralLabel}${suffix}`;
}
