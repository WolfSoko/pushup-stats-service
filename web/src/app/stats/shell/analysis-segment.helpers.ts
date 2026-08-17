import {
  formatExerciseValue,
  type UnifiedEntryFilterKey,
} from '@pu-stats/models';
import type {
  AnalysisView,
  TypeBreakdownDatum,
} from '../analysis/analysis.types';
import { showsPushupVariants } from '../analysis/entry-stats';
import type { SegmentMeasurement } from '../analysis/measurement-groups';
import { kindDisplayName } from '../i18n/exercise-display-names';

/**
 * Name of the dimension a segment measures. Used as the chart's title
 * suffix ("Verlauf (Tageswerte) – Dauer") and as the value column
 * header of its trend tables, so both read in the same words.
 */
export function segmentLabel(measurement: SegmentMeasurement): string {
  switch (measurement) {
    case 'reps':
      return $localize`:@@analysis.chartSegment.reps:Wiederholungen`;
    case 'weight':
      return $localize`:@@analysis.chartSegment.weight:Gewicht`;
    case 'time':
      return $localize`:@@analysis.chartSegment.time:Dauer`;
    case 'distance':
      return $localize`:@@analysis.chartSegment.distance:Strecke`;
    case 'distance-time':
      return $localize`:@@analysis.chartSegment.distanceTime:Strecke & Tempo`;
    case 'mixed':
      return $localize`:@@analysis.chartSegment.mixed:Sonstige`;
  }
}

/**
 * Formats a segment value in its own unit: reps stay counts, `time`
 * renders as `m:ss`, distances switch to km past 1000 m. The `'mixed'`
 * bucket holds rows no definition resolves, so its volume stays a bare
 * number — there is no unit to claim.
 */
export function formatSegmentValue(
  value: number,
  measurement: SegmentMeasurement
): string {
  switch (measurement) {
    case 'reps':
      return `${value} ${$localize`:@@analysis.repsUnitLong:Reps`}`;
    case 'weight':
      return formatExerciseValue(value, 'kg');
    case 'time':
      return formatExerciseValue(value, 's');
    case 'distance':
    case 'distance-time':
      return formatExerciseValue(value, 'm');
    case 'mixed':
      return String(value);
  }
}

/** Sets are a reps concept — no other measurement logs them. */
export function segmentHasSets(measurement: SegmentMeasurement): boolean {
  return measurement === 'reps' || measurement === 'weight';
}

/**
 * Resolves the bare-id labels emitted by `computeTypeBreakdown` (in
 * kind mode) into localised display names. Pushup-variant mode passes
 * through because the breakdown already produces locale-aware variant
 * names — the mode gate is shared with the breakdown itself so both
 * sides always agree on which labels they are looking at.
 */
export function resolveTypeBreakdownDisplay(
  view: AnalysisView,
  kinds: ReadonlyArray<UnifiedEntryFilterKey>,
  data: TypeBreakdownDatum[],
  measurement: SegmentMeasurement = 'reps'
): TypeBreakdownDatum[] {
  if (showsPushupVariants(view, kinds, measurement)) return data;
  return data.map((d) => ({
    ...d,
    label: kindDisplayName(d.id as UnifiedEntryFilterKey),
  }));
}
