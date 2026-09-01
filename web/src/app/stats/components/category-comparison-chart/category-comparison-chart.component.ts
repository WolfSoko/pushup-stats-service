import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  input,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

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
  imports: [DecimalPipe, MatButtonToggleModule, ChartLegendComponent],
  templateUrl: './category-comparison-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './category-comparison-chart.component.scss',
})
export class CategoryComparisonChartComponent {
  readonly data = input.required<CategoryComparison>();
  /** Localised name + colour per exercise id; empty keeps plain bars. */
  readonly exercises = input<ReadonlyArray<ExerciseChoice>>([]);

  /**
   * Stacked or side by side — a way of reading these bars, not a filter
   * on the data, so it stays with the chart that draws them.
   */
  readonly barMode = signal<BarMode>('stacked');

  /**
   * Exercises hidden by clicking this chart's legend, local to it. The
   * page-wide filter that decides what counts towards every KPI lives
   * in the checkbox bar above, not here.
   */
  private readonly hiddenExercises = signal<ReadonlySet<string>>(new Set());

  readonly barModeAriaLabel = $localize`:@@analysis.breakdown.modeAria:Balken gestapelt oder nebeneinander`;

  onLegendToggle(exerciseId: string): void {
    this.hiddenExercises.update((hidden) => {
      const next = new Set(hidden);
      if (!next.delete(exerciseId)) next.add(exerciseId);
      return next;
    });
  }

  readonly legendAriaLabel = $localize`:@@analysis.overview.comparison.legendAria:Übungen ein- oder ausblenden`;

  readonly rows = computed(() => {
    const data = this.data();
    const hidden = this.hiddenExercises();
    const byId = new Map(this.exercises().map((e) => [e.id, e]));
    // A category with a single exercise has nothing to split — its
    // "stack" would be the whole bar in one colour, which just reads as
    // an inconsistently coloured chart.
    const splittable = data.parts.some((parts) => parts.length > 1);

    // A category's total is the sum of its per-exercise counts, so a
    // bar shrinks by exactly what the legend hid. The scale follows the
    // visible values — keeping the old maximum would leave the chart
    // reading as mostly empty space after hiding the biggest exercise.
    const bars = data.labels.map((label, idx) => {
      const parts = (splittable ? (data.parts[idx] ?? []) : []).filter(
        (part) => !hidden.has(part.exerciseId)
      );
      const value = splittable
        ? parts.reduce((sum, part) => sum + part.entries, 0)
        : (data.entries[idx] ?? 0);
      return { label, value, parts };
    });
    const max = bars.reduce((m, bar) => (bar.value > m ? bar.value : m), 0);
    const percent = (value: number): number =>
      max > 0 ? (value / max) * 100 : 0;

    return bars.map((bar) => ({
      label: bar.label,
      value: bar.value,
      fillPercent: percent(bar.value),
      parts: bar.parts.map((part) => ({
        exerciseId: part.exerciseId,
        label: byId.get(part.exerciseId)?.label ?? part.exerciseId,
        color: byId.get(part.exerciseId)?.color ?? '#1976d2',
        value: part.entries,
        fillPercent: percent(part.entries),
      })),
    }));
  });

  /**
   * Every exercise this chart can draw, in bar order and deduplicated.
   * Built from the unfiltered data rather than from {@link rows} so a
   * hidden exercise keeps its entry — as a hollow ring, since the
   * legend is the only place its toggle can live.
   */
  readonly legend = computed<ChartLegendItem[]>(() => {
    const data = this.data();
    if (!data.parts.some((parts) => parts.length > 1)) return [];
    const hidden = this.hiddenExercises();
    const byId = new Map(this.exercises().map((e) => [e.id, e]));
    const seen = new Map<string, ChartLegendItem>();
    for (const parts of data.parts) {
      for (const part of parts) {
        if (seen.has(part.exerciseId)) continue;
        seen.set(part.exerciseId, {
          id: part.exerciseId,
          label: byId.get(part.exerciseId)?.label ?? part.exerciseId,
          color: byId.get(part.exerciseId)?.color ?? '#1976d2',
          active: !hidden.has(part.exerciseId),
          testId: `category-comparison-legend-${part.exerciseId}`,
        });
      }
    }
    return [...seen.values()];
  });
}
