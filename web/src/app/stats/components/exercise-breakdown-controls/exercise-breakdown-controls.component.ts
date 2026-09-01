import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

import {
  ChartLegendComponent,
  type ChartLegendItem,
} from '../chart-legend/chart-legend.component';

export interface ExerciseChoice {
  id: string;
  label: string;
  color: string;
}

/**
 * Bar layout switch plus the per-exercise visibility toggles. Sits
 * with the chart it belongs to, listing only the exercises that chart
 * can draw: counted and timed exercises never share a chart, so a
 * "Plank" toggle above the repetitions chart would control something
 * that chart cannot show. Hiding one still filters the whole tab —
 * the scope of the *effect* is page-wide, the scope of the *offer* is
 * the chart.
 *
 * The toggles are legend entries rather than checkboxes: a filled dot
 * for a drawn exercise, a hollow ring for a hidden one. Same colour
 * key as the chart below, a fraction of the vertical space.
 *
 * Renders nothing below two exercises — a single exercise has no parts
 * to lay out and hiding it would only empty the page — *unless*
 * something is currently hidden. `hiddenExerciseIds` is page-wide and
 * survives tab and range changes, so without that exception a user who
 * hides an exercise and then narrows to a view containing only that
 * exercise would face an empty page with no reset in reach.
 */
@Component({
  selector: 'app-exercise-breakdown-controls',
  imports: [MatButtonModule, ChartLegendComponent],
  template: `
    @if (hasChoices()) {
      <section
        class="controls"
        data-testid="exercise-breakdown-controls"
        aria-label="Darstellung der Übungen"
        i18n-aria-label="@@analysis.breakdown.sectionAria"
      >
        <div class="row">
          <span class="row-label" i18n="@@analysis.breakdown.exercisesLabel"
            >Übungen</span
          >
          <app-chart-legend
            class="choices"
            [items]="legendItems()"
            [ariaLabel]="exercisesAriaLabel"
            (itemToggle)="toggleExercise.emit($event)"
          />
          @if (hidden().length > 0) {
            <button
              mat-button
              (click)="showAll.emit()"
              data-testid="exercise-breakdown-show-all"
              i18n="@@analysis.breakdown.showAll"
            >
              Alle anzeigen
            </button>
          }
        </div>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .controls {
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid rgba(148, 163, 184, 0.25);
      border-radius: 12px;
    }
    .row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px 12px;
    }
    .row-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.7;
      min-width: 6ch;
    }
    .choices {
      font-size: 0.85rem;
    }
    .mode-toggle {
      --mat-standard-button-toggle-height: 32px;
    }
    @media (max-width: 600px) {
      .row {
        align-items: flex-start;
        flex-direction: column;
        gap: 6px;
      }
    }
  `,
})
export class ExerciseBreakdownControlsComponent {
  readonly exercises = input<ReadonlyArray<ExerciseChoice>>([]);
  readonly hidden = input<ReadonlyArray<string>>([]);

  readonly toggleExercise = output<string>();
  readonly showAll = output<void>();

  readonly exercisesAriaLabel = $localize`:@@analysis.breakdown.exercisesAria:Übungen ein- oder ausblenden`;

  readonly hasChoices = computed(
    () => this.exercises().length > 1 || this.hidden().length > 0
  );

  readonly legendItems = computed<ChartLegendItem[]>(() =>
    this.exercises().map((choice) => ({
      id: choice.id,
      label: choice.label,
      color: choice.color,
      active: !this.isHidden(choice.id),
      testId: `exercise-breakdown-choice-${choice.id}`,
    }))
  );

  isHidden(exerciseId: string): boolean {
    return this.hidden().includes(exerciseId);
  }
}
