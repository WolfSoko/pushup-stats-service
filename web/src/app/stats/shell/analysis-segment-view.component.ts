import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import type { StatsGranularity, UnifiedEntryFilterKey } from '@pu-stats/models';
import type { RangeModes } from '@pu-stats/date';
import { SetsDistributionComponent } from '../components/sets-distribution/sets-distribution.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import type { AnalysisView } from '../analysis/analysis.types';
import type { AnalysisSegment } from '../analysis/view-segments';
import {
  formatSegmentValue,
  resolveTypeBreakdownDisplay,
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
    DecimalPipe,
    MatCardModule,
    MatTableModule,
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

  readonly dayChartModeChange = output<'24h' | '14h'>();

  readonly label = computed(() => segmentLabel(this.segment().measurement));
  readonly chartLabel = computed(() => (this.showLabel() ? this.label() : ''));
  readonly hasSets = computed(() => segmentHasSets(this.segment().measurement));

  readonly trendColumns = computed(() =>
    this.hasSets() ? ['label', 'total', 'avgSetsPerEntry'] : ['label', 'total']
  );

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
