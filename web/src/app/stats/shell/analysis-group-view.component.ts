import {
  Component,
  computed,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { ExerciseBreakdownControlsComponent } from '../components/exercise-breakdown-controls/exercise-breakdown-controls.component';
import { HeatmapComponent } from '../components/heatmap/heatmap.component';
import type { HeatmapMode } from '../components/heatmap/heatmap.utils';
import { AnalysisStore } from '../analysis.store';
import { AnalysisSegmentViewComponent } from './analysis-segment-view.component';
import {
  resolveHeatmapMeasurement,
  resolveHeatmapToggleLabels,
} from './analysis-group-view.helpers';

/**
 * The store's `activeView` / view-scoped computeds drive the data,
 * so this component carries no inputs — dropping it inside any tab
 * content gives the right slice without prop-drilling.
 *
 * Everything unit-bound (chart, best values, type shares, trends)
 * lives in one {@link AnalysisSegmentViewComponent} per measurement;
 * what stays here is measurement-independent: streaks count days, and
 * the heatmap falls back to entry counts for mixed views.
 */
@Component({
  selector: 'app-analysis-group-view',
  imports: [
    MatButtonToggleModule,
    MatCardModule,
    ExerciseBreakdownControlsComponent,
    HeatmapComponent,
    AnalysisSegmentViewComponent,
  ],
  templateUrl: './analysis-group-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './analysis-group-view.component.scss',
})
export class AnalysisGroupViewComponent {
  readonly store = inject(AnalysisStore);
  readonly heatmapMode = signal<HeatmapMode>('primary');

  readonly hasMultipleSegments = computed(
    () => this.store.viewSegments().length > 1
  );

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
}
