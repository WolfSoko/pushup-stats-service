import { Component, computed, effect, inject, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import type { ExerciseCategoryId } from '@pu-stats/models';

import { AnalysisStore } from '../analysis.store';
import { CategoryComparisonChartComponent } from '../components/category-comparison-chart/category-comparison-chart.component';
import { CategorySummaryCardComponent } from '../components/category-summary-card/category-summary-card.component';
import { AnalysisGroupViewComponent } from './analysis-group-view.component';

/**
 * Overview tab content for the analysis page: comparison chart on top,
 * one summary card per visible category below. Drilldown clicks bubble
 * up through `viewSelect` so the shell can switch the active mat-tab —
 * the store is updated by the shell rather than here to keep the URL
 * `?view=` sync in one place.
 *
 * Entries whose `exerciseId` is missing from {@link EXERCISE_CATALOG}
 * (e.g. a Firestore doc for a deleted custom exercise) drop out of
 * every per-category roll-up — that's the point of `categorySummaries`
 * filtering on a non-null category. But the plan calls out that those
 * entries must **not** disappear from the Overview, so when the date
 * range contains data with zero categorisable rows we fall back to the
 * aggregate group-view rather than show "no entries". The shell's
 * own empty CTA handles the genuinely-empty case before this component
 * mounts.
 */
@Component({
  selector: 'app-analysis-overview',
  standalone: true,
  imports: [
    MatCardModule,
    CategoryComparisonChartComponent,
    CategorySummaryCardComponent,
    AnalysisGroupViewComponent,
  ],
  template: `
    @if (showCategoryOverview()) {
      <mat-card class="chart-card">
        <mat-card-content>
          <app-category-comparison-chart [data]="store.categoryComparison()" />
        </mat-card-content>
      </mat-card>

      <section class="cards" data-testid="analysis-overview-cards">
        @for (summary of store.categorySummaries(); track summary.categoryId) {
          <app-category-summary-card
            [summary]="summary"
            (viewSelect)="viewSelect.emit($event)"
          />
        }
      </section>
    } @else if (hasUncategorisedRows()) {
      <p
        class="notice"
        data-testid="analysis-overview-uncategorised-notice"
        i18n="@@analysis.overview.uncategorisedNotice"
      >
        Diese Einträge gehören zu keiner bekannten Kategorie — Aggregat unten.
      </p>
      <app-analysis-group-view />
    } @else {
      <p
        class="empty"
        data-testid="analysis-overview-empty"
        i18n="@@analysis.overview.empty"
      >
        Im aktuellen Zeitraum gibt es noch keine Einträge.
      </p>
    }
  `,
  styles: `
    :host {
      display: grid;
      gap: 16px;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .empty,
    .notice {
      opacity: 0.7;
      margin: 0;
    }
    @media (max-width: 600px) {
      :host {
        gap: 12px;
      }
      .cards {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
  `,
})
export class AnalysisOverviewComponent {
  readonly store = inject(AnalysisStore);
  readonly viewSelect = output<ExerciseCategoryId>();

  readonly showCategoryOverview = computed(
    () => this.store.categorySummaries().length > 0
  );

  readonly hasUncategorisedRows = computed(
    () => this.store.unifiedRows().length > 0
  );

  constructor() {
    // The uncategorised-fallback branch embeds <app-analysis-group-view />,
    // which reads `viewFilteredRows()` (scoped by `activeView`). If a
    // stale `?view=<category>` deep link left `activeView` pointing at
    // an empty category, the group-view would filter out the very rows
    // we're trying to surface. Snap `activeView` back to `'overview'`
    // whenever this branch is active.
    //
    // Narrow guard: we only run when there are zero category summaries
    // AND non-zero unified rows — i.e. the exact uncategorised-fallback
    // condition. That's mutually exclusive with the "data with known
    // categories exists" case, so this can't race with a `?view=plank`
    // deep link whose data hasn't loaded yet (the empty-state branch
    // handles that until rows arrive).
    effect(() => {
      if (this.showCategoryOverview()) return;
      if (!this.hasUncategorisedRows()) return;
      if (this.store.activeView() !== 'overview') {
        this.store.setActiveView('overview');
      }
    });
  }
}
