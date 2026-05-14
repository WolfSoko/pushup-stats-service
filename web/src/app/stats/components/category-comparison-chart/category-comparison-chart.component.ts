import { DecimalPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';

import type { CategoryComparison } from '../../analysis.store';

/**
 * Horizontal bar comparison across exercise categories. Sits in the
 * Overview tab next to the per-category cards and shares the same
 * `CategorySummary`-derived data, so a category visible here always
 * has a matching card and a matching tab.
 *
 * The bar metric is intentionally a measurement-agnostic count of
 * logged trainings ("Trainingseinheiten"). Reps, seconds and meters
 * each live on their own scale — summing 60 s of plank onto 60 reps
 * of pushups in one bar was the original bug behind this redesign.
 * Drilling into a single measurement type belongs in the per-category
 * detail tab, not the overview comparison.
 *
 * CSS bars rather than Chart.js: with at most ~7 categories the SVG
 * chart pulls in framework, registration and PLATFORM_ID/canvas
 * guards for no real gain over a flex row with a width-percent fill.
 */
@Component({
  selector: 'app-category-comparison-chart',
  standalone: true,
  imports: [DecimalPipe],
  template: `
    <header class="head">
      <h3 class="title" i18n="@@analysis.overview.comparison.title">
        Vergleich nach Übungsgruppe
      </h3>
      <p class="metric" i18n="@@analysis.overview.comparison.metricLabel">
        Trainingseinheiten
      </p>
    </header>

    @if (rows().length === 0) {
      <p
        class="empty"
        data-testid="category-comparison-empty"
        i18n="@@analysis.overview.comparison.empty"
      >
        Keine Daten im aktuellen Zeitraum.
      </p>
    } @else {
      <ul class="bars" role="list" data-testid="category-comparison-bars">
        @for (row of rows(); track row.label) {
          <li class="bar-row">
            <span class="bar-label">{{ row.label }}</span>
            <span class="bar-track" aria-hidden="true">
              <span class="bar-fill" [style.width.%]="row.fillPercent"></span>
            </span>
            <span class="bar-value">{{ row.value | number }}</span>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
    }
    .metric {
      margin: 0;
      font-size: 0.75rem;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .bars {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: 8px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(80px, 140px) 1fr auto;
      align-items: center;
      gap: 12px;
    }
    .bar-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bar-track {
      position: relative;
      height: 10px;
      background: rgba(0, 0, 0, 0.08);
      border-radius: 6px;
      overflow: hidden;
    }
    :host-context(html:not(.light-theme)) .bar-track {
      background: rgba(255, 255, 255, 0.08);
    }
    .bar-fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: var(--mat-sys-primary, #1976d2);
      border-radius: 6px;
      transition: width 0.25s ease;
    }
    .bar-value {
      font-variant-numeric: tabular-nums;
      min-width: 4ch;
      text-align: right;
    }
    .empty {
      opacity: 0.7;
      margin: 0;
    }
    @media (max-width: 600px) {
      .bar-row {
        grid-template-columns: minmax(64px, 100px) 1fr auto;
        gap: 8px;
      }
    }
  `,
})
export class CategoryComparisonChartComponent {
  readonly data = input.required<CategoryComparison>();

  readonly rows = computed(() => {
    const data = this.data();
    const values = data.entries;
    const max = values.reduce((m, v) => (v > m ? v : m), 0);
    return data.labels.map((label, idx) => {
      const value = values[idx] ?? 0;
      return {
        label,
        value,
        fillPercent: max > 0 ? (value / max) * 100 : 0,
      };
    });
  });
}
