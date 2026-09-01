import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

import type { CategoryComparison } from '../../analysis/analysis.types';
import type { BarMode } from '../../analysis/exercise-breakdown';
import {
  ChartLegendComponent,
  type ChartLegendItem,
} from '../chart-legend/chart-legend.component';
import type { ExerciseChoice } from '../exercise-breakdown-controls/exercise-breakdown-controls.component';

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
  imports: [DecimalPipe, ChartLegendComponent],
  templateUrl: './category-comparison-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './category-comparison-chart.component.scss',
})
export class CategoryComparisonChartComponent {
  readonly data = input.required<CategoryComparison>();
  readonly barMode = input<BarMode>('stacked');
  /** Localised name + colour per exercise id; empty keeps plain bars. */
  readonly exercises = input<ReadonlyArray<ExerciseChoice>>([]);
  /** Page-wide hidden set; those exercises stay in the legend, hollow. */
  readonly hidden = input<ReadonlyArray<string>>([]);

  readonly toggleExercise = output<string>();

  readonly legendAriaLabel = $localize`:@@analysis.overview.comparison.legendAria:Übungen ein- oder ausblenden`;

  readonly rows = computed(() => {
    const data = this.data();
    const values = data.entries;
    const max = values.reduce((m, v) => (v > m ? v : m), 0);
    const byId = new Map(this.exercises().map((e) => [e.id, e]));
    // A category with a single exercise has nothing to split — its
    // "stack" would be the whole bar in one colour, which just reads as
    // an inconsistently coloured chart.
    const splittable = data.parts.some((parts) => parts.length > 1);
    return data.labels.map((label, idx) => {
      const value = values[idx] ?? 0;
      const parts = splittable ? (data.parts[idx] ?? []) : [];
      return {
        label,
        value,
        fillPercent: max > 0 ? (value / max) * 100 : 0,
        parts: parts.map((part) => ({
          exerciseId: part.exerciseId,
          label: byId.get(part.exerciseId)?.label ?? part.exerciseId,
          color: byId.get(part.exerciseId)?.color ?? '#1976d2',
          value: part.entries,
          fillPercent: max > 0 ? (part.entries / max) * 100 : 0,
        })),
      };
    });
  });

  /**
   * The exercises actually drawn, in bar order and deduplicated, plus
   * the ones the user hid — those carry no bar any more, so the legend
   * is the only place their toggle can live.
   */
  readonly legend = computed<ChartLegendItem[]>(() => {
    const seen = new Map<string, ChartLegendItem>();
    const add = (
      id: string,
      label: string,
      color: string,
      active: boolean
    ): void => {
      if (seen.has(id)) return;
      seen.set(id, {
        id,
        label,
        color,
        active,
        testId: `category-comparison-legend-${id}`,
      });
    };
    for (const row of this.rows()) {
      for (const part of row.parts) {
        add(part.exerciseId, part.label, part.color, true);
      }
    }
    const hidden = this.hidden();
    for (const choice of this.exercises()) {
      if (!hidden.includes(choice.id)) continue;
      add(choice.id, choice.label, choice.color, false);
    }
    return [...seen.values()];
  });
}
