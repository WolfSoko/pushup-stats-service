import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  input,
  ChangeDetectionStrategy,
} from '@angular/core';

import type { CategoryComparison } from '../../analysis/analysis.types';
import type { BarMode } from '../../analysis/exercise-breakdown';
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
  imports: [DecimalPipe],
  templateUrl: './category-comparison-chart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './category-comparison-chart.component.scss',
})
export class CategoryComparisonChartComponent {
  readonly data = input.required<CategoryComparison>();
  readonly barMode = input<BarMode>('stacked');
  /** Localised name + colour per exercise id; empty keeps plain bars. */
  readonly exercises = input<ReadonlyArray<ExerciseChoice>>([]);

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

  /** Only the exercises actually drawn, in bar order, deduplicated. */
  readonly legend = computed(() => {
    const seen = new Map<
      string,
      { id: string; label: string; color: string }
    >();
    for (const row of this.rows()) {
      for (const part of row.parts) {
        if (seen.has(part.exerciseId)) continue;
        seen.set(part.exerciseId, {
          id: part.exerciseId,
          label: part.label,
          color: part.color,
        });
      }
    }
    return [...seen.values()];
  });
}
