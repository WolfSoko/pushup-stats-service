import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import type { StatsGranularity, UnifiedEntryFilterKey } from '@pu-stats/models';
import type { RangeModes } from '@pu-stats/date';
import {
  ExerciseBreakdownControlsComponent,
  type ExerciseChoice,
} from '../components/exercise-breakdown-controls/exercise-breakdown-controls.component';
import { SetsDistributionComponent } from '../components/sets-distribution/sets-distribution.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import type { AnalysisView } from '../analysis/analysis.types';
import { exerciseColor } from '../analysis/exercise-breakdown';
import { kindDisplayName } from '../i18n/exercise-display-names';
import type { AnalysisSegment } from '../analysis/view-segments';
import { AnalysisTrendTableComponent } from './analysis-trend-table.component';
import {
  formatSegmentValue,
  resolveTypeBreakdownDisplay,
  segmentDescription,
  segmentHasSets,
  segmentLabel,
} from './analysis-segment.helpers';

/**
 * Everything the analysis tab shows for a single measurement: chart,
 * best values, type shares, sets cards (reps only) and both trend
 * tables. Rendering one of these per measurement is what keeps a
 * category like `core` from summing sit-up reps and plank seconds
 * into a single bar or a single "Bester Tag".
 *
 * Purely presentational — the segment data arrives from
 * `AnalysisStore.viewSegments()` via the group view.
 */
@Component({
  selector: 'app-analysis-segment-view',
  imports: [
    MatCardModule,
    AnalysisTrendTableComponent,
    ExerciseBreakdownControlsComponent,
    SetsDistributionComponent,
    StatsChartComponent,
    TypePieComponent,
  ],
  templateUrl: './analysis-segment-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './analysis-segment-view.component.scss',
})
export class AnalysisSegmentViewComponent {
  readonly segment = input.required<AnalysisSegment>();
  /** False for a single-measurement view, which needs no disambiguation. */
  readonly showLabel = input<boolean>(false);
  readonly granularity = input<StatsGranularity>('daily');
  readonly rangeMode = input<RangeModes>('week' as RangeModes);
  readonly from = input<string | null>(null);
  readonly to = input<string | null>(null);
  readonly dayChartMode = input<'24h' | '14h'>('14h');
  readonly view = input<AnalysisView>('overview');
  readonly kinds = input<ReadonlyArray<UnifiedEntryFilterKey>>([]);
  /** Page-wide colour order, so a colour means the same in every block. */
  readonly exerciseOrder = input<ReadonlyArray<string>>([]);
  /** Page-wide hidden set; the reset stays reachable from any block. */
  readonly hiddenExerciseIds = input<ReadonlyArray<string>>([]);

  readonly dayChartModeChange = output<'24h' | '14h'>();
  readonly toggleExercise = output<string>();
  readonly showAll = output<void>();

  readonly label = computed(() => segmentLabel(this.segment().measurement));
  readonly description = computed(() =>
    segmentDescription(this.segment().measurement)
  );
  readonly chartLabel = computed(() => (this.showLabel() ? this.label() : ''));
  readonly hasSets = computed(() => segmentHasSets(this.segment().measurement));

  /**
   * The visibility toggles offered next to this block's chart: only the
   * exercises measured in its dimension. Counted and timed exercises
   * never share a chart, so they must not share a filter either — a
   * "Plank" toggle above the repetitions chart would control something
   * that chart cannot show.
   */
  readonly exerciseChoices = computed<ExerciseChoice[]>(() => {
    const order = this.exerciseOrder();
    return this.segment().exerciseOptionIds.map((id) => ({
      id,
      label: kindDisplayName(id as UnifiedEntryFilterKey),
      color: exerciseColor(id, order),
    }));
  });

  /**
   * Every exercise this block could draw is hidden. Drives the
   * placeholder's copy: "no entries in this period" would be a lie
   * when the entries exist and the user simply hid them.
   */
  readonly allHidden = computed(() => {
    const optionIds = this.segment().exerciseOptionIds;
    if (optionIds.length === 0) return false;
    const hidden = this.hiddenExerciseIds();
    return optionIds.every((id) => hidden.includes(id));
  });

  /**
   * A one-exercise segment has nothing to split — its stack would be
   * the aggregate bar in a different colour — so the breakdown stays
   * empty and the chart keeps its sets stacking.
   */
  readonly breakdown = computed(() => {
    const parts = this.segment().exerciseSeries;
    if (parts.length < 2) return [];
    return parts.map((part) => ({
      exerciseId: part.exerciseId,
      label: kindDisplayName(part.exerciseId as UnifiedEntryFilterKey),
      color: part.color,
      values: part.values,
    }));
  });

  readonly weekTrendTitle = $localize`:@@analysis.weekTrendTitle:Wochentrend`;
  readonly weekTrendSubtitle = $localize`:@@analysis.weekTrendSubtitle:Letzte 8 Wochen`;
  readonly weekColLabel = $localize`:@@analysis.weekCol:Woche`;
  readonly monthTrendTitle = $localize`:@@analysis.monthTrendTitle:Monatstrend`;
  readonly monthTrendSubtitle = $localize`:@@analysis.monthTrendSubtitle:Letzte 6 Monate`;
  readonly monthColLabel = $localize`:@@analysis.monthCol:Monat`;

  readonly typeBreakdownDisplay = computed(() =>
    resolveTypeBreakdownDisplay(
      this.view(),
      this.kinds(),
      this.segment().typeBreakdown,
      this.segment().measurement
    )
  );

  formatValue(value: number): string {
    return formatSegmentValue(value, this.segment().measurement);
  }
}
