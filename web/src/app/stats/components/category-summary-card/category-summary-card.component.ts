import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { ExerciseCategoryId } from '@pu-stats/models';

import type { CategorySummary } from '../../analysis.store';
import { categoryDisplayName } from '../../i18n/exercise-display-names';

/**
 * Per-category quick-stats card shown in the Overview tab. Emits
 * `select` with the category id so the parent shell can switch the
 * mat-tab to the matching detail view without prop-drilling the store.
 */
@Component({
  selector: 'app-category-summary-card',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <mat-card
      class="card"
      [attr.data-testid]="'category-summary-card-' + summary().categoryId"
    >
      <mat-card-header>
        <mat-icon mat-card-avatar aria-hidden="true">{{
          summary().icon
        }}</mat-icon>
        <mat-card-title>{{ displayName() }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <dl class="stats">
          <div>
            <dt i18n="@@analysis.overview.cards.totalReps">Reps gesamt</dt>
            <dd
              [attr.data-testid]="
                'category-summary-card-totalReps-' + summary().categoryId
              "
            >
              {{ summary().totalReps | number }}
            </dd>
          </div>
          <div>
            <dt i18n="@@analysis.overview.cards.todayReps">Heute</dt>
            <dd>{{ summary().todayReps | number }}</dd>
          </div>
          <div>
            <dt i18n="@@analysis.overview.cards.streak">Streak</dt>
            <dd>
              <ng-container i18n="@@analysis.streakDays"
                >{{ summary().currentStreak }} Tage</ng-container
              >
            </dd>
          </div>
          <div>
            <dt i18n="@@analysis.overview.cards.bestDay">Bester Tag</dt>
            @if (summary().bestDay; as best) {
              <dd>{{ best.date }} · {{ best.total | number }}</dd>
            } @else {
              <dd>—</dd>
            }
          </div>
        </dl>
      </mat-card-content>
      <mat-card-actions align="end">
        <button
          mat-flat-button
          color="primary"
          (click)="viewSelect.emit(summary().categoryId)"
          [attr.data-testid]="
            'category-summary-card-drilldown-' + summary().categoryId
          "
        >
          <span i18n="@@analysis.overview.cards.viewDetails"
            >Details ansehen</span
          >
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    :host {
      display: block;
    }
    .card {
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    mat-card-content {
      flex: 1;
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 8px 0 0;
    }
    .stats > div {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    dt {
      font-size: 0.75rem;
      opacity: 0.7;
      margin: 0;
    }
    dd {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class CategorySummaryCardComponent {
  readonly summary = input.required<CategorySummary>();
  readonly viewSelect = output<ExerciseCategoryId>();

  displayName(): string {
    return categoryDisplayName(this.summary().categoryId);
  }
}
