import {
  type MeasurementType,
  type UnifiedEntryFilterKey,
} from '@pu-stats/models';
import type { HeatmapMeasurement } from '../components/heatmap/heatmap.utils';
import type {
  AnalysisView,
  TypeBreakdownDatum,
} from '../analysis/analysis.types';
import { kindDisplayName } from '../i18n/exercise-display-names';

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

/**
 * Resolves the bare-id labels emitted by the store's `typeBreakdown`
 * (in kind mode) into localised display names. Pushup-variant mode
 * passes through because the store already produces locale-aware
 * variant names. The gate mirrors `analysis.store` — a per-category
 * tab other than `pushup` (Liegestütze) is always kind mode, so the
 * breakdown carries exerciseIds like `abs.situps` that need
 * translating even without an explicit kinds filter.
 */
export function resolveTypeBreakdownDisplay(
  view: AnalysisView,
  kinds: ReadonlyArray<UnifiedEntryFilterKey>,
  data: TypeBreakdownDatum[]
): TypeBreakdownDatum[] {
  const showPushupVariants =
    view === 'pushup' ||
    (view === 'overview' &&
      (kinds.length === 0 || (kinds.length === 1 && kinds[0] === 'pushup')));
  if (showPushupVariants) return data;
  return data.map((d) => ({
    ...d,
    label: kindDisplayName(d.id as UnifiedEntryFilterKey),
  }));
}
