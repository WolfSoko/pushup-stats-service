import { Component, inject, output } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import type { ExerciseCategoryId } from '@pu-stats/models';

import { AnalysisStore } from '../analysis.store';
import { CategoryComparisonChartComponent } from '../components/category-comparison-chart/category-comparison-chart.component';
import { CategorySummaryCardComponent } from '../components/category-summary-card/category-summary-card.component';

/**
 * Overview tab content for the analysis page: comparison chart on top,
 * one summary card per visible category below. Drilldown clicks bubble
 * up through `select` so the shell can switch the active mat-tab — the
 * store is updated by the shell rather than here to keep the URL
 * `?view=` sync in one place.
 */
@Component({
  selector: 'app-analysis-overview',
  standalone: true,
  imports: [
    MatCardModule,
    CategoryComparisonChartComponent,
    CategorySummaryCardComponent,
  ],
  template: `
    @if (store.categorySummaries().length === 0) {
      <p
        class="empty"
        data-testid="analysis-overview-empty"
        i18n="@@analysis.overview.empty"
      >
        Im aktuellen Zeitraum gibt es noch keine Einträge.
      </p>
    } @else {
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
    .empty {
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
}
