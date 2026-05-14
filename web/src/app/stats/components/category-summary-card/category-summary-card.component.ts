import { DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {
  type ExerciseCategoryId,
  formatExerciseValue,
  formatPaceMinPerKm,
} from '@pu-stats/models';

import type {
  CategoryDistanceFacet,
  CategoryDistanceTimeFacet,
  CategoryRepsFacet,
  CategorySingleFacet,
  CategorySummary,
  CategoryTimeFacet,
} from '../../analysis.store';
import { categoryDisplayName } from '../../i18n/exercise-display-names';

/**
 * Per-category quick-stats card shown in the Overview tab. Renders a
 * measurement-aware volume block (reps / time / distance / pace) so a
 * time-only category like `mobility` no longer shows "0 Reps gesamt"
 * and a mixed category like `core` (sit-ups + planks) lists each
 * dimension on its own row. Emits `select` with the category id so
 * the parent shell can switch the mat-tab to the matching detail view
 * without prop-drilling the store.
 */
@Component({
  selector: 'app-category-summary-card',
  standalone: true,
  imports: [DecimalPipe, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './category-summary-card.component.html',
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
    .facets {
      display: grid;
      gap: 12px;
      margin: 8px 0 0;
    }
    .facet-title {
      font-size: 0.75rem;
      font-weight: 600;
      opacity: 0.85;
      margin: 0 0 4px;
    }
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 0;
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
    .meta-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
    }
    :host-context(html:not(.light-theme)) .meta-row {
      border-top-color: rgba(255, 255, 255, 0.08);
    }
  `,
})
export class CategorySummaryCardComponent {
  readonly summary = input.required<CategorySummary>();
  readonly viewSelect = output<ExerciseCategoryId>();

  displayName(): string {
    return categoryDisplayName(this.summary().categoryId);
  }

  /**
   * Flatten the discriminated `volume` into a stable list of single
   * facets so the template can `@for` over them. A non-mixed volume
   * always yields one facet; a mixed volume yields its `facets`
   * array (already in `reps → time → distance → distance-time`
   * order from the store).
   */
  facets(): ReadonlyArray<CategorySingleFacet> {
    const v = this.summary().volume;
    return v.kind === 'mixed' ? v.facets : [v];
  }

  isReps(facet: CategorySingleFacet): facet is CategoryRepsFacet {
    return facet.kind === 'reps';
  }
  isTime(facet: CategorySingleFacet): facet is CategoryTimeFacet {
    return facet.kind === 'time';
  }
  isDistance(facet: CategorySingleFacet): facet is CategoryDistanceFacet {
    return facet.kind === 'distance';
  }
  isDistanceTime(
    facet: CategorySingleFacet
  ): facet is CategoryDistanceTimeFacet {
    return facet.kind === 'distance-time';
  }

  formatSeconds(value: number): string {
    return formatExerciseValue(value, 's');
  }
  formatMeters(value: number): string {
    return formatExerciseValue(value, 'm');
  }
  formatPace(distanceM: number, durationSec: number): string {
    return formatPaceMinPerKm(distanceM, durationSec);
  }
}
