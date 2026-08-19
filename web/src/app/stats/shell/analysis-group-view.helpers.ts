import { type MeasurementType } from '@pu-stats/models';
import type { HeatmapMeasurement } from '../components/heatmap/heatmap.utils';

export interface HeatmapToggleLabels {
  primary: string;
  breakdown: string;
}

/**
 * `null` (no entries) collapses into `'mixed'` so the heatmap renders
 * entry-count rather than empty cells.
 */
export function resolveHeatmapMeasurement(
  viewMeasurement: MeasurementType | 'mixed' | null
): HeatmapMeasurement {
  return viewMeasurement ?? 'mixed';
}

/**
 * Toggle labels switch with the measurement so users see "Reps/Sätze"
 * for strength views, "Zeit/Intervalle" for time-measured views (e.g.
 * planks, holds), and "Strecke/Intervalle" for distance/cardio. Mixed
 * views (overview, multi-measurement categories like `core`) return
 * `null` to hide the toggle — the heatmap then counts entries per cell.
 */
export function resolveHeatmapToggleLabels(
  measurement: HeatmapMeasurement
): HeatmapToggleLabels | null {
  switch (measurement) {
    case 'reps':
    case 'weight':
      return {
        primary: $localize`:@@analysis.heatmapReps:Reps`,
        breakdown: $localize`:@@analysis.heatmapSets:Sets`,
      };
    case 'time':
      return {
        primary: $localize`:@@analysis.heatmapTime:Zeit`,
        breakdown: $localize`:@@analysis.heatmapIntervals:Intervalle`,
      };
    case 'distance':
    case 'distance-time':
      return {
        primary: $localize`:@@analysis.heatmapDistance:Strecke`,
        breakdown: $localize`:@@analysis.heatmapIntervals:Intervalle`,
      };
    case 'mixed':
      return null;
  }
}
