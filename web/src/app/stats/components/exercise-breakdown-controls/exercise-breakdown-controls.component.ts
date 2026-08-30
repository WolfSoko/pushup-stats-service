import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';

import type { BarMode } from '../../analysis/exercise-breakdown';

export interface ExerciseChoice {
  id: string;
  label: string;
  color: string;
}

/**
 * Bar layout switch plus the per-exercise visibility checkboxes. One
 * instance per analysis tab: the checkboxes filter the whole tab (not
 * just the chart), so a second copy would imply a second scope.
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
  imports: [MatButtonModule, MatButtonToggleModule, MatCheckboxModule],
  template: `
    @if (hasChoices()) {
      <section
        class="controls"
        data-testid="exercise-breakdown-controls"
        aria-label="Darstellung der Übungen"
        i18n-aria-label="@@analysis.breakdown.sectionAria"
      >
        <div class="row">
          <span class="row-label" i18n="@@analysis.breakdown.modeLabel"
            >Balken</span
          >
          <mat-button-toggle-group
            [value]="barMode()"
            (change)="barModeChange.emit($event.value)"
            class="mode-toggle"
            data-testid="exercise-breakdown-mode"
            aria-label="Balken gestapelt oder nebeneinander"
            i18n-aria-label="@@analysis.breakdown.modeAria"
          >
            <mat-button-toggle
              value="stacked"
              i18n="@@analysis.breakdown.stacked"
              >Gestapelt</mat-button-toggle
            >
            <mat-button-toggle
              value="grouped"
              i18n="@@analysis.breakdown.grouped"
              >Nebeneinander</mat-button-toggle
            >
          </mat-button-toggle-group>
        </div>

        <div class="row">
          <span class="row-label" i18n="@@analysis.breakdown.exercisesLabel"
            >Übungen</span
          >
          <div class="choices">
            @for (choice of exercises(); track choice.id) {
              <mat-checkbox
                [checked]="!isHidden(choice.id)"
                (change)="toggleExercise.emit(choice.id)"
                [attr.data-testid]="'exercise-breakdown-choice-' + choice.id"
              >
                <i class="swatch" [style.background]="choice.color"></i>
                {{ choice.label }}
              </mat-checkbox>
            }
          </div>
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
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
    }
    .swatch {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 3px;
      margin-right: 6px;
      vertical-align: baseline;
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
  readonly barMode = input<BarMode>('stacked');

  readonly barModeChange = output<BarMode>();
  readonly toggleExercise = output<string>();
  readonly showAll = output<void>();

  readonly hasChoices = computed(
    () => this.exercises().length > 1 || this.hidden().length > 0
  );

  isHidden(exerciseId: string): boolean {
    return this.hidden().includes(exerciseId);
  }
}
