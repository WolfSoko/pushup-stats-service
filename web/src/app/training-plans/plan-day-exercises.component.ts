import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DayExerciseRow } from './training-plan-detail.models';

/** Emitted when the user ticks an exercise on or off by hand. */
export interface ExerciseToggle {
  itemIndex: number;
  done: boolean;
}

/**
 * The per-exercise checklist of one plan day. Purely presentational —
 * the parent owns the store writes.
 *
 * Each exercise can be closed in two ways: logging the prescribed
 * amount as a real entry (so it counts towards stats and streaks), or
 * ticking it off. Exercises already covered by logged entries render as
 * done and lock their checkbox — un-ticking them would be a lie the
 * next mirror update would immediately undo.
 */
@Component({
  selector: 'app-plan-day-exercises',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-day-exercises.component.html',
  styleUrl: './plan-day-exercises.component.css',
})
export class PlanDayExercisesComponent {
  readonly exercises = input.required<ReadonlyArray<DayExerciseRow>>();
  /** False for future days and inactive plans — the list stays read-only. */
  readonly interactive = input(false);

  readonly logExercise = output<number>();
  readonly toggleExercise = output<ExerciseToggle>();

  protected readonly autoTooltip = $localize`:@@trainingPlans.exercise.auto:Automatisch erfüllt — durch deine Einträge an diesem Tag.`;
  protected readonly checkTooltip = $localize`:@@trainingPlans.exercise.check:Übung abhaken (ohne Eintrag)`;
  protected readonly undoTooltip = $localize`:@@trainingPlans.exercise.undo:Haken entfernen`;
  protected readonly logTooltip = $localize`:@@trainingPlans.exercise.log:Vorgabe eintragen`;
}
