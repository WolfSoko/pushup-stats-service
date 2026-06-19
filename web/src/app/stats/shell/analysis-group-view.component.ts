import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import type { HeatmapMode } from '../components/heatmap/heatmap.utils';
import { SetsDistributionComponent } from '../components/sets-distribution/sets-distribution.component';
import { StatsChartComponent } from '../components/stats-chart/stats-chart.component';
import { TypePieComponent } from '../components/type-pie/type-pie.component';
import { AnalysisStore } from '../analysis.store';
import {
  resolveHeatmapMeasurement,
  resolveHeatmapToggleLabels,
  resolveTypeBreakdownDisplay,
} from './analysis-group-view.helpers';

/**
 * The store's `activeView` / view-scoped computeds drive the data,
 * so this component carries no inputs — dropping it inside any tab
 * content gives the right slice without prop-drilling.
 */
@Component({
  selector: 'app-analysis-group-view',
  imports: [
    DecimalPipe,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    HeatmapComponent,
    SetsDistributionComponent,
    StatsChartComponent,
    TypePieComponent,
  ],
  templateUrl: './analysis-group-view.component.html',
  styleUrl: './analysis-group-view.component.scss',
})
export class AnalysisGroupViewComponent {
  readonly store = inject(AnalysisStore);
  readonly trendColumnsWithSets = ['label', 'total', 'avgSetsPerEntry'];
  readonly heatmapMode = signal<HeatmapMode>('primary');

  readonly heatmapMeasurement = computed(() =>
    resolveHeatmapMeasurement(this.store.viewMeasurement())
  );

  readonly heatmapToggleLabels = computed(() =>
    resolveHeatmapToggleLabels(this.heatmapMeasurement())
  );

  /**
   * True for per-category tabs whose currently-selected range contains
   * no entries — flips the template into the "Keine Einträge im
   * gewählten Zeitraum" branch so the user keeps their tab selection
   * while the filter walks past empty windows. Overview never enters
   * this branch: the page shell hides this component behind the
   * `showEmptyCta` gate when the whole dataset is empty, and the
   * overview tab renders `<app-analysis-overview>` instead of this
   * component, which has its own empty-state copy.
   */
  readonly isEmptyRange = computed(
    () =>
      this.store.activeView() !== 'overview' &&
      this.store.viewFilteredRows().length === 0
  );

  readonly typeBreakdownDisplay = computed(() =>
    resolveTypeBreakdownDisplay(
      this.store.activeView(),
      this.store.kinds(),
      this.store.typeBreakdown()
    )
  );
}
