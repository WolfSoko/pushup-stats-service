import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import {
  ExerciseToggle,
  PlanDayExercisesComponent,
} from './plan-day-exercises.component';
import { DayRow } from './training-plan-detail.models';

/**
 * Today's plan day, lifted to the top of the plan page.
 *
 * The week list below is a reference for the whole plan; this card is
 * what the user came for on a training day — the prescription, its live
 * progress, and the way into the guided session — without scrolling for
 * it. It renders the same exercise list as the day row and forwards the
 * same events, so both stay one behavior.
 */
@Component({
  selector: 'app-plan-today-card',
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    PlanDayExercisesComponent,
    RouterLink,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './plan-today-card.component.html',
  styleUrl: './plan-today-card.component.css',
})
export class PlanTodayCardComponent {
  readonly row = input.required<DayRow>();
  readonly sessionLink = input.required<string[]>();
  /** False while the plan isn't the active one — the card stays read-only. */
  readonly interactive = input(false);
  /** Whether the guided session is worth offering for this day. */
  readonly offersSession = input(false);

  readonly logExercise = output<number>();
  readonly toggleExercise = output<ExerciseToggle>();
  readonly resetExercise = output<number>();

  protected readonly isRest = computed(() => this.row().day.kind === 'rest');

  protected readonly icon = computed(() => {
    switch (this.row().day.kind) {
      case 'rest':
        return 'self_improvement';
      case 'light':
        return 'directions_walk';
      case 'test':
        return 'local_fire_department';
      default:
        return 'fitness_center';
    }
  });
}
